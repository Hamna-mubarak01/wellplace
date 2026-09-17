begin;
select plan(74);

insert into public.staff (id, email, full_name, role) values
  ('f1111111-1111-4111-8111-111111111111', 'views.reception@example.test',  'Views Reception',  'reception'),
  ('f2222222-2222-4222-8222-222222222222', 'views.management@example.test', 'Views Management', 'management');

insert into public.suites (id, suite_number, priority, status) values
  ('f8010000-0000-4000-8000-000000000000', 801, 8010, 'available'),
  ('f8020000-0000-4000-8000-000000000000', 802, 8020, 'available'),
  ('f8030000-0000-4000-8000-000000000000', 803, 8030, 'available'),
  ('f8040000-0000-4000-8000-000000000000', 804, 8040, 'available'),
  ('f8050000-0000-4000-8000-000000000000', 805, 8050, 'available'),
  ('f8060000-0000-4000-8000-000000000000', 806, 8060, 'available'),
  ('f8070000-0000-4000-8000-000000000000', 807, 8070, 'available'),
  ('f8080000-0000-4000-8000-000000000000', 808, 8080, 'available'),
  ('f8090000-0000-4000-8000-000000000000', 809, 8090, 'maintenance'),
  ('f8100000-0000-4000-8000-000000000000', 810, 8100, 'available'),
  ('f8110000-0000-4000-8000-000000000000', 811, 8110, 'available');

insert into public.customers
  (id, first_name, last_name, email, phone_e164, phone_country, date_of_birth)
values
  ('f0000000-0000-4000-8000-000000000001', 'Viewtest', 'Guestly',
   'views.guest@example.test', '+971500009001', 'AE', date '1988-04-11');

update public.customers
   set warning_note = 'Allergic to eucalyptus oil'
 where id = 'f0000000-0000-4000-8000-000000000001';

insert into public.bookings
  (id, reference, customer_id, suite_id, source, status, experience_period,
   cleaning_buffer_minutes, subtotal_fils, discount_fils, addons_fils,
   service_fee_fils, tax_fils, total_fils)
values
  ('fb020000-0000-4000-8000-000000000000', 'WPVIEW02',
   'f0000000-0000-4000-8000-000000000001', 'f8020000-0000-4000-8000-000000000000',
   'online', 'confirmed',
   tstzrange(now() + interval '6 hours', now() + interval '8 hours', '[)'),
   20, 45000, 5000, 6000, 3000, 1000, 50000),

  ('fb030000-0000-4000-8000-000000000000', 'WPVIEW03',
   'f0000000-0000-4000-8000-000000000001', 'f8030000-0000-4000-8000-000000000000',
   'walk_in', 'checked_in',
   tstzrange(now() - interval '30 minutes', now() + interval '90 minutes', '[)'),
   20, 40000, 0, 0, 0, 0, 40000),

  ('fb040000-0000-4000-8000-000000000000', 'WPVIEW04',
   'f0000000-0000-4000-8000-000000000001', 'f8040000-0000-4000-8000-000000000000',
   'online', 'completed',
   tstzrange(now() - interval '2 hours', now() - interval '10 minutes', '[)'),
   20, 40000, 0, 0, 0, 0, 40000),

  ('fb070000-0000-4000-8000-000000000000', 'WPVIEW07',
   'f0000000-0000-4000-8000-000000000001', 'f8070000-0000-4000-8000-000000000000',
   'online', 'no_show',
   tstzrange(now() - interval '6 hours', now() - interval '4 hours', '[)'),
   20, 40000, 0, 0, 0, 0, 40000),

  ('fb080000-0000-4000-8000-000000000000', 'WPVIEW08',
   'f0000000-0000-4000-8000-000000000001', 'f8080000-0000-4000-8000-000000000000',
   'online', 'completed',
   tstzrange(now() - interval '2 hours', now() - interval '10 minutes', '[)'),
   20, 40000, 0, 0, 0, 0, 40000),

  ('fb100000-0000-4000-8000-000000000000', 'WPVIEW10',
   'f0000000-0000-4000-8000-000000000001', 'f8100000-0000-4000-8000-000000000000',
   'online', 'confirmed',
   tstzrange(
     (select day_to from public.reception_day_summary) - interval '1 hour',
     (select day_to from public.reception_day_summary), '[)'),
   20, 40000, 0, 0, 0, 0, 40000);

