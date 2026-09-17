begin;
select plan(109);

update public.suites set is_active = false;

insert into public.suites (suite_number, priority, status, is_active) values
  (9201, 9210, 'available', true),
  (9202, 9220, 'available', true),
  (9203, 9230, 'available', true);

insert into public.staff (id, email, full_name, role) values
  ('e1111111-1111-4111-8111-111111111111', 'op.reception@example.test',  'OP Reception',  'reception'),
  ('e2222222-2222-4222-8222-222222222222', 'op.management@example.test', 'OP Management', 'management'),
  ('e3333333-3333-4333-8333-333333333333', 'op.corrector@example.test',  'OP Corrector',  'reception');

insert into public.staff_permissions (staff_id, permission) values
  ('e3333333-3333-4333-8333-333333333333', 'correct_customer_record');

insert into public.message_templates (key, channel, is_active, is_marketing, subject, body) values
  ('booking_reminder', 'email', false, false, 'A reminder', 'You are booked in tomorrow.');

create temp table bk (label text primary key, id uuid);
grant all on bk to public;

create temp table cnt (label text primary key, occupancy_rows integer, audit_rows integer);
grant all on cnt to public;

create temp table moment (label text primary key, at timestamptz);
grant all on moment to public;

create temp view ops_rpc_names as
  select unnest(array[
    'record_arrival', 'check_in_booking', 'check_out_booking',
    'mark_late_arrival', 'mark_no_show', 'record_overrun',
    'set_suite_status', 'block_suite_period', 'release_suite_block',
    'preview_block_impact',
    'start_cleaning_task', 'assign_cleaning_task', 'confirm_cleaning_task',
    'create_task', 'update_task_status', 'assign_task',
    'open_alert', 'resolve_alert',
    'add_shift_note', 'hand_over_shift',
    'set_customer_warning',
    'queue_message', 'record_message_attempt'
  ]) as proname;
grant select on ops_rpc_names to public;

create temp view ops_audit_actions as
  select unnest(array[
    'record_arrival', 'check_in_booking', 'check_out_booking',
    'create_cleaning_task',
    'mark_late_arrival', 'mark_no_show', 'record_overrun',
    'set_suite_status', 'block_suite_period', 'release_suite_block',
    'start_cleaning_task', 'assign_cleaning_task', 'confirm_cleaning_task',
    'create_task', 'update_task_status', 'assign_task',
    'open_alert', 'resolve_alert',
    'add_shift_note', 'hand_over_shift',
    'set_customer_warning',
    'queue_message', 'record_message_attempt'
  ]) as action;
grant select on ops_audit_actions to public;



select has_function('public', 'record_arrival',       'arrival is recorded on its own [§9.2]');
select has_function('public', 'check_in_booking',     'check-in exists [§9.2]');
select has_function('public', 'check_out_booking',    'check-out exists [§9.2]');
select has_function('public', 'mark_no_show',         'the no-show exists [§9.2]');
select has_function('public', 'record_overrun',       'the overrun measurement exists [§7.6]');
select has_function('public', 'block_suite_period',   'the period block exists [§9.2, §10.3]');
select has_function('public', 'preview_block_impact', 'the §10.3 block preview exists');
select has_function('public', 'open_alert',           'alerts are opened by RPC [§9.3]');
select has_function('public', 'record_message_attempt',
  'a resend is a recorded attempt [§9.2, §11.5]');

select is(
  (select count(*)::int from pg_proc p join ops_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace),
  23,
  'twenty-three functions and no overloads — a stale caller cannot reach a '
  'second signature');

select is(
  (select count(*)::int from pg_proc p join ops_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace and p.prosecdef),
  23,
  'every one writes past RLS deliberately [R-15]');

select is(
  (select count(*)::int from pg_proc p join ops_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace
      and array_to_string(p.proconfig, ' ') = 'search_path=""'),
  23,
  'every one pins search_path to empty [R-15]');

select is(
  (select count(*)::int from pg_proc p join ops_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace
      and p.proretset and p.prorettype <> 'void'::regtype),
  23,
  'every one returns a typed row set and never void [R-14]');

select is(
  (select count(*)::int from pg_proc p join ops_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('anon', p.oid, 'execute')),
  0,
  'anon holds EXECUTE on none of them — operating the venue is a staff action '
  '[§13, docs/5 §3]');

select is(
  (select count(*)::int from pg_proc p join ops_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('authenticated', p.oid, 'execute')),
  23,
  'authenticated holds EXECUTE on all twenty-three [docs/5 §3]');

select is(
  (select count(*)::int from pg_proc p join ops_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('service_role', p.oid, 'execute')),
  23,
  'service_role holds EXECUTE — the §9.3 scan and the §12 queue worker have '
  'no user session');

