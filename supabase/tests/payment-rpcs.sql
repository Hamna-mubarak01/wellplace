begin;
select plan(77);

insert into public.staff (id, email, full_name, role) values
  ('d1111111-1111-4111-8111-111111111111', 'pay.rpc.reception@example.test',  'Pay RPC Reception',  'reception'),
  ('d2222222-2222-4222-8222-222222222222', 'pay.rpc.management@example.test', 'Pay RPC Management', 'management');

insert into public.customers
  (id, first_name, last_name, email, phone_e164, phone_country, date_of_birth)
values
  ('d0000000-0000-4000-8000-000000000001', 'Pay', 'Rpc',
   'pay.rpc.customer@example.test', '+971500003001', 'AE', date '1990-01-01');

insert into public.bookings
  (id, reference, customer_id, source, status, experience_period,
   cleaning_buffer_minutes, total_fils)
values
  ('d1000000-0000-4000-8000-000000000001', 'WPRPC001',
   'd0000000-0000-4000-8000-000000000001', 'walk_in', 'confirmed',
   tstzrange(timestamptz '2027-11-01 09:00+04',
             timestamptz '2027-11-01 11:00+04', '[)'), 20, 50000),
  ('d1000000-0000-4000-8000-000000000002', 'WPRPC002',
   'd0000000-0000-4000-8000-000000000001', 'walk_in', 'confirmed',
   tstzrange(timestamptz '2027-11-02 09:00+04',
             timestamptz '2027-11-02 11:00+04', '[)'), 20, 0),
  ('d1000000-0000-4000-8000-000000000003', 'WPRPC003',
   'd0000000-0000-4000-8000-000000000001', 'walk_in', 'confirmed',
   tstzrange(timestamptz '2027-11-03 09:00+04',
             timestamptz '2027-11-03 11:00+04', '[)'), 20, 40000),
  ('d1000000-0000-4000-8000-000000000004', 'WPRPC004',
   'd0000000-0000-4000-8000-000000000001', 'walk_in', 'confirmed',
   tstzrange(timestamptz '2027-11-04 09:00+04',
             timestamptz '2027-11-04 11:00+04', '[)'), 20, 60000);

create temp view payment_rpc_names as
  select unnest(array[
    'record_booking_payment', 'void_booking_payment', 'record_refund',
    'set_manual_booking_price', 'set_payment_method_fee'
  ]) as proname;
grant select on payment_rpc_names to public;

create temp view payment_audit_actions as
  select unnest(array[
    'record_booking_payment', 'void_booking_payment', 'record_refund',
    'set_manual_booking_price', 'set_payment_method_fee'
  ]) as action;
grant select on payment_audit_actions to public;


select has_function('public', 'record_booking_payment',
  'the desk payment recording exists [§8, §9.2]');
select has_function('public', 'void_booking_payment',
  'a payment is cancelled, never deleted [§8]');
select has_function('public', 'record_refund',
  'refunds are issued by RPC [§8, §11.2]');
select has_function('public', 'set_manual_booking_price',
  'the §6.4 manual price change exists');
select has_function('public', 'set_payment_method_fee',
  'the §8.1 service charge is configured by RPC');

select is(
  (select count(*)::int from pg_proc p join payment_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace),
  5,
  'five functions and no overloads — a stale caller cannot reach a second signature');

select is(
  (select count(*)::int from pg_proc p join payment_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace and p.prosecdef),
  5,
  'every one writes past RLS deliberately [R-15]');

select is(
  (select count(*)::int from pg_proc p join payment_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace
      and array_to_string(p.proconfig, ' ') = 'search_path=""'),
  5,
  'every one pins search_path to empty [R-15]');

select is(
  (select count(*)::int from pg_proc p join payment_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace
      and p.proretset and p.prorettype <> 'void'::regtype),
  5,
  'every one returns a typed row set and never void [R-14]');

select is(
  (select count(*)::int from pg_proc p join payment_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('anon', p.oid, 'execute')),
  0,
  'anon holds EXECUTE on none of them — money is never a guest action [§13, docs/5 §3]');

select is(
  (select count(*)::int from pg_proc p join payment_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('authenticated', p.oid, 'execute')),
  5,
  'authenticated holds EXECUTE on all five [docs/5 §3]');

