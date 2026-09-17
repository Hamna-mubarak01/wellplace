

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

  perform internal.release_expired_occupancy();

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

1. The venue-wide advisory lock is taken FIRST, before any other resource - before the clock is read, before the sweep, before any suite is locked. Suite locks alone are not enough: §7.6 requires an atomic reschedule, which calls this twice in one transaction while still holding the first call''s suite locks, so the "one total order" argument fails at transaction scope. Advisory locks are re-entrant, so a re-entering caller already holds it. Allocation is therefore serialised venue-wide; for seven suites that is tens of milliseconds at twenty parallel attempts. Narrowing it to a per-window key for a much larger venue requires taking the keys in one sorted pass, or the deadlock returns.

2. The expiry sweep is GLOBAL and runs before any suite is locked. Since 20260908120000 it is one call to internal.release_expired_occupancy() rather than a statement written out here, so INV-05 has one implementation and cannot drift between the allocating callers and the in-place ones (public.extend_booking, public.override_booking_buffer). That function keeps the properties this one needs: global, one ordered sub-select for its row locks, clock_timestamp(), and no suite lock held while it runs. Narrowing it per candidate - here or there - would put an occupancy lock inside the suite-lock loop and reopen a deadlock the concurrency harness reproduces at twenty parallel attempts. This is INV-05: an expired hold stops blocking availability even when the cleanup cron is delayed.

3. clock_timestamp(), never now(), on both sides of the call. now() is transaction_timestamp(), fixed at BEGIN, so a caller that waited on the advisory lock would judge expiry against a stopped clock and answer "nothing free" with a suite genuinely free. v_now is read before the sweep, so every row the sweep marks inactive is also excluded by the candidate predicate''s is_active test; a row expiring in the microseconds between the two is swept, which is INV-05 answering slightly sooner rather than a suite wrongly refused.

4. The suite lock is BLOCKING. `for update skip locked` would let a caller skip every momentarily-locked suite and report no availability while suites were free. The `if not found then continue` guard exists because PERFORM does not raise when SKIP LOCKED skips - it only sets FOUND false - so without it a mutation to SKIP LOCKED would insert while holding no lock at all.

p_allow_unavailable carries §7.2''s override: blocked, maintenance, not-ready and out-of-service suites are never allocated automatically, and the exception needs perm:override_suite_allocation from Reception AND Management alike. This function does not check that permission - the calling RPC does, because only the caller knows whether a human asked for the override.

p_hold_minutes, not an expires_at, is the parameter on purpose. The clock is read AFTER the advisory lock is granted, so a caller that queued behind another allocator still gets its full §7.3 ten minutes. Passing a timestamp computed by the caller would silently shorten every contended hold.

p_suite_id names one specific suite for §9.2''s calendar move. It still takes the lock, still re-checks inside it, and still lets suite_occupancy_no_overlap be the backstop (INV-02). A move is not exempt from the constraint.';


comment on function internal.release_expired_occupancy() is
  'The lazy expiry sweep, INV-05. The single implementation, for every caller: internal.allocate_suite calls it before it looks at a candidate suite, and public.extend_booking and public.override_booking_buffer call it because they change an existing claim in place and never reach an allocator.

The exclusion constraint suite_occupancy_no_overlap knows nothing about expires_at, because its predicate cannot call now(). An expired hold is therefore still inside the constraint until something marks it inactive, and an extension that overlaps one would be refused with WP015 for a slot that is genuinely free. Availability reads already filter expires_at > now(); an in-place UPDATE cannot, so it sweeps first.

Three properties must survive any edit, and internal.allocate_suite''s comment depends on them: the sweep is GLOBAL, it takes its row locks through one ordered sub-select, and it runs while the caller holds no suite lock. Narrowing it per suite would put an occupancy lock inside a suite-lock loop and reopen the deadlock the concurrency harness reproduces at twenty parallel attempts. Every caller takes the venue-wide advisory lock first, so a sweep never interleaves with an allocation. clock_timestamp(), never now(), for the reason internal.allocate_suite gives: a caller that queued on the advisory lock would otherwise judge expiry against a clock stopped at BEGIN.

The duplicate copy that internal.allocate_suite ran inline was removed by migration 20260908120000, which pays the debt recorded in docs/adr/0001-one-allocator.md. Nothing about this function may be narrowed to one suite without reading that ADR first.';


revoke all on function internal.allocate_suite(
  tstzrange, tstzrange, integer, public.occupancy_kind,
  integer, uuid, text, boolean, uuid
) from public, anon, authenticated;

revoke all on function internal.release_expired_occupancy()
  from public, anon, authenticated;