select ok(
  not exists (
    select 1 from pg_proc p join ops_rpc_names n on n.proname = p.proname
     where p.pronamespace = 'public'::regnamespace
       and exists (
         select 1 from unnest(p.proargnames) an
          where an ilike '%suite_number%' and an like 'p\_%')),
  'no INPUT parameter is a suite number [INV-01]');

select is(
  (select p.provolatile::text from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'preview_block_impact'),
  's',
  'the §10.3 preview is STABLE — a dry run that could write is not a dry run');



set local role authenticated;
set local request.jwt.claims = '{"sub":"e1111111-1111-4111-8111-111111111111","email":"op.reception@example.test"}';

insert into bk (label, id)
select 'a', r.booking_id from public.create_reception_booking(
  'walk_in', 'mr', 'Omar', 'Stone', 'omar.stone@example.test',
  date '1990-05-05', '+971500002001', 'AE',
  timestamptz '2027-06-01 06:00:00+00', 3, 20,
  2, null, null, null, null, null, false, null, 'Desk booking') r;

select is(
  (select r.status::text
     from bk, lateral public.record_arrival(
       bk.id, timestamptz '2027-06-01 06:10:00+00', 'guest is at the desk') r
    where bk.label = 'a'),
  'confirmed',
  'recording an arrival does NOT move the status — ACTION_RESULT.record_arrival '
  'in src/lib/domain/booking is confirmed to null [§9.2]');

reset role;

select is(
  (select b.arrived_at from public.bookings b join bk on bk.id = b.id where bk.label = 'a'),
  timestamptz '2027-06-01 06:10:00+00',
  'and the actual arrival is stored as its own timestamp [§9.2]');

set local role authenticated;

select is(
  (select r.status::text || '|' || r.arrived_at::text || '|' || r.checked_in_at::text
     from bk, lateral public.check_in_booking(
       bk.id, timestamptz '2027-06-01 06:15:00+00', 'shown to the suite') r
    where bk.label = 'a'),
  'checked_in|2027-06-01 06:10:00+00|2027-06-01 06:15:00+00',
  'check-in moves confirmed to checked_in and keeps arrival and check-in as '
  'two distinct instants [§9.2]');

select throws_ok(
  $$select public.check_in_booking(
      (select id from bk where label = 'a'),
      timestamptz '2027-06-01 06:20:00+00', 'again')$$,
  'WP014', null,
  'checking in twice raises WP014 — the database agrees with '
  'ACTION_RESULT.check_in');

select throws_ok(
  $$select public.record_arrival(
      (select id from bk where label = 'a'),
      timestamptz '2027-06-01 06:30:00+00', 'again')$$,
  'WP014', null,
  'and an arrival cannot be recorded once the guest is checked in');

select is(
  (select r.late_arrival_minutes
     from bk, lateral public.mark_late_arrival(bk.id, 10, 'traffic on Business Bay') r
    where bk.label = 'a'),
  10,
  'a late arrival is stored in minutes and the status does not move [§9.2]');

select throws_ok(
  $$select public.mark_late_arrival(
      (select id from bk where label = 'a'), 10, '   ')$$,
  '22023', null,
  'a blank reason is refused — a late arrival carries a consequence for the '
  'guest [§3, INV-13]');

select is(
  (select r.status::text || '|' || r.checked_out_at::text
     from bk, lateral public.check_out_booking(
       bk.id, timestamptz '2027-06-01 09:06:00+00', 'guest left') r
    where bk.label = 'a'),
  'completed|2027-06-01 09:06:00+00',
  'check-out moves checked_in to completed [§9.2]');

select throws_ok(
  $$select public.check_out_booking(
      (select id from bk where label = 'a'),
      timestamptz '2027-06-01 09:10:00+00', 'again')$$,
  'WP014', null,
  'checking out twice raises WP014 — completed is terminal');

reset role;

select is(
  (select count(*)::int from public.cleaning_tasks t join bk on bk.id = t.booking_id
    where bk.label = 'a'),
  1,
  'check-out creates EXACTLY ONE cleaning task for the suite [§9.2]');

select is(
  (select t.due_from::text || '|' || t.status::text
     from public.cleaning_tasks t join bk on bk.id = t.booking_id where bk.label = 'a'),
  '2027-06-01 09:06:00+00|pending',
  'due_from is the CHECK-OUT INSTANT, not the end of the stored buffer — the '
  '§9.3 cleaning alert has to fire while there is still time to act [§7.1]');

select is(
  (select o.is_active::text || '|' || o.status::text || '|' || upper(o.blocked_period)::text
     from public.suite_occupancy o
     join public.bookings b on b.occupancy_id = o.id
     join bk on bk.id = b.id where bk.label = 'a'),
  'true|active|2027-06-01 09:20:00+00',
  'and the claim is NOT shortened by the check-out — §7.1 gives the buffer the '
  'job of protecting the next start, not the departing guest [INV-06]');

set local role authenticated;