insert into public.booking_guests (booking_id, kind, age) values
  ('fb020000-0000-4000-8000-000000000000', 'adult', null),
  ('fb020000-0000-4000-8000-000000000000', 'adult', null),
  ('fb020000-0000-4000-8000-000000000000', 'child', 11),
  ('fb100000-0000-4000-8000-000000000000', 'adult', null),
  ('fb100000-0000-4000-8000-000000000000', 'adult', null),
  ('fb100000-0000-4000-8000-000000000000', 'child', 9);

insert into public.suite_occupancy
  (id, suite_id, kind, status, experience_period, blocked_period,
   cleaning_buffer_minutes, expires_at, is_active, booking_id, reason)
values
  ('fc010000-0000-4000-8000-000000000000', 'f8010000-0000-4000-8000-000000000000',
   'hold', 'active',
   tstzrange(now() + interval '3 hours', now() + interval '5 hours', '[)'),
   tstzrange(now() + interval '3 hours', now() + interval '5 hours 20 minutes', '[)'),
   20, now() + interval '10 minutes', true, null, null),

  ('fc020000-0000-4000-8000-000000000000', 'f8020000-0000-4000-8000-000000000000',
   'booking', 'active',
   tstzrange(now() + interval '6 hours', now() + interval '8 hours', '[)'),
   tstzrange(now() + interval '6 hours', now() + interval '8 hours 20 minutes', '[)'),
   20, null, true, 'fb020000-0000-4000-8000-000000000000', null),

  ('fc030000-0000-4000-8000-000000000000', 'f8030000-0000-4000-8000-000000000000',
   'booking', 'active',
   tstzrange(now() - interval '30 minutes', now() + interval '90 minutes', '[)'),
   tstzrange(now() - interval '30 minutes', now() + interval '110 minutes', '[)'),
   20, null, true, 'fb030000-0000-4000-8000-000000000000', null),

  ('fc040000-0000-4000-8000-000000000000', 'f8040000-0000-4000-8000-000000000000',
   'booking', 'active',
   tstzrange(now() - interval '2 hours', now() - interval '10 minutes', '[)'),
   tstzrange(now() - interval '2 hours', now() + interval '10 minutes', '[)'),
   20, null, true, 'fb040000-0000-4000-8000-000000000000', null),

  ('fc050000-0000-4000-8000-000000000000', 'f8050000-0000-4000-8000-000000000000',
   'block', 'active',
   tstzrange((select day_from from public.reception_day_summary) + interval '2 hours',
             (select day_from from public.reception_day_summary) + interval '4 hours', '[)'),
   tstzrange((select day_from from public.reception_day_summary) + interval '2 hours',
             (select day_from from public.reception_day_summary) + interval '4 hours', '[)'),
   0, null, true, null, 'Deep clean of the plant room'),

  ('fc060000-0000-4000-8000-000000000000', 'f8060000-0000-4000-8000-000000000000',
   'maintenance', 'active',
   tstzrange(now() + interval '10 hours', now() + interval '12 hours', '[)'),
   tstzrange(now() + interval '10 hours', now() + interval '12 hours', '[)'),
   0, null, true, null, null),

  ('fc070000-0000-4000-8000-000000000000', 'f8070000-0000-4000-8000-000000000000',
   'booking', 'active',
   tstzrange(now() - interval '6 hours', now() - interval '4 hours', '[)'),
   tstzrange(now() - interval '6 hours', now() - interval '3 hours 40 minutes', '[)'),
   20, null, true, 'fb070000-0000-4000-8000-000000000000', null),

  ('fc080000-0000-4000-8000-000000000000', 'f8080000-0000-4000-8000-000000000000',
   'booking', 'active',
   tstzrange(now() - interval '2 hours', now() - interval '10 minutes', '[)'),
   tstzrange(now() - interval '2 hours', now() + interval '10 minutes', '[)'),
   20, null, true, 'fb080000-0000-4000-8000-000000000000', null),

  ('fc100000-0000-4000-8000-000000000000', 'f8100000-0000-4000-8000-000000000000',
   'booking', 'active',
   tstzrange((select day_to from public.reception_day_summary) - interval '1 hour',
             (select day_to from public.reception_day_summary), '[)'),
   tstzrange((select day_to from public.reception_day_summary) - interval '1 hour',
             (select day_to from public.reception_day_summary) + interval '20 minutes', '[)'),
   20, null, true, 'fb100000-0000-4000-8000-000000000000', null),

  ('fc110000-0000-4000-8000-000000000000', 'f8110000-0000-4000-8000-000000000000',
   'hold', 'active',
   tstzrange(now() + interval '20 hours', now() + interval '22 hours', '[)'),
   tstzrange(now() + interval '20 hours', now() + interval '22 hours 20 minutes', '[)'),
   20, now() - interval '1 minute', true, null, null);

