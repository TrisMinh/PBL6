create table templates (
  id uuid primary key,
  code varchar(100) not null,
  notification_type varchar(80) not null,
  channel varchar(20) not null,
  locale varchar(20) not null,
  version integer not null check (version > 0),
  subject_template varchar(300),
  body_template text not null,
  variable_schema jsonb not null,
  active boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint uq_templates_version unique (code, channel, locale, version),
  constraint ck_templates_channel check (channel in ('IN_APP','EMAIL')),
  constraint ck_templates_email_subject check (channel <> 'EMAIL' or subject_template is not null)
);

create unique index uq_templates_active
  on templates (code, channel, locale)
  where active = true;

create table notifications (
  id uuid primary key,
  user_id_external uuid not null,
  organization_id_external uuid,
  notification_type varchar(80) not null,
  source_message_id varchar(128) not null,
  source_reference varchar(200),
  title varchar(300) not null,
  body text not null,
  data jsonb not null,
  essential boolean not null default true,
  created_at timestamptz not null,
  read_at timestamptz,
  expires_at timestamptz,
  constraint uq_notifications_source_user unique (source_message_id, user_id_external),
  constraint ck_notifications_expiry check (expires_at is null or expires_at > created_at),
  constraint ck_notifications_read_time check (read_at is null or read_at >= created_at)
);

create index ix_notifications_user_cursor
  on notifications (user_id_external, created_at desc, id desc);
create index ix_notifications_user_unread
  on notifications (user_id_external, created_at desc)
  where read_at is null;

create table delivery_attempts (
  id uuid primary key,
  notification_id uuid not null references notifications(id) on delete cascade,
  channel varchar(20) not null,
  attempt_no integer not null check (attempt_no > 0),
  destination_hash varchar(128),
  provider_message_id varchar(180),
  status varchar(30) not null,
  error_code varchar(80),
  next_attempt_at timestamptz,
  created_at timestamptz not null,
  completed_at timestamptz,
  constraint uq_delivery_attempt_no unique (notification_id, channel, attempt_no),
  constraint ck_delivery_attempt_channel check (channel in ('IN_APP','EMAIL')),
  constraint ck_delivery_attempt_status check (status in ('PENDING','SENDING','DELIVERED','RETRYING','FAILED')),
  constraint ck_delivery_attempt_retry check (
    (status = 'RETRYING' and next_attempt_at is not null and completed_at is null) or
    (status in ('DELIVERED','FAILED') and completed_at is not null) or
    (status in ('PENDING','SENDING') and completed_at is null)
  )
);

create unique index uq_delivery_provider_message
  on delivery_attempts (provider_message_id)
  where provider_message_id is not null;
create index ix_delivery_ready
  on delivery_attempts (next_attempt_at, id)
  where status in ('PENDING','RETRYING');
create index ix_delivery_notification on delivery_attempts (notification_id, channel, attempt_no desc);
