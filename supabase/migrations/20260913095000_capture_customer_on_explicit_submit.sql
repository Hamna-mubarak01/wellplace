drop function public.save_checkout_progress(uuid, jsonb, jsonb, integer);

create function public.save_checkout_progress(
  p_token             uuid,
  p_progress          jsonb,
  p_consent           jsonb,
  p_abandoned_minutes integer,
  p_capture_customer  boolean default false
)
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

  insert into internal.checkout_sessions (token, progress, consent, abandoned_minutes)
  values (p_token, p_progress, p_consent, p_abandoned_minutes)
  on conflict (token) do update
     set progress = excluded.progress,
         consent = excluded.consent,
         consent_accepted_at = case when checkout_sessions.consent = excluded.consent then checkout_sessions.consent_accepted_at else now() end,
         abandoned_minutes = excluded.abandoned_minutes,
         recovered = checkout_sessions.recovered or checkout_sessions.updated_at < now() - make_interval(mins => p_abandoned_minutes),
         updated_at = now();

  if p_capture_customer is not true then
    return;
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

  update internal.checkout_sessions s
     set customer_id = v_customer
   where s.token = p_token;
end
$$;

revoke all on function public.save_checkout_progress(uuid, jsonb, jsonb, integer, boolean) from public, anon, authenticated;
grant execute on function public.save_checkout_progress(uuid, jsonb, jsonb, integer, boolean) to service_role;

comment on function public.save_checkout_progress(uuid, jsonb, jsonb, integer, boolean) is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] Saves the guest''s checkout progress once the booking terms are accepted, and creates or updates the customer only when p_capture_customer is true.

p_capture_customer defaults to false, and false saves progress exactly as the function did before customers were captured at checkout: the session row is written and nothing else. An already linked checkout_sessions.customer_id is left as it is. The booking widget auto-saves shortly after every change, so a guest correcting their email passes through half-typed addresses; capturing on those saves created junk customers, used up WP-C numbers, and overwrote a real customer whose email matched a partial value. The owner''s overwrite decision covers an explicit submission of the details step, which is the only caller that passes true.

With true, the customer with the same normalised email is brought up to date — salutation, first and last name, date of birth, mobile number and its country are overwritten with what the guest typed, and last_interaction_at is set to now — or a new customer is created, and the session records the customer id. The stored email is not rewritten: it already normalises to the same identity key (Q-1 [ASSUMED]). The update runs before the insert so that a returning guest does not consume a WP-C number, because a column default is evaluated even when an insert ends in on conflict do update; the insert keeps on conflict for two first-time submissions racing on one email.

Lock order: the session row is written first and the customer second, the same order as public.prepare_guest_payment, which locks the session and then the customer, so two tabs on one checkout cookie cannot deadlock between a save and a payment.

Consent is checked first, so no customer is created or changed without accepted terms. A blocked customer is still updated here; public.prepare_guest_payment refuses them at payment. No audit entry is written, matching public.prepare_guest_payment''s own customer insert: this is the guest''s own action, not a manual change under INV-13, and an entry would copy guest personal data into audit.entries, which the 24-month retention rule cannot delete (INV-28, Q-17). Returns void; the service-role caller is the only one.';


create function internal.bookings_superseded_by_confirmed_checkout()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.booking_id
    from internal.checkout_attempts a
   where a.token is not null
     and exists (
       select 1
         from internal.checkout_attempts confirmed
        where confirmed.token = a.token
          and confirmed.id <> a.id
          and confirmed.result = 'confirmed'
     )
$$;

revoke all on function internal.bookings_superseded_by_confirmed_checkout() from public;
grant execute on function internal.bookings_superseded_by_confirmed_checkout() to authenticated, service_role;

comment on function internal.bookings_superseded_by_confirmed_checkout() is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] The ids of bookings whose checkout session went on to a confirmed payment through another attempt. When an attempt lapses unsettled and the guest then pays in the same checkout session, public.prepare_guest_payment creates a new booking, and the earlier one would otherwise read as abandoned for good although the guest did book.

It runs with its owner''s rights for the same reason as internal.bookings_with_live_checkout: internal.checkout_attempts is not readable by authenticated and public.booking_search is security_invoker. It returns booking ids and nothing else. An attempt whose session was purged has a null token and is never matched.';


