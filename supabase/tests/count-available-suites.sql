
begin;
select plan(75);



update public.suites set is_active = false;

insert into public.suites (suite_number, priority, status, is_active) values
  (9001, 9010, 'available', true),
  (9002, 9020, 'available', true),
  (9003, 9030, 'available', true),
  (9004, 9040, 'available', true),
  (9005, 9050, 'available', true),
  (9006, 9060, 'available', true),
  (9007, 9070, 'available', true);

create or replace function pg_temp.reset_occupancy() returns void language sql as $fn$
  delete from public.suite_occupancy o
   using public.suites s
   where s.id = o.suite_id and s.suite_number between 9001 and 9007;
$fn$;



select has_function('public', 'count_available_suites',
  'the availability count exists [§7.4]');

select is(
  (select pg_get_function_identity_arguments(p.oid) from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'count_available_suites'),
  'p_starts_at timestamp with time zone[], p_duration_hours integer, p_buffer_minutes integer',
  'the signature is the 3-argument array form and the NAMES are the contract');

select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'count_available_suites'),
  1,
  'exactly one overload exists — no second signature reachable by a stale caller');

select is(
  (select p.prosecdef from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'count_available_suites'),
  true,
  'it is SECURITY DEFINER — the guest booking flow is unauthenticated [R-15]');

select is(
  (select array_to_string(p.proconfig, ' ') from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'count_available_suites'),
  'search_path=""',
  'it pins search_path to empty, as every SECURITY DEFINER must [R-15]');

select is(
  (select p.proretset from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'count_available_suites'),
  true,
  'it returns a SET — one row per candidate instant');

select is(
  (select p.provolatile from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'count_available_suites'),
  's'::"char",
  'it is declared STABLE, not volatile — a page view must not mutate the '
  'database, and expiring rows is hold_suite''s job');

select is(
  (select array_to_string(array(
     select p.proargnames[i]
       from pg_proc p, generate_subscripts(p.proargnames, 1) i
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'count_available_suites'
        and p.proargmodes[i] = 't'
      order by i), ',')),
  'starts_at,remaining,reduced_by_demand',
  'the return columns are exactly starts_at, remaining, reduced_by_demand — '
  'no suite id, no suite number, no total, no capacity [INV-01, §3]');

select is(
  (select count(*)::int
     from pg_proc p, generate_subscripts(p.proargnames, 1) i
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'count_available_suites'
      and p.proargmodes[i] = 't'),
  3,
  'it returns exactly three columns — nothing has been added alongside them');

select ok(
  not exists (
    select 1
      from information_schema.parameters p
      join information_schema.routines r
        on r.specific_schema = p.specific_schema
       and r.specific_name   = p.specific_name
     where r.specific_schema = 'public'
       and r.routine_name    = 'count_available_suites'
       and p.parameter_name ~* '(suite_number|suite_id|capacity|total)'),
  'no parameter or return column is named suite_id, suite_number, capacity or '
  'total — INV-01 is not a filter applied late, the value never enters the '
  'response [INV-01, §3]');

select ok(
  has_function_privilege('anon',
    (select p.oid from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'count_available_suites'),
    'execute'),
  'anon CAN execute it — the §6.1 guest flow draws §7.4 tiles with no account, '
  'and the grant shipped with its rate limiter [20260830210000]');

select ok(
  has_function_privilege('authenticated',
    (select p.oid from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'count_available_suites'),
    'execute'),
  'authenticated CAN execute it — Reception reads the same availability [§9.2, §1]');

select ok(
  has_function_privilege('service_role',
    (select p.oid from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'count_available_suites'),
    'execute'),
  'service_role CAN execute it — §8.2 recovery checks availability from the '
  'webhook handler, where no user session exists');

select is(
  (select array_to_string(array(
     select distinct a.grantee::regrole::text
       from pg_proc p
       cross join lateral aclexplode(p.proacl) a
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'count_available_suites'
        and a.privilege_type = 'EXECUTE'
      order by 1), ',')),
  'anon,authenticated,postgres,service_role',
  'the EXECUTE ACL is exactly those four — PUBLIC was revoked, so a future '
  'grant is a visible diff and not an inherited default [§13]');



select throws_ok(
  $$select * from public.count_available_suites(null::timestamptz[], 2, 20)$$,
  '22004', null,
  'a null array raises 22004 null_value_not_allowed');

