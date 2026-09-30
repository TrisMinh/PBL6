-- Local/test loginable accounts. Argon2id m=8192 t=1 p=1 (Identity hasher).
-- Passwords are synthetic only: CustomerPass1 / OperatorPass1 / AdminPass1234 / DriverPass1.
-- Idempotent: safe to apply more than once.

update users
set
  password_hash = 'argon2id$m=8192$t=1$p=1$cy6ju2qxIW5R3lj4S65idA==$MyfbQOTUXLH2msCqtUPbFmpS0UcbwjAgr2BZjJhm+RY=',
  status = 'ACTIVE',
  email_verified_at = coalesce(email_verified_at, timestamptz '2026-01-01 00:00:00+00'),
  failed_login_count = 0,
  lockout_until = null,
  updated_at = timestamptz '2026-01-01 00:00:00+00'
where id = '01990a00-0000-7000-8000-000000000002';

insert into users (
  id, full_name, email, normalized_email, phone, normalized_phone, password_hash,
  status, email_verified_at, created_at, updated_at
) values
  (
    '01990a00-0000-7000-8000-000000000021',
    'Seed Operator Admin',
    'operator.seed@example.test',
    'OPERATOR.SEED@EXAMPLE.TEST',
    '+840000000010',
    '+840000000010',
    'argon2id$m=8192$t=1$p=1$qxUqiIFIJFIXre2Bx0A0dQ==$aGNbtCLNl6nsfMtnlE0HEoEC+NOdlfhHbKFL9EHH/Lw=',
    'ACTIVE',
    timestamptz '2026-01-01 00:00:00+00',
    timestamptz '2026-01-01 00:00:00+00',
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    '01990a00-0000-7000-8000-000000000022',
    'Seed Platform Admin',
    'admin.seed@example.test',
    'ADMIN.SEED@EXAMPLE.TEST',
    '+840000000011',
    '+840000000011',
    'argon2id$m=8192$t=1$p=1$nAtA4KP6+Ti9X4coh2nmXw==$nPvekn4lfMwZqo1BjIwFF1Gz+89cn8+ao4bKC2XfsoI=',
    'ACTIVE',
    timestamptz '2026-01-01 00:00:00+00',
    timestamptz '2026-01-01 00:00:00+00',
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    '01990a00-0000-7000-8000-000000000023',
    'Seed Driver',
    'driver.seed@example.test',
    'DRIVER.SEED@EXAMPLE.TEST',
    '+840000000012',
    '+840000000012',
    'argon2id$m=8192$t=1$p=1$PN6mexT2Nq5noLGTzCWTwg==$Pv6wb4dWw3iue187PhDZzyeYHrx0/hWj/4u3UFJszA4=',
    'ACTIVE',
    timestamptz '2026-01-01 00:00:00+00',
    timestamptz '2026-01-01 00:00:00+00',
    timestamptz '2026-01-01 00:00:00+00'
  )
on conflict (id) do update set
  password_hash = excluded.password_hash,
  status = excluded.status,
  email_verified_at = excluded.email_verified_at,
  failed_login_count = 0,
  lockout_until = null,
  updated_at = excluded.updated_at;

insert into organization_memberships (
  id, user_id, organization_id_external, status, started_at, created_at, updated_at
) values
  (
    '01990a00-0000-7000-8000-000000000026',
    '01990a00-0000-7000-8000-000000000021',
    '01990a00-0000-7000-8000-000000000001',
    'ACTIVE',
    timestamptz '2026-01-01 00:00:00+00',
    timestamptz '2026-01-01 00:00:00+00',
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    '01990a00-0000-7000-8000-000000000029',
    '01990a00-0000-7000-8000-000000000023',
    '01990a00-0000-7000-8000-000000000001',
    'ACTIVE',
    timestamptz '2026-01-01 00:00:00+00',
    timestamptz '2026-01-01 00:00:00+00',
    timestamptz '2026-01-01 00:00:00+00'
  )
on conflict (id) do nothing;

insert into user_roles (id, user_id, role_id, organization_id_external, active, created_at)
select
  '01990a00-0000-7000-8000-000000000027',
  '01990a00-0000-7000-8000-000000000021',
  r.id,
  '01990a00-0000-7000-8000-000000000001',
  true,
  timestamptz '2026-01-01 00:00:00+00'
from roles r
where r.code = 'OPERATOR_ADMIN'
on conflict (id) do nothing;

insert into user_roles (id, user_id, role_id, organization_id_external, active, created_at)
select
  '01990a00-0000-7000-8000-000000000028',
  '01990a00-0000-7000-8000-000000000022',
  r.id,
  null,
  true,
  timestamptz '2026-01-01 00:00:00+00'
from roles r
where r.code = 'PLATFORM_ADMIN'
on conflict (id) do nothing;

insert into user_roles (id, user_id, role_id, organization_id_external, active, created_at)
select
  '01990a00-0000-7000-8000-000000000030',
  '01990a00-0000-7000-8000-000000000023',
  r.id,
  '01990a00-0000-7000-8000-000000000001',
  true,
  timestamptz '2026-01-01 00:00:00+00'
from roles r
where r.code = 'DRIVER'
on conflict (id) do nothing;
