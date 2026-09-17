
alter type public.consent_origin add value if not exists 'console_manual';

comment on type public.consent_origin is
  'Where a consent decision was made. waitlist_form is the person ticking (or '
  'not ticking) the box on the public form. console_manual is a staff member '
  'adding somebody by hand — always granted = false, because a manager cannot '
  'consent on another person''s behalf. The two must stay distinguishable so '
  '§11.4 can tell "asked and declined" from "never asked" [§11.4, §12].';


comment on type public.waitlist_submission_result is
  'Return of the two waitlist write functions. '
  'public.submit_waitlist_entry() NULLs entry_id and submitted_at for '
  'already_registered: an anon caller is told the outcome of its own submission '
  'and is never handed back a row it did not create, which would make the form '
  'an address-enumeration oracle. '
  'public.create_waitlist_entry_manual() POPULATES both for already_registered, '
  'because the caller is an authenticated manager who may already read every '
  'lead and needs to be taken to the existing record rather than told "no".';


create function public.create_waitlist_entry_manual(
  p_salutation    public.salutation,
  p_first_name    text,
  p_last_name     text,
  p_email         text,
  p_date_of_birth date,
  p_phone_e164    text,
  p_phone_country text,
  p_reason        text default null
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
  -- The actor is taken from the session, never from a parameter. An acting
  -- staff id supplied by the caller is an actor the caller can choose, and an
  -- audit log whose actor column is caller-supplied proves nothing. Everything
  -- in audit.entries comes from internal.write_audit(), which reads the JWT.
  perform internal.require_management();

  insert into public.waitlist_entries (
    salutation, first_name, last_name, email, date_of_birth,
    phone_e164, phone_country,
    source,
    is_spam
    -- terms_acceptance_text and terms_acceptance_version are OMITTED, and that
    -- is the point, not an oversight. This person never saw the Legal Terms,
    -- the Privacy Policy or the Marketing Terms and ticked nothing. NULL is the
    -- honest record of that. DO NOT "fix" this by copying the public form's
    -- wording in from src/lib/config: acceptance evidence that nobody gave is
    -- fabricated evidence, and §6.3 stores the literal sentence a person was
    -- actually shown precisely so it can be relied on later.
  )
  values (
    p_salutation,
    btrim(p_first_name),
    btrim(p_last_name),
    v_email,
    p_date_of_birth,
    btrim(p_phone_e164),
    upper(btrim(p_phone_country)),
    -- Provenance, fixed by the function rather than accepted from the caller.
    -- This is a fact about how the row came to exist, not a business rule, so
    'console_manual',
    false
  )
  on conflict (dedupe_key) do nothing
  returning id, created_at into v_result.entry_id, v_result.submitted_at;

  if not found then
    -- Duplicate. signup_count is deliberately NOT incremented and
    -- last_signup_at is deliberately NOT touched — see the function comment.
    select e.id, e.created_at
      into v_result.entry_id, v_result.submitted_at
      from public.waitlist_entries e
     where e.dedupe_key = v_email;

    v_result.status := 'already_registered'::public.waitlist_submission_status;

    return v_result;
  end if;

  -- A staff-entered person has made no marketing decision, and "no decision"
  -- must not read as "not interested" or as "never asked". It is recorded as an
  -- explicit console_manual event with granted = false and no consent_text —
  -- which the marketing_consent_events_grant_needs_text check permits, because
  -- only a GRANT has to be quotable.
  insert into public.marketing_consent_events
    (waitlist_entry_id, granted, origin, consent_text)
  values
    (v_result.entry_id, false, 'console_manual', null);

  -- new_value carries the FACTS of the creation, not the person.
  --
  perform internal.write_audit(
    'create_waitlist_entry_manual',
    'public.waitlist_entries',
    v_result.entry_id::text,
    null,
    jsonb_build_object(
      'email_domain',             split_part(v_email, '@', 2),
      'source',                   'console_manual',
      'marketing_consent',        false,
      'terms_acceptance_version', null::text
    ),
    nullif(btrim(coalesce(p_reason, '')), '')
  );

  v_result.status := 'created'::public.waitlist_submission_status;

  return v_result;
end
$$;

comment on function public.create_waitlist_entry_manual(
  public.salutation, text, text, text, date, text, text, text) is
  'Management adds somebody to the waitlist by hand [§5.2]. One transaction, '
  'typed row, duplicate returned as a value rather than thrown (R-32), and its '
  'own audit entry (INV-13, R-14). '
  'MARKETING CONSENT IS NOT A PARAMETER. It is always false, because consent '
  'comes from the person ticking the box and a manager cannot give it for '
  'somebody else [§12, Marketing Terms]. Nothing here should ever grow a '
  'p_marketing_consent argument. '
  'THE DUPLICATE PATH DOES NOT INCREMENT signup_count. The public function does, '
  'because a repeat submission really is a second signup by that person. A '
  'manager retyping an address is not: incrementing would attribute a signup to '
  'somebody who did not make one, and §11.3 / §11.4 read that column. The '
  'existing entry_id and created_at come back instead, so the console can say '
  '"already on the list since <date>" and link to the record — a silent counter '
  'bump would look to the manager exactly like a successful add. '
  'It also writes no consent event on the duplicate path: the person''s own '
  'recorded position stands and a manual add must not overwrite it. '
  'No audit entry on the duplicate path either — nothing changed, and an audit '
  'row whose old_value equals its new_value is noise in an append-only log. '
  'SECURITY DEFINER because no role holds an INSERT grant on either table; '
  'internal.require_management() is the authorisation, and the actor is read '
  'from the session by internal.write_audit(), never accepted as an argument.';

revoke all on function public.create_waitlist_entry_manual(
  public.salutation, text, text, text, date, text, text, text) from public;

grant execute on function public.create_waitlist_entry_manual(
  public.salutation, text, text, text, date, text, text, text) to authenticated;