select is(
  (select count(*)::int from pg_proc p join payment_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('service_role', p.oid, 'execute')),
  5,
  'service_role holds EXECUTE — the permitted worker call sites have no user session');


select ok(
  exists (
    select 1 from pg_trigger t
     where t.tgrelid = 'public.tasks'::regclass
       and t.tgname = 'tasks_set_updated_at'
       and not t.tgisinternal),
  'public.tasks now carries the set_updated_at trigger that A4 gave its three '
  'siblings and missed here');

insert into public.tasks (id, title, updated_at)
values ('d5000000-0000-4000-8000-000000000001', 'Trigger probe',
        timestamptz '2000-01-01 00:00:00+00');

select is(
  (select t.updated_at from public.tasks t
    where t.id = 'd5000000-0000-4000-8000-000000000001'),
  timestamptz '2000-01-01 00:00:00+00',
  'the probe row starts with a deliberately stale updated_at');

update public.tasks set title = 'Trigger probe renamed'
 where id = 'd5000000-0000-4000-8000-000000000001';

select is(
  (select t.updated_at from public.tasks t
    where t.id = 'd5000000-0000-4000-8000-000000000001'),
  now(),
  'and an UPDATE that never names updated_at now moves it — the trigger fires');


set local role authenticated;
set local request.jwt.claims = '{"sub":"d1111111-1111-4111-8111-111111111111","email":"pay.rpc.reception@example.test"}';

select is(
  (select r.payment_status::text || '|' || r.amount_fils::text || '|' ||
          (r.recorded_by = 'd1111111-1111-4111-8111-111111111111'::uuid)::text
     from public.record_booking_payment(
       'd1000000-0000-4000-8000-000000000001', 'cash', 12500,
       null, 'Notes into the till', 'Walk-in settled at the desk') r),
  'paid|12500|true',
  'a CASH payment is recorded, marked paid and carries the receptionist who '
  'took it [§8, §9.2, INV-13]');

select is(
  (select r.payment_status::text || '|' || r.amount_fils::text
     from public.record_booking_payment(
       'd1000000-0000-4000-8000-000000000001', 'card_terminal', 37500,
       'TERM-4471', null, 'Approved on the terminal') r),
  'paid|37500',
  'a CARD TERMINAL payment is recorded and marked paid — no webhook exists for '
  'one and the receptionist is the verification [§8, §9.2]');

select is(
  (select r.payment_status::text
     from public.record_booking_payment(
       'd1000000-0000-4000-8000-000000000004', 'payment_link', 60000,
       'LINK-8830', null, 'Link settled out of band') r),
  'paid',
  'a PAYMENT LINK settled out of band is recordable — §8 lists it as a '
  'Reception action');

select throws_ok(
  $$select public.record_booking_payment(
      'd1000000-0000-4000-8000-000000000001', 'online', 10000,
      'PROV-1', null, 'marking it paid by hand')$$,
  'WP025', null,
  'an ONLINE payment is REFUSED — it becomes paid on the signature-verified '
  'provider webhook and never by hand [§3, §8, INV-08]');

select throws_ok(
  $$select public.record_booking_payment(
      'd1000000-0000-4000-8000-000000000002', 'complimentary', 1,
      null, null, 'a comp that is not free')$$,
  'WP027', null,
  'a COMPLIMENTARY payment of one fils is refused — it is exactly zero or it '
  'is not complimentary [§11.2, INV-20]');

select throws_ok(
  $$select public.record_booking_payment(
      'd1000000-0000-4000-8000-000000000002', 'complimentary', -100,
      null, null, 'a negative comp')$$,
  'WP027', null,
  'and so is a negative one');

select is(
  (select r.payment_status::text || '|' || r.amount_fils::text || '|' ||
          r.booking_comped::text
     from public.record_booking_payment(
       'd1000000-0000-4000-8000-000000000002', 'complimentary', 0,
       null, null, 'Owner guest, comped') r),
  'paid|0|true',
  'a complimentary payment of exactly zero is recorded [§11.2]');

select throws_ok(
  $$select public.record_booking_payment(
      'd1000000-0000-4000-8000-000000000001', 'cash', 0,
      null, null, 'zero cash')$$,
  'WP026', null,
  'a zero CASH payment is refused — zero is only ever complimentary [INV-20]');

