\ir common.sql

insert into demo_people (id, full_name, email, phone, role, organization_id, created_at)
values (
  pg_temp.demo_id('platform-admin', 1), 'Quản trị BLUE',
  'admin@demo.blue.example.test', '+840029000001', 'PLATFORM_ADMIN', null, :'anchor'::timestamptz
);

-- The local CustomerPass1 hash comes from identity/011_dev_login_seed.sql.
insert into users (
  id, full_name, email, normalized_email, phone, normalized_phone, password_hash,
  status, email_verified_at, created_at, updated_at
)
select
  id, full_name, email, upper(email), phone, phone,
  'argon2id$m=8192$t=1$p=1$cy6ju2qxIW5R3lj4S65idA==$MyfbQOTUXLH2msCqtUPbFmpS0UcbwjAgr2BZjJhm+RY=',
  'ACTIVE', created_at, created_at, created_at
from demo_people
on conflict do nothing;

insert into organization_memberships (
  id, user_id, organization_id_external, status, started_at, created_at, updated_at
)
select
  md5('operating-demo:membership:' || p.id || ':' || p.organization_id)::uuid,
  u.id, p.organization_id, 'ACTIVE', p.created_at, p.created_at, p.created_at
from demo_people p
join users u on u.id = p.id and u.normalized_email = upper(p.email)
where p.organization_id is not null
on conflict do nothing;

insert into user_roles (
  id, user_id, role_id, organization_id_external, active, created_at
)
select
  md5('operating-demo:role:' || p.id || ':' || r.code)::uuid,
  u.id, r.id, p.organization_id, true, p.created_at
from demo_people p
join users u on u.id = p.id and u.normalized_email = upper(p.email)
join roles r on r.code = p.role
on conflict do nothing;

insert into customer_preferences (user_id, preferences, updated_at)
select c.id, jsonb_build_object(
  'Province', p.name, 'Avatar', '',
  'Journey', c.customer_no % 11 <> 0,
  'Reminder', c.customer_no % 7 <> 0,
  'Offers', c.customer_no % 4 = 0
), c.created_at + interval '30 days'
from demo_customers c
join users u on u.id=c.id
join demo_places p on p.place_no=1+(c.customer_no-1)%8
where c.customer_no % 5 <> 0
on conflict do nothing;
