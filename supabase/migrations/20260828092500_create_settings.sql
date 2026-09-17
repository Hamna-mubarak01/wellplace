

create table public.settings (
  key         text primary key,
  value       jsonb,
  value_type  text not null,
  description text not null,

  source_tag  text not null,

  updated_at  timestamptz not null default now(),
  updated_by  uuid,

  constraint settings_key_lowercase check (key = lower(key)),
  constraint settings_value_type_known
    check (value_type in ('integer','decimal','boolean','string','array','object','time','duration'))
);

comment on table public.settings is
  'The §10.2 configuration registry. A NULL value means "not yet supplied by '
  'the client" and must not break the screen that reads it [§2].';

alter table public.settings enable row level security;
