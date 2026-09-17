begin;
select plan(31);

create function pg_temp.identity(p_email text, p_salutation text, p_first text, p_last text, p_dob text, p_phone text, p_country text)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'salutation', p_salutation, 'firstName', p_first, 'lastName', p_last,
    'email', p_email, 'dateOfBirth', p_dob, 'phoneE164', p_phone, 'phoneCountry', p_country)
$$;

create function pg_temp.progress(p_identity jsonb, p_starts_at timestamptz, p_accepted boolean)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'identity', p_identity,
    'selection', jsonb_build_object(
      'startsAt', to_char(p_starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS".000Z"'),
      'durationHours', 2, 'adults', 2, 'childAges', '[]'::jsonb,
      'addonQuantities', '{}'::jsonb, 'voucherCode', '', 'personalRequest', '',
      'paymentOption', 'card'),
    'acceptedTerms', p_accepted,
    'lastCompletedStep', 'details')
$$;

create function pg_temp.consent() returns jsonb language sql immutable as $$
  select '[{"document_slug":"legal-terms","document_version":"1.3","checkbox_text":"I agree"}]'::jsonb
$$;

create function pg_temp.customer_of(p_email text) returns public.customers language sql stable as $$
  select c.* from public.customers c where c.identity_key = internal.normalise_email(p_email)
$$;

create function pg_temp.details(p_email text) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'salutation', c.salutation, 'first_name', c.first_name, 'last_name', c.last_name, 'email', c.email,
    'date_of_birth', c.date_of_birth, 'phone_e164', c.phone_e164, 'phone_country', c.phone_country)
    from public.customers c where c.identity_key = internal.normalise_email(p_email)
$$;

create function pg_temp.customer_numbers_used() returns bigint language sql stable as $$
  select s.last_value from pg_sequences s where s.schemaname = 'internal' and s.sequencename = 'customer_number_seq'
$$;

create temp table counters (label text primary key, value bigint);
create temp table remembered (label text primary key, value jsonb);

select has_column('internal', 'checkout_sessions', 'customer_id',
  'a checkout session records which customer it belongs to [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select c.confdeltype::text from pg_constraint c
    where c.conrelid = 'internal.checkout_sessions'::regclass and c.contype = 'f'
      and c.confrelid = 'public.customers'::regclass),
  'n',
  'the session''s customer link is on delete set null, so a session never keeps a customer record alive [OUR CHOICE; INV-28]');

select has_index('internal', 'checkout_sessions', 'checkout_sessions_customer_idx',
  'the session''s customer foreign key has its own index [OUR CHOICE]');

select has_function('public', 'save_checkout_progress', array['uuid', 'jsonb', 'jsonb', 'integer', 'boolean'],
  'save_checkout_progress takes a trailing p_capture_customer flag [OUR CHOICE — project owner''s direction, 13 September 2026]');

select hasnt_function('public', 'save_checkout_progress', array['uuid', 'jsonb', 'jsonb', 'integer'],
  'and the four-argument overload is gone, so no call is ambiguous [OUR CHOICE]');

select ok(
  not has_function_privilege('anon', 'public.save_checkout_progress(uuid,jsonb,jsonb,integer,boolean)', 'execute')
    and not has_function_privilege('authenticated', 'public.save_checkout_progress(uuid,jsonb,jsonb,integer,boolean)', 'execute')
    and has_function_privilege('service_role', 'public.save_checkout_progress(uuid,jsonb,jsonb,integer,boolean)', 'execute'),
  'only the server''s service role may save checkout progress [§13; R-15]');

insert into counters select 'autosave.before', pg_temp.customer_numbers_used();

