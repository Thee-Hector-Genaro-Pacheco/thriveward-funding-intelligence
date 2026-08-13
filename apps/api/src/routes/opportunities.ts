import { Router, Request, Response } from 'express';
import { OpportunityService } from '../services/opportunityService';
import { AnalysisService } from '../services/analysisService';
import { RelevanceService } from '../services/relevanceService';
import { PursuitService } from '../services/pursuitService';
import { PursuitStage } from '@prisma/client';

export const opportunitiesRouter = Router();

// Allowed query parameters for GET /api/opportunities validation
const ALLOWED_QUERY_PARAMS = new Set([
  'status',
  'fundingType',
  'minimumFitScore',
  'dataKind',
  'sourceSystem',
  'verificationStatus',
  'pursuitStage',
  'relevanceStatus',
  'candidateRoutingStatus',
  'page',
  'limit',
]);

/**
 * GET /api/opportunities
 * Query params: status, fundingType, minimumFitScore, dataKind, sourceSystem, verificationStatus, pursuitStage, relevanceStatus, candidateRoutingStatus, page, limit
 */
opportunitiesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const unknownParams = Object.keys(req.query).filter((param) => !ALLOWED_QUERY_PARAMS.has(param));
    if (unknownParams.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid query parameter(s): ${unknownParams.map((p) => `'${p}'`).join(', ')}. Allowed parameters: ${Array.from(ALLOWED_QUERY_PARAMS).join(', ')}`,
      });
    }

    const { status, fundingType, minimumFitScore, dataKind, sourceSystem, verificationStatus, pursuitStage, relevanceStatus, candidateRoutingStatus, page, limit } = req.query;

    let parsedMinimumFitScore: number | undefined;
    if (minimumFitScore !== undefined) {
      parsedMinimumFitScore = Number(minimumFitScore);
      if (isNaN(parsedMinimumFitScore) || parsedMinimumFitScore < 0 || parsedMinimumFitScore > 100) {
        return res.status(400).json({
          error: 'Bad Request',
          message: "Query parameter 'minimumFitScore' must be a valid number between 0 and 100",
        });
      }
    }

    let parsedPage: number | undefined;
    if (page !== undefined) {
      parsedPage = Number(page);
      if (isNaN(parsedPage) || parsedPage < 1 || !Number.isInteger(parsedPage)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: "Query parameter 'page' must be a positive integer >= 1",
        });
      }
    }

    let parsedLimit: number | undefined;
    if (limit !== undefined) {
      parsedLimit = Number(limit);
      if (isNaN(parsedLimit) || parsedLimit < 1 || !Number.isInteger(parsedLimit)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: "Query parameter 'limit' must be a positive integer >= 1",
        });
      }
      if (parsedLimit > 100) {
        return res.status(400).json({
          error: 'Bad Request',
          message: "Query parameter 'limit' cannot exceed maximum allowed page size of 100",
        });
      }
    }

    const result = await OpportunityService.listOpportunities({
      status: status ? String(status) : undefined,
      fundingType: fundingType ? String(fundingType) : undefined,
      minimumFitScore: parsedMinimumFitScore,
      dataKind: dataKind ? String(dataKind) : undefined,
      sourceSystem: sourceSystem ? String(sourceSystem) : undefined,
      verificationStatus: verificationStatus ? String(verificationStatus) : undefined,
      pursuitStage: pursuitStage ? String(pursuitStage) : undefined,
      relevanceStatus: relevanceStatus ? String(relevanceStatus) : undefined,
      candidateRoutingStatus: candidateRoutingStatus ? String(candidateRoutingStatus) : undefined,
      page: parsedPage,
      limit: parsedLimit,
    });

    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({
      error: 'Bad Request',
      message: err.message || 'Error executing opportunity search query',
    });
  }
});

/**
 * GET /api/opportunities/locked
 * Retrieves list of opportunities currently in LOCKED pursuit stage.
 */
opportunitiesRouter.get('/locked', async (_req: Request, res: Response) => {
  try {
    const lockedMatches = await PursuitService.getLockedMatches();
    return res.status(200).json({ data: lockedMatches, count: lockedMatches.length });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Error retrieving locked matches',
    });
  }
});

/**
 * GET /api/opportunities/:id
 * Retrieve full funding opportunity record by ID
 */
opportunitiesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const opportunity = await OpportunityService.getOpportunityById(id);

    if (!opportunity) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Funding opportunity with ID '${id}' not found.`,
      });
    }

    return res.json(opportunity);
  } catch (err: any) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'Error retrieving opportunity',
    });
  }
});

/**
 * POST /api/opportunities/:id/relevance
 * Computes contextual relevance for opportunity against Bridge Forward profile.
 */
opportunitiesRouter.post('/:id/relevance', async (req: Request, res: Response) => {
  try {
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `POST /api/opportunities/:id/relevance accepts an empty request body only. Unknown properties: ${Object.keys(req.body).join(', ')}`,
      });
    }

    const { id } = req.params;
    const relevance = await RelevanceService.assessRelevance(id);
    return res.status(200).json(relevance);
  } catch (err: any) {
    const message = err.message || '';
    if (message.includes('not found')) {
      return res.status(404).json({ error: 'Not Found', message });
    }
    return res.status(400).json({ error: 'Bad Request', message });
  }
});

