create table if not exists operator_resource_metadata (
 organization_id uuid not null references organizations(id),
 resource_kind text not null check(resource_kind in ('buses','drivers','routes','organization')),
 resource_id uuid not null,
 data jsonb not null default '{}',
 updated_at timestamptz not null default now(),
 primary key(organization_id,resource_kind,resource_id)
);
create table if not exists operator_driver_files (
 id uuid primary key,
 organization_id uuid not null references organizations(id),
 name text not null,
 content_type text not null,
 content bytea not null check(octet_length(content) between 1 and 10485760),
 created_at timestamptz not null default now()
);