select is(
  (select r.overrun_minutes::text || '|' || r.increment_minutes::text || '|' ||
          r.chargeable_increments::text || '|' || r.chargeable_minutes::text || '|' ||
          r.overrun_fils::text
     from bk, lateral public.record_overrun(
       bk.id, timestamptz '2027-06-01 09:01:00+00', 1833, 1417, 'regular_hourly',
       'guest stayed on') r
    where bk.label = 'a'),
  '1|5|1|5|3666',
  'one minute over is one COMMENCED five-minute increment, and two adults at '
  'AED 18.33 an increment are charged for the whole of it [§7.6, Q-21]');

select is(
  (select r.overrun_minutes::text || '|' || r.chargeable_increments::text || '|' ||
          r.chargeable_minutes::text || '|' || r.overrun_fils::text
     from bk, lateral public.record_overrun(
       bk.id, timestamptz '2027-06-01 09:06:00+00', 1833, 1417, 'regular_hourly',
       'and stayed on') r
    where bk.label = 'a'),
  '6|2|10|7332',
  'six minutes over is two — ceiling division, never rounding — and the charge '
  'doubles with the increments [§7.6]');

reset role;

select is(
  (select b.overrun_minutes from public.bookings b join bk on bk.id = b.id
    where bk.label = 'a'),
  6,
  'and the measured overrun is stored on the booking [§7.6]');

update public.settings set value = '10'::jsonb where key = 'overrun.increment_minutes';

set local role authenticated;

select is(
  (select r.increment_minutes::text || '|' || r.chargeable_increments::text || '|' ||
          r.chargeable_minutes::text || '|' || r.overrun_fils::text
     from bk, lateral public.record_overrun(
       bk.id, timestamptz '2027-06-01 09:06:00+00', 1833, 1417, 'regular_hourly',
       'recharged') r
    where bk.label = 'a'),
  '10|1|10|3666',
  'the increment is READ FROM public.settings and is never a literal — change '
  'overrun.increment_minutes and both the increments and the money change '
  '[R-05, INV-16]');

reset role;

update public.settings set value = '5'::jsonb where key = 'overrun.increment_minutes';


set local role authenticated;

insert into bk (label, id)
select 'b', r.booking_id from public.create_reception_booking(
  'walk_in', 'ms', 'Bea', 'Stone', 'bea.stone@example.test',
  date '1991-06-06', '+971500002002', 'AE',
  timestamptz '2027-06-02 06:00:00+00', 3, 20,
  2, null, null, null, null, null, false, null, 'First of three') r;

insert into bk (label, id)
select 'c', r.booking_id from public.create_reception_booking(
  'telephone', 'mr', 'Cyril', 'Stone', 'cyril.stone@example.test',
  date '1992-07-07', '+971500002003', 'AE',
  timestamptz '2027-06-02 06:00:00+00', 3, 20,
  2, null, null, null, null, null, false, null, 'Second of three') r;

insert into bk (label, id)
select 'd', r.booking_id from public.create_reception_booking(
  'manual', 'ms', 'Dana', 'Stone', 'dana.stone@example.test',
  date '1993-08-08', '+971500002004', 'AE',
  timestamptz '2027-06-02 06:00:00+00', 3, 20,
  2, null, null, null, null, null, false, null, 'Third of three') r;

select throws_ok(
  $$select public.create_reception_booking(
      'walk_in', 'mr', 'Eli', 'Stone', 'eli.stone@example.test',
      date '1994-09-09', '+971500002005', 'AE',
      timestamptz '2027-06-02 06:00:00+00', 3, 20,
      2, null, null, null, null, null, false, null, 'Fourth')$$,
  'WP010', null,
  'three bookings fill three suites and the fourth is refused [§7.5, INV-02]');

select is(
  (select r.status::text
     from bk, lateral public.mark_no_show(bk.id, 'guest never arrived') r
    where bk.label = 'b'),
  'no_show',
  'a confirmed booking can be marked a no-show [§9.2]');

reset role;

select is(
  (select o.status::text || '|' || o.is_active::text
     from public.suite_occupancy o
     join public.bookings b on b.occupancy_id = o.id
     join bk on bk.id = b.id where bk.label = 'b'),
  'released|false',
  'the claim is released BY STATUS and the row survives [R-17] — §11.3 reports '
  'on it and a delete destroys the only record');

set local role authenticated;

insert into bk (label, id)
select 'e', r.booking_id from public.create_reception_booking(
  'walk_in', 'mr', 'Eli', 'Stone', 'eli.stone@example.test',
  date '1994-09-09', '+971500002005', 'AE',
  timestamptz '2027-06-02 06:00:00+00', 3, 20,
  2, null, null, null, null, null, false, null, 'Took the freed suite') r;

reset role;

select is(
  (select count(*)::int from public.bookings b join bk on bk.id = b.id
    where bk.label = 'e'),
  1,
  'and the suite the no-show gave back is immediately allocatable again — the '
  'constraint decides, no cleanup job is involved [§7.5]');