select throws_ok(
  $$select * from public.count_available_suites(
      array['2027-03-01 09:00+04', null]::timestamptz[], 2, 20)$$,
  '22004', null,
  'a null INSIDE the array raises 22004 — it would otherwise report a free day '
  'as fully booked');

select throws_ok(
  $$select * from public.count_available_suites(
      array['2027-03-01 09:00+04', 'infinity']::timestamptz[], 2, 20)$$,
  '22004', null,
  'a non-finite instant raises 22004 — it produces an EMPTY experience period');

select throws_ok(
  $$select * from public.count_available_suites(
      array['2027-03-01 09:00+04']::timestamptz[], 0, 20)$$,
  'WP005', null,
  'a zero-hour duration raises WP005, the same code hold_suite raises');

select throws_ok(
  $$select * from public.count_available_suites(
      array['2027-03-01 09:00+04']::timestamptz[], null, 20)$$,
  'WP005', null,
  'a null duration raises WP005, not a null-propagated silent no-op');

select throws_ok(
  $$select * from public.count_available_suites(
      array['2027-03-01 09:00+04']::timestamptz[], 2, -1)$$,
  'WP006', null,
  'a negative buffer raises WP006, the same code hold_suite raises');

select throws_ok(
  $$select * from public.count_available_suites(
      array['2027-03-01 09:00+04']::timestamptz[], 2, null)$$,
  'WP006', null,
  'a null buffer raises WP006');

select throws_ok(
  $$select * from public.count_available_suites(
      (select array_agg('2027-05-01 00:00+04'::timestamptz + (n * interval '15 minutes'))
         from generate_series(1, 201) n), 2, 20)$$,
  'WP009', null,
  'more than 200 instants is refused — a request-size guard, not a business rule');

select is(
  (select count(*)::int from public.count_available_suites(
     (select array_agg('2027-05-01 00:00+04'::timestamptz + (n * interval '15 minutes'))
        from generate_series(1, 200) n), 2, 20)),
  200,
  'exactly 200 instants is accepted and answers all 200 — the guard is off by '
  'nobody');

select is(
  (select count(*)::int from public.count_available_suites(
     array[]::timestamptz[], 2, 20)),
  0,
  'an empty array returns zero rows rather than raising [R-32]');



select is(
  (select c.remaining from public.count_available_suites(
     array['2027-03-01 09:00+04']::timestamptz[], 2, 20) c),
  7,
  'seven free suites report remaining = 7 [§7.4]');

select is(
  (select c.reduced_by_demand from public.count_available_suites(
     array['2027-03-01 09:00+04']::timestamptz[], 2, 20) c),
  false,
  'and reduced_by_demand is false — nothing is holding anything back [§7.4]');



insert into public.suite_occupancy (
  suite_id, kind, status, experience_period, blocked_period,
  cleaning_buffer_minutes, expires_at, is_active)
select s.id, 'hold', 'active',
       tstzrange('2027-03-01 09:00+04', '2027-03-01 11:00+04', '[)'),
       tstzrange('2027-03-01 09:00+04', '2027-03-01 11:20+04', '[)'),
       20, now() + interval '10 minutes', true
  from public.suites s where s.suite_number = 9001;

select is(
  (select c.remaining from public.count_available_suites(
     array['2027-03-01 09:00+04']::timestamptz[], 2, 20) c),
  6,
  'an active hold overlapping the window takes one suite out — remaining = 6');

select is(
  (select c.reduced_by_demand from public.count_available_suites(
     array['2027-03-01 09:00+04']::timestamptz[], 2, 20) c),
  true,
  'and reduced_by_demand is TRUE — an active hold is real demand [§7.4]');



select is(
  (select c.remaining from public.count_available_suites(
     array['2027-03-01 11:10+04']::timestamptz[], 2, 20) c),
  6,
  'an 11:10 start is INSIDE the 20-minute buffer, so that suite is not '
  'available — remaining = 6 [INV-06, §7.1]');

select is(
  (select c.remaining from public.count_available_suites(
     array['2027-03-01 11:20+04']::timestamptz[], 2, 20) c),
  7,
  'an 11:20 start is free on that suite again — touching is not overlapping, '
  'and this is the §7.1 worked example [INV-06, §7.1, §16.1]');

