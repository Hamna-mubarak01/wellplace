

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

create type public.staff_role as enum ('reception', 'management');

create type public.named_permission as enum (
  'view_confidential_figures',
  'override_suite_allocation',
  'manual_price_change',
  'correct_customer_record'
);

create table public.staff (

  id         uuid primary key,
  email      text not null unique,
  full_name  text not null,
  role       public.staff_role not null,

  is_active  boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.staff(id),

  constraint staff_email_lowercase check (email = lower(email)),
  constraint staff_email_shaped    check (email like '%_@_%._%')
);

comment on table public.staff is
  'Authorisation, not authentication. Supabase Auth owns the credential; this '
  'row owns the role. Deactivated, never deleted [§10.6].';

create index staff_active_role_idx on public.staff (role) where is_active;

create table public.staff_permissions (
  staff_id   uuid not null references public.staff(id) on delete cascade,
  permission public.named_permission not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.staff(id),
  reason     text,
  primary key (staff_id, permission)
);

comment on table public.staff_permissions is
  'Named permissions from §6.4, §7.2 and §10.6. A grant is an event with an '
  'actor and a reason, because revoking one is an audited change [§3].';

create or replace function internal.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ), ''
  )::uuid
$$;

create or replace function internal.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select s.role
  from public.staff s
  where s.id = internal.current_staff_id()
    and s.is_active
$$;

create or replace function internal.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select internal.current_staff_role() is not null $$;

create or replace function internal.is_management()
returns boolean
language sql
stable
security definer
set search_path = ''

as $$ select coalesce(internal.current_staff_role() = 'management', false) $$;

create or replace function internal.has_permission(p public.named_permission)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when internal.current_staff_role() is null then false

    when p = 'view_confidential_figures'
     and internal.current_staff_role() = 'management' then true

    when p = 'correct_customer_record'
     and internal.current_staff_role() = 'management' then true

    else exists (
      select 1 from public.staff_permissions sp
      where sp.staff_id = internal.current_staff_id()
        and sp.permission = p
    )
  end
$$;

revoke all on function
  internal.current_staff_id(), internal.current_staff_role(),
  internal.is_staff(), internal.is_management(),
  internal.has_permission(public.named_permission)
from public;

grant execute on function
  internal.current_staff_id(), internal.current_staff_role(),
  internal.is_staff(), internal.is_management(),
  internal.has_permission(public.named_permission)
to authenticated, service_role;

create or replace function internal.assert_management_remains()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.staff where role = 'management' and is_active
  ) then
    raise exception 'At least one active management account must remain [§10.6]'
      using errcode = '23514';
  end if;
  return null;
end
$$;

create constraint trigger staff_management_remains
  after update or delete on public.staff
  deferrable initially deferred
  for each row execute function internal.assert_management_remains();

alter table public.staff             enable row level security;
alter table public.staff_permissions enable row level security;