select is(
  (select bb.suite_id from public.bookings bb join bk on bk.id = bb.id where bk.label = 'e'),
  (select bb.suite_id from public.bookings bb join bk on bk.id = bb.id where bk.label = 'b'),
  'on the very suite the no-show released');

set local role authenticated;

select throws_ok(
  $$select public.record_overrun(
      (select id from bk where label = 'c'),
      timestamptz '2027-06-02 10:00:00+00', 1833, 1417, 'regular_hourly',
      'never checked in')$$,
  'WP014', null,
  'an overrun cannot be recorded against a confirmed booking — '
  'ACTION_RESULT.record_overrun is checked_in and completed only');

reset role;



insert into cnt (label, occupancy_rows, audit_rows)
select 'before_preview',
       (select count(*)::int from public.suite_occupancy),
       (select count(*)::int from audit.entries);

set local role authenticated;

select is(
  (select count(*)::int
     from public.preview_block_impact(
       (select array_agg(s.id) from public.suites s where s.suite_number in (9201, 9202, 9203)),
       timestamptz '2027-06-02 06:30:00+00',
       timestamptz '2027-06-02 07:00:00+00')),
  3,
  'the §10.3 preview returns every claim a proposed block would collide with');

select is(
  (select array_agg(p.booking_reference order by p.booking_reference) is not null
      and count(p.booking_id)::int = 3
     from public.preview_block_impact(
       (select array_agg(s.id) from public.suites s where s.suite_number in (9201, 9202, 9203)),
       timestamptz '2027-06-02 06:30:00+00',
       timestamptz '2027-06-02 07:00:00+00') p),
  true,
  'and it names the bookings, so Management sees WHO it would strand before '
  'confirming [§10.3]');

select is(
  (select count(*)::int
     from public.preview_block_impact(
       (select array_agg(s.id) from public.suites s where s.suite_number in (9201, 9202, 9203)),
       timestamptz '2027-06-09 06:00:00+00',
       timestamptz '2027-06-09 07:00:00+00')),
  0,
  'a block over a free window collides with nothing');

select throws_ok(
  $$select public.preview_block_impact(array[]::uuid[],
      timestamptz '2027-06-09 06:00:00+00', timestamptz '2027-06-09 07:00:00+00')$$,
  '22023', null,
  'and it refuses an empty suite list exactly as public.block_suite_period does, '
  'so a preview cannot be run over a different set of suites from the block');

reset role;

select is(
  (select (select count(*)::int from public.suite_occupancy)::text || '|' ||
          (select count(*)::int from audit.entries)::text),
  (select c.occupancy_rows::text || '|' || c.audit_rows::text
     from cnt c where c.label = 'before_preview'),
  'THE PREVIEW WROTE NOTHING — not an occupancy row, not an audit entry [§10.3]');

select ok(
  not exists (select 1 from audit.entries e where e.action = 'preview_block_impact'),
  'a dry run has no change to audit [R-14]');


set local role authenticated;

select is(
  (select r.status::text || '|' || r.previous_status::text
     from public.suites s, lateral public.set_suite_status(
       s.id, 'maintenance', 'compressor service') r
    where s.suite_number = 9203),
  'maintenance|available',
  'Reception may take a suite out of service — docs/5 §3 reads "Block a suite '
  'or a period: reception yes", and no named permission is involved');

select throws_ok(
  $$select public.set_suite_status(
      (select id from public.suites where suite_number = 9203), 'available', '  ')$$,
  '22023', null,
  'a suite status change with no reason is refused — §9.2 wants a suite '
  'anybody at the desk can explain');

select throws_ok(
  $$select public.block_suite_period(
      (select array_agg(s.id) from public.suites s where s.suite_number in (9201, 9202)),
      timestamptz '2027-06-05 10:00:00+00', timestamptz '2027-06-05 12:00:00+00', '   ')$$,
  '22023', null,
  'A BLOCK WITHOUT A REASON IS REFUSED — §9.2 requires one and '
  'suite_occupancy_block_has_reason enforces it at database level');

select throws_ok(
  $$select public.block_suite_period(
      (select array_agg(s.id) from public.suites s where s.suite_number in (9201, 9202)),
      timestamptz '2027-06-05 12:00:00+00', timestamptz '2027-06-05 10:00:00+00', 'backwards')$$,
  '22023', null,
  'and a period that ends before it starts is refused');

select throws_ok(
  $$select public.block_suite_period(
      array['00000000-0000-4000-8000-000000000000'::uuid],
      timestamptz '2027-06-05 10:00:00+00', timestamptz '2027-06-05 12:00:00+00', 'ghost suite')$$,
  'P0002', null,
  'an unknown suite id is a caller defect and is raised on, never reported as '
  '"not blocked"');