select is(
  (select c.reduced_by_demand from public.count_available_suites(
     array['2027-03-01 11:20+04']::timestamptz[], 2, 20) c),
  false,
  'and 11:20 shows no demand — full availability means nothing was held back');

select is(
  (select c.remaining from public.count_available_suites(
     array['2027-03-01 11:00+04']::timestamptz[], 2, 20) c),
  6,
  'an 11:00 start still collides: the experience ended 11:00 but the SUITE is '
  'lost until 11:20 [§7.1]');

select is(
  (select c.remaining from public.count_available_suites(
     array['2027-03-01 11:00+04']::timestamptz[], 2, 0) c),
  6,
  'passing a zero buffer does NOT free the 11:00 start — the existing hold''s '
  '20 minutes are stored on its own row and are not re-read from the argument '
  '[§7.1, INV-06]');

select is(
  (select c.remaining from public.count_available_suites(
     array['2027-03-01 07:00+04']::timestamptz[], 2, 20) c),
  6,
  'a 07:00–09:00 experience runs into the 09:00 hold through its own buffer');

select is(
  (select c.remaining from public.count_available_suites(
     array['2027-03-01 06:00+04']::timestamptz[], 2, 20) c),
  7,
  'a 06:00–08:00 experience clears it entirely — 08:20 is before 09:00');

select is(
  (select c.remaining from public.count_available_suites(
     array['2027-03-01 07:00+04']::timestamptz[], 2, 0) c),
  7,
  'the same 07:00 start with a zero buffer clears the hold — p_buffer_minutes '
  'sizes the candidate window and is a parameter, not a literal [R-05]');



select pg_temp.reset_occupancy();

insert into public.suite_occupancy (
  suite_id, kind, status, experience_period, blocked_period,
  cleaning_buffer_minutes, expires_at, is_active)
select s.id, 'hold', 'active',
       tstzrange('2027-03-01 09:00+04', '2027-03-01 11:00+04', '[)'),
       tstzrange('2027-03-01 09:00+04', '2027-03-01 11:20+04', '[)'),
       20, now() - interval '1 minute', true
  from public.suites s where s.suite_number = 9001;

select is(
  (select c.remaining from public.count_available_suites(
     array['2027-03-01 09:00+04']::timestamptz[], 2, 20) c),
  7,
  'a hold whose expires_at has passed does not reduce remaining, even though '
  'nothing has swept it — INV-05 does not depend on the cron [§7.3]');

select is(
  (select c.reduced_by_demand from public.count_available_suites(
     array['2027-03-01 09:00+04']::timestamptz[], 2, 20) c),
  false,
  'and an expired hold is not demand either — it cannot make a free time look '
  'like it is booking up [§7.4]');

select ok(
  (select o.is_active and o.status = 'active'
     from public.suite_occupancy o
     join public.suites s on s.id = o.suite_id
    where s.suite_number = 9001),
  'and the expired row is untouched — is_active and status are as they were. '
  'Expiring rows is hold_suite''s job; a page view must not mutate the '
  'database [R-17]');



create temporary table cas_baseline as
  select
    (select count(*)::int from public.suite_occupancy) as occupancy_rows,
    (select count(*)::int from audit.entries)          as audit_rows;

select is(
  (select count(*)::int from public.count_available_suites(
     array['2027-03-01 09:00+04', '2027-03-01 12:00+04', '2027-03-01 15:00+04']::timestamptz[],
     2, 20)),
  3,
  'three instants answered, so the function definitely ran');

select is(
  (select count(*)::int from public.suite_occupancy),
  (select occupancy_rows from cas_baseline),
  'it wrote no occupancy row — not an insert, not an expiry, nothing');

select is(
  (select count(*)::int from audit.entries),
  (select audit_rows from cas_baseline),
  'and it wrote NO audit entry — reading availability is not a manual change '
  '[R-14, INV-13]');



select pg_temp.reset_occupancy();
update public.suites set status = 'maintenance' where suite_number = 9001;

select is(
  (select c.remaining from public.count_available_suites(
     array['2027-03-01 09:00+04']::timestamptz[], 2, 20) c),
  6,
  'a suite in maintenance is not allocatable, so remaining = 6 [§7.2]');

select is(
  (select c.reduced_by_demand from public.count_available_suites(
     array['2027-03-01 09:00+04']::timestamptz[], 2, 20) c),
  false,
  'and reduced_by_demand is FALSE — maintenance is not demand, and claiming '
  'otherwise is manufactured urgency [§7.4]');

