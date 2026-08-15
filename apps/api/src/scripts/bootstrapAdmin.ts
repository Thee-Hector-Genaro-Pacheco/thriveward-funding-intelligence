import { prisma } from '../lib/prisma';
import { AuthService } from '../services/authService';

async function bootstrapAdmin() {
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').toLowerCase().trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || '';
  const displayName = (process.env.BOOTSTRAP_ADMIN_NAME || 'System Administrator').trim();
  const forceOverwrite = process.env.FORCE_BOOTSTRAP_ADMIN === 'true';

  if (!email || !email.includes('@')) {
    console.error('❌ Error: BOOTSTRAP_ADMIN_EMAIL environment variable must be provided as a valid email address.');
    process.exit(1);
  }

  if (!password || password.length < 12) {
    console.error('❌ Error: BOOTSTRAP_ADMIN_PASSWORD environment variable must be provided and be at least 12 characters long.');
    process.exit(1);
  }

  console.log(`[Admin Bootstrap] Checking account status for email: ${email}...`);

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing && !forceOverwrite) {
    console.log(`ℹ️ Admin user [${email}] already exists with role [${existing.role}]. Skipping creation (set FORCE_BOOTSTRAP_ADMIN=true to update).`);
    process.exit(0);
  }

  const passwordHash = await AuthService.hashPassword(password);

  if (existing && forceOverwrite) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        displayName,
        passwordHash,
        role: 'ADMIN',
        accountState: 'ACTIVE',
        mustChangePassword: false,
      },
    });

    await AuthService.logSecurityEvent({
      userId: updated.id,
      eventType: 'ADMIN_BOOTSTRAP_UPDATE',
      details: JSON.stringify({ email: updated.email, role: 'ADMIN' }),
    });

    console.log(`✅ Admin user [${email}] successfully updated to ADMIN role.`);
    process.exit(0);
  }

  const created = await prisma.user.create({
    data: {
      email,
      displayName,
      passwordHash,
      role: 'ADMIN',
      accountState: 'ACTIVE',
      mustChangePassword: false,
    },
  });

  await AuthService.logSecurityEvent({
    userId: created.id,
    eventType: 'ADMIN_BOOTSTRAP_CREATE',
    details: JSON.stringify({ email: created.email, role: 'ADMIN' }),
  });

  console.log(`✅ Admin user [${email}] successfully created with ADMIN role.`);
  process.exit(0);
}

bootstrapAdmin().catch((err) => {
  console.error('❌ Error bootstrapping administrator:', err);
  process.exit(1);
});
