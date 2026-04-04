import * as PrismaClientPackage from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "@/lib/env";

const PrismaClientCtor = (PrismaClientPackage as { PrismaClient?: new (args?: unknown) => unknown }).PrismaClient;

const globalForPrisma = globalThis as unknown as {
  prisma?: any;
  pgPool?: Pool;
};

function normalizeCertificate(raw?: string): string | undefined {
  if (!raw) return undefined;

  const trimmed = raw.trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
  if (!trimmed) return undefined;

  // Common Vercel format: single-line value with escaped newlines.
  if (trimmed.includes("-----BEGIN CERTIFICATE-----")) {
    return trimmed.replace(/\\n/g, "\n");
  }

  // Optional fallback: base64 encoded PEM content.
  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf8");
    if (decoded.includes("-----BEGIN CERTIFICATE-----")) {
      return decoded;
    }
  } catch {
    // Ignore invalid base64 and keep undefined.
  }

  return undefined;
}

const rawUrl = env.DATABASE_URL;
const connectionString = rawUrl?.replace(/[?&]sslmode=[^&]*/g, "").replace(/\?$/, "");
const caCertificate = normalizeCertificate(process.env.SUPABASE_SSL_CERT);
const forceStrictTls = process.env.DB_FORCE_STRICT_TLS === "true";

// In production use strict TLS when CA is configured; otherwise fall back to
// non-strict mode to avoid auth outages caused by certificate-chain issues.
const sslConfig =
  process.env.NODE_ENV === "production"
    ? caCertificate
      ? {
          rejectUnauthorized: true,
          ca: caCertificate,
        }
      : forceStrictTls
        ? {
            rejectUnauthorized: true,
          }
        : {
            rejectUnauthorized: false,
          }
    : { rejectUnauthorized: false };

if (process.env.NODE_ENV === "production" && !caCertificate && !forceStrictTls) {
  console.warn("SUPABASE_SSL_CERT is missing or invalid; using rejectUnauthorized=false fallback.");
}

const pgPool =
  globalForPrisma.pgPool ??
  new Pool({
    connectionString,
    ssl: sslConfig,
  });

const adapter = new PrismaPg(pgPool);

function createPrismaClient(): any {
  if (!PrismaClientCtor) {
    throw new Error("PrismaClient is not available from @prisma/client. Ensure prisma generate runs during build.");
  }

  return new PrismaClientCtor({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });
}

export const db: any =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.pgPool = pgPool;
}