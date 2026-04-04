import * as PrismaClientPackage from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "@/lib/env";

const PrismaClientCtor = (PrismaClientPackage as { PrismaClient?: new (args?: unknown) => unknown }).PrismaClient;

if (!PrismaClientCtor) {
  throw new Error("PrismaClient is not available from @prisma/client. Ensure prisma generate runs during build.");
}

const SafePrismaClientCtor: new (args?: unknown) => unknown = PrismaClientCtor;

const globalForPrisma = globalThis as unknown as {
  prisma?: any;
  pgPool?: Pool;
};

const rawUrl = env.DATABASE_URL;
const connectionString = rawUrl?.replace(/[?&]sslmode=[^&]*/g, "").replace(/\?$/, "");

// En producción verifica el certificado, en desarrollo no
const sslConfig =
  process.env.NODE_ENV === "production"
    ? {
        rejectUnauthorized: true,
        ca: process.env.SUPABASE_SSL_CERT, // Certificado como variable de entorno
      }
    : { rejectUnauthorized: false };

const pgPool =
  globalForPrisma.pgPool ??
  new Pool({
    connectionString,
    ssl: sslConfig,
  });

const adapter = new PrismaPg(pgPool);

function createPrismaClient(): any {
  return new SafePrismaClientCtor({
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