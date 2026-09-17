

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
  v_now          timestamptz;
  v_expires_at   timestamptz;
  v_candidate    record;
  v_occupancy_id uuid;
  v_suite_id     uuid;
  v_allocated    boolean;
begin
  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);

  v_now := clock_timestamp();

  v_expires_at := case
    when p_hold_minutes is null then null
    else v_now + (p_hold_minutes * interval '1 minute')
  end;

  update public.suite_occupancy o
     set is_active = false,
         status    = 'expired'::public.occupancy_status
   where o.id in (
     select e.id
       from public.suite_occupancy e
      where e.is_active
        and e.expires_at is not null
        and e.expires_at <= v_now
      order by e.id
      for update
   );

  for v_candidate in
    select s.id as candidate_suite_id
      from public.suites s
     where s.is_active
       and (p_suite_id is null or s.id = p_suite_id)
       and (
         p_allow_unavailable
         or s.status not in (
              'blocked'::public.suite_status,
              'maintenance'::public.suite_status,
              'not_ready'::public.suite_status,
              'out_of_service'::public.suite_status
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


comment on function internal.allocate_suite(
  tstzrange, tstzrange, integer, public.occupancy_kind,
  integer, uuid, text, boolean, uuid
) is
  'The one allocator [§7.2, §7.3, §7.5]. Every path that claims suite time goes through it: the guest hold, a Reception walk-in, an atomic reschedule and a calendar move. A second implementation would drift from the code that causes the collisions, which is the same reason §10.3 block preview is a dry run of this rather than an estimator. Returns zero rows when nothing is free (R-32) and never returns a suite_number (INV-01).

Four properties are load-bearing and must survive any edit.

1. The venue-wide advisory lock is taken FIRST, before any other resource. Suite locks alone are not enough: §7.6 requires an atomic reschedule, which calls this twice in one transaction while still holding the first call''s suite locks, so the "one total order" argument fails at transaction scope. Advisory locks are re-entrant, so a re-entering caller already holds it. Allocation is therefore serialised venue-wide; for seven suites that is tens of milliseconds at twenty parallel attempts. Narrowing it to a per-window key for a much larger venue requires taking the keys in one sorted pass, or the deadlock returns.

2. The expiry sweep is GLOBAL and runs before any suite is locked. It takes its row locks through one ordered sub-select. Narrowing it per candidate would put an occupancy lock inside the suite-lock loop and reopen a deadlock the concurrency harness reproduces at twenty parallel attempts. This is INV-05: an expired hold stops blocking availability even when the cleanup cron is delayed.

3. clock_timestamp(), never now(). now() is transaction_timestamp(), fixed at BEGIN, so a caller that waited on the advisory lock would judge expiry against a stopped clock and answer "nothing free" with a suite genuinely free.

4. The suite lock is BLOCKING. `for update skip locked` would let a caller skip every momentarily-locked suite and report no availability while suites were free. The `if not found then continue` guard exists because PERFORM does not raise when SKIP LOCKED skips - it only sets FOUND false - so without it a mutation to SKIP LOCKED would insert while holding no lock at all.

p_allow_unavailable carries §7.2''s override: blocked, maintenance, not-ready and out-of-service suites are never allocated automatically, and the exception needs perm:override_suite_allocation from Reception AND Management alike. This function does not check that permission - the calling RPC does, because only the caller knows whether a human asked for the override.

p_hold_minutes, not an expires_at, is the parameter on purpose. The clock is read AFTER the advisory lock is granted, so a caller that queued behind another allocator still gets its full §7.3 ten minutes. Passing a timestamp computed by the caller would silently shorten every contended hold.

p_suite_id names one specific suite for §9.2''s calendar move. It still takes the lock, still re-checks inside it, and still lets suite_occupancy_no_overlap be the backstop (INV-02). A move is not exempt from the constraint.';


create or replace function public.hold_suite(
  p_starts_at      timestamptz,
  p_duration_hours integer,
  p_buffer_minutes integer,
  p_hold_minutes   integer
)
returns table (occupancy_id uuid, suite_id uuid, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_experience     tstzrange;
  v_blocked        tstzrange;
  v_occupancy_id   uuid;
  v_held_suite_id  uuid;
  v_held_until     timestamptz;
begin
  if p_starts_at is not null and not isfinite(p_starts_at) then
    raise exception 'hold_suite: p_starts_at must be a finite instant, got %', p_starts_at
      using errcode = '22004';
  end if;

  if p_starts_at is null then
    raise exception 'hold_suite: p_starts_at must not be null'
      using errcode = '22004';
  end if;

  if p_duration_hours is null or p_duration_hours <= 0 or p_duration_hours > 24 * 366 then
    raise exception 'hold_suite: p_duration_hours must be between 1 and one year, got %',
      coalesce(p_duration_hours::text, 'null')
      using errcode = 'WP005';
  end if;

  if p_buffer_minutes is null or p_buffer_minutes < 0 or p_buffer_minutes > 24 * 60 then
    raise exception 'hold_suite: p_buffer_minutes must be between 0 and one day, got %',
      coalesce(p_buffer_minutes::text, 'null')
      using errcode = 'WP006';
  end if;

  if p_hold_minutes is null or p_hold_minutes <= 0 or p_hold_minutes > 24 * 60 then
    raise exception 'hold_suite: p_hold_minutes must be between 1 and one day, got %',
      coalesce(p_hold_minutes::text, 'null')
      using errcode = 'WP007';
  end if;

  if internal.current_staff_id() is not null
     and internal.current_staff_role() is null then
    raise exception 'hold_suite: this account is not an active staff member'
      using errcode = 'WP008';
  end if;

  v_experience := tstzrange(
    p_starts_at,
    p_starts_at + (p_duration_hours * interval '1 hour'),
    '[)'
  );

  v_blocked := tstzrange(
    lower(v_experience),
    upper(v_experience) + (p_buffer_minutes * interval '1 minute'),
    '[)'
  );

  select a.allocated_occupancy_id, a.allocated_suite_id, a.allocated_expires_at
    into v_occupancy_id, v_held_suite_id, v_held_until
    from internal.allocate_suite(
      v_experience,
      v_blocked,
      p_buffer_minutes,
      'hold'::public.occupancy_kind,
      p_hold_minutes,
      null,
      null,
      false,
      null
    ) a;

  if v_occupancy_id is null then
    return;
  end if;

  occupancy_id := v_occupancy_id;
  suite_id     := v_held_suite_id;
  expires_at   := v_held_until;
  return next;
end
$$;


revoke all on function internal.allocate_suite(
  tstzrange, tstzrange, integer, public.occupancy_kind,
  integer, uuid, text, boolean, uuid
) from public, anon, authenticated;


comment on function public.hold_suite(timestamptz, integer, integer, integer) is
  'Allocate a free suite for the requested window and hold it [§7.3, §7.5]. Validates its inputs, builds the half-open experience and blocked ranges, and delegates the allocation itself to internal.allocate_suite - read that function''s comment before changing anything about locking, expiry or ordering.

Both ranges are half-open. That is what makes the §7.1 worked example fall out of the exclusion constraint rather than out of arithmetic: an experience ending 11:00 with a 20-minute buffer blocks to 11:20, and a claim starting at exactly 11:20 does not overlap it. The buffer is stored ON the row, never read back from settings at query time, so a Management change applies to new bookings while existing ones keep the buffer they were sold with.

It runs SECURITY DEFINER because the §6.1 guest flow is unauthenticated: anon holds no INSERT grant on public.suite_occupancy and RLS would refuse it. It is therefore a privilege boundary reachable by anon, which is why it validates every input and does exactly one thing. WP005 duration, WP006 buffer, WP007 hold minutes, WP008 an inactive staff member presenting a staff identity.

Returns zero rows when nothing is free (R-32) and never returns a suite_number (INV-01).';