select is(
  (select count(*) filter (where b.is_blocked)::int || '/' || count(*)::int
     from public.block_suite_period(
       (select array_agg(s.id) from public.suites s where s.suite_number in (9201, 9202, 9203)),
       timestamptz '2027-06-05 10:00:00+00',
       timestamptz '2027-06-05 12:00:00+00',
       'floor waxing') b),
  '3/3',
  'a period block claims all three suites, including the one in maintenance — '
  '§7.2''s override is about allocating a GUEST onto such a suite, and a block '
  'places nobody [docs/5 §2]');

select is(
  (select count(*) filter (where b.is_blocked)::int || '/' || count(*)::int
     from public.block_suite_period(
       (select array_agg(s.id) from public.suites s where s.suite_number in (9201, 9202, 9203)),
       timestamptz '2027-06-05 10:00:00+00',
       timestamptz '2027-06-05 12:00:00+00',
       'floor waxing again') b),
  '0/3',
  'blocking the same window twice REPORTS the collision on every suite rather '
  'than raising — a Management screen needs to know which ones collided [R-32]');

select is(
  (select r.status::text
     from public.suites s, lateral public.set_suite_status(
       s.id, 'available', 'service finished') r
    where s.suite_number = 9203),
  'available',
  'and the suite comes back into service by the same audited route');

reset role;

select is(
  (select count(*)::int from public.suite_occupancy o
    where o.kind = 'block' and o.is_active and o.reason = 'floor waxing'),
  3,
  'the block is three rows in public.suite_occupancy carrying their reason — '
  'one table holds every claim on suite time [§3, INV-02]');

set local role authenticated;

select is(
  (select r.status::text
     from public.suite_occupancy o, lateral public.release_suite_block(
       o.id, 'waxing cancelled') r
    where o.id = (select o2.id from public.suite_occupancy o2
                   join public.suites s on s.id = o2.suite_id
                  where o2.kind = 'block' and o2.is_active and s.suite_number = 9201)),
  'released',
  'releasing a block expires it by status [R-17]');

select throws_ok(
  $$select public.release_suite_block(
      (select o.id from public.suite_occupancy o
        join public.suites s on s.id = o.suite_id
       where o.kind = 'block' and not o.is_active and s.suite_number = 9201),
      'again')$$,
  'WP014', null,
  'releasing it twice raises WP014 rather than writing a second audit entry '
  'for a change that did not happen');

select throws_ok(
  $$select public.release_suite_block(
      (select b.occupancy_id from public.bookings b
        join bk on bk.id = b.id where bk.label = 'c'),
      'try to free a booking')$$,
  '22023', null,
  'and it refuses a booking claim — releasing one here would leave a confirmed '
  'booking silently without a suite, which is the §8.2 failure the design '
  'exists to prevent');

reset role;

select is(
  (select count(*)::int from public.suite_occupancy o
    where o.kind = 'block' and not o.is_active),
  1,
  'the released block row is still there, is_active false [R-17]');


insert into cnt (label, occupancy_rows, audit_rows)
select 'before_cleaning',
       (select count(*)::int from public.suite_occupancy where is_active),
       (select count(*)::int from audit.entries);

set local role authenticated;

select is(
  (select c.status::text || '|' || (c.started_at is not null)::text
     from public.cleaning_tasks t join bk on bk.id = t.booking_id,
          lateral public.start_cleaning_task(t.id) c
    where bk.label = 'a'),
  'in_progress|true',
  'starting a clean moves the status and stamps started_at together [§9.2]');

select throws_ok(
  $$select public.start_cleaning_task(
      (select t.id from public.cleaning_tasks t join bk on bk.id = t.booking_id
        where bk.label = 'a'))$$,
  'WP019', null,
  'starting it twice raises WP019 — §11 timings measure the first hands on the '
  'suite, not the last press');

select is(
  (select c.assigned_to::text
     from public.cleaning_tasks t join bk on bk.id = t.booking_id,
          lateral public.assign_cleaning_task(
            t.id, 'e1111111-1111-4111-8111-111111111111') c
    where bk.label = 'a'),
  'e1111111-1111-4111-8111-111111111111',
  'assignment is a column and not a state, so it does not move the status [§9.2]');

select is(
  (select c.status::text || '|' || c.confirmed_by::text
     from public.cleaning_tasks t join bk on bk.id = t.booking_id,
          lateral public.confirm_cleaning_task(t.id, '  suite is spotless  ') c
    where bk.label = 'a'),
  'confirmed|e1111111-1111-4111-8111-111111111111',
  'confirming records who confirmed it [§9.2]');

select throws_ok(
  $$select public.confirm_cleaning_task(
      (select t.id from public.cleaning_tasks t join bk on bk.id = t.booking_id
        where bk.label = 'a'), null)$$,
  'WP019', null,
  'confirming twice raises WP019');

reset role;

