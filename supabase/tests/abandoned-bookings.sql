begin;
select plan(28);

insert into public.staff (id, email, full_name, role) values
  ('ab000000-0000-4000-8000-000000000001', 'abandon.reception@example.test', 'Abandon Reception', 'reception'),
  ('ab000000-0000-4000-8000-000000000002', 'abandon.manager@example.test',   'Abandon Manager',   'management');

create temp table ids (label text primary key, id uuid not null);
create temp table steps (label text primary key, result jsonb);

create function pg_temp.id(p_label text) returns uuid language sql stable as $$
  select i.id from ids i where i.label = p_label
$$;

create function pg_temp.progress(p_token uuid, p_starts_at timestamptz) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'identity', jsonb_build_object(
      'salutation', 'mr', 'firstName', 'Abandon', 'lastName', 'Guest',
      'email', p_token::text || '@example.test', 'dateOfBirth', '1990-01-01',
      'phoneE164', '+971500000041', 'phoneCountry', 'AE'),
    'selection', jsonb_build_object(
      'startsAt', to_char(p_starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS".000Z"'),
      'durationHours', 2, 'adults', 2, 'childAges', '[]'::jsonb,
      'addonQuantities', '{}'::jsonb, 'voucherCode', '', 'personalRequest', '',
      'paymentOption', 'card'),
    'acceptedTerms', true,
    'lastCompletedStep', 'confirm')
$$;

create function pg_temp.open_and_prepare(p_checkout text, p_suite_number integer, p_starts_at timestamptz)
returns void language plpgsql as $$
declare
  v_token    uuid := gen_random_uuid();
  v_suite    uuid := gen_random_uuid();
  v_hold     uuid;
  v_progress jsonb := pg_temp.progress(v_token, p_starts_at);
  v_payment  uuid;
begin
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
  insert into ids (label, id)
  select p_checkout || '.token', v_token union all
  select p_checkout || '.payment', v_payment union all
  select p_checkout || '.booking', p.booking_id from public.payments p where p.id = v_payment union all
  select p_checkout || '.customer', b.customer_id from public.payments p join public.bookings b on b.id = p.booking_id where p.id = v_payment;
end
$$;

create function pg_temp.settle(p_checkout text, p_outcome text) returns jsonb language sql as $$
  select public.settle_payment_event('simulation',
           internal.opaque_reference('ABANDON-', p.id) || '-' || upper(p_outcome),
           p.id, p_outcome, p.amount_fils, 'AED', true, '{}'::jsonb)
    from public.payments p
   where p.id = pg_temp.id(p_checkout || '.payment')
$$;

create function pg_temp.lapse(p_checkout text) returns integer language plpgsql as $$
begin
  update public.suite_occupancy o
     set expires_at = now() - interval '1 second'
    from internal.guest_checkout_holds h
   where h.token = pg_temp.id(p_checkout || '.token') and o.id = h.occupancy_id;
  update internal.checkout_attempts
     set reservation_expires_at = now() - interval '1 second'
   where token = pg_temp.id(p_checkout || '.token');
  return internal.release_expired_occupancy();
end
$$;

create function pg_temp.derived(p_checkout text) returns jsonb language sql stable as $$
  select jsonb_build_object('is_abandoned', bs.is_abandoned, 'display_status', bs.display_status, 'stored_status', b.status)
    from public.booking_search bs
    join public.bookings b on b.id = bs.booking_id
   where bs.booking_id = pg_temp.id(p_checkout || '.booking')
$$;

select pg_temp.open_and_prepare('live', 9841, timestamptz '2049-04-01 06:00Z');
select pg_temp.open_and_prepare('lapsed', 9842, timestamptz '2049-04-02 06:00Z');
select pg_temp.open_and_prepare('failed', 9843, timestamptz '2049-04-03 06:00Z');
select pg_temp.open_and_prepare('paid', 9844, timestamptz '2049-04-04 06:00Z');
select pg_temp.open_and_prepare('late', 9845, timestamptz '2049-04-05 06:00Z');

insert into steps select 'lapsed.lapse', to_jsonb(pg_temp.lapse('lapsed'));
insert into steps select 'failed.declined', pg_temp.settle('failed', 'failed');
insert into steps select 'paid.success', pg_temp.settle('paid', 'success');

insert into public.customers (id, first_name, last_name, email, phone_e164, phone_country)
values ('ab000000-0000-4000-8000-0000000000c1', 'Desk', 'Unpaid', 'abandon.desk@example.test', '+971500000042', 'AE'),
       ('ab000000-0000-4000-8000-0000000000c2', 'Form', 'Only', 'abandon.lead@example.test', '+971500000043', 'AE');
