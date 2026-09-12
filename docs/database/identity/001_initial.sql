create extension if not exists pgcrypto;

create table users (
  id uuid primary key,
  full_name varchar(150) not null,
  email varchar(254) not null,
  normalized_email varchar(254) not null,
  phone varchar(20) not null,
  normalized_phone varchar(20) not null,
  password_hash varchar(500) not null,
  status varchar(40) not null,
  email_verified_at timestamptz,
  failed_login_count integer not null default 0 check (failed_login_count >= 0),
  lockout_until timestamptz,
  authorization_version bigint not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  row_version bigint not null default 0,
  constraint ck_users_status check (status in ('PENDING_VERIFICATION','ACTIVE','LOCKED','DISABLED'))
);

create unique index uq_users_email on users (normalized_email) where deleted_at is null;
create unique index uq_users_phone on users (normalized_phone) where deleted_at is null;
create index ix_users_status on users (status, created_at desc);

create table roles (
  id uuid primary key,
  code varchar(80) not null unique,
  scope varchar(20) not null,
  description varchar(500),
  system_role boolean not null default true,
  created_at timestamptz not null,
  constraint ck_roles_scope check (scope in ('PLATFORM','TENANT','OWN'))
);

create table permissions (
  id uuid primary key,
  code varchar(120) not null unique,
  scope varchar(20) not null,
  resource varchar(80) not null,
  action varchar(40) not null,
  created_at timestamptz not null,
  constraint uq_permissions_scope_resource_action unique (scope, resource, action),
  constraint ck_permissions_scope check (scope in ('PLATFORM','TENANT','REPORT'))
);

create table role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table organization_memberships (
  id uuid primary key,
  user_id uuid not null references users(id),
  organization_id_external uuid not null,
  status varchar(30) not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  row_version bigint not null default 0,
  constraint ck_membership_status check (status in ('ACTIVE','SUSPENDED','ENDED')),
  constraint ck_membership_end check (ended_at is null or ended_at >= started_at)
);

create unique index uq_membership_active
  on organization_memberships (user_id, organization_id_external)
  where status in ('ACTIVE','SUSPENDED');
create index ix_membership_org_status on organization_memberships (organization_id_external, status, user_id);

create table user_roles (
  id uuid primary key,
  user_id uuid not null references users(id),
  role_id uuid not null references roles(id),
  organization_id_external uuid,
  active boolean not null default true,
  created_at timestamptz not null,
  ended_at timestamptz
);

create unique index uq_user_platform_role_active
  on user_roles (user_id, role_id)
  where active and organization_id_external is null;
create unique index uq_user_tenant_role_active
  on user_roles (user_id, role_id, organization_id_external)
  where active and organization_id_external is not null;
create index ix_user_roles_context on user_roles (user_id, organization_id_external) where active;

create table refresh_sessions (
  id uuid primary key,
  user_id uuid not null references users(id),
  family_id uuid not null,
  token_hash varchar(128) not null unique,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  replaced_by_session_id uuid references refresh_sessions(id),
  revoke_reason varchar(120),
  user_agent_hash varchar(128),
  ip_hash varchar(128),
  constraint ck_refresh_expiry check (expires_at > issued_at)
);

create index ix_refresh_user_active on refresh_sessions (user_id, expires_at) where revoked_at is null;
create index ix_refresh_family on refresh_sessions (family_id, issued_at);

create table auth_challenges (
  id uuid primary key,
  user_id uuid references users(id),
  target_normalized varchar(254) not null,
  challenge_type varchar(40) not null,
  token_hash varchar(128) not null unique,
  status varchar(30) not null,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  row_version bigint not null default 0,
  constraint ck_challenge_type check (challenge_type in ('EMAIL_VERIFICATION','PASSWORD_RESET')),
  constraint ck_challenge_status check (status in ('ACTIVE','CONSUMED','EXPIRED','REVOKED')),
  constraint ck_challenge_expiry check (expires_at > created_at)
);

create index ix_challenge_target_type on auth_challenges (target_normalized, challenge_type, created_at desc);
create index ix_challenge_expiry on auth_challenges (expires_at) where status = 'ACTIVE';

create table security_audits (
  id uuid primary key,
  actor_id uuid,
  target_user_id uuid,
  action varchar(120) not null,
  result varchar(40) not null,
  reason_code varchar(80),
  correlation_id uuid not null,
  safe_metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null
);

create index ix_security_audit_target_time on security_audits (target_user_id, occurred_at desc);
create index ix_security_audit_action_time on security_audits (action, occurred_at desc);

