create or replace function internal.count_available_suite_windows(
  p_starts_at      timestamptz[],
  p_duration_minutes integer,
  p_buffer_minutes integer,
  p_exclude_booking_id uuid
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

  if p_duration_minutes is null or p_duration_minutes <= 0 or p_duration_minutes > 24 * 60 * 366 then
    raise exception 'count_available_suites: p_duration_minutes must be between 1 and one year, got %',
      coalesce(p_duration_minutes::text, 'null')
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
        t.instant + (p_duration_minutes * interval '1 minute'),
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
        and (p_exclude_booking_id is null or o.booking_id is distinct from p_exclude_booking_id)
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


revoke all on function internal.count_available_suite_windows(timestamptz[],integer,integer,uuid) from public, anon, authenticated, service_role;

create or replace function public.count_available_suites(p_starts_at timestamptz[], p_duration_hours integer, p_buffer_minutes integer)
returns table (starts_at timestamptz, remaining integer, reduced_by_demand boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_duration_hours is null or p_duration_hours <= 0 or p_duration_hours > 24 * 366 then
    raise exception 'Choose a valid visit duration' using errcode = 'WP005';
  end if;
  return query select * from internal.count_available_suite_windows(p_starts_at, p_duration_hours * 60, p_buffer_minutes, null);
end
$$;

create function public.count_reschedule_suites(p_booking_id uuid, p_starts_at timestamptz[], p_duration_minutes integer)
returns table (starts_at timestamptz, remaining integer, reduced_by_demand boolean)
language plpgsql stable security definer set search_path = '' as $$
declare v_booking public.bookings%rowtype;
begin
  if not internal.is_staff() then raise exception 'An active Reception session is required' using errcode = '42501'; end if;
  perform internal.require_desk_operator();
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then raise exception 'The booking could not be found' using errcode = 'P0002'; end if;
  if v_booking.status <> 'confirmed' then
    raise exception 'This booking can no longer be rescheduled' using errcode = 'WP014';
  end if;
  return query select * from internal.count_available_suite_windows(p_starts_at, p_duration_minutes, v_booking.cleaning_buffer_minutes, p_booking_id);
end
$$;
revoke all on function public.count_reschedule_suites(uuid,timestamptz[],integer) from public, anon;
grant execute on function public.count_reschedule_suites(uuid,timestamptz[],integer) to authenticated;
comment on function internal.count_available_suite_windows(timestamptz[],integer,integer,uuid) is '[§7.4, §7.6] Shared advisory availability predicate for new bookings and rescheduling. Exact minutes, saved buffers and exclusion of the booking being moved; final allocation remains atomic.';
comment on function public.count_reschedule_suites(uuid,timestamptz[],integer) is '[§7.6] Reception-only rescheduling preview. Uses the booking cleaning buffer and excludes its own occupancy, without changing or reserving inventory.';
