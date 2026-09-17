begin;
select plan(30);

update public.suites set is_active = false;

insert into public.suites (id, suite_number, priority, status, is_active) values
  ('c9600000-0000-4000-8000-000000000001', 9601, 9610, 'available',   true),
  ('c9600000-0000-4000-8000-000000000002', 9602, 9620, 'available',   true),
  ('c9600000-0000-4000-8000-000000000003', 9603, 9630, 'maintenance', true);

insert into public.staff (id, email, full_name, role, is_active) values
  ('d9600000-0000-4000-8000-000000000001', 'mbc.manager@example.test',   'MBC Manager',   'management', true),
  ('d9600000-0000-4000-8000-000000000002', 'mbc.reception@example.test', 'MBC Reception', 'reception',  true);

create temp table mbc (label text primary key, id uuid);
grant all on mbc to public;

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9600000-0000-4000-8000-000000000002","email":"mbc.reception@example.test"}';

insert into mbc (label, id)
select 'visit', r.booking_id
  from public.create_reception_booking(
    'walk_in', 'ms', 'Maya', 'Console', 'maya.console@example.test',
    date '1990-02-02', '+971500009601', 'AE',
    timestamptz '2041-06-01 10:00+04', 2, 20,
    2, null, null, null, null,
    '{"subtotal_fils":66000,"discount_fils":0,"addons_fils":0,"service_fee_fils":0,"tax_fils":3143,"total_fils":66000}'::jsonb,
    false,
    '[{"document_slug":"legal-terms","document_version":"1.3","checkbox_text":"I agree to WellPlace''s Legal, Privacy & Marketing Terms."}]'::jsonb,
    'Walk-in for the Management booking console test') r;

reset role;

insert into mbc (label, id)
select 'customer', b.customer_id from public.bookings b join mbc on mbc.id = b.id where mbc.label = 'visit';

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9600000-0000-4000-8000-000000000001","email":"mbc.manager@example.test"}';

select is(
  (select u.personal_request
     from mbc, lateral public.update_booking_details(mbc.id, 'Quiet room please', 'Prefers late check-in', 'Edited from the booking page') u
    where mbc.label = 'visit'),
  'Quiet room please',
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] Management edits a booking''s details'
);

select is(
  (select r.experience_from
     from mbc, lateral public.reschedule_booking(mbc.id, timestamptz '2041-06-02 10:00+04', 'Guest asked for the next day') r
    where mbc.label = 'visit'),
  timestamptz '2041-06-02 10:00+04',
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] Management reschedules a booking'
);

select is(
  (select m.suite_number
     from mbc, lateral public.move_booking(mbc.id, 'c9600000-0000-4000-8000-000000000002', timestamptz '2041-06-02 10:00+04', false, 'Guest asked for a different suite') m
    where mbc.label = 'visit'),
  9602,
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] Management changes the suite'
);

select is(
  (select e.experience_to
     from mbc, lateral public.extend_booking(mbc.id, 30, 'Guest asked for another half hour') e
    where mbc.label = 'visit'),
  timestamptz '2041-06-02 12:30+04',
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] Management extends a booking'
);

reset role;

select is(
  (select count(distinct e.action)::integer
     from audit.entries e, mbc
    where mbc.label = 'visit'
      and e.actor_id = 'd9600000-0000-4000-8000-000000000001'
      and e.action in ('update_booking_details', 'reschedule_booking', 'move_booking', 'extend_booking')
      and (e.entity_id = mbc.id::text or e.new_value ->> 'booking_id' = mbc.id::text)),
  4,
  '[§3, INV-13] each of the four changes wrote its own audit entry naming the manager'
);

select is(
  (select b.suite_id from public.bookings b join mbc on mbc.id = b.id where mbc.label = 'visit'),
  'c9600000-0000-4000-8000-000000000002'::uuid,
  'the booking now sits on the suite Management chose'
);

select is(
  (select count(*)::integer
     from public.suite_occupancy o join mbc on mbc.id = o.booking_id
    where mbc.label = 'visit' and o.is_active),
  1,
  '[INV-02] and holds exactly one live claim after the reschedule, the move and the extension'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9600000-0000-4000-8000-000000000001","email":"mbc.manager@example.test"}';

select throws_ok(
  $$select public.cancel_booking((select id from mbc where label = 'visit'), 'Manager cancelled')$$,
  'WP057', null,
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] cancellation stays with Reception'
);

select throws_ok(
  $$select public.record_arrival((select id from mbc where label = 'visit'), now(), 'Manager recorded arrival')$$,
  'WP057', null,
  'arrival stays with Reception'
);

select throws_ok(
  $$select public.check_in_booking((select id from mbc where label = 'visit'), now(), 'Manager checked in')$$,
  'WP057', null,
  'check-in stays with Reception'
);

select throws_ok(
  $$select public.mark_no_show((select id from mbc where label = 'visit'), 'Manager marked no show')$$,
  'WP057', null,
  'no-show stays with Reception'
);

select throws_ok(
  $$select public.record_booking_payment((select id from mbc where label = 'visit'), 'cash', 1000, null, null, 'Manager took cash')$$,
  'WP057', null,
  'taking payments stays with Reception'
);

select throws_ok(
  $$select public.create_reception_booking(
      'walk_in', 'mr', 'Desk', 'Only', 'desk.only@example.test',
      date '1990-01-01', '+971500009602', 'AE',
      timestamptz '2041-06-05 10:00+04', 2, 20, 2, null, null, null, null,
      '{"total_fils":1}'::jsonb, false, '[]'::jsonb, 'Manager walk-in')$$,
  'WP057', null,
  'walk-in and desk booking creation stay with Reception'
);