insert into public.bookings (id, reference, customer_id, source, status, experience_period, cleaning_buffer_minutes, total_fils, created_by)
values ('ab000000-0000-4000-8000-0000000000b1', internal.next_booking_reference(), 'ab000000-0000-4000-8000-0000000000c1',
        'walk_in', 'awaiting_payment', tstzrange('2049-04-06 06:00Z', '2049-04-06 08:00Z', '[)'), 20, 66000,
        'ab000000-0000-4000-8000-000000000001');
insert into ids values ('desk.booking', 'ab000000-0000-4000-8000-0000000000b1');

set local request.jwt.claims = '{"sub":"ab000000-0000-4000-8000-000000000001"}';

select is(
  pg_temp.derived('live'),
  '{"is_abandoned": false, "display_status": "awaiting_payment", "stored_status": "awaiting_payment"}'::jsonb,
  'an online booking whose checkout reservation is still live is not abandoned [OUR CHOICE — project owner''s direction, 13 September 2026; §7.3]');

select is(
  pg_temp.derived('lapsed'),
  '{"is_abandoned": true, "display_status": "abandoned", "stored_status": "awaiting_payment"}'::jsonb,
  'an unpaid online booking whose reservation lapsed reads as abandoned while its stored status stays awaiting_payment [OUR CHOICE — project owner''s direction, 13 September 2026; INV-11]');

select is(
  pg_temp.derived('failed'),
  '{"is_abandoned": false, "display_status": "payment_failed", "stored_status": "payment_failed"}'::jsonb,
  'a declined payment whose hold still lives is not abandoned: the guest may retry until the hold expires [§8; §16.1; INV-10]');

insert into steps select 'failed.lapse', to_jsonb(pg_temp.lapse('failed'));

select is(
  pg_temp.derived('failed'),
  '{"is_abandoned": true, "display_status": "abandoned", "stored_status": "payment_failed"}'::jsonb,
  'once that hold lapses the declined checkout reads as abandoned and its stored status stays payment_failed [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select coalesce(array_agg(a.kind::text order by a.kind::text), '{}')
     from internal.detect_operational_alerts(now()) a
    where a.entity_id = pg_temp.id('failed.booking')::text),
  '{}'::text[],
  'the alert detector raises nothing for an abandoned checkout with a failed attempt [§9.3; OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  pg_temp.derived('paid'),
  '{"is_abandoned": false, "display_status": "confirmed", "stored_status": "confirmed"}'::jsonb,
  'a paid online booking is never abandoned [OUR CHOICE — project owner''s direction, 13 September 2026; §8]');

select is(
  (select jsonb_build_object('is_abandoned', bs.is_abandoned, 'display_status', bs.display_status, 'created_by_name', bs.created_by_name)
     from public.booking_search bs where bs.booking_id = pg_temp.id('desk.booking')),
  '{"is_abandoned": false, "display_status": "awaiting_payment", "created_by_name": "Abandon Reception"}'::jsonb,
  'an unpaid Reception booking is never abandoned, and booking_search names the staff member who created it [OUR CHOICE — project owner''s direction, 13 September 2026; §9.2]');

select is(
  (select bs.created_by_name from public.booking_search bs where bs.booking_id = pg_temp.id('lapsed.booking')),
  null,
  'an online booking has no creating staff member, which the console shows as Website [OUR CHOICE — project owner''s direction, 13 September 2026]');

insert into steps select 'late.lapse', to_jsonb(pg_temp.lapse('late'));

select is(
  pg_temp.derived('late'),
  '{"is_abandoned": true, "display_status": "abandoned", "stored_status": "awaiting_payment"}'::jsonb,
  'precondition: the late checkout reads as abandoned before its payment arrives [OUR CHOICE — project owner''s direction, 13 September 2026]');

set local request.jwt.claims = '';
insert into steps select 'late.success', pg_temp.settle('late', 'success');
set local request.jwt.claims = '{"sub":"ab000000-0000-4000-8000-000000000001"}';

select is(
  (select s.result ->> 'status' from steps s where s.label = 'late.success'),
  'confirmed',
  'a successful payment arriving after the reservation lapsed still follows §8.2 recovery and confirms, because the stored status was never made terminal [§8.2; §16.1; INV-11]');

select is(
  (select jsonb_build_object(
            'derived', pg_temp.derived('late'),
            'refunds', (select count(*) from public.refunds r where r.booking_id = pg_temp.id('late.booking')),
            'allocated', b.occupancy_id is not null)
     from public.bookings b where b.id = pg_temp.id('late.booking')),
  '{"derived": {"is_abandoned": false, "display_status": "confirmed", "stored_status": "confirmed"}, "refunds": 0, "allocated": true}'::jsonb,
  'the recovered booking is allocated, confirmed, no longer abandoned, and nothing was refunded [§8.2; INV-11]');

