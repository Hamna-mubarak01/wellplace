alter table public.suites
  add column retired_at timestamptz,
  add column retired_by uuid references public.staff(id) on delete set null,
  add column retirement_reason text,
  add constraint suites_retirement_reason_length
    check (retirement_reason is null or length(btrim(retirement_reason)) between 1 and 500),
  add constraint suites_retirement_recorded
    check ((retired_at is null) = (retirement_reason is null)),
  add constraint suites_retired_is_out_of_service
    check (retired_at is null or (not is_active and status = 'out_of_service'::public.suite_status));

create index suites_retired_by_idx on public.suites (retired_by);

comment on column public.suites.retired_at is
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] When Management retired the suite. A retired suite is permanently out of service: is_active is false, status is out_of_service, it is never allocated, offered or placed on the Reception board, and its bookings, occupancy and cleaning history are kept. public.return_suite_to_service is the only way back.';

comment on column public.suites.retirement_reason is
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] The manager''s reason for retiring the suite, required while it is retired and cleared on its return to service. The audit log keeps every earlier reason.';

create function internal.guard_retired_suite()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_active or new.status is distinct from 'out_of_service'::public.suite_status then
    raise exception 'This suite is retired. Return it to service before changing its status or using it again.'
      using errcode = 'WP074';
  end if;
  return new;
end
$$;

revoke all on function internal.guard_retired_suite() from public, anon, authenticated, service_role;

create trigger suites_guard_retired
  before update of is_active, status on public.suites
  for each row
  when (old.retired_at is not null and new.retired_at is not null)
  execute function internal.guard_retired_suite();

comment on function internal.guard_retired_suite() is
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] Keeps a retired suite retired. Any path that would reactivate it or give it a status other than out_of_service while retired_at is set is refused with WP074, whether that is set_suite_status, a suite setup save or a direct update. public.return_suite_to_service clears retired_at in the same statement, so it is not caught. suites_retired_is_out_of_service is the constraint behind this message.';

create function internal.refuse_retired_suite_claim()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.suites s where s.id = new.suite_id and s.retired_at is not null) then
    raise exception 'This suite is retired. Return it to service before scheduling it.'
      using errcode = 'WP074';
  end if;
  return new;
end
$$;

revoke all on function internal.refuse_retired_suite_claim() from public, anon, authenticated, service_role;

create trigger suite_occupancy_refuses_retired_suite
  before insert on public.suite_occupancy
  for each row
  execute function internal.refuse_retired_suite_claim();

comment on function internal.refuse_retired_suite_claim() is
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11; §7.2] No new hold, booking, block or maintenance claim may be placed on a retired suite. internal.allocate_suite already skips inactive suites, so this is the backstop for every other path, including block_suite_period.';

create function public.retire_suite(p_suite_id uuid, p_reason text)
returns table (
  suite_id     uuid,
  suite_number integer,
  status       public.suite_status,
  retired_at   timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_before public.suites%rowtype;
  v_now    timestamptz := clock_timestamp();
begin
  perform internal.require_management();

  if v_reason is null or length(v_reason) > 500 then
    raise exception 'Enter a reason of up to 500 characters for retiring this suite.'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);
  perform internal.release_expired_occupancy();

  select * into v_before from public.suites s where s.id = p_suite_id for update;

  if not found then
    raise exception 'This suite no longer exists. Refresh the list.'
      using errcode = 'P0002';
  end if;

  if v_before.retired_at is not null then
    raise exception 'This suite is already retired.'
      using errcode = 'WP074';
  end if;

  if exists (
    select 1
      from public.suite_occupancy o
     where o.suite_id = p_suite_id
       and o.is_active
       and o.kind in ('booking'::public.occupancy_kind, 'hold'::public.occupancy_kind)
       and (o.expires_at is null or o.expires_at > v_now)
       and upper(o.blocked_period) > v_now
  ) or exists (
    select 1
      from public.bookings b
     where b.suite_id = p_suite_id
       and (
         b.status = 'checked_in'::public.booking_status
         or (b.status = 'confirmed'::public.booking_status and upper(b.experience_period) > v_now)
       )
  ) then
    raise exception 'This suite still has a current or upcoming booking or payment reservation. Move or cancel it, or check the guest out, before retiring the suite.'
      using errcode = 'WP072';
  end if;

  update public.suites s
     set is_active         = false,
         status            = 'out_of_service'::public.suite_status,
         retired_at        = v_now,
         retired_by        = internal.current_staff_id(),
         retirement_reason = v_reason
   where s.id = p_suite_id;

  perform internal.write_audit(
    'retire_suite',
    'public.suites',
    p_suite_id::text,
    jsonb_build_object(
      'is_active',  v_before.is_active,
      'status',     v_before.status,
      'retired_at', null
    ),
    jsonb_build_object(
      'suite_number', v_before.suite_number,
      'is_active',    false,
      'status',       'out_of_service',
      'retired_at',   v_now
    ),
    v_reason
  );

  return query
    select s.id, s.suite_number, s.status, s.retired_at
      from public.suites s
     where s.id = p_suite_id;
