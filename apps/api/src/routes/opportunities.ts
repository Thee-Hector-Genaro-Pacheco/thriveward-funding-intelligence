import { Router, Request, Response } from 'express';
import { OpportunityService } from '../services/opportunityService';

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
