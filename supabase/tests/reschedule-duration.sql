begin;
select plan(20);

update public.suites set is_active = false;

insert into public.suites (id, suite_number, priority, status, is_active) values
  ('c9400000-0000-4000-8000-000000000001', 9401, 9410, 'available', true),
  ('c9400000-0000-4000-8000-000000000002', 9402, 9420, 'available', true);

insert into public.staff (id, email, full_name, role) values
  ('d9411111-1111-4111-8111-111111111111', 'rd.reception@example.test',
   'RD Reception', 'reception');

create temp table bkd (label text primary key, id uuid);
grant all on bkd to public;

create temp view booked_minutes as
  select bkd.label,
         (extract(epoch from (upper(b.experience_period) - lower(b.experience_period))) / 60)::integer
           as minutes,
         b.suite_id
    from public.bookings b
    join bkd on bkd.id = b.id;
grant select on booked_minutes to public;


select is(
  (select pg_get_function_identity_arguments(p.oid) from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'reschedule_booking'),
  'p_booking_id uuid, p_starts_at timestamp with time zone, p_reason text, '
  'p_duration_hours integer, p_duration_minutes integer',
  'the signature the typed wrapper in src/lib/db/rpc.ts is written against. '
  'BOTH durations are defaulted so either can be omitted, and p_reason is NOT, '
  'because PostgREST can only omit a parameter that carries a default and §3 '
  'wants a reason on every manual change [R-02, INV-13]');

select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'reschedule_booking'),
  1,
  'and there is exactly ONE of it — the four-argument function was DROPPED '
  'rather than left beside the five-argument one, which would have made every '
  'four-argument call ambiguous');

select is(
  (select pg_get_function_identity_arguments(p.oid) from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'extend_booking'),
  'p_booking_id uuid, p_extra_minutes integer, p_reason text',
  'public.extend_booking never had the defect: §7.6 lets Reception extend by '
  'any number of minutes and it has always been denominated in minutes');

select ok(
  not exists (
    select 1 from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname = 'move_booking'
       and 'p_duration_hours' = any(p.proargnames)),
  'and public.move_booking never had it either — it takes no duration at all '
  'and carries the stored interval across, which is why §9.2''s calendar move '
  'cannot resize a booking');


set local role authenticated;
set local request.jwt.claims = '{"sub":"d9411111-1111-4111-8111-111111111111","email":"rd.reception@example.test"}';

insert into bkd (label, id)
select 'odd', r.booking_id
  from public.create_reception_booking(
    'walk_in', 'ms', 'Rita', 'Sole', 'rita.sole@example.test',
    date '1991-04-04', '+971500004321', 'AE',
    timestamptz '2027-07-01 06:00:00+00', 2, 20,
    2, null, null, null, null,
    '{"subtotal_fils":40000,"discount_fils":0,"addons_fils":0,'
    '"service_fee_fils":0,"tax_fils":0,"total_fils":40000}'::jsonb,
    false,
    '[{"document_slug":"legal-terms","document_version":"1.3",'
    '"checkbox_text":"I agree to WellPlace''s Legal, Privacy & Marketing Terms."}]'::jsonb,
    'Walk-in for the duration test') r;

select is(
  (select e.experience_to::text
     from bkd, lateral public.extend_booking(
       bkd.id, 30, 'guest asked for another half hour') e
    where bkd.label = 'odd'),
  '2027-07-01 08:30:00+00',
  'a §7.6 extension of thirty minutes makes the booking two and a half hours '
  'long — this state is reachable in ordinary use, which is what made the '
  'whole-hour reschedule parameter a defect rather than a rough edge');

reset role;

select is(
  (select minutes from booked_minutes where label = 'odd'),
  150,
  'the booking is 150 minutes and no whole number of hours describes it');

set local role authenticated;

select is(
  (select r.experience_to::text
     from bkd, lateral public.reschedule_booking(
       bkd.id, timestamptz '2027-07-02 06:00:00+00',
       'guest moved a day', null, 150) r
    where bkd.label = 'odd'),
  '2027-07-02 08:30:00+00',
  'THE FIX: p_duration_minutes reschedules the exact length. The same move '
  'sent as 3 whole hours would have sold the guest another thirty minutes and '
  'sent as 2 would have taken thirty away [§7.6, §9.2]');

reset role;

select is(
  (select minutes from booked_minutes where label = 'odd'),
  150,
  'and the stored booking is still 150 minutes — a reschedule moves a booking, '
  'it does not resize it');

