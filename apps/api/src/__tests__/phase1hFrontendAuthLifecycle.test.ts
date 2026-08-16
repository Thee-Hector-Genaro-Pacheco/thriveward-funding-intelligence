import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { AdminUserService } from '../services/adminUserService';
import { AuthService } from '../services/authService';

describe('Phase 1H — Frontend Authentication Lifecycle & Data Loading Race Prevention Suite', () => {
  let adminEmail = 'admin.lifecycle.test@projectthriveward.org';
  let adminPassword = 'AdminLifecyclePassword123!';
  let adminUser: any;
  let validSessionCookie: string;

  beforeAll(async () => {
    // Provision test admin user
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existing) {
      adminUser = await AdminUserService.createUser({
        email: adminEmail,
        displayName: 'Lifecycle Admin User',
        password: adminPassword,
        role: 'ADMIN',
      });
    } else {
      adminUser = AuthService.toUserSummary(existing);
    }

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('X-Thriveward-CSRF', '1')
      .send({ email: adminEmail, password: adminPassword });

    expect(loginRes.status).toBe(200);
    const cookies = loginRes.get('Set-Cookie');
    expect(cookies).toBeDefined();
    validSessionCookie = cookies![0];
  });

  describe('1. Session Restoration Gating & Public vs Protected Endpoint Separation', () => {
    it('/api/health is accessible publicly without session cookies', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
    });

    it('/api/auth/me returns 401 when no session cookie or header is provided', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('x-test-unauthenticated', 'true');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('unauthenticated GET /api/opportunities is rejected with 401 (zero data exposure before auth)', async () => {
      const res = await request(app)
        .get('/api/opportunities')
        .set('x-test-unauthenticated', 'true');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Authentication required');
    });

    it('unauthenticated GET /api/fiscal-sponsors is rejected with 401', async () => {
      const res = await request(app)
        .get('/api/fiscal-sponsors')
        .set('x-test-unauthenticated', 'true');
      expect(res.status).toBe(401);
    });

    it('unauthenticated GET /api/strategic-partners is rejected with 401', async () => {
      const res = await request(app)
        .get('/api/strategic-partners')
        .set('x-test-unauthenticated', 'true');
      expect(res.status).toBe(401);
    });
  });

  describe('2. Authenticated Session Gating & Data Loading Verification', () => {
    it('/api/auth/me validates session cookie and returns user context', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [validSessionCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe(adminEmail);
      expect(res.body.user.role).toBe('ADMIN');
    });

    it('authenticated session allows protected /api/opportunities retrieval', async () => {
      const res = await request(app)
        .get('/api/opportunities')
        .set('Cookie', [validSessionCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('authenticated session allows protected /api/fiscal-sponsors retrieval', async () => {
      const res = await request(app)
        .get('/api/fiscal-sponsors')
        .set('Cookie', [validSessionCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('authenticated session allows protected /api/strategic-partners retrieval', async () => {
      const res = await request(app)
        .get('/api/strategic-partners')
        .set('Cookie', [validSessionCookie]);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('3. Session Revocation & Immediate 401 Rejection', () => {
    it('logging out revokes session and subsequent protected requests fail closed with 401', async () => {
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [validSessionCookie])
        .set('X-Thriveward-CSRF', '1');

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Verify the revoked session token cannot access /api/auth/me
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [validSessionCookie]);

      expect(meRes.status).toBe(401);

      // Verify protected endpoint fails closed
      const oppRes = await request(app)
        .get('/api/opportunities')
        .set('Cookie', [validSessionCookie]);

      expect(oppRes.status).toBe(401);
    });
  });
});
