
-- This script is idempotent and safe to run in Supabase SQL editor.
-- It will:
-- 1) ensure helpful extensions exist (pgcrypto for gen_random_uuid)
-- 2) detect whether your app uses schema 'app' (some Supabase projects) or 'public'
-- 3) create the `anthropometrics` table, FKs, index and update trigger in the right schema

-- IMPORTANT: run this against your project via the Supabase SQL editor (direct DB connection).

-- 1) Ensure UUID helper is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2) Choose target schema: prefer existing schema that contains `members` and `tenants` tables
DO $$
DECLARE
  target_schema text := 'public';
  members_found int := 0;
  tenants_found int := 0;
BEGIN
  SELECT count(*) INTO members_found FROM information_schema.tables WHERE table_name = 'members';
  SELECT count(*) INTO tenants_found FROM information_schema.tables WHERE table_name = 'tenants';

  IF members_found = 0 OR tenants_found = 0 THEN
    -- try schema 'app' (some Supabase setups use this)
    SELECT count(*) INTO members_found FROM information_schema.tables WHERE table_schema = 'app' AND table_name = 'members';
    SELECT count(*) INTO tenants_found FROM information_schema.tables WHERE table_schema = 'app' AND table_name = 'tenants';
    IF members_found > 0 AND tenants_found > 0 THEN
      target_schema := 'app';
    END IF;
  ELSE
    -- members/tenants exist in public, keep target_schema = 'public'
    target_schema := 'public';
  END IF;

  RAISE NOTICE 'Using schema: %', target_schema;

  -- 3) Create table if it does not exist in chosen schema
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I.anthropometrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    member_id uuid NOT NULL,
    measured_at timestamptz NOT NULL DEFAULT now(),
    weight_kg double precision,
    height_cm double precision,
    body_fat_percent double precision,
    waist_cm double precision,
    hip_cm double precision,
    chest_cm double precision,
    arm_cm double precision,
    notes text,
    photos_json jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );', target_schema);

  -- 4) Add foreign keys if referenced tables exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = target_schema AND table_name = 'tenants') THEN
    BEGIN
      EXECUTE format('ALTER TABLE %I.anthropometrics ADD CONSTRAINT IF NOT EXISTS anthropometrics_tenant_fk FOREIGN KEY (tenant_id) REFERENCES %I.tenants(id) ON DELETE CASCADE;', target_schema, target_schema);
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = target_schema AND table_name = 'members') THEN
    BEGIN
      EXECUTE format('ALTER TABLE %I.anthropometrics ADD CONSTRAINT IF NOT EXISTS anthropometrics_member_fk FOREIGN KEY (member_id) REFERENCES %I.members(id) ON DELETE CASCADE;', target_schema, target_schema);
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;

  -- 5) Create index for common queries
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_anthropometrics_tenant_member_measuredat ON %I.anthropometrics (tenant_id, member_id, measured_at DESC);', target_schema);

  -- 6) Create or replace trigger function in target schema to update `updated_at`
  EXECUTE format('CREATE OR REPLACE FUNCTION %I.trigger_set_timestamp() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;', target_schema);

  -- 7) Drop existing trigger (if any) and create it
  BEGIN
    EXECUTE format('DROP TRIGGER IF EXISTS set_timestamp ON %I.anthropometrics;', target_schema);
  EXCEPTION WHEN undefined_table THEN NULL; END;

  EXECUTE format('CREATE TRIGGER set_timestamp BEFORE UPDATE ON %I.anthropometrics FOR EACH ROW EXECUTE FUNCTION %I.trigger_set_timestamp();', target_schema, target_schema);

END$$;

-- Done. You can confirm with:
-- SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'anthropometrics';

-- Optional: If you cannot run Prisma migrations from your environment you can mark the migration as applied in Prisma's metadata by inserting a row into the `_prisma_migrations` table.
-- WARNING: only run the following block if you understand Prisma migration bookkeeping. Adjust the values below (`migration_name`, `checksum`, `finished_at`) to match your migration file.
-- Example (commented out):
-- INSERT INTO public._prisma_migrations (id, migration_name, checksum, finished_at, logs, rolled_back_at, applied_steps_count) VALUES (
--   '20260322_add_anthropometrics',
--   '20260322_add_anthropometrics',
--   'REPLACE_WITH_PRISMA_MIGRATION_CHECKSUM',
--   now(),
--   '{}',
--   NULL,
--   1
-- );
