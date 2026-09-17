begin;
select plan(78);

insert into public.staff (id, email, full_name, role) values
  ('c1111111-1111-4111-8111-111111111111', 'pay.reception@example.test',  'Pay Reception',  'reception'),
  ('c2222222-2222-4222-8222-222222222222', 'pay.management@example.test', 'Pay Management', 'management');

insert into public.customers
  (id, first_name, last_name, email, phone_e164, phone_country, date_of_birth)
values
  ('c0000000-0000-4000-8000-000000000001', 'Pay', 'Customer',
   'pay.customer@example.test', '+971500002001', 'AE', date '1990-01-01');

insert into public.bookings
  (id, reference, customer_id, source, status, experience_period,
   cleaning_buffer_minutes, total_fils)
values
  ('c1000000-0000-4000-8000-000000000001', 'WPPAY001',
   'c0000000-0000-4000-8000-000000000001', 'online', 'confirmed',
   tstzrange(timestamptz '2026-11-01 09:00+04',
             timestamptz '2026-11-01 11:00+04', '[)'), 20, 50000);

select has_table('public', 'payments',            'the payment exists [§8]');
select has_table('public', 'payment_events',      'provider callbacks are stored [§8, INV-09]');
select has_table('public', 'refunds',             'refunds are recorded [§8, §11.2]');
select has_table('public', 'payment_method_fees', 'the service fee is configured per method [§8.1]');

select is(
  (select relrowsecurity from pg_class where oid = 'public.payments'::regclass),
  true, 'RLS is enabled on payments [R-13]');
select is(
  (select relrowsecurity from pg_class where oid = 'public.payment_events'::regclass),
  true, 'RLS is enabled on payment_events [R-13]');
select is(
  (select relrowsecurity from pg_class where oid = 'public.refunds'::regclass),
  true, 'RLS is enabled on refunds [R-13]');
select is(
  (select relrowsecurity from pg_class where oid = 'public.payment_method_fees'::regclass),
  true, 'RLS is enabled on payment_method_fees [R-13]');

select is(
  (select array_agg(e.enumlabel::text order by e.enumsortorder)
     from pg_enum e where e.enumtypid = 'public.payment_status'::regtype),
  array['open','pending','paid','partially_refunded','fully_refunded',
        'failed','cancelled','manual_review'],
  'payment_status is character-identical to PAYMENT_STATUSES in src/components/console/reception/booking-filters.ts [§8]');

select is(
  (select count(*)::int from pg_enum e
    where e.enumtypid = 'public.payment_status'::regtype),
  8,
  'all eight contractual payment states exist and no ninth was invented [§8]');

select is(
  (select array_agg(e.enumlabel::text order by e.enumsortorder)
     from pg_enum e where e.enumtypid = 'public.payment_method'::regtype),
  array['cash','card_terminal','payment_link','online','complimentary'],
  'payment_method carries the four §8 Reception recordings plus the guest path');

select lives_ok(
  $$insert into public.payments
      (id, booking_id, status, method, amount_fils, service_fee_fils,
       provider_reference)
    values ('c3000000-0000-4000-8000-000000000001',
            'c1000000-0000-4000-8000-000000000001', 'paid', 'online',
            50000, 3000, 'PROV-ORD-99XZ')$$,
  'an online payment records its amount, its fee and its gateway reference [§8]');

select is(
  (select service_fee_fils from public.payments
    where id = 'c3000000-0000-4000-8000-000000000001'),
  3000,
  'the §8.1 fee is stored as its own line, never folded into the amount [INV-19]');

select lives_ok(
  $$insert into public.payments
      (id, booking_id, status, method, amount_fils, recorded_by)
    values ('c3000000-0000-4000-8000-000000000002',
            'c1000000-0000-4000-8000-000000000001', 'paid', 'cash',
            20000, 'c1111111-1111-4111-8111-111111111111')$$,
  'reception records a cash walk-in payment against the booking [§8, §9.2]');

