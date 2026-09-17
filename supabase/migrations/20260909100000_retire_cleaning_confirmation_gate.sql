-- [CLIENT 8 September 2026; §7.1, §7.2] Stored buffers release automatically.
-- Extra cleaning uses an audited Not ready status until Reception sets Available.
-- Preserve allocator locking, expiry sweep, exclusion constraint and grants.

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
     order by s.priority, s.suite_number
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
          'Automatic allocation by fixed suite priority [§7.2, §7.3]'
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

create or replace function public.count_available_suites(
  p_starts_at      timestamptz[],
  p_duration_hours integer,
  p_buffer_minutes integer
)
returns table (starts_at timestamptz, remaining integer, reduced_by_demand boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now            timestamptz;
begin
  if p_starts_at is null then
    raise exception 'count_available_suites: p_starts_at must not be null'
      using errcode = '22004';
  end if;

  if exists (select 1 from unnest(p_starts_at) t(instant) where t.instant is null) then
    raise exception 'count_available_suites: p_starts_at must not contain a null instant'
      using errcode = '22004';
  end if;

  if exists (select 1 from unnest(p_starts_at) t(instant) where not isfinite(t.instant)) then
    raise exception 'count_available_suites: every entry of p_starts_at must be a finite instant'
      using errcode = '22004';
  end if;

  if array_length(p_starts_at, 1) > 200 then
    raise exception 'count_available_suites: at most 200 instants per call, got %',
      array_length(p_starts_at, 1)
      using errcode = 'WP009';
  end if;

  if p_duration_hours is null or p_duration_hours <= 0 or p_duration_hours > 24 * 366 then
    raise exception 'count_available_suites: p_duration_hours must be between 1 and one year, got %',
      coalesce(p_duration_hours::text, 'null')
      using errcode = 'WP005';
  end if;

  if p_buffer_minutes is null or p_buffer_minutes < 0 or p_buffer_minutes > 24 * 60 then
    raise exception 'count_available_suites: p_buffer_minutes must be between 0 and one day, got %',
      coalesce(p_buffer_minutes::text, 'null')
      using errcode = 'WP006';
  end if;

  v_now := clock_timestamp();

  return query
  with candidate_windows as (
    select
      t.ordinality as ord,
      t.instant    as instant,
      tstzrange(
        t.instant,
        t.instant + (p_duration_hours * interval '1 hour'),
        '[)'
      ) as experience_period
    from unnest(p_starts_at) with ordinality as t(instant, ordinality)
  ),
  blocked_windows as (
    select
      cw.ord,
      cw.instant,
      tstzrange(
        lower(cw.experience_period),
        upper(cw.experience_period) + (p_buffer_minutes * interval '1 minute'),
        '[)'
      ) as blocked_period
    from candidate_windows cw
  ),
  per_suite as (
    select
      bw.ord,
      conflict.n_conflicting > 0 as is_conflicted,
      conflict.n_demand      > 0 as is_demand
    from blocked_windows bw
    cross join public.suites s
    cross join lateral (
      select
        count(*) as n_conflicting,
        count(*) filter (
          where o.kind in (
            'hold'::public.occupancy_kind,
            'booking'::public.occupancy_kind
          )
        ) as n_demand
      from public.suite_occupancy o
      where o.suite_id = s.id
        and o.is_active
        and (o.expires_at is null or o.expires_at > v_now)
        and o.blocked_period && bw.blocked_period
    ) conflict
    where s.is_active
      and s.status not in (
            'blocked'::public.suite_status,
            'maintenance'::public.suite_status,
            'not_ready'::public.suite_status,
            'out_of_service'::public.suite_status
          )
  )
  select
    bw.instant,
    count(*) filter (where not ps.is_conflicted)::integer,
    coalesce(bool_or(ps.is_demand), false)
  from blocked_windows bw
  left join per_suite ps on ps.ord = bw.ord
  group by bw.ord, bw.instant
  order by bw.ord;
end
$$;

comment on function internal.allocate_suite(tstzrange,tstzrange,integer,public.occupancy_kind,integer,uuid,text,boolean,uuid) is
  '[CLIENT 8 September 2026, §7.1] One allocator with the global advisory lock, expiry sweep, suite row locks and exclusion constraint. Stored occupancy includes cleaning buffers; elapsed buffers need no cleaning-confirmation click. Manual blocked/maintenance/not_ready/out_of_service statuses are excluded unless an authorised allocation override explicitly allows them. Lock order: allocation advisory lock, expiry sweep, then suite and occupancy rows [INV-02].';
comment on function public.count_available_suites(timestamptz[],integer,integer) is
  '[CLIENT 8 September 2026, §7.4] Read-only twin of the allocator. Stored occupancy buffers and explicit unavailable statuses determine availability; cleaning task confirmation never gates it. Operational status reductions are not demand. No suite identifiers or capacity reach the guest response.';
comment on table public.cleaning_tasks is
  '[§9.2, CLIENT 8 September 2026] Operational cleaning work and confirmation history. Allocation is protected by the stored buffer and explicit suite status, never by an unconfirmed cleaning task. Reception marks an extra cleaning delay Not ready with an audit reason, then Available when ready.';
comment on function internal.setting_boolean(text) is
  '[§10.2] Internal boolean setting reader. Null means absent or unset. No cleaning-confirmation gate is supported.';

drop function internal.awaits_cleaning_confirmation(uuid,timestamptz);

-- Keep the retired configuration decision in the append-only audit.
select internal.write_audit('retire_setting','public.settings',s.key,
  jsonb_build_object('value',s.value),null,
  'Client removed the cleaning-confirmation gate; stored buffers release automatically and Reception records manual delays with a reason.')
from public.settings s where s.key='cleaning.confirm_gates_availability';
delete from public.settings where key='cleaning.confirm_gates_availability';