create or replace view public.booking_search
  with (security_invoker = true) as
  select
    b.id as booking_id,
    b.reference,
    b.status as booking_status,
    b.source,
    b.suite_id,
    s.suite_number,
    lower(b.experience_period) as experience_from,
    upper(b.experience_period) as experience_to,
    b.arrived_at,
    b.checked_in_at,
    b.checked_out_at,
    b.is_complimentary,
    b.created_at,
    c.id as customer_id,
    c.first_name,
    c.last_name,
    btrim(c.first_name || ' ' || c.last_name) as guest_name,
    c.email,
    c.phone_e164,
    coalesce(g.adults, 0) as adults,
    coalesce(g.children, 0) as children,
    coalesce(ps.status, 'open'::public.payment_status) as payment_status,
    pr.payment_reference,
    coalesce(pr.payment_references, array[]::text[]) as payment_references,
    b.total_fils,
    ab.is_abandoned,
    case when ab.is_abandoned then 'abandoned'::public.booking_status else b.status end as display_status,
    internal.staff_display_name(b.created_by) as created_by_name
  from public.bookings b
  join public.customers c on c.id = b.customer_id
  left join public.suites s on s.id = b.suite_id
  left join lateral (
    select count(*) filter (where bg.kind = 'adult'::public.guest_kind)::integer as adults,
           count(*) filter (where bg.kind = 'child'::public.guest_kind)::integer as children
      from public.booking_guests bg
     where bg.booking_id = b.id
  ) g on true
  left join lateral (
    select nullif(concat_ws(' ', string_agg(distinct p.reference, ' '), string_agg(distinct p.provider_reference, ' ')), '') as payment_reference,
           array_remove(array_agg(distinct p.reference), null) || array_remove(array_agg(distinct p.provider_reference), null) as payment_references
      from public.payments p
     where p.booking_id = b.id
  ) pr on true
  left join lateral (
    select p.status
      from public.payments p
     where p.booking_id = b.id
     order by case p.status
       when 'fully_refunded'::public.payment_status then 1
       when 'partially_refunded'::public.payment_status then 2
       when 'paid'::public.payment_status then 3
       when 'manual_review'::public.payment_status then 4
       when 'pending'::public.payment_status then 5
       when 'failed'::public.payment_status then 6
       when 'cancelled'::public.payment_status then 7
       when 'open'::public.payment_status then 8
       else null::integer
     end
     limit 1
  ) ps on true
  cross join lateral (
    select (
      b.source = 'online'::public.booking_source
      and b.status in ('awaiting_payment'::public.booking_status, 'payment_failed'::public.booking_status)
      and not exists (
        select 1
          from public.payments taken
         where taken.booking_id = b.id
           and taken.status not in ('open'::public.payment_status, 'pending'::public.payment_status,
                                    'failed'::public.payment_status, 'cancelled'::public.payment_status))
      and b.id not in (select internal.bookings_with_live_checkout())
      and b.id not in (select internal.bookings_superseded_by_confirmed_checkout())
    ) as is_abandoned
  ) ab;

comment on column public.booking_search.is_abandoned is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] True for an online booking that reached payment and was never paid: source online, stored status awaiting_payment or payment_failed, no payment that ever reached paid, partially_refunded, fully_refunded or manual_review, no live checkout reservation (internal.bookings_with_live_checkout), and, since 20260913095000, no other attempt in the same checkout session that ended confirmed (internal.bookings_superseded_by_confirmed_checkout), so a guest whose first attempt lapsed and who then paid on a new booking is not counted as abandoned. This is the one definition of abandoned; public.booking_detail and the customer''s booking history read it from this view.

It is derived when read and never written, so the stored status is untouched. Writing abandoned would put the booking in public.settle_payment_event''s terminal list, and a late provider payment would be refunded instead of following the §8.2 recovery flow [INV-11]. Writing hold_expired would feed internal.detect_operational_alerts and raise a false payment-failed alert. The label is right the instant a reservation lapses and depends on no job. manual_review is treated as possibly paid, so a booking under review is never shown as abandoned.';