update public.bookings b
   set occupancy_id = o.id
  from public.suite_occupancy o
 where o.booking_id = b.id;

insert into public.cleaning_tasks
  (id, suite_id, booking_id, status, due_from, started_at, assigned_to,
   confirmed_at, confirmed_by)
values
  ('fd040000-0000-4000-8000-000000000000', 'f8040000-0000-4000-8000-000000000000',
   'fb040000-0000-4000-8000-000000000000', 'in_progress',
   now() - interval '10 minutes', now() - interval '8 minutes',
   'f1111111-1111-4111-8111-111111111111', null, null),

  ('fd080000-0000-4000-8000-000000000000', 'f8080000-0000-4000-8000-000000000000',
   'fb080000-0000-4000-8000-000000000000', 'confirmed',
   now() - interval '10 minutes', now() - interval '8 minutes',
   'f1111111-1111-4111-8111-111111111111',
   now() - interval '5 minutes', 'f1111111-1111-4111-8111-111111111111');

insert into public.payments
  (id, booking_id, status, method, amount_fils, service_fee_fils, provider_reference)
values
  ('fe020000-0000-4000-8000-000000000001', 'fb020000-0000-4000-8000-000000000000',
   'paid', 'online', 50000, 3000, 'PROV-VIEW-9001'),
  ('fe020000-0000-4000-8000-000000000002', 'fb020000-0000-4000-8000-000000000000',
   'failed', 'online', 50000, 3000, 'PROV-VIEW-9002');

insert into public.refunds
  (payment_id, booking_id, amount_fils, reason, is_pending, settled_at, requested_by)
values
  ('fe020000-0000-4000-8000-000000000001', 'fb020000-0000-4000-8000-000000000000',
   1500, 'Goodwill for a late start', false, now() - interval '1 hour',
   'f2222222-2222-4222-8222-222222222222');

insert into public.messages
  (id, template_key, channel, status, booking_id, customer_id, to_address,
   subject, body, is_marketing, attempt_count, last_attempt_at, failed_at, error)
values
  ('ff020000-0000-4000-8000-000000000000', 'payment_link', 'email', 'failed',
   'fb020000-0000-4000-8000-000000000000', 'f0000000-0000-4000-8000-000000000001',
   'views.guest@example.test', 'Your payment link',
   'Settle your booking at https://pay.example.test/opaque-token-9001',
   false, 2, now() - interval '20 minutes', now() - interval '20 minutes',
   'smtp: mailbox unavailable');

insert into public.tasks (id, title, note, assigned_to, assigned_by, priority, status)
values
  ('fa020000-0000-4000-8000-000000000000', 'Restock suite 802 amenities',
   'Two towel sets short', 'f2222222-2222-4222-8222-222222222222',
   'f2222222-2222-4222-8222-222222222222', 'high', 'open');

insert into public.shift_notes (id, author_id, shift_on, body)
values
  ('fa030000-0000-4000-8000-000000000000', 'f2222222-2222-4222-8222-222222222222',
   current_date, 'Late arrival expected on WPVIEW02.');

insert into public.alerts (id, kind, severity, entity, entity_id)
values
  ('fa040000-0000-4000-8000-000000000000', 'message_failed', 'warning',
   'public.bookings', 'fb020000-0000-4000-8000-000000000000');

select has_view('public', 'reception_board',
  'the §9.1 board is a view, not a base-table read [R-03]');
select has_view('public', 'booking_search',
  'the §9.1 five-key search is a view [R-03]');
select has_view('public', 'booking_detail',
  'the booking detail is a view [R-03]');
select has_view('public', 'reception_day_summary',
  'the §9.1 daily overview counts are a view [R-03]');
select has_view('public', 'open_alerts',
  'the §9.3 alert centre is a view [R-03]');
select has_view('public', 'staff_tasks',
  'the §10.6 task list is a view [R-03]');
select has_view('public', 'cleaning_board',
  'the §9.2 cleaning list is a view [R-03]');
select has_view('public', 'shift_handover',
  'the §9.2 handover is a view [R-03]');
