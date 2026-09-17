alter table public.suites add column display_name text;
alter table public.suites add constraint suites_display_name_length
  check (display_name is null or length(btrim(display_name)) between 1 and 80);
comment on column public.suites.display_name is
  '[CLIENT 9 September 2026; OUR CHOICE] Optional internal suite name for Management setup. Suite numbers and names stay out of guest-facing booking responses.';

create or replace function internal.suite_allocation_load(p_suite_id uuid, p_starts_at timestamptz, p_exclude_booking_id uuid default null)
returns bigint
language sql stable security definer set search_path = ''
as $$
  select
    (select count(*) from public.bookings b
      where b.suite_id = p_suite_id
        and b.id is distinct from p_exclude_booking_id
        and b.status in ('confirmed','checked_in','completed','no_show')
        and (lower(b.experience_period) at time zone 'Asia/Dubai')::date = (p_starts_at at time zone 'Asia/Dubai')::date)
    +
    (select count(*) from public.suite_occupancy o
      where o.suite_id = p_suite_id and o.kind = 'hold' and o.is_active
        and o.expires_at > clock_timestamp()
        and (lower(o.experience_period) at time zone 'Asia/Dubai')::date = (p_starts_at at time zone 'Asia/Dubai')::date
        and not exists (select 1 from public.bookings b where b.occupancy_id = o.id
          and b.status in ('confirmed','checked_in','completed','no_show')))
$$;
revoke all on function internal.suite_allocation_load(uuid,timestamptz,uuid) from public, anon, authenticated, service_role;
comment on function internal.suite_allocation_load(uuid,timestamptz,uuid) is
  '[CLIENT 9 September 2026; ASSUMED visit-date scope] Least-booked eligible suite replaces manual priority. Counts non-cancelled bookings on the requested Dubai date plus live unconverted checkout holds. Completed morning bookings still count toward evening distribution. Cancelled/rescheduled historical rows and expired holds do not count. Exclude the booking being rescheduled so it does not compete with itself.';

alter table public.suites add column last_allocated_at timestamptz;
comment on column public.suites.last_allocated_at is
  '[OUR CHOICE; CLIENT 9 September 2026] Tie-breaker for equal booking loads: offer the least recently allocated suite first, then suite number for an untouched tie. Written inside the allocation transaction and rolled back on failed bookings.';

