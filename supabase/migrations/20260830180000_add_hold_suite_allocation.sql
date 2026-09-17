

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
  v_now           timestamptz;
  v_experience    tstzrange;
  v_blocked       tstzrange;
  v_expires_at    timestamptz;
  v_candidate     record;
  v_occupancy_id  uuid;
  v_suite_id      uuid;
  v_allocated     boolean;
begin
  -- ── 1. Validation ─────────────────────────────────────────────────────────
  if p_starts_at is not null and not isfinite(p_starts_at) then
    -- 'infinity' slips past the null guard below and produces an EMPTY
    -- experience_period and an unbounded blocked_period, which trips
    -- suite_occupancy_periods_bounded with a raw 23514 whose DETAIL prints the
    -- whole failing row. Same class of input, same answer, caught here instead.
    raise exception 'hold_suite: p_starts_at must be a finite instant, got %', p_starts_at
      using errcode = '22004';
  end if;

  if p_starts_at is null then
    -- Not a WP code: null_value_not_allowed already means exactly this, and
    -- inventing a fourth WP number for a null check would dilute the family.
    -- Guarded explicitly because tstzrange(null, x) is UNBOUNDED, not empty,
    -- which would trip suite_occupancy_periods_bounded with an opaque 23514.
    raise exception 'hold_suite: p_starts_at must not be null'
      using errcode = '22004';
  end if;

  -- The upper bounds are ABSURDITY GUARDS, not business rules, and they are
  -- deliberately far outside anything §6.1 or §10.2 would ever configure —
  -- §6.1 offers 2 to 6 hours and Management owns the real limits above this
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

  -- ── 2. Periods ────────────────────────────────────────────────────────────
  -- Both half-open '[)', which is what makes §7.1's worked example fall out of
  -- the constraint rather than out of arithmetic somewhere above it: an
  -- experience ending 11:00 with a 20-minute buffer blocks to 11:20, and a
  -- claim starting at exactly 11:20 does NOT overlap it. Touching boundaries
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

  -- ── 2b. A staff identity presented here must be an ACTIVE one ─────────────
  -- This function is SECURITY DEFINER, so it bypasses the RLS that normally
  -- makes deactivation bite. src/lib/services/staff-access-service.ts states
  -- that once the flag flips "every RLS policy and every RPC refuses them" and
  -- that an already-issued access token staying valid is survivable precisely
  -- because the database is the real boundary. Without this check that was not
  -- true here: a colleague deactivated ten seconds ago could still allocate,
  -- and — before the bounds above — hold every suite for as long as they liked.
  -- Refresh tokens are revoked immediately, so the exposure was one access-token
  -- lifetime, but "one hour" is not the same as "refused".
  --
  -- The shape is deliberate. It refuses a caller who PRESENTS a staff identity
  -- that is not active, rather than requiring staff. current_staff_id() reads
  -- the JWT sub, so service_role and the migration/test superuser carry none and
  -- pass; current_staff_role() filters on is_active, so a deactivated person has
  -- an id and no role, which is exactly the pair caught here.
  --
  -- When the §6.1 guest flow is built it will arrive as anon with no sub and
  -- pass this untouched — which is why the grant and the rate limiter, not this
  -- check, are what that commit has to get right.
  if internal.current_staff_id() is not null
     and internal.current_staff_role() is null then
    raise exception 'hold_suite: this account is not an active staff member'
      using errcode = 'WP008';
  end if;

  -- ── 3. One allocator at a time ────────────────────────────────────────────
  -- Every caller takes this single transaction-scoped advisory lock before it
  -- touches anything, and releases it at commit. Two reasons, both measured.
  --
  -- (a) It makes the deadlock in Note 3 structurally impossible rather than
  --     merely unlikely. That note argued no cycle can form because suite locks
  --     are taken in one total order and the expiry sweep always runs first.
  --     True of a single call; NOT true of a transaction. Two calls in one
  --     transaction — which §6.4 mandates for an atomic reschedule, and §8.2
  --     recovery reaches for — restart that order while still holding suite
  --     locks from the first call, and a caller expiring a backlog can then
  --     wait on a suite lock while the suite's holder waits on its backlog row.
  --     Reproduced at will before this lock existed. With one lock taken first
  --     by everybody there is no second resource to invert on, and a caller
  --     that re-enters already holds it — advisory locks are re-entrant.
  --
  -- (b) It makes the candidate snapshot in step 6 trustworthy. That query runs
  --     once. Before this lock, a caller could park for seconds on another
  --     allocator's suite lock and then answer "nothing free" from a candidate
  --     list assembled before the suite it wanted was released — the very
  --     "reports no suite available while suites were free" failure the comment
  --     on SKIP LOCKED rejects. Holding this first means no other allocator can
  --     move a suite into or out of that list while we walk it.
  --
  -- The cost is that allocation is serialised venue-wide. For seven suites that
  -- is not a trade: 20 parallel callers finish in tens of milliseconds, and they
  -- already serialised on the sweep's row locks. If the venue ever has hundreds
  -- of suites, narrow this to a per-window key AND take the keys in a sorted
  -- pass, or hazard (a) comes straight back.
  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);

  -- ── 4. The instant this allocation reasons about ──────────────────────────
  -- clock_timestamp(), NOT now(). now() is transaction_timestamp(), fixed at
  -- BEGIN, so a caller that waited on the lock above — or did any other work
  -- first — judges expiry against a clock that stopped before the wait.
  -- Measured: a hold that ran out two seconds into that wait still blocked, and
  -- this function answered "nothing free" with a suite genuinely free. That is
  v_now := clock_timestamp();

  -- ── 5. Lazy expiry ────────────────────────────────────────────────────────
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

  v_expires_at := v_now + (p_hold_minutes * interval '1 minute');

  -- ── 4/5. Candidates, then lock-recheck-insert on each in turn ─────────────
  for v_candidate in
    select s.id as candidate_suite_id
      from public.suites s
     where s.is_active
       -- §7.2: these four are never allocated automatically. The other five —
       -- available, checkout_hold, booked, checked_in, cleaning — describe the
       -- suite RIGHT NOW and must not exclude it from a booking next week.
       -- suite_occupancy is what decides conflicts in time; suites.status is
       -- what decides whether the room may be allocated at all.
       and s.status not in (
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
            -- Belt and braces with step 3: a hold that ran out must not block,
            -- whether or not anything has flagged it yet.
            and (o.expires_at is null or o.expires_at > v_now)
            and o.blocked_period && v_blocked
       )
     -- allocation.strategy = fixed priority (Part 8). Also the total lock
     -- order from Note 3(a) — read that before making this configurable.
     order by s.priority, s.suite_number
  loop
    v_allocated := false;

    begin
      -- Serialise every competitor for THIS suite. Blocking, deliberately not
      -- SKIP LOCKED: with 3 requests against 7 free suites, SKIP LOCKED would
      -- let a caller skip past every momentarily-locked suite and report
      -- "no suite available" while suites were free, which is precisely the
      perform 1
         from public.suites s
        where s.id = v_candidate.candidate_suite_id
        for update;

      -- The lock above is BLOCKING, so this always finds the row and the guard
      -- is a no-op today. It is here for the one edit somebody is most likely
      -- to try: `for update skip locked`, reached for as an optimisation when
      -- the priority queue looks slow. PERFORM does not raise when SKIP LOCKED
      -- skips — it simply sets FOUND false — so without this line the function
      -- would sail on and insert while holding no lock at all.
      --
      -- Honest note on how dangerous that is, because it changed during this
      -- commit. Measured BEFORE the advisory lock in step 3 existed, SKIP
      -- LOCKED did not merely under-allocate: 20 parallel attempts deadlocked,
      -- because the exclusion index then took its locks in arrival order rather
      -- than the total order Note 3(a) depends on. Measured AFTER, the same
      -- mutation is harmless and the concurrency suite stays green — the
      -- advisory lock serialises every allocator, so there is no contention
      -- left for SKIP LOCKED to skip past.
      --
      -- So this guard now protects against a combination rather than a single
      -- edit: narrowing the advisory lock to a per-window key (which step 3
      -- explicitly anticipates for a much larger venue) AND using SKIP LOCKED
      -- brings the deadlock straight back, and the concurrency suite would not
      -- warn you, because it cannot reproduce it while the venue-wide lock
      -- holds. Skipping to the next candidate is also simply the right answer
      -- if the suite row genuinely disappeared beneath us.
      if not found then
        continue;
      end if;

      -- Re-check inside the lock. In READ COMMITTED this statement takes a
      -- fresh snapshot after the lock was granted, so it sees the row a
      -- competitor committed while we were waiting.
      if not exists (
        select 1
          from public.suite_occupancy o
         where o.suite_id = v_candidate.candidate_suite_id
           and o.is_active
           and (o.expires_at is null or o.expires_at > v_now)
           and o.blocked_period && v_blocked
      ) then
        insert into public.suite_occupancy (
          suite_id,
          kind,
          status,
          experience_period,
          blocked_period,
          cleaning_buffer_minutes,
          expires_at,
          is_active
        )
        values (
          v_candidate.candidate_suite_id,
          'hold'::public.occupancy_kind,
          'active'::public.occupancy_status,
          v_experience,
          v_blocked,
          -- §7.1: the buffer lives ON THE ROW, never read back from settings at
          -- query time. Management changing the default applies to new
          -- bookings; existing ones keep the buffer they were sold with.
          p_buffer_minutes,
          v_expires_at,
          true
        )
        -- Only `id` is returned, and only because the database generates it.
        -- `returning suite_id` would be a SILENT bug: PL/pgSQL substitutes an
        -- unqualified identifier that matches a variable, and suite_id is an
        -- OUT parameter of this function, so it would return that variable's
        -- current value — null — instead of the column. `id` matches nothing.
        returning id into v_occupancy_id;

        v_suite_id  := v_candidate.candidate_suite_id;
        v_allocated := true;
      end if;

    exception
      when exclusion_violation or unique_violation then
        -- suite_occupancy_no_overlap did its job. This is the backstop firing,
        -- not an error path: something got between our lock and our insert, so
        -- this suite is gone and the next candidate is the answer. Not silent
        raise debug 'hold_suite: % lost the exclusion constraint race, next candidate',
          v_candidate.candidate_suite_id;
        v_allocated := false;
    end;

    if v_allocated then
      perform internal.write_audit(
        'allocate_suite_hold',
        'public.suite_occupancy',
        v_occupancy_id::text,
        null::jsonb,   -- no prior value: the row did not exist
        jsonb_build_object(
          'suite_id',                v_suite_id,
          'kind',                    'hold',
          'status',                  'active',
          'experience_from',         lower(v_experience),
          'experience_to',           upper(v_experience),
          'blocked_from',            lower(v_blocked),
          'blocked_to',              upper(v_blocked),
          'cleaning_buffer_minutes', p_buffer_minutes,
          'hold_minutes',            p_hold_minutes,
          'expires_at',              v_expires_at
        ),
        'Automatic allocation by fixed suite priority [§7.2, §7.3]'
      );

      occupancy_id := v_occupancy_id;
      suite_id     := v_suite_id;
      expires_at   := v_expires_at;
      return next;
      return;
    end if;
  end loop;

  -- ── 6. No suite available ─────────────────────────────────────────────────
  return;
end
$$;


comment on function public.hold_suite(timestamptz, integer, integer, integer) is
  'Allocate a free suite for the requested window and hold it [§7.3, §7.5]. '
  'One transaction. Expires stale holds by status first (INV-05, R-17), then '
  'walks suites in priority order taking a row lock on each, re-checking the '
  'conflict inside the lock and letting suite_occupancy_no_overlap act as the '
  'backstop (INV-02). Returns zero rows when nothing is free (R-32) and never '
  'returns a suite_number (INV-01). SECURITY DEFINER because the booking flow '
  'is unauthenticated: anon holds no INSERT grant on public.suite_occupancy '
  'and RLS would refuse it. It is therefore a privilege boundary reachable by '
  'anon, which is why it validates every input and does exactly one thing.';


revoke all on function public.hold_suite(timestamptz, integer, integer, integer) from public;

grant execute on function public.hold_suite(timestamptz, integer, integer, integer)
  to authenticated, service_role;