select has_view('public', 'booking_messages',
  'the §11.5 message log is a view [R-03]');

select is(
  (select array_agg(c.relname::text order by c.relname)
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and c.relname in ('reception_board','booking_search','booking_detail',
                        'reception_day_summary','open_alerts','staff_tasks',
                        'cleaning_board','shift_handover','booking_messages')
      and coalesce(c.reloptions::text, '') not like '%security_invoker=true%'),
  null,
  'every Reception view is security_invoker, so RLS on the base tables still applies to the caller');

select is(
  (select array_agg(c.relname::text order by c.relname)
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and c.relname in ('reception_board','booking_search','booking_detail',
                        'reception_day_summary','open_alerts','staff_tasks',
                        'cleaning_board','shift_handover','booking_messages')
      and not has_table_privilege('authenticated', c.oid, 'select')),
  null,
  'every Reception view carries its own select grant, which a drop-and-recreate must reissue');

select is(
  (select array_agg(c.relname::text order by c.relname)
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and c.relname in ('reception_board','booking_search','booking_detail',
                        'reception_day_summary','open_alerts','staff_tasks',
                        'cleaning_board','shift_handover','booking_messages')
      and has_table_privilege('anon', c.oid, 'select')),
  null,
  'no Reception view is readable by the public web role [§3, INV-01]');

select is(
  (select count(*)::int from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where p.proname in ('allocate_suite', 'hold_suite')
      and p.prosrc like '%reception_board%'),
  0,
  'Q-16 guard: the allocation path never reads the board view');

select is(
  (select count(*)::int from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where p.proname in ('allocate_suite', 'hold_suite')
      and p.prosrc like '%cleaning_tasks%'),
  0,
  'Q-16 guard: allocation never depends on a cleaning task being confirmed [§7.1]');

set local role authenticated;
set local request.jwt.claims = '{"sub":"f1111111-1111-4111-8111-111111111111"}';

select is((select board_state from public.reception_board
            where suite_id = 'f8010000-0000-4000-8000-000000000000'),
  'hold', 'board_state hold [§9.1]');
select is((select board_state from public.reception_board
            where suite_id = 'f8020000-0000-4000-8000-000000000000'),
  'booked', 'board_state booked [§9.1]');
select is((select board_state from public.reception_board
            where suite_id = 'f8030000-0000-4000-8000-000000000000'),
  'checked_in', 'board_state checked_in [§9.1]');
select is((select board_state from public.reception_board
            where suite_id = 'f8040000-0000-4000-8000-000000000000'),
  'cleaning', 'board_state cleaning: an unconfirmed task covering now outranks completed [§9.1]');
select is((select board_state from public.reception_board
            where suite_id = 'f8050000-0000-4000-8000-000000000000'),
  'block', 'board_state block [§9.1]');
select is((select board_state from public.reception_board
            where suite_id = 'f8060000-0000-4000-8000-000000000000'),
  'maintenance', 'board_state maintenance [§9.1]');
select is((select board_state from public.reception_board
            where suite_id = 'f8070000-0000-4000-8000-000000000000'),
  'no_show', 'board_state no_show [§9.1]');
select is((select board_state from public.reception_board
            where suite_id = 'f8080000-0000-4000-8000-000000000000'),
  'completed', 'board_state completed: a confirmed clean stops the cleaning state [§9.2]');

select is(
  (select array_length(array_agg(distinct board_state), 1) from public.reception_board),
  8, 'the board produces exactly the eight states BOARD_STATES lists [§9.1]');

select is(
  (select count(*)::int from public.reception_board
    where suite_id = 'f8110000-0000-4000-8000-000000000000'),
  0, 'an expired hold is off the board without waiting for the sweep [§7.3, INV-05]');

select is(
  (select guest_name from public.reception_board
    where suite_id = 'f8020000-0000-4000-8000-000000000000'),
  'Viewtest Guestly', 'the board names the guest [§9.1]');

select is(
  (select blocked_to from public.reception_board
    where suite_id = 'f8020000-0000-4000-8000-000000000000'),
  (select experience_to + interval '20 minutes' from public.reception_board
    where suite_id = 'f8020000-0000-4000-8000-000000000000'),
  'the buffer is on the row and blocked_to is the end of it [§7.1, INV-06]');

select is((select count(*)::int from public.booking_search
            where reference ilike '%view02%'),
  1, 'search key 1 of 5: booking reference [§9.1]');
