import { Router, Request, Response } from 'express';
import { OpportunityService } from '../services/opportunityService';
import { AnalysisService } from '../services/analysisService';

export const opportunitiesRouter = Router();

// Allowed query parameters for GET /api/opportunities validation
const ALLOWED_QUERY_PARAMS = new Set([
  'status',
  'fundingType',
  'minimumFitScore',
  'dataKind',
  'sourceSystem',
  'verificationStatus',
  'page',
  'limit',
]);

/**
 * GET /api/opportunities
 * Query params: status, fundingType, minimumFitScore, dataKind, sourceSystem, verificationStatus, page, limit
 */
opportunitiesRouter.get('/', async (req: Request, res: Response) => {
  try {
    // Check for unexpected query parameters
    const unknownParams = Object.keys(req.query).filter((param) => !ALLOWED_QUERY_PARAMS.has(param));
    if (unknownParams.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid query parameter(s): ${unknownParams.map((p) => `'${p}'`).join(', ')}. Allowed parameters: ${Array.from(ALLOWED_QUERY_PARAMS).join(', ')}`,
      });
    }

    const { status, fundingType, minimumFitScore, dataKind, sourceSystem, verificationStatus, page, limit } = req.query;

    // Validate numeric parameters
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
 * POST /api/opportunities/:id/analyze
 * Empty body only. Evaluates opportunity against Bridge Forward profile and creates/returns deterministic analysis.
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
 * Returns current analysis, historical analysis versions, dimensions, findings, and reviews graph.
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
 * Submit human review decision on current analysis version. Requires Bearer Token.
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
