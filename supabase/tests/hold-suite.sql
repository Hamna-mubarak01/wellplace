
begin;
select plan(67);



update public.suites set is_active = false;

insert into public.suites (suite_number, priority, status, is_active) values
  (9001, 9010, 'available', true),
  (9002, 9020, 'available', true),
  (9003, 9030, 'available', true),
  (9004, 9040, 'available', true),
  (9005, 9050, 'available', true),
  (9006, 9060, 'available', true),
  (9007, 9070, 'available', true);



select has_function('public', 'hold_suite',
  'the allocating function exists [§7.3, §7.5]');

select is(
  (select pg_get_function_identity_arguments(p.oid) from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'hold_suite'),
  'p_starts_at timestamp with time zone, p_duration_hours integer, p_buffer_minutes integer, p_hold_minutes integer',
  'the signature is the 4-argument form and the NAMES are the contract [R-02]');

select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'hold_suite'),
  1,
  'exactly one overload exists — no second signature reachable by a stale caller');

select is(
  (select p.prosecdef from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'hold_suite'),
  true,
  'hold_suite is SECURITY DEFINER — the booking flow is unauthenticated [R-15]');

select is(
  (select array_to_string(p.proconfig, ' ') from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'hold_suite'),
  'search_path=""',
  'it pins search_path to empty, as every SECURITY DEFINER must [R-15]');

select is(
  (select p.proretset from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'hold_suite'),
  true,
  'it returns a SET, so "no suite available" can be zero rows [R-32]');

select is(
  (select array_to_string(array(
     select p.proargnames[i]
       from pg_proc p, generate_subscripts(p.proargnames, 1) i
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'hold_suite'
        and p.proargmodes[i] = 't'
      order by i), ',')),
  'occupancy_id,suite_id,expires_at',
  'the return columns are exactly occupancy_id, suite_id, expires_at — '
  'no suite_number, no capacity, no total [INV-01, §3]');

select ok(
  not exists (
    select 1
      from information_schema.parameters p
      join information_schema.routines r
        on r.specific_schema = p.specific_schema
       and r.specific_name   = p.specific_name
     where r.specific_schema = 'public'
       and r.routine_name    = 'hold_suite'
       and p.parameter_name ilike '%suite_number%'),
  'no parameter or return column of hold_suite is named suite_number [INV-01]');

select ok(
  not has_function_privilege('anon',
    (select p.oid from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'hold_suite'),
    'execute'),
  'anon holds NO execute privilege — withheld until the guest flow ships it '
  'together with a rate limiter [§13]');

select ok(
  has_function_privilege('authenticated',
    (select p.oid from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'hold_suite'),
    'execute'),
  'authenticated CAN execute it — Reception walk-ins use the same engine [§9.2, §1]');

select ok(
  has_function_privilege('service_role',
    (select p.oid from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'hold_suite'),
    'execute'),
  'service_role CAN execute it — §8.2 recovery re-allocates from the webhook '
  'handler, where no user session exists');

select is(
  (select array_to_string(array(
     select distinct a.grantee::regrole::text
       from pg_proc p
       cross join lateral aclexplode(p.proacl) a
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'hold_suite'
        and a.privilege_type = 'EXECUTE'
      order by 1), ',')),
  'authenticated,postgres,service_role',
  'the EXECUTE ACL is exactly those three — PUBLIC was revoked, so a future '
  'grant is a visible diff and not an inherited default [§13]');



select throws_ok(
  $$select * from public.hold_suite('2027-03-01 09:00+04'::timestamptz, 0, 20, 10)$$,
  'WP005', null,
  'a zero-hour duration raises WP005, it does not quietly allocate nothing');

select throws_ok(
  $$select * from public.hold_suite('2027-03-01 09:00+04'::timestamptz, -1, 20, 10)$$,
  'WP005', null,
  'a negative duration raises WP005 — tstzrange would otherwise be malformed');

