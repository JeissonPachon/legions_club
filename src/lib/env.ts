import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_JWT_SECRET: z.string().min(32),
  AUTH_2FA_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  AUTH_SESSION_DAYS: z.coerce.number().int().positive().default(7),
  AUTH_BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  SUPER_ADMIN_EMAILS: z.string().optional(),
  BOOTSTRAP_KEY: z.string().min(12).optional(),
  EMAIL_FROM: z.string().email(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SAAS_MONTHLY_FEE_CENTS: z.coerce.number().int().positive().default(9900000),
  SAAS_GRACE_DAYS: z.coerce.number().int().min(1).default(5),
  BILLING_AUTOMATION_TOKEN: z.string().optional(),
  ENCRYPTION_KEY: z.string().min(32),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

const emptyToUndefined = (v: string | undefined) => (v === "" ? undefined : v);

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: emptyToUndefined(process.env.DIRECT_URL),
  APP_URL: emptyToUndefined(process.env.APP_URL),
  AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET,
  AUTH_2FA_TTL_MINUTES: process.env.AUTH_2FA_TTL_MINUTES,
  AUTH_SESSION_DAYS: process.env.AUTH_SESSION_DAYS,
  AUTH_BCRYPT_ROUNDS: process.env.AUTH_BCRYPT_ROUNDS,
  SUPER_ADMIN_EMAILS: emptyToUndefined(process.env.SUPER_ADMIN_EMAILS),
  BOOTSTRAP_KEY: emptyToUndefined(process.env.BOOTSTRAP_KEY),
  EMAIL_FROM: process.env.EMAIL_FROM,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SAAS_MONTHLY_FEE_CENTS: process.env.SAAS_MONTHLY_FEE_CENTS,
  SAAS_GRACE_DAYS: process.env.SAAS_GRACE_DAYS,
  BILLING_AUTOMATION_TOKEN: emptyToUndefined(process.env.BILLING_AUTOMATION_TOKEN),
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  UPSTASH_REDIS_REST_URL: emptyToUndefined(process.env.UPSTASH_REDIS_REST_URL),
  UPSTASH_REDIS_REST_TOKEN: emptyToUndefined(process.env.UPSTASH_REDIS_REST_TOKEN),
});