select lives_ok(
  $$select public.save_checkout_progress('cc000000-0000-4000-8000-00000000a010',
      pg_temp.progress(pg_temp.identity('sam@example.con', 'mr', 'Sam', 'Typist', '1991-01-01', '+971500000035', 'AE'), timestamptz '2048-03-01 06:00Z', true),
      pg_temp.consent(), 30, false);
    select public.save_checkout_progress('cc000000-0000-4000-8000-00000000a010',
      pg_temp.progress(pg_temp.identity('sam@example.co', 'mr', 'Sam', 'Typist', '1991-01-01', '+971500000035', 'AE'), timestamptz '2048-03-01 06:00Z', true),
      pg_temp.consent(), 30, false);
    select public.save_checkout_progress('cc000000-0000-4000-8000-00000000a010',
      pg_temp.progress(pg_temp.identity('sam@example.com', 'mr', 'Sam', 'Typist', '1991-01-01', '+971500000035', 'AE'), timestamptz '2048-03-01 06:00Z', true),
      pg_temp.consent(), 30)$$,
  'three auto-saves while the guest corrects their email all save [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select count(*)::integer from public.customers c
    where c.identity_key in (internal.normalise_email('sam@example.con'), internal.normalise_email('sam@example.co'), internal.normalise_email('sam@example.com'))),
  0,
  'saves without p_capture_customer create no customer for any of the half-typed or final addresses [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  pg_temp.customer_numbers_used(),
  (select c.value from counters c where c.label = 'autosave.before'),
  'and use up no WP-C number [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select jsonb_build_object('customer_id', s.customer_id, 'email', s.progress -> 'identity' ->> 'email')
     from internal.checkout_sessions s where s.token = 'cc000000-0000-4000-8000-00000000a010'),
  '{"customer_id": null, "email": "sam@example.com"}'::jsonb,
  'the progress itself is saved, with no customer linked [OUR CHOICE — project owner''s direction, 13 September 2026]');

select lives_ok(
  $$select public.save_checkout_progress('cc000000-0000-4000-8000-00000000a001',
      pg_temp.progress(pg_temp.identity('capture.guest@example.test', 'mr', 'Capture', 'Guest', '1990-01-01', '+971500000031', 'AE'), timestamptz '2048-03-01 06:00Z', true),
      pg_temp.consent(), 30, true)$$,
  'submitting the details step with accepted terms and p_capture_customer succeeds [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select count(*)::integer from public.customers c where c.identity_key = internal.normalise_email('capture.guest@example.test')),
  1,
  'submitting the details step creates exactly one customer for that email [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  pg_temp.details('capture.guest@example.test'),
  '{"salutation":"mr","first_name":"Capture","last_name":"Guest","email":"capture.guest@example.test","date_of_birth":"1990-01-01","phone_e164":"+971500000031","phone_country":"AE"}'::jsonb,
  'the new customer carries the details the guest typed [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select s.customer_id from internal.checkout_sessions s where s.token = 'cc000000-0000-4000-8000-00000000a001'),
  (pg_temp.customer_of('capture.guest@example.test')).id,
  'the checkout session is linked to that customer [OUR CHOICE — project owner''s direction, 13 September 2026]');

insert into counters select 'submit.before', pg_temp.customer_numbers_used();

select public.save_checkout_progress('cc000000-0000-4000-8000-00000000a010',
  pg_temp.progress(pg_temp.identity('sam@example.com', 'mr', 'Sam', 'Typist', '1991-01-01', '+971500000035', 'AE'), timestamptz '2048-03-01 06:00Z', true),
  pg_temp.consent(), 30, true);

select is(
  jsonb_build_object(
    'customers', (select count(*) from public.customers c
                   where c.identity_key in (internal.normalise_email('sam@example.con'), internal.normalise_email('sam@example.co'), internal.normalise_email('sam@example.com'))),
    'numbers_used', pg_temp.customer_numbers_used() - (select c.value from counters c where c.label = 'submit.before')),
  '{"customers": 1, "numbers_used": 1}'::jsonb,
  'the explicit submission after those auto-saves creates exactly one customer, for the final address, and uses exactly one WP-C number [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select s.customer_id from internal.checkout_sessions s where s.token = 'cc000000-0000-4000-8000-00000000a010'),
  (pg_temp.customer_of('sam@example.com')).id,
  'and links that session to it [OUR CHOICE — project owner''s direction, 13 September 2026]');

update public.customers set last_interaction_at = now() - interval '30 days'
 where identity_key = internal.normalise_email('capture.guest@example.test');
insert into remembered
select 'capture.guest', to_jsonb(c) from public.customers c where c.identity_key = internal.normalise_email('capture.guest@example.test');

