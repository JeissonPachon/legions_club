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

async function main(days = 5) {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('.env not found');
    process.exit(1);
  }
  const env = loadEnv(envPath);
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const now = new Date();
    const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    target.setUTCDate(target.getUTCDate() + days);
    const start = target.toISOString();
    const end = new Date(target);
    end.setUTCDate(end.getUTCDate() + 1);
    const endIso = end.toISOString();

    console.log(`Finding subscriptions ending on ${start.slice(0,10)} (days=${days})`);
    const subsRes = await client.query(
      'SELECT DISTINCT "tenantId" FROM subscriptions WHERE "endDate" >= $1 AND "endDate" < $2',
      [start, endIso],
    );

    const tenantIds = subsRes.rows.map((r) => r.tenantid || r.tenantId);
    console.log('Tenants found:', tenantIds.length);
    if (tenantIds.length === 0) return;

    const usersRes = await client.query(
      'SELECT id, "tenantId", email, "fullName" FROM users WHERE "tenantId" = ANY($1) AND "isActive" = true',
      [tenantIds],
    );

    console.log('Users targeted:', usersRes.rowCount);

    // Queue whatsapp audit logs per tenant
    const grouped = {};
    for (const u of usersRes.rows) grouped[u.tenantid || u.tenantId] = (grouped[u.tenantid || u.tenantId] || 0) + 1;

    for (const [tenantId, recipients] of Object.entries(grouped)) {
      // Try to use an existing owner user as actor, fallback to any user
      const ownerRes = await client.query('SELECT id FROM users WHERE "tenantId" = $1 LIMIT 1', [tenantId]);
      const actorUserId = ownerRes.rowCount > 0 ? ownerRes.rows[0].id : null;
      if (!actorUserId) {
        console.warn('No user found to record audit for tenant', tenantId, '; skipping audit entry for this tenant.');
        continue;
      }

      await client.query(
        'INSERT INTO audit_logs (id, "tenantId", "actorUserId", action, "entityType", "metadataJson", "createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [require('crypto').randomUUID(), tenantId, actorUserId, 'reminder_whatsapp_queued', 'reminder_batch', JSON.stringify({ recipients, days }), new Date().toISOString()],
      );
    }

    // Create batch audit log
    // use owner of first tenant as actor for batch audit
    const batchActorRes = await client.query('SELECT id FROM users WHERE "tenantId" = $1 LIMIT 1', [tenantIds[0]]);
    const batchActorId = batchActorRes.rowCount > 0 ? batchActorRes.rows[0].id : null;
    if (batchActorId) {
      await client.query(
        'INSERT INTO audit_logs (id, "tenantId", "actorUserId", action, "entityType", "metadataJson", "createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [require('crypto').randomUUID(), tenantIds[0], batchActorId, 'reminder_expiring_batch', 'reminder_batch', JSON.stringify({ days, usersTargeted: usersRes.rowCount }), new Date().toISOString()],
      );
    } else {
      console.warn('No actor user found for batch audit, skipping batch audit log.');
    }

    console.log('Audit logs created. Email sends skipped in direct run.');
  } finally {
    client.release();
    await pool.end();
  }
}

main(parseInt(process.argv[2], 10) || 5).catch((e) => { console.error(e); process.exit(1); });
