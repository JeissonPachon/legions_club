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
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('.env not found');
    process.exit(1);
  }
  const env = loadEnv(envPath);
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const client = await pool.connect();
  try {
    // Find tenants created for tests (slug like 'test-gym-%')
    const t = await client.query("SELECT id, slug FROM tenants WHERE slug LIKE 'test-gym-%'");
    if (t.rowCount === 0) {
      console.log('No test tenants found.');
      return;
    }

    for (const row of t.rows) {
      const tenantId = row.id;
      console.log('Cleaning tenant', row.slug, tenantId);
      // Delete dependent rows in order respecting FK constraints
      await client.query('DELETE FROM audit_logs WHERE "tenantId" = $1', [tenantId]);
      await client.query('DELETE FROM subscriptions WHERE "tenantId" = $1', [tenantId]);
      await client.query('DELETE FROM plans WHERE "tenantId" = $1', [tenantId]);
      await client.query('DELETE FROM members WHERE "tenantId" = $1', [tenantId]);
      await client.query('DELETE FROM sessions WHERE "tenantId" = $1', [tenantId]);
      await client.query('DELETE FROM users WHERE "tenantId" = $1', [tenantId]);
      await client.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
      console.log('Deleted tenant', row.slug);
    }
  } catch (err) {
    console.error('Cleanup error:', err.message || err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
