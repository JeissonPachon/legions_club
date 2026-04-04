const { Pool } = require('pg');
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
  const daysArg = parseInt(process.argv[2], 10) || 5;
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
    const now = new Date();
    const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    target.setUTCDate(target.getUTCDate() + daysArg);
    const start = target.toISOString();
    const end = new Date(target);
    end.setUTCDate(end.getUTCDate() + 1);
    const endIso = end.toISOString();

    console.log(`Searching subscriptions ending on ${start.slice(0,10)} (days=${daysArg})`);

    const subsRes = await client.query(
      'SELECT DISTINCT "tenantId" FROM subscriptions WHERE "endDate" >= $1 AND "endDate" < $2',
      [start, endIso],
    );

    const tenantIds = subsRes.rows.map((r) => r.tenantId);
    console.log('Tenants with expiring subs:', tenantIds.length);
    if (tenantIds.length === 0) {
      console.log('No expiring subscriptions found.');
      return;
    }

    const usersRes = await client.query(
      'SELECT id, "tenantId", email, "fullName" FROM users WHERE "tenantId" = ANY($1) AND "isActive" = true',
      [tenantIds],
    );

    console.log('Active users targeted:', usersRes.rowCount);
    console.log('Sample users (up to 10):');
    usersRes.rows.slice(0, 10).forEach((u) => console.log(`- ${u.email} (tenant ${u.tenantId})`));

  } catch (err) {
    console.error('Error during test:', err.message || err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