select throws_ok(
  $$select public.record_booking_payment(
      'd1000000-0000-4000-8000-000000000001', 'cash', -500,
      null, null, 'negative cash')$$,
  'WP026', null,
  'and a negative one is refused too');

select throws_ok(
  $$select public.record_booking_payment(
      'd1000000-0000-4000-8000-000000000001', 'cash', 1000, null, null, '   ')$$,
  '22023', null,
  'a blank reason is refused — every manual change is audited with one [§3, INV-13]');

select throws_ok(
  $$select public.record_booking_payment(
      'd1000000-0000-4000-8000-000000000001', null, 1000, null, null, 'no method')$$,
  '22004', null,
  'the method is required — §8 reconciles on how the money was taken');

select throws_ok(
  $$select public.record_booking_payment(
      '00000000-0000-4000-8000-000000000000', 'cash', 1000, null, null, 'ghost')$$,
  'P0002', null,
  'a payment against a booking that does not exist is refused');

select throws_ok(
  $$select public.record_booking_payment(
      'd1000000-0000-4000-8000-000000000001', 'cash', 1000,
      '4111111111111111', null, 'a PAN in the reference field')$$,
  '23514', null,
  'anything shaped like a CARD NUMBER is refused by the A3 constraint, which '
  'this migration deliberately does not restate [§13]');

reset role;

select is(
  (select b.is_complimentary from public.bookings b
    where b.id = 'd1000000-0000-4000-8000-000000000002'),
  true,
  'a complimentary payment ALSO flags the booking — a report reading the '
  'booking must not count a comped visit as revenue [§11.2, INV-20]');

select is(
  (select count(*)::int from public.payments p
    where p.booking_id = 'd1000000-0000-4000-8000-000000000001'),
  2,
  'part payments are separate rows — public.payments is one row per attempt, '
  'never one per booking [§8]');


insert into public.payments (id, booking_id, status, method, amount_fils, provider_reference)
values
  ('d2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001',
   'open', 'payment_link', 20000, 'LINK-9001'),
  ('d2000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000001',
   'open', 'payment_link', 30000, 'LINK-9002');

set local role authenticated;

select is(
  (select r.payment_status::text || '|' || r.previous_status::text
     from public.void_booking_payment(
       'd2000000-0000-4000-8000-000000000001',
       'Guest paid cash instead, link withdrawn') r),
  'cancelled|open',
  'an OPEN payment link is voided to cancelled [§8, §4.3]');

select throws_ok(
  $$select public.void_booking_payment(
      'd2000000-0000-4000-8000-000000000001', 'again')$$,
  'WP028', null,
  'voiding twice is refused — the first time is the time it happened');

select throws_ok(
  $$select public.void_booking_payment(
      (select p.id from public.payments p
        where p.booking_id = 'd1000000-0000-4000-8000-000000000001'
          and p.method = 'cash' limit 1),
      'undoing a cash payment by hand')$$,
  'WP028', null,
  'a PAID payment cannot be voided — money that was taken is undone by a '
  'refund with a value and a reason, never a status flip [§8, §11.2, §4.3]');

select throws_ok(
  $$select public.void_booking_payment(
      'd2000000-0000-4000-8000-000000000002', '  ')$$,
  '22023', null,
  'voiding without a reason is refused [§3, INV-13]');

reset role;

select is(
  (select count(*)::int from public.payments p
    where p.id = 'd2000000-0000-4000-8000-000000000001'),
  1,
  'and the voided row still exists — §11.2 reports open and failed payment '
  'events and a delete destroys the only record of one');


set local role authenticated;

select is(
  (select r.payment_status::text || '|' || r.amount_fils::text
     from public.record_booking_payment(
       'd1000000-0000-4000-8000-000000000003', 'cash', 40000,
       null, null, 'Paid in full at the desk') r),
  'paid|40000',
  'a payment to refund against is recorded');

select throws_ok(
  $$select public.record_refund(
      (select p.id from public.payments p
        where p.booking_id = 'd1000000-0000-4000-8000-000000000003' limit 1),
      1000, 'reception trying to refund')$$,
  '42501', null,
  'RECEPTION MAY NOT ISSUE A REFUND — docs/5 §3, "issue a refund: reception '
  'no, management yes"');

set local request.jwt.claims = '{"sub":"d2222222-2222-4222-8222-222222222222","email":"pay.rpc.management@example.test"}';