create or replace function internal.allocate_suite(
  p_experience        tstzrange,
  p_blocked           tstzrange,
  p_buffer_minutes    integer,
  p_kind              public.occupancy_kind,
  p_hold_minutes      integer default null,
  p_booking_id        uuid default null,
  p_reason            text default null,
  p_allow_unavailable boolean default false,
  p_suite_id          uuid default null
)
returns table (allocated_occupancy_id uuid, allocated_suite_id uuid, allocated_expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now            timestamptz;
  v_expires_at     timestamptz;
  v_candidate      record;
  v_occupancy_id   uuid;
  v_suite_id       uuid;
  v_allocated      boolean;
begin
  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);

  v_now := clock_timestamp();

  v_expires_at := case
    when p_hold_minutes is null then null
    else v_now + (p_hold_minutes * interval '1 minute')
  end;

  perform internal.release_expired_occupancy();

  for v_candidate in
    select s.id as candidate_suite_id
      from public.suites s
     where s.is_active
       and (p_suite_id is null or s.id = p_suite_id)
       and (
         p_allow_unavailable
         or (
           s.status not in (
             'blocked'::public.suite_status,
             'maintenance'::public.suite_status,
             'not_ready'::public.suite_status,
             'out_of_service'::public.suite_status
           )
         )
       )
       and not exists (
         select 1
           from public.suite_occupancy o
          where o.suite_id = s.id
            and o.is_active
            and (o.expires_at is null or o.expires_at > v_now)
            and o.blocked_period && p_blocked
       )
     order by internal.suite_allocation_load(s.id, lower(p_experience), p_booking_id),
       s.last_allocated_at nulls first, s.suite_number
  loop
    v_allocated := false;

    begin
      perform 1
         from public.suites s
        where s.id = v_candidate.candidate_suite_id
        for update;

      if not found then
        continue;
      end if;

      if not exists (
        select 1
          from public.suite_occupancy o
         where o.suite_id = v_candidate.candidate_suite_id
           and o.is_active
           and (o.expires_at is null or o.expires_at > v_now)
           and o.blocked_period && p_blocked
      ) then
        insert into public.suite_occupancy (
          suite_id,
          kind,
          status,
          experience_period,
          blocked_period,
          cleaning_buffer_minutes,
          expires_at,
          is_active,
          booking_id,
          reason,
          created_by
        )
        values (
          v_candidate.candidate_suite_id,
          p_kind,
          'active'::public.occupancy_status,
          p_experience,
          p_blocked,
          p_buffer_minutes,
          v_expires_at,
          true,
          p_booking_id,
          p_reason,
          internal.current_staff_id()
        )
        returning id into v_occupancy_id;

        v_suite_id  := v_candidate.candidate_suite_id;
        v_allocated := true;
      end if;

    exception
      when exclusion_violation or unique_violation then
        raise debug 'allocate_suite: % lost the exclusion constraint race, next candidate',
          v_candidate.candidate_suite_id;
        v_allocated := false;
    end;

    if v_allocated then
      update public.suites set last_allocated_at = clock_timestamp() where id = v_suite_id;
      perform internal.write_audit(
        'allocate_suite_' || p_kind::text,
        'public.suite_occupancy',
        v_occupancy_id::text,
        null::jsonb,
        jsonb_build_object(
          'suite_id',                v_suite_id,
          'kind',                    p_kind,
          'status',                  'active',
          'experience_from',         lower(p_experience),
          'experience_to',           upper(p_experience),
          'blocked_from',            lower(p_blocked),
          'blocked_to',              upper(p_blocked),
          'cleaning_buffer_minutes', p_buffer_minutes,
          'expires_at',              v_expires_at,
          'hold_minutes',            p_hold_minutes,
          'booking_id',              p_booking_id,
          'allow_unavailable',       p_allow_unavailable,
          'requested_suite_id',      p_suite_id
        ),
        coalesce(
          p_reason,
          'Automatic allocation to the least-booked available suite [CLIENT 9 September 2026]'
        )
      );

      allocated_occupancy_id := v_occupancy_id;
      allocated_suite_id     := v_suite_id;
      allocated_expires_at   := v_expires_at;
      return next;
      return;
    end if;
  end loop;

  return;
end
$$;

comment on function internal.allocate_suite(tstzrange,tstzrange,integer,public.occupancy_kind,integer,uuid,text,boolean,uuid) is
  '[CLIENT 9 September 2026] Shared least-booked allocation for online holds, Reception bookings and automatic reallocation. Eligible suites are ordered by requested-date booking/hold load, then least recent allocation, then suite number. Preserves the venue lock, global expiry sweep, status exclusions, stored buffers, explicit Reception overrides and database exclusion constraint. No seven-suite limit.';

create or replace function public.save_suite_configuration(
  p_suite_id uuid, p_suite_number integer, p_display_name text,
  p_is_active boolean, p_create boolean, p_reason text
)
returns table (suite_id uuid, suite_number integer, display_name text, is_active boolean)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_before public.suites%rowtype;
  v_name text := nullif(btrim(p_display_name),'');
  v_exists boolean;