select lives_ok(
  $$insert into public.payments
      (booking_id, status, method, amount_fils, recorded_by)
    values ('c1000000-0000-4000-8000-000000000001', 'paid', 'card_terminal',
            15000, 'c1111111-1111-4111-8111-111111111111')$$,
  'reception records a card terminal payment [§8]');

select lives_ok(
  $$insert into public.payments
      (booking_id, status, method, amount_fils, recorded_by)
    values ('c1000000-0000-4000-8000-000000000001', 'open', 'payment_link',
            15000, 'c1111111-1111-4111-8111-111111111111')$$,
  'an open payment link exists and is not yet realised revenue [§8]');

select lives_ok(
  $$insert into public.payments
      (booking_id, status, method, amount_fils, recorded_by)
    values ('c1000000-0000-4000-8000-000000000001', 'paid', 'complimentary',
            0, 'c1111111-1111-4111-8111-111111111111')$$,
  'a complimentary payment of zero is representable and reconcilable [§11.2, INV-20]');

select is(
  (select recorded_by from public.payments
    where id = 'c3000000-0000-4000-8000-000000000001'),
  null,
  'an online payment carries no staff actor, and is not forced to invent one [INV-13]');

select throws_ok(
  $$insert into public.payments
      (booking_id, status, method, amount_fils)
    values ('c1000000-0000-4000-8000-000000000001', 'paid', 'cash', -1)$$,
  '23514', null,
  'a negative payment amount is refused [R-16]');

select throws_ok(
  $$insert into public.payments
      (booking_id, status, method, amount_fils, service_fee_fils)
    values ('c1000000-0000-4000-8000-000000000001', 'paid', 'cash', 100, -1)$$,
  '23514', null,
  'a negative service fee is refused [R-16, §8.1]');

select throws_ok(
  $$update public.payments set amount_fils = -5
     where id = 'c3000000-0000-4000-8000-000000000001'$$,
  '23514', null,
  'a payment cannot be updated to a negative amount [R-16]');

select throws_ok(
  $$insert into public.payments
      (booking_id, status, method, amount_fils, provider_reference)
    values ('c1000000-0000-4000-8000-000000000001', 'paid', 'card_terminal',
            100, '4111111111111111')$$,
  '23514', null,
  'a bare card number in provider_reference is refused [§13]');

select throws_ok(
  $$insert into public.payments
      (booking_id, status, method, amount_fils, provider_reference)
    values ('c1000000-0000-4000-8000-000000000001', 'paid', 'card_terminal',
            100, '4111 1111 1111 1111')$$,
  '23514', null,
  'a spaced card number in provider_reference is refused [§13]');

select throws_ok(
  $$insert into public.payments
      (booking_id, status, method, amount_fils, provider_reference)
    values ('c1000000-0000-4000-8000-000000000001', 'paid', 'card_terminal',
            100, '4111-1111-1111-1111')$$,
  '23514', null,
  'a hyphenated card number in provider_reference is refused [§13]');

select lives_ok(
  $$insert into public.payments
      (booking_id, status, method, amount_fils, provider_reference)
    values ('c1000000-0000-4000-8000-000000000001', 'paid', 'card_terminal',
            100, '1762934400000')$$,
  'a thirteen-digit millisecond reference is NOT mistaken for a card [§8]');

select throws_ok(
  $$insert into public.payments
      (booking_id, status, method, amount_fils, provider_reference)
    values ('c1000000-0000-4000-8000-000000000001', 'paid', 'cash', 100, '   ')$$,
  '23514', null,
  'a blank provider reference is refused — absent is null, not whitespace');

select throws_ok(
  $$delete from public.bookings
     where id = 'c1000000-0000-4000-8000-000000000001'$$,
  '23503', null,
  'a booking carrying a payment cannot be silently deleted [§8, §11.2]');

update public.payments set updated_at = timestamptz '2020-01-01 00:00:00+00'
 where id = 'c3000000-0000-4000-8000-000000000001';

select is(
  (select updated_at from public.payments
    where id = 'c3000000-0000-4000-8000-000000000001'),
  now(),
  'a caller cannot backdate a payment''s updated_at by hand [R-16]');

