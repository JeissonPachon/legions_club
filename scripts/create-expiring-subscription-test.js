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
    // Prefer a test tenant if one exists
    const tenantRes = await client.query("SELECT id, slug FROM tenants WHERE slug LIKE 'test-gym-%' LIMIT 1");
    let tenantId;
    if (tenantRes.rowCount > 0) {
      tenantId = tenantRes.rows[0].id;
      console.log('Using existing tenant', tenantRes.rows[0].slug);
    } else {
      tenantId = crypto.randomUUID();
      const now = new Date().toISOString();
      await client.query(
        'INSERT INTO tenants (id, slug, "legalName", nit, "displayName", discipline, timezone, status, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [tenantId, `test-gym-${Math.random().toString(36).slice(2,8)}`, 'Test Gym', 'TESTNIT', 'Test Gym', 'gym', 'UTC', 'active', now, now],
      );
      console.log('Created test tenant', tenantId);
    }

    // Find or create an owner user
    let ownerRes = await client.query('SELECT id, email FROM users WHERE "tenantId" = $1 AND role = $2 LIMIT 1', [tenantId, 'owner']);
    let ownerId;
    if (ownerRes.rowCount > 0) {
      ownerId = ownerRes.rows[0].id;
      console.log('Using existing owner', ownerRes.rows[0].email);
    } else {
      ownerId = crypto.randomUUID();
      const email = `owner+${tenantId.slice(0,6)}@example.com`;
      const now = new Date().toISOString();
      const passHash = bcrypt.hashSync('TempPass123!', 10);
      await client.query(
        'INSERT INTO users (id, "tenantId", role, "fullName", email, "passwordHash", "isActive", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [ownerId, tenantId, 'owner', 'Test Owner', email, passHash, true, now, now],
      );
      console.log('Created owner', email);
    }

    // Create a member
    const memberId = crypto.randomUUID();
    const now = new Date().toISOString();
    await client.query(
      'INSERT INTO members (id, "tenantId", "fullName", "documentHash", "documentLast4", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [memberId, tenantId, 'Test Member', crypto.randomBytes(16).toString('hex'), '0000', now, now],
    );
    console.log('Created member', memberId);

    // Find or create a plan
    let planRes = await client.query('SELECT id FROM plans WHERE "tenantId" = $1 LIMIT 1', [tenantId]);
    let planId;
    if (planRes.rowCount > 0) {
      planId = planRes.rows[0].id;
    } else {
      planId = crypto.randomUUID();
      await client.query(
        'INSERT INTO plans (id, "tenantId", name, "sessionsPerMonth", "durationDays", "priceCents", currency, "isActive", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [planId, tenantId, 'Mensual Test', 12, 30, 10000, 'USD', true, now, now],
      );
    }

    // Create subscription that ends in 5 days
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 5);

    const subscriptionId = crypto.randomUUID();
    await client.query(
      'INSERT INTO subscriptions (id, "tenantId", "memberId", "planId", status, "sessionsAssigned", "sessionsRemaining", "startDate", "endDate", "createdByUserId", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      [subscriptionId, tenantId, memberId, planId, 'active', 12, 12, startDate.toISOString(), endDate.toISOString(), ownerId, now, now],
    );

    console.log('Created subscription', subscriptionId, 'endDate', endDate.toISOString());
    console.log('Done. Run the test script to verify detection.');
  } catch (err) {
    console.error('Error creating test data:', err.message || err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