select throws_ok(
  $$select public.record_refund(
      (select p.id from public.payments p
        where p.booking_id = 'd1000000-0000-4000-8000-000000000003' limit 1),
      50000, 'more than was ever taken')$$,
  'WP029', null,
  'A REFUND LARGER THAN ITS PAYMENT IS REFUSED — the ceiling A3 left to this '
  'function [§8, §11.2]');

select throws_ok(
  $$select public.record_refund(
      (select p.id from public.payments p
        where p.booking_id = 'd1000000-0000-4000-8000-000000000003' limit 1),
      0, 'a refund of nothing')$$,
  'WP026', null,
  'a zero refund is not a refund');

select throws_ok(
  $$select public.record_refund(
      (select p.id from public.payments p
        where p.booking_id = 'd1000000-0000-4000-8000-000000000003' limit 1),
      1000, '   ')$$,
  '22023', null,
  'a refund without a reason is refused — §11.2 reports refunds with reasons');

select is(
  (select r.payment_status::text || '|' || r.refunded_total_fils::text || '|' ||
          r.is_pending::text
     from public.record_refund(
       (select p.id from public.payments p
         where p.booking_id = 'd1000000-0000-4000-8000-000000000003' limit 1),
       15000, 'Add-on the guest never received') r),
  'partially_refunded|15000|true',
  'a partial refund moves the payment to partially_refunded and is created '
  'PENDING [§8, §11.2]');

select throws_ok(
  $$select public.record_refund(
      (select p.id from public.payments p
        where p.booking_id = 'd1000000-0000-4000-8000-000000000003' limit 1),
      30000, 'the second partial that would breach the ceiling')$$,
  'WP029', null,
  'TWO PARTIAL REFUNDS THAT WOULD TOGETHER EXCEED THE PAYMENT ARE REFUSED ON '
  'THE SECOND — the sum is taken inside the payment row lock, which is what a '
  'check constraint could never see [§8, §11.2]');

select is(
  (select r.payment_status::text || '|' || r.refunded_total_fils::text
     from public.record_refund(
       (select p.id from public.payments p
         where p.booking_id = 'd1000000-0000-4000-8000-000000000003' limit 1),
       25000, 'Remainder returned, visit cancelled') r),
  'fully_refunded|40000',
  'the refund that exhausts the payment flips it to FULLY_REFUNDED on the '
  'arithmetic alone — full and partial are not two kinds [§8]');

select throws_ok(
  $$select public.record_refund(
      (select p.id from public.payments p
        where p.booking_id = 'd1000000-0000-4000-8000-000000000003' limit 1),
      1, 'one fils more')$$,
  'WP030', null,
  'and a fully refunded payment has nothing left to give back');

select throws_ok(
  $$select public.record_refund(
      'd2000000-0000-4000-8000-000000000002', 1000, 'refunding an open link')$$,
  'WP030', null,
  'an OPEN payment took no money and cannot be refunded [§8, §4.3]');

select throws_ok(
  $$select public.record_refund(
      '00000000-0000-4000-8000-000000000000', 1000, 'ghost payment')$$,
  'P0002', null,
  'a refund against a payment that does not exist is refused');

reset role;

select is(
  (select count(*)::int from public.refunds r
    where r.payment_id = (select p.id from public.payments p
                           where p.booking_id = 'd1000000-0000-4000-8000-000000000003'
                           limit 1)),
  2,
  'exactly two refund rows survive — the three refusals wrote nothing [§11.2]');

select is(
  (select sum(r.amount_fils)::int from public.refunds r
    where r.payment_id = (select p.id from public.payments p
                           where p.booking_id = 'd1000000-0000-4000-8000-000000000003'
                           limit 1)),
  40000,
  'and they sum to exactly the payment, never past it [§8]');


set local role authenticated;
set local request.jwt.claims = '{"sub":"d1111111-1111-4111-8111-111111111111","email":"pay.rpc.reception@example.test"}';

select throws_ok(
  $$select public.set_manual_booking_price(
      'd1000000-0000-4000-8000-000000000004', 45000, 'goodwill')$$,
  'WP031', null,
  'RECEPTION MAY NOT change a price without perm:manual_price_change [§6.4, '
  'docs/5 §2]');

set local request.jwt.claims = '{"sub":"d2222222-2222-4222-8222-222222222222","email":"pay.rpc.management@example.test"}';

