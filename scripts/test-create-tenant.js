const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');
const fs = require('fs');
const path = require('path');

function loadEnv(envPath) {
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(.*))\s*$/);
    if (!m) continue;
    out[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

async function main() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('.env not found');
    process.exit(1);
  }
  const env = loadEnv(envPath);
  if (!env.DATABASE_URL) {
    console.error('DATABASE_URL missing in .env');
    process.exit(1);
  }

  // Ensure Prisma can pick up DATABASE_URL
  process.env.DATABASE_URL = env.DATABASE_URL;

  const prisma = new PrismaClient();
  try {
    const slug = 'test-gym-' + Math.random().toString(36).slice(2, 8);
    const password = 'TestPass123!';
    const passwordHash = await hash(password, 10);

    console.log('Creating tenant', slug);
    const tenant = await prisma.tenant.create({
      data: {
        slug,
        legalName: 'Test Gym Legal',
        nit: 'TESTNIT123',
        displayName: 'Test Gym',
        discipline: 'gym',
      },
    });

    const owner = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        role: 'owner',
        fullName: 'Test Owner',
        email: `owner+${slug}@example.com`,
        passwordHash,
      },
    });

    console.log('Tenant created:', tenant.id, tenant.slug);
    console.log('Owner created:', owner.id, owner.email);
    console.log('Temporary owner password:', password);
  } catch (err) {
    console.error('Error creating test tenant:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
