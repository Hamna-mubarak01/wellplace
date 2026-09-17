-- [§CMS and waitlist review]
-- Append consent evidence without changing signup consent or exposing it publicly.
create or replace view public.waitlist_leads with (security_invoker = true) as
select e.id, e.salutation, e.first_name, e.last_name, e.email, e.date_of_birth,
  extract(year from age(current_date, e.date_of_birth))::integer as age_years,
  e.phone_e164, e.phone_country, e.source, e.referrer,
  e.utm_source, e.utm_medium, e.utm_campaign, e.utm_content, e.utm_term,
  e.signup_count, e.last_signup_at, e.created_at, e.terms_acceptance_version,
  e.archived_at, e.archived_by, e.terms_acceptance_text,
  consent.granted as marketing_granted, consent.occurred_at as marketing_consent_at
from public.waitlist_entries e
left join lateral (
  select granted, occurred_at from public.marketing_consent_events c
  where c.waitlist_entry_id = e.id order by c.seq desc limit 1
) consent on true
where not e.is_spam;
comment on view public.waitlist_leads is
  '[§CMS and waitlist review] Management waitlist and export with DOB, computed age, attribution, original accepted wording/version and latest marketing consent event. Security invoker preserves caller RLS. Missing consent remains unknown.';