select is(
  (select r.total_fils::text || '|' || r.previous_total_fils::text || '|' || r.reference
     from public.set_manual_booking_price(
       'd1000000-0000-4000-8000-000000000004', 45000,
       'Late arrival, one hour credited') r),
  '45000|60000|WPRPC004',
  'MANAGEMENT MAY BY ROLE, and the old and new totals both come back '
  '[§6.4, INV-13; OUR CHOICE, 17 September 2026]');

reset role;
insert into public.staff_permissions (staff_id, permission) values
  ('d1111111-1111-4111-8111-111111111111', 'manual_price_change');
set local role authenticated;
set local request.jwt.claims = '{"sub":"d1111111-1111-4111-8111-111111111111","email":"pay.rpc.reception@example.test"}';

select throws_ok(
  $$select public.set_manual_booking_price(
      'd1000000-0000-4000-8000-000000000004', 42000, 'goodwill')$$,
  'WP031', null,
  'RECEPTION MAY NOT EVEN WITH A STORED GRANT — permissions are fixed by role '
  '[Project owner''s direction, 17 September 2026]');

set local request.jwt.claims = '{"sub":"d2222222-2222-4222-8222-222222222222","email":"pay.rpc.management@example.test"}';

select is(
  (select r.total_fils::text || '|' || r.previous_total_fils::text
     from public.set_manual_booking_price(
       'd1000000-0000-4000-8000-000000000004', 42000,
       'Second correction agreed with the guest') r),
  '42000|45000',
  'a second correction by Management is applied on top of the first [§6.4, INV-13]');

select throws_ok(
  $$select public.set_manual_booking_price(
      'd1000000-0000-4000-8000-000000000004', 42000, ' ')$$,
  '22023', null,
  'a manual price change without a reason is refused — §6.4 names permission, '
  'a reason and an audit entry together');

select throws_ok(
  $$select public.set_manual_booking_price(
      'd1000000-0000-4000-8000-000000000004', -1, 'negative total')$$,
  'WP026', null,
  'a negative total is refused');

select throws_ok(
  $$select public.set_manual_booking_price(
      '00000000-0000-4000-8000-000000000000', 100, 'ghost booking')$$,
  'P0002', null,
  'a price change on a booking that does not exist is refused');

reset role;

select is(
  (select b.total_fils::text || '|' || b.subtotal_fils::text
     from public.bookings b where b.id = 'd1000000-0000-4000-8000-000000000004'),
  '42000|42000',
  'the supplied figure lands in BOTH total_fils and subtotal_fils, and the '
  'other four components are zeroed, so the breakdown sums to the total. This '
  'assertion previously read 42000|0 and expected total_fils to move alone; '
  'that was the A8 behaviour the adversary pass reported as a defect against '
  'INV-21, because a booking could then read one price in its components and a '
  'different one in its total. Changed by 20260908090000, which made the RPC '
  'responsible for leaving the six columns consistent. See its comment on '
  'public.set_manual_booking_price for why the whole figure goes to subtotal '
  'rather than being rescaled across the old lines.');

select is(
  (select e.old_value ->> 'total_fils' || '|' || (e.new_value ->> 'total_fils')
     from audit.entries e
    where e.action = 'set_manual_booking_price'
      and e.entity_id = 'd1000000-0000-4000-8000-000000000004'
    order by e.id desc limit 1),
  '45000|42000',
  'and the audit entry carries the OLD and the NEW total [§6.4, INV-13]');


set local role authenticated;
set local request.jwt.claims = '{"sub":"d1111111-1111-4111-8111-111111111111","email":"pay.rpc.reception@example.test"}';

select throws_ok(
  $$select public.set_payment_method_fee(
      'card_terminal', true, 2.5, 'Service Fee', 'reception configuring')$$,
  '42501', null,
  'RECEPTION MAY NOT configure the §8.1 charge — docs/5 §3, "configure prices, '
  'promo codes, add-ons: reception no"');

set local request.jwt.claims = '{"sub":"d2222222-2222-4222-8222-222222222222","email":"pay.rpc.management@example.test"}';

select is(
  (select r.is_enabled::text || '|' || r.percent::text || '|' || r.customer_label
     from public.set_payment_method_fee(
       'card_terminal', true, 2.50, 'Service Fee',
       'Terminal charge agreed with the acquirer') r),
  'true|2.50|Service Fee',
  'MANAGEMENT configures the §8.1 charge per method');

