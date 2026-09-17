

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
  v_now timestamptz;
begin
  -- ── 1. Validation ─────────────────────────────────────────────────────────
  if p_starts_at is null then
    raise exception 'count_available_suites: p_starts_at must not be null'
      using errcode = '22004';
  end if;

  -- A null element would make tstzrange(null, x) UNBOUNDED rather than empty,
  -- which overlaps every occupancy row there is and would report a busy day as
  -- fully booked. Caught here instead of surfacing as a plausible-looking zero.
  if exists (select 1 from unnest(p_starts_at) t(instant) where t.instant is null) then
    raise exception 'count_available_suites: p_starts_at must not contain a null instant'
      using errcode = '22004';
  end if;

  -- 'infinity' slips past the null guard and produces an EMPTY experience
  -- period and an unbounded blocked period. Same class of input, same answer,
  -- and the same guard hold_suite applies to its single instant.
  if exists (select 1 from unnest(p_starts_at) t(instant) where not isfinite(t.instant)) then
    raise exception 'count_available_suites: every entry of p_starts_at must be a finite instant'
      using errcode = '22004';
  end if;

  -- A REQUEST-SIZE GUARD, NOT A BUSINESS RULE. It is not §10.2 configuration
  -- and no Management screen may ever edit it: it exists only so one call
  -- cannot ask for an unbounded cross join against every suite. A day of
  -- 15-minute starts is about 60 instants and the widest §6.1 horizon is a
  -- handful of days per request, so 200 is far above anything the booking flow
  -- legitimately builds and far below anything that costs the database. If a
  -- caller ever needs more, it should page, not raise this number.
  -- WP009 is the next free code in the WP0xx family (WP001..WP008 are taken by
  -- the staff and allocation migrations).
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

  -- ── 2. The instant this call reasons about ────────────────────────────────
  -- clock_timestamp(), NOT now(), and captured ONCE — hold_suite's Note in
  -- step 4 explains why at length: now() is transaction_timestamp() and stops
  -- at BEGIN, so anything that waited first judges expiry against a clock that
  -- stopped before the wait, and a hold that ran out during it goes on blocking.
  -- Reading availability with a stale clock produces exactly the same lie in
  -- the other direction — a tile reported "fully booked" against holds that had
  -- already expired.
  --
  -- One captured value keeps every instant in the array judged against the same
  -- moment. Without that, tile 1 and tile 60 of one grid could disagree about
  -- whether the same hold is alive.
  v_now := clock_timestamp();

  -- ── 3. The count ──────────────────────────────────────────────────────────
  -- `with ordinality` is what guarantees the contract the caller depends on:
  -- one output row per INPUT entry, in INPUT order, including entries whose
  -- answer is 0 and including duplicates. The service zips this result against
  -- its own tile list positionally, so a dropped or reordered row would
  -- mislabel every tile after it. The LEFT JOIN below is the other half of
  -- that promise: when no suite is allocatable at all, per_suite is empty for
  -- that ordinal and an inner join would silently drop the instant instead of
  -- reporting 0.
  --
  -- Nothing in the select list is named starts_at, remaining or
  -- reduced_by_demand. Those three are OUT parameters, and PL/pgSQL substitutes
  -- a variable for any unqualified identifier that matches one — the same trap
  -- hold_suite documents against `returning suite_id`.
  return query
  with candidate_windows as (
    select
      t.ordinality as ord,
      t.instant    as instant,
      -- Built exactly as hold_suite builds them. Both half-open '[)', so a
      -- claim starting at precisely the moment another one's block ends does
      -- NOT overlap it: the §7.1 worked example (11:00 finish + 20 minutes
      -- blocks to 11:20, 11:20 is free, 11:10 is not) falls out of the range
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
    -- The predicate, written once. `n_conflicting = 0` is precisely
    -- hold_suite's `not exists (...)`; counting instead of testing lets the
    -- same single scan answer the demand question below, so the two can never
    -- drift apart from each other.
    cross join lateral (
      select
        count(*) as n_conflicting,
        -- §7.4: "This time is booking up" may appear ONLY when the reduced
        -- capacity is at least partly caused by confirmed bookings or active
        -- holds. So only these two kinds count as demand. A 'block' or a
        -- 'maintenance' row is an operational decision by the venue, and
        -- dressing it up as scarcity is manufactured urgency, which the
        -- contract forbids outright.
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
      -- §7.2: these four are never allocated automatically, so they are never
      -- counted as available either. Note what this ordering buys: a suite
      -- excluded HERE never reaches the demand test below, which is exactly
      -- why a suite out for maintenance can reduce `remaining` and still leave
      -- reduced_by_demand false.
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
    -- True when at least ONE suite that would otherwise have been allocatable
    -- is held back for this window by a hold or a booking. "At least one" is
    -- the contract's own words; it is not a threshold and not a ratio.
    --
    coalesce(bool_or(ps.is_demand), false)
  from blocked_windows bw
  left join per_suite ps on ps.ord = bw.ord
  group by bw.ord, bw.instant
  order by bw.ord;
end
$$;


comment on function public.count_available_suites(timestamptz[], integer, integer) is
  'How many suites are free for each candidate start instant, for the §7.4 '
  'time tiles. READ-ONLY twin of public.hold_suite: same candidate predicate, '
  'same half-open periods, same clock_timestamp() expiry filter (INV-05), but '
  'no lock, no lazy expiry and no audit — a page view must not mutate the '
  'database. One output row per input entry, in input order, including zeroes. '
  'reduced_by_demand is true only when a hold or a booking is holding back a '
  'suite that would otherwise be allocatable, because §7.4 forbids '
  'manufacturing urgency out of maintenance and blocks. Never returns a suite '
  'id, a suite number or a total (INV-01). SECURITY DEFINER because the guest '
  'booking flow is unauthenticated and holds no read grant on public.suites.';


revoke all on function public.count_available_suites(timestamptz[], integer, integer) from public;

grant execute on function public.count_available_suites(timestamptz[], integer, integer)
  to authenticated, service_role;
