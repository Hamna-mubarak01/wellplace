begin;
select plan(7);

insert into public.staff (id, email, full_name, role) values
  ('a2000000-0000-4000-8000-000000000001', 'receipt.reception@example.test', 'Receipt Reception', 'reception');

create temp table ids (label text primary key, id uuid not null);
grant all on ids to public;

create function pg_temp.id(p_label text) returns uuid language sql stable as $$
  select i.id from ids i where i.label = p_label
$$;

create function pg_temp.checkout(p_suite_number integer, p_starts_at timestamptz) returns uuid language plpgsql as $$
declare
  v_token    uuid := gen_random_uuid();
  v_suite    uuid := gen_random_uuid();
  v_hold     uuid;
  v_progress jsonb;
  v_payment  uuid;
begin
  v_progress := jsonb_build_object(
    'identity', jsonb_build_object(
      'salutation', 'ms', 'firstName', 'Receipt', 'lastName', 'Guest',
      'email', v_token::text || '@example.test', 'dateOfBirth', '1990-01-01',
      'phoneE164', '+971500000071', 'phoneCountry', 'AE'),
    'selection', jsonb_build_object(
      'startsAt', to_char(p_starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS".000Z"'),
      'durationHours', 2, 'adults', 2, 'childAges', '[]'::jsonb,
      'addonQuantities', '{}'::jsonb, 'voucherCode', '', 'personalRequest', '',
      'paymentOption', 'card'),
    'acceptedTerms', true,
    'lastCompletedStep', 'confirm');
  insert into public.suites (id, suite_number, status, priority) values (v_suite, p_suite_number, 'available', -9999);
  insert into public.suite_occupancy (suite_id, kind, experience_period, blocked_period, cleaning_buffer_minutes, expires_at)
  values (v_suite, 'hold', tstzrange(p_starts_at, p_starts_at + interval '2 hours', '[)'),
          tstzrange(p_starts_at, p_starts_at + interval '2 hours 20 minutes', '[)'), 20, now() + interval '10 minutes')
  returning id into v_hold;
  insert into internal.guest_checkout_holds (token, occupancy_id) values (v_token, v_hold);
  perform public.save_checkout_progress(v_token, v_progress,
    '[{"document_slug":"legal-terms","document_version":"1.3","checkbox_text":"I agree"}]'::jsonb, 30);
  v_payment := (public.prepare_guest_payment(v_token, gen_random_uuid(),
    jsonb_build_object(
      'breakdown', jsonb_build_object('outcome', 'priced', 'subtotalFils', 66000, 'discountFils', 0, 'addonsTotalFils', 0,
        'serviceFeeFils', 0, 'taxFils', 3143, 'totalFils', 66000, 'regularTotalFils', 88000, 'savingFils', 22000,
        'taxIsIncluded', true, 'lines', '[]'::jsonb),
      'cart', '[]'::jsonb, 'taxLabel', 'VAT', 'offerLabel', 'Special offer', 'progress', v_progress),
    public.checkout_revision(), 'AED', true) ->> 'paymentId')::uuid;
  perform public.settle_payment_event('simulation', internal.opaque_reference('RECEIPTNO-', v_payment) || '-SUCCESS',
    v_payment, 'success', 66000, 'AED', true, '{}'::jsonb);
  return v_payment;
end
$$;

insert into ids select 'payment', pg_temp.checkout(9921, timestamptz '2043-03-01 06:00Z');
insert into ids select 'token', a.receipt_token from internal.checkout_attempts a where a.payment_id = pg_temp.id('payment');
insert into ids select 'booking', p.booking_id from public.payments p where p.id = pg_temp.id('payment');

select is(
  (select public.guest_receipt(pg_temp.id('token'), 90) ->> 'paymentNumber'),
  (select p.reference from public.payments p where p.id = pg_temp.id('payment')),
  'the guest receipt read carries the payment''s WP-P reference as paymentNumber [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select jsonb_build_object(
            'number_shaped', public.guest_receipt(pg_temp.id('token'), 90) ->> 'paymentNumber' ~ '^WP-P[1-9][0-9]{3,}$',
            'provider_reference_unchanged', public.guest_receipt(pg_temp.id('token'), 90) ->> 'paymentReference' = p.provider_reference)
     from public.payments p where p.id = pg_temp.id('payment')),
  '{"number_shaped": true, "provider_reference_unchanged": true}'::jsonb,
  'paymentNumber is a WP-P number and paymentReference is still the provider reference [OUR CHOICE]');

select is(public.guest_receipt(pg_temp.id('token'), 0), null,
  '[INV-25] a receipt with no validity period returns nothing');

update public.bookings
   set experience_period = tstzrange(now() - interval '100 days', now() - interval '100 days' + interval '2 hours', '[)')
 where id = pg_temp.id('booking');

select is(public.guest_receipt(pg_temp.id('token'), 90), null,
  '[§13, INV-25] a receipt link whose validity after the visit has passed returns nothing, paymentNumber included');

select is(
  (select public.guest_receipt(pg_temp.id('token'), 365) ->> 'paymentNumber'),
  (select p.reference from public.payments p where p.id = pg_temp.id('payment')),
  'control: the same link inside a longer validity period still resolves, so expiry is what refused it [INV-25]');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a2000000-0000-4000-8000-000000000001"}';
select public.revoke_receipt_link((select i.id from ids i where i.label = 'booking'), 'Guest asked for a new link');
reset role;

select is(public.guest_receipt(pg_temp.id('token'), 365), null,
  '[§13, INV-25] a revoked receipt link returns nothing, paymentNumber included');

select ok(
  not has_function_privilege('anon', 'public.guest_receipt(uuid,integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.guest_receipt(uuid,integer)', 'execute')
    and has_function_privilege('service_role', 'public.guest_receipt(uuid,integer)', 'execute'),
  '[§13, INV-25] the receipt read, with its new field, is still callable only by the server behind the opaque token');

select * from finish();
rollback;
