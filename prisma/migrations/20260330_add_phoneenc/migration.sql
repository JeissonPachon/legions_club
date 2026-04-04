-- Migration: add phoneEnc column to users
-- Run this with `pnpm prisma migrate deploy` or `pnpm prisma migrate dev`

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "phoneEnc" TEXT;
