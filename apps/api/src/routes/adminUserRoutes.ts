import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import { AdminUserService } from '../services/adminUserService';

export const adminUserRouter = Router();

// Enforce ADMIN role for all routes in this router
adminUserRouter.use(requireAuth, requireRole('ADMIN'));

/**
 * GET /api/admin/users
 * Returns list of all user records with active session counts.
 */
adminUserRouter.get('/', async (req: Request, res: Response) => {
  try {
    const users = await AdminUserService.listUsers();
    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to list users',
    });
  }
});

/**
 * POST /api/admin/users
 * Creates a new user account (ADMIN only).
 */
adminUserRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { email, displayName, password, role, mustChangePassword } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const user = await AdminUserService.createUser({
      email,
      displayName,
      password,
      role,
      mustChangePassword,
      adminUserId: req.user!.id,
      ipAddress,
      userAgent,
    });

    return res.status(201).json({
      success: true,
      user,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to create user',
    });
  }
});

/**
 * PATCH /api/admin/users/:id/role
 * Updates a user's role (ADMIN only).
 */
adminUserRouter.patch('/:id/role', async (req: Request, res: Response) => {
  try {
    const { role } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const user = await AdminUserService.updateUserRole({
      targetUserId: req.params.id,
      newRole: role,
      adminUserId: req.user!.id,
      ipAddress,
      userAgent,
    });

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to update user role',
    });
  }
});

/**
 * PATCH /api/admin/users/:id/state
 * Enables or disables a user account (ADMIN only).
 */
adminUserRouter.patch('/:id/state', async (req: Request, res: Response) => {
  try {
    const { accountState } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const user = await AdminUserService.updateUserState({
      targetUserId: req.params.id,
      newState: accountState,
      adminUserId: req.user!.id,
      ipAddress,
      userAgent,
    });

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to update user state',
    });
  }
});

/**
 * POST /api/admin/users/:id/revoke-sessions
 * Revokes all active sessions for a user (ADMIN only).
 */
adminUserRouter.post('/:id/revoke-sessions', async (req: Request, res: Response) => {
  try {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await AdminUserService.revokeUserSessions({
      targetUserId: req.params.id,
      adminUserId: req.user!.id,
      ipAddress,
      userAgent,
    });

    return res.status(200).json({
      success: true,
      message: `Revoked ${result.revokedCount} active sessions.`,
      revokedCount: result.revokedCount,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to revoke user sessions',
    });
  }
});