insert into roles (id, code, scope, description, created_at) values
  (gen_random_uuid(), 'CUSTOMER', 'OWN', 'Own-resource customer policy', now()),
  (gen_random_uuid(), 'DRIVER', 'TENANT', 'Assigned trip driver', now()),
  (gen_random_uuid(), 'OPERATOR_ADMIN', 'TENANT', 'Tenant administrator', now()),
  (gen_random_uuid(), 'OPERATOR_SCHEDULER', 'TENANT', 'Fleet and schedule manager', now()),
  (gen_random_uuid(), 'OPERATOR_OPERATIONS', 'TENANT', 'Trip operations and check-in', now()),
  (gen_random_uuid(), 'OPERATOR_FINANCE', 'TENANT', 'Tenant finance/report reader', now()),
  (gen_random_uuid(), 'PLATFORM_ADMIN', 'PLATFORM', 'Platform identity and organization admin', now()),
  (gen_random_uuid(), 'PLATFORM_SUPPORT', 'PLATFORM', 'Platform support reader', now()),
  (gen_random_uuid(), 'PLATFORM_FINANCE', 'PLATFORM', 'Platform finance operator', now()),
  (gen_random_uuid(), 'PLATFORM_AUDITOR', 'PLATFORM', 'Read-only platform auditor', now())
on conflict (code) do nothing;

insert into permissions (id, code, scope, resource, action, created_at)
select gen_random_uuid(), code, upper(split_part(code, '.', 1)), split_part(code, '.', 2), split_part(code, '.', 3), now()
from (values
  ('tenant.organization.manage'), ('tenant.bus.read'), ('tenant.bus.manage'),
  ('tenant.driver.read'), ('tenant.driver.manage'), ('tenant.route.read'), ('tenant.route.manage'),
  ('tenant.trip.read'), ('tenant.trip.manage'), ('tenant.trip.publish'), ('tenant.trip.operate'), ('tenant.trip.cancel'),
  ('tenant.booking.read'), ('tenant.manifest.read'), ('tenant.ticket.validate'), ('tenant.ticket.checkin'),
  ('tenant.payment.read'), ('tenant.refund.read'), ('tenant.refund.request'),
  ('report.revenue.read'), ('report.booking.read'), ('report.occupancy.read'),
  ('platform.organization.read'), ('platform.organization.manage'), ('platform.user.read'), ('platform.user.manage'),
  ('platform.role.manage'), ('platform.membership.read'), ('platform.membership.manage'),
  ('platform.support.read'), ('platform.support.manage'), ('platform.payment.read'), ('platform.payment.manage'),
  ('platform.refund.read'), ('platform.refund.request'), ('platform.payment.reconcile'), ('platform.audit.read'),
  ('platform.dlq.replay')
) as seed(code)
on conflict (code) do nothing;

-- Role-permission assignment is explicit. A new permission is never granted automatically.
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on
  (r.code = 'DRIVER' and p.code in ('tenant.trip.read','tenant.manifest.read','tenant.ticket.validate','tenant.ticket.checkin','tenant.trip.operate')) or
  (r.code = 'OPERATOR_SCHEDULER' and p.code in ('tenant.bus.read','tenant.bus.manage','tenant.driver.read','tenant.driver.manage','tenant.route.read','tenant.route.manage','tenant.trip.read','tenant.trip.manage','tenant.trip.publish')) or
  (r.code = 'OPERATOR_OPERATIONS' and p.code in ('tenant.trip.read','tenant.trip.operate','tenant.trip.cancel','tenant.booking.read','tenant.manifest.read','tenant.ticket.validate','tenant.ticket.checkin')) or
  (r.code = 'OPERATOR_FINANCE' and p.code in ('tenant.payment.read','tenant.refund.read','tenant.refund.request','report.revenue.read','report.booking.read','report.occupancy.read')) or
  (r.code = 'OPERATOR_ADMIN' and (p.code like 'tenant.%' or p.code like 'report.%.read')) or
  (r.code = 'PLATFORM_ADMIN' and p.code in ('platform.organization.read','platform.organization.manage','platform.user.read','platform.user.manage','platform.role.manage','platform.membership.read','platform.membership.manage','platform.audit.read')) or
  (r.code = 'PLATFORM_SUPPORT' and p.code in ('platform.support.read','platform.support.manage','platform.payment.read','platform.refund.read','platform.audit.read')) or
  (r.code = 'PLATFORM_FINANCE' and p.code in ('platform.payment.read','platform.payment.manage','platform.payment.reconcile','platform.refund.read','platform.refund.request','report.revenue.read','report.booking.read','report.occupancy.read')) or
  (r.code = 'PLATFORM_AUDITOR' and p.code in ('platform.audit.read','platform.organization.read','platform.user.read','platform.payment.read','platform.refund.read','report.revenue.read','report.booking.read','report.occupancy.read'))
on conflict do nothing;
