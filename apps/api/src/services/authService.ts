import argon2 from 'argon2';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { User, UserSession } from '@prisma/client';

export type UserRole = 'ADMIN' | 'OPERATOR' | 'VIEWER';
export type AccountState = 'ACTIVE' | 'DISABLED';

export interface UserSummary {
  id: string;
  email: string;
  displayName: string;
  role: string;
  accountState: string;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

// In-memory rate limiting map for login attempts (email:ip -> timestamps)
const loginAttemptMap = new Map<string, number[]>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export class AuthService {
  /**
   * Hashes a password using Argon2id with strict length verification.
   */
  public static async hashPassword(password: string): Promise<string> {
    if (!password || password.length < 12) {
      throw new Error('Password must be at least 12 characters long');
    }
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Verifies a password against an Argon2id hash.
   */
  public static async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /**
   * Hashes a raw session token using SHA-256 for secure DB persistence.
   */
  public static hashSessionToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Checks login rate limits for a given email and IP address.
   */
  public static isRateLimited(email: string, ipAddress?: string): boolean {
    const key = `${(email || '').toLowerCase().trim()}:${ipAddress || 'unknown'}`;
    const now = Date.now();
    const attempts = (loginAttemptMap.get(key) || []).filter(
      (ts) => now - ts < LOGIN_RATE_WINDOW_MS
    );
    loginAttemptMap.set(key, attempts);
    return attempts.length >= MAX_LOGIN_ATTEMPTS;
  }

  /**
   * Records a failed login attempt for rate-limiting.
   */
  private static recordFailedAttempt(email: string, ipAddress?: string): void {
    const key = `${(email || '').toLowerCase().trim()}:${ipAddress || 'unknown'}`;
    const attempts = loginAttemptMap.get(key) || [];
    attempts.push(Date.now());
    loginAttemptMap.set(key, attempts);
  }

  /**
   * Clears failed login attempts after successful authentication.
   */
  private static clearFailedAttempts(email: string, ipAddress?: string): void {
    const key = `${(email || '').toLowerCase().trim()}:${ipAddress || 'unknown'}`;
    loginAttemptMap.delete(key);
  }

  /**
   * Sanitizes user record for API output.
   */
  public static toUserSummary(user: User): UserSummary {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      accountState: user.accountState,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  /**
   * Authenticates user email & password, logs audit event, and returns a new session.
   */
  public static async login(params: {
    email: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ user: UserSummary; sessionToken: string }> {
    const normalizedEmail = (params.email || '').toLowerCase().trim();

    if (!normalizedEmail || !params.password) {
      throw new Error('Invalid email or password');
    }

    if (this.isRateLimited(normalizedEmail, params.ipAddress)) {
      await this.logSecurityEvent({
        userId: null,
        eventType: 'LOGIN_FAILURE',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        details: JSON.stringify({ reason: 'RATE_LIMIT_EXCEEDED', email: normalizedEmail }),
      });
      throw new Error('Too many failed login attempts. Please try again later.');
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      this.recordFailedAttempt(normalizedEmail, params.ipAddress);
      await this.logSecurityEvent({
        userId: null,
        eventType: 'LOGIN_FAILURE',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        details: JSON.stringify({ reason: 'USER_NOT_FOUND' }),
      });
      throw new Error('Invalid email or password');
    }

    if (user.accountState === 'DISABLED') {
      this.recordFailedAttempt(normalizedEmail, params.ipAddress);
      await this.logSecurityEvent({
        userId: user.id,
        eventType: 'LOGIN_FAILURE',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        details: JSON.stringify({ reason: 'ACCOUNT_DISABLED' }),
      });
      throw new Error('Invalid email or password');
    }

    const isValidPassword = await this.verifyPassword(user.passwordHash, params.password);
    if (!isValidPassword) {
      this.recordFailedAttempt(normalizedEmail, params.ipAddress);
      await this.logSecurityEvent({
        userId: user.id,
        eventType: 'LOGIN_FAILURE',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        details: JSON.stringify({ reason: 'INVALID_PASSWORD' }),
      });
      throw new Error('Invalid email or password');
    }

    // Authentication succeeded
    this.clearFailedAttempts(normalizedEmail, params.ipAddress);

    // Create session
    const rawSessionToken = crypto.randomBytes(32).toString('hex');
    const sessionHash = this.hashSessionToken(rawSessionToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.userSession.create({
      data: {
        userId: user.id,
        sessionHash,
        expiresAt,
      },
    });

    // Update lastLoginAt
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.logSecurityEvent({
      userId: user.id,
      eventType: 'LOGIN_SUCCESS',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      details: JSON.stringify({ role: user.role }),
    });

    return {
      user: this.toUserSummary(updatedUser),
      sessionToken: rawSessionToken,
    };
  }

  /**
   * Validates raw session token, updates lastSeenAt, and returns authenticated user.
   */
  public static async authenticateSession(rawSessionToken: string): Promise<{
    user: User;
    session: UserSession;
  } | null> {
    if (!rawSessionToken) return null;

    const sessionHash = this.hashSessionToken(rawSessionToken);
    const session = await prisma.userSession.findUnique({
      where: { sessionHash },
      include: { user: true },
    });

    if (!session || session.revokedAt !== null || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    if (session.user.accountState !== 'ACTIVE') {
      return null;
    }

    // Update lastSeenAt asynchronously if last seen > 1 minute ago
    if (Date.now() - session.lastSeenAt.getTime() > 60 * 1000) {
      await prisma.userSession.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      }).catch(() => {});
    }

    return { user: session.user, session };
  }

  /**
   * Revokes active session during logout.
   */
  public static async logout(params: {
    rawSessionToken: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<boolean> {
    if (!params.rawSessionToken) return false;

    const sessionHash = this.hashSessionToken(params.rawSessionToken);
    const session = await prisma.userSession.findUnique({
      where: { sessionHash },
    });

    if (session && session.revokedAt === null) {
      await prisma.userSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      await this.logSecurityEvent({
        userId: session.userId,
        eventType: 'LOGOUT',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        details: JSON.stringify({ sessionId: session.id }),
      });
      return true;
    }

    return false;
  }

  /**
   * Updates an authenticated user's password, revokes existing sessions, and generates a new session.
   */
  public static async changePassword(params: {
    userId: string;
    currentPassword: string;
    newPassword: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ user: UserSummary; newSessionToken: string }> {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
    });

    if (!user || user.accountState !== 'ACTIVE') {
      throw new Error('User not found or account disabled');
    }

    const isValid = await this.verifyPassword(user.passwordHash, params.currentPassword);
    if (!isValid) {
      await this.logSecurityEvent({
        userId: user.id,
        eventType: 'PASSWORD_CHANGE_FAILURE',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        details: JSON.stringify({ reason: 'INVALID_CURRENT_PASSWORD' }),
      });
      throw new Error('Current password is incorrect');
    }

    if (!params.newPassword || params.newPassword.length < 12) {
      throw new Error('New password must be at least 12 characters long');
    }

    const newPasswordHash = await this.hashPassword(params.newPassword);

    // Revoke all existing active sessions
    await prisma.userSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Create new session
    const rawSessionToken = crypto.randomBytes(32).toString('hex');
    const sessionHash = this.hashSessionToken(rawSessionToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.userSession.create({
      data: {
        userId: user.id,
        sessionHash,
        expiresAt,
      },
    });

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
      },
    });

    await this.logSecurityEvent({
      userId: user.id,
      eventType: 'PASSWORD_CHANGE',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      details: JSON.stringify({ revokedAllSessions: true }),
    });

    return {
      user: this.toUserSummary(updatedUser),
      newSessionToken: rawSessionToken,
    };
  }

  /**
   * Logs append-only security audit event. Never records plaintext passwords or secrets!
   */
  public static async logSecurityEvent(params: {
    userId?: string | null;
    eventType: string;
    ipAddress?: string;
    userAgent?: string;
    details?: string;
  }): Promise<void> {
    await prisma.securityAuditEvent.create({
      data: {
        userId: params.userId || null,
        eventType: params.eventType,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        details: params.details || null,
      },
    }).catch((err) => {
      console.error('[AuthService] Failed to write security audit event:', err);
    });
  }

  public static async getAuditEvents(options: {
    includeSyntheticTestEvents?: boolean;
    limit?: number;
  } = {}) {
    const includeSynthetic = !!options.includeSyntheticTestEvents;
    const limit = options.limit || 100;

    const events = await prisma.securityAuditEvent.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
      include: {
        classifications: {
          include: { batch: true },
        },
      },
    });

    return events
      .filter((event) => {
        const isSynthetic = event.classifications.some((c) => c.classification === 'SYNTHETIC_TEST_EVENT');
        if (isSynthetic && !includeSynthetic) return false;
        return true;
      })
      .map((event) => {
        const syntheticClassification = event.classifications.find((c) => c.classification === 'SYNTHETIC_TEST_EVENT');
        return {
          ...event,
          classifiedLabel: syntheticClassification ? 'Synthetic automated-test event — retained for audit integrity' : null,
        };
      });
  }
}