select is(
  (select count(*)::int from public.suite_occupancy where is_active),
  (select c.occupancy_rows from cnt c where c.label = 'before_cleaning'),
  'CONFIRMING A CLEAN TOUCHED NO OCCUPANCY ROW [Q-16]. §7.1 gives the cleaning '
  'buffer the job of protecting the next start, so the suite came free on the '
  'buffer and not on a human pressing confirm. Wiring this table into '
  'allocation would put a second source of truth beside the exclusion '
  'constraint [INV-02]');

select is(
  (select t.note from public.cleaning_tasks t join bk on bk.id = t.booking_id
    where bk.label = 'a'),
  'suite is spotless',
  'and the confirmation note is trimmed and kept [§9.2]');



set local role authenticated;

select is(
  (select t.status::text || '|' || t.priority::text || '|' || t.due_on::text
     from public.create_task(
       '  Reorder robes  ', 'six mediums', null, date '2027-06-10', null) t),
  'open|normal|2027-06-10',
  'a task starts open, defaults to normal priority so it does not shout, and '
  'takes a DATE due date [§10.6, R-16]');

select is(
  (select a.assigned_to::text || '|' || a.assigned_by::text
     from public.tasks t, lateral public.assign_task(
       t.id, 'e1111111-1111-4111-8111-111111111111') a
    where t.title = 'Reorder robes'),
  'e1111111-1111-4111-8111-111111111111|e1111111-1111-4111-8111-111111111111',
  'assigning names the individual user §10.6 requires and records who asked');

select is(
  (select u.status::text || '|' || (u.completed_at is not null)::text || '|' ||
          (u.completed_by is not null)::text
     from public.tasks t, lateral public.update_task_status(t.id, 'in_progress', null) u
    where t.title = 'Reorder robes'),
  'in_progress|false|false',
  'a task in progress carries no completion time — tasks_done_carries_time is '
  'honoured in both directions');

select is(
  (select u.status::text || '|' || (u.completed_at is not null)::text || '|' || u.note
     from public.tasks t, lateral public.update_task_status(t.id, 'done', 'ordered') u
    where t.title = 'Reorder robes'),
  'done|true|ordered',
  'and reaching done stamps the completion [§10.6]');

select throws_ok(
  $$select public.update_task_status(
      (select id from public.tasks where title = 'Reorder robes'), 'open', 'reopen')$$,
  'WP020', null,
  'a finished task cannot be moved again — §11 counting completions needs a '
  'completion to mean one thing');

select throws_ok(
  $$select public.assign_task(
      (select id from public.tasks where title = 'Reorder robes'),
      'e2222222-2222-4222-8222-222222222222')$$,
  'WP020', null,
  'nor reassigned');

select is(
  (select u.note
     from public.create_task('Restock tea', 'jasmine and mint', null, null, 'high') c,
          lateral public.update_task_status(c.task_id, 'in_progress', '   ') u),
  'jasmine and mint',
  'a blank note on a status change LEAVES the existing note alone — the caller '
  'is changing a status and should not have to resend a note to keep it');



set local role authenticated;

select is(
  (select a.is_new::text
     from bk, lateral public.open_alert(
       'arrival_overdue', 'warning', 'public.bookings', bk.id::text,
       '{"minutes":12}'::jsonb) a
    where bk.label = 'c'),
  'true',
  'an alert nobody has open is opened [§9.3]');

select is(
  (select a.is_new::text
     from bk, lateral public.open_alert(
       'arrival_overdue', 'warning', 'public.bookings', bk.id::text,
       '{"minutes":18}'::jsonb) a
    where bk.label = 'c'),
  'false',
  'OPENING THE SAME ALERT TWICE IS A NO-OP, not a 23505 — reconcileAlerts '
  'keys on kind:entity:entity_id and re-runs every minute, so an error here '
  'would fail the whole scan and lose every other alert in the pass');

reset role;

select is(
  (select count(*)::int from public.alerts a join bk on bk.id::text = a.entity_id
    where bk.label = 'c' and a.kind = 'arrival_overdue'),
  1,
  'and there is exactly one row, held by alerts_open_unique_idx');

set local role authenticated;

select is(
  (select (r.resolved_at is not null)::text || '|' || r.resolved_by::text
     from public.alerts a, lateral public.resolve_alert(a.id, 'guest arrived') r
    where a.resolved_at is null and a.kind = 'arrival_overdue'),
  'true|e1111111-1111-4111-8111-111111111111',
  'resolving records who resolved it [§9.3]');

select throws_ok(
  $$select public.resolve_alert(
      (select id from public.alerts where kind = 'arrival_overdue'
        and resolved_at is not null limit 1), 'again')$$,
  'WP023', null,
  'resolving twice raises WP023 — §11.5 reports how long an alert stayed open '
  'and a second close would overwrite the answer');

