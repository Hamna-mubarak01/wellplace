do $$
declare
  v_name     text;
  v_function record;
  v_body     text;
  v_count    integer;
begin
  foreach v_name in array array[
    'update_booking_details', 'reschedule_booking', 'move_booking', 'extend_booking',
    'reception_booking_activity', 'reception_booking_change_reasons', 'reception_booking_audit',
    'reception_booking_suites', 'count_reschedule_suites'
  ]
  loop
    v_count := 0;

    for v_function in
      select p.oid, p.prosrc
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        join pg_language l on l.oid = p.prolang
       where n.nspname = 'public' and p.proname = v_name and l.lanname = 'plpgsql'
    loop
      if (select count(*) from regexp_matches(v_function.prosrc, 'internal\.require_desk_operator\(\)', 'g')) <> 1 then
        raise exception 'Expected exactly one desk guard in %', v_name;
      end if;

      v_body := regexp_replace(
        v_function.prosrc,
        '\n[ \t]*perform internal\.require_desk_operator\(\);[ \t]*\r?\n',
        E'\n'
      );

      if position('internal.require_desk_operator' in v_body) > 0 then
        raise exception 'The desk guard in % is not on a line of its own', v_name;
      end if;

      if position('internal.is_staff()' in v_body) = 0 then
        raise exception '% would be left without a staff check', v_name;
      end if;

      execute replace(pg_get_functiondef(v_function.oid), v_function.prosrc, v_body);
      v_count := v_count + 1;
    end loop;

    if v_count <> 1 then
      raise exception 'Expected one function %, found %', v_name, v_count;
    end if;
  end loop;
end
$$;

comment on function internal.require_desk_operator() is
  '[CLIENT 10 September 2026; CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] A Management account may not open the Reception console, so it may not perform a Reception operation either. Refuses the management role inside the fourteen daily desk functions: create_reception_booking, cancel_booking, record_arrival, check_in_booking, check_out_booking, mark_no_show, record_overrun, mark_late_arrival, start_cleaning_task, assign_cleaning_task, confirm_cleaning_task, record_booking_payment, add_shift_note and hand_over_shift. Since 11 September 2026 four booking changes are carved out because Management manages a booking from its own booking page: update_booking_details, reschedule_booking, move_booking and extend_booking no longer call this guard, and each still refuses a caller who is not active staff. Check-in, check-out, no-show, overrun, late arrival, cleaning, walk-in and desk booking creation, cancellation, taking payments and shift notes stay Reception-only. The line it draws otherwise is unchanged: suite status, priority, notes and blocks stay with Management under 10.3; customer warnings under 10.5; tasks and alerts under 10.6; refunds and payment voids under 8; and the two permission-gated actions, set_manual_booking_price under 6.4 and override_booking_buffer under 7.1, stay reachable by whoever holds the grant.';

comment on function public.reception_booking_activity(uuid) is
  '[CLIENT, §9.2; CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] Active staff, Reception or Management, may read one booking operational activity trail. Management reads it on its own booking page. Only action, time, staff display name and booking status are exposed. No arbitrary audit fields, prices, reasons, contacts or unrelated entities.';

comment on function public.reception_booking_change_reasons(uuid) is
  '[CLIENT, §9.2, §10.6; CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] Latest move, rescheduling and extension reasons for one booking, available to active staff. Management reads them on its own booking page, where it may now make those three changes. No other audit actions or payloads are exposed.';

comment on function public.reception_booking_audit(uuid) is
  '[CLIENT, §9.2, §10.6; CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] One booking and its customer actions, with actor, time and reason only, for active staff. Management reads it as the history on its own booking page. No audit payloads or unrelated booking history.';

comment on function public.reception_booking_suites(timestamptz, integer) is
  '[CLIENT, §7.2; CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] Advisory suite choices for a whole-hour visit, including cleaning time, for active staff. Creation and every booking change recheck the exact suite under the allocation lock. For an existing booking prefer public.booking_move_options, which uses that booking''s own length and stored cleaning time and ignores its own claim.';

comment on function public.count_reschedule_suites(uuid, timestamptz[], integer) is
  '[§7.6; CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] Rescheduling preview for active staff, Reception or Management. Uses the booking cleaning buffer and excludes its own occupancy, without changing or reserving inventory.';

