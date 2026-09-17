begin;
select plan(12);

create temp view allocator_source as
  select
    (select p.prosrc from pg_proc p
      where p.pronamespace = 'internal'::regnamespace
        and p.proname = 'allocate_suite')            as allocate_suite,
    (select p.prosrc from pg_proc p
      where p.pronamespace = 'internal'::regnamespace
        and p.proname = 'release_expired_occupancy') as release_expired;
grant select on allocator_source to public;


select has_function('internal', 'release_expired_occupancy',
  'the lazy expiry sweep exists as a function of its own [INV-05]');

select ok(
  (select allocate_suite like '%internal.release_expired_occupancy()%'
     from allocator_source),
  'internal.allocate_suite CALLS it rather than carrying its own copy — the '
  'debt recorded in docs/adr/0001-one-allocator.md, paid by 20260908120000');

select is(
  (select length(allocate_suite)
        - length(replace(allocate_suite, 'expires_at <=', ''))
     from allocator_source),
  0,
  'and no second copy of the sweep predicate survives inside the allocator, '
  'so INV-05 has exactly one implementation');

select ok(
  (select position('pg_advisory_xact_lock' in allocate_suite) > 0
      and position('pg_advisory_xact_lock' in allocate_suite)
        < position('internal.release_expired_occupancy()' in allocate_suite)
     from allocator_source),
  'PROPERTY 1: the venue-wide advisory lock is taken BEFORE the sweep. §7.6 '
  'calls the allocator twice in one transaction while holding the first '
  'call''s suite locks, so suite locks alone give no total order');

select ok(
  (select position('internal.release_expired_occupancy()' in allocate_suite)
        < position('for v_candidate in' in allocate_suite)
     from allocator_source),
  'PROPERTY 2: the sweep runs BEFORE the candidate loop, so no occupancy lock '
  'is ever taken inside the suite-lock loop — the deadlock the concurrency '
  'harness reproduces at twenty parallel attempts');

select ok(
  (select release_expired not like '%suite_id%' from allocator_source),
  'and the sweep is GLOBAL: it carries no suite predicate at all. Narrowing '
  'it per candidate is the change this test exists to refuse');

select ok(
  (select release_expired like '%order by e.id%'
      and release_expired like '%for update%'
     from allocator_source),
  'it takes its row locks through ONE ordered sub-select, which is what makes '
  'two concurrent sweeps lock in the same order');

select ok(
  (select allocate_suite like '%clock_timestamp()%'
      and release_expired like '%clock_timestamp()%'
     from allocator_source),
  'PROPERTY 3: both read clock_timestamp()');

select is(
  (select (length(allocate_suite) - length(replace(allocate_suite, 'now()', '')))
        + (length(release_expired) - length(replace(release_expired, 'now()', '')))
     from allocator_source),
  0,
  'and neither reads now(). now() is transaction_timestamp(), fixed at BEGIN, '
  'so a caller that queued on the advisory lock would judge expiry against a '
  'stopped clock and answer "nothing free" with a suite genuinely free');

select ok(
  (select position('v_now := clock_timestamp()' in allocate_suite)
        < position('internal.release_expired_occupancy()' in allocate_suite)
     from allocator_source),
  'v_now is read BEFORE the sweep, so every row the sweep marks inactive is '
  'also excluded by the candidate predicate''s own is_active test');

select is(
  (select (length(allocate_suite) - length(replace(allocate_suite, 'skip locked', '')))
        + (length(release_expired) - length(replace(release_expired, 'skip locked', '')))
     from allocator_source),
  0,
  'PROPERTY 4: neither uses SKIP LOCKED. It would let a caller skip every '
  'momentarily-locked suite and report no availability while suites were free');

select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'internal'::regnamespace
      and p.proname = 'release_expired_occupancy'
      and (has_function_privilege('anon', p.oid, 'execute')
        or has_function_privilege('authenticated', p.oid, 'execute'))),
  0,
  'no client role can call the sweep directly — expiry is something the '
  'allocating transaction does, never something a caller asks for');


select * from finish();
rollback;
