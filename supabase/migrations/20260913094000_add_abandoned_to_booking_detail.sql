create or replace view public.booking_detail
  with (security_invoker = true)
as
  select
    b.id                       as booking_id,
    b.reference,
    b.status                   as booking_status,
    b.source,
    b.suite_id,
    s.suite_number,
    b.occupancy_id,
    lower(b.experience_period) as experience_from,
    upper(b.experience_period) as experience_to,
    upper(o.blocked_period)    as blocked_to,
    b.cleaning_buffer_minutes,
    b.arrived_at,
    b.checked_in_at,
    b.checked_out_at,
    b.late_arrival_minutes,
    b.overrun_minutes,
    b.personal_request,
    b.internal_note,
    b.is_complimentary,
    b.created_at,
    b.updated_at,
    b.created_by,
    internal.staff_display_name(b.created_by) as created_by_name,
    coalesce(g.adults, 0)      as adults,
    coalesce(g.children, 0)    as children,
    coalesce(g.child_ages, array[]::integer[]) as child_ages,
    c.id                       as customer_id,
    c.salutation,
    c.first_name,
    c.last_name,
    btrim(c.first_name || ' ' || c.last_name) as guest_name,
    c.email,
    c.phone_e164,
    c.phone_country,
    c.date_of_birth,
    c.is_blocked,
    c.warning_note,
    coalesce(ps.status, 'open'::public.payment_status) as payment_status,
    b.subtotal_fils,
    b.discount_fils,
    b.addons_fils,
    b.service_fee_fils,
    b.tax_fils,
    b.total_fils,
    coalesce(pd.paid_fils, 0) as paid_fils,
    case when internal.has_permission('view_confidential_figures') then coalesce(rf.settled_fils, 0)   end as refunded_fils,
    case when internal.has_permission('view_confidential_figures') then coalesce(rf.pending_fils, 0)   end as refunds_pending_fils,
    b.overrun_fils,
    coalesce(ab.is_abandoned, false) as is_abandoned,
    coalesce(ab.display_status, b.status) as display_status
  from public.bookings b
  join public.customers c
    on c.id = b.customer_id
  left join public.suites s
    on s.id = b.suite_id
  left join public.suite_occupancy o
    on o.id = b.occupancy_id
  left join lateral (
    select
      (count(*) filter (where bg.kind = 'adult'))::integer as adults,
      (count(*) filter (where bg.kind = 'child'))::integer as children,
      array_agg(bg.age order by bg.age) filter (where bg.kind = 'child') as child_ages
      from public.booking_guests bg
     where bg.booking_id = b.id
  ) g on true
  left join lateral (
    select sum(p.amount_fils)::integer as paid_fils
      from public.payments p
     where p.booking_id = b.id
       and p.status in ('paid', 'partially_refunded', 'fully_refunded')
  ) pd on true
  left join lateral (
    select
      (sum(r.amount_fils) filter (where r.settled_at is not null))::integer as settled_fils,
      (sum(r.amount_fils) filter (where r.is_pending))::integer             as pending_fils
      from public.refunds r
     where r.booking_id = b.id
  ) rf on true
  left join lateral (
    select p.status
      from public.payments p
     where p.booking_id = b.id
     order by case p.status
       when 'fully_refunded'     then 1
       when 'partially_refunded' then 2
       when 'paid'               then 3
       when 'manual_review'      then 4
       when 'pending'            then 5
       when 'failed'             then 6
       when 'cancelled'          then 7
       when 'open'               then 8
     end
     limit 1
  ) ps on true
  left join public.booking_search ab
    on ab.booking_id = b.id;

comment on column public.booking_detail.is_abandoned is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] Whether this booking reads as abandoned. Taken from public.booking_search.is_abandoned by booking id rather than restated, so the booking page and the Bookings list share one definition and cannot drift apart; see that column for the definition and for why abandoned is derived when read and never written [INV-11]. The coalesce to false covers only a caller with no visible booking_search row, which the shared base tables and row policies make unreachable.';

comment on column public.booking_detail.display_status is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] The status the booking page shows: public.booking_search.display_status for this booking, so a booking listed as Abandoned opens as Abandoned. booking_status stays the stored status; every write path, action guard and the §8.2 recovery flow keep reading that column, never this one.';