create function pg_temp.pay_again(p_checkout text) returns void language plpgsql as $$
declare
  v_token    uuid := pg_temp.id(p_checkout || '.token');
  v_old      public.suite_occupancy%rowtype;
  v_hold     uuid;
  v_progress jsonb;
  v_payment  uuid;
begin
  select o.* into v_old
    from internal.guest_checkout_holds h
    join public.suite_occupancy o on o.id = h.occupancy_id
   where h.token = v_token;
  insert into public.suite_occupancy (suite_id, kind, experience_period, blocked_period, cleaning_buffer_minutes, expires_at)
  values (v_old.suite_id, 'hold', v_old.experience_period, v_old.blocked_period, v_old.cleaning_buffer_minutes, now() + interval '10 minutes')
  returning id into v_hold;
  update internal.guest_checkout_holds set occupancy_id = v_hold where token = v_token;
  select s.progress into v_progress from internal.checkout_sessions s where s.token = v_token;
  v_payment := (public.prepare_guest_payment(v_token, gen_random_uuid(),
    jsonb_build_object(
      'breakdown', jsonb_build_object('outcome', 'priced', 'subtotalFils', 66000, 'discountFils', 0, 'addonsTotalFils', 0,
        'serviceFeeFils', 0, 'taxFils', 3143, 'totalFils', 66000, 'regularTotalFils', 88000, 'savingFils', 22000,
        'taxIsIncluded', true, 'lines', '[]'::jsonb),
      'cart', '[]'::jsonb, 'taxLabel', 'VAT', 'offerLabel', 'Special offer', 'progress', v_progress),
    public.checkout_revision(), 'AED', true) ->> 'paymentId')::uuid;
  perform public.settle_payment_event('simulation', internal.opaque_reference('ABANDON-AGAIN-', v_payment),
    v_payment, 'success', 66000, 'AED', true, '{}'::jsonb);
  insert into ids (label, id)
  select p_checkout || '.again.booking', p.booking_id from public.payments p where p.id = v_payment;
end
$$;

select pg_temp.open_and_prepare('again', 9846, timestamptz '2049-04-07 06:00Z');
insert into steps select 'again.lapse', to_jsonb(pg_temp.lapse('again'));

select is(
  pg_temp.derived('again'),
  '{"is_abandoned": true, "display_status": "abandoned", "stored_status": "awaiting_payment"}'::jsonb,
  'precondition: a checkout whose first attempt lapsed unsettled reads as abandoned [OUR CHOICE — project owner''s direction, 13 September 2026]');

set local request.jwt.claims = '';
select pg_temp.pay_again('again');
set local request.jwt.claims = '{"sub":"ab000000-0000-4000-8000-000000000001"}';

select is(
  jsonb_build_object(
    'first', pg_temp.derived('again'),
    'second', (select b.status from public.bookings b where b.id = pg_temp.id('again.again.booking')),
    'new_booking', pg_temp.id('again.again.booking') <> pg_temp.id('again.booking')),
  '{"first": {"is_abandoned": false, "display_status": "awaiting_payment", "stored_status": "awaiting_payment"}, "second": "confirmed", "new_booking": true}'::jsonb,
  'when the guest then pays in the same checkout session on a new booking, the lapsed booking is no longer abandoned and keeps its stored status [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select jsonb_build_object('is_abandoned', d.is_abandoned, 'display_status', d.display_status)
     from public.booking_detail d where d.booking_id = pg_temp.id('again.booking')),
  '{"is_abandoned": false, "display_status": "awaiting_payment"}'::jsonb,
  'booking_detail reads the same refined answer from booking_search, so there is still one definition [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select count(*)::integer from public.booking_search bs where bs.display_status = 'abandoned')
  - (select count(*)::integer from public.booking_search bs where bs.is_abandoned),
  0,
  'filtering display_status = abandoned returns exactly the rows derived as abandoned [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  array(select bs.booking_id from public.booking_search bs
         where bs.display_status = 'abandoned'
           and bs.booking_id in (pg_temp.id('live.booking'), pg_temp.id('lapsed.booking'), pg_temp.id('failed.booking'),
                                 pg_temp.id('paid.booking'), pg_temp.id('late.booking'), pg_temp.id('desk.booking'))
         order by bs.booking_id),
  array(select unnest(array[pg_temp.id('lapsed.booking'), pg_temp.id('failed.booking')]) as id order by id),
  'among live, lapsed, declined-and-lapsed, paid, late-paid and Reception bookings, the abandoned filter returns only the lapsed and the declined-and-lapsed checkouts [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select jsonb_build_object('is_abandoned', d.is_abandoned, 'display_status', d.display_status, 'booking_status', d.booking_status)
     from public.booking_detail d where d.booking_id = pg_temp.id('lapsed.booking')),
  '{"is_abandoned": true, "display_status": "abandoned", "booking_status": "awaiting_payment"}'::jsonb,
  'the booking detail read shows a lapsed unpaid online checkout as abandoned and keeps its stored booking_status [OUR CHOICE — project owner''s direction, 13 September 2026; INV-11]');

