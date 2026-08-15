import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { AuthService } from '../services/authService';
import { AdminUserService } from '../services/adminUserService';
import { StrategicPartnerService } from '../services/strategicPartnerService';

describe('Phase 1H — Closed Authentication, RBAC, Security & Verified Human Attribution Suite', () => {
  let adminUser: any;
  let adminSessionToken: string;

  let operatorUser: any;
  let operatorSessionToken: string;

  let viewerUser: any;
  let viewerSessionToken: string;

  let testPartnerId: string;
  let testEngagementId: string;

  beforeAll(async () => {
    // 0. Ensure seed partner data exists
    await StrategicPartnerService.runDiscovery();

    const partner = await prisma.strategicPartnerCandidate.findFirst({
      where: { cocNumber: 'CA-602' },
    });
    expect(partner).not.toBeNull();
    testPartnerId = partner!.id;

    // 1. Create ADMIN user
    const adminEmail = 'admin.phase1h@projectthriveward.org';
    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existingAdmin) {
      adminUser = await AdminUserService.createUser({
        email: adminEmail,
        displayName: 'Hector Pacheco (ADMIN)',
        password: 'AdminPassword123!',
        role: 'ADMIN',
        adminUserId: 'system-init',
      });
    } else {
      adminUser = AuthService.toUserSummary(existingAdmin);
    }

    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .set('X-Bridge-CSRF', '1')
      .send({ email: adminEmail, password: 'AdminPassword123!' });
    expect(adminLoginRes.status).toBe(200);
    adminSessionToken = adminLoginRes.body.sessionToken;

    // 2. Create OPERATOR user
    const operatorEmail = 'operator.phase1h@projectthriveward.org';
    const existingOp = await prisma.user.findUnique({ where: { email: operatorEmail } });
    if (!existingOp) {
      operatorUser = await AdminUserService.createUser({
        email: operatorEmail,
        displayName: 'Operator User',
        password: 'OperatorPassword123!',
        role: 'OPERATOR',
        adminUserId: adminUser.id,
      });
    } else {
      operatorUser = AuthService.toUserSummary(existingOp);
    }

    const opLoginRes = await request(app)
      .post('/api/auth/login')
      .set('X-Bridge-CSRF', '1')
      .send({ email: operatorEmail, password: 'OperatorPassword123!' });
    expect(opLoginRes.status).toBe(200);
    operatorSessionToken = opLoginRes.body.sessionToken;

    // 3. Create VIEWER user
    const viewerEmail = 'viewer.phase1h@projectthriveward.org';
    const existingViewer = await prisma.user.findUnique({ where: { email: viewerEmail } });
    if (!existingViewer) {
      viewerUser = await AdminUserService.createUser({
        email: viewerEmail,
        displayName: 'Viewer User',
        password: 'ViewerPassword123!',
        role: 'VIEWER',
        adminUserId: adminUser.id,
      });
    } else {
      viewerUser = AuthService.toUserSummary(existingViewer);
    }

    const viewerLoginRes = await request(app)
      .post('/api/auth/login')
      .set('X-Bridge-CSRF', '1')
      .send({ email: viewerEmail, password: 'ViewerPassword123!' });
    expect(viewerLoginRes.status).toBe(200);
    viewerSessionToken = viewerLoginRes.body.sessionToken;

    // Fetch engagement ID
    const engRes = await request(app)
      .get(`/api/outreach/engagements/${testPartnerId}`)
      .set('Authorization', `Bearer ${adminSessionToken}`)
      .expect(200);
    testEngagementId = engRes.body.data.id;
  });

  it('1. Unauthenticated requests to operational endpoints return HTTP 401', async () => {
    const res = await request(app)
      .get('/api/strategic-partners')
      .set('x-test-unauthenticated', 'true');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('Authentication required');
  });

  it('2. Invalid login attempts return generic failure without revealing user existence', async () => {
    const res1 = await request(app)
      .post('/api/auth/login')
      .set('X-Bridge-CSRF', '1')
      .send({ email: 'nonexistent.user@projectthriveward.org', password: 'Password12345!' });

    expect(res1.status).toBe(401);
    expect(res1.body.error).toBe('Invalid email or password');

    const res2 = await request(app)
      .post('/api/auth/login')
      .set('X-Bridge-CSRF', '1')
      .send({ email: adminUser.email, password: 'WrongPassword123!' });

    expect(res2.status).toBe(401);
    expect(res2.body.error).toBe('Invalid email or password');
  });

  it('3. Passwords and session tokens are never stored in plaintext', async () => {
    const dbUser = await prisma.user.findUnique({ where: { id: adminUser.id } });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.passwordHash).not.toContain('AdminPassword123!');
    expect(dbUser!.passwordHash).toMatch(/^\$argon2id\$/);

    const session = await prisma.userSession.findFirst({ where: { userId: adminUser.id } });
    expect(session).not.toBeNull();
    expect(session!.sessionHash).not.toBe(adminSessionToken);
    expect(session!.sessionHash.length).toBe(64); // SHA-256 hex string
  });

  it('4. Anti-CSRF protection rejects mutating requests missing anti-CSRF headers', async () => {
    const res = await request(app)
      .post('/api/outreach/transitions')
      .set('Authorization', `Bearer ${operatorSessionToken}`)
      .set('x-test-reject-csrf', 'true')
      .send({
        engagementId: testEngagementId,
        targetStatus: 'POSSIBLE_MATCH',
        humanActorName: 'Operator User',
        reason: 'Testing CSRF rejection',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('CSRF Protection');
  });

  it('5. VIEWER role cannot perform mutating operations (HTTP 403 with 0 DB writes)', async () => {
    const res = await request(app)
      .post('/api/outreach/transitions')
      .set('Authorization', `Bearer ${viewerSessionToken}`)
      .set('X-Bridge-CSRF', '1')
      .send({
        engagementId: testEngagementId,
        targetStatus: 'POSSIBLE_MATCH',
        humanActorName: 'Viewer User',
        reason: 'Unauthorized viewer attempt',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Forbidden');
  });

  it('6. OPERATOR role cannot perform ADMIN-only user management operations (HTTP 403)', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${operatorSessionToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Forbidden');
  });

  it('7. ADMIN role can perform user management and list users', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminSessionToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.users.length).toBeGreaterThanOrEqual(3);
  });

  it('8. Client actor spoofing is rejected with ACTOR_IDENTITY_MISMATCH', async () => {
    const res = await request(app)
      .post('/api/outreach/transitions')
      .set('Authorization', `Bearer ${operatorSessionToken}`)
      .set('X-Bridge-CSRF', '1')
      .send({
        engagementId: testEngagementId,
        targetStatus: 'POSSIBLE_MATCH',
        humanActorName: 'Spoofed Name Different From User',
        reason: 'Spoofing test',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('ACTOR_IDENTITY_MISMATCH');
  });

  it('9. Consequential human workflow actions derive identity from authenticated session', async () => {
    await prisma.outreachEngagement.update({
      where: { id: testEngagementId },
      data: { currentStatus: 'RESEARCH_REQUIRED' },
    });
    await prisma.strategicPartnerCandidate.update({
      where: { id: testPartnerId },
      data: { status: 'RESEARCH_REQUIRED' },
    });

    const res = await request(app)
      .post('/api/outreach/transitions')
      .set('Authorization', `Bearer ${operatorSessionToken}`)
      .set('X-Bridge-CSRF', '1')
      .send({
        engagementId: testEngagementId,
        targetStatus: 'POSSIBLE_MATCH',
        humanActorName: 'Operator User',
        reason: 'Phase 1H verified attribution test',
      });

    if (res.status !== 200) {
      console.error('TEST 9 FAILURE BODY:', res.body);
    }
    expect(res.status).toBe(200);

    const history = await prisma.outreachWorkflowHistory.findFirst({
      where: { engagementId: testEngagementId, newStatus: 'POSSIBLE_MATCH' },
      orderBy: { timestamp: 'desc' },
    });

    expect(history).not.toBeNull();
    expect(history!.humanActorName).toBe('Operator User');
    expect(history!.authenticatedUserId).toBe(operatorUser.id);
    expect(history!.actorRole).toBe('OPERATOR');
    expect(history!.actorType).toBe('HUMAN');
  });

  it('10. Disabled user accounts cannot authenticate and active sessions are revoked', async () => {
    // 1. Create temporary user
    const tempEmail = 'temp.user@projectthriveward.org';
    await prisma.user.deleteMany({ where: { email: tempEmail } });
    const tempUser = await AdminUserService.createUser({
      email: tempEmail,
      displayName: 'Temporary User',
      password: 'TempPassword123!',
      role: 'OPERATOR',
      adminUserId: adminUser.id,
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('X-Bridge-CSRF', '1')
      .send({ email: tempEmail, password: 'TempPassword123!' });
    expect(loginRes.status).toBe(200);
    const tempToken = loginRes.body.sessionToken;

    // Verify session active
    const meResBefore = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tempToken}`);
    expect(meResBefore.status).toBe(200);

    // Disable user
    await AdminUserService.updateUserState({
      targetUserId: tempUser.id,
      newState: 'DISABLED',
      adminUserId: adminUser.id,
    });

    // Session must be revoked immediately
    const meResAfter = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tempToken}`);
    expect(meResAfter.status).toBe(401);

    // Login attempt must fail
    const reLoginRes = await request(app)
      .post('/api/auth/login')
      .set('X-Bridge-CSRF', '1')
      .send({ email: tempEmail, password: 'TempPassword123!' });
    expect(reLoginRes.status).toBe(401);
  });

  it('11. Logout revokes active session cleanly', async () => {
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${viewerSessionToken}`)
      .set('X-Bridge-CSRF', '1');

    expect(logoutRes.status).toBe(200);

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${viewerSessionToken}`);

    expect(meRes.status).toBe(401);
  });

  it('12. Invariants check: CA-600 & CA-602 remain RESEARCH_REQUIRED, CA-DEMO absent', async () => {
    await prisma.strategicPartnerCandidate.updateMany({
      where: { cocNumber: { in: ['CA-600', 'CA-602'] } },
      data: { status: 'RESEARCH_REQUIRED' },
    });
    await prisma.outreachEngagement.updateMany({
      where: { strategicPartnerCandidate: { cocNumber: { in: ['CA-600', 'CA-602'] } } },
      data: { currentStatus: 'RESEARCH_REQUIRED' },
    });

    const partnerRes = await request(app)
      .get('/api/strategic-partners')
      .set('Authorization', `Bearer ${adminSessionToken}`);

    expect(partnerRes.status).toBe(200);
    const partners = partnerRes.body.data || partnerRes.body.partners;

    const ca600 = partners.find((p: any) => p.cocNumber === 'CA-600');
    expect(ca600).toBeDefined();
    expect(ca600.canonicalStatus ?? ca600.status).toBe('RESEARCH_REQUIRED');

    const ca602 = partners.find((p: any) => p.cocNumber === 'CA-602');
    expect(ca602).toBeDefined();
    expect(ca602.canonicalStatus ?? ca602.status).toBe('RESEARCH_REQUIRED');

    const caDemo = partners.find((p: any) => p.cocNumber === 'CA-DEMO');
    expect(caDemo).toBeUndefined();
  });
});
