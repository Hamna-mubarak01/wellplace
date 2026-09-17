begin;
select plan(15);

update public.suites set is_active = false;

insert into public.suites (suite_number, priority, status, is_active) values
  (9701, 9710, 'available', true),
  (9702, 9720, 'available', true);

insert into public.staff (id, email, full_name, role) values
  ('a7111111-1111-4111-8111-111111111111', 'overrun.reception@example.test',
   'Overrun Reception', 'reception');

create temp table ov (label text primary key, id uuid);
grant all on ov to public;

select has_column('public', 'bookings', 'overrun_fils',
  'the charged overrun is stored beside the rest of the priced breakdown [§7.6, §11.2, Q-21]');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a7111111-1111-4111-8111-111111111111","email":"overrun.reception@example.test"}';

insert into ov (label, id)
select 'mixed', r.booking_id from public.create_reception_booking(
  'walk_in', 'mr', 'Owen', 'Ridge', 'owen.ridge@example.test',
  date '1990-03-03', '+971500007001', 'AE',
  timestamptz '2027-07-01 06:00:00+00', 2, 20,
  2, array[11], null, null, null,
  '{"subtotal_fils":66000,"total_fils":66000}'::jsonb,
  false, null, 'Two adults and one child') r;

select is(
  (select r.status::text
     from ov, lateral public.check_in_booking(
       ov.id, timestamptz '2027-07-01 06:05:00+00', 'shown to the suite') r
    where ov.label = 'mixed'),
  'checked_in',
  'the fixture is checked in, which is where §7.6 can be measured from');

select is(
  (select r.overrun_minutes::text || '|' || r.chargeable_increments::text || '|' ||
          r.overrun_fils::text
     from ov, lateral public.record_overrun(
       ov.id, timestamptz '2027-07-01 08:00:00+00', 1833, 1417, 'regular_hourly',
       'left exactly on time') r
    where ov.label = 'mixed'),
  '0|0|0',
  'leaving on the scheduled minute is not an overrun, and zero increments cost '
  'zero — a figure, not a gap [§7.6]');

select is(
  (select r.overrun_minutes::text || '|' || r.chargeable_increments::text || '|' ||
          r.overrun_fils::text
     from ov, lateral public.record_overrun(
       ov.id, timestamptz '2027-07-01 08:01:00+00', 1833, 1417, 'regular_hourly',
       'guest lingered') r
    where ov.label = 'mixed'),
  '1|1|5083',
  'ONE MINUTE OVER COSTS ONE WHOLE COMMENCED INCREMENT, and a mixed party is '
  'priced per guest at its own rate: 2 x 1833 + 1 x 1417 [§7.6, Q-21]');

select is(
  (select r.chargeable_increments::text || '|' || r.overrun_fils::text
     from ov, lateral public.record_overrun(
       ov.id, timestamptz '2027-07-01 08:06:00+00', 1833, 1417, 'regular_hourly',
       'and lingered further') r
    where ov.label = 'mixed'),
  '2|10166',
  'six minutes over is two commenced increments and twice the money — ceiling '
  'division, never rounding [§7.6]');

select is(
  (select r.rate_source || '|' || r.overrun_fils::text
     from ov, lateral public.record_overrun(
       ov.id, timestamptz '2027-07-01 08:01:00+00', 2500, 2500, 'fixed',
       'billed at the fixed overrun rate') r
    where ov.label = 'mixed'),
  'fixed|7500',
  'the fixed reading of Q-21 is reachable without a code change: three guests, '
  'one increment, one rate [§7.6, overrun.rate_source]');

select is(
  (select r.overrun_minutes::text || '|' || coalesce(r.overrun_fils::text, 'null')
     from ov, lateral public.record_overrun(
       ov.id, timestamptz '2027-07-01 08:06:00+00', null, null, null,
       'measured, not priced') r
    where ov.label = 'mixed'),
  '6|null',
  'an overrun recorded with no rate keeps the minutes and returns null money — '
  'not a zero, which would understate §11.2 revenue silently [INV-21]');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a7111111-1111-4111-8111-111111111111","email":"overrun.reception@example.test"}';

select is(
  (select r.overrun_fils
     from ov, lateral public.record_overrun(
       ov.id, timestamptz '2027-07-01 08:01:00+00', 1833, 1417, 'regular_hourly',
       'restored to the charged figure') r
    where ov.label = 'mixed'),
  5083,
  're-recording replaces both numbers together, so the money can never belong to '
  'a different measurement [§7.6]');

select is(
  (select d.overrun_fils from public.booking_detail d join ov on ov.id = d.booking_id
    where ov.label = 'mixed'),
  5083,
  'and a receptionist with no named grant reads it back on public.booking_detail '
  '— it is this booking''s own money [Q-10, §9.2]');

select is(
  (select d.total_fils from public.booking_detail d join ov on ov.id = d.booking_id
    where ov.label = 'mixed'),
  66000,
  'recording an overrun does NOT rewrite total_fils — the accepted price and the '
  'later charge are two stored figures [INV-21]');

select throws_ok(
  $$select public.record_overrun(
      (select id from ov where label = 'mixed'),
      timestamptz '2027-07-01 08:01:00+00', -1, 1417, 'regular_hourly', 'negative')$$,
  'WP055', null,
  'a negative rate is refused [R-16]');

select throws_ok(
  $$select public.record_overrun(
      (select id from ov where label = 'mixed'),
      timestamptz '2027-07-01 08:01:00+00', 1833, 1417, 'punitive', 'invented')$$,
  'WP055', null,
  'a rate source outside overrun.rate_source''s three readings is refused [Q-21]');

select throws_ok(
  $$select public.record_overrun(
      (select id from ov where label = 'mixed'),
      timestamptz '2027-07-01 08:01:00+00', 1833, 1417, null, 'unsourced')$$,
  'WP055', null,
  'a rate with no source is refused — the audit entry has to say which reading '
  'produced the charge [INV-13]');

select throws_ok(
  $$select public.record_overrun(
      (select id from ov where label = 'mixed'),
      timestamptz '2027-07-01 08:01:00+00', 1833, null, 'regular_hourly', 'no child rate')$$,
  'WP055', null,
  'a booking carrying children cannot be priced without a child rate — §7.6 is '
  'charged per guest and the two rates are not interchangeable');

reset role;

select is(
  (select e.new_value ->> 'rate_source' || '|' || (e.new_value ->> 'overrun_fils') || '|' ||
          (e.new_value ->> 'children')
     from audit.entries e join ov on ov.id::text = e.entity_id
    where ov.label = 'mixed'
      and e.action = 'record_overrun'
      and e.new_value ->> 'rate_source' is not null
    order by e.id desc limit 1),
  'regular_hourly|5083|1',
  'every overrun writes its own audit entry carrying the rate source, the money '
  'and the head count it was multiplied by [§3, INV-13]');

select * from finish();
rollback;