select is((select count(*)::int from public.booking_search
            where first_name ilike '%viewtest%' or last_name ilike '%viewtest%'),
  6, 'search key 2 of 5: guest name [§9.1]');
select is((select count(*)::int from public.booking_search
            where email ilike '%views.guest@example.test%'),
  6, 'search key 3 of 5: email [§9.1]');
select is((select count(*)::int from public.booking_search
            where phone_e164 ilike '%500009001%'),
  6, 'search key 4 of 5: mobile [§9.1]');
select is((select count(*)::int from public.booking_search
            where payment_reference ilike '%PROV-VIEW-9002%'),
  1, 'search key 5 of 5: payment reference, matching any of a booking''s references [§9.1]');

select is((select payment_status::text from public.booking_search
            where reference = 'WPVIEW02'),
  'partially_refunded', 'payment_status is the most advanced state reached: the settled AED 15 refund moves the paid payment to partially_refunded, and the failed retry beside it does not mask that [§8, §11.2]');
select is((select payment_status::text from public.booking_search
            where reference = 'WPVIEW07'),
  'open', 'payment_status is open when the booking carries no payment row');

select is((select adults from public.booking_search where reference = 'WPVIEW02'),
  2, 'booking_search counts adults [§6.2]');
select is((select children from public.booking_search where reference = 'WPVIEW02'),
  1, 'booking_search counts children [§6.2]');

select is((select total_fils from public.booking_search where reference = 'WPVIEW02'),
  50000, 'Q-10: a booking''s own total is operational, so reception reads it with no grant [§9.2, §10.6]');
select is((select total_fils from public.booking_detail where reference = 'WPVIEW02'),
  50000, 'Q-10: the same answer on the detail view [§9.2, §10.6]');
select is((select subtotal_fils from public.booking_detail where reference = 'WPVIEW02'),
  45000, 'Q-10: the whole stored breakdown comes with it — the subtotal [§6.4, INV-21]');
select is((select discount_fils from public.booking_detail where reference = 'WPVIEW02'),
  5000, 'Q-10: the discount the guest was given [§6.4]');
select is((select addons_fils from public.booking_detail where reference = 'WPVIEW02'),
  6000, 'Q-10: the add-on lines [§10.4, §11.2]');
select is((select service_fee_fils from public.booking_detail where reference = 'WPVIEW02'),
  3000, 'Q-10: the §8.1 service fee, stored and never recomputed [INV-19, INV-21]');
select is((select tax_fils from public.booking_detail where reference = 'WPVIEW02'),
  1000, 'Q-10: and the tax component of the VAT-inclusive total [§8]');
select is((select paid_fils from public.booking_detail where reference = 'WPVIEW02'),
  50000, 'Q-10: with how much is already settled, because §9.2 has reception taking the balance in cash');
select is((select refunded_fils from public.booking_detail where reference = 'WPVIEW02'),
  null, 'Q-10: refunds are named on §10.1''s list and stay gated — null, never the zero the row policy would produce [§10.6, INV-15]');
select is((select refunds_pending_fils from public.booking_detail where reference = 'WPVIEW02'),
  null, 'Q-10: a pending refund figure stays gated with the settled one [§11.2, INV-15]');

select is((select booking_status::text from public.booking_detail where reference = 'WPVIEW02'),
  'confirmed', 'booking_detail stays operationally readable without the permission [§9.2]');
select is((select child_ages from public.booking_detail where reference = 'WPVIEW02'),
  array[11], 'booking_detail carries each child age, never a date of birth [§6.2]');
select is((select warning_note from public.booking_detail where reference = 'WPVIEW02'),
  'Allergic to eucalyptus oil',
  'booking_detail carries the customer warning ungated, because §10.6 gates figures and not operational text [§10.5]');

select is((select has_body from public.booking_messages
            where booking_id = 'fb020000-0000-4000-8000-000000000000'),
  true, 'booking_messages says a body exists even when it is not shown [§11.5]');
select is((select body from public.booking_messages
            where booking_id = 'fb020000-0000-4000-8000-000000000000'),
  null, 'Q-10: a payment link inside a body is hidden without the permission [§10.6]');
select is((select subject from public.booking_messages
            where booking_id = 'fb020000-0000-4000-8000-000000000000'),
  null, 'Q-10: the subject is gated with the body');
