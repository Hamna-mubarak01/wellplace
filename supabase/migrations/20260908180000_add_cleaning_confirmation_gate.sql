create or replace function internal.setting_boolean(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when s.value is null then null
    when jsonb_typeof(s.value) = 'boolean' then (s.value #>> '{}')::boolean
    when jsonb_typeof(s.value) = 'string' then nullif(btrim(s.value #>> '{}'), '')::boolean
    else null
  end
  from public.settings s
  where s.key = p_key
$$;

comment on function internal.setting_boolean(text) is
  'Read one §10.2 boolean setting [R-05], the sibling of internal.setting_integer and it follows the same contract: NULL means the client has not supplied this value yet, which SYSTEM.md Part 8 requires to be a working state rather than a blocked screen, so every caller applies its own documented fallback rather than refusing to run.

It exists because cleaning.confirm_gates_availability is read inside the allocation path and a switch that cannot be read is a switch that cannot be honoured. A jsonb string is accepted as well as a jsonb boolean because public.set_setting''s WP049 type guard is the writer''s check, not this reader''s, and a reader inside internal.allocate_suite must not be the thing that raises on a badly typed row.';

revoke all on function internal.setting_boolean(text)
  from public, anon, authenticated;


create or replace function internal.awaits_cleaning_confirmation(
  p_suite_id uuid,
  p_at       timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select t.status <> 'confirmed'::public.cleaning_status
       from public.cleaning_tasks t
      where t.suite_id = p_suite_id
        and t.due_from <= p_at
      order by t.due_from desc, t.created_at desc
      limit 1),
    false
  )
$$;

comment on function internal.awaits_cleaning_confirmation(uuid, timestamptz) is
  'Q-16, one predicate, one implementation. True when the suite''s MOST RECENT cleaning task falling due at or before p_at has not been confirmed [§9.2]. Read by internal.allocate_suite and by public.count_available_suites and by nothing else, and only when cleaning.confirm_gates_availability is true - the comment on internal.allocate_suite carries the switch, this function carries the question it asks.

MOST RECENT, not any. Cleaning is not cumulative: a confirmed clean at 18:20 says the suite is clean now whatever happened to the record of the 11:20 one, and a rule that read every open task would take a suite permanently out of allocation over one forgotten row three weeks ago. Ordering by due_from desc with created_at as the tie-break makes exactly one task decide, and confirming that one task returns the suite to allocation - which is the behaviour supercut4 [08:10-08:50] describes.

DUE AT OR BEFORE p_at, not simply open. A task raised for tonight''s checkout must not refuse a booking that starts this morning, because the suite is clean this morning. p_at is the START of the window being allocated, so the question asked is "was this suite left dirty before the moment this booking would begin", which is the only question the switch is about. The consequence for a window AFTER an unconfirmed task is deliberate and is the whole point: the suite does not come back until somebody confirms.

NO TASK AT ALL IS NOT AWAITING ANYTHING, so coalesce returns false and a suite that has never been used is allocatable. A gate that defaulted the other way would empty the venue the first time it was switched on.

public.cleaning_tasks carries a comment stating that nothing in the allocation path may read it. That was true, and was correct, until the client asked for both readings of Q-16 behind a switch; that comment is rewritten by this migration rather than left to contradict the code.';

revoke all on function internal.awaits_cleaning_confirmation(uuid, timestamptz)
  from public, anon, authenticated;


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
  v_cleaning_gates boolean;
begin
  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);

  v_now := clock_timestamp();

  v_expires_at := case
    when p_hold_minutes is null then null
    else v_now + (p_hold_minutes * interval '1 minute')
  end;

  perform internal.release_expired_occupancy();

  v_cleaning_gates := coalesce(
    internal.setting_boolean('cleaning.confirm_gates_availability'),
    false
  );

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
           and (
             not v_cleaning_gates
             or not internal.awaits_cleaning_confirmation(s.id, lower(p_blocked))
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
          'requested_suite_id',      p_suite_id,
          'cleaning_gates_availability', v_cleaning_gates
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

1. The venue-wide advisory lock is taken FIRST, before any other resource - before the clock is read, before the sweep, before the switch is read, before any suite is locked. Suite locks alone are not enough: §7.6 requires an atomic reschedule, which calls this twice in one transaction while still holding the first call''s suite locks, so the "one total order" argument fails at transaction scope. Advisory locks are re-entrant, so a re-entering caller already holds it. Allocation is therefore serialised venue-wide; for seven suites that is tens of milliseconds at twenty parallel attempts. Narrowing it to a per-window key for a much larger venue requires taking the keys in one sorted pass, or the deadlock returns.

2. The expiry sweep is GLOBAL and runs before any suite is locked. Since 20260908120000 it is one call to internal.release_expired_occupancy() rather than a statement written out here, so INV-05 has one implementation and cannot drift between the allocating callers and the in-place ones (public.extend_booking, public.override_booking_buffer). That function keeps the properties this one needs: global, one ordered sub-select for its row locks, clock_timestamp(), and no suite lock held while it runs. Narrowing it per candidate - here or there - would put an occupancy lock inside the suite-lock loop and reopen a deadlock the concurrency harness reproduces at twenty parallel attempts. This is INV-05: an expired hold stops blocking availability even when the cleanup cron is delayed.

3. clock_timestamp(), never now(), on both sides of the call. now() is transaction_timestamp(), fixed at BEGIN, so a caller that waited on the advisory lock would judge expiry against a stopped clock and answer "nothing free" with a suite genuinely free. v_now is read before the sweep, so every row the sweep marks inactive is also excluded by the candidate predicate''s is_active test; a row expiring in the microseconds between the two is swept, which is INV-05 answering slightly sooner rather than a suite wrongly refused.

4. The suite lock is BLOCKING. `for update skip locked` would let a caller skip every momentarily-locked suite and report no availability while suites were free. The `if not found then continue` guard exists because PERFORM does not raise when SKIP LOCKED skips - it only sets FOUND false - so without it a mutation to SKIP LOCKED would insert while holding no lock at all.

THE Q-16 CLEANING GATE, ADDED BY 20260908180000. cleaning.confirm_gates_availability decides which of the two readings of Q-16 the venue runs. FALSE, the default and the doc 1 reading, is exactly the behaviour that shipped before this migration: §7.1''s cleaning buffer is what protects the next start, the suite returns to availability when the buffer elapses, and public.cleaning_tasks is an operational record the allocator never reads. TRUE is the reading the client describes in supercut4 [08:10-08:50]: a suite whose most recent cleaning task due before the requested start has not been confirmed is not a candidate. internal.awaits_cleaning_confirmation asks that question and is the only place it is asked - public.count_available_suites reads the same helper, because a tile that offers a slot this function will refuse is a §7.4 defect.

THE SWITCH IS READ ONCE, before the candidate walk, and never per candidate. Two candidates judged against two reads of the same row could disagree inside one allocation, and the cost of the second read is not the point - the inconsistency is. It is read after the sweep so that the four properties above keep their order, and it is recorded on every allocation''s audit entry as cleaning_gates_availability so §11 can tell which rule was in force when a suite was taken, without inferring it from a settings row that has since been changed [INV-13].

p_allow_unavailable OPENS THE CLEANING GATE AS WELL AS THE FOUR STATUSES [OUR CHOICE, and it needs the same client answer as Q-16 itself]. §7.2''s override is written about status, and an unconfirmed clean is not a status, so this is an extension of it rather than a transcription. It is here because the gate can otherwise take a suite out of allocation with no way back except confirming a clean, and Reception at the desk needs a door - the same door, behind the same perm:override_suite_allocation, audited by the same entry. The guest flow can never reach it: public.hold_suite passes false.

p_allow_unavailable carries §7.2''s override: blocked, maintenance, not-ready and out-of-service suites are never allocated automatically, and the exception needs perm:override_suite_allocation from Reception AND Management alike. This function does not check that permission - the calling RPC does, because only the caller knows whether a human asked for the override.

p_hold_minutes, not an expires_at, is the parameter on purpose. The clock is read AFTER the advisory lock is granted, so a caller that queued behind another allocator still gets its full §7.3 ten minutes. Passing a timestamp computed by the caller would silently shorten every contended hold.

p_suite_id names one specific suite for §9.2''s calendar move. It still takes the lock, still re-checks inside it, and still lets suite_occupancy_no_overlap be the backstop (INV-02). A move is not exempt from the constraint.';


revoke all on function internal.allocate_suite(
  tstzrange, tstzrange, integer, public.occupancy_kind,
  integer, uuid, text, boolean, uuid
) from public, anon, authenticated;


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
  v_cleaning_gates boolean;
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

  v_cleaning_gates := coalesce(
    internal.setting_boolean('cleaning.confirm_gates_availability'),
    false
  );

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
      and (
        not v_cleaning_gates
        or not internal.awaits_cleaning_confirmation(s.id, lower(bw.blocked_period))
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


comment on function public.count_available_suites(timestamptz[], integer, integer) is
  'How many suites are free for each candidate start instant, for the §7.4 time tiles. READ-ONLY twin of internal.allocate_suite: same candidate predicate, same half-open periods, same clock_timestamp() expiry filter (INV-05), but no lock, no lazy expiry and no audit - a page view must not mutate the database. Never returns a suite id, a suite number or a total (INV-01). SECURITY DEFINER because the guest booking flow is unauthenticated and holds no read grant on public.suites.

SAME PREDICATE IS A PROMISE, NOT A DESCRIPTION. A tile that offers a slot the allocator will refuse is a §7.4 defect, so every change to the allocator''s candidate predicate is a change to this one in the same migration. That is why the Q-16 cleaning gate is here too: when cleaning.confirm_gates_availability is true, a suite whose most recent clean due before the instant is unconfirmed is not counted, exactly as it is not allocated. The switch is read ONCE per call for the reason internal.allocate_suite gives, so tile 1 and tile 60 of one grid cannot disagree about which rule was in force. There is no p_allow_unavailable here and there must never be one: the override is a Reception action taken by a named human with perm:override_suite_allocation, and a guest-facing count that quietly included overridable suites would offer a slot no unauthenticated caller can take.

ONE OUTPUT ROW PER INPUT ENTRY, IN INPUT ORDER, including entries whose answer is 0 and including duplicates - that is what `with ordinality` guarantees and it is the contract the caller depends on, because the service zips this result against its own tile list positionally and a dropped or reordered row would mislabel every tile after it. The LEFT JOIN is the other half of that promise: when no suite is allocatable at all, per_suite is empty for that ordinal and an inner join would silently drop the instant instead of reporting 0.

NOTHING IN THE SELECT LIST IS NAMED starts_at, remaining OR reduced_by_demand. Those three are OUT parameters and PL/pgSQL substitutes a variable for any unqualified identifier that matches one.

clock_timestamp(), NOT now(), captured ONCE. now() is transaction_timestamp() and stops at BEGIN, so anything that waited first judges expiry against a clock that stopped before the wait and a hold that ran out during it goes on blocking. One captured value keeps every instant in the array judged against the same moment.

reduced_by_demand IS TRUE ONLY when a hold or a booking is holding back a suite that would otherwise be allocatable. §7.4 permits "This time is booking up" only where the reduction is at least partly caused by confirmed bookings or active holds, so a block, a maintenance row and now an unconfirmed clean are all excluded BEFORE the demand test rather than inside it - dressing an operational decision up as scarcity is manufactured urgency and the contract forbids it outright. "At least one" is the contract''s own words; it is not a threshold and not a ratio.

THE 200-INSTANT CEILING IS A REQUEST-SIZE GUARD, NOT A BUSINESS RULE. It is not §10.2 configuration and no Management screen may edit it: it exists only so one call cannot ask for an unbounded cross join against every suite. A day of 15-minute starts is about 60 instants, so 200 is far above anything the booking flow legitimately builds. A caller needing more should page rather than raise it.';


comment on table public.cleaning_tasks is
  'A suite needs cleaning [§9.2]. Start, assign and confirm are the three '
  'actions §9.2 names, and this table records who did which and when. '
  'WHETHER THIS TABLE GATES AVAILABILITY IS NOW A SETTING, NOT A DECISION '
  'TAKEN HERE [Q-16, §7.1, §9.2]. Until 20260908180000 this comment said that '
  'nothing in the allocation path may read it, and gave doc 1''s reason: §7.1 '
  'is explicit that the cleaning buffer is what protects the next start, and '
  'public.suite_occupancy already blocks the buffered period through its '
  'exclusion constraint, so the suite returns to availability when the buffer '
  'elapses whether or not anybody has pressed confirm. supercut4 [08:10-08:50] '
  'records the client describing the opposite. The client has since asked for '
  'BOTH, behind a switch, so the sentence is now conditional: '
  'cleaning.confirm_gates_availability defaults to FALSE, which is the doc 1 '
  'reading and the behaviour that shipped, and when it is TRUE a suite whose '
  'most recent task due before a requested start is not confirmed is neither '
  'allocated by internal.allocate_suite nor counted by '
  'public.count_available_suites. '
  'EXACTLY TWO FUNCTIONS READ THIS TABLE FOR AVAILABILITY, and both ask '
  'internal.awaits_cleaning_confirmation rather than writing their own query, '
  'because a tile that offers a slot the allocator refuses is a §7.4 defect. '
  'Anything else in the allocation path that starts reading this table is a '
  'second source of truth beside the exclusion constraint and breaks INV-02''s '
  'guarantee that one table decides who holds a suite. '
  'An unconfirmed task raises the §9.3 cleaning_unconfirmed alert in both '
  'modes. Q-16 stays open until the client says which mode is the venue''s '
  'default; the switch is what lets them answer it on a screen rather than in '
  'a migration.';
