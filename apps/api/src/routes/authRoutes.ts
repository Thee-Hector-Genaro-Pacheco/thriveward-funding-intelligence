import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { requireAuth } from '../middleware/authMiddleware';

export const authRouter = Router();

/**
 * POST /api/auth/login
 * Authenticates user credentials, sets HttpOnly session cookie, and returns user summary.
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const { user, sessionToken } = await AuthService.login({
      email,
      password,
      ipAddress,
      userAgent,
    });

    res.cookie('bridge_session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      user,
      sessionToken, // Also provided for API / test client convenience
    });
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      error: error.message || 'Authentication failed',
    });
  }
});

/**
 * POST /api/auth/logout
 * Revokes active session and clears HttpOnly session cookie.
 */
authRouter.post('/logout', async (req: Request, res: Response) => {
  let token: string | undefined;

  if (req.cookies && req.cookies.bridge_session_token) {
    token = req.cookies.bridge_session_token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7).trim();
  }

  if (token) {
    await AuthService.logout({
      rawSessionToken: token,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
  }

  res.clearCookie('bridge_session_token', { path: '/' });

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * GET /api/auth/me
 * Returns current authenticated user profile.
 */
authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    user: AuthService.toUserSummary(req.user!),
  });
});

/**
 * POST /api/auth/change-password
 * Changes password for authenticated user and updates session cookie.
 */
authRouter.post('/change-password', requireAuth, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const { user, newSessionToken } = await AuthService.changePassword({
      userId: req.user!.id,
      currentPassword,
      newPassword,
      ipAddress,
      userAgent,
    });

    res.cookie('bridge_session_token', newSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully',
      user,
      sessionToken: newSessionToken,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to update password',
    });
  }
});
