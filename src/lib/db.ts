import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
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

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.pgPool = pgPool;
}