select lives_ok(
  $$insert into public.payment_events
      (id, payment_id, booking_id, provider, provider_event_id,
       signature_verified, payload)
    values ('c4000000-0000-4000-8000-000000000001',
            'c3000000-0000-4000-8000-000000000001',
            'c1000000-0000-4000-8000-000000000001',
            'provider', 'evt_000000001', true, '{"status":"paid"}'::jsonb)$$,
  'a verified provider callback is stored [§8]');

select throws_ok(
  $$insert into public.payment_events
      (payment_id, booking_id, provider, provider_event_id, signature_verified)
    values ('c3000000-0000-4000-8000-000000000001',
            'c1000000-0000-4000-8000-000000000001',
            'provider', 'evt_000000001', true)$$,
  '23505', null,
  'THE IDEMPOTENCY GUARANTEE: a repeated (provider, provider_event_id) is refused at database level [§8, §16.1, INV-09]');

select lives_ok(
  $$insert into public.payment_events
      (provider, provider_event_id, signature_verified)
    values ('tabby', 'evt_000000001', true)$$,
  'the same event id from a different provider is a different event [INV-09]');

select is(
  (select count(*)::int from public.payment_events
    where provider_event_id = 'evt_000000001'),
  2,
  'the replay left exactly one row per provider, and created no duplicate [INV-09]');

select lives_ok(
  $$insert into public.payment_events
      (provider, provider_event_id, signature_verified)
    values ('provider', 'evt_forged_01', false)$$,
  'a callback that FAILED signature verification is still stored, never dropped [§8, INV-08]');

select is(
  (select signature_verified from public.payment_events
    where provider_event_id = 'evt_forged_01'),
  false,
  'the verification result is stored, so a rejected delivery stays countable [§8, §9.3]');

select is(
  (select processed_at from public.payment_events
    where id = 'c4000000-0000-4000-8000-000000000001'),
  null,
  'an accepted but unhandled delivery is visible as a row, not absent as a gap [§8]');

select throws_ok(
  $$insert into public.payment_events
      (provider, provider_event_id, signature_verified)
    values ('PROVIDER', 'evt_000000002', true)$$,
  '23514', null,
  'a mixed-case provider is refused, so one provider cannot become two [INV-09]');

select throws_ok(
  $$insert into public.payment_events
      (provider, provider_event_id, signature_verified)
    values ('provider', 'evt_000000003', null)$$,
  '23502', null,
  'a callback with no recorded verification result is refused [§8, INV-08]');

select lives_ok(
  $$insert into public.refunds
      (id, payment_id, booking_id, amount_fils, reason, requested_by)
    values ('c5000000-0000-4000-8000-000000000001',
            'c3000000-0000-4000-8000-000000000001',
            'c1000000-0000-4000-8000-000000000001',
            10000, 'Guest cancelled inside the window',
            'c2222222-2222-4222-8222-222222222222')$$,
  'a partial refund is an amount and a reason [§8, §11.2]');

select is(
  (select is_pending from public.refunds
    where id = 'c5000000-0000-4000-8000-000000000001'),
  true,
  'a refund starts pending, which §8 lists as a state [§8]');

select lives_ok(
  $$insert into public.refunds
      (payment_id, booking_id, amount_fils, reason)
    values ('c3000000-0000-4000-8000-000000000001',
            'c1000000-0000-4000-8000-000000000001',
            40000, 'No suite could be secured after late payment confirmation')$$,
  'the §8.2 automatic refund has no staff requester and is still recordable [§8.2, INV-11]');

select throws_ok(
  $$insert into public.refunds
      (payment_id, booking_id, amount_fils, reason)
    values ('c3000000-0000-4000-8000-000000000001',
            'c1000000-0000-4000-8000-000000000001', 0, 'Nothing to give back')$$,
  '23514', null,
  'a zero refund is refused [§11.2]');

select throws_ok(
  $$insert into public.refunds
      (payment_id, booking_id, amount_fils, reason)
    values ('c3000000-0000-4000-8000-000000000001',
            'c1000000-0000-4000-8000-000000000001', -100, 'Negative')$$,
  '23514', null,
  'a negative refund is refused [R-16, §11.2]');

