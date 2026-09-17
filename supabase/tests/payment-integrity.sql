begin;
select plan(52);

insert into public.staff (id, email, full_name, role) values
  ('b8a00000-0000-4000-8000-000000000001', 'integrity.reception@example.test', 'Integrity Reception', 'reception'),
  ('b8a00000-0000-4000-8000-000000000002', 'integrity.manager@example.test',   'Integrity Manager',   'management'),
  ('b8a00000-0000-4000-8000-000000000003', 'integrity.pricer@example.test',    'Integrity Pricer',    'management');
insert into public.staff_permissions (staff_id, permission, reason) values
  ('b8a00000-0000-4000-8000-000000000003', 'manual_price_change', 'Payment integrity fixture');

create temp table ids (label text primary key, id uuid not null);
create temp table steps (label text primary key, result jsonb);

create function pg_temp.id(p_label text) returns uuid language sql stable as $$
  select i.id from ids i where i.label = p_label
$$;

create function pg_temp.vat_within(p_gross integer) returns integer language sql stable as $$
  select p_gross - round(p_gross / (1 + (s.value #>> '{}')::numeric / 100))::integer
    from public.settings s
   where s.key = 'tax.vat_percent'
$$;

create function pg_temp.quoted_total(p_adults integer) returns integer language sql immutable as $$
  select 33000 * p_adults
$$;

create function pg_temp.consent() returns jsonb language sql immutable as $$
  select '[{"document_slug":"legal-terms","document_version":"1.3","checkbox_text":"I agree"}]'::jsonb
$$;

create function pg_temp.progress(p_token uuid, p_starts_at timestamptz, p_adults integer)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'identity', jsonb_build_object(
      'salutation', 'mr', 'firstName', 'Integrity', 'lastName', 'Guest',
      'email', p_token::text || '@example.test', 'dateOfBirth', '1990-01-01',
      'phoneE164', '+971500000001', 'phoneCountry', 'AE'),
    'selection', jsonb_build_object(
      'startsAt', to_char(p_starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS".000Z"'),
      'durationHours', 2, 'adults', p_adults, 'childAges', '[]'::jsonb,
      'addonQuantities', '{}'::jsonb, 'voucherCode', '', 'personalRequest', '',
      'paymentOption', 'card'),
    'acceptedTerms', true,
    'lastCompletedStep', 'confirm')
$$;

create function pg_temp.quote(p_progress jsonb) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'breakdown', jsonb_build_object(
      'outcome', 'priced',
      'subtotalFils', pg_temp.quoted_total(guests.adults),
      'discountFils', 0, 'addonsTotalFils', 0, 'serviceFeeFils', 0,
      'taxFils', pg_temp.vat_within(pg_temp.quoted_total(guests.adults)),
      'totalFils', pg_temp.quoted_total(guests.adults),
      'regularTotalFils', 44000 * guests.adults, 'savingFils', 11000 * guests.adults,
      'taxIsIncluded', true, 'lines', '[]'::jsonb),
    'cart', '[]'::jsonb, 'taxLabel', 'VAT', 'offerLabel', 'Special offer',
    'progress', p_progress)
    from (select (p_progress -> 'selection' ->> 'adults')::integer as adults) as guests
$$;

create function pg_temp.hold(p_suite uuid, p_starts_at timestamptz) returns uuid language sql as $$
  insert into public.suite_occupancy
    (suite_id, kind, experience_period, blocked_period, cleaning_buffer_minutes, expires_at)
  values
    (p_suite, 'hold',
     tstzrange(p_starts_at, p_starts_at + interval '2 hours', '[)'),
     tstzrange(p_starts_at, p_starts_at + interval '2 hours 20 minutes', '[)'),
     20, now() + interval '10 minutes')
  returning id
$$;

create function pg_temp.open_checkout(p_checkout text, p_suite_number integer, p_starts_at timestamptz)
returns table (checkout_label text, checkout_id uuid) language plpgsql as $$
declare
  v_token uuid := gen_random_uuid();
  v_suite uuid := gen_random_uuid();
  v_hold  uuid;
begin
  insert into public.suites (id, suite_number, status, priority)
  values (v_suite, p_suite_number, 'available', -9999);
  v_hold := pg_temp.hold(v_suite, p_starts_at);
  insert into internal.guest_checkout_holds (token, occupancy_id) values (v_token, v_hold);
  return query values
    (p_checkout || '.token', v_token),
    (p_checkout || '.suite', v_suite),
    (p_checkout || '.hold',  v_hold);
end
$$;

create function pg_temp.prepare(p_checkout text, p_adults integer, p_simulated boolean)
returns uuid language plpgsql as $$
declare
  v_token    uuid := pg_temp.id(p_checkout || '.token');
  v_starts   timestamptz;
  v_progress jsonb;
begin
  select lower(o.experience_period) into v_starts
    from internal.guest_checkout_holds h
    join public.suite_occupancy o on o.id = h.occupancy_id
   where h.token = v_token;
  v_progress := pg_temp.progress(v_token, v_starts, p_adults);
  perform public.save_checkout_progress(v_token, v_progress, pg_temp.consent(), 30);
  return (public.prepare_guest_payment(
            v_token, gen_random_uuid(), pg_temp.quote(v_progress),
            public.checkout_revision(), 'AED', p_simulated) ->> 'paymentId')::uuid;
end
$$;

create function pg_temp.settle(p_payment uuid, p_outcome text) returns jsonb language sql as $$
  select public.settle_payment_event(
           case when p.is_simulated then 'simulation' else 'provider' end,
           internal.opaque_reference('INTEGRITY-', p.id) || '-' || upper(p_outcome),
           p.id, p_outcome, p.amount_fils, 'AED', true,
           case when p.is_simulated then '{}'::jsonb
                else jsonb_build_object('transactionReference', internal.opaque_reference('PROV-', p.id)) end)
    from public.payments p
   where p.id = p_payment
$$;

create function pg_temp.lapse(p_checkout text) returns integer language plpgsql as $$
begin
  update public.suite_occupancy
     set expires_at = now() - interval '1 second'
   where id = pg_temp.id(p_checkout || '.hold');
  update internal.checkout_attempts
     set reservation_expires_at = now() - interval '1 second'
   where token = pg_temp.id(p_checkout || '.token') and result is null;
  return internal.release_expired_occupancy();
end
$$;

create function pg_temp.rehold(p_checkout text, p_starts_at timestamptz) returns uuid language plpgsql as $$
declare
  v_hold uuid := pg_temp.hold(pg_temp.id(p_checkout || '.suite'), p_starts_at);
begin
  update internal.guest_checkout_holds
     set occupancy_id = v_hold
   where token = pg_temp.id(p_checkout || '.token');
  return v_hold;
end
$$;

create function pg_temp.booking_of(p_payment uuid) returns uuid language sql stable as $$
  select p.booking_id from public.payments p where p.id = p_payment
$$;

create function pg_temp.claim(p_occupancy uuid) returns jsonb language sql stable as $$
  select jsonb_build_object('active', o.is_active, 'status', o.status, 'kind', o.kind)
    from public.suite_occupancy o
   where o.id = p_occupancy
$$;

create function pg_temp.refunds_of(p_payment uuid) returns jsonb language sql stable as $$
  select jsonb_agg(jsonb_build_object(
           'amount', r.amount_fils, 'pending', r.is_pending,
           'settled', r.settled_at is not null, 'withdrawn', r.withdrawn_at is not null,
           'automatic', r.requested_by is null)
           order by r.requested_at, r.id)
    from public.refunds r
   where r.payment_id = p_payment
$$;

create function pg_temp.alerts_for(p_entity uuid) returns text[] language sql stable as $$
  select coalesce(array_agg(a.kind::text order by a.kind::text), '{}')
    from internal.detect_operational_alerts(now()) a
   where a.entity_id = p_entity::text
$$;

create function pg_temp.desk_booking(p_day integer) returns uuid language plpgsql as $$
declare
  v_customer uuid := gen_random_uuid();
  v_booking  uuid;
begin
  insert into public.customers (id, first_name, last_name, email, phone_e164, phone_country, date_of_birth)
  values (v_customer, 'Desk', 'Guest', v_customer::text || '@example.test', '+971500000002', 'AE', date '1990-01-01');
  insert into public.bookings
    (reference, customer_id, source, status, experience_period, cleaning_buffer_minutes,
     subtotal_fils, tax_fils, total_fils)
  values
    (internal.next_booking_reference(), v_customer, 'walk_in', 'confirmed',
     tstzrange(timestamptz '2047-05-01 06:00Z' + make_interval(days => p_day),
               timestamptz '2047-05-01 08:00Z' + make_interval(days => p_day), '[)'),
     20, pg_temp.quoted_total(2), pg_temp.vat_within(pg_temp.quoted_total(2)), pg_temp.quoted_total(2))
  returning id into v_booking;
  return v_booking;
end
$$;

create function pg_temp.desk_payment(p_booking uuid, p_method public.payment_method, p_amount integer)
returns uuid language sql as $$
  select r.payment_id from public.record_booking_payment(p_booking, p_method, p_amount, null, null, 'Paid at the desk') r
$$;

create function pg_temp.request_refund(p_payment uuid, p_amount integer, p_reason text)
returns uuid language sql as $$
  select public.request_payment_refund(p_payment, p_amount, p_reason, gen_random_uuid())
$$;

select ok(
  pg_temp.vat_within(pg_temp.quoted_total(2)) between 1 and pg_temp.quoted_total(2) - 1,
  'control: the VAT this file derives from tax.vat_percent for a two-guest visit is a positive part of the price, so no VAT assertion below passes as zero equals zero [CLIENT pricing specification: 5% VAT included]');


insert into ids select * from pg_temp.open_checkout('retried', 9811, timestamptz '2047-03-03 06:00Z');
insert into ids (label, id) select 'retried.first', pg_temp.prepare('retried', 2, true);
insert into ids (label, id) select 'retried.booking', pg_temp.booking_of(pg_temp.id('retried.first'));
insert into steps select 'retried.first.declined', pg_temp.settle(pg_temp.id('retried.first'), 'failed');
insert into ids (label, id) select 'retried.second', pg_temp.prepare('retried', 2, true);

select is(
  pg_temp.booking_of(pg_temp.id('retried.second')),
  pg_temp.id('retried.booking'),
  'precondition: the declined guest''s retry is a second payment attempt on the SAME booking, for the same amount [§8; §16.1 a failed payment can be retried until the hold expires; INV-10]');

select is(
  pg_temp.settle(pg_temp.id('retried.first'), 'success') ->> 'status',
  'refunded',
  'a success for the EARLIER attempt, delivered after the guest retried, settles as refunded and never as confirmed [§8; INV-09, INV-11]');

select is(
  (select jsonb_build_object('status', b.status, 'occupancy', b.occupancy_id)
     from public.bookings b where b.id = pg_temp.id('retried.booking')),
  jsonb_build_object('status', 'awaiting_payment', 'occupancy', null),
  'the stale payment does not confirm the booking — it keeps awaiting_payment for the attempt still in progress [§8; INV-11]');

select is(
  pg_temp.refunds_of(pg_temp.id('retried.first')),
  jsonb_build_array(jsonb_build_object(
    'amount', pg_temp.quoted_total(2), 'pending', true, 'settled', false,
    'withdrawn', false, 'automatic', true)),
  'the stale payment''s money goes to exactly one pending automatic refund (requested_by is null) for the full amount [§8.2; §16.1 a late payment confirmation follows the defined recovery flow; INV-11]');

select is(
  pg_temp.claim(pg_temp.id('retried.hold')),
  '{"active": true, "status": "active", "kind": "hold"}'::jsonb,
  'the guest''s live hold is not released by the stale success — it belongs to the attempt still in progress [§7.3; INV-10]');

select is(
  pg_temp.settle(pg_temp.id('retried.second'), 'success') ->> 'status',
  'confirmed',
  'the current attempt then confirms [§8; §16.1 a failed payment can be retried until the hold expires; INV-10]');

select is(
  (select jsonb_build_object(
            'booking_status', b.status, 'on_the_same_hold', b.occupancy_id = pg_temp.id('retried.hold'),
            'claim_kind', o.kind, 'claim_active', o.is_active)
     from public.bookings b join public.suite_occupancy o on o.id = pg_temp.id('retried.hold')
    where b.id = pg_temp.id('retried.booking')),
  '{"booking_status": "confirmed", "on_the_same_hold": true, "claim_kind": "booking", "claim_active": true}'::jsonb,
  'and it confirms on the very hold the stale success left alone, converted into the booking [§7.3, §8; INV-02]');

select is(
  (select jsonb_build_object('tax', p.tax_fils, 'taxable', p.taxable_fils)
     from public.payments p where p.id = pg_temp.id('retried.second')),
  jsonb_build_object('tax', pg_temp.vat_within(pg_temp.quoted_total(2)), 'taxable', pg_temp.quoted_total(2)),
  'the current payment carries the booking''s full VAT, although an earlier payment on the same booking took the same amount and is being refunded in full [CLIENT pricing specification: 5% VAT included; INV-21]');

select is(
  (select sum(p.tax_fils)::integer from public.payments p
    where p.booking_id = pg_temp.id('retried.booking') and p.status in ('paid', 'partially_refunded', 'fully_refunded'))
  - (select sum(r.tax_fils)::integer from public.refunds r
      where r.booking_id = pg_temp.id('retried.booking') and r.withdrawn_at is null),
  (select b.tax_fils from public.bookings b where b.id = pg_temp.id('retried.booking')),
  'net of the stale payment''s refund, the booking''s VAT is recorded exactly once [CLIENT pricing specification: 5% VAT included; INV-21]');


insert into ids select * from pg_temp.open_checkout('repriced', 9812, timestamptz '2047-03-04 06:00Z');
insert into ids (label, id) select 'repriced.first', pg_temp.prepare('repriced', 2, true);
insert into ids (label, id) select 'repriced.booking', pg_temp.booking_of(pg_temp.id('repriced.first'));

set local request.jwt.claims = '{"sub":"b8a00000-0000-4000-8000-000000000003"}';
insert into steps select 'repriced.price', to_jsonb(r)
  from public.set_manual_booking_price(pg_temp.id('repriced.booking'), 60000, 'Goodwill agreed while the guest was paying') r;
set local request.jwt.claims = '';

select is(
  (select count(*)::integer from internal.checkout_attempts a where a.booking_id = pg_temp.id('repriced.booking')),
  1,
  'precondition: the repriced booking has one payment attempt only, so nothing but the changed total can make it stale [§6.4, §8]');

select is(
  pg_temp.settle(pg_temp.id('repriced.first'), 'success') ->> 'status',
  'refunded',
  'a success whose amount no longer equals the booking total settles as refunded, not confirmed [§6.4, §8; INV-11]');

select is(
  (select jsonb_build_object('status', b.status, 'total', b.total_fils)
     from public.bookings b where b.id = pg_temp.id('repriced.booking')),
  '{"status": "awaiting_payment", "total": 60000}'::jsonb,
  'the repriced booking is not confirmed and keeps awaiting_payment at its new total [§6.4, §8]');

select is(
  pg_temp.refunds_of(pg_temp.id('repriced.first')),
  jsonb_build_array(jsonb_build_object(
    'amount', pg_temp.quoted_total(2), 'pending', true, 'settled', false,
    'withdrawn', false, 'automatic', true)),
  'the whole old amount goes to one pending automatic refund [§8.2; INV-11]');

select is(
  pg_temp.claim(pg_temp.id('repriced.hold')),
  '{"active": true, "status": "active", "kind": "hold"}'::jsonb,
  'and the guest''s hold stays active so the booking can still be paid at its new total [§7.3; INV-10]');


select is(
  (select c.column_default from information_schema.columns c
    where c.table_schema = 'internal' and c.table_name = 'checkout_attempts' and c.column_name = 'created_at'),
  'clock_timestamp()',
  'checkout_attempts.created_at defaults to clock_timestamp(), not now(), so two attempts prepared in one transaction still order [OUR CHOICE]');

insert into ids select * from pg_temp.open_checkout('cancelled', 9813, timestamptz '2047-03-05 06:00Z');
insert into ids (label, id) select 'cancelled.first', pg_temp.prepare('cancelled', 2, true);
set local request.jwt.claims = '{"sub":"b8a00000-0000-4000-8000-000000000001"}';
insert into steps select 'cancelled.cancel', to_jsonb(r)
  from public.cancel_booking(pg_temp.booking_of(pg_temp.id('cancelled.first')), 'Guest phoned to cancel before paying') r;
set local request.jwt.claims = '';

select is(
  pg_temp.claim(pg_temp.id('cancelled.hold')),
  '{"active": false, "status": "released", "kind": "hold"}'::jsonb,
  'control: cancelling the only booking of a checkout releases its hold at once, so the guards below are not vacuous [§1, §3; INV-05]');


insert into ids select * from pg_temp.open_checkout('moved', 9814, timestamptz '2047-03-06 06:00Z');
insert into ids (label, id) select 'moved.first', pg_temp.prepare('moved', 2, true);
insert into ids (label, id) select 'moved.first.booking', pg_temp.booking_of(pg_temp.id('moved.first'));
insert into steps select 'moved.lapse', to_jsonb(pg_temp.lapse('moved'));
insert into ids (label, id) select 'moved.hold.again', pg_temp.rehold('moved', timestamptz '2047-03-06 06:00Z');
insert into ids (label, id) select 'moved.second', pg_temp.prepare('moved', 2, true);
insert into ids (label, id) select 'moved.second.booking', pg_temp.booking_of(pg_temp.id('moved.second'));

select ok(
  (select a.booking_id <> b.booking_id and a.created_at < b.created_at and a.created_at <> now()
     from internal.checkout_attempts a, internal.checkout_attempts b
    where a.payment_id = pg_temp.id('moved.first') and b.payment_id = pg_temp.id('moved.second')),
  'precondition: after the first attempt''s hold lapsed, the same checkout re-held the same time and started a newer attempt on a NEW booking — and within this one transaction the two attempts still order strictly [OUR CHOICE]');

set local request.jwt.claims = '{"sub":"b8a00000-0000-4000-8000-000000000001"}';
insert into steps select 'moved.cancel', to_jsonb(r)
  from public.cancel_booking(pg_temp.id('moved.first.booking'), 'Stale unpaid booking') r;
set local request.jwt.claims = '';

select is(
  pg_temp.claim(pg_temp.id('moved.hold.again')),
  '{"active": true, "status": "active", "kind": "hold"}'::jsonb,
  'cancelling the checkout''s older booking does not release the hold that now belongs to its newer attempt for another booking, even at the same visit time [§7.3; INV-05]');

insert into steps select 'moved.second.success', pg_temp.settle(pg_temp.id('moved.second'), 'success');

select is(
  (select jsonb_build_object(
            'result', s.result ->> 'status',
            'on_the_kept_hold', b.occupancy_id = pg_temp.id('moved.hold.again'))
     from steps s, public.bookings b
    where s.label = 'moved.second.success' and b.id = pg_temp.id('moved.second.booking')),
  '{"result": "confirmed", "on_the_kept_hold": true}'::jsonb,
  'and that newer attempt still confirms on the hold it was prepared against [§8; INV-10]');


insert into ids select * from pg_temp.open_checkout('retimed', 9815, timestamptz '2047-03-07 06:00Z');
insert into ids (label, id) select 'retimed.first', pg_temp.prepare('retimed', 2, true);
insert into steps select 'retimed.lapse', to_jsonb(pg_temp.lapse('retimed'));
insert into ids (label, id) select 'retimed.later', pg_temp.rehold('retimed', timestamptz '2047-03-07 10:00Z');
set local request.jwt.claims = '{"sub":"b8a00000-0000-4000-8000-000000000001"}';
insert into steps select 'retimed.cancel', to_jsonb(r)
  from public.cancel_booking(pg_temp.booking_of(pg_temp.id('retimed.first')), 'Guest chose another time') r;
set local request.jwt.claims = '';

select is(
  pg_temp.claim(pg_temp.id('retimed.later')),
  '{"active": true, "status": "active", "kind": "hold"}'::jsonb,
  'cancelling a booking does not release the checkout''s hold for a DIFFERENT visit time, even with no newer attempt [§7.3; INV-05]');

select is(
  pg_temp.settle(pg_temp.id('retimed.first'), 'success') ->> 'status',
  'refunded',
  'the cancelled booking''s money then arrives and goes to a refund [§8.2; INV-11]');

select is(
  pg_temp.claim(pg_temp.id('retimed.later')),
  '{"active": true, "status": "active", "kind": "hold"}'::jsonb,
  'and settling that payment does not release the hold for the different visit time either [§7.3, §8.2; INV-05]');


insert into ids select * from pg_temp.open_checkout('late', 9816, timestamptz '2047-03-08 06:00Z');
insert into ids (label, id) select 'late.first', pg_temp.prepare('late', 2, true);
insert into ids (label, id) select 'late.booking', pg_temp.booking_of(pg_temp.id('late.first'));
insert into steps select 'late.lapse', to_jsonb(pg_temp.lapse('late'));
insert into ids (label, id) select 'late.later', pg_temp.rehold('late', timestamptz '2047-03-08 10:00Z');

select is(
  pg_temp.settle(pg_temp.id('late.first'), 'success') ->> 'status',
  'confirmed',
  'a late payment for a live booking, arriving while the checkout holds a different time, is allocated afresh and confirmed [§8.2; §16.1 a late payment confirmation follows the defined recovery flow; INV-11]');

select is(
  (select jsonb_build_object(
            'kind', o.kind, 'active', o.is_active,
            'own_visit', o.experience_period = b.experience_period,
            'is_the_other_hold', o.id = pg_temp.id('late.later'))
     from public.bookings b join public.suite_occupancy o on o.id = b.occupancy_id
    where b.id = pg_temp.id('late.booking')),
  '{"kind": "booking", "active": true, "own_visit": true, "is_the_other_hold": false}'::jsonb,
  'the booking lands on a new claim for its own visit time, not on the hold for the other time [§7.3, §8.2; INV-02]');

select is(
  pg_temp.claim(pg_temp.id('late.later')),
  '{"active": true, "status": "active", "kind": "hold"}'::jsonb,
  'and the hold for the different visit time is neither converted nor released [§7.3; INV-05]');


set local request.jwt.claims = '{"sub":"b8a00000-0000-4000-8000-000000000001"}';
insert into ids (label, id) select 'repaid.booking', pg_temp.desk_booking(0);
insert into ids (label, id) select 'repaid.card', pg_temp.desk_payment(pg_temp.id('repaid.booking'), 'card_terminal', pg_temp.quoted_total(2));
insert into ids (label, id) select 'repaid.card.refund', pg_temp.request_refund(pg_temp.id('repaid.card'), pg_temp.quoted_total(2), 'Charged on the wrong card');
set local request.jwt.claims = '{"sub":"b8a00000-0000-4000-8000-000000000002"}';
insert into steps select 'repaid.card.returned', to_jsonb(r)
  from public.confirm_refund_return(pg_temp.id('repaid.card.refund'), 'RETURN-CARD', 'Returned to the card') r;
set local request.jwt.claims = '{"sub":"b8a00000-0000-4000-8000-000000000001"}';
insert into ids (label, id) select 'repaid.cash', pg_temp.desk_payment(pg_temp.id('repaid.booking'), 'cash', pg_temp.quoted_total(2));

select is(
  (select jsonb_build_object('status', p.status, 'vat_credited', r.tax_fils)
     from public.payments p join public.refunds r on r.payment_id = p.id
    where p.id = pg_temp.id('repaid.card')),
  jsonb_build_object('status', 'fully_refunded', 'vat_credited', pg_temp.vat_within(pg_temp.quoted_total(2))),
  'precondition: the first payment was refunded in full and its refund credited all of its VAT [CLIENT pricing specification: 5% VAT included]');

select is(
  (select jsonb_build_object('tax', p.tax_fils, 'taxable', p.taxable_fils)
     from public.payments p where p.id = pg_temp.id('repaid.cash')),
  jsonb_build_object('tax', pg_temp.vat_within(pg_temp.quoted_total(2)), 'taxable', pg_temp.quoted_total(2)),
  'a new payment on the same booking after a full refund carries its own full VAT, not zero [CLIENT pricing specification: 5% VAT included; INV-21]');

select is(
  (select sum(p.tax_fils)::integer from public.payments p where p.booking_id = pg_temp.id('repaid.booking'))
  - (select sum(r.tax_fils)::integer from public.refunds r
      where r.booking_id = pg_temp.id('repaid.booking') and r.withdrawn_at is null),
  (select b.tax_fils from public.bookings b where b.id = pg_temp.id('repaid.booking')),
  'net of the refund, the booking''s VAT is recorded exactly once across both payments [INV-21; §16.1 walk-in, cash, terminal, payment-link and complimentary transactions appear correctly in Reporting and reconciliation]');


insert into ids (label, id) select 'overpaid.booking', pg_temp.desk_booking(1);
insert into ids (label, id) select 'overpaid.cash', pg_temp.desk_payment(pg_temp.id('overpaid.booking'), 'cash', pg_temp.quoted_total(2) + 4000);

select is(
  (select jsonb_build_object('tax', p.tax_fils, 'taxable', p.taxable_fils)
     from public.payments p where p.id = pg_temp.id('overpaid.cash')),
  jsonb_build_object('tax', pg_temp.vat_within(pg_temp.quoted_total(2)), 'taxable', pg_temp.quoted_total(2)),
  'an overpayment carries VAT on the booking''s price only — the AED 40 excess is not VAT-bearing [CLIENT pricing specification: 5% VAT included; INV-21]');

select is(
  internal.refund_tax_share(pg_temp.id('overpaid.cash'), 4000),
  0,
  'internal.refund_tax_share: refunding the overpaid excess credits 0 VAT [CLIENT pricing specification: 5% VAT included]');

insert into ids (label, id) select 'overpaid.excess', pg_temp.request_refund(pg_temp.id('overpaid.cash'), 4000, 'Over-keyed by AED 40');
insert into ids (label, id) select 'overpaid.rest', pg_temp.request_refund(pg_temp.id('overpaid.cash'), pg_temp.quoted_total(2), 'Guest left before starting');

select is(
  (select jsonb_build_object(
            'excess', (select r.tax_fils from public.refunds r where r.id = pg_temp.id('overpaid.excess')),
            'rest',   (select r.tax_fils from public.refunds r where r.id = pg_temp.id('overpaid.rest')))),
  jsonb_build_object('excess', 0, 'rest', pg_temp.vat_within(pg_temp.quoted_total(2))),
  'the excess refund credits no VAT, and refunding the rest afterwards credits exactly the payment''s VAT, so none is lost or doubled [INV-21]');


set local request.jwt.claims = '{"sub":"b8a00000-0000-4000-8000-000000000001"}';
insert into ids (label, id)
  select 'retried.first.refund', r.id from public.refunds r where r.payment_id = pg_temp.id('retried.first');

select throws_ok(
  $$select * from public.withdraw_refund_request(pg_temp.id('retried.first.refund'), 'Guest will come another day')$$,
  'WP066', null,
  'Reception cannot withdraw a refund the payment settlement started itself (requested_by is null) [§8.2; INV-11]');

select is(
  pg_temp.refunds_of(pg_temp.id('retried.first')),
  jsonb_build_array(jsonb_build_object(
    'amount', pg_temp.quoted_total(2), 'pending', true, 'settled', false,
    'withdrawn', false, 'automatic', true)),
  'the refused withdrawal leaves that refund pending and not withdrawn [§8.2; INV-11]');

select is(
  pg_temp.alerts_for(pg_temp.id('retried.first.refund')),
  array['refund_pending'],
  'and the alert detector still raises refund_pending for it [§9.3; INV-11]');


insert into ids select * from pg_temp.open_checkout('closed', 9817, timestamptz '2047-03-09 06:00Z');
insert into ids (label, id) select 'closed.first', pg_temp.prepare('closed', 2, true);
insert into ids (label, id) select 'closed.booking', pg_temp.booking_of(pg_temp.id('closed.first'));
insert into steps select 'closed.cancel', to_jsonb(r)
  from public.cancel_booking(pg_temp.id('closed.booking'), 'Guest phoned to cancel before paying') r;
set local request.jwt.claims = '';
insert into steps select 'closed.first.success', pg_temp.settle(pg_temp.id('closed.first'), 'success');
insert into ids (label, id)
  select 'closed.refund', r.id from public.refunds r where r.payment_id = pg_temp.id('closed.first');

select is(
  (select s.result ->> 'status' from steps s where s.label = 'closed.first.success')
    || ' / ' || (select b.status::text from public.bookings b where b.id = pg_temp.id('closed.booking')),
  'refunded / cancelled',
  'precondition: money arriving for a booking cancelled before payment is refunded and the booking stays cancelled [§8.2; INV-11]');

set local request.jwt.claims = '{"sub":"b8a00000-0000-4000-8000-000000000002"}';
select throws_ok(
  $$select * from public.withdraw_refund_request(pg_temp.id('closed.refund'), 'Re-accommodate the guest instead')$$,
  'WP066', null,
  'not even Management can withdraw the automatic refund of a cancelled booking — the alert worker does not watch cancelled bookings, so the refund is all that tracks the guest''s money [§8.2; INV-11]');

select is(
  jsonb_build_object(
    'refunds', pg_temp.refunds_of(pg_temp.id('closed.first')),
    'alerts', to_jsonb(pg_temp.alerts_for(pg_temp.id('closed.refund')))),
  jsonb_build_object(
    'refunds', jsonb_build_array(jsonb_build_object(
      'amount', pg_temp.quoted_total(2), 'pending', true, 'settled', false,
      'withdrawn', false, 'automatic', true)),
    'alerts', jsonb_build_array('refund_pending')),
  'that refund stays pending and refund_pending stays raised [§8.2, §9.3; INV-11]');

select lives_ok(
  $$select * from public.confirm_refund_return(pg_temp.id('closed.refund'), 'RETURN-AUTO', 'Returned to the guest card')$$,
  'the only way an automatic refund closes is Management confirming the money went back [§8.2; INV-11]');

select is(
  pg_temp.alerts_for(pg_temp.id('closed.refund')),
  '{}'::text[],
  'and once confirmed, refund_pending is no longer raised for it [§9.3]');


set local request.jwt.claims = '{"sub":"b8a00000-0000-4000-8000-000000000001"}';
insert into ids (label, id) select 'unwound.booking', pg_temp.desk_booking(2);
insert into ids (label, id) select 'unwound.cash', pg_temp.desk_payment(pg_temp.id('unwound.booking'), 'cash', pg_temp.quoted_total(2));
set local request.jwt.claims = '{"sub":"b8a00000-0000-4000-8000-000000000002"}';
insert into ids (label, id)
  select 'unwound.recorded', r.refund_id
    from public.record_refund(pg_temp.id('unwound.cash'), pg_temp.quoted_total(2), 'Guest unhappy with the visit') r;

select is(
  (select p.status::text from public.payments p where p.id = pg_temp.id('unwound.cash')),
  'fully_refunded',
  'precondition: Management''s record_refund marks the payment fully_refunded the moment the full refund is requested [§8, §11.2]');

set local request.jwt.claims = '{"sub":"b8a00000-0000-4000-8000-000000000001"}';
insert into steps select 'unwound.withdraw', to_jsonb(r)
  from public.withdraw_refund_request(pg_temp.id('unwound.recorded'), 'Guest decided to stay') r;

select is(
  (select p.status::text from public.payments p where p.id = pg_temp.id('unwound.cash')),
  'paid',
  'withdrawing that staff-requested refund recomputes the payment from settled refunds only: nothing settled, so it is paid again [§8, §11.2; OUR CHOICE]');

set local request.jwt.claims = '{"sub":"b8a00000-0000-4000-8000-000000000002"}';
select throws_ok(
  $$select * from public.confirm_refund_return(pg_temp.id('unwound.recorded'), 'RETURN-LATE', 'Returned')$$,
  'WP071', null,
  'a withdrawn refund cannot then be confirmed as returned — WP071 with a plain message, not a generic check failure [§8; OUR CHOICE]');

select is(
  (select r.refunded_total_fils from public.record_refund(pg_temp.id('unwound.cash'), pg_temp.quoted_total(2), 'Full refund after all') r),
  pg_temp.quoted_total(2),
  'the withdrawn request no longer counts against the ceiling, so the full amount can be recorded again [§8, §11.2]');


set local request.jwt.claims = '{"sub":"b8a00000-0000-4000-8000-000000000001"}';
insert into ids (label, id) select 'partial.booking', pg_temp.desk_booking(3);
insert into ids (label, id) select 'partial.cash', pg_temp.desk_payment(pg_temp.id('partial.booking'), 'cash', pg_temp.quoted_total(2));
insert into ids (label, id) select 'partial.first', pg_temp.request_refund(pg_temp.id('partial.cash'), 20000, 'One guest could not come');
set local request.jwt.claims = '{"sub":"b8a00000-0000-4000-8000-000000000002"}';
insert into steps select 'partial.first.returned', to_jsonb(r)
  from public.confirm_refund_return(pg_temp.id('partial.first'), 'RETURN-PART', 'Returned in cash') r;
insert into steps select 'partial.after.settled', to_jsonb(p.status) from public.payments p where p.id = pg_temp.id('partial.cash');
insert into steps select 'partial.booking.after.part', to_jsonb(b.status) from public.bookings b where b.id = pg_temp.id('partial.booking');
insert into ids (label, id)
  select 'partial.rest', r.refund_id
    from public.record_refund(pg_temp.id('partial.cash'), pg_temp.quoted_total(2) - 20000, 'Refund the rest') r;
insert into steps select 'partial.after.recorded', to_jsonb(p.status) from public.payments p where p.id = pg_temp.id('partial.cash');

select is(
  (select jsonb_object_agg(s.label, s.result) from steps s where s.label in ('partial.after.settled', 'partial.after.recorded')),
  '{"partial.after.settled": "partially_refunded", "partial.after.recorded": "fully_refunded"}'::jsonb,
  'precondition: AED 200 settled makes the payment partially_refunded, and recording the rest marks it fully_refunded [§8, §11.2]');

select is(
  (select s.result from steps s where s.label = 'partial.booking.after.part'),
  '"confirmed"'::jsonb,
  'a refund recorded without cancelling leaves the booking confirmed [§8; Project owner''s direction, 17 September 2026]');

set local request.jwt.claims = '{"sub":"b8a00000-0000-4000-8000-000000000001"}';
insert into steps select 'partial.withdraw', to_jsonb(r)
  from public.withdraw_refund_request(pg_temp.id('partial.rest'), 'Recorded against the wrong booking') r;

select is(
  (select p.status::text from public.payments p where p.id = pg_temp.id('partial.cash')),
  'partially_refunded',
  'withdrawing the unsettled remainder recomputes the payment from settled refunds only: partially_refunded [§8, §11.2; OUR CHOICE]');


insert into ids select * from pg_temp.open_checkout('dual', 9818, timestamptz '2047-03-10 06:00Z');
set local request.jwt.claims = '';
insert into ids (label, id) select 'dual.first', pg_temp.prepare('dual', 2, false);
insert into ids (label, id) select 'dual.booking', pg_temp.booking_of(pg_temp.id('dual.first'));
insert into steps select 'dual.first.declined', pg_temp.settle(pg_temp.id('dual.first'), 'failed');
insert into ids (label, id) select 'dual.second', pg_temp.prepare('dual', 2, false);
insert into steps select 'dual.second.paid', pg_temp.settle(pg_temp.id('dual.second'), 'success');
insert into steps select 'dual.first.paid', pg_temp.settle(pg_temp.id('dual.first'), 'success');
insert into ids (label, id)
  select 'dual.automatic', r.id from public.refunds r where r.payment_id = pg_temp.id('dual.first');
set local request.jwt.claims = '{"sub":"b8a00000-0000-4000-8000-000000000001"}';
insert into ids (label, id) select 'dual.requested', pg_temp.request_refund(pg_temp.id('dual.second'), 10000, 'Towel charge reversed');
insert into steps select 'dual.withdraw', to_jsonb(r)
  from public.withdraw_refund_request(pg_temp.id('dual.requested'), 'Entered against the wrong booking') r;

select is(
  (select jsonb_object_agg(s.label, s.result ->> 'status') from steps s where s.label in ('dual.second.paid', 'dual.first.paid')),
  '{"dual.second.paid": "confirmed", "dual.first.paid": "refunded"}'::jsonb,
  'precondition: on a live hosted checkout the retry confirmed and the earlier attempt''s late success was refunded automatically [§8; INV-09, INV-11]');

select is(
  (select jsonb_agg(jsonb_build_object(
            'refund', br.refund_id, 'payment', br.payment_id, 'amount', br.amount_fils,
            'automatic', br.is_automatic, 'pending', br.is_pending,
            'withdrawn_at_is_set', br.withdrawn_at is not null)
            order by br.is_automatic desc)
     from public.booking_refunds(pg_temp.id('dual.booking')) br),
  jsonb_build_array(
    jsonb_build_object('refund', pg_temp.id('dual.automatic'), 'payment', pg_temp.id('dual.first'),
                       'amount', pg_temp.quoted_total(2), 'automatic', true, 'pending', true,
                       'withdrawn_at_is_set', false),
    jsonb_build_object('refund', pg_temp.id('dual.requested'), 'payment', pg_temp.id('dual.second'),
                       'amount', 10000, 'automatic', false, 'pending', false,
                       'withdrawn_at_is_set', true)),
  'booking_refunds returns both refunds of the booking: the settlement''s own marked is_automatic, and the staff request marked not automatic and still listed with withdrawn_at set [§10.6; INV-15; OUR CHOICE]');

select is(
  (select br.withdrawn_at from public.booking_refunds(pg_temp.id('dual.booking')) br where br.refund_id = pg_temp.id('dual.requested')),
  (select r.withdrawn_at from public.refunds r where r.id = pg_temp.id('dual.requested')),
  'the withdrawn_at it reports is the refund''s own withdrawal time [§10.6; OUR CHOICE]');


insert into ids select * from pg_temp.open_checkout('refundcancel', 9819, timestamptz '2047-03-11 06:00Z');
set local request.jwt.claims = '';
insert into ids (label, id) select 'refundcancel.payment', pg_temp.prepare('refundcancel', 2, true);
insert into steps select 'refundcancel.paid', pg_temp.settle(pg_temp.id('refundcancel.payment'), 'success');
insert into ids (label, id) select 'refundcancel.booking', pg_temp.booking_of(pg_temp.id('refundcancel.payment'));
insert into ids (label, id) select 'refundcancel.claim', b.occupancy_id from public.bookings b where b.id = pg_temp.id('refundcancel.booking');
insert into ids (label, id) values ('refundcancel.key', gen_random_uuid());
set local request.jwt.claims = '{"sub":"b8a00000-0000-4000-8000-000000000001"}';
insert into steps select 'refundcancel.first', to_jsonb(r)
  from public.refund_payment_and_cancel_booking(pg_temp.id('refundcancel.payment'), pg_temp.quoted_total(2), 'Guest asked to cancel', pg_temp.id('refundcancel.key')) r;
insert into steps select 'refundcancel.retry', to_jsonb(r)
  from public.refund_payment_and_cancel_booking(pg_temp.id('refundcancel.payment'), pg_temp.quoted_total(2), 'Guest asked to cancel', pg_temp.id('refundcancel.key')) r;

select is(
  (select jsonb_build_object(
            'booking', b.status, 'payment', p.status,
            'claim', pg_temp.claim(pg_temp.id('refundcancel.claim')),
            'cancelled', (select s.result -> 'booking_cancelled' from steps s where s.label = 'refundcancel.first'))
     from public.bookings b, public.payments p
    where b.id = pg_temp.id('refundcancel.booking') and p.id = pg_temp.id('refundcancel.payment')),
  jsonb_build_object(
    'booking', 'cancelled', 'payment', 'fully_refunded',
    'claim', jsonb_build_object('active', false, 'status', 'released', 'kind', 'booking'),
    'cancelled', true),
  'refunding a simulated payment with cancel returns the money at once, cancels the booking and releases its suite claim, so the slot is offered again [§8; Project owner''s direction, 17 September 2026]');

select is(
  (select jsonb_build_object(
            'same_refund', (a.result ->> 'refund_id') = (r.result ->> 'refund_id'),
            'cancelled_again', r.result -> 'booking_cancelled',
            'refunds', (select count(*) from public.refunds x where x.payment_id = pg_temp.id('refundcancel.payment')))
     from steps a, steps r
    where a.label = 'refundcancel.first' and r.label = 'refundcancel.retry'),
  '{"same_refund": true, "cancelled_again": false, "refunds": 1}'::jsonb,
  'a retry with the same request key returns the same refund and cancels nothing twice [INV-13; OUR CHOICE]');

select * from finish();
rollback;