select is(
  (select jsonb_build_object('is_abandoned', d.is_abandoned, 'display_status', d.display_status, 'booking_status', d.booking_status)
     from public.booking_detail d where d.booking_id = pg_temp.id('live.booking')),
  '{"is_abandoned": false, "display_status": "awaiting_payment", "booking_status": "awaiting_payment"}'::jsonb,
  'a booking that is not abandoned reads its stored status as display_status on the booking detail read [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select count(*)::integer
     from public.booking_detail d
     join public.booking_search bs on bs.booking_id = d.booking_id
    where d.booking_id in (pg_temp.id('live.booking'), pg_temp.id('lapsed.booking'), pg_temp.id('failed.booking'),
                           pg_temp.id('paid.booking'), pg_temp.id('late.booking'), pg_temp.id('desk.booking'))
      and (d.is_abandoned, d.display_status) is not distinct from (bs.is_abandoned, bs.display_status)),
  6,
  'booking_detail and booking_search agree on is_abandoned and display_status for live, lapsed, declined-and-lapsed, paid, late-paid and Reception bookings [OUR CHOICE — project owner''s direction, 13 September 2026]');

select id as lapsed_booking from ids where label = 'lapsed.booking' \gset
select id as paid_booking from ids where label = 'paid.booking' \gset
select id as lapsed_customer from ids where label = 'lapsed.customer' \gset
select id as paid_customer from ids where label = 'paid.customer' \gset

set local role authenticated;

select is(
  (select bs.display_status::text from public.booking_search bs where bs.booking_id = :'lapsed_booking'),
  'abandoned',
  'a Reception session reads the derived abandoned status through its own row policies [§9.1; R-13]');

select is(
  (select array_agg(d.display_status::text order by d.display_status::text)
     from public.booking_detail d where d.booking_id in (:'lapsed_booking', :'paid_booking')),
  array['abandoned', 'confirmed'],
  'a Reception session reads abandoned and confirmed from booking_detail through its own row policies [§9.1; R-13]');

set local request.jwt.claims = '{"sub":"ab000000-0000-4000-8000-000000000002"}';

select is(
  (select jsonb_object_agg(mc.email, mc.is_lead) from public.management_customers mc
    where mc.id in (:'lapsed_customer', :'paid_customer', 'ab000000-0000-4000-8000-0000000000c2')),
  jsonb_build_object(
    (select c.email from public.customers c where c.id = :'lapsed_customer'), true,
    (select c.email from public.customers c where c.id = :'paid_customer'), false,
    'abandon.lead@example.test', true),
  'a customer with only an abandoned booking or no booking is a lead; a customer with a confirmed booking is not [OUR CHOICE — project owner''s direction, 13 September 2026; §11.4]');

reset role;
set local request.jwt.claims = '';
set local role anon;

select throws_ok(
  $$select count(*) from public.booking_search$$,
  '42501', null,
  'an anonymous caller cannot read booking_search or its derived status [§3; §13; R-13]');

select throws_ok(
  $$select count(*) from public.booking_detail$$,
  '42501', null,
  'an anonymous caller cannot read booking_detail or its derived status [§3; §13; R-13]');

reset role;

select is(
  (select jsonb_build_object(
            'reloptions', array_to_string(c.reloptions, ','),
            'authenticated', has_table_privilege('authenticated', c.oid, 'select'),
            'anon', has_table_privilege('anon', c.oid, 'select'))
     from pg_class c where c.oid = 'public.booking_detail'::regclass),
  '{"reloptions": "security_invoker=true", "authenticated": true, "anon": false}'::jsonb,
  'booking_detail is still security_invoker, readable by authenticated and not by anon after gaining the derived status [§13; R-13]');

select ok(
  not has_function_privilege('anon', 'internal.bookings_with_live_checkout()', 'execute'),
  'an anonymous caller cannot execute the live-checkout helper [§13; R-15]');

select is(
  (select array_agg(c.relname::text || ':' || array_to_string(c.reloptions, ',') order by c.relname) from pg_class c
    where c.oid in ('public.booking_search'::regclass, 'public.management_customers'::regclass)),
  array['booking_search:security_invoker=true', 'management_customers:security_invoker=true'],
  'booking_search and management_customers are still security_invoker [§13; R-13]');

select hasnt_function('public', 'checkout_funnel',
  'the booking progress funnel is retired; abandoned is read from booking_search instead [OUR CHOICE — project owner''s direction, 13 September 2026]');

select * from finish();
rollback;
