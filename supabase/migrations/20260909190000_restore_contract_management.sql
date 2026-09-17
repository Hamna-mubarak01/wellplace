do $$
declare
  v_name text;
  v_function record;
  v_body text;
  v_count integer;
begin
  foreach v_name in array array[
    'hold_suite', 'create_reception_booking', 'cancel_booking', 'reschedule_booking', 'extend_booking',
    'move_booking', 'update_booking_details', 'record_arrival', 'check_in_booking',
    'check_out_booking', 'mark_no_show', 'record_overrun', 'mark_late_arrival',
    'override_booking_buffer', 'start_cleaning_task', 'assign_cleaning_task',
    'confirm_cleaning_task', 'block_suite_period', 'release_suite_block', 'set_suite_status',
    'record_booking_payment', 'set_manual_booking_price', 'add_shift_note', 'hand_over_shift'
  ]
  loop
    v_count := 0;
    for v_function in
      select p.oid, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      join pg_language l on l.oid = p.prolang
      where n.nspname = 'public' and p.proname = v_name and l.lanname = 'plpgsql'
    loop
      v_body := replace(v_function.prosrc, E'\n  perform internal.require_reception_operator();', '');
      if v_body = v_function.prosrc then
        raise exception 'Expected temporary management restriction on %', v_name;
      end if;
      execute replace(pg_get_functiondef(v_function.oid), v_function.prosrc, v_body);
      v_count := v_count + 1;
    end loop;
    if v_count <> 1 then
      raise exception 'Expected one operational function %, found %', v_name, v_count;
    end if;
  end loop;
end
$$;

grant execute on function public.set_suite_details(uuid,integer,text,text) to authenticated,service_role;
comment on function public.set_suite_details(uuid,integer,text,text) is '[§7.2, §10.3; CLIENT clarification] Management edits suite priority and internal notes. Original authentication, allocation locking and audit requirements are retained.';
drop function internal.require_reception_operator();
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
  v_strategy text;
begin
  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);

  v_now := clock_timestamp();
  select coalesce(s.value #>> '{}', 'fixed_priority') into v_strategy from public.settings s where s.key = 'allocation.strategy';
  v_strategy := coalesce(v_strategy, 'fixed_priority');

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
     order by case when v_strategy = 'fixed_priority' then s.priority else 0 end,
       case when v_strategy = 'rotation' then internal.suite_allocation_load(s.id, lower(p_experience), p_booking_id) else 0 end,
       case when v_strategy in ('rotation', 'lru') then s.last_allocated_at end nulls first, s.suite_number
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
          'Automatic suite allocation: ' || v_strategy || ' [§7.2]' 
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
  '[§7.2, §10.2; CLIENT clarification] Management-configurable fixed priority is the contract default. Optional rotation uses requested-Dubai-date booking and live-hold load; lru uses last allocation. All strategies share eligibility, buffered occupancy, expiry, locking and audit safeguards.';

create or replace function public.configure_suite(
  p_suite_id uuid, p_suite_number integer, p_display_name text,
  p_is_active boolean, p_create boolean, p_reason text,
  p_priority integer, p_internal_note text
)
returns table (suite_id uuid, suite_number integer, display_name text, is_active boolean)
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform internal.require_management();
  if p_priority is null or p_priority < 0 or length(p_internal_note) > 2000 then
    raise exception 'Enter a non-negative priority and a note of at most 2000 characters.' using errcode = 'WP058';
  end if;
  perform public.save_suite_configuration(p_suite_id,p_suite_number,p_display_name,p_is_active,p_create,p_reason);
  perform public.set_suite_details(p_suite_id,p_priority,nullif(btrim(p_internal_note),''),p_reason);
  return query select s.id,s.suite_number,s.display_name,s.is_active from public.suites s where s.id=p_suite_id;
end
$$;
revoke all on function public.configure_suite(uuid,integer,text,boolean,boolean,text,integer,text) from public,anon;
grant execute on function public.configure_suite(uuid,integer,text,boolean,boolean,text,integer,text) to authenticated,service_role;
comment on function public.configure_suite(uuid,integer,text,boolean,boolean,text,integer,text) is
  '[§10.3; CLIENT clarification] Saves suite identity, booking inclusion, priority and internal note atomically. Reuses the audited, management-only setup functions and the shared allocation lock. The original client contract authorises status, priority, notes, blocks and capacity oversight; the temporary monitor-only restriction is superseded.';
create or replace view public.management_suite_inventory with (security_invoker = true) as
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
    order by r.experience_from desc limit 1) as current_state, s.priority, s.internal_note
from public.suites s where internal.is_management();
comment on view public.management_suite_inventory is '[§10.1, §10.3] Management suite inventory with operational summaries and editable priority and notes. Security invoker preserves source RLS.';