end
$$;

revoke all on function public.retire_suite(uuid, text) from public, anon;
grant execute on function public.retire_suite(uuid, text) to authenticated;

comment on function public.retire_suite(uuid, text) is
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11; §10.3] Management takes a suite permanently out of service without losing its history: is_active false, status out_of_service, and the time, manager and reason of retirement recorded. Refused with WP072 while the suite holds a current or upcoming booking, an unexpired payment reservation or a checked-in guest, so no paying guest is left without a suite. Scheduled blocks are left in place and apply again if the suite returns to service. Takes the allocation lock first, so it cannot interleave with an allocation. Reversed by public.return_suite_to_service.';

create function public.return_suite_to_service(p_suite_id uuid, p_reason text)
returns table (
  suite_id     uuid,
  suite_number integer,
  status       public.suite_status,
  is_active    boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_before public.suites%rowtype;
begin
  perform internal.require_management();

  if v_reason is null or length(v_reason) > 500 then
    raise exception 'Enter a reason of up to 500 characters for returning this suite to service.'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);

  select * into v_before from public.suites s where s.id = p_suite_id for update;

  if not found then
    raise exception 'This suite no longer exists. Refresh the list.'
      using errcode = 'P0002';
  end if;

  if v_before.retired_at is null then
    raise exception 'This suite is already in service.'
      using errcode = 'WP075';
  end if;

  update public.suites s
     set is_active         = true,
         status            = 'available'::public.suite_status,
         retired_at        = null,
         retired_by        = null,
         retirement_reason = null
   where s.id = p_suite_id;

  perform internal.write_audit(
    'return_suite_to_service',
    'public.suites',
    p_suite_id::text,
    jsonb_build_object(
      'is_active',         v_before.is_active,
      'status',            v_before.status,
      'retired_at',        v_before.retired_at,
      'retired_by',        v_before.retired_by,
      'retirement_reason', v_before.retirement_reason
    ),
    jsonb_build_object(
      'suite_number', v_before.suite_number,
      'is_active',    true,
      'status',       'available',
      'retired_at',   null
    ),
    v_reason
  );

  return query
    select s.id, s.suite_number, s.status, s.is_active
      from public.suites s
     where s.id = p_suite_id;
end
$$;

revoke all on function public.return_suite_to_service(uuid, text) from public, anon;
grant execute on function public.return_suite_to_service(uuid, text) to authenticated;

comment on function public.return_suite_to_service(uuid, text) is
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11; §10.3] Reverses public.retire_suite: the suite becomes active and available for automatic allocation again, and the retirement fields are cleared. The earlier retirement stays in the audit log. WP075 when the suite is not retired.';

create function public.delete_suite(p_suite_id uuid, p_reason text)
returns table (
  suite_id     uuid,
  suite_number integer,
  deleted_at   timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_before public.suites%rowtype;
  v_now    timestamptz := clock_timestamp();
begin
  perform internal.require_management();

  if v_reason is null or length(v_reason) > 500 then
    raise exception 'Enter a reason of up to 500 characters for deleting this suite.'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);

  select * into v_before from public.suites s where s.id = p_suite_id for update;

  if not found then
    raise exception 'This suite no longer exists. Refresh the list.'
      using errcode = 'P0002';
  end if;

  if exists (select 1 from public.suite_occupancy o where o.suite_id = p_suite_id)
     or exists (select 1 from public.bookings b where b.suite_id = p_suite_id)
     or exists (select 1 from public.cleaning_tasks t where t.suite_id = p_suite_id) then
    raise exception 'This suite has booking history, so it cannot be deleted. Retire it instead to keep its records.'
      using errcode = 'WP073';
  end if;

  perform internal.write_audit(
    'delete_suite',
    'public.suites',
    p_suite_id::text,
    jsonb_build_object(
      'suite_number',      v_before.suite_number,
      'display_name',      v_before.display_name,
      'status',            v_before.status,
      'priority',          v_before.priority,
      'internal_note',     v_before.internal_note,
      'is_active',         v_before.is_active,
      'retired_at',        v_before.retired_at,
      'retirement_reason', v_before.retirement_reason,
      'created_at',        v_before.created_at
    ),
    null::jsonb,
    v_reason
  );

  delete from public.suites s where s.id = p_suite_id;

  suite_id     := p_suite_id;
  suite_number := v_before.suite_number;
  deleted_at   := v_now;
  return next;
