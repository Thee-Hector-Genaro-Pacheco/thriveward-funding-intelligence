import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { AuthService } from '../services/authService';

let cachedAdminToken: string | null = null;

/**
 * Helper providing an authenticated ADMIN session header and anti-CSRF headers for integration test suites.
 */
export async function getTestAuthHeaders(): Promise<{ Authorization: string; 'X-Thriveward-CSRF': string }> {
  if (cachedAdminToken) {
    // Verify token active
    const authResult = await AuthService.authenticateSession(cachedAdminToken);
    if (authResult) {
      return {
        Authorization: `Bearer ${cachedAdminToken}`,
        'X-Thriveward-CSRF': '1',
      };
    }
  }

  const testEmail = 'test.admin.suite@projectthriveward.org';
  let user = await prisma.user.findUnique({ where: { email: testEmail } });

  if (!user) {
    const passwordHash = await AuthService.hashPassword('TestAdminPassword123!');
    user = await prisma.user.create({
      data: {
        email: testEmail,
        displayName: 'Test Admin User',
        passwordHash,
        role: 'ADMIN',
        accountState: 'ACTIVE',
      },
    });
  }

  const loginRes = await request(app)
    .post('/api/auth/login')
    .set('X-Thriveward-CSRF', '1')
    .send({ email: testEmail, password: 'TestAdminPassword123!' });

  if (loginRes.status !== 200 || !loginRes.body.sessionToken) {
    throw new Error(`Test authentication helper failed: ${JSON.stringify(loginRes.body)}`);
  }

  cachedAdminToken = loginRes.body.sessionToken;

  return {
    Authorization: `Bearer ${cachedAdminToken}`,
    'X-Thriveward-CSRF': '1',
  };
}
