begin;
select plan(24);

insert into public.staff (id, email, full_name, role) values
  ('c1111111-1111-4111-8111-111111111111', 'crv.reception@example.test',  'CRV Reception',  'reception'),
  ('c2222222-2222-4222-8222-222222222222', 'crv.management@example.test', 'CRV Management', 'management');

insert into public.suites (id, suite_number, priority, status) values
  ('c9010000-0000-4000-8000-000000000000', 901, 9010, 'available');

insert into public.customers
  (id, first_name, last_name, email, phone_e164, phone_country, date_of_birth)
values
  ('c0000000-0000-4000-8000-000000000001', 'Crvtest', 'Guestly',
   'crv.guest@example.test', '+971500009901', 'AE', date '1990-02-02');

insert into public.bookings
  (id, reference, customer_id, suite_id, source, status, experience_period,
   cleaning_buffer_minutes, subtotal_fils, discount_fils, addons_fils,
   service_fee_fils, tax_fils, total_fils)
values
  ('cb010000-0000-4000-8000-000000000000', 'WPCRV01',
   'c0000000-0000-4000-8000-000000000001', 'c9010000-0000-4000-8000-000000000000',
   'online', 'confirmed',
   tstzrange(now() + interval '5 hours', now() + interval '7 hours', '[)'),
   20, 45000, 0, 0, 3000, 1000, 49000);

insert into public.payments
  (id, booking_id, status, method, amount_fils, service_fee_fils, provider_reference)
values
  ('ce010000-0000-4000-8000-000000000001', 'cb010000-0000-4000-8000-000000000000',
   'paid', 'online', 49000, 3000, 'PROV-CRV-9901');

insert into public.refunds
  (id, payment_id, booking_id, amount_fils, reason, is_pending, requested_by)
values
  ('cd010000-0000-4000-8000-000000000001', 'ce010000-0000-4000-8000-000000000001',
   'cb010000-0000-4000-8000-000000000000', 2500, 'Guest left early', true,
   'c2222222-2222-4222-8222-222222222222');

insert into public.messages
  (id, template_key, channel, status, booking_id, customer_id, to_address,
   subject, body, is_marketing, attempt_count, last_attempt_at, failed_at, error)
values
  ('cf010000-0000-4000-8000-000000000001', 'booking_confirmation', 'email', 'failed',
   'cb010000-0000-4000-8000-000000000000', 'c0000000-0000-4000-8000-000000000001',
   'crv.guest@example.test', 'Your booking', 'See you soon',
   false, 2, now() - interval '15 minutes', now() - interval '15 minutes',
   'smtp: mailbox unavailable');

insert into public.cleaning_tasks (id, suite_id, booking_id, status, due_from)
values
  ('ca010000-0000-4000-8000-000000000001', 'c9010000-0000-4000-8000-000000000000',
   'cb010000-0000-4000-8000-000000000000', 'pending', now() - interval '2 hours');

insert into public.alerts (id, kind, severity, entity, entity_id) values
  ('caa10000-0000-4000-8000-000000000000', 'payment_failed', 'critical',
   'public.bookings', 'cb010000-0000-4000-8000-000000000000'),
  ('caa20000-0000-4000-8000-000000000000', 'refund_pending', 'warning',
   'public.refunds', 'cd010000-0000-4000-8000-000000000001'),
  ('caa30000-0000-4000-8000-000000000000', 'message_failed', 'warning',
   'public.messages', 'cf010000-0000-4000-8000-000000000001'),
  ('caa40000-0000-4000-8000-000000000000', 'cleaning_unconfirmed', 'warning',
   'public.cleaning_tasks', 'ca010000-0000-4000-8000-000000000001'),
  ('caa50000-0000-4000-8000-000000000000', 'manual_review_pending', 'warning',
   'public.staff', 'c1111111-1111-4111-8111-111111111111');

insert into public.addons
  (id, name, regular_price_fils, offer_price_fils, sort_order, reception_note)
values
  ('c4000000-0000-4000-8000-000000000001', 'CRV Towel', 4000, 3000, 9910,
   'Return to the linen store');

insert into public.addons
  (id, name, regular_price_fils, offer_price_fils, inventory, sort_order)
values
  ('c4000000-0000-4000-8000-000000000002', 'CRV Sold Out', 2000, 2000, 0, 9920);

insert into public.addons
  (id, name, regular_price_fils, offer_price_fils, available_from, available_to,
   sort_order)
values
  ('c4000000-0000-4000-8000-000000000003', 'CRV Next Season', 2000, 2000,
   current_date + 30, current_date + 60, 9930);

insert into public.addons
  (id, name, regular_price_fils, offer_price_fils, is_active, sort_order)
values
  ('c4000000-0000-4000-8000-000000000004', 'CRV Retired', 1000, 1000, false, 9940);

set local role authenticated;
set local request.jwt.claims = '{"sub":"c1111111-1111-4111-8111-111111111111"}';

select is(
  (select booking_reference from public.open_alerts
    where alert_id = 'caa20000-0000-4000-8000-000000000000'),
  'WPCRV01',
  'refund_pending names the booking it concerns, for a Reception user with no view_confidential_figures grant [§9.3, §10.6]');