/**
 * GET /api/opportunities/:id/relevance
 * Retrieves current contextual relevance record.
 */
opportunitiesRouter.get('/:id/relevance', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const relevance = await RelevanceService.getRelevance(id);
    if (!relevance) {
      return res.status(200).json({ relevance: null, message: 'No relevance assessment generated yet for this opportunity.' });
    }
    return res.status(200).json(relevance);
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: err.message || 'Error retrieving relevance' });
  }
});

/**
 * POST /api/opportunities/:id/pursuit
 * Transition pursuit stage (requires Bearer Token).
 */
opportunitiesRouter.post('/:id/pursuit', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;

    const ALLOWED_PURSUIT_KEYS = new Set(['stage', 'targetStage', 'reviewerId', 'notes', 'reason']);
    const unknownBodyKeys = Object.keys(req.body || {}).filter((k) => !ALLOWED_PURSUIT_KEYS.has(k));
    if (unknownBodyKeys.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Unknown property in pursuit request body: ${unknownBodyKeys.join(', ')}`,
      });
    }

    const stage = req.body?.stage || req.body?.targetStage;
    const { reviewerId, notes, reason } = req.body || {};

    if (!stage || !Object.values(PursuitStage).includes(stage as PursuitStage)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid or missing 'stage' parameter. Allowed values: ${Object.values(PursuitStage).join(', ')}`,
      });
    }

    const result = await PursuitService.transitionStage({
      fundingOpportunityId: id,
      targetStage: stage as PursuitStage,
      reviewerId,
      notes,
      reason,
      authHeader,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    const message = err.message || '';
    if (message.startsWith('UNAUTHORIZED')) {
      return res.status(401).json({ error: 'Unauthorized', message });
    }
    if (message.includes('not found')) {
      return res.status(404).json({ error: 'Not Found', message });
    }
    return res.status(400).json({ error: 'Bad Request', message });
  }
});

/**
 * GET /api/opportunities/:id/pursuit/history
 * Retrieves pursuit audit transition history.
 */
opportunitiesRouter.get('/:id/pursuit/history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const history = await PursuitService.getHistory(id);
    return res.status(200).json({ data: history, count: history.length });
  } catch (err: any) {
    const message = err.message || '';
    if (message.includes('not found')) {
      return res.status(404).json({ error: 'Not Found', message });
    }
    return res.status(500).json({ error: 'Internal Server Error', message });
  }
});

/**
 * POST /api/opportunities/:id/analyze
 */
opportunitiesRouter.post('/:id/analyze', async (req: Request, res: Response) => {
  try {
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `POST /api/opportunities/:id/analyze accepts an empty request body only. Unknown properties: ${Object.keys(req.body).join(', ')}`,
      });
    }

    const { id } = req.params;
    const analysis = await AnalysisService.analyzeOpportunity(id);
    return res.status(200).json(analysis);
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      error: statusCode === 404 ? 'Not Found' : statusCode === 400 ? 'Bad Request' : 'Internal Server Error',
      message: err.message || 'Error running opportunity analysis',
    });
  }
});

/**
 * GET /api/opportunities/:id/analysis
 */
opportunitiesRouter.get('/:id/analysis', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await AnalysisService.getOpportunityAnalysis(id);
    return res.status(200).json(result);
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      error: statusCode === 404 ? 'Not Found' : 'Internal Server Error',
      message: err.message || 'Error retrieving opportunity analysis',
    });
  }
});

/**
 * POST /api/opportunities/:id/analysis/review
 */
opportunitiesRouter.post('/:id/analysis/review', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;

    const ALLOWED_REVIEW_PROPERTIES = new Set([
      'analysisId',
      'decision',
      'reviewerId',
      'reviewerNotes',
      'allowabilityOverrides',
    ]);
    const unknownBodyKeys = Object.keys(req.body || {}).filter((k) => !ALLOWED_REVIEW_PROPERTIES.has(k));
    if (unknownBodyKeys.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Unknown property in review request body: ${unknownBodyKeys.join(', ')}`,
      });
    }

    const { analysisId, decision, reviewerId, reviewerNotes, allowabilityOverrides } = req.body || {};

    const updatedAnalysis = await AnalysisService.reviewAnalysis({
      fundingOpportunityId: id,
      analysisId,
      decision,
      reviewerId,
      reviewerNotes,
      allowabilityOverrides,
      authHeader,
    });

    return res.status(200).json(updatedAnalysis);
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    let errorTitle = 'Internal Server Error';
    if (statusCode === 401) errorTitle = 'Unauthorized';
    if (statusCode === 400) errorTitle = 'Bad Request';
    if (statusCode === 404) errorTitle = 'Not Found';
    if (statusCode === 409) errorTitle = 'Conflict';

    return res.status(statusCode).json({
      error: errorTitle,
      message: err.message || 'Error processing analysis review',
    });
  }
});
