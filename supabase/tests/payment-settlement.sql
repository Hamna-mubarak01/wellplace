begin;
select plan(24);

insert into public.staff (id, email, full_name, role) values
  ('b7111111-1111-4111-8111-111111111111', 'settle.reception@example.test', 'Settle Reception', 'reception');

create temp table opaque_samples as
  select internal.opaque_reference('SIM-', sample.id) as reference
    from (
      select md5('wellplace-opaque-reference-' || i::text)::uuid as id
        from generate_series(1, 2000) as i
      union all
      select 'e7fe6883-4988-4060-9278-705cc0f25ffd'::uuid
      union all
      select '12345678-1234-1234-1234-123456789012'::uuid
    ) as sample;
grant select on opaque_samples to public;

select ok(
  not has_function_privilege('anon',
    'public.settle_payment_event(text,text,uuid,text,integer,text,boolean,jsonb)', 'execute'),
  'anon: holds no execute grant on settle_payment_event — a guest browser cannot mark a payment paid [§3, §8, INV-08]');
select ok(
  not has_function_privilege('authenticated',
    'public.settle_payment_event(text,text,uuid,text,integer,text,boolean,jsonb)', 'execute'),
  'authenticated: holds no execute grant on settle_payment_event — a staff token is not a verified provider event [§8, INV-08]');
select ok(
  has_function_privilege('service_role',
    'public.settle_payment_event(text,text,uuid,text,integer,text,boolean,jsonb)', 'execute'),
  'service_role: may execute settle_payment_event, the payment callback''s one writer [§8]');

set local role anon;
select throws_ok(
  $$select public.settle_payment_event('simulation', 'SIM-anon', gen_random_uuid(), 'success',
      66000, 'AED', true, '{}'::jsonb)$$,
  '42501', null,
  'anon: calling settle_payment_event is refused with 42501 [§3, INV-08]');
reset role;

set local request.jwt.claims = '{"sub":"b7111111-1111-4111-8111-111111111111"}';
set local role authenticated;
select throws_ok(
  $$select public.settle_payment_event('simulation', 'SIM-staff', gen_random_uuid(), 'success',
      66000, 'AED', true, '{}'::jsonb)$$,
  '42501', null,
  'authenticated staff: calling settle_payment_event is refused with 42501 [§8, INV-08]');
reset role;

set local role service_role;
select throws_ok(
  $$select public.settle_payment_event('simulation', 'SIM-unverified', gen_random_uuid(), 'success',
      66000, 'AED', false, '{}'::jsonb)$$,
  'WP065', null,
  'service_role: reaches the body, and a result whose signature was not verified is refused with WP065 [§3, §8, INV-08]');
select throws_ok(
  $$select public.settle_payment_event('simulation', 'SIM-unknown', gen_random_uuid(), 'success',
      66000, 'AED', true, '{}'::jsonb)$$,
  'WP065', null,
  'service_role: a verified result for a payment that is not an online checkout is refused with WP065, not processed [§8]');
reset role;

select ok(
  not has_function_privilege('anon', 'public.withdraw_refund_request(uuid,text)', 'execute'),
  'anon: holds no execute grant on withdraw_refund_request [§8, §13]');
select ok(
  not has_function_privilege('anon', 'public.booking_refunds(uuid)', 'execute'),
  'anon: holds no execute grant on booking_refunds [§10.6, §13]');
select ok(
  not has_function_privilege('anon', 'public.revoke_receipt_link(uuid,text)', 'execute'),
  'anon: holds no execute grant on revoke_receipt_link [§13, INV-25]');

set local role anon;
select throws_ok(
  $$select * from public.withdraw_refund_request(gen_random_uuid(), 'Anonymous withdrawal')$$,
  '42501', null,
  'anon: withdraw_refund_request is refused with 42501 [§8, §13]');
select throws_ok(
  $$select * from public.booking_refunds(gen_random_uuid())$$,
  '42501', null,
  'anon: booking_refunds is refused with 42501 [§10.6, INV-15]');
select throws_ok(
  $$select public.revoke_receipt_link(gen_random_uuid(), 'Anonymous revocation')$$,
  '42501', null,
  'anon: revoke_receipt_link is refused with 42501 [§13, INV-25]');
reset role;

set local request.jwt.claims = '{"sub":"b7999999-9999-4999-8999-999999999999"}';
set local role authenticated;
select throws_ok(
  $$select * from public.withdraw_refund_request(gen_random_uuid(), 'Not staff')$$,
  '42501', null,
  'a signed-in account with no staff record cannot withdraw a refund [§8, §13]');
select throws_ok(
  $$select * from public.booking_refunds(gen_random_uuid())$$,
  '42501', null,
  'a signed-in account with no staff record cannot read a booking''s refunds [§10.6, INV-15]');
select throws_ok(
  $$select public.revoke_receipt_link(gen_random_uuid(), 'Not staff')$$,
  '42501', null,
  'a signed-in account with no staff record cannot revoke a receipt link [§13, INV-25]');
reset role;

select ok(
  not has_function_privilege('anon', 'public.guest_receipt(uuid,integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.guest_receipt(uuid,integer)', 'execute'),
  'guest_receipt is not callable from a browser token — it is read only by the server behind the opaque token [§13, INV-25]');
select ok(
  has_function_privilege('service_role', 'public.guest_receipt(uuid,integer)', 'execute'),
  'service_role: may read a receipt for the guest link page [§13, INV-25]');
select ok(
  not has_function_privilege('anon', 'public.payment_message_context(uuid)', 'execute'),
  'anon: holds no execute grant on payment_message_context [INV-01, §13]');
select ok(
  not has_function_privilege('anon', 'internal.opaque_reference(text,uuid)', 'execute')
  and not has_function_privilege('authenticated', 'internal.opaque_reference(text,uuid)', 'execute'),
  'internal.opaque_reference is not client-callable [R-15]');

select ok(
  ('SIM-' || 'e7fe6883-4988-4060-9278-705cc0f25ffd') ~ '[0-9]{4}[ -][0-9]{4}[ -][0-9]{4}[ -][0-9]{2,4}',
  'control: the dashed form of payment e7fe6883-4988-4060-9278-705cc0f25ffd matches the card-number pattern, which is why the old reference failed payments_provider_reference_carries_no_card [§13]');

select is(
  (select count(*)::integer
     from opaque_samples
    where reference ~ '[0-9]{15}'
       or reference ~ '[0-9]{4}[ -][0-9]{4}[ -][0-9]{4}[ -][0-9]{2,4}'
       or reference ~ '[0-9]'),
  0,
  'opaque_reference never matches either card-number pattern, nor carries a single digit, across 2000 md5-derived uuids plus the card-shaped and all-digit ones [§13, OUR CHOICE]');

select is(
  (select count(*)::integer from opaque_samples where reference !~ '^SIM-[A-Z]{32}$'),
  0,
  'every opaque reference is the prefix and 32 upper-case letters, within payments_provider_reference_length [§13]');

select is(
  (select count(distinct reference)::integer from opaque_samples),
  (select count(*)::integer from opaque_samples),
  'opaque_reference is one-to-one, so two payments never share a provider reference [§11.2 reconciliation]');

select * from finish();
rollback;