select throws_ok(
  $$insert into public.refunds
      (payment_id, booking_id, amount_fils, reason)
    values ('c3000000-0000-4000-8000-000000000001',
            'c1000000-0000-4000-8000-000000000001', 100, '   ')$$,
  '23514', null,
  'a refund with no reason is refused — it could not be reconciled [§11.2]');

select throws_ok(
  $$update public.refunds
       set settled_at = now()
     where id = 'c5000000-0000-4000-8000-000000000001'$$,
  '23514', null,
  'a settled refund cannot still be pending [§8]');

select lives_ok(
  $$update public.refunds
       set is_pending = false, settled_at = now()
     where id = 'c5000000-0000-4000-8000-000000000001'$$,
  'settling a refund clears the pending state in the same statement [§8]');

select lives_ok(
  $$update public.refunds
       set is_pending = false
     where payment_id = 'c3000000-0000-4000-8000-000000000001'
       and settled_at is null$$,
  'a refund that failed at the provider stops being pending without settling [§9.3]');

select lives_ok(
  $$insert into public.refunds
      (payment_id, booking_id, amount_fils, reason)
    values ('c3000000-0000-4000-8000-000000000001',
            'c1000000-0000-4000-8000-000000000001', 999999,
            'The ceiling is enforced by the refund RPC under a row lock, not here')$$,
  'the database does NOT cap a refund at its payment — accumulation needs a lock, see the constraint comment [R-14]');

select is(
  (select count(*)::int from public.payment_method_fees),
  0,
  'the fee table ships empty — only Tabby at 6% is named and it lives in the settings registry [§8.1, Q-7, Q-15]');

select lives_ok(
  $$insert into public.payment_method_fees (method, customer_label)
    values ('online', 'Service Fee')$$,
  'a method can be configured with a label [§8.1]');

select is(
  (select is_enabled::text || ':' || percent::text from public.payment_method_fees
    where method = 'online'),
  'false:0.00',
  'a fee arrives disabled at zero — public activation stays under WellPlace control [§8.1]');

select is(
  (select pg_catalog.format_type(a.atttypid, a.atttypmod)
     from pg_attribute a
    where a.attrelid = 'public.payment_method_fees'::regclass
      and a.attname = 'percent'),
  'numeric(5,2)',
  'the percentage is exact fixed point, never a binary floating type [R-16]');

select lives_ok(
  $$update public.payment_method_fees
       set is_enabled = true, percent = 6.00,
           updated_by = 'c2222222-2222-4222-8222-222222222222'
     where method = 'online'$$,
  'Management may enable a fee and set its percentage [§8.1]');

select is(
  (select updated_at from public.payment_method_fees where method = 'online'),
  now(),
  'the updated_at trigger fires on the fee configuration [§8.1, R-16]');

select throws_ok(
  $$update public.payment_method_fees set percent = 101 where method = 'online'$$,
  '23514', null,
  'a percentage outside 0 to 100 is refused as a storage plausibility bound [INV-16]');

select throws_ok(
  $$insert into public.payment_method_fees (method, customer_label)
    values ('cash', '  ')$$,
  '23514', null,
  'an unlabelled charge is refused — the guest must be told what it is [§8.1, §5.5]');

set local role authenticated;
set local request.jwt.claims = '{"sub":"c1111111-1111-4111-8111-111111111111"}';

select is(
  (select count(*)::int from public.payments),
  6,
  'reception: reads every payment, so §9.2 recording and §9.1 payment-reference search work');

select is(
  (select count(*)::int from public.refunds),
  0,
  'reception: sees NO refunds without the named permission [§10.6, INV-15, docs/5 §3]');

select is(
  (select count(*)::int from public.payment_events),
  0,
  'reception: provider callbacks are invisible — plumbing, not an operational surface [§13]');

select is(
  (select count(*)::int from public.payment_method_fees),
  1,
  'reception: reads the configured fee, because a configured rule is not a figure [docs/5 §3]');

select ok(
  not internal.has_permission('view_confidential_figures'),
  'reception: holds no confidential-figures grant by role alone [§10.6]');

