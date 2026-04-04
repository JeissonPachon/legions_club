-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
DO $$
BEGIN
    IF to_regtype('public."TenantStatus"') IS NULL AND to_regtype('app."TenantStatus"') IS NULL THEN
        CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended', 'archived');
    END IF;
END$$;

-- CreateEnum
DO $$
BEGIN
    IF to_regtype('public."UserRole"') IS NULL AND to_regtype('app."UserRole"') IS NULL THEN
        CREATE TYPE "UserRole" AS ENUM ('owner', 'manager', 'coach', 'athlete');
    END IF;
END$$;

-- CreateEnum
DO $$
BEGIN
    IF to_regtype('public."ChallengePurpose"') IS NULL AND to_regtype('app."ChallengePurpose"') IS NULL THEN
        CREATE TYPE "ChallengePurpose" AS ENUM ('login', 'privileged_action');
    END IF;
END$$;

-- CreateEnum
DO $$
BEGIN
    IF to_regtype('public."SubscriptionStatus"') IS NULL AND to_regtype('app."SubscriptionStatus"') IS NULL THEN
        CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'paused', 'canceled', 'expired');
    END IF;
END$$;

-- CreateEnum
DO $$
BEGIN
    IF to_regtype('public."AttendanceEventType"') IS NULL AND to_regtype('app."AttendanceEventType"') IS NULL THEN
        CREATE TYPE "AttendanceEventType" AS ENUM ('check_in', 'renewal', 'cancelation', 'adjustment');
    END IF;
END$$;

-- CreateEnum
DO $$
BEGIN
    IF to_regtype('public."GymDiscipline"') IS NULL AND to_regtype('app."GymDiscipline"') IS NULL THEN
        CREATE TYPE "GymDiscipline" AS ENUM ('gym', 'powerlifting', 'crossfit', 'pilates', 'hyrox', 'mma', 'other');
    END IF;
