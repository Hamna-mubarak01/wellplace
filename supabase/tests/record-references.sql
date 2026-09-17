begin;
select plan(28);

insert into public.staff (id, email, full_name, role) values
  ('c7a00000-0000-4000-8000-000000000001', 'references.reception@example.test', 'References Reception', 'reception'),
  ('c7a00000-0000-4000-8000-000000000002', 'references.manager@example.test',   'References Manager',   'management');

create temp table generated (label text primary key, value text not null);
create temp table cutoff as
  select m.inserted_at as at from supabase_migrations.schema_migrations m where m.version = '20260913090000';

select is(
  (select array_agg(s.start_value order by s.sequencename) from pg_sequences s
    where s.schemaname = 'internal'
      and s.sequencename in ('booking_number_seq', 'customer_number_seq', 'payment_number_seq', 'refund_number_seq')),
  array[1001, 1001, 1001, 1001]::bigint[],
  'the booking, customer, payment and refund counters each start at 1001 [OUR CHOICE — project owner''s direction, 13 September 2026]');

select has_sequence('internal', 'booking_reference_seq',
  'the old booking reference sequence is left in place [OUR CHOICE — project owner''s direction, 13 September 2026]');

insert into generated values ('booking', internal.next_booking_reference());

select matches(
  (select g.value from generated g where g.label = 'booking'),
  '^WP-B[1-9][0-9]{3,}$',
  'internal.next_booking_reference issues WP-B and a number with no zero padding [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select g.value from generated g where g.label = 'booking'),
  'WP-B' || currval('internal.booking_number_seq')::text,
  'and that number is the value it took from internal.booking_number_seq [OUR CHOICE — project owner''s direction, 13 September 2026]');

insert into public.customers (id, first_name, last_name, email, phone_e164, phone_country, date_of_birth)
values ('c7a00000-0000-4000-8000-0000000000c1', 'References', 'Guest', 'references.guest@example.test', '+971500000021', 'AE', date '1990-01-01');

select lives_ok(
  $$insert into public.bookings (id, reference, customer_id, source, status, experience_period, cleaning_buffer_minutes, subtotal_fils, tax_fils, total_fils)
    values ('c7a00000-0000-4000-8000-0000000000b1', internal.next_booking_reference(), 'c7a00000-0000-4000-8000-0000000000c1', 'walk_in', 'confirmed',
            tstzrange('2048-02-01 06:00Z', '2048-02-01 08:00Z', '[)'), 20, 33000, 1571, 33000)$$,
  'a booking row accepts a WP-B reference under bookings_reference_shaped and bookings_reference_length [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select count(*)::integer from public.bookings b, cutoff
    where b.created_at < cutoff.at and b.reference !~ '^WP-[0-9]{6}-[0-9A-F]{4}$'),
  0,
  'every booking created before the change keeps its original WP-000000-XXXX reference: sent references are never rewritten [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select count(*)::integer from (
     select c.reference, row_number() over (order by c.created_at, c.id) as position
       from public.customers c, cutoff where c.created_at < cutoff.at) n
    where n.reference <> 'WP-C' || (1000 + n.position)::text),
  0,
  'customers that existed before the change are numbered WP-C1001 onwards in created_at, id order [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select count(*)::integer from (
     select p.reference, row_number() over (order by p.created_at, p.id) as position
       from public.payments p, cutoff where p.created_at < cutoff.at) n
    where n.reference <> 'WP-P' || (1000 + n.position)::text),
  0,
  'payments that existed before the change are numbered WP-P1001 onwards in created_at, id order [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select count(*)::integer from (
     select r.reference, row_number() over (order by r.requested_at, r.id) as position
       from public.refunds r, cutoff where r.requested_at < cutoff.at) n
    where n.reference <> 'WP-R' || (1000 + n.position)::text),
  0,
  'refunds that existed before the change are numbered WP-R1001 onwards in requested_at, id order, since refunds carry no created_at [OUR CHOICE — project owner''s direction, 13 September 2026]');

select col_not_null('public', 'customers', 'reference', 'every customer has a reference [OUR CHOICE — project owner''s direction, 13 September 2026]');
select col_not_null('public', 'payments', 'reference', 'every payment has a reference [OUR CHOICE — project owner''s direction, 13 September 2026]');
select col_not_null('public', 'refunds', 'reference', 'every refund has a reference [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select array_agg(c.conname::text order by c.conname) from pg_constraint c
    where c.contype = 'u' and c.conname in ('customers_reference_key', 'payments_reference_key', 'refunds_reference_key')),
  array['customers_reference_key', 'payments_reference_key', 'refunds_reference_key'],
  'customer, payment and refund references are each unique [OUR CHOICE — project owner''s direction, 13 September 2026]');

select matches(
  (select c.reference from public.customers c where c.id = 'c7a00000-0000-4000-8000-0000000000c1'),
  '^WP-C[1-9][0-9]{3,}$',
  'a new customer receives its WP-C reference from the column default [OUR CHOICE — project owner''s direction, 13 September 2026]');

set local role service_role;
select lives_ok(
  $$insert into public.customers (id, first_name, last_name, email, phone_e164, phone_country)
    values ('c7a00000-0000-4000-8000-0000000000c2', 'Service', 'Role', 'references.service@example.test', '+971500000022', 'AE')$$,
  'a direct service_role insert, as seed and test scripts make, is not refused by the reference default [OUR CHOICE — project owner''s direction, 13 September 2026]');
