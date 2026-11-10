-- Minimal deterministic identities required by the AUTH API test collection.
-- These are synthetic local-only fixtures; no real PII.
-- pbl6.r3.customer.two@example.test is loginable with CorrectHorse1.

insert into users (
  id, full_name, email, normalized_email, phone, normalized_phone, password_hash,
  status, email_verified_at, created_at, updated_at
) values
  (
    '01990a00-0000-7000-8000-000000000024',
    'Seed Customer Two',
    'pbl6.r3.customer.two@example.test',
    'PBL6.R3.CUSTOMER.TWO@EXAMPLE.TEST',
    '+840000000002',
    '+840000000002',
    'argon2id$m=8192$t=1$p=1$19D2a9940GXBhMFzaEbvtg==$sStrZ4gm4rHoQrClb8die3NNgDFb3x0rTdOEiXvOutU=',
    'ACTIVE',
    timestamptz '2026-01-01 00:00:00+00',
    timestamptz '2026-01-01 00:00:00+00',
    timestamptz '2026-01-01 00:00:00+00'
  ),
  (
    '01990a00-0000-7000-8000-000000000025',
    'AUTH-03 Duplicate Phone Fixture',
    'seed.phone.duplicate@example.test',
    'SEED.PHONE.DUPLICATE@EXAMPLE.TEST',
    '+849000000099',
    '+849000000099',
    'SYNTHETIC_LOCAL_HASH_NOT_FOR_LOGIN',
    'ACTIVE',
    timestamptz '2026-01-01 00:00:00+00',
    timestamptz '2026-01-01 00:00:00+00',
    timestamptz '2026-01-01 00:00:00+00'
  )
on conflict do nothing;

insert into user_roles (id, user_id, role_id, organization_id_external, active, created_at)
select fixture.id, fixture.user_id, r.id, null, true, timestamptz '2026-01-01 00:00:00+00'
from (values
  ('01990a00-0000-7000-8000-000000000031'::uuid, '01990a00-0000-7000-8000-000000000024'::uuid),
  ('01990a00-0000-7000-8000-000000000032'::uuid, '01990a00-0000-7000-8000-000000000025'::uuid)
) as fixture(id, user_id)
join users u on u.id = fixture.user_id
join roles r on r.code = 'CUSTOMER'
on conflict (id) do nothing;