select throws_ok(
  $$select * from public.hold_suite('2027-03-01 09:00+04'::timestamptz, null, 20, 10)$$,
  'WP005', null,
  'a null duration raises WP005, not a null-propagated silent no-op');

select throws_ok(
  $$select * from public.hold_suite('2027-03-01 09:00+04'::timestamptz, 2, -1, 10)$$,
  'WP006', null,
  'a negative buffer raises WP006 — it would break '
  'suite_occupancy_blocked_contains_experience with an opaque 23514');

select throws_ok(
  $$select * from public.hold_suite('2027-03-01 09:00+04'::timestamptz, 2, null, 10)$$,
  'WP006', null,
  'a null buffer raises WP006');

select throws_ok(
  $$select * from public.hold_suite('2027-03-01 09:00+04'::timestamptz, 2, 20, 0)$$,
  'WP007', null,
  'a zero-minute hold raises WP007 — it would expire before it was returned');

select throws_ok(
  $$select * from public.hold_suite('2027-03-01 09:00+04'::timestamptz, 2, 20, null)$$,
  'WP007', null,
  'a null hold window raises WP007');

select throws_ok(
  $$select * from public.hold_suite(null::timestamptz, 2, 20, 10)$$,
  '22004', null,
  'a null start raises 22004 null_value_not_allowed, not a bounds check [22004]');



update public.suites set is_active = (suite_number = 9001);

create temporary table hs_buffer as
  select * from public.hold_suite('2027-03-01 09:00+04'::timestamptz, 2, 20, 10);

select is((select count(*)::int from hs_buffer), 1,
  'a 09:00–11:00 experience with a 20-minute buffer allocates the free suite');

select is(
  (select h.suite_id from hs_buffer h),
  (select s.id from public.suites s where s.suite_number = 9001),
  'and it is the only active suite');

select is(
  (select lower(o.experience_period) from public.suite_occupancy o
     join hs_buffer h on h.occupancy_id = o.id),
  '2027-03-01 09:00+04'::timestamptz,
  'experience_period starts at the requested time');

select is(
  (select upper(o.experience_period) from public.suite_occupancy o
     join hs_buffer h on h.occupancy_id = o.id),
  '2027-03-01 11:00+04'::timestamptz,
  'experience_period ends 11:00 — what the guest bought');

select is(
  (select lower(o.blocked_period) from public.suite_occupancy o
     join hs_buffer h on h.occupancy_id = o.id),
  '2027-03-01 09:00+04'::timestamptz,
  'blocked_period starts with the experience — the buffer is added after, '
  'never before');

select is(
  (select upper(o.blocked_period) from public.suite_occupancy o
     join hs_buffer h on h.occupancy_id = o.id),
  '2027-03-01 11:20+04'::timestamptz,
  'an 11:00 finish with a 20-minute buffer blocks to 11:20 [INV-06, §7.1, §16.1]');

select ok(
  (select o.blocked_period @> o.experience_period from public.suite_occupancy o
     join hs_buffer h on h.occupancy_id = o.id),
  'blocked_period contains experience_period — what the suite loses always '
  'covers what the guest bought');

select is(
  (select o.cleaning_buffer_minutes from public.suite_occupancy o
     join hs_buffer h on h.occupancy_id = o.id),
  20,
  'the buffer is stored ON THE ROW, not read from settings at query time [§7.1]');

select ok(
  (select o.kind = 'hold' and o.status = 'active' and o.is_active
     from public.suite_occupancy o join hs_buffer h on h.occupancy_id = o.id),
  'the row is an active hold — kind, status and is_active agree [§4.2]');

select ok(
  (select h.expires_at from hs_buffer h)
    between now() + interval '10 minutes'
        and now() + interval '10 minutes' + interval '30 seconds',
  'expires_at is the requested hold window ahead of the moment allocation began [§7.3]');

select is(
  (select h.expires_at from hs_buffer h),
  (select o.expires_at from public.suite_occupancy o
     join hs_buffer h2 on h2.occupancy_id = o.id),
  'the returned expires_at is the one stored, so the guest countdown and the '
  'database cannot disagree');