create function public.booking_move_options(p_booking_id uuid, p_starts_at timestamptz default null)
returns table (
  suite_id     uuid,
  suite_number integer,
  display_name text,
  status       public.suite_status,
  is_current   boolean,
  is_available boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_start   timestamptz;
  v_blocked tstzrange;
begin
  if not internal.is_staff() then
    raise exception 'Sign in with an active staff account to see suite availability.'
      using errcode = '42501';
  end if;

  if p_starts_at is not null and not isfinite(p_starts_at) then
    raise exception 'Choose a valid start time.'
      using errcode = '22023';
  end if;

  select * into v_booking from public.bookings b where b.id = p_booking_id;

  if not found then
    raise exception 'This booking could not be found. Refresh the list and open it again.'
      using errcode = 'P0002';
  end if;

  v_start   := coalesce(p_starts_at, lower(v_booking.experience_period));
  v_blocked := tstzrange(
    v_start,
    v_start
      + (upper(v_booking.experience_period) - lower(v_booking.experience_period))
      + make_interval(mins => v_booking.cleaning_buffer_minutes),
    '[)'
  );

  return query
    select s.id,
           s.suite_number,
           s.display_name,
           s.status,
           s.id is not distinct from v_booking.suite_id,
           s.status not in (
             'blocked'::public.suite_status,
             'maintenance'::public.suite_status,
             'not_ready'::public.suite_status,
             'out_of_service'::public.suite_status
           )
           and not exists (
             select 1
               from public.suite_occupancy o
              where o.suite_id = s.id
                and o.is_active
                and (o.expires_at is null or o.expires_at > statement_timestamp())
                and o.booking_id is distinct from p_booking_id
                and o.blocked_period && v_blocked
           )
      from public.suites s
     where s.is_active
     order by s.suite_number;
end
$$;

revoke all on function public.booking_move_options(uuid, timestamptz) from public, anon;
grant execute on function public.booking_move_options(uuid, timestamptz) to authenticated;

comment on function public.booking_move_options(uuid, timestamptz) is
  '[§7.2, §9.2; CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] Advisory suite list for changing the suite of one existing booking, at its current start or at p_starts_at. Uses the booking''s own length and stored cleaning time, ignores the booking''s own claims, and reports a suite as available only when its status allows automatic allocation and nothing else overlaps. Suites taken out of use are not listed. SECURITY INVOKER, so staff RLS applies. move_booking rechecks the exact suite under the allocation lock, so this list is guidance and never a reservation.';

create view public.management_customers with (security_invoker = true) as
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
  coalesce(v.bookings_count, 0)  as bookings_count,
  coalesce(v.upcoming_count, 0)  as upcoming_count,
  coalesce(v.completed_count, 0) as completed_count,
  coalesce(v.cancelled_count, 0) as cancelled_count,
  v.first_visit_at,
  v.last_visit_at,
  coalesce(m.paid_fils, 0)       as paid_fils,
  v.next_visit_at,
  btrim(c.first_name || ' ' || c.last_name) as full_name
from public.customers c
left join lateral (
  select
    count(*)::integer as bookings_count,
    (count(*) filter (
      where b.status in ('confirmed'::public.booking_status, 'checked_in'::public.booking_status)
        and upper(b.experience_period) > now()
    ))::integer as upcoming_count,
    (count(*) filter (where b.status = 'completed'::public.booking_status))::integer as completed_count,
    (count(*) filter (where b.status = 'cancelled'::public.booking_status))::integer as cancelled_count,
    min(lower(b.experience_period)) filter (
      where b.status in ('confirmed'::public.booking_status, 'checked_in'::public.booking_status, 'completed'::public.booking_status)
        and lower(b.experience_period) <= now()
    ) as first_visit_at,
    max(lower(b.experience_period)) filter (
      where b.status in ('confirmed'::public.booking_status, 'checked_in'::public.booking_status, 'completed'::public.booking_status)
        and lower(b.experience_period) <= now()
    ) as last_visit_at,
    min(lower(b.experience_period)) filter (
      where b.status = 'confirmed'::public.booking_status
        and lower(b.experience_period) > now()
    ) as next_visit_at
  from public.bookings b
  where b.customer_id = c.id
) v on true
left join lateral (
  select (
    coalesce((
      select sum(p.amount_fils)
        from public.payments p
        join public.bookings pb on pb.id = p.booking_id
       where pb.customer_id = c.id
         and p.status in (
           'paid'::public.payment_status,
           'partially_refunded'::public.payment_status,
           'fully_refunded'::public.payment_status
         )
    ), 0)
    - coalesce((
      select sum(r.amount_fils)
        from public.refunds r
        join public.bookings rb on rb.id = r.booking_id
       where rb.customer_id = c.id
         and r.settled_at is not null
    ), 0)
  )::integer as paid_fils
) m on true
where (select internal.is_management());

revoke all on public.management_customers from public, anon;
grant select on public.management_customers to authenticated;

comment on view public.management_customers is
  '[§10.5, §10.6; CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] One row per customer for the Management Customers section. Security invoker and filtered to the management role, so Reception reads no rows. bookings_count counts every booking; upcoming_count counts confirmed or checked-in visits that have not ended; first_visit_at and last_visit_at are the starts of confirmed, checked-in or completed visits that have begun; next_visit_at is the next confirmed start. paid_fils is money taken on the customer''s bookings (payments that reached paid, including those since refunded) less refunds whose return was confirmed. It is a confidential figure, which Management holds implicitly; refunds are read under their own confidential-figures policy.';
