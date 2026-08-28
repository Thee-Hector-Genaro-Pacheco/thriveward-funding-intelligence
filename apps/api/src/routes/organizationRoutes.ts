import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import { OrganizationProfileService } from '../services/organizationProfileService';

export const organizationRouter = Router();

organizationRouter.get('/profile', requireAuth, async (_req: Request, res: Response) => {
  try {
    return res.status(200).json(await OrganizationProfileService.getProfile());
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || 'Failed to retrieve organization profile',
    });
  }
});

/**
 * POST /api/organization/reconcile-formation
 * Reconciles official California incorporation formation evidence.
 * Restricted to ADMIN role. Requires explicit confirmation of entity number B20260372748.
 * Rejects client-supplied actor fields; derives actor exclusively from session token.
 */
organizationRouter.post(
  '/organization/reconcile-formation',
  requireAuth,
  requireRole(['ADMIN']),
  async (req: Request, res: Response) => {
    try {
      // Reject client-supplied actor fields
      if (req.body?.actorUserId || req.body?.actorName || req.body?.humanActorName) {
        return res.status(400).json({
          success: false,
          error: 'Client-supplied actor identity is rejected. Human actor identity is derived exclusively from the authenticated session token.',
        });
      }

      const entityNumber = req.body?.entityNumber;
      const userId = req.user!.id; // Derived strictly from authenticated session token

      const result = await OrganizationProfileService.reconcileFormationEvidence({
        userId,
        entityNumber,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({
        success: false,
        error: err.message || 'Failed to reconcile formation evidence',
      });
    }
  }
);

/**
 * GET /api/organization/readiness
 * Retrieves current Project Thriveward readiness & formation status summary.
 * Accessible to all authenticated roles.
 */
organizationRouter.get('/organization/readiness', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = await OrganizationProfileService.getReadinessStatus();
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve readiness status',
    });
  }
});

/**
 * GET /api/organization/match-impact-preview
 * Retrieves a read-only match impact preview for all 14 opportunities under incorporation.
 * Mutation-free, accessible to all authenticated roles.
 */
organizationRouter.get('/organization/match-impact-preview', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = await OrganizationProfileService.getMatchImpactPreview();
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to generate match impact preview',
    });
  }
});