select is(
  (select a.is_new::text
     from bk, lateral public.open_alert(
       'arrival_overdue', 'warning', 'public.bookings', bk.id::text, null) a
    where bk.label = 'c'),
  'true',
  'RESOLVING AND THEN DETECTING IT AGAIN OPENS A SECOND ROW — the unique index '
  'is partial on resolved_at is null precisely so a recurrence is a new '
  'occurrence with its own opened_at, which is what §11.5 counts');

reset role;

select is(
  (select count(*)::int from public.alerts a join bk on bk.id::text = a.entity_id
    where bk.label = 'c' and a.kind = 'arrival_overdue'),
  2,
  'and now there are two');


set local role authenticated;

select is(
  (select n.shift_on::text || '|' || n.body || '|' || (n.handed_over_at is null)::text
     from public.add_shift_note(date '2027-06-02', '  Late delivery expected  ') n),
  '2027-06-02|Late delivery expected|true',
  'a shift note keeps its day and its author, and is not handed over yet [§9.2]');

select throws_ok(
  $$select public.add_shift_note(null, 'body')$$,
  '22004', null,
  'the operating day is required and is never guessed from the clock — storage '
  'is UTC and a Dubai day would be filed against yesterday for four hours '
  '[INV-24]');

select is(
  (select (h.handed_over_at is not null)::text
     from public.shift_notes sn, lateral public.hand_over_shift(sn.id) h),
  'true',
  'handing over stamps the note [§9.2]');

select throws_ok(
  $$select public.hand_over_shift((select id from public.shift_notes limit 1))$$,
  'WP024', null,
  'handing over twice raises WP024 — the first time is the one that happened');



insert into moment (label, at)
select 'customer_c', c.last_interaction_at
  from public.customers c where c.email = 'cyril.stone@example.test';

select lives_ok(
  $$select public.set_customer_warning(
      (select customer_id from public.bookings b
        join bk on bk.id = b.id where bk.label = 'c'),
      'watch this one', true, 'repeated damage')$$,
  'RECEPTION CORRECTS A CUSTOMER RECORD by role — perm:correct_customer_record '
  'is fixed to reception [Project owner''s direction, 17 September 2026]');

reset role;
set local request.jwt.claims = '{"sub":"e3333333-3333-4333-8333-333333333333","email":"op.corrector@example.test"}';
set local role authenticated;

select is(
  (select w.is_blocked::text || '|' || w.warning_note
     from public.customers c, lateral public.set_customer_warning(
       c.id, '  watch this one  ', true, 'repeated damage') w
    where c.email = 'cyril.stone@example.test'),
  'true|watch this one',
  'a reception account holding the explicit grant may — the permission is the '
  'boundary, not the role [docs/5 §2]');

select throws_ok(
  $$select public.set_customer_warning(
      (select id from public.customers where email = 'cyril.stone@example.test'),
      'x', false, '   ')$$,
  '22023', null,
  'and a blank reason is refused [§3, INV-13]');

reset role;
set local request.jwt.claims = '{"sub":"e2222222-2222-4222-8222-222222222222","email":"op.management@example.test"}';
set local role authenticated;

select is(
  (select w.is_blocked::text || '|' || coalesce(w.warning_note, 'cleared')
     from public.customers c, lateral public.set_customer_warning(
       c.id, null, null, 'note no longer applies') w
    where c.email = 'cyril.stone@example.test'),
  'true|cleared',
  'management holds the permission implicitly; a null note clears the warning '
  'while a null p_is_blocked LEAVES the blocked status alone — a boolean has no '
  'third value meaning unchanged');

reset role;

select is(
  (select c.last_interaction_at from public.customers c
    where c.email = 'cyril.stone@example.test'),
  (select m.at from moment m where m.label = 'customer_c'),
  'and last_interaction_at is the instant it was before the two corrections — '
  'INV-28 deletes personal data 24 months after the last interaction, and a '
  'staff edit is not the customer coming back');



set local request.jwt.claims = '{"sub":"e1111111-1111-4111-8111-111111111111","email":"op.reception@example.test"}';
set local role authenticated;

select is(
  (select m.status::text || '|' || m.is_marketing::text || '|' || m.channel::text
     from bk, lateral public.queue_message(
       'booking_confirmation', 'email', bk.id, null,
       'cyril.stone@example.test', 'Your booking', 'See you on Tuesday.') m
    where bk.label = 'c'),
  'queued|false|email',
  'a booking confirmation is queued and is NOT marketing [§12, INV-17]');

select is(
  (select m.is_marketing::text
     from bk, lateral public.queue_message(
       'review_request', 'email', bk.id, null,
       'cyril.stone@example.test', 'How was it?', 'Leave us a review.') m
    where bk.label = 'c'),
  'true',
  'and the review request is the one marketing template — is_marketing is '
  'computed here and never taken from the caller [INV-17]');

select throws_ok(
  $$select public.queue_message(
      'booking_reminder', 'email', null, null,
      'cyril.stone@example.test', 'A reminder', 'Tomorrow.')$$,
  'WP021', null,
  'an INACTIVE template is refused — §12 gives Management the active switch and '
  'queueing past it makes the switch a decoration');

