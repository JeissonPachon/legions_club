#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function loadEnvFile(envPath) {
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
    console.error('.env not found in project root');
    process.exit(1);
  }

  const env = loadEnvFile(envPath);
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL missing in .env');
    process.exit(1);
  }

  // EDIT THESE VALUES as needed
  const targetEmail = 'legionsclubtech@gmail.com';
  const newHash = '$2b$12$mpu5yReBV/MEQigrz0QGyOztKheCjb3gLKWRmxz12rTi8wl0lZhLq';

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.connect();
    const res = await pool.query(
      `UPDATE users SET "passwordHash" = $1 WHERE lower(email) = lower($2)`,
      [newHash, targetEmail],
    );
    console.log('Rows updated:', res.rowCount);
    if (res.rowCount > 0) {
      console.log('Password updated for', targetEmail);
      console.log('Temporary password (store it safely): Lg-COmXe8NF');
    } else {
      console.log('No user found with that email');
    }
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