select is((select template_key from public.booking_messages
            where booking_id = 'fb020000-0000-4000-8000-000000000000'),
  'payment_link', 'the resend §9.2 needs stays readable without the permission');
select is((select error from public.booking_messages
            where booking_id = 'fb020000-0000-4000-8000-000000000000'),
  'smtp: mailbox unavailable', 'the failure §9.3 alerts on stays readable without the permission');
select is((select attempt_count from public.booking_messages
            where booking_id = 'fb020000-0000-4000-8000-000000000000'),
  2, 'retry attempts stay readable without the permission [§11.5]');

select is((select assigned_to_name from public.staff_tasks
            where task_id = 'fa020000-0000-4000-8000-000000000000'),
  'Views Management', 'reception reads a colleague''s name on a task it must work [§10.6]');
select is((select count(*)::int from public.staff
            where id = 'f2222222-2222-4222-8222-222222222222'),
  0, 'and still cannot read that colleague''s staff row [§10.6]');
select is((select author_name from public.shift_handover
            where shift_note_id = 'fa030000-0000-4000-8000-000000000000'),
  'Views Management', 'the handover names its author [§9.2]');
select is((select assigned_to_name from public.cleaning_board
            where cleaning_task_id = 'fd040000-0000-4000-8000-000000000000'),
  'Views Reception', 'the cleaning list names who is doing it [§9.2]');
select is((select suite_number from public.cleaning_board
            where cleaning_task_id = 'fd040000-0000-4000-8000-000000000000'),
  804, 'the cleaning list resolves the suite [§9.2]');

select is((select booking_reference from public.open_alerts
            where alert_id = 'fa040000-0000-4000-8000-000000000000'),
  'WPVIEW02', 'an open alert resolves its entity to a reference a human can act on [§9.3]');

select is((select day_to - day_from from public.reception_day_summary),
  interval '1 day', 'the overview covers one Dubai operating day [§11.1, INV-24]');
select ok((select now() >= day_from and now() < day_to from public.reception_day_summary),
  'the overview covers the day that is running now [§9.1]');
select is((select active_holds from public.reception_day_summary),
  1, 'the overview counts the live hold and not the expired one [§7.3, INV-05]');
select is((select suites_unavailable from public.reception_day_summary),
  1, 'the overview counts suites in the four never-auto-allocated statuses [§7.2, INV-07]');
select ok((select suites_claimed >= 1 from public.reception_day_summary),
  'the overview counts suites claimed today [§9.1]');
select ok((select bookings_today >= 1 from public.reception_day_summary),
  'the overview counts today''s bookings [§9.1]');
select ok((select guests_expected >= 3 from public.reception_day_summary),
  'the overview counts the guests those bookings bring [§9.1]');
select ok((select arrivals_remaining >= 1 from public.reception_day_summary),
  'the overview counts arrivals still to come [§9.1]');

reset role;
insert into public.staff_permissions (staff_id, permission)
  values ('f1111111-1111-4111-8111-111111111111', 'view_confidential_figures');

set local role authenticated;
set local request.jwt.claims = '{"sub":"f1111111-1111-4111-8111-111111111111"}';

select is((select total_fils from public.booking_search where reference = 'WPVIEW02'),
  50000, 'Q-10: the named grant changes nothing about a booking''s own price — it was already readable [§10.6]');
select is((select total_fils from public.booking_detail where reference = 'WPVIEW02'),
  50000, 'Q-10: and the detail view agrees with the search view [§10.6]');
select is((select service_fee_fils from public.booking_detail where reference = 'WPVIEW02'),
  3000, 'Q-10: the §8.1 service fee is its own line and it is stored, never recomputed [INV-19, INV-21]');
select is((select refunded_fils from public.booking_detail where reference = 'WPVIEW02'),
  null, 'Q-10: a stored grant no longer reveals settled refunds to reception, because permissions are fixed by role [§11.2, INV-15; Project owner''s direction, 17 September 2026]');
select is((select refunds_pending_fils from public.booking_detail where reference = 'WPVIEW02'),
  null, 'Q-10: and the pending refund figure stays hidden with it [§11.2; Project owner''s direction, 17 September 2026]');
select is((select body from public.booking_messages
            where booking_id = 'fb020000-0000-4000-8000-000000000000'),
  null,
  'Q-10: a payment link stays hidden from reception even with a stored grant [§10.6; Project owner''s direction, 17 September 2026]');

reset role;
select * from finish();
rollback;
