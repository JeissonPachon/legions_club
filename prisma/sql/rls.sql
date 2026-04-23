-- Legions Club multi-tenant RLS baseline for Supabase
-- Run after migrations with a privileged role.

create or replace function app.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

-- Explicit RLS hardening for the 18 Supabase linted tables.
do $$
declare
  t text;
begin
  foreach t in array ARRAY[
    'gym_members',
    'gym_subscriptions',
    'gym_plans',
    'gym_session_logs',
    'gym_admins',
    'sessions',
    'two_factor_challenges',
    'members',
    'plans',
    'subscriptions',
    'attendance_events',
    'audit_logs',
    'email_outbox',
    'tenants',
    'member_sensitive',
    'users',
    'anthropometrics',
    '_prisma_migrations'
  ]
  loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('alter table public.%I force row level security', t);
    else
      raise notice 'Skipping missing table public.%', t;
    end if;
  end loop;
end
$$;

drop policy if exists tenant_isolation_users on users;
create policy tenant_isolation_users on users
  using ("tenantId" = app.current_tenant_id())
  with check ("tenantId" = app.current_tenant_id());

drop policy if exists tenant_isolation_sessions on sessions;
create policy tenant_isolation_sessions on sessions
  using ("tenantId" = app.current_tenant_id())
  with check ("tenantId" = app.current_tenant_id());

drop policy if exists tenant_isolation_two_factor on two_factor_challenges;
create policy tenant_isolation_two_factor on two_factor_challenges
  using ("tenantId" = app.current_tenant_id())
  with check ("tenantId" = app.current_tenant_id());

drop policy if exists tenant_isolation_members on members;
create policy tenant_isolation_members on members
  using ("tenantId" = app.current_tenant_id())
  with check ("tenantId" = app.current_tenant_id());

drop policy if exists tenant_isolation_plans on plans;
create policy tenant_isolation_plans on plans
  using ("tenantId" = app.current_tenant_id())
  with check ("tenantId" = app.current_tenant_id());

drop policy if exists tenant_isolation_subscriptions on subscriptions;
create policy tenant_isolation_subscriptions on subscriptions
  using ("tenantId" = app.current_tenant_id())
  with check ("tenantId" = app.current_tenant_id());

drop policy if exists tenant_isolation_attendance on attendance_events;
create policy tenant_isolation_attendance on attendance_events
  using ("tenantId" = app.current_tenant_id())
  with check ("tenantId" = app.current_tenant_id());

drop policy if exists tenant_isolation_audits on audit_logs;
create policy tenant_isolation_audits on audit_logs
  using ("tenantId" = app.current_tenant_id())
  with check ("tenantId" = app.current_tenant_id());

drop policy if exists tenant_isolation_outbox on email_outbox;
create policy tenant_isolation_outbox on email_outbox
  using ("tenantId" = app.current_tenant_id())
  with check ("tenantId" = app.current_tenant_id());

drop policy if exists tenant_isolation_member_sensitive on member_sensitive;
create policy tenant_isolation_member_sensitive on member_sensitive
  using (
    exists (
      select 1 from members
      where members.id = member_sensitive."memberId"
      and members."tenantId" = app.current_tenant_id()
    )
  )
  with check (
    exists (
      select 1 from members
      where members.id = member_sensitive."memberId"
      and members."tenantId" = app.current_tenant_id()
    )
  );
