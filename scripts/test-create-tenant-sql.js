const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

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
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL missing in .env');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    const tenantId = crypto.randomUUID();
    const slug = 'test-gym-' + Math.random().toString(36).slice(2, 8);
    const now = new Date().toISOString();
    const password = 'TestPass123!';
    const passwordHash = bcrypt.hashSync(password, 10);

    await client.query('BEGIN');

    await client.query(
      `INSERT INTO tenants (id, slug, "legalName", nit, "displayName", discipline, timezone, status, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [tenantId, slug, 'Test Gym Legal', 'TESTNIT123', 'Test Gym', 'gym', 'UTC', 'active', now, now],
    );

    const userId = crypto.randomUUID();
    const ownerEmail = `owner+${slug}@example.com`;
    await client.query(
      `INSERT INTO users (id, "tenantId", role, "fullName", email, "passwordHash", "isActive", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [userId, tenantId, 'owner', 'Test Owner', ownerEmail, passwordHash, true, now, now],
    );

    await client.query(
      `INSERT INTO plans (id, "tenantId", name, "sessionsPerMonth", "durationDays", "priceCents", currency, "isActive", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10), ($11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        crypto.randomUUID(), tenantId, 'Mensual Base', 12, 30, 8900000, 'COP', true, now, now,
        crypto.randomUUID(), tenantId, 'Mensual Pro', 20, 30, 12900000, 'COP', true, now, now,
      ],
    );

    await client.query('COMMIT');
    console.log('Test tenant created:', slug);
    console.log('Owner email:', ownerEmail);
    console.log('Temporary owner password:', password);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating test tenant (SQL):', err.message || err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