select is(
  (select r.is_enabled::text || '|' || r.percent::text
     from public.set_payment_method_fee(
       'card_terminal', false, 0, 'Service Fee',
       'Charge switched off while the rate is renegotiated') r),
  'false|0.00',
  'and the same call changes it — §8.1 gives Management a visible enable and a '
  'complete disable');

select throws_ok(
  $$select public.set_payment_method_fee(
      'cash', true, 101, 'Service Fee', 'out of range')$$,
  'WP032', null,
  'a percentage outside 0 to 100 is refused — a storage plausibility limit, '
  'never a business rule [§8.1, INV-16]');

select throws_ok(
  $$select public.set_payment_method_fee(
      'cash', null, 5, 'Service Fee', 'unstated switch')$$,
  '22004', null,
  'p_is_enabled is required — a boolean has no third value meaning unchanged');

select throws_ok(
  $$select public.set_payment_method_fee(
      'cash', true, null, 'Service Fee', 'unstated percentage')$$,
  '22004', null,
  'p_percent is required [§8.1]');

select throws_ok(
  $$select public.set_payment_method_fee(
      'cash', true, 5, '   ', 'unlabelled charge')$$,
  '22023', null,
  'an unlabelled charge is refused — §8.1 puts this line in front of a guest');

select throws_ok(
  $$select public.set_payment_method_fee(
      'cash', true, 5, 'Service Fee', '')$$,
  '22023', null,
  'and a configuration change without a reason is refused — §8.1 requires '
  'every change to be logged [INV-13]');

reset role;

select is(
  (select count(*)::int from public.payment_method_fees f),
  1,
  'the upsert changed the one row rather than adding a second — the primary '
  'key is the method [§8.1]');

select is(
  (select (e.old_value is null)::text
     from audit.entries e
    where e.action = 'set_payment_method_fee'
    order by e.id asc limit 1),
  'true',
  'the first configuration of a method audits a null old value [INV-13]');

select is(
  (select e.old_value ->> 'percent'
     from audit.entries e
    where e.action = 'set_payment_method_fee'
    order by e.id desc limit 1),
  '2.50',
  'and the change after it audits the previous row [§8.1, INV-13]');


select is(
  (select array_agg(distinct e.action order by e.action)
     from audit.entries e join payment_audit_actions a on a.action = e.action),
  (select array_agg(a.action order by a.action) from payment_audit_actions a),
  'EVERY MUTATION WROTE ITS OWN AUDIT ENTRY [R-14, INV-13]');

select ok(
  not exists (
    select 1 from audit.entries e join payment_audit_actions a on a.action = e.action
     where e.entity is null or e.entity_id is null or e.reason is null),
  'and not one was written without an entity, an entity id or a reason [§3]');

select ok(
  not exists (
    select 1 from audit.entries e join payment_audit_actions a on a.action = e.action
     where e.actor_id is null),
  'every one names its actor [INV-13]');

select is(
  (select count(*)::int from audit.entries e
    where e.action = 'record_booking_payment'
      and e.entity = 'public.bookings'),
  1,
  'and flagging a booking complimentary wrote its own entry with the old and '
  'new value, rather than hiding inside the payment entry [INV-20, INV-13]');


set local request.jwt.claims = '';
set local role anon;

select throws_ok(
  $$select public.record_booking_payment(
      '00000000-0000-4000-8000-000000000000', 'cash', 100, null, null, 'because')$$,
  '42501', null,
  'anon cannot record a payment');

select throws_ok(
  $$select public.void_booking_payment(
      '00000000-0000-4000-8000-000000000000', 'because')$$,
  '42501', null,
  'anon cannot void one');

select throws_ok(
  $$select public.record_refund(
      '00000000-0000-4000-8000-000000000000', 100, 'because')$$,
  '42501', null,
  'anon cannot issue a refund');

select throws_ok(
  $$select public.set_manual_booking_price(
      '00000000-0000-4000-8000-000000000000', 100, 'because')$$,
  '42501', null,
  'anon cannot change a price');

select throws_ok(
  $$select public.set_payment_method_fee(
      'cash', true, 5, 'Service Fee', 'because')$$,
  '42501', null,
  'anon cannot configure the §8.1 charge');

reset role;


select * from finish();
rollback;
