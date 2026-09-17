

create type public.salutation as enum ('mr', 'ms');

create or replace function internal.normalise_email(p_email text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select lower(
    regexp_replace(
      regexp_replace(
        p_email,
        '[[:space:]\u00a0\u1680\u2000-\u200f\u202f\u205f\u2028\u2029\u3000\ufeff]',
        '', 'g'
      ),
      '\.+$', ''
    )
  )
$$;

create table public.waitlist_entries (
  id            uuid primary key default gen_random_uuid(),

  salutation    public.salutation not null,
  first_name    text not null,
  last_name     text not null,
  email         text not null,

  date_of_birth date not null,

  phone_e164    text not null,
  phone_country text not null,

  source        text,
  referrer      text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  utm_term      text,

  dedupe_key    text generated always as (internal.normalise_email(email)) stored,

  is_spam       boolean not null default false,

  signup_count   integer not null default 1,
  last_signup_at timestamptz not null default now(),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint waitlist_entries_first_name_length check (length(first_name) between 1 and 80),
  constraint waitlist_entries_last_name_length  check (length(last_name)  between 1 and 80),

  constraint waitlist_entries_email_length    check (length(email) between 3 and 254),
  constraint waitlist_entries_email_shaped    check (email like '%_@_%._%'),
  constraint waitlist_entries_email_lowercase check (email = lower(email)),

  constraint waitlist_entries_phone_e164_shaped
    check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  constraint waitlist_entries_phone_country_shaped
    check (phone_country ~ '^[A-Z]{2}$'),

  constraint waitlist_entries_source_length   check (source   is null or length(source)   <= 255),
  constraint waitlist_entries_referrer_length check (referrer is null or length(referrer) <= 2048),
  constraint waitlist_entries_utm_length check (
    coalesce(length(utm_source),   0) <= 255 and
    coalesce(length(utm_medium),   0) <= 255 and
    coalesce(length(utm_campaign), 0) <= 255 and
    coalesce(length(utm_content),  0) <= 255 and
    coalesce(length(utm_term),     0) <= 255
  ),

  constraint waitlist_entries_dob_plausible
    check (date_of_birth > date '1900-01-01' and date_of_birth <= current_date),

  constraint waitlist_entries_signup_count_positive check (signup_count >= 1)
);

comment on table public.waitlist_entries is
  'Waitlist signups [§5.2]. Age is NOT stored — see public.waitlist_leads. '
  'Written only by public.submit_waitlist_entry(); no role holds an INSERT grant.';

create unique index waitlist_entries_dedupe_key_idx
  on public.waitlist_entries (dedupe_key);

create index waitlist_entries_created_at_idx
  on public.waitlist_entries (created_at desc);

create trigger waitlist_entries_set_updated_at
  before update on public.waitlist_entries
  for each row execute function internal.set_updated_at();

alter table public.waitlist_entries enable row level security;

create view public.waitlist_leads
  with (security_invoker = true)
as
  select
    e.id,
    e.salutation,
    e.first_name,
    e.last_name,
    e.email,
    e.date_of_birth,

    extract(year from age(current_date, e.date_of_birth))::integer as age_years,

    e.phone_e164,
    e.phone_country,
    e.source,
    e.referrer,
    e.utm_source,
    e.utm_medium,
    e.utm_campaign,
    e.utm_content,
    e.utm_term,
    e.signup_count,
    e.last_signup_at,
    e.created_at
  from public.waitlist_entries e

  where not e.is_spam;

comment on view public.waitlist_leads is
  'The D4 leads screen [§5.2]. Carries the calculated age, which the table '
  'deliberately does not store. security_invoker, so RLS applies to the caller.';

revoke all on public.waitlist_entries from anon, authenticated;
revoke all on public.waitlist_leads   from anon, authenticated;

grant select on public.waitlist_entries to authenticated;
grant select on public.waitlist_leads   to authenticated;

create policy waitlist_entries_select_management on public.waitlist_entries
  for select to authenticated
  using (internal.is_management());

create type public.waitlist_submission_status as enum ('created', 'already_registered');

create type public.waitlist_submission_result as (
  status       public.waitlist_submission_status,
  entry_id     uuid,
  submitted_at timestamptz
);

comment on type public.waitlist_submission_result is
  'Return of public.submit_waitlist_entry(). entry_id and submitted_at are '
  'NULL for already_registered: an anon caller is told the outcome of its own '
  'submission and is never handed back a row it did not create.';

create or replace function public.submit_waitlist_entry(
  p_salutation    public.salutation,
  p_first_name    text,
  p_last_name     text,
  p_email         text,
  p_date_of_birth date,
  p_phone_e164    text,
  p_phone_country text,
  p_source        text default null,
  p_referrer      text default null,
  p_utm_source    text default null,
  p_utm_medium    text default null,
  p_utm_campaign  text default null,
  p_utm_content   text default null,
  p_utm_term      text default null,

  p_is_spam       boolean default false
)
returns public.waitlist_submission_result
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email  text := internal.normalise_email(coalesce(p_email, ''));
  v_result public.waitlist_submission_result;
begin
  insert into public.waitlist_entries (
    salutation, first_name, last_name, email, date_of_birth,
    phone_e164, phone_country,
    source, referrer,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    is_spam
  )
  values (
    p_salutation,
    btrim(p_first_name),
    btrim(p_last_name),
    v_email,
    p_date_of_birth,
    btrim(p_phone_e164),
    upper(btrim(p_phone_country)),
    nullif(btrim(coalesce(p_source,   '')), ''),
    nullif(btrim(coalesce(p_referrer, '')), ''),
    nullif(btrim(coalesce(p_utm_source,   '')), ''),
    nullif(btrim(coalesce(p_utm_medium,   '')), ''),
    nullif(btrim(coalesce(p_utm_campaign, '')), ''),
    nullif(btrim(coalesce(p_utm_content,  '')), ''),
    nullif(btrim(coalesce(p_utm_term,     '')), ''),
    coalesce(p_is_spam, false)
  )
  on conflict (dedupe_key) do nothing
  returning id, created_at into v_result.entry_id, v_result.submitted_at;

  if found then
    v_result.status := 'created'::public.waitlist_submission_status;

    return v_result;
  end if;

  update public.waitlist_entries
     set signup_count   = signup_count + 1,
         last_signup_at = now(),
         is_spam = is_spam and coalesce(p_is_spam, false)
   where dedupe_key = v_email;

  v_result.status       := 'already_registered'::public.waitlist_submission_status;
  v_result.entry_id     := null;
  v_result.submitted_at := null;

  return v_result;
end
$$;

comment on function public.submit_waitlist_entry(
  public.salutation, text, text, text, date, text, text,
  text, text, text, text, text, text, text, boolean) is
  'The §5.2 waitlist submission. One transaction, typed row, duplicate returned '
  'as a value (R-32). SECURITY DEFINER because the public form has no session '
  'and no role holds an INSERT grant on the table.';

revoke all on function public.submit_waitlist_entry(
  public.salutation, text, text, text, date, text, text,
  text, text, text, text, text, text, text, boolean) from public;

grant execute on function public.submit_waitlist_entry(
  public.salutation, text, text, text, date, text, text,
  text, text, text, text, text, text, text, boolean) to anon, authenticated, service_role;
