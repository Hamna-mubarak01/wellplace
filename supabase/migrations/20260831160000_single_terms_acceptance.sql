

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

  p_terms_text    text default null,
  p_terms_version text default null
)
returns public.waitlist_submission_result
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email    text := internal.normalise_email(coalesce(p_email, ''));
  v_terms    text := nullif(btrim(coalesce(p_terms_text, '')), '');
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
    v_terms,
    nullif(btrim(coalesce(p_terms_version, '')), '')
  )
  on conflict (dedupe_key) do nothing
  returning id, created_at into v_result.entry_id, v_result.submitted_at;

  if found then
    if v_terms is not null then
      insert into public.marketing_consent_events
        (waitlist_entry_id, granted, origin, consent_text)
      values
        (v_result.entry_id, true, 'waitlist_form', v_terms);
    end if;

    v_result.status := 'created'::public.waitlist_submission_status;

    return v_result;
  end if;

  update public.waitlist_entries
     set signup_count   = signup_count + 1,
         last_signup_at = now(),
         is_spam = is_spam and coalesce(p_is_spam, false),
         terms_acceptance_text    = coalesce(terms_acceptance_text, v_terms),
         terms_acceptance_version =
           coalesce(terms_acceptance_version,
                    nullif(btrim(coalesce(p_terms_version, '')), ''))
   where dedupe_key = v_email
  returning id into v_entry_id;

  select e.granted
    into v_latest
    from public.marketing_consent_events e
   where e.waitlist_entry_id = v_entry_id
   order by e.seq desc
   limit 1;

  if v_terms is not null and v_latest is distinct from true then
    insert into public.marketing_consent_events
      (waitlist_entry_id, granted, origin, consent_text)
    values
      (v_entry_id, true, 'waitlist_form', v_terms);
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
  text, text) is
  'The §5.2 waitlist submission. One transaction, typed row, duplicate returned '
  'as a value (R-32). '
  'THERE IS ONE CONSENT PARAMETER PAIR, NOT TWO [CLIENT 31 Aug 2026]. The '
  'separate optional marketing tick was removed at the client''s instruction; '
  'the single required acceptance names the Marketing Terms, so submitting the '
  'form grants marketing consent and the sentence ticked is what gets stored as '
  'its wording. Do not reintroduce p_marketing_consent or p_consent_text. '
  'SECURITY DEFINER because the public form has no session and no role holds an '
  'INSERT grant on either table.';

revoke all on function public.submit_waitlist_entry(
  public.salutation, text, text, text, date, text, text,
  text, text, text, text, text, text, text, boolean,
  text, text) from public;

grant execute on function public.submit_waitlist_entry(
  public.salutation, text, text, text, date, text, text,
  text, text, text, text, text, text, text, boolean,
  text, text) to anon, authenticated, service_role;

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

    e.terms_acceptance_version as terms_acceptance_version,

    e.archived_at,
    e.archived_by
  from public.waitlist_entries e

  where not e.is_spam;

comment on view public.waitlist_leads is
  'The waitlist screen and its CSV export [§5.2]. Carries the calculated age, '
  'which the table deliberately does not store. '
  'NO MARKETING COLUMN [CLIENT 31 Aug 2026]. The separate marketing tick was '
  'removed from the form, so every public signup grants and a per-lead column '
  'would read the same for every row. public.marketing_consent_events keeps the '
  'history and is where an unsubscribe surface will read and write; this view '
  'simply no longer projects it. '
  'security_invoker, so RLS applies to the caller.';