select throws_ok(
  $$select public.queue_message(
      'booking_confirmation', 'whatsapp', null, null,
      '+971500002003', 'A subject', 'Body.')$$,
  '22023', null,
  'a WhatsApp message carrying a subject line is refused rather than having the '
  'subject silently dropped [§12]');

select throws_ok(
  $$select public.queue_message(
      'booking_confirmation', 'whatsapp', null, null,
      'cyril.stone@example.test', null, 'Body.')$$,
  '22023', null,
  'and an email address on the WhatsApp channel is refused [§12]');

select is(
  (select r.status::text || '|' || r.attempt_count::text || '|' ||
          (r.failed_at is not null)::text || '|' || (r.sent_at is null)::text
     from public.messages m, lateral public.record_message_attempt(
       m.id, 'failed', null, 'provider returned 500') r
    where m.template_key = 'booking_confirmation'),
  'failed|1|true|true',
  'a failed attempt is counted and stamped [§12, §11.5]');

select is(
  (select r.status::text || '|' || r.attempt_count::text || '|' ||
          (r.failed_at is null)::text || '|' || (r.sent_at is not null)::text
     from public.messages m, lateral public.record_message_attempt(
       m.id, 'sent', 'prov-abc', null) r
    where m.template_key = 'booking_confirmation'),
  'sent|2|true|true',
  'A SUCCESSFUL RETRY CLEARS failed_at. src/lib/domain/alerts raises '
  'message_failed on failedAt being non-null and reconcileAlerts resolves only '
  'when the scan stops detecting it — a failed_at kept as history would leave '
  'that alert open forever [§9.3]');

reset role;

select is(
  (select m.last_attempt_at is not null from public.messages m
    where m.template_key = 'booking_confirmation'),
  true,
  'and when it failed is still readable from last_attempt_at, which the retry '
  'does not clear');

set local role authenticated;

select is(
  (select r.attempt_count::text
     from public.messages m, lateral public.record_message_attempt(
       m.id, 'cancelled', null, null) r
    where m.template_key = 'review_request'),
  '0',
  'cancelling is administrative and does not count as a delivery attempt — the '
  '§11.5 retry count means calls to the provider');

select throws_ok(
  $$select public.record_message_attempt(
      (select id from public.messages where template_key = 'review_request'),
      'sent', 'prov-xyz', null)$$,
  'WP022', null,
  'and a cancelled message is not sent again [§12]');

reset role;


select is(
  (select array_agg(distinct e.action order by e.action)
     from audit.entries e join ops_audit_actions a on a.action = e.action),
  (select array_agg(a.action order by a.action) from ops_audit_actions a),
  'EVERY MUTATION WROTE ITS OWN AUDIT ENTRY — twenty-two functions plus the '
  'cleaning task check-out raises [R-14, INV-13]');

select ok(
  not exists (
    select 1 from audit.entries e join ops_audit_actions a on a.action = e.action
     where e.entity_id is null or e.reason is null or e.entity is null),
  'and not one was written without an entity, an entity id or a reason [§3]');

select ok(
  not exists (
    select 1 from audit.entries e join ops_audit_actions a on a.action = e.action
     where e.actor_id is null),
  'every desk action names its actor [INV-13]');



set local request.jwt.claims = '';
set local role anon;

select throws_ok(
  $$select public.record_arrival(
      '00000000-0000-4000-8000-000000000000', now(), 'because')$$,
  '42501', null,
  'anon cannot record an arrival');

select throws_ok(
  $$select public.check_out_booking(
      '00000000-0000-4000-8000-000000000000', now(), 'because')$$,
  '42501', null,
  'anon cannot check anybody out');

select throws_ok(
  $$select public.block_suite_period(
      array['00000000-0000-4000-8000-000000000000'::uuid],
      now(), now() + interval '1 hour', 'because')$$,
  '42501', null,
  'anon cannot block a suite');

select throws_ok(
  $$select public.preview_block_impact(
      array['00000000-0000-4000-8000-000000000000'::uuid],
      now(), now() + interval '1 hour')$$,
  '42501', null,
  'anon cannot even preview one — the preview returns suite numbers [INV-01]');

select throws_ok(
  $$select public.open_alert(
      'payment_failed', 'critical', 'public.bookings', 'x', null)$$,
  '42501', null,
  'anon cannot raise an alert');

select throws_ok(
  $$select public.queue_message(
      'booking_confirmation', 'email', null, null, 'a@b.co', 's', 'b')$$,
  '42501', null,
  'anon cannot queue a message');

select throws_ok(
  $$select public.set_customer_warning(
      '00000000-0000-4000-8000-000000000000', 'x', true, 'because')$$,
  '42501', null,
  'anon cannot touch a customer record');

reset role;


select * from finish();
rollback;
