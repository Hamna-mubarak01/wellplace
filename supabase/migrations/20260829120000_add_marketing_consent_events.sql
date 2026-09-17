
create type public.consent_origin as enum ('waitlist_form');

comment on type public.consent_origin is
  'Where a consent decision was made. Only the public waitlist form can produce '
  'one today; Reception, Management and unsubscribe origins are added by the '
  'migrations that build those surfaces, not invented ahead of them.';

create table public.marketing_consent_events (
  id        uuid primary key default gen_random_uuid(),

  seq       bigint generated always as identity,

  waitlist_entry_id uuid not null
    references public.waitlist_entries(id) on delete cascade,

  granted   boolean not null,

  origin    public.consent_origin not null,

  consent_text text,

  occurred_at timestamptz not null default now(),

  constraint marketing_consent_events_grant_needs_text
    check (not granted or consent_text is not null),

  constraint marketing_consent_events_consent_text_length
    check (consent_text is null or length(consent_text) between 1 and 2000)
);

comment on table public.marketing_consent_events is
  'Marketing consent history [§5.2, §11.4]. Append-only in intent: a change of '
  'mind is a new row, never an UPDATE. Written only by '
  'public.submit_waitlist_entry(); no role holds an INSERT grant.';

comment on column public.marketing_consent_events.granted is
  'The consent state after this event, not the change it represents.';

comment on column public.marketing_consent_events.consent_text is
  'The exact string rendered to the person. Supplied by the caller from '
  'src/lib/config/ so the wording shown and the wording stored are one constant '
  'and cannot drift apart.';

create index marketing_consent_events_entry_idx
  on public.marketing_consent_events (waitlist_entry_id, seq desc);

alter table public.marketing_consent_events enable row level security;

revoke all on public.marketing_consent_events from anon, authenticated;
grant select on public.marketing_consent_events to authenticated;

create policy marketing_consent_events_select_management
  on public.marketing_consent_events
  for select to authenticated
  using (internal.is_management());


alter table public.waitlist_entries
  add column privacy_notice_text    text,
  add column privacy_notice_version text;

alter table public.waitlist_entries
  add constraint waitlist_entries_privacy_notice_text_length
    check (privacy_notice_text is null or length(privacy_notice_text) between 1 and 2000),
  add constraint waitlist_entries_privacy_notice_version_length
    check (privacy_notice_version is null or length(privacy_notice_version) between 1 and 64);

comment on column public.waitlist_entries.privacy_notice_text is
  'The literal privacy notice shown at submission. NULL for rows predating the '
  'consent migration — not backfilled, because we do not know what they saw.';


drop function public.submit_waitlist_entry(
  public.salutation, text, text, text, date, text, text,
  text, text, text, text, text, text, text, boolean);

create function public.submit_waitlist_entry(
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

  p_is_spam       boolean default false,

  p_marketing_consent      boolean default false,
  p_consent_text           text    default null,
  p_privacy_notice_text    text    default null,
  p_privacy_notice_version text    default null
)
returns public.waitlist_submission_result
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email    text := internal.normalise_email(coalesce(p_email, ''));
  v_consent  boolean := coalesce(p_marketing_consent, false);
  v_text     text := nullif(btrim(coalesce(p_consent_text, '')), '');
  v_entry_id uuid;
  v_latest   boolean;
  v_result   public.waitlist_submission_result;
begin
  insert into public.waitlist_entries (
    salutation, first_name, last_name, email, date_of_birth,
    phone_e164, phone_country,
    source, referrer,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    is_spam,
    privacy_notice_text, privacy_notice_version
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
    coalesce(p_is_spam, false),
    nullif(btrim(coalesce(p_privacy_notice_text,    '')), ''),
    nullif(btrim(coalesce(p_privacy_notice_version, '')), '')
  )
  on conflict (dedupe_key) do nothing
  returning id, created_at into v_result.entry_id, v_result.submitted_at;

  if found then
    -- A first submission always states a consent position, including a decline.
    -- "No row" and "declined" must not look the same to Reporting.
    insert into public.marketing_consent_events
      (waitlist_entry_id, granted, origin, consent_text)
    values
      (v_result.entry_id, v_consent, 'waitlist_form', v_text);

    v_result.status := 'created'::public.waitlist_submission_status;

    return v_result;
  end if;

  update public.waitlist_entries
     set signup_count   = signup_count + 1,
         last_signup_at = now(),
         is_spam = is_spam and coalesce(p_is_spam, false),
         -- First capture wins. Overwriting would destroy the record of what the
         -- person was actually shown when they first handed over their data.
         privacy_notice_text =
           coalesce(privacy_notice_text, nullif(btrim(coalesce(p_privacy_notice_text, '')), '')),
         privacy_notice_version =
           coalesce(privacy_notice_version, nullif(btrim(coalesce(p_privacy_notice_version, '')), ''))
   where dedupe_key = v_email
  returning id into v_entry_id;

  select e.granted
    into v_latest
    from public.marketing_consent_events e
   where e.waitlist_entry_id = v_entry_id
   order by e.seq desc
   limit 1;

  -- Somebody resubmitting having changed their mind is a real state change and
  -- is recorded. Somebody resubmitting unchanged is not, or the history fills
  -- with noise and §11.4 cannot tell a decision from a repeat visit.
  if v_latest is distinct from v_consent then
    insert into public.marketing_consent_events
      (waitlist_entry_id, granted, origin, consent_text)
    values
      (v_entry_id, v_consent, 'waitlist_form', v_text);
  end if;

  v_result.status       := 'already_registered'::public.waitlist_submission_status;
  v_result.entry_id     := null;
  v_result.submitted_at := null;

  return v_result;
end
$$;

comment on function public.submit_waitlist_entry(
  public.salutation, text, text, text, date, text, text,
  text, text, text, text, text, text, text, boolean,
  boolean, text, text, text) is
  'The §5.2 waitlist submission. One transaction, typed row, duplicate returned '
  'as a value (R-32). Records the marketing consent decision and the privacy '
  'notice that was shown. SECURITY DEFINER because the public form has no '
  'session and no role holds an INSERT grant on either table.';

revoke all on function public.submit_waitlist_entry(
  public.salutation, text, text, text, date, text, text,
  text, text, text, text, text, text, text, boolean,
  boolean, text, text, text) from public;

grant execute on function public.submit_waitlist_entry(
  public.salutation, text, text, text, date, text, text,
  text, text, text, text, text, text, text, boolean,
  boolean, text, text, text) to anon, authenticated, service_role;


create or replace view public.waitlist_leads
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
    e.created_at,

    coalesce(c.granted, false) as marketing_consent,
    c.occurred_at              as marketing_consent_at,
    e.privacy_notice_version   as privacy_notice_version
  from public.waitlist_entries e

  left join lateral (
    select ev.granted, ev.occurred_at
      from public.marketing_consent_events ev
     where ev.waitlist_entry_id = e.id
     order by ev.seq desc
     limit 1
  ) c on true

  where not e.is_spam;

comment on view public.waitlist_leads is
  'The D4 leads screen [§5.2]. Carries the calculated age, which the table '
  'deliberately does not store, and the current marketing consent state reduced '
  'from public.marketing_consent_events. security_invoker, so RLS applies to '
  'the caller.';
