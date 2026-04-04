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
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL missing in .env');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    console.log('Connecting to DB...');
    await pool.connect();
    console.log('Altering table tenants to add column nit if not exists...');
    await pool.query('ALTER TABLE IF EXISTS tenants ADD COLUMN IF NOT EXISTS nit TEXT;');
    console.log('Done.');
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