select throws_ok(
  $$insert into public.payments
      (booking_id, status, method, amount_fils)
    values ('c1000000-0000-4000-8000-000000000001', 'paid', 'cash', 100)$$,
  '42501', null,
  'reception: CANNOT record a payment directly — the RPC audits it [R-02, R-14, INV-13]');

select throws_ok(
  $$update public.payments set status = 'paid'
     where id = 'c3000000-0000-4000-8000-000000000002'$$,
  '42501', null,
  'reception: CANNOT change a payment directly [R-14, INV-13]');

select throws_ok(
  $$delete from public.payments
     where id = 'c3000000-0000-4000-8000-000000000002'$$,
  '42501', null,
  'reception: CANNOT delete a payment [§10.6]');

select throws_ok(
  $$insert into public.refunds
      (payment_id, booking_id, amount_fils, reason)
    values ('c3000000-0000-4000-8000-000000000001',
            'c1000000-0000-4000-8000-000000000001', 100, 'Sneaky')$$,
  '42501', null,
  'reception: CANNOT issue a refund [docs/5 §3, §11.2]');

select throws_ok(
  $$insert into public.payment_events
      (provider, provider_event_id, signature_verified)
    values ('provider', 'evt_reception', true)$$,
  '42501', null,
  'reception: CANNOT forge a provider callback [§8, INV-08]');

select throws_ok(
  $$update public.payment_method_fees set percent = 20 where method = 'online'$$,
  '42501', null,
  'reception: CANNOT configure the service fee [§8.1, docs/5 §3]');

reset role;
insert into public.staff_permissions (staff_id, permission)
  values ('c1111111-1111-4111-8111-111111111111', 'view_confidential_figures');

set local role authenticated;
set local request.jwt.claims = '{"sub":"c1111111-1111-4111-8111-111111111111"}';

select ok(
  not internal.has_permission('view_confidential_figures'),
  'reception: a stored grant no longer unlocks confidential figures [§10.6, INV-15; Project owner''s direction, 17 September 2026]');

select is(
  (select count(*)::int from public.refunds),
  0,
  'reception with a stored grant: still reads no refund [§10.6, docs/5 §3]');

select throws_ok(
  $$insert into public.refunds
      (payment_id, booking_id, amount_fils, reason)
    values ('c3000000-0000-4000-8000-000000000001',
            'c1000000-0000-4000-8000-000000000001', 100, 'Still not allowed')$$,
  '42501', null,
  'reception WITH the permission: reads refunds, still CANNOT issue one [docs/5 §3]');

select is(
  (select count(*)::int from public.payment_events),
  0,
  'reception WITH the permission: payment_events stays Management only [§13]');

set local request.jwt.claims = '{"sub":"c2222222-2222-4222-8222-222222222222"}';

select is(
  (select count(*)::int from public.refunds),
  3,
  'management: reads refunds implicitly, with no explicit grant [§10.6]');

select is(
  (select count(*)::int from public.payment_events),
  3,
  'management: reads provider callbacks [§8]');

select throws_ok(
  $$update public.payment_method_fees set percent = 20 where method = 'online'$$,
  '42501', null,
  'management: configures the fee through an audited RPC, not a table write [§8.1, R-14]');

reset role;
set local role anon;

select throws_ok($$select * from public.payments$$, '42501', null,
  'anon: CANNOT read payments [§13]');
select throws_ok($$select * from public.payment_events$$, '42501', null,
  'anon: CANNOT read provider callbacks [§13]');
select throws_ok($$select * from public.refunds$$, '42501', null,
  'anon: CANNOT read refunds [§13]');
select throws_ok($$select * from public.payment_method_fees$$, '42501', null,
  'anon: CANNOT read the fee configuration [§13]');

select throws_ok(
  $$insert into public.payment_events
      (provider, provider_event_id, signature_verified)
    values ('provider', 'evt_anon', true)$$,
  '42501', null,
  'anon: CANNOT forge a webhook — the handler is service-role behind a signature check [§8, INV-08]');

reset role;
select * from finish();
rollback;