select is(
  (select count(*)::int from
     public.hold_suite('2027-03-01 11:10+04'::timestamptz, 2, 20, 10)),
  0,
  'an 11:10 start is inside the 20-minute buffer — that suite is refused '
  '[INV-06, §7.1]');

create temporary table hs_touching as
  select * from public.hold_suite('2027-03-01 11:20+04'::timestamptz, 2, 20, 10);

select is((select count(*)::int from hs_touching), 1,
  'an 11:20 start is accepted — with half-open [) ranges, touching is not '
  'overlapping [INV-06]');

select is(
  (select t.suite_id from hs_touching t),
  (select h.suite_id from hs_buffer h),
  'and it lands on the SAME suite, back to back with the first hold');

select is(
  (select lower(o.blocked_period) from public.suite_occupancy o
     join hs_touching t on t.occupancy_id = o.id),
  '2027-03-01 11:20+04'::timestamptz,
  'the second block begins exactly where the first one ended');



select is(
  (select (value #>> '{}')::int from public.settings
    where key = 'cleaning.buffer_minutes'),
  20,
  'the configured default really is 20, so 45 below is demonstrably not it [§7.1]');

create temporary table hs_odd_buffer as
  select * from public.hold_suite('2027-03-02 09:00+04'::timestamptz, 2, 45, 10);

select is(
  (select o.cleaning_buffer_minutes from public.suite_occupancy o
     join hs_odd_buffer h on h.occupancy_id = o.id),
  45,
  'cleaning_buffer_minutes stores the 45 that was passed, not the 20 in '
  'settings [§7.1, R-05]');

select is(
  (select upper(o.blocked_period) from public.suite_occupancy o
     join hs_odd_buffer h on h.occupancy_id = o.id),
  '2027-03-02 11:45+04'::timestamptz,
  'and blocked_period is computed from that same 45 minutes');



update public.suites set is_active = (suite_number = 9001);

insert into public.suite_occupancy
  (id, suite_id, kind, status, experience_period, blocked_period,
   cleaning_buffer_minutes, expires_at, is_active)
select 'e0000001-0000-4000-8000-000000000001', s.id, 'hold', 'active',
       tstzrange('2027-03-03 08:00+04', '2027-03-03 12:00+04', '[)'),
       tstzrange('2027-03-03 08:00+04', '2027-03-03 12:20+04', '[)'),
       20, now() - interval '1 minute', true
from public.suites s where s.suite_number = 9001;

create temporary table hs_lazy as
  select * from public.hold_suite('2027-03-03 09:00+04'::timestamptz, 2, 20, 10);

select is((select count(*)::int from hs_lazy), 1,
  'the expired hold stops blocking and the suite is allocated, with no cleanup '
  'job having run [INV-05, §7.3]');

select is(
  (select l.suite_id from hs_lazy l),
  (select s.id from public.suites s where s.suite_number = 9001),
  'and it is the very suite the stale hold was sitting on');

select is(
  (select o.status::text from public.suite_occupancy o
    where o.id = 'e0000001-0000-4000-8000-000000000001'),
  'expired',
  'the stale row was flagged expired by the allocating transaction itself');

select is(
  (select o.is_active from public.suite_occupancy o
    where o.id = 'e0000001-0000-4000-8000-000000000001'),
  false,
  'and is_active follows the status, so it leaves the exclusion index [INV-02]');

select is(
  (select count(*)::int from public.suite_occupancy o
    where o.id = 'e0000001-0000-4000-8000-000000000001'),
  1,
  'the expired row is still PRESENT — expired by status, never deleted [R-17, §11.3]');

select is(
  (select count(*)::int from public.suite_occupancy o
     join public.suites s on s.id = o.suite_id
    where s.suite_number = 9001
      and o.blocked_period && tstzrange('2027-03-03 08:00+04', '2027-03-03 12:20+04', '[)')),
  2,
  'both rows coexist on the suite — one expired and inactive, one live. '
  'Nothing was reclaimed by deletion [R-17]');



update public.suites set is_active = (suite_number = 9001);

update public.suites set status = 'blocked' where suite_number = 9001;
select is((select count(*)::int from
    public.hold_suite('2027-04-01 09:00+04'::timestamptz, 2, 20, 10)), 0,
  'a blocked suite is never auto-allocated [INV-07, §7.2]');

update public.suites set status = 'maintenance' where suite_number = 9001;
select is((select count(*)::int from
    public.hold_suite('2027-04-02 09:00+04'::timestamptz, 2, 20, 10)), 0,
  'a suite in maintenance is never auto-allocated [INV-07, §7.2]');

update public.suites set status = 'not_ready' where suite_number = 9001;
select is((select count(*)::int from
    public.hold_suite('2027-04-03 09:00+04'::timestamptz, 2, 20, 10)), 0,
  'a not_ready suite is never auto-allocated [INV-07, §7.2]');

update public.suites set status = 'out_of_service' where suite_number = 9001;
select is((select count(*)::int from
    public.hold_suite('2027-04-04 09:00+04'::timestamptz, 2, 20, 10)), 0,
  'an out_of_service suite is never auto-allocated [INV-07, §7.2]');

update public.suites set status = 'available' where suite_number = 9001;
select is((select count(*)::int from
    public.hold_suite('2027-04-05 09:00+04'::timestamptz, 2, 20, 10)), 1,
  'an available suite IS allocatable [§7.2]');

update public.suites set status = 'checkout_hold' where suite_number = 9001;
select is((select count(*)::int from
    public.hold_suite('2027-04-06 09:00+04'::timestamptz, 2, 20, 10)), 1,
  'a suite in checkout_hold today IS still allocatable for a future window — '
  'the status describes now, not next week [§7.2]');

update public.suites set status = 'booked' where suite_number = 9001;
select is((select count(*)::int from
    public.hold_suite('2027-04-07 09:00+04'::timestamptz, 2, 20, 10)), 1,
  'a booked suite IS still allocatable for a non-overlapping window [§7.2]');

update public.suites set status = 'checked_in' where suite_number = 9001;
select is((select count(*)::int from
    public.hold_suite('2027-04-08 09:00+04'::timestamptz, 2, 20, 10)), 1,
  'a checked_in suite IS still allocatable for a future window [§7.2]');

update public.suites set status = 'cleaning' where suite_number = 9001;
select is((select count(*)::int from
    public.hold_suite('2027-04-09 09:00+04'::timestamptz, 2, 20, 10)), 1,
  'a suite being cleaned right now IS still allocatable for a future window [§7.2]');

update public.suites set is_active = true where suite_number between 9001 and 9007;
update public.suites set status = 'blocked'        where suite_number = 9001;
update public.suites set status = 'maintenance'    where suite_number = 9002;
update public.suites set status = 'not_ready'      where suite_number = 9003;
update public.suites set status = 'out_of_service' where suite_number = 9004;
update public.suites set status = 'available'      where suite_number between 9005 and 9007;

select is(
  (select h.suite_id from
     public.hold_suite('2027-04-15 09:00+04'::timestamptz, 2, 20, 10) h),
  (select s.id from public.suites s where s.suite_number = 9005),
  'the walk skips all four unavailable suites and allocates the next one by '
  'priority — it does not stop at the first refusal [INV-07, §7.2]');



update public.suites
   set is_active = true, status = 'available'
 where suite_number between 9001 and 9007;

do $$
declare i int;
begin
  for i in 1..7 loop
    perform 1 from public.hold_suite('2027-05-01 09:00+04'::timestamptz, 2, 20, 10);
  end loop;
end $$;

select is(
  (select count(distinct o.suite_id)::int from public.suite_occupancy o
     join public.suites s on s.id = o.suite_id
    where o.is_active
      and s.suite_number between 9001 and 9007
      and o.blocked_period && tstzrange('2027-05-01 09:00+04', '2027-05-01 11:20+04', '[)')),
  7,
  'seven sequential calls take seven DISTINCT suites — never the same one twice '
  '[INV-02]');

select is(
  (select count(*)::int from
     public.hold_suite('2027-05-01 09:00+04'::timestamptz, 2, 20, 10)),
  0,
  'the eighth call returns ZERO ROWS, not an exception — "Fully booked" is a '
  'result the booking flow renders [R-32, §7.4]');



create temporary table hs_audited as
  select * from public.hold_suite('2027-06-01 09:00+04'::timestamptz, 3, 25, 15);

select is(
  (select count(*)::int from audit.entries a
    where a.action = 'allocate_suite_hold'
      and a.entity = 'public.suite_occupancy'
      and a.entity_id = (select h.occupancy_id::text from hs_audited h)),
  1,
  'exactly one audit entry, with the right action and entity [INV-13, R-14]');

select is(
  (select (a.new_value ->> 'cleaning_buffer_minutes')::int from audit.entries a
    where a.entity_id = (select h.occupancy_id::text from hs_audited h)
      and a.action = 'allocate_suite_hold'),
  25,
  'new_value carries the buffer that was actually stored on the row [§7.1]');

select is(
  (select a.new_value ->> 'suite_id' from audit.entries a
    where a.entity_id = (select h.occupancy_id::text from hs_audited h)
      and a.action = 'allocate_suite_hold'),
  (select h.suite_id::text from hs_audited h),
  'new_value names the suite that was allocated');

select is(
  (select (a.new_value ->> 'hold_minutes')::int from audit.entries a
    where a.entity_id = (select h.occupancy_id::text from hs_audited h)
      and a.action = 'allocate_suite_hold'),
  15,
  'new_value carries the hold window, so §11.3 can report on it without '
  'recomputing from expires_at');

select ok(
  (select a.old_value is null from audit.entries a
    where a.entity_id = (select h.occupancy_id::text from hs_audited h)
      and a.action = 'allocate_suite_hold'),
  'old_value is NULL — there was no prior value, the row did not exist');

select ok(
  (select a.actor_id is null and a.actor_email is null and a.actor_role is null
     from audit.entries a
    where a.entity_id = (select h.occupancy_id::text from hs_audited h)
      and a.action = 'allocate_suite_hold'),
  'the actor is NULL for a guest hold — recorded, not refused [INV-13, §6.1]');

select is(
  (select a.reason from audit.entries a
    where a.entity_id = (select h.occupancy_id::text from hs_audited h)
      and a.action = 'allocate_suite_hold'),
  'Automatic suite allocation: fixed_priority [§7.2]',
  'the reason states which strategy chose the suite [INV-13, §3]');

create temporary table hs_audit_baseline as
  select count(*)::int as n from audit.entries where action = 'allocate_suite_hold';

update public.suites set is_active = false;

select is(
  (select count(*)::int from
     public.hold_suite('2027-06-02 09:00+04'::timestamptz, 2, 20, 10)),
  0,
  'with no suite to allocate the call returns zero rows [R-32]');

select is(
  (select count(*)::int from audit.entries where action = 'allocate_suite_hold'),
  (select n from hs_audit_baseline),
  'and it wrote NO audit entry — an audit row means something happened [INV-13]');



update public.suites
   set is_active = true, status = 'available'
 where suite_number between 9001 and 9007;

set local role anon;

select throws_ok(
  $$select * from public.hold_suite('2027-07-01 09:00+04'::timestamptz, 2, 20, 10)$$,
  '42501', null,
  'anon is refused at the privilege layer — the open door is closed until a '
  'rate limiter ships with the grant [§13]');

reset role;

set local role authenticated;

select is(
  (select count(*)::int from
     public.hold_suite('2027-07-01 09:00+04'::timestamptz, 2, 20, 10)),
  1,
  'authenticated can execute it end to end, not merely hold the grant — '
  'SECURITY DEFINER carries it past RLS on suite_occupancy [§9.2]');

reset role;


select * from finish();
rollback;