END$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "tenants" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "nit" TEXT,
    "displayName" TEXT NOT NULL,
    "discipline" "GymDiscipline" NOT NULL DEFAULT 'gym',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" "TenantStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "users" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sessions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionTokenHash" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "two_factor_challenges" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" "ChallengePurpose" NOT NULL DEFAULT 'login',
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "members" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "documentHash" TEXT NOT NULL,
    "documentLast4" TEXT NOT NULL,
    "emailHash" TEXT,
    "phoneHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "member_sensitive" (
    "memberId" UUID NOT NULL,
    "injuriesEnc" TEXT,
    "conditionsEnc" TEXT,
    "emergencyNameEnc" TEXT,
    "emergencyPhoneEnc" TEXT,
    "emergencyRelationEnc" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_sensitive_pkey" PRIMARY KEY ("memberId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "plans" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sessionsPerMonth" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "subscriptions" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "sessionsAssigned" INTEGER NOT NULL,
    "sessionsRemaining" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "attendance_events" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "eventType" "AttendanceEventType" NOT NULL DEFAULT 'check_in',
    "deltaSessions" INTEGER NOT NULL,
    "remainingBefore" INTEGER NOT NULL,
    "remainingAfter" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "performedByUserId" UUID NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "email_outbox" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "toHash" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "payloadJson" JSONB,
    "providerMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_tenantId_role_isActive_idx" ON "users"("tenantId", "role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_tenantId_email_key" ON "users"("tenantId", "email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sessions_tenantId_userId_expiresAt_idx" ON "sessions"("tenantId", "userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_tenantId_sessionTokenHash_key" ON "sessions"("tenantId", "sessionTokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "two_factor_challenges_tenantId_userId_expiresAt_idx" ON "two_factor_challenges"("tenantId", "userId", "expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "members_tenantId_fullName_idx" ON "members"("tenantId", "fullName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "members_tenantId_deletedAt_idx" ON "members"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "members_tenantId_documentHash_key" ON "members"("tenantId", "documentHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "plans_tenantId_isActive_idx" ON "plans"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "plans_tenantId_name_key" ON "plans"("tenantId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "subscriptions_tenantId_memberId_status_endDate_idx" ON "subscriptions"("tenantId", "memberId", "status", "endDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attendance_events_tenantId_memberId_createdAt_idx" ON "attendance_events"("tenantId", "memberId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_events_tenantId_idempotencyKey_key" ON "attendance_events"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_outbox_tenantId_status_createdAt_idx" ON "email_outbox"("tenantId", "status", "createdAt");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_tenantId_fkey') THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_tenantId_fkey') THEN
        ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_userId_fkey') THEN
        ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'two_factor_challenges_tenantId_fkey') THEN
        ALTER TABLE "two_factor_challenges" ADD CONSTRAINT "two_factor_challenges_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'two_factor_challenges_userId_fkey') THEN
        ALTER TABLE "two_factor_challenges" ADD CONSTRAINT "two_factor_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'members_tenantId_fkey') THEN
        ALTER TABLE "members" ADD CONSTRAINT "members_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_sensitive_memberId_fkey') THEN
        ALTER TABLE "member_sensitive" ADD CONSTRAINT "member_sensitive_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_tenantId_fkey') THEN
        ALTER TABLE "plans" ADD CONSTRAINT "plans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_tenantId_fkey') THEN
        ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_memberId_fkey') THEN
        ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_planId_fkey') THEN
        ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_createdByUserId_fkey') THEN
        ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_events_tenantId_fkey') THEN
        ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_events_memberId_fkey') THEN
        ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_events_subscriptionId_fkey') THEN
        ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_events_performedByUserId_fkey') THEN
        ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_tenantId_fkey') THEN
        ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_actorUserId_fkey') THEN
        ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END$$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_outbox_tenantId_fkey') THEN
        ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

-- -----------------------------
-- Anthropometrics table (idempotent, safe for Supabase SQL editor)
-- -----------------------------

-- Ensure UUID helpers exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create anthropometrics table if missing
CREATE TABLE IF NOT EXISTS "anthropometrics" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" UUID NOT NULL,
        "member_id" UUID NOT NULL,
        "measured_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "weight_kg" DOUBLE PRECISION,
        "height_cm" DOUBLE PRECISION,
        "body_fat_percent" DOUBLE PRECISION,
        "cintura_cm" DOUBLE PRECISION,
        "cadera_cm" DOUBLE PRECISION,
        "pecho_cm" DOUBLE PRECISION,
        "brazo_derecho_cm" DOUBLE PRECISION,
        "brazo_izquierdo_cm" DOUBLE PRECISION,
        "antebrazo_derecho_cm" DOUBLE PRECISION,
        "antebrazo_izquierdo_cm" DOUBLE PRECISION,
        "pierna_derecha_cm" DOUBLE PRECISION,
        "pierna_izquierda_cm" DOUBLE PRECISION,
        "pantorrilla_derecha_cm" DOUBLE PRECISION,
        "pantorrilla_izquierda_cm" DOUBLE PRECISION,
        "notas" TEXT,
        "fotos_json" JSONB,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
    );

-- Add foreign keys if referenced tables exist (safe to run repeatedly)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants' AND table_schema = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'anthropometrics_tenant_fk') THEN
            ALTER TABLE "anthropometrics" ADD CONSTRAINT anthropometrics_tenant_fk FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'members' AND table_schema = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'anthropometrics_member_fk') THEN
            ALTER TABLE "anthropometrics" ADD CONSTRAINT anthropometrics_member_fk FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE;
        END IF;
    END IF;
END$$;

-- Index for typical queries
CREATE INDEX IF NOT EXISTS idx_anthropometrics_tenant_member_measuredat ON "anthropometrics" ("tenant_id", "member_id", "measured_at" DESC);

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION trigger_set_timestamp_anthropometrics()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_anthropometrics ON "anthropometrics";
CREATE TRIGGER set_timestamp_anthropometrics
BEFORE UPDATE ON "anthropometrics"
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp_anthropometrics();

-- Quick check: list anthropometrics table (optional)
-- SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'anthropometrics';