update public.suites set status = 'available'  where suite_number = 9001;
update public.suites set status = 'blocked'    where suite_number = 9002;
update public.suites set status = 'not_ready'  where suite_number = 9003;
update public.suites set status = 'out_of_service' where suite_number = 9004;

select is(
  (select c.remaining from public.count_available_suites(
     array['2027-03-01 09:00+04']::timestamptz[], 2, 20) c),
  4,
  'blocked, not_ready and out_of_service are all excluded too — the four §7.2 '
  'statuses are never auto-allocated [§7.2, INV-07]');

select is(
  (select c.reduced_by_demand from public.count_available_suites(
     array['2027-03-01 09:00+04']::timestamptz[], 2, 20) c),
  false,
  'and none of the four sets reduced_by_demand [§7.4]');

update public.suites set status = 'available' where suite_number between 9001 and 9007;
update public.suites set status = 'cleaning'  where suite_number = 9002;
update public.suites set status = 'checked_in' where suite_number = 9003;

select is(
  (select c.remaining from public.count_available_suites(
     array['2027-03-01 09:00+04']::timestamptz[], 2, 20) c),
  7,
  'cleaning and checked_in describe the suite today and do not exclude it from '
  'a booking next March — remaining is still 7 [§7.2]');

update public.suites set status = 'available' where suite_number between 9001 and 9007;

update public.suites set is_active = false where suite_number = 9007;

select is(
  (select c.remaining from public.count_available_suites(
     array['2027-03-01 09:00+04']::timestamptz[], 2, 20) c),
  6,
  'an inactive suite is not counted [§7.2]');

select is(
  (select c.reduced_by_demand from public.count_available_suites(
     array['2027-03-01 09:00+04']::timestamptz[], 2, 20) c),
  false,
  'and an inactive suite is not demand either');

update public.suites set is_active = true where suite_number between 9001 and 9007;



select pg_temp.reset_occupancy();

insert into public.suite_occupancy (
  suite_id, kind, status, experience_period, blocked_period,
  cleaning_buffer_minutes, expires_at, is_active, reason)
select s.id, 'block', 'active',
       tstzrange('2027-03-01 09:00+04', '2027-03-01 11:00+04', '[)'),
       tstzrange('2027-03-01 09:00+04', '2027-03-01 11:00+04', '[)'),
       0, null, true, 'Held for a private event'
  from public.suites s where s.suite_number = 9001;

select is(
  (select c.remaining from public.count_available_suites(
     array['2027-03-01 09:00+04']::timestamptz[], 2, 20) c),
  6,
  'a block occupancy row takes the suite out of the window — remaining = 6');

select is(
  (select c.reduced_by_demand from public.count_available_suites(
     array['2027-03-01 09:00+04']::timestamptz[], 2, 20) c),
  false,
  'and a block is NOT demand — a §10.3 block is the venue''s own decision '
  '[§7.4, §10.3]');

insert into public.suite_occupancy (
  suite_id, kind, status, experience_period, blocked_period,
  cleaning_buffer_minutes, expires_at, is_active)
select s.id, 'maintenance', 'active',
       tstzrange('2027-03-01 09:00+04', '2027-03-01 11:00+04', '[)'),
       tstzrange('2027-03-01 09:00+04', '2027-03-01 11:00+04', '[)'),
       0, null, true
  from public.suites s where s.suite_number = 9002;

select is(
  (select c.remaining from public.count_available_suites(
     array['2027-03-01 09:00+04']::timestamptz[], 2, 20) c),
  5,
  'a maintenance occupancy row takes a second suite out — remaining = 5');

select is(
  (select c.reduced_by_demand from public.count_available_suites(
     array['2027-03-01 09:00+04']::timestamptz[], 2, 20) c),
  false,
  'and two non-demand rows still leave reduced_by_demand false — remaining '
  'alone can never be read as urgency [§7.4]');

insert into public.suite_occupancy (
  suite_id, kind, status, experience_period, blocked_period,
  cleaning_buffer_minutes, expires_at, is_active)
select s.id, 'booking', 'active',
       tstzrange('2027-03-01 09:00+04', '2027-03-01 11:00+04', '[)'),
       tstzrange('2027-03-01 09:00+04', '2027-03-01 11:20+04', '[)'),
       20, null, true
  from public.suites s where s.suite_number = 9003;

