import { prisma } from '../lib/prisma';
import { AuthService, UserSummary, UserRole, AccountState } from './authService';

export class AdminUserService {
  /**
   * Returns list of all user records for administrator review.
   */
  public static async listUsers(): Promise<Array<UserSummary & { activeSessionCount: number }>> {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        sessions: {
          where: {
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        },
      },
    });

    return users.map((u) => ({
      ...AuthService.toUserSummary(u),
      activeSessionCount: u.sessions.length,
    }));
  }

  /**
   * Creates a new internal user account (ADMIN only).
   */
  public static async createUser(params: {
    email: string;
    displayName: string;
    password: string;
    role?: UserRole;
    mustChangePassword?: boolean;
    adminUserId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<UserSummary> {
    const normalizedEmail = (params.email || '').toLowerCase().trim();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new Error('Valid email address is required');
    }

    if (!params.displayName || params.displayName.trim().length === 0) {
      throw new Error('Display name is required');
    }

    if (!params.password || params.password.length < 12) {
      throw new Error('Password must be at least 12 characters long');
    }

    const role: UserRole = params.role || 'OPERATOR';
    if (!['ADMIN', 'OPERATOR', 'VIEWER'].includes(role)) {
      throw new Error('Invalid user role specified');
    }

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new Error('A user account with this email already exists');
    }

    const passwordHash = await AuthService.hashPassword(params.password);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        displayName: params.displayName.trim(),
        passwordHash,
        role,
        accountState: 'ACTIVE',
        mustChangePassword: params.mustChangePassword ?? false,
      },
    });

    await AuthService.logSecurityEvent({
      userId: params.adminUserId,
      eventType: 'USER_CREATION',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      details: JSON.stringify({ targetUserId: user.id, targetEmail: user.email, role: user.role }),
    });

    return AuthService.toUserSummary(user);
  }

  /**
   * Updates a user's role (ADMIN only).
   */
  public static async updateUserRole(params: {
    targetUserId: string;
    newRole: UserRole;
    adminUserId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<UserSummary> {
    if (!['ADMIN', 'OPERATOR', 'VIEWER'].includes(params.newRole)) {
      throw new Error('Invalid user role specified');
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: params.targetUserId },
    });

    if (!targetUser) {
      throw new Error('Target user not found');
    }

    const updated = await prisma.user.update({
      where: { id: params.targetUserId },
      data: { role: params.newRole },
    });

    await AuthService.logSecurityEvent({
      userId: params.adminUserId,
      eventType: 'ROLE_CHANGE',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      details: JSON.stringify({
        targetUserId: targetUser.id,
        previousRole: targetUser.role,
        newRole: params.newRole,
      }),
    });

    return AuthService.toUserSummary(updated);
  }

  /**
   * Enables or disables a user account (ADMIN only).
   */
  public static async updateUserState(params: {
    targetUserId: string;
    newState: AccountState;
    adminUserId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<UserSummary> {
    if (!['ACTIVE', 'DISABLED'].includes(params.newState)) {
      throw new Error('Invalid account state specified');
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: params.targetUserId },
    });

    if (!targetUser) {
      throw new Error('Target user not found');
    }

    // If disabling account, revoke all active sessions immediately
    if (params.newState === 'DISABLED') {
      await prisma.userSession.updateMany({
        where: { userId: params.targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    const updated = await prisma.user.update({
      where: { id: params.targetUserId },
      data: { accountState: params.newState },
    });

    await AuthService.logSecurityEvent({
      userId: params.adminUserId,
      eventType: 'USER_STATE_CHANGE',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      details: JSON.stringify({
        targetUserId: targetUser.id,
        previousState: targetUser.accountState,
        newState: params.newState,
      }),
    });

    return AuthService.toUserSummary(updated);
  }

  /**
   * Revokes all active sessions for a target user (ADMIN only).
   */
  public static async revokeUserSessions(params: {
    targetUserId: string;
    adminUserId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ revokedCount: number }> {
    const result = await prisma.userSession.updateMany({
      where: { userId: params.targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await AuthService.logSecurityEvent({
      userId: params.adminUserId,
      eventType: 'SESSION_REVOCATION',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      details: JSON.stringify({
        targetUserId: params.targetUserId,
        revokedCount: result.count,
      }),
    });

    return { revokedCount: result.count };
  }
}
