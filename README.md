# Legions Club

Legions Club is a multi-gym SaaS built with Next.js, shadcn/ui, TanStack Query, Prisma, and Supabase.

## Stack

- Next.js App Router + TypeScript
- npm for dependency management and tooling
- shadcn/ui + Tailwind CSS (black & white premium style)
- Prisma ORM + Supabase Postgres
- TanStack Query (`useQuery`) for client-side data orchestration
- Vitest + Testing Library + Playwright

## Setup (npm)

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
copy .env.example .env
```

3. Update `.env` with real Supabase credentials and security secrets.

	- `DATABASE_URL`: transaction pooler (`aws-1-us-east-1.pooler.supabase.com:6543`) with `pgbouncer=true` and `sslmode=require`.
	- `DIRECT_URL`: direct connection (`db.<project-ref>.supabase.co:5432`) with `sslmode=require` for Prisma migrations/introspection.

4. Validate Prisma schema:

```bash
npm run prisma:validate
npm run prisma:generate
```

5. Start development server:

```bash
npm run dev
```

## Multi-tenant database notes

- Every tenant-bound table uses `tenant_id` for strict logical isolation.
- Baseline RLS SQL is in `prisma/sql/rls.sql`.
- Sensitive member data is separated into `member_sensitive` and encrypted at application level.

## Commands

- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e`
- `npm run prisma:validate`
- `npm run prisma:migrate`

Use `DIRECT_URL` for migration flows (`prisma migrate`, `prisma db push`, `prisma db pull`) and keep application runtime on `DATABASE_URL`.

## Bootstrap first tenant

Run migrations, then create the first tenant and owner user:

```bash
npm run prisma:migrate
```

If direct DB migration is blocked by network/firewall, run SQL files in Supabase SQL Editor in this order:

1. `prisma/sql/mvp_init.sql`
2. `prisma/sql/rls.sql`

```bash
curl -X POST http://localhost:3000/api/bootstrap \
	-H "Content-Type: application/json" \
	-d '{
		"tenantSlug":"iron-box",
		"legalName":"Iron Box LLC",
		"displayName":"Iron Box",
		"discipline":"crossfit",
		"adminName":"Owner Admin",
		"adminEmail":"owner@ironbox.com",
		"adminPassword":"StrongPass123!"
	}'
```

Then login at `/auth/login` with `tenantSlug`, email/password, and the 2FA code.

## MVP modules implemented

- Auth: email/password + email 2FA + server sessions
- Multi-tenant APIs: members, plans, subscriptions, check-ins, dashboard summary
- UI modules: dashboard, members, plans/settings, subscriptions
- Security baseline: encrypted member sensitive fields and tenant-scoped queries

## SaaS monthly billing automation

Legions Club now includes super-admin SaaS monthly billing automation:

- First monthly reminder is eligible one month after gym (`tenant`) creation date.
- Billing cycle is monthly from that anchor date.
- If the gym does not pay, reminder emails are sent automatically.
- If overdue days exceed `SAAS_GRACE_DAYS`, tenant is auto-suspended.
- Registering payment from Super Admin Finance panel reactivates suspended tenants automatically.

### Required environment variables

Add these variables in `.env`:

```env
SAAS_MONTHLY_FEE_CENTS=9900000
SAAS_GRACE_DAYS=5
BILLING_AUTOMATION_TOKEN=replace_with_a_long_random_token
```

### Vercel cron (automatic daily run)

`vercel.json` is already configured with:

```json
{
	"crons": [
		{
			"path": "/api/super-admin/billing/automation",
			"schedule": "0 11 * * *"
		}
	]
}
```

In Vercel, set:

- `BILLING_AUTOMATION_TOKEN`
- `SUPER_ADMIN_EMAILS` (must include at least one active user email)

Vercel cron should call:

`GET /api/super-admin/billing/automation`

with header:

`Authorization: Bearer <BILLING_AUTOMATION_TOKEN>`

### Windows Task Scheduler alternative

If you are not using Vercel cron, create a daily task that runs:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-RestMethod -Method GET -Uri 'https://TU-DOMINIO.com/api/super-admin/billing/automation' -Headers @{ Authorization = 'Bearer TU_TOKEN' }"
```

Recommended schedule: once per day between 6:00 AM and 9:00 AM local time.
