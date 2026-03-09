import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_URL;

if (!databaseUrl) {
  console.error("ENV_ERROR", { hasDatabaseUrl: false });
  process.exit(1);
}

async function checkPgConnection(label, connectionString) {
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    const result = await pool.query("SELECT 1 as ok");
    console.log(`${label}_OK`, result.rows);
  } catch (error) {
    console.error(`${label}_ERROR`, error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

await checkPgConnection("PG_POOLER", databaseUrl);
if (directUrl && directUrl !== databaseUrl) {
  await checkPgConnection("PG_DIRECT", directUrl);
} else {
  console.log("PG_DIRECT_SKIPPED (using pooler for all connections)");
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

try {
  const result = await db.$queryRawUnsafe("SELECT 1 as ok");
  console.log("PRISMA_SUPABASE_OK", result);
} catch (error) {
  console.error("PRISMA_SUPABASE_ERROR", error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
  await pool.end();
}