select is(
  (select booking_id from public.open_alerts
    where alert_id = 'caa20000-0000-4000-8000-000000000000'),
  'cb010000-0000-4000-8000-000000000000'::uuid,
  'and carries the id the alert centre needs to link to /reception/bookings/[id]');

select is(
  (select count(*)::integer from public.refunds
    where id = 'cd010000-0000-4000-8000-000000000001'),
  0,
  'while the refund row itself stays invisible to that same user — the figure did not move [INV-15]');

select is(
  (select booking_reference from public.open_alerts
    where alert_id = 'caa30000-0000-4000-8000-000000000000'),
  'WPCRV01',
  'message_failed names the booking it concerns [§9.3]');

select is(
  (select booking_id from public.open_alerts
    where alert_id = 'caa30000-0000-4000-8000-000000000000'),
  'cb010000-0000-4000-8000-000000000000'::uuid,
  'message_failed carries the booking id too');

select is(
  (select booking_reference from public.open_alerts
    where alert_id = 'caa40000-0000-4000-8000-000000000000'),
  'WPCRV01',
  'cleaning_unconfirmed names the booking whose suite is waiting [§9.2]');

select is(
  (select booking_reference from public.open_alerts
    where alert_id = 'caa50000-0000-4000-8000-000000000000'),
  null::text,
  'an alert whose entity reaches no booking still resolves to null rather than guessing');

select is(
  (select booking_id from public.open_alerts
    where alert_id = 'caa50000-0000-4000-8000-000000000000'),
  null::uuid,
  'and its booking id is null with it');

select is(
  (select count(*)::integer from public.staff_addons
    where id in ('c4000000-0000-4000-8000-000000000001',
                 'c4000000-0000-4000-8000-000000000002',
                 'c4000000-0000-4000-8000-000000000003',
                 'c4000000-0000-4000-8000-000000000004')),
  2,
  'the staff catalogue drops the inactive add-on and the one outside its sales dates, and keeps the rest [§8]');

select is(
  (select is_sold_out from public.staff_addons
    where id = 'c4000000-0000-4000-8000-000000000002'),
  true,
  'zero inventory reads as sold out at the desk, which the Reception card had no way of knowing [§4.1]');

select is(
  (select is_sold_out from public.staff_addons
    where id = 'c4000000-0000-4000-8000-000000000001'),
  false,
  'null inventory is unlimited and is not sold out');

select is(
  (select count(*)::integer from public.staff_addons
    where id = 'c4000000-0000-4000-8000-000000000003'),
  0,
  'an add-on outside its sales dates is not offered at the desk, because create_reception_booking refuses it with WP038');

select is(
  (select count(*)::integer from public.staff_addons
    where id = 'c4000000-0000-4000-8000-000000000004'),
  0,
  'and neither is a switched-off one');

select is(
  (select reception_note from public.staff_addons
    where id = 'c4000000-0000-4000-8000-000000000001'),
  'Return to the linen store',
  'the §8 preparation or return note reaches staff');

select is(
  (select sort_order from public.staff_addons
    where id = 'c4000000-0000-4000-8000-000000000001'),
  9910,
  'and Management''s display order comes with it, which the guest view withholds');

select is(
  (select count(*)::integer
     from public.staff_addons s
     join public.public_addons p on p.id = s.id
    where p.is_sold_out is distinct from s.is_sold_out),
  0,
  'staff and guest never disagree about what is sold out — there is one expression, not two');

select is(
  (select count(*)::integer from public.public_addons
    where id = 'c4000000-0000-4000-8000-000000000001'),
  1,
  'and the guest view still publishes the same item');

select is(
  (select body from public.message_templates where key = 'booking_reminder'),
  null::text,
  'a template that was never written has no body, which is an empty state and not a read failure [§4.1]');

reset role;

insert into public.message_templates (key, channel, is_active, is_marketing, subject, body, timing_minutes)
values ('booking_reminder', 'email', true, false, 'Your visit tomorrow',
        'We look forward to seeing you.', -1440);

set local role authenticated;
set local request.jwt.claims = '{"sub":"c1111111-1111-4111-8111-111111111111"}';

select is(
  (select body from public.message_templates where key = 'booking_reminder'),
  'We look forward to seeing you.',
  'staff read the stored wording, which the editor needs before it replaces the whole row [§12]');

select is(
  (select timing_minutes from public.message_templates where key = 'booking_reminder'),
  -1440,
  'and the stored timing, which set_message_template also overwrites in full');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000001"}';

select is(
  (select count(*)::integer from public.staff_addons
    where id in ('c4000000-0000-4000-8000-000000000001',
                 'c4000000-0000-4000-8000-000000000002')),
  0,
  'a session that is not staff reads no add-on catalogue at all — the join to public.addons is the boundary [R-03, R-13]');

select is(
  internal.alert_booking_id('public.refunds', 'cd010000-0000-4000-8000-000000000001'),
  null::uuid,
  'and calling the lookup directly without a staff session resolves nothing [§13]');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1111111-1111-4111-8111-111111111111"}';

select is(
  (select count(*)::integer from public.open_alerts
    where booking_reference = 'WPCRV01'),
  4,
  'four of the five seeded alerts reach the same booking, from four different entities [§9.3]');

reset role;

select has_view('public', 'staff_addons',
  'the staff add-on catalogue is a view, so the permission boundary is a database object and not a select list [R-03]');

select * from finish();
rollback;