begin
  perform internal.require_management();
  if p_suite_id is null or p_suite_number is null or p_suite_number < 1
    or p_is_active is null or p_create is null or length(v_name) > 80
    or nullif(btrim(p_reason),'') is null then
    raise exception 'Enter a positive suite number and a name of up to 80 characters.' using errcode = 'WP058';
  end if;

  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);
  select * into v_before from public.suites s where s.id = p_suite_id for update;
  v_exists := found;
  if not v_exists and not p_create then
    raise exception 'This suite no longer exists. Refresh the list.' using errcode = 'P0002';
  end if;
  if v_exists and p_create then
    if v_before.suite_number = p_suite_number and v_before.display_name is not distinct from v_name
      and v_before.is_active = p_is_active then
      return query select s.id, s.suite_number, s.display_name, s.is_active from public.suites s where s.id = p_suite_id;
      return;
    end if;
    raise exception 'This suite has already been added. Refresh the list.' using errcode = 'WP058';
  end if;
  if exists(select 1 from public.suites s where s.suite_number = p_suite_number and s.id <> p_suite_id) then
    raise exception 'That suite number is already in use. Choose a different number.' using errcode = 'WP059';
  end if;

  if v_exists then
    update public.suites s set suite_number = p_suite_number, display_name = v_name, is_active = p_is_active
      where s.id = p_suite_id;
  else
    insert into public.suites(id, suite_number, display_name, is_active)
      values (p_suite_id,p_suite_number,v_name,p_is_active);
  end if;
  perform internal.write_audit(
    case when v_exists then 'update_suite_configuration' else 'create_suite' end,
    'public.suites',p_suite_id::text,
    case when v_exists then jsonb_build_object('suite_number',v_before.suite_number,'display_name',v_before.display_name,'is_active',v_before.is_active) end,
    jsonb_build_object('suite_number',p_suite_number,'display_name',v_name,'is_active',p_is_active),p_reason);
  return query select s.id,s.suite_number,s.display_name,s.is_active from public.suites s where s.id = p_suite_id;
end
$$;
revoke all on function public.save_suite_configuration(uuid,integer,text,boolean,boolean,text) from public, anon;
grant execute on function public.save_suite_configuration(uuid,integer,text,boolean,boolean,text) to authenticated, service_role;
comment on function public.save_suite_configuration(uuid,integer,text,boolean,boolean,text) is
  '[CLIENT 9 September 2026] Management adds or edits suite number, optional name and inclusion in new bookings. New suites use the same status defaults, allocation, cancellation, payment and cleaning paths as every existing suite. Disabling prevents new allocation without cancelling existing reservations. Daily status stays Reception-owned. Unique numbers and the allocation lock serialize additions and edits. Retrying an identical create with the same UUID returns that suite without another insert or audit event.';

create view public.management_suite_inventory with (security_invoker = true) as
select s.id, s.suite_number, s.display_name, s.status, s.is_active,
  (select count(*)::integer from public.bookings b
    where b.suite_id = s.id and b.status in ('confirmed','checked_in','completed','no_show')
    and (lower(b.experience_period) at time zone 'Asia/Dubai')::date = (now() at time zone 'Asia/Dubai')::date) as bookings_today,
  (select count(*)::integer from public.suite_occupancy o
    where o.suite_id = s.id and o.kind = 'hold' and o.is_active and o.expires_at > now()
    and (lower(o.experience_period) at time zone 'Asia/Dubai')::date = (now() at time zone 'Asia/Dubai')::date) as holds_today,
  (select lower(b.experience_period) from public.bookings b where b.suite_id = s.id
    and b.status = 'confirmed' and lower(b.experience_period) > now()
    order by lower(b.experience_period) limit 1) as next_booking_at,
  (select r.board_state from public.reception_board r where r.suite_id = s.id
    and r.experience_from <= now() and r.blocked_to > now()
    order by r.experience_from desc limit 1) as current_state
from public.suites s where internal.is_management();
revoke all on public.management_suite_inventory from public, anon;
grant select on public.management_suite_inventory to authenticated;
comment on view public.management_suite_inventory is
  '[CLIENT 9 September 2026; OUR CHOICE] Management-only read view including inactive suites, today''s booking and hold load, current Reception state and next confirmed visit. No booking editor, priority control or staff-note editor. Security invoker preserves source-table RLS.';