select ok(
  (select count(*) from mbc, lateral public.reception_booking_activity(mbc.id) where mbc.label = 'visit') >= 4,
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] Management reads the booking activity trail'
);

select is(
  (select count(*)::integer from mbc, lateral public.reception_booking_change_reasons(mbc.id) where mbc.label = 'visit'),
  3,
  'Management reads the latest move, reschedule and extension reasons'
);

select ok(
  (select count(*) from mbc, lateral public.reception_booking_audit(mbc.id) where mbc.label = 'visit') >= 4,
  'Management reads the booking history'
);

select is(
  (select count(*)::integer
     from mbc, lateral public.count_reschedule_suites(mbc.id, array[timestamptz '2041-06-03 10:00+04'], 150)
    where mbc.label = 'visit'),
  1,
  'Management previews rescheduling availability'
);

select is(
  (select count(*)::integer from public.reception_booking_suites(timestamptz '2041-06-04 10:00+04', 2)),
  3,
  'Management reads the advisory suite list'
);

select throws_ok(
  $$select * from public.reception_customers('')$$,
  'WP057', null,
  '[CLIENT] the desk customer picker stays Reception-only'
);

select is(
  (select string_agg(o.suite_number::text || ':' || o.is_current::text || ':' || o.is_available::text, ',' order by o.suite_number)
     from mbc, lateral public.booking_move_options(mbc.id) o
    where mbc.label = 'visit'),
  '9601:false:true,9602:true:true,9603:false:false',
  '[§7.2, §9.2] booking_move_options marks the current suite, ignores the booking''s own claim and never offers a maintenance suite'
);

select lives_ok(
  $$select public.block_suite_period(array['c9600000-0000-4000-8000-000000000001'::uuid], timestamptz '2041-06-02 11:00+04', timestamptz '2041-06-02 13:00+04', 'Repair test')$$,
  'Management blocks the other suite across the visit'
);

select is(
  (select o.is_available
     from mbc, lateral public.booking_move_options(mbc.id) o
    where mbc.label = 'visit' and o.suite_number = 9601),
  false,
  'and that suite is then reported unavailable for the whole visit and its cleaning time'
);

select is(
  (select o.is_available
     from mbc, lateral public.booking_move_options(mbc.id, timestamptz '2041-06-03 10:00+04') o
    where mbc.label = 'visit' and o.suite_number = 9601),
  true,
  'but available at a start time that clears the block'
);

reset role;

insert into public.payments (id, booking_id, status, method, amount_fils)
select 'e9600000-0000-4000-8000-000000000001', mbc.id, 'paid', 'cash', 50000 from mbc where mbc.label = 'visit';
insert into public.payments (id, booking_id, status, method, amount_fils)
select 'e9600000-0000-4000-8000-000000000002', mbc.id, 'paid', 'card_terminal', 10000 from mbc where mbc.label = 'visit';
insert into public.payments (id, booking_id, status, method, amount_fils)
select 'e9600000-0000-4000-8000-000000000003', mbc.id, 'failed', 'payment_link', 99000 from mbc where mbc.label = 'visit';
insert into public.refunds (payment_id, booking_id, amount_fils, reason, is_pending, settled_at, requested_by)
select 'e9600000-0000-4000-8000-000000000001', mbc.id, 5000, 'Returned towel deposit', false, now(), 'd9600000-0000-4000-8000-000000000001'
  from mbc where mbc.label = 'visit';
insert into public.refunds (payment_id, booking_id, amount_fils, reason, is_pending, requested_by)
select 'e9600000-0000-4000-8000-000000000002', mbc.id, 3000, 'Awaiting return', true, 'd9600000-0000-4000-8000-000000000001'
  from mbc where mbc.label = 'visit';

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9600000-0000-4000-8000-000000000001","email":"mbc.manager@example.test"}';

select is(
  (select m.paid_fils from public.management_customers m join mbc on mbc.id = m.id where mbc.label = 'customer'),
  55000,
  '[§10.5, §10.6] paid_fils is money taken less refunds whose return is confirmed; a failed payment and a pending refund do not move it'
);

select is(
  (select m.bookings_count || '|' || m.upcoming_count || '|' || m.completed_count || '|' || m.cancelled_count
     from public.management_customers m join mbc on mbc.id = m.id where mbc.label = 'customer'),
  '1|1|0|0',
  'the booking counts are per customer'
);

select is(
  (select m.next_visit_at from public.management_customers m join mbc on mbc.id = m.id where mbc.label = 'customer'),
  timestamptz '2041-06-02 10:00+04',
  'a future confirmed visit is the next visit'
);

select ok(
  (select m.last_visit_at is null and m.first_visit_at is null
     from public.management_customers m join mbc on mbc.id = m.id where mbc.label = 'customer'),
  'and not yet a first or last visit'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d9600000-0000-4000-8000-000000000002","email":"mbc.reception@example.test"}';

select is(
  (select count(*)::integer from public.management_customers),
  0,
  '[INV-15] Reception reads no rows from the confidential customer view'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d9600000-0000-4000-8000-0000000000ff","email":"nobody@example.test"}';

select throws_ok(
  $$select public.update_booking_details((select id from mbc where label = 'visit'), null, null, 'Stranger')$$,
  '42501', null,
  '[§13] a signed-in account with no staff record is refused by the carve-out''s own staff check'
);

reset role;

select ok(
  not has_table_privilege('anon', 'public.management_customers', 'select')
    and not has_function_privilege('anon', 'public.booking_move_options(uuid,timestamptz)', 'execute'),
  '[INV-01] the unauthenticated role reaches neither the customer view nor the suite options'
);

select * from finish();
rollback;
