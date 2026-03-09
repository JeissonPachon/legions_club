-- Legions Club multi-tenant RLS baseline for Supabase
-- Run after migrations with a privileged role.

create or replace function app.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

alter table tenants enable row level security;
alter table users enable row level security;
alter table sessions enable row level security;
alter table two_factor_challenges enable row level security;
alter table members enable row level security;
alter table member_sensitive enable row level security;
alter table plans enable row level security;
alter table subscriptions enable row level security;
alter table attendance_events enable row level security;
alter table audit_logs enable row level security;
alter table email_outbox enable row level security;

create policy tenant_isolation_users on users
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

create policy tenant_isolation_sessions on sessions
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

create policy tenant_isolation_two_factor on two_factor_challenges
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

create policy tenant_isolation_members on members
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

create policy tenant_isolation_plans on plans
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

create policy tenant_isolation_subscriptions on subscriptions
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

create policy tenant_isolation_attendance on attendance_events
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

create policy tenant_isolation_audits on audit_logs
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

create policy tenant_isolation_outbox on email_outbox
  using (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

create policy tenant_isolation_member_sensitive on member_sensitive
  using (
    exists (
      select 1 from members
      where members.id = member_sensitive.member_id
      and members.tenant_id = app.current_tenant_id()
    )
  )
  with check (
    exists (
      select 1 from members
      where members.id = member_sensitive.member_id
      and members.tenant_id = app.current_tenant_id()
    )
  );
