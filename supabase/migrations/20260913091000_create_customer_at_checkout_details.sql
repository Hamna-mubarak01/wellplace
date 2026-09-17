alter table internal.checkout_sessions
  add column customer_id uuid references public.customers (id) on delete set null;

create index checkout_sessions_customer_idx on internal.checkout_sessions (customer_id);

comment on column internal.checkout_sessions.customer_id is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] The customer this checkout belongs to, set by public.save_checkout_progress from the details step onwards. on delete set null: the session is short-lived working state purged by the retention job, and must never be the reason a customer record cannot be removed.';


create or replace function public.save_checkout_progress(p_token uuid, p_progress jsonb, p_consent jsonb, p_abandoned_minutes integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identity jsonb := p_progress -> 'identity';
  v_customer uuid;
begin
  if p_progress ->> 'acceptedTerms' is distinct from 'true' or jsonb_array_length(p_consent) = 0 then
    raise exception 'Accept the booking terms to continue.' using errcode = 'WP062';
  end if;

  update public.customers
     set salutation = (v_identity ->> 'salutation')::public.salutation,
         first_name = v_identity ->> 'firstName',
         last_name = v_identity ->> 'lastName',
         date_of_birth = (v_identity ->> 'dateOfBirth')::date,
         phone_e164 = v_identity ->> 'phoneE164',
         phone_country = v_identity ->> 'phoneCountry',
         last_interaction_at = now()
   where identity_key = internal.normalise_email(v_identity ->> 'email')
  returning id into v_customer;

  if v_customer is null then
    insert into public.customers (salutation, first_name, last_name, email, date_of_birth, phone_e164, phone_country)
    values (
      (v_identity ->> 'salutation')::public.salutation,
      v_identity ->> 'firstName',
      v_identity ->> 'lastName',
      lower(v_identity ->> 'email'),
      (v_identity ->> 'dateOfBirth')::date,
      v_identity ->> 'phoneE164',
      v_identity ->> 'phoneCountry'
    )
    on conflict (identity_key) do update
       set salutation = excluded.salutation,
           first_name = excluded.first_name,
           last_name = excluded.last_name,
           date_of_birth = excluded.date_of_birth,
           phone_e164 = excluded.phone_e164,
           phone_country = excluded.phone_country,
           last_interaction_at = now()
    returning id into v_customer;
  end if;

  insert into internal.checkout_sessions (token, progress, consent, abandoned_minutes, customer_id)
  values (p_token, p_progress, p_consent, p_abandoned_minutes, v_customer)
  on conflict (token) do update
     set progress = excluded.progress,
         consent = excluded.consent,
         consent_accepted_at = case when checkout_sessions.consent = excluded.consent then checkout_sessions.consent_accepted_at else now() end,
         abandoned_minutes = excluded.abandoned_minutes,
         recovered = checkout_sessions.recovered or checkout_sessions.updated_at < now() - make_interval(mins => p_abandoned_minutes),
         customer_id = excluded.customer_id,
         updated_at = now();
end
$$;

comment on function public.save_checkout_progress(uuid, jsonb, jsonb, integer) is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] Saves the guest''s checkout progress and, once the booking terms are accepted, creates the customer or brings the existing customer with the same normalised email up to date. Salutation, first and last name, date of birth, mobile number and its country are overwritten with what the guest typed — the owner chose overwrite over a review step — and last_interaction_at is set to now. The stored email is not rewritten: it already normalises to the same identity key (Q-1 [ASSUMED]). The session records the customer id.

The update runs before the insert so that a returning guest does not consume a WP-C number on every save: a column default is evaluated even when an insert ends in on conflict do update. The insert keeps on conflict for two first-time saves racing on one email.

Consent is checked first, so no customer is created or changed without accepted terms. A blocked customer is still updated here; public.prepare_guest_payment refuses them at payment exactly as before and is not changed.

No audit entry is written for the customer write, matching public.prepare_guest_payment, whose own customer insert writes none: this is the guest''s own action, not a manual change under INV-13, and an entry would copy guest personal data into audit.entries, which cannot be deleted by the 24-month retention rule (INV-28, Q-17).

Returns void as before so the existing service-role caller is unchanged.';