reset role;

select matches(
  (select c.reference from public.customers c where c.id = 'c7a00000-0000-4000-8000-0000000000c2'),
  '^WP-C[1-9][0-9]{3,}$',
  'and that customer has a WP-C reference too [OUR CHOICE — project owner''s direction, 13 September 2026]');

set local role authenticated;
select throws_ok(
  $$select internal.next_record_reference('customer')$$,
  '42501', null,
  'a signed-in API caller cannot advance a reference counter directly [§13; R-15]');
reset role;

set local request.jwt.claims = '{"sub":"c7a00000-0000-4000-8000-000000000001"}';
insert into generated
  select 'payment', r.payment_id::text
    from public.record_booking_payment('c7a00000-0000-4000-8000-0000000000b1', 'cash', 33000, null, null, 'Paid at the desk') r;
insert into generated
  select 'refund', public.request_payment_refund((select g.value from generated g where g.label = 'payment')::uuid, 10000, 'Reference fixture refund', gen_random_uuid())::text;

select matches(
  (select p.reference from public.payments p where p.id = (select g.value from generated g where g.label = 'payment')::uuid),
  '^WP-P[1-9][0-9]{3,}$',
  'a payment written inside the SECURITY DEFINER record_booking_payment receives a WP-P reference [OUR CHOICE — project owner''s direction, 13 September 2026; R-15]');

select matches(
  (select r.reference from public.refunds r where r.id = (select g.value from generated g where g.label = 'refund')::uuid),
  '^WP-R[1-9][0-9]{3,}$',
  'a refund written inside the SECURITY DEFINER request_payment_refund receives a WP-R reference [OUR CHOICE — project owner''s direction, 13 September 2026; R-15]');

set local role authenticated;

select ok(
  exists (
    select 1 from public.booking_search bs
     where bs.booking_id = 'c7a00000-0000-4000-8000-0000000000b1'
       and bs.payment_reference ~* (select p.reference from public.payments p where p.booking_id = 'c7a00000-0000-4000-8000-0000000000b1')
       and (select p.reference from public.payments p where p.booking_id = 'c7a00000-0000-4000-8000-0000000000b1') = any(bs.payment_references)),
  'Reception finds a booking by its WP-P payment reference through booking_search [OUR CHOICE — project owner''s direction, 13 September 2026; §9.1]');

select ok(
  'c7a00000-0000-4000-8000-0000000000c1'::uuid = any(array(
    select rc.id from public.reception_customers((select c.reference from public.customers c where c.id = 'c7a00000-0000-4000-8000-0000000000c1')) rc)),
  'Reception finds a customer by WP-C reference [OUR CHOICE — project owner''s direction, 13 September 2026; §9.2]');

select matches(
  (select br.reference from public.booking_refunds('c7a00000-0000-4000-8000-0000000000b1') br limit 1),
  '^WP-R[1-9][0-9]{3,}$',
  'booking_refunds returns each refund''s WP-R reference to the staff member handling the booking [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select count(*)::integer from public.management_refund_ledger),
  0,
  'Reception without the named permission still reads nothing from the refund ledger [§10.6; INV-15]');

set local request.jwt.claims = '{"sub":"c7a00000-0000-4000-8000-000000000002"}';

select is(
  (select mc.reference from public.management_customers mc where mc.id = 'c7a00000-0000-4000-8000-0000000000c1'),
  (select c.reference from public.customers c where c.id = 'c7a00000-0000-4000-8000-0000000000c1'),
  'management_customers exposes the customer reference [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select l.reference from public.management_payment_ledger l where l.booking_id = 'c7a00000-0000-4000-8000-0000000000b1'),
  (select p.reference from public.payments p where p.booking_id = 'c7a00000-0000-4000-8000-0000000000b1'),
  'management_payment_ledger exposes the payment reference [OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  (select l.reference from public.management_refund_ledger l where l.booking_id = 'c7a00000-0000-4000-8000-0000000000b1'),
  (select r.reference from public.refunds r where r.booking_id = 'c7a00000-0000-4000-8000-0000000000b1'),
  'management_refund_ledger exposes the refund reference [OUR CHOICE — project owner''s direction, 13 September 2026]');

reset role;
set local request.jwt.claims = '';

select is(
  (select array_agg(c.relname::text || ':' || array_to_string(c.reloptions, ',') order by c.relname) from pg_class c
    where c.oid in ('public.booking_search'::regclass, 'public.management_customers'::regclass,
                    'public.management_payment_ledger'::regclass, 'public.management_refund_ledger'::regclass)),
  array['booking_search:security_invoker=true', 'management_customers:security_invoker=true',
        'management_payment_ledger:security_invoker=true', 'management_refund_ledger:security_invoker=true'],
  'the restated views are still security_invoker, so row policies still apply to the caller [§13; R-13]');

select is(
  (select array_agg(c.conname::text order by c.conname) from pg_constraint c
    where c.conname in ('payments_provider_reference_carries_no_card', 'refunds_provider_reference_carries_no_card')),
  array['payments_provider_reference_carries_no_card', 'refunds_provider_reference_carries_no_card'],
  'the card-number tripwire on provider_reference is untouched [§13]');

select * from finish();
rollback;