select public.save_checkout_progress('cc000000-0000-4000-8000-00000000a006',
  pg_temp.progress(pg_temp.identity('capture.guest@example.test', 'ms', 'Someone', 'Else', '1970-07-07', '+971500000099', 'AE'), timestamptz '2048-03-01 06:00Z', true),
  pg_temp.consent(), 30, false);
select public.save_checkout_progress('cc000000-0000-4000-8000-00000000a001',
  pg_temp.progress(pg_temp.identity('capture.gues@example.test', 'ms', 'Someone', 'Else', '1970-07-07', '+971500000099', 'AE'), timestamptz '2048-03-01 06:00Z', true),
  pg_temp.consent(), 30);

select is(
  (select to_jsonb(c) from public.customers c where c.identity_key = internal.normalise_email('capture.guest@example.test')),
  (select r.value from remembered r where r.label = 'capture.guest'),
  'an existing customer whose email the guest types is left entirely untouched by saves without p_capture_customer, last_interaction_at included [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select s.customer_id from internal.checkout_sessions s where s.token = 'cc000000-0000-4000-8000-00000000a001'),
  (pg_temp.customer_of('capture.guest@example.test')).id,
  'a later auto-save on a session that was already captured keeps its customer link [OUR CHOICE — project owner''s direction, 13 September 2026]');

insert into counters select 'before', pg_temp.customer_numbers_used();

select lives_ok(
  $$select public.save_checkout_progress('cc000000-0000-4000-8000-00000000a002',
      pg_temp.progress(pg_temp.identity('Capture.Guest@EXAMPLE.test', 'ms', 'Capture', 'Changed', '1985-05-05', '+447700900123', 'GB'), timestamptz '2048-03-01 06:00Z', true),
      pg_temp.consent(), 30, true)$$,
  'a second checkout submitting the same email in different case saves [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select count(*)::integer from public.customers c where c.identity_key = internal.normalise_email('capture.guest@example.test')),
  1,
  'the same email in different case updates that customer and never creates a second one [OUR CHOICE — project owner''s direction, 13 September 2026; Q-1 ASSUMED]');

select is(
  pg_temp.details('capture.guest@example.test'),
  '{"salutation":"ms","first_name":"Capture","last_name":"Changed","email":"capture.guest@example.test","date_of_birth":"1985-05-05","phone_e164":"+447700900123","phone_country":"GB"}'::jsonb,
  'with p_capture_customer, salutation, names, date of birth, mobile and its country are overwritten with what the guest typed; the stored email is left as it was [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (pg_temp.customer_of('capture.guest@example.test')).last_interaction_at,
  now(),
  'and last_interaction_at is brought to now [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select s.customer_id from internal.checkout_sessions s where s.token = 'cc000000-0000-4000-8000-00000000a002'),
  (pg_temp.customer_of('capture.guest@example.test')).id,
  'the second session is linked to the same customer [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  pg_temp.customer_numbers_used(),
  (select c.value from counters c where c.label = 'before'),
  'updating a returning guest does not consume a WP-C number [OUR CHOICE — project owner''s direction, 13 September 2026]');

select throws_ok(
  $$select public.save_checkout_progress('cc000000-0000-4000-8000-00000000a003',
      pg_temp.progress(pg_temp.identity('capture.refused@example.test', 'mr', 'Refused', 'Guest', '1990-01-01', '+971500000032', 'AE'), timestamptz '2048-03-01 06:00Z', false),
      pg_temp.consent(), 30, true)$$,
  'WP062', null,
  'progress without accepted terms is refused, even when submitted for capture [§6.3]');

select throws_ok(
  $$select public.save_checkout_progress('cc000000-0000-4000-8000-00000000a004',
      pg_temp.progress(pg_temp.identity('capture.empty@example.test', 'mr', 'Empty', 'Consent', '1990-01-01', '+971500000033', 'AE'), timestamptz '2048-03-01 06:00Z', true),
      '[]'::jsonb, 30, true)$$,
  'WP062', null,
  'progress with no consent record is refused [§6.3]');