select is(
  (select c.remaining from public.count_available_suites(
     array['2027-03-01 09:00+04']::timestamptz[], 2, 20) c),
  4,
  'block + maintenance + booking leaves four suites');

select is(
  (select c.reduced_by_demand from public.count_available_suites(
     array['2027-03-01 09:00+04']::timestamptz[], 2, 20) c),
  true,
  'and ONE confirmed booking among them is enough — §7.4 says "at least '
  'partly caused by" [§7.4]');



select pg_temp.reset_occupancy();

insert into public.suite_occupancy (
  suite_id, kind, status, experience_period, blocked_period,
  cleaning_buffer_minutes, expires_at, is_active)
select s.id, 'hold', 'active',
       tstzrange('2027-04-01 15:00+04', '2027-04-01 17:00+04', '[)'),
       tstzrange('2027-04-01 15:00+04', '2027-04-01 17:20+04', '[)'),
       20, now() + interval '10 minutes', true
  from public.suites s where s.suite_number = 9001;

select is(
  (select array_agg(c.starts_at order by c.ord)
     from public.count_available_suites(
       array['2027-04-01 15:00+04', '2027-04-01 09:00+04',
             '2027-04-01 15:00+04', '2027-04-01 12:00+04']::timestamptz[], 2, 20)
     with ordinality as c(starts_at, remaining, reduced_by_demand, ord)),
  array['2027-04-01 15:00+04', '2027-04-01 09:00+04',
        '2027-04-01 15:00+04', '2027-04-01 12:00+04']::timestamptz[],
  'the output instants are the input array, in INPUT order, duplicate included '
  '— not sorted, not deduplicated');

select is(
  (select array_agg(c.remaining order by c.ord)
     from public.count_available_suites(
       array['2027-04-01 15:00+04', '2027-04-01 09:00+04',
             '2027-04-01 15:00+04', '2027-04-01 12:00+04']::timestamptz[], 2, 20)
     with ordinality as c(starts_at, remaining, reduced_by_demand, ord)),
  array[6, 7, 6, 7],
  'and each answer sits against its OWN instant — the duplicate 15:00 answers '
  '6 twice while 09:00 and 12:00 answer 7');

select is(
  (select array_agg(c.reduced_by_demand order by c.ord)
     from public.count_available_suites(
       array['2027-04-01 15:00+04', '2027-04-01 09:00+04',
             '2027-04-01 15:00+04', '2027-04-01 12:00+04']::timestamptz[], 2, 20)
     with ordinality as c(starts_at, remaining, reduced_by_demand, ord)),
  array[true, false, true, false],
  'and reduced_by_demand is per instant, never smeared across the batch');

update public.suites set is_active = false where suite_number between 9002 and 9007;

select is(
  (select count(*)::int from public.count_available_suites(
     array['2027-04-01 15:00+04', '2027-04-01 09:00+04']::timestamptz[], 2, 20)),
  2,
  'an instant with no availability at all still gets a row [§7.4, §9.5]');

select is(
  (select array_agg(c.remaining order by c.ord)
     from public.count_available_suites(
       array['2027-04-01 15:00+04', '2027-04-01 09:00+04']::timestamptz[], 2, 20)
     with ordinality as c(starts_at, remaining, reduced_by_demand, ord)),
  array[0, 1],
  'and it reports remaining = 0 rather than being dropped from the result');

select is(
  (select c.reduced_by_demand from public.count_available_suites(
     array['2027-04-01 15:00+04']::timestamptz[], 2, 20) c),
  true,
  'a fully booked instant caused by a hold still reports demand [§7.4]');

update public.suites set is_active = false where suite_number between 9001 and 9007;

select is(
  (select array_agg(c.remaining order by c.ord)
     from public.count_available_suites(
       array['2027-04-01 15:00+04', '2027-04-01 09:00+04']::timestamptz[], 2, 20)
     with ordinality as c(starts_at, remaining, reduced_by_demand, ord)),
  array[0, 0],
  'with NO allocatable suite in the venue every instant still answers 0 — the '
  'closed-venue case is a row, not an absence');

select is(
  (select c.reduced_by_demand from public.count_available_suites(
     array['2027-04-01 15:00+04']::timestamptz[], 2, 20) c),
  false,
  'and a venue with no suites shows no demand — there is nothing to be held '
  'back from');

