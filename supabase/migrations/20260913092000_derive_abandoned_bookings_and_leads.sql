create function internal.bookings_with_live_checkout()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.booking_id
    from internal.checkout_attempts a
   where a.reservation_expires_at > now()
     and (a.result is null or a.result in ('failed', 'cancelled'))
$$;

revoke all on function internal.bookings_with_live_checkout() from public;
grant execute on function internal.bookings_with_live_checkout() to authenticated, service_role;

comment on function internal.bookings_with_live_checkout() is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] The ids of bookings whose online checkout still holds a live reservation: an attempt whose reservation_expires_at is in the future and which has not ended in a confirmation or a refund. A failed or cancelled attempt counts while its reservation lives, because public.settle_payment_event leaves the hold in place on a failure and public.prepare_guest_payment lets the guest retry on the same booking until the hold expires [§8; INV-10]; counting only result is null would label a guest who is retrying as abandoned.

It runs as its owner because internal.checkout_attempts is not readable by authenticated and public.booking_search is security_invoker; the same narrow pattern as internal.alert_booking_id. It returns booking ids and nothing else — no token, amount, snapshot or receipt token. It is not gated on internal.is_staff() so that a service-role reader of booking_search derives the same answer; the internal schema is not exposed through the API, and anon has no execute grant.';


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
    ) as is_abandoned
  ) ab;

comment on column public.booking_search.is_abandoned is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] True for an online booking that reached payment and was never paid: source online, stored status awaiting_payment or payment_failed, no payment that ever reached paid, partially_refunded, fully_refunded or manual_review, and no live checkout reservation (internal.bookings_with_live_checkout). This is the one definition of abandoned; the customer''s booking history reads it from this view.

It is derived when read and never written, so the stored status is untouched. Writing abandoned would put the booking in public.settle_payment_event''s terminal list, and a late provider payment would be refunded instead of following the §8.2 recovery flow [INV-11]. Writing hold_expired would feed internal.detect_operational_alerts and raise a false payment-failed alert. The label is right the instant a reservation lapses and depends on no job. manual_review is treated as possibly paid, so a booking under review is never shown as abandoned.';

comment on column public.booking_search.display_status is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] The status the console shows and filters on: abandoned when is_abandoned, otherwise the stored booking_status. Filtering display_status = abandoned returns exactly the rows where is_abandoned is true, because nothing writes abandoned to public.bookings.';

comment on column public.booking_search.created_by_name is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] The display name of the staff member who created the booking, for the Management "Booked via" column; null for an online booking, which the console shows as Website. Read through internal.staff_display_name, which returns a name only to a staff session.';


create or replace view public.management_customers
  with (security_invoker = true) as
  select
    c.id,
    c.salutation,
    c.first_name,
    c.last_name,
    c.email,
    c.phone_e164,
    c.phone_country,
    c.date_of_birth,
    c.created_at,
    c.last_interaction_at,
    c.is_blocked,
    c.warning_note,
    c.internal_note,
    coalesce(v.bookings_count, 0) as bookings_count,
    coalesce(v.upcoming_count, 0) as upcoming_count,
    coalesce(v.completed_count, 0) as completed_count,
    coalesce(v.cancelled_count, 0) as cancelled_count,
    v.first_visit_at,
    v.last_visit_at,
    coalesce(m.paid_fils, 0) as paid_fils,
    v.next_visit_at,
    btrim(c.first_name || ' ' || c.last_name) as full_name,
    c.reference,
    coalesce(v.visit_bookings_count, 0) = 0 as is_lead
  from public.customers c
  left join lateral (
    select count(*)::integer as bookings_count,
           count(*) filter (where b.status in ('confirmed', 'checked_in') and upper(b.experience_period) > now())::integer as upcoming_count,
           count(*) filter (where b.status = 'completed')::integer as completed_count,
           count(*) filter (where b.status = 'cancelled')::integer as cancelled_count,
           min(lower(b.experience_period)) filter (where b.status in ('confirmed', 'checked_in', 'completed') and lower(b.experience_period) <= now()) as first_visit_at,
           max(lower(b.experience_period)) filter (where b.status in ('confirmed', 'checked_in', 'completed') and lower(b.experience_period) <= now()) as last_visit_at,
           min(lower(b.experience_period)) filter (where b.status = 'confirmed' and lower(b.experience_period) > now()) as next_visit_at,
           count(*) filter (where b.status in ('confirmed', 'checked_in', 'completed', 'no_show'))::integer as visit_bookings_count
      from public.bookings b
     where b.customer_id = c.id
  ) v on true
  left join lateral (
    select (coalesce((select sum(p.amount_fils)
                        from public.payments p
                        join public.bookings pb on pb.id = p.booking_id
                       where pb.customer_id = c.id
                         and p.status in ('paid', 'partially_refunded', 'fully_refunded')), 0)
          - coalesce((select sum(r.amount_fils)
                        from public.refunds r
                        join public.bookings rb on rb.id = r.booking_id
                       where rb.customer_id = c.id
                         and r.settled_at is not null), 0))::integer as paid_fils
  ) m on true
  where (select internal.is_management());

comment on column public.management_customers.is_lead is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] True when the customer has never had a booking reach a visit — no booking confirmed, checked in, completed or marked no-show. Customers are now created at the details step of online checkout, so a lead is someone who filled in the form; separating them keeps §11.4 new-versus-returning from being inflated by form fills.';
