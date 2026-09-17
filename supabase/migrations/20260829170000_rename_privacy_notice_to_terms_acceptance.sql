
alter table public.waitlist_entries
  rename column privacy_notice_text to terms_acceptance_text;

alter table public.waitlist_entries
  rename column privacy_notice_version to terms_acceptance_version;

alter table public.waitlist_entries
  rename constraint waitlist_entries_privacy_notice_text_length
    to waitlist_entries_terms_acceptance_text_length;

alter table public.waitlist_entries
  rename constraint waitlist_entries_privacy_notice_version_length
    to waitlist_entries_terms_acceptance_version_length;

comment on column public.waitlist_entries.terms_acceptance_text is
  'The literal checkbox sentence the person was shown and ticked, stored '
  'verbatim — never a foreign key to a mutable row [§6.3]. Supplied by the '
  'server from src/lib/config/consent.ts, so the wording rendered and the '
  'wording stored are one constant and cannot drift apart. '
  'THE ACCEPTANCE TIMESTAMP IS created_at. The waitlist is a single-step form: '
  'the tick and the insert happen in the same submission, so a separate '
  'terms_accepted_at column would always equal created_at. Do not add one. '
  'NULLABLE on purpose, and it stays that way: acceptance is mandatory in the '
  'form from now on, but rows already on staging predate the checkbox and a '
  'NOT NULL would simply fail to apply. An honest NULL means "this row was '
  'created before we asked", which is exactly what the evidence should say.';

comment on column public.waitlist_entries.terms_acceptance_version is
  'The client''s legal-text version accepted — v1.3 covers Legal Terms, Privacy '
  'Policy and Marketing Terms together, so one version identifies all three '
  '[§6.3]. Nullable for the same reason as terms_acceptance_text.';


drop view public.waitlist_leads;

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
    e.created_at,

    coalesce(c.granted, false) as marketing_consent,
    c.occurred_at              as marketing_consent_at,
    e.terms_acceptance_version as terms_acceptance_version,

    e.archived_at,
    e.archived_by
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
  'The leads screen [§5.2]. Carries the calculated age, which the table '
  'deliberately does not store, the current marketing consent reduced from '
  'public.marketing_consent_events, the accepted legal-text version and the '
  'archive state. security_invoker, so RLS applies to the caller.';

revoke all on public.waitlist_leads from anon, authenticated;
grant select on public.waitlist_leads to authenticated;


drop function public.submit_waitlist_entry(
  public.salutation, text, text, text, date, text, text,
  text, text, text, text, text, text, text, boolean,
  boolean, text, text, text);

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

  p_marketing_consent boolean default false,
  p_consent_text      text    default null,
  p_terms_text        text    default null,
  p_terms_version     text    default null
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
    terms_acceptance_text, terms_acceptance_version
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
    nullif(btrim(coalesce(p_terms_text,    '')), ''),
    nullif(btrim(coalesce(p_terms_version, '')), '')
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
         terms_acceptance_text =
           coalesce(terms_acceptance_text, nullif(btrim(coalesce(p_terms_text, '')), '')),
         terms_acceptance_version =
           coalesce(terms_acceptance_version, nullif(btrim(coalesce(p_terms_version, '')), ''))
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
  'as a value (R-32). Records the marketing consent decision and the literal '
  'terms acceptance the person ticked [§6.3]. SECURITY DEFINER because the '
  'public form has no session and no role holds an INSERT grant on either table.';

revoke all on function public.submit_waitlist_entry(
  public.salutation, text, text, text, date, text, text,
  text, text, text, text, text, text, text, boolean,
  boolean, text, text, text) from public;

grant execute on function public.submit_waitlist_entry(
  public.salutation, text, text, text, date, text, text,
  text, text, text, text, text, text, text, boolean,
  boolean, text, text, text) to anon, authenticated, service_role;