update public.suites set is_active = true where suite_number between 9001 and 9007;



select pg_temp.reset_occupancy();

update public.suites set status = 'available' where suite_number between 9001 and 9007;
update public.suites set status = 'maintenance'    where suite_number = 9005;
update public.suites set status = 'blocked'        where suite_number = 9006;
update public.suites set status = 'out_of_service' where suite_number = 9007;

select is(
  (select c.remaining from public.count_available_suites(
     array['2027-09-01 09:00+04']::timestamptz[], 2, 20) c),
  4,
  'the tile promises four suites for this window');

create temporary table cas_walk as
  select 1 as attempt, count(*)::int as allocated
    from public.hold_suite('2027-09-01 09:00+04'::timestamptz, 2, 20, 10);
insert into cas_walk select 2, count(*)::int
  from public.hold_suite('2027-09-01 09:00+04'::timestamptz, 2, 20, 10);
insert into cas_walk select 3, count(*)::int
  from public.hold_suite('2027-09-01 09:00+04'::timestamptz, 2, 20, 10);
insert into cas_walk select 4, count(*)::int
  from public.hold_suite('2027-09-01 09:00+04'::timestamptz, 2, 20, 10);
insert into cas_walk select 5, count(*)::int
  from public.hold_suite('2027-09-01 09:00+04'::timestamptz, 2, 20, 10);

select is(
  (select sum(w.allocated)::int from cas_walk w where w.attempt <= 4),
  4,
  'and hold_suite allocates exactly four times — the promise is kept [§7.4, §7.5]');

select is(
  (select w.allocated from cas_walk w where w.attempt = 5),
  0,
  'the fifth attempt returns zero rows — it runs out at exactly the number the '
  'tile promised, not one earlier or later [R-32]');

select is(
  (select c.remaining from public.count_available_suites(
     array['2027-09-01 09:00+04']::timestamptz[], 2, 20) c),
  0,
  'and the tile now reports 0 — remaining = 0 means hold_suite WILL refuse');

select is(
  (select c.reduced_by_demand from public.count_available_suites(
     array['2027-09-01 09:00+04']::timestamptz[], 2, 20) c),
  true,
  'with the shortfall reported as demand — four live holds caused it, and the '
  'three §7.2 suites did not [§7.4]');

select is(
  (select c.remaining from public.count_available_suites(
     array['2027-09-01 11:20+04']::timestamptz[], 2, 20) c),
  4,
  'the window starting exactly at the end of the buffer promises four again');

select is(
  (select count(*)::int from
     public.hold_suite('2027-09-01 11:20+04'::timestamptz, 2, 20, 10)),
  1,
  'and hold_suite allocates there — remaining > 0 means it succeeds [INV-06]');

select is(
  (select c.remaining from public.count_available_suites(
     array['2027-09-01 11:20+04']::timestamptz[], 2, 20) c),
  3,
  'after which the tile immediately reports one fewer — one availability '
  'source, read the same way by both functions [§1]');

select pg_temp.reset_occupancy();
update public.suites set status = 'maintenance' where suite_number between 9001 and 9007;

select is(
  (select c.remaining from public.count_available_suites(
     array['2027-10-01 09:00+04']::timestamptz[], 2, 20) c),
  0,
  'with every suite in maintenance the tile promises nothing [§7.2]');

select is(
  (select count(*)::int from
     public.hold_suite('2027-10-01 09:00+04'::timestamptz, 2, 20, 10)),
  0,
  'and hold_suite allocates nothing — the two agree on §7.2 as well as on '
  'occupancy [INV-07]');



select pg_temp.reset_occupancy();
update public.suites set status = 'available' where suite_number between 9001 and 9007;

set local role anon;

select is(
  (select c.remaining from public.count_available_suites(
     array['2027-11-01 09:00+04']::timestamptz[], 2, 20) c),
  7,
  'anon executes it end to end — SECURITY DEFINER carries it past the missing '
  'read grant on public.suites, and the answer matches the staff answer [§1]');

reset role;

set local role authenticated;

select is(
  (select c.remaining from public.count_available_suites(
     array['2027-11-01 09:00+04']::timestamptz[], 2, 20) c),
  7,
  'authenticated can execute it end to end, not merely hold the grant — '
  'SECURITY DEFINER carries it past RLS on public.suites [§9.2]');

reset role;


select * from finish();
rollback;