select is(
  (select count(*)::integer from public.customers c
    where c.identity_key in (internal.normalise_email('capture.refused@example.test'), internal.normalise_email('capture.empty@example.test'))),
  0,
  'no customer is created when the terms are not accepted [§6.3; OUR CHOICE — project owner''s direction, 13 September 2026]');

select ok(
  (select strpos(d, 'insert into internal.checkout_sessions') between 1 and strpos(d, 'update public.customers') - 1
     from (select pg_get_functiondef('public.save_checkout_progress(uuid,jsonb,jsonb,integer,boolean)'::regprocedure) as d) f),
  'save_checkout_progress writes the session row before it touches a customer, the same lock order as prepare_guest_payment, so the two cannot deadlock [OUR CHOICE]');

insert into public.suites (id, suite_number, status, priority)
values ('cc000000-0000-4000-8000-000000005001', 9831, 'available', -9999);
insert into public.suite_occupancy (id, suite_id, kind, experience_period, blocked_period, cleaning_buffer_minutes, expires_at)
values ('cc000000-0000-4000-8000-000000006001', 'cc000000-0000-4000-8000-000000005001', 'hold',
        tstzrange('2048-03-02 06:00Z', '2048-03-02 08:00Z', '[)'),
        tstzrange('2048-03-02 06:00Z', '2048-03-02 08:20Z', '[)'), 20, now() + interval '10 minutes');
insert into internal.guest_checkout_holds (token, occupancy_id)
values ('cc000000-0000-4000-8000-00000000a005', 'cc000000-0000-4000-8000-000000006001');

select lives_ok(
  $$select public.save_checkout_progress('cc000000-0000-4000-8000-00000000a005',
      pg_temp.progress(pg_temp.identity('capture.checkout@example.test', 'ms', 'Capture', 'Checkout', '1992-02-02', '+971500000034', 'AE'), timestamptz '2048-03-02 06:00Z', true),
      pg_temp.consent(), 30, true);
    select public.prepare_guest_payment('cc000000-0000-4000-8000-00000000a005', gen_random_uuid(),
      jsonb_build_object(
        'breakdown', jsonb_build_object('outcome', 'priced', 'subtotalFils', 66000, 'discountFils', 0, 'addonsTotalFils', 0,
          'serviceFeeFils', 0, 'taxFils', 3143, 'totalFils', 66000, 'regularTotalFils', 88000, 'savingFils', 22000,
          'taxIsIncluded', true, 'lines', '[]'::jsonb),
        'cart', '[]'::jsonb, 'taxLabel', 'VAT', 'offerLabel', 'Special offer',
        'progress', pg_temp.progress(pg_temp.identity('capture.checkout@example.test', 'ms', 'Capture', 'Checkout', '1992-02-02', '+971500000034', 'AE'), timestamptz '2048-03-02 06:00Z', true)),
      public.checkout_revision(), 'AED', true)$$,
  'the unchanged prepare_guest_payment still starts payment after the details step created the customer [OUR CHOICE — project owner''s direction, 13 September 2026; §8]');

select is(
  (select jsonb_build_object(
            'same_customer', b.customer_id = s.customer_id,
            'customers_for_email', (select count(*) from public.customers c where c.identity_key = internal.normalise_email('capture.checkout@example.test')))
     from internal.checkout_attempts a
     join public.bookings b on b.id = a.booking_id
     join internal.checkout_sessions s on s.token = a.token
    where a.token = 'cc000000-0000-4000-8000-00000000a005'),
  '{"same_customer": true, "customers_for_email": 1}'::jsonb,
  'the booking it creates belongs to the customer the details step created, and no second customer appears [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select jsonb_build_object('booking', b.reference ~ '^WP-B[1-9][0-9]{3,}$', 'payment', p.reference ~ '^WP-P[1-9][0-9]{3,}$')
     from internal.checkout_attempts a
     join public.bookings b on b.id = a.booking_id
     join public.payments p on p.id = a.payment_id
    where a.token = 'cc000000-0000-4000-8000-00000000a005'),
  '{"booking": true, "payment": true}'::jsonb,
  'an online booking and its payment receive WP-B and WP-P references [OUR CHOICE — project owner''s direction, 13 September 2026]');

select * from finish();
rollback;