set local role authenticated;

select is(
  (select r.experience_to::text
     from bkd, lateral public.reschedule_booking(
       bkd.id, timestamptz '2027-07-03 06:00:00+00',
       'management lengthened it deliberately', 3) r
    where bkd.label = 'odd'),
  '2027-07-03 09:00:00+00',
  'p_duration_hours ALONE is unchanged, so nothing that called the four-'
  'argument function broke on the day this shipped — a deliberate change of '
  'length is still a change of length');

select is(
  (select r.experience_to::text
     from bkd, lateral public.reschedule_booking(
       bkd.id, timestamptz '2027-07-04 06:00:00+00',
       'moved with no duration named') r
    where bkd.label = 'odd'),
  '2027-07-04 09:00:00+00',
  'BOTH NULL PRESERVES THE CURRENT LENGTH, exactly as public.move_booking '
  'does. A caller that forgets to send a duration now changes nothing rather '
  'than inventing one');

select throws_ok(
  $$select public.reschedule_booking(
      (select id from bkd where label = 'odd'),
      timestamptz '2027-07-05 06:00:00+00', 'contradictory', 3, 150)$$,
  'WP054', null,
  'WP054: supplying three hours AND 150 minutes is REFUSED rather than '
  'silently resolved. A caller that sends two different lengths does not know '
  'how long the booking is, and picking one of its answers would reproduce the '
  'exact class of bug this migration ends');

select is(
  (select r.experience_to::text
     from bkd, lateral public.reschedule_booking(
       bkd.id, timestamptz '2027-07-05 06:00:00+00',
       'both, in agreement', 2, 120) r
    where bkd.label = 'odd'),
  '2027-07-05 08:00:00+00',
  'but both in AGREEMENT is accepted — a caller sending a redundant pair is '
  'not wrong, only verbose');

select throws_ok(
  $$select public.reschedule_booking(
      (select id from bkd where label = 'odd'),
      timestamptz '2027-07-06 06:00:00+00', 'zero minutes', null, 0)$$,
  'WP005', null,
  'a zero-minute booking is refused by the same range guard the hours '
  'parameter has always had');

select throws_ok(
  $$select public.reschedule_booking(
      (select id from bkd where label = 'odd'),
      timestamptz '2027-07-06 06:00:00+00', '   ', null, 120)$$,
  '22023', null,
  'and a blank reason is still refused — §3 wants the audit entry to carry one '
  '[INV-13]');

select is(
  (select e.experience_to::text
     from bkd, lateral public.extend_booking(
       bkd.id, 15, 'another quarter hour') e
    where bkd.label = 'odd'),
  '2027-07-05 08:15:00+00',
  'extend it again to 135 minutes, a length no whole hour describes');

select is(
  (select mv.suite_id
     from bkd, lateral public.move_booking(
       bkd.id,
       'c9400000-0000-4000-8000-000000000002',
       timestamptz '2027-07-07 06:00:00+00',
       false,
       'dragged to the other suite') mv
    where bkd.label = 'odd'),
  'c9400000-0000-4000-8000-000000000002'::uuid,
  'a §9.2 calendar move puts it on the other suite');

reset role;

select is(
  (select minutes from booked_minutes where label = 'odd'),
  135,
  'and all 135 minutes survive the move — the behaviour '
  'public.reschedule_booking now matches');

select is(
  (select e.new_value ->> 'duration_source'
     from audit.entries e
    where e.action = 'reschedule_booking'
    order by e.id desc
    limit 1),
  'minutes',
  'the audit entry names WHICH parameter decided the length, so §11 never has '
  'to guess how a booking came to be the length it is [INV-13]');

select is(
  (select (e.old_value ->> 'duration_minutes') || ' to ' || (e.new_value ->> 'duration_minutes')
     from audit.entries e
    where e.action = 'reschedule_booking'
    order by e.id desc
    limit 1),
  '180 to 120',
  'and it carries the length on BOTH sides, so a deliberate resize is readable '
  'without subtracting two timestamps');

select is(
  (select (e.old_value ->> 'duration_minutes') || ' to ' || (e.new_value ->> 'duration_minutes')
     from audit.entries e
    where e.action = 'reschedule_booking'
      and e.new_value ->> 'duration_source' = 'preserved'
    order by e.id desc
    limit 1),
  '180 to 180',
  'and the preserving reschedule is provably a move and not a resize, which is '
  'the entry a dispute about what the guest bought turns on [§3, INV-13]');


select * from finish();
rollback;