end
$$;

revoke all on function public.delete_suite(uuid, text) from public, anon;
grant execute on function public.delete_suite(uuid, text) to authenticated;

comment on function public.delete_suite(uuid, text) is
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11; §10.3] Hard-deletes a suite that has never had any occupancy claim, booking or cleaning task, for a suite added by mistake. Anything with history is refused with WP073 and the console offers public.retire_suite instead, so no booking, payment or report ever loses its suite. The audit entry, holding the suite as it was, is written before the row is removed.';

create or replace function public.save_suite_setup(
  p_suite_id      uuid,
  p_suite_number  integer,
  p_display_name  text,
  p_create        boolean,
  p_reason        text,
  p_priority      integer,
  p_internal_note text
)
returns table (suite_id uuid, suite_number integer, display_name text, is_active boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform internal.require_management();
  return query select * from public.configure_suite(
    p_suite_id,
    p_suite_number,
    p_display_name,
    coalesce((select s.is_active from public.suites s where s.id = p_suite_id), true),
    p_create,
    p_reason,
    p_priority,
    p_internal_note
  );
end
$$;

comment on function public.save_suite_setup(uuid, integer, text, boolean, text, integer, text) is
  '[§10.3; CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] Management saves a suite''s number, name, priority and note in one audited step. A new suite starts active. An existing suite keeps its current is_active, so editing a retired suite''s details never returns it to service; public.retire_suite and public.return_suite_to_service own that flag.';

create or replace view public.reception_board with (security_invoker = true) as
select
  o.id                                         as occupancy_id,
  o.suite_id,
  s.suite_number,
  o.kind,
  lower(o.experience_period)                   as experience_from,
  upper(o.experience_period)                   as experience_to,
  upper(o.blocked_period)                      as blocked_to,
  o.cleaning_buffer_minutes,
  o.expires_at,
  o.reason,
  o.booking_id,
  b.reference                                  as booking_reference,
  b.status                                     as booking_status,
  btrim(c.first_name || ' '::text || c.last_name) as guest_name,
  case
    when o.kind = 'hold'::public.occupancy_kind        then 'hold'::text
    when o.kind = 'block'::public.occupancy_kind       then 'block'::text
    when o.kind = 'maintenance'::public.occupancy_kind then 'maintenance'::text
    when ct.id is not null                             then 'cleaning'::text
    when b.status = 'checked_in'::public.booking_status then 'checked_in'::text
    when b.status = 'completed'::public.booking_status  then 'completed'::text
    when b.status = 'no_show'::public.booking_status    then 'no_show'::text
    else 'booked'::text
  end                                          as board_state
from public.suite_occupancy o
join public.suites s on s.id = o.suite_id
left join public.bookings b on b.id = o.booking_id
left join public.customers c on c.id = b.customer_id
left join lateral (
  select t.id
    from public.cleaning_tasks t
   where o.kind = 'booking'::public.occupancy_kind
     and o.booking_id is not null
     and t.booking_id = o.booking_id
     and t.status <> 'confirmed'::public.cleaning_status
     and now() >= t.due_from
     and now() < upper(o.blocked_period)
   limit 1
) ct on true
where o.is_active
  and (o.expires_at is null or o.expires_at > now())
  and s.retired_at is null;

do $$
begin
  execute format(
    'comment on view public.reception_board is %L',
    obj_description('public.reception_board'::regclass, 'pg_class')
      || E'\n'
      || '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] A retired suite drops off the board with all of its claims, past and scheduled, and reappears unchanged if it returns to service. Its bookings stay readable through booking_search and booking_detail.'
  );
end
$$;

create or replace view public.management_suite_inventory with (security_invoker = true) as
select
  s.id,
  s.suite_number,
  s.display_name,
  s.status,
  s.is_active,
  (
    select count(*)::integer
      from public.bookings b
     where b.suite_id = s.id
       and b.status = any (array[
         'confirmed'::public.booking_status,
         'checked_in'::public.booking_status,
         'completed'::public.booking_status,
         'no_show'::public.booking_status
       ])
       and (lower(b.experience_period) at time zone 'Asia/Dubai')::date = (now() at time zone 'Asia/Dubai')::date
  ) as bookings_today,
  (
    select count(*)::integer
      from public.suite_occupancy o
     where o.suite_id = s.id
       and o.kind = 'hold'::public.occupancy_kind
       and o.is_active
       and o.expires_at > now()
       and (lower(o.experience_period) at time zone 'Asia/Dubai')::date = (now() at time zone 'Asia/Dubai')::date
  ) as holds_today,
  (
    select lower(b.experience_period)
      from public.bookings b
     where b.suite_id = s.id
       and b.status = 'confirmed'::public.booking_status
       and lower(b.experience_period) > now()
     order by lower(b.experience_period)
     limit 1
  ) as next_booking_at,
  (
    select r.board_state
      from public.reception_board r
     where r.suite_id = s.id
       and r.experience_from <= now()
       and r.blocked_to > now()
     order by r.experience_from desc
     limit 1
  ) as current_state,
  s.priority,
  s.internal_note,
  s.retired_at,
  s.retirement_reason,
  (
    exists (select 1 from public.suite_occupancy o where o.suite_id = s.id)
    or exists (select 1 from public.bookings b where b.suite_id = s.id)
    or exists (select 1 from public.cleaning_tasks t where t.suite_id = s.id)
  ) as has_history,
  internal.staff_display_name(s.retired_by) as retired_by_name,
  (
    select count(*)::integer
      from public.bookings b
     where b.suite_id = s.id
       and (
         b.status = 'checked_in'::public.booking_status
         or (b.status = 'confirmed'::public.booking_status and upper(b.experience_period) > now())
       )
  ) as upcoming_bookings
from public.suites s
where internal.is_management();

comment on view public.management_suite_inventory is
  '[§10.1, §10.3; CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] Management suite inventory with operational summaries and editable priority and notes. Security invoker preserves source RLS. Lists retired suites too, with retired_at, retirement_reason and retired_by_name, so the console can show them apart and return one to service. has_history is true once the suite has any occupancy claim, booking or cleaning task, which is exactly when public.delete_suite refuses and retirement is offered instead. upcoming_bookings counts checked-in guests and confirmed visits that have not ended, the bookings that make public.retire_suite refuse.';

create function public.suite_booked_dates(p_suite_id uuid, p_from date, p_to date)
returns table (booked_on date, bookings integer)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not internal.is_staff() then
    raise exception 'Sign in with an active staff account to see booked dates.'
      using errcode = '42501';
  end if;

  if p_suite_id is null or p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then
    raise exception 'Choose a suite and a date range of up to two months.'
      using errcode = '22023';
  end if;

  return query
    select d.day::date, count(distinct b.id)::integer
      from public.bookings b
      cross join lateral generate_series(
        greatest((lower(b.experience_period) at time zone 'Asia/Dubai')::date, p_from)::timestamp,
        least(((upper(b.experience_period) - interval '1 microsecond') at time zone 'Asia/Dubai')::date, p_to)::timestamp,
        interval '1 day'
      ) as d(day)
     where b.suite_id = p_suite_id
       and b.status in (
         'confirmed'::public.booking_status,
         'checked_in'::public.booking_status,
         'completed'::public.booking_status,
         'no_show'::public.booking_status
       )
       and b.experience_period && tstzrange(
         p_from::timestamp at time zone 'Asia/Dubai',
         (p_to + 1)::timestamp at time zone 'Asia/Dubai',
         '[)'
       )
     group by d.day
     order by d.day;
end
$$;

revoke all on function public.suite_booked_dates(uuid, date, date) from public, anon;
grant execute on function public.suite_booked_dates(uuid, date, date) to authenticated;

comment on function public.suite_booked_dates(uuid, date, date) is
  '[§11.1, §13; CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] The Dubai calendar dates from p_from to p_to inclusive on which one suite holds a confirmed, checked-in, completed or no-show booking, with the number of bookings on each date, for the suite page calendar. A visit crossing midnight counts on both dates. At most two months per call. SECURITY INVOKER, so staff RLS applies.';
