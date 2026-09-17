begin;
select plan(88);

insert into public.staff (id, email, full_name, role) values
  ('a3000000-0000-4000-8000-000000000001', 'ai.manager@example.test',   'AI Manager',   'management'),
  ('a3000000-0000-4000-8000-000000000002', 'ai.reception@example.test', 'AI Reception', 'reception');

update public.settings set value = null
 where key in ('invoice.issuer_legal_name', 'invoice.issuer_trn', 'invoice.issuer_address', 'invoice.number_prefix');

insert into public.customers (id, first_name, last_name, email, phone_e164, phone_country) values
  ('a3000000-0000-4000-8000-0000000000c1', 'Ada', 'Invoice', 'ada.invoice@example.test', '+971500000081', 'AE');

insert into public.bookings
  (id, reference, customer_id, source, status, experience_period, cleaning_buffer_minutes,
   subtotal_fils, tax_fils, total_fils, is_complimentary)
values
  ('a3000000-0000-4000-8000-0000000000b1', 'WPAI0001', 'a3000000-0000-4000-8000-0000000000c1', 'walk_in', 'confirmed',
   tstzrange(timestamptz '2043-01-01 10:00+04', timestamptz '2043-01-01 12:00+04', '[)'), 20, 66000, 3143, 66000, false),
  ('a3000000-0000-4000-8000-0000000000b2', 'WPAI0002', 'a3000000-0000-4000-8000-0000000000c1', 'walk_in', 'confirmed',
   tstzrange(timestamptz '2043-01-02 10:00+04', timestamptz '2043-01-02 12:00+04', '[)'), 20, 66000, 3143, 66000, false),
  ('a3000000-0000-4000-8000-0000000000b3', 'WPAI0003', 'a3000000-0000-4000-8000-0000000000c1', 'walk_in', 'confirmed',
   tstzrange(timestamptz '2043-01-03 10:00+04', timestamptz '2043-01-03 12:00+04', '[)'), 20, 66000, 3143, 66000, false),
  ('a3000000-0000-4000-8000-0000000000b4', 'WPAI0004', 'a3000000-0000-4000-8000-0000000000c1', 'telephone', 'confirmed',
   tstzrange(timestamptz '2043-01-04 10:00+04', timestamptz '2043-01-04 12:00+04', '[)'), 20, 66000, 3143, 66000, false),
  ('a3000000-0000-4000-8000-0000000000b5', 'WPAI0005', 'a3000000-0000-4000-8000-0000000000c1', 'walk_in', 'checked_in',
   tstzrange(timestamptz '2043-01-05 10:00+04', timestamptz '2043-01-05 12:00+04', '[)'), 20, 66000, 3143, 66000, false),
  ('a3000000-0000-4000-8000-0000000000b6', 'WPAI0006', 'a3000000-0000-4000-8000-0000000000c1', 'walk_in', 'confirmed',
   tstzrange(timestamptz '2043-01-06 10:00+04', timestamptz '2043-01-06 12:00+04', '[)'), 20, 66000, 3143, 66000, false),
  ('a3000000-0000-4000-8000-0000000000b7', 'WPAI0007', 'a3000000-0000-4000-8000-0000000000c1', 'complimentary', 'confirmed',
   tstzrange(timestamptz '2043-01-07 10:00+04', timestamptz '2043-01-07 12:00+04', '[)'), 20, 0, 0, 0, true),
  ('a3000000-0000-4000-8000-0000000000b8', 'WPAI0008', 'a3000000-0000-4000-8000-0000000000c1', 'telephone', 'confirmed',
   tstzrange(timestamptz '2043-01-08 10:00+04', timestamptz '2043-01-08 12:00+04', '[)'), 20, 66000, 3143, 66000, false),
  ('a3000000-0000-4000-8000-0000000000b9', 'WPAI0009', 'a3000000-0000-4000-8000-0000000000c1', 'telephone', 'awaiting_payment',
   tstzrange(timestamptz '2043-01-09 10:00+04', timestamptz '2043-01-09 12:00+04', '[)'), 20, 66000, 3143, 66000, false),
  ('a3000000-0000-4000-8000-0000000000ba', 'WPAI0010', 'a3000000-0000-4000-8000-0000000000c1', 'walk_in', 'confirmed',
   tstzrange(timestamptz '2043-01-10 10:00+04', timestamptz '2043-01-10 12:00+04', '[)'), 20, 66000, 3143, 66000, false),
  ('a3000000-0000-4000-8000-0000000000bb', 'WPAI0011', 'a3000000-0000-4000-8000-0000000000c1', 'walk_in', 'confirmed',
   tstzrange(timestamptz '2043-01-11 10:00+04', timestamptz '2043-01-11 12:00+04', '[)'), 20, 66000, 3143, 66000, false),
  ('a3000000-0000-4000-8000-0000000000bc', 'WPAI0012', 'a3000000-0000-4000-8000-0000000000c1', 'walk_in', 'confirmed',
   tstzrange(timestamptz '2043-01-12 10:00+04', timestamptz '2043-01-12 12:00+04', '[)'), 20, 66000, 3143, 66000, false),
  ('a3000000-0000-4000-8000-0000000000bd', 'WPAI0013', 'a3000000-0000-4000-8000-0000000000c1', 'walk_in', 'confirmed',
   tstzrange(timestamptz '2043-01-13 10:00+04', timestamptz '2043-01-13 12:00+04', '[)'), 20, 66000, 3143, 66000, false),
  ('a3000000-0000-4000-8000-0000000000be', 'WPAI0014', 'a3000000-0000-4000-8000-0000000000c1', 'walk_in', 'confirmed',
   tstzrange(timestamptz '2043-01-14 10:00+04', timestamptz '2043-01-14 12:00+04', '[)'), 20, 66000, 3143, 66000, false),
  ('a3000000-0000-4000-8000-0000000000bf', 'WPAI0015', 'a3000000-0000-4000-8000-0000000000c1', 'walk_in', 'confirmed',
   tstzrange(timestamptz '2043-01-15 10:00+04', timestamptz '2043-01-15 12:00+04', '[)'), 20, 66000, 3143, 66000, false),
  ('a3000000-0000-4000-8000-0000000000d1', 'WPAI0016', 'a3000000-0000-4000-8000-0000000000c1', 'walk_in', 'confirmed',
   tstzrange(timestamptz '2043-01-16 10:00+04', timestamptz '2043-01-16 12:00+04', '[)'), 20, 66000, 3143, 66000, false),
  ('a3000000-0000-4000-8000-0000000000d2', 'WPAI0017', 'a3000000-0000-4000-8000-0000000000c1', 'walk_in', 'checked_in',
   tstzrange(timestamptz '2043-01-17 10:00+04', timestamptz '2043-01-17 12:00+04', '[)'), 20, 66000, 3143, 66000, false),
  ('a3000000-0000-4000-8000-0000000000e1', 'WPAI0018', 'a3000000-0000-4000-8000-0000000000c1', 'walk_in', 'confirmed',
   tstzrange(timestamptz '2043-01-18 10:00+04', timestamptz '2043-01-18 12:00+04', '[)'), 20, 66000, 3143, 66000, false),
  ('a3000000-0000-4000-8000-0000000000e2', 'WPAI0019', 'a3000000-0000-4000-8000-0000000000c1', 'walk_in', 'confirmed',
   tstzrange(timestamptz '2043-01-19 10:00+04', timestamptz '2043-01-19 12:00+04', '[)'), 20, 66000, 3143, 66000, false);

insert into public.booking_guests (booking_id, kind, age)
select b.id, 'adult', null
  from public.bookings b, generate_series(1, 2)
 where b.reference like 'WPAI%';

create temp table ids (label text primary key, id uuid not null);
create temp table counters (label text primary key, value bigint);
create temp table steps (label text primary key, result jsonb);
grant all on ids, counters, steps to public;

create function pg_temp.id(p_label text) returns uuid language sql stable as $$
  select i.id from ids i where i.label = p_label
$$;

create function pg_temp.invoices_of(p_booking uuid) returns integer language sql stable as $$
  select count(*)::integer from public.invoices i where i.booking_id = p_booking
$$;

create function pg_temp.missing(p_booking uuid) returns jsonb language sql stable as $$
  select jsonb_build_object('reason', m.reason, 'uncovered', m.uncovered_fils, 'uncredited', m.uncredited_refund_fils)
    from public.management_missing_invoices m
   where m.booking_id = p_booking
$$;

create function pg_temp.balance(p_booking uuid) returns jsonb language sql stable as $$
  with eligible as (
    select p.id, p.amount_fils, p.tax_fils
      from public.payments p
     where p.booking_id = p_booking
       and p.status in ('paid', 'partially_refunded', 'fully_refunded')
       and not exists (select 1 from public.refunds r where r.payment_id = p.id and r.requested_by is null and r.withdrawn_at is null)
  )
  select jsonb_build_object(
    'documents',
      coalesce((select sum(i.total_fils) from public.invoices i where i.booking_id = p_booking and i.voided_at is null), 0)
      - coalesce((select sum(cn.amount_fils) from public.credit_notes cn where cn.booking_id = p_booking and cn.voided_at is null), 0),
    'money',
      coalesce((select sum(e.amount_fils) from eligible e), 0)
      - coalesce((select sum(r.amount_fils) from public.refunds r join eligible e on e.id = r.payment_id
                   where r.settled_at is not null and r.withdrawn_at is null), 0),
    'document_vat',
      coalesce((select sum(i.tax_fils) from public.invoices i where i.booking_id = p_booking and i.voided_at is null), 0)
      - coalesce((select sum(cn.tax_fils) from public.credit_notes cn where cn.booking_id = p_booking and cn.voided_at is null), 0),
    'money_vat',
      coalesce((select sum(e.tax_fils) from eligible e), 0)
      - coalesce((select sum(r.tax_fils) from public.refunds r join eligible e on e.id = r.payment_id
                   where r.settled_at is not null and r.withdrawn_at is null), 0))
$$;

create function pg_temp.progress(p_token uuid, p_starts_at timestamptz) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'identity', jsonb_build_object(
      'salutation', 'mr', 'firstName', 'Otto', 'lastName', 'Online',
      'email', p_token::text || '@example.test', 'dateOfBirth', '1990-01-01',
      'phoneE164', '+971500000082', 'phoneCountry', 'AE'),
    'selection', jsonb_build_object(
      'startsAt', to_char(p_starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS".000Z"'),
      'durationHours', 2, 'adults', 2, 'childAges', '[]'::jsonb,
      'addonQuantities', '{}'::jsonb, 'voucherCode', '', 'personalRequest', '',
      'paymentOption', 'card'),
    'acceptedTerms', true,
    'lastCompletedStep', 'confirm')
$$;

create function pg_temp.open_checkout(p_checkout text, p_suite_number integer, p_starts_at timestamptz)
returns void language plpgsql as $$
declare
  v_token uuid := gen_random_uuid();
  v_suite uuid := gen_random_uuid();
  v_hold  uuid;
begin
  insert into public.suites (id, suite_number, status, priority) values (v_suite, p_suite_number, 'available', -9999);
  insert into public.suite_occupancy (suite_id, kind, experience_period, blocked_period, cleaning_buffer_minutes, expires_at)
  values (v_suite, 'hold', tstzrange(p_starts_at, p_starts_at + interval '2 hours', '[)'),
          tstzrange(p_starts_at, p_starts_at + interval '2 hours 20 minutes', '[)'), 20, now() + interval '10 minutes')
  returning id into v_hold;
  insert into internal.guest_checkout_holds (token, occupancy_id) values (v_token, v_hold);
  perform public.save_checkout_progress(v_token, pg_temp.progress(v_token, p_starts_at),
    '[{"document_slug":"legal-terms","document_version":"1.3","checkbox_text":"I agree"}]'::jsonb, 30);
  insert into ids values (p_checkout || '.token', v_token);
end
$$;

create function pg_temp.prepare(p_checkout text) returns uuid language plpgsql as $$
declare
  v_token    uuid := pg_temp.id(p_checkout || '.token');
  v_progress jsonb;
begin
  select s.progress into v_progress from internal.checkout_sessions s where s.token = v_token;
  return (public.prepare_guest_payment(v_token, gen_random_uuid(),
    jsonb_build_object(
      'breakdown', jsonb_build_object('outcome', 'priced', 'subtotalFils', 66000, 'discountFils', 0, 'addonsTotalFils', 0,
        'serviceFeeFils', 0, 'taxFils', 3143, 'totalFils', 66000, 'regularTotalFils', 88000,
        'savingFils', 22000, 'taxIsIncluded', true, 'lines', '[]'::jsonb),
      'cart', '[]'::jsonb, 'taxLabel', 'VAT', 'offerLabel', 'Special offer', 'progress', v_progress),
    public.checkout_revision(), 'AED', true) ->> 'paymentId')::uuid;
end
$$;

create function pg_temp.settle(p_payment uuid, p_outcome text) returns jsonb language sql as $$
  select public.settle_payment_event('simulation',
           internal.opaque_reference('AUTOINV2-', p.id) || '-' || upper(p_outcome),
           p.id, p_outcome, p.amount_fils, 'AED', true, '{}'::jsonb)
    from public.payments p
   where p.id = p_payment
$$;

create function pg_temp.booking_of(p_payment uuid) returns uuid language sql stable as $$
  select p.booking_id from public.payments p where p.id = p_payment
$$;

create function pg_temp.legacy_invoice(p_booking uuid) returns uuid language plpgsql as $$
declare
  v_sequence bigint;
  v_invoice  uuid;
begin
  update internal.invoice_numbering n set last_sequence_no = n.last_sequence_no + 1 where n.id
  returning n.last_sequence_no into v_sequence;

  insert into public.invoices (invoice_number, sequence_no, booking_id, customer_id, issuer, bill_to, lines, tax,
    subtotal_fils, discount_fils, addons_fils, service_fee_fils, tax_fils, total_fils, paid_fils, currency, taxable_fils, supply_date)
  select 'INV-' || to_char(now() at time zone 'Asia/Dubai', 'YYYY') || '-' || lpad(v_sequence::text, 6, '0'),
         v_sequence, b.id, b.customer_id,
         '{"legal_name": "Sample Issuer Trading L.L.C.", "trn": "100123456700003", "address": "Unit 1, Example Street, Dubai"}'::jsonb,
         jsonb_build_object('salutation', c.salutation, 'first_name', c.first_name, 'last_name', c.last_name,
                            'name', c.first_name || ' ' || c.last_name, 'email', c.email, 'phone_e164', c.phone_e164),
         '[{"kind": "visit", "label": "Visit", "quantity": null, "unit_price_fils": null, "amount_fils": 66000, "is_included": false}]'::jsonb,
         '{"label": "VAT", "rate_percent": 5, "is_included": true}'::jsonb,
         66000, 0, 0, 0, 3143, 66000, 20000, 'AED', 62857, (lower(b.experience_period) at time zone 'Asia/Dubai')::date
    from public.bookings b
    join public.customers c on c.id = b.customer_id
   where b.id = p_booking
  returning id into v_invoice;

  insert into public.invoice_payments (invoice_id, payment_id, amount_fils, tax_fils)
  select v_invoice, p.id, p.amount_fils, p.tax_fils from public.payments p where p.booking_id = p_booking;

  return v_invoice;
end
$$;

select has_table('public', 'credit_notes',
  '[OUR CHOICE — project owner''s direction, 14 September 2026] credit notes are a table of their own');

select has_table('public', 'invoice_payments',
  '[OUR CHOICE — project owner''s direction, 14 September 2026; §8] and so is the link between an invoice and the payments it covers');

select ok(
  (select bool_and(c.relrowsecurity) from pg_class c
    where c.oid in ('public.credit_notes'::regclass, 'public.invoice_payments'::regclass)),
  '[R-13] both with row level security enabled');

select hasnt_index('public', 'invoices', 'invoices_one_live_per_booking_idx',
  'a booking may carry more than one valid invoice, so the one-live-invoice index is gone [OUR CHOICE — project owner''s direction, 14 September 2026]');


set local lock_timeout = '7s';
set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000002"}';
insert into ids select 'b1.payment', r.payment_id
  from public.record_booking_payment('a3000000-0000-4000-8000-0000000000b1', 'cash', 66000, null, null, 'Paid at the desk') r;
reset role;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';

select is(
  jsonb_build_object(
    'payment', (select p.status from public.payments p where p.id = pg_temp.id('b1.payment')),
    'invoices', pg_temp.invoices_of('a3000000-0000-4000-8000-0000000000b1'),
    'lock_timeout', current_setting('lock_timeout')),
  '{"payment": "paid", "invoices": 0, "lock_timeout": "7s"}'::jsonb,
  'rule 4: with the invoice details missing from Settings a desk payment still settles, no invoice is written, and the caller''s lock_timeout is restored [OUR CHOICE — project owner''s direction, 14 September 2026]');

select is(
  pg_temp.missing('a3000000-0000-4000-8000-0000000000b1'),
  '{"reason": "payment_not_invoiced", "uncovered": 66000, "uncredited": 0}'::jsonb,
  'rule 4, finding 2: the fully paid booking is listed under Missing invoices [OUR CHOICE]');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000002"}';
insert into ids select 'b3.payment', r.payment_id
  from public.record_booking_payment('a3000000-0000-4000-8000-0000000000b3', 'card_terminal', 66000, null, null, 'Paid at the desk') r;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';
insert into ids select 'b3.refund', public.request_payment_refund(
  (select i.id from ids i where i.label = 'b3.payment'), 10000, 'Late start goodwill', 'a3000000-0000-4000-8000-00000000f301');
select * from public.confirm_refund_return((select i.id from ids i where i.label = 'b3.refund'), 'BANKB3', 'Returned by bank');
reset role;

select is(
  jsonb_build_object(
    'invoices', pg_temp.invoices_of('a3000000-0000-4000-8000-0000000000b3'),
    'credit_notes', (select count(*) from public.credit_notes cn where cn.booking_id = 'a3000000-0000-4000-8000-0000000000b3'),
    'refund_settled', (select r.settled_at is not null from public.refunds r where r.id = pg_temp.id('b3.refund'))),
  '{"invoices": 0, "credit_notes": 0, "refund_settled": true}'::jsonb,
  'a refund that settles while no valid invoice covers its payment settles and creates no credit note yet [OUR CHOICE]');

set local request.jwt.claims = '';
select pg_temp.open_checkout('online.empty', 9931, timestamptz '2043-02-01 06:00Z');
insert into ids select 'online.empty.payment', pg_temp.prepare('online.empty');
insert into steps select 'online.empty', pg_temp.settle(pg_temp.id('online.empty.payment'), 'success');
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';

select is(
  jsonb_build_object(
    'result', (select s.result ->> 'status' from steps s where s.label = 'online.empty'),
    'payment', (select p.status from public.payments p where p.id = pg_temp.id('online.empty.payment')),
    'invoices', pg_temp.invoices_of(pg_temp.booking_of(pg_temp.id('online.empty.payment'))),
    'missing', pg_temp.missing(pg_temp.booking_of(pg_temp.id('online.empty.payment'))) ->> 'reason'),
  '{"result": "confirmed", "payment": "paid", "invoices": 0, "missing": "payment_not_invoiced"}'::jsonb,
  'rule 4: an online settlement with the invoice details missing still confirms and pays, and the booking is listed as missing [§8; OUR CHOICE]');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000002"}';
select * from public.record_booking_payment('a3000000-0000-4000-8000-0000000000b9', 'cash', 66000, null, null, 'Paid before confirmation');
reset role;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';

select is(pg_temp.invoices_of('a3000000-0000-4000-8000-0000000000b9'), 0,
  'rule 2: a fully paid booking that is not confirmed is never invoiced automatically [OUR CHOICE]');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000002"}';
insert into ids select 'd1.payment', r.payment_id
  from public.record_booking_payment('a3000000-0000-4000-8000-0000000000d1', 'card_terminal', 66000, null, null, 'Paid at the desk') r;
select * from public.record_booking_payment('a3000000-0000-4000-8000-0000000000d2', 'cash', 66000, null, null, 'Paid at the desk');
insert into ids select 'bc.card', r.payment_id
  from public.record_booking_payment('a3000000-0000-4000-8000-0000000000bc', 'card_terminal', 66000, null, null, 'Card at the desk') r;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';
insert into ids select 'd1.refund', public.request_payment_refund(
  (select i.id from ids i where i.label = 'd1.payment'), 5000, 'Late start goodwill', 'a3000000-0000-4000-8000-00000000fd11');
select * from public.confirm_refund_return((select i.id from ids i where i.label = 'd1.refund'), 'BANKD1', 'Returned');
insert into ids select 'bc.refund', public.request_payment_refund(
  (select i.id from ids i where i.label = 'bc.card'), 66000, 'Guest switched to cash', 'a3000000-0000-4000-8000-00000000fc01');
reset role;

update public.bookings set overrun_minutes = 12, overrun_fils = 5500 where id = 'a3000000-0000-4000-8000-0000000000d2';

select is(
  jsonb_build_object(
    'refunded', pg_temp.missing('a3000000-0000-4000-8000-0000000000d1') ->> 'reason',
    'overstay', pg_temp.missing('a3000000-0000-4000-8000-0000000000d2') ->> 'reason'),
  '{"refunded": "payment_not_invoiced", "overstay": "payment_not_invoiced"}'::jsonb,
  'finding P3-C: a fully paid booking stays under Missing invoices after a goodwill refund settles or an unpaid overstay is recorded');


update public.settings set value = '"Sample Issuer Trading L.L.C."'::jsonb where key = 'invoice.issuer_legal_name';
update public.settings set value = '"100123456700003"'::jsonb where key = 'invoice.issuer_trn';
update public.settings set value = '"Unit 1, Example Street, Dubai"'::jsonb where key = 'invoice.issuer_address';

set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000002"}';
select * from public.record_booking_payment('a3000000-0000-4000-8000-0000000000bc', 'cash', 66000, null, null, 'Cash at the desk');
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';
select * from public.confirm_refund_return((select i.id from ids i where i.label = 'bc.refund'), 'BANKBC', 'Returned to the card');
reset role;

select is(
  (select jsonb_build_object(
            'total', i.total_fils, 'tax', i.tax_fils,
            'lines', (select jsonb_agg(jsonb_build_object('kind', l ->> 'kind', 'amount', (l ->> 'amount_fils')::integer,
                                                          'vat', (l ->> 'tax_fils')::integer))
                        from jsonb_array_elements(i.lines) l),
            'payments_vat', (select sum(p.tax_fils)::integer from public.invoice_payments c
                               join public.payments p on p.id = c.payment_id where c.invoice_id = i.id))
     from public.invoices i where i.booking_id = 'a3000000-0000-4000-8000-0000000000bc'),
  '{"total": 132000, "tax": 6286, "lines": [{"kind": "visit", "amount": 66000, "vat": 3143}, {"kind": "payment_on_account", "amount": 66000, "vat": 3143}], "payments_vat": 6286}'::jsonb,
  'finding P2-A: an invoice covering a card payment awaiting refund and its cash replacement carries both payments'' frozen VAT, the second on a payment_on_account line');

select is(
  jsonb_build_object('documents', pg_temp.balance('a3000000-0000-4000-8000-0000000000bc') -> 'documents',
                     'vat', pg_temp.balance('a3000000-0000-4000-8000-0000000000bc') -> 'document_vat'),
  jsonb_build_object('documents', pg_temp.balance('a3000000-0000-4000-8000-0000000000bc') -> 'money',
                     'vat', pg_temp.balance('a3000000-0000-4000-8000-0000000000bc') -> 'money_vat'),
  'finding P2-A: once the card refund settles, its credit note leaves invoices less credit notes equal to money kept, in money and in VAT');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000002"}';
insert into ids select 'bd.card', r.payment_id
  from public.record_booking_payment('a3000000-0000-4000-8000-0000000000bd', 'card_terminal', 66000, null, null, 'Card at the desk') r;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';
insert into ids select 'bd.refund', public.request_payment_refund(
  (select i.id from ids i where i.label = 'bd.card'), 66000, 'Guest switched to cash', 'a3000000-0000-4000-8000-00000000fd01');
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000002"}';
select * from public.record_booking_payment('a3000000-0000-4000-8000-0000000000bd', 'cash', 66000, null, null, 'Cash at the desk');
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';
reset role;

select is(
  (select jsonb_agg(jsonb_build_object('tax', i.tax_fils, 'kinds', (select jsonb_agg(l ->> 'kind') from jsonb_array_elements(i.lines) l))
                    order by i.sequence_no)
     from public.invoices i where i.booking_id = 'a3000000-0000-4000-8000-0000000000bd'),
  '[{"tax": 3143, "kinds": ["visit"]}, {"tax": 3143, "kinds": ["payment_on_account"]}]'::jsonb,
  'finding P2-A: a second payment on a visit already invoiced is invoiced as a payment on account carrying its own frozen VAT');

set local role authenticated;
select count(*) from public.invoices i, lateral public.void_invoice(i.id, 'Merge into one document') v
 where i.booking_id = 'a3000000-0000-4000-8000-0000000000bd' and i.voided_at is null;
insert into ids select 'bd.invoice', i.id from public.issue_invoice('a3000000-0000-4000-8000-0000000000bd') i;
select * from public.confirm_refund_return((select i.id from ids i where i.label = 'bd.refund'), 'BANKBD', 'Returned to the card');
reset role;

select is(
  jsonb_build_object(
    'valid_invoices', (select count(*) from public.invoices i where i.booking_id = 'a3000000-0000-4000-8000-0000000000bd' and i.voided_at is null),
    'tax', (select i.tax_fils from public.invoices i where i.id = pg_temp.id('bd.invoice')),
    'documents', pg_temp.balance('a3000000-0000-4000-8000-0000000000bd') -> 'documents',
    'vat', pg_temp.balance('a3000000-0000-4000-8000-0000000000bd') -> 'document_vat'),
  jsonb_build_object(
    'valid_invoices', 1,
    'tax', 6286,
    'documents', pg_temp.balance('a3000000-0000-4000-8000-0000000000bd') -> 'money',
    'vat', pg_temp.balance('a3000000-0000-4000-8000-0000000000bd') -> 'money_vat'),
  'finding P2-A, settings complete: voiding both invoices, Issue now and settling the card refund keep money and VAT in balance');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000002"}';
select * from public.record_booking_payment('a3000000-0000-4000-8000-0000000000be', 'cash', 20000, null, null, 'Deposit');
select * from public.record_booking_payment('a3000000-0000-4000-8000-0000000000bf', 'cash', 20000, null, null, 'Deposit');
reset role;

insert into ids select 'be.legacy', pg_temp.legacy_invoice('a3000000-0000-4000-8000-0000000000be');
insert into ids select 'bf.legacy', pg_temp.legacy_invoice('a3000000-0000-4000-8000-0000000000bf');
update public.bookings set overrun_minutes = 12, overrun_fils = 5500 where id = 'a3000000-0000-4000-8000-0000000000bf';

set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000002"}';
select * from public.record_booking_payment('a3000000-0000-4000-8000-0000000000be', 'card_terminal', 46000, null, null, 'Balance');
select * from public.record_booking_payment('a3000000-0000-4000-8000-0000000000bf', 'card_terminal', 51500, null, null, 'Balance and overstay');
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';
reset role;

select is(
  jsonb_build_object(
    'invoices', pg_temp.invoices_of('a3000000-0000-4000-8000-0000000000be'),
    'linked', (select count(*) from public.invoice_payments c where c.invoice_id = pg_temp.id('be.legacy') and c.voided_at is null),
    'missing', pg_temp.missing('a3000000-0000-4000-8000-0000000000be'),
    'balanced', pg_temp.balance('a3000000-0000-4000-8000-0000000000be') -> 'documents'
                = pg_temp.balance('a3000000-0000-4000-8000-0000000000be') -> 'money'),
  '{"invoices": 1, "linked": 2, "missing": null, "balanced": true}'::jsonb,
  'finding P2-B: a balance paid after an invoice issued before 20260914091000 for the whole booking is linked to that invoice, not invoiced a second time');

select is(
  jsonb_build_object(
    'invoices', pg_temp.invoices_of('a3000000-0000-4000-8000-0000000000bf'),
    'missing', pg_temp.missing('a3000000-0000-4000-8000-0000000000bf') ->> 'reason'),
  '{"invoices": 1, "missing": "payment_not_invoiced"}'::jsonb,
  'finding P2-B: a payment larger than what the earlier invoice still covers is not invoiced twice and waits under Missing invoices');

set local role authenticated;

select throws_ok(
  $$select * from public.issue_invoice('a3000000-0000-4000-8000-0000000000bf')$$,
  'WP086', null,
  'finding P2-B: Issue now asks for the earlier invoice to be regenerated first');

insert into ids select 'bf.replacement', i.id from public.regenerate_invoice(
  (select i.id from ids i where i.label = 'bf.legacy'), 'Invoice issued before the balance was paid', null) i;
insert into ids select 'bf.balance', i.id from public.issue_invoice('a3000000-0000-4000-8000-0000000000bf') i;

reset role;

select is(
  jsonb_build_object(
    'replacement', (select i.total_fils from public.invoices i where i.id = pg_temp.id('bf.replacement')),
    'balance', (select jsonb_build_object('total', i.total_fils, 'overrun', i.overrun_fils) from public.invoices i where i.id = pg_temp.id('bf.balance')),
    'missing', pg_temp.missing('a3000000-0000-4000-8000-0000000000bf'),
    'documents', pg_temp.balance('a3000000-0000-4000-8000-0000000000bf') -> 'documents'
                 = pg_temp.balance('a3000000-0000-4000-8000-0000000000bf') -> 'money',
    'vat', pg_temp.balance('a3000000-0000-4000-8000-0000000000bf') -> 'document_vat'
           = pg_temp.balance('a3000000-0000-4000-8000-0000000000bf') -> 'money_vat'),
  '{"replacement": 20000, "balance": {"total": 51500, "overrun": 5500}, "missing": null, "documents": true, "vat": true}'::jsonb,
  'finding P2-B: after the regenerate the earlier invoice covers the deposit, and Issue now invoices the balance and overstay once, balanced in money and VAT');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000002"}';
insert into ids select 'e1.card', r.payment_id
  from public.record_booking_payment('a3000000-0000-4000-8000-0000000000e1', 'card_terminal', 66000, null, null, 'Visit paid') r;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';
insert into ids select 'e1.refund', public.request_payment_refund(
  (select i.id from ids i where i.label = 'e1.card'), 5000, 'Late start goodwill', 'a3000000-0000-4000-8000-00000000fe11');
select * from public.confirm_refund_return((select i.id from ids i where i.label = 'e1.refund'), 'BANKE1', 'Returned');
reset role;

update public.bookings set status = 'checked_in', overrun_minutes = 12, overrun_fils = 5500
 where id = 'a3000000-0000-4000-8000-0000000000e1';

set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000002"}';
select * from public.record_booking_payment('a3000000-0000-4000-8000-0000000000e1', 'cash', 5500, null, null, 'Overstay charge paid');
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';
reset role;

select is(
  (select jsonb_agg(jsonb_build_object(
            'kinds', (select jsonb_agg(l ->> 'kind') from jsonb_array_elements(i.lines) l),
            'total', i.total_fils, 'overrun', i.overrun_fils, 'tax', i.tax_fils) order by i.sequence_no)
     from public.invoices i where i.booking_id = 'a3000000-0000-4000-8000-0000000000e1' and i.voided_at is null),
  jsonb_build_array(
    jsonb_build_object('kinds', jsonb_build_array('visit'), 'total', 66000, 'overrun', 0, 'tax', 3143),
    jsonb_build_object('kinds', jsonb_build_array('overrun'), 'total', 5500, 'overrun', 5500, 'tax', 5500 - round(5500 / 1.05)::integer)),
  'adversary round 2, P3-1: after a partial refund with its credit note, an overstay payment is still invoiced as overstay, never as a visit balance');

select is(
  jsonb_build_object(
    'credit_notes', (select count(*) from public.credit_notes cn where cn.booking_id = 'a3000000-0000-4000-8000-0000000000e1' and cn.voided_at is null),
    'documents', pg_temp.balance('a3000000-0000-4000-8000-0000000000e1') -> 'documents',
    'vat', pg_temp.balance('a3000000-0000-4000-8000-0000000000e1') -> 'document_vat'),
  jsonb_build_object(
    'credit_notes', 1,
    'documents', pg_temp.balance('a3000000-0000-4000-8000-0000000000e1') -> 'money',
    'vat', pg_temp.balance('a3000000-0000-4000-8000-0000000000e1') -> 'money_vat'),
  'adversary round 2, P3-1: and the booking stays balanced in money and VAT');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000002"}';
select * from public.record_booking_payment('a3000000-0000-4000-8000-0000000000e2', 'cash', 20000, null, null, 'Deposit');
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';
reset role;

insert into ids select 'e2.legacy', pg_temp.legacy_invoice('a3000000-0000-4000-8000-0000000000e2');

select is(
  (select m.reason from public.management_missing_invoices m where m.booking_id = 'a3000000-0000-4000-8000-0000000000e2'),
  null,
  'adversary round 2, P3-2: while the booking is live and waiting for its balance, an earlier invoice for its whole value is not listed');

update public.bookings set status = 'cancelled' where id = 'a3000000-0000-4000-8000-0000000000e2';

select is(
  (select jsonb_build_object('reason', m.reason, 'excess', m.invoice_excess_fils, 'uncovered', m.uncovered_fils,
                             'received', m.received_fils, 'invoiced', m.invoiced_fils)
     from public.management_missing_invoices m where m.booking_id = 'a3000000-0000-4000-8000-0000000000e2'),
  '{"reason": "invoice_exceeds_payments", "excess": 46000, "uncovered": 0, "received": 20000, "invoiced": 66000}'::jsonb,
  'adversary round 2, P3-2: once the booking is cancelled with only the deposit kept, the earlier invoice for its whole value is listed as exceeding its payments');

set local role authenticated;
insert into ids select 'e2.replacement', i.id from public.regenerate_invoice(
  (select i.id from ids i where i.label = 'e2.legacy'), 'Invoice issued for more than was paid', null) i;
reset role;

select is(
  jsonb_build_object(
    'missing', (select m.reason from public.management_missing_invoices m where m.booking_id = 'a3000000-0000-4000-8000-0000000000e2'),
    'replacement', (select i.total_fils from public.invoices i where i.id = pg_temp.id('e2.replacement')),
    'documents', pg_temp.balance('a3000000-0000-4000-8000-0000000000e2') -> 'documents'
                 = pg_temp.balance('a3000000-0000-4000-8000-0000000000e2') -> 'money',
    'vat', pg_temp.balance('a3000000-0000-4000-8000-0000000000e2') -> 'document_vat'
           = pg_temp.balance('a3000000-0000-4000-8000-0000000000e2') -> 'money_vat'),
  '{"missing": null, "replacement": 20000, "documents": true, "vat": true}'::jsonb,
  'adversary round 2, P3-2: Regenerate replaces it with an invoice for the deposit, and the booking leaves Missing invoices balanced');

set local role authenticated;
insert into ids select 'b1.invoice', i.id from public.issue_invoice('a3000000-0000-4000-8000-0000000000b1') i;
reset role;

select is(
  (select jsonb_build_object(
            'total', i.total_fils, 'paid', i.paid_fils, 'issued_by_manager', i.issued_by = 'a3000000-0000-4000-8000-000000000001',
            'is_test', i.is_test, 'supply_date', i.supply_date,
            'payment_number', i.payments -> 0 ->> 'number' = p.reference,
            'covered', (select count(*) from public.invoice_payments c where c.invoice_id = i.id and c.payment_id = p.id and c.voided_at is null))
     from public.invoices i, public.payments p
    where i.id = pg_temp.id('b1.invoice') and p.id = pg_temp.id('b1.payment')),
  '{"total": 66000, "paid": 66000, "issued_by_manager": true, "is_test": false, "supply_date": "2043-01-01", "payment_number": true, "covered": 1}'::jsonb,
  'Issue now backfills the missing invoice once the details are entered: it covers the payment, prints the Dubai date of supply and the WP-P number [OUR CHOICE — project owner''s direction, 14 September 2026]');

select is(pg_temp.missing('a3000000-0000-4000-8000-0000000000b1'), null,
  'and the booking leaves Missing invoices [OUR CHOICE]');

set local role authenticated;
insert into ids select 'b3.invoice', i.id from public.issue_invoice('a3000000-0000-4000-8000-0000000000b3') i;
reset role;

select is(
  (select jsonb_build_object(
            'invoice_total', i.total_fils,
            'credit_notes', count(cn.id),
            'amount', min(cn.amount_fils),
            'tax_is_refund_share', bool_and(cn.tax_fils = r.tax_fils),
            'on_invoice', bool_and(cn.invoice_id = i.id),
            'issued_by_manager', bool_and(cn.issued_by = 'a3000000-0000-4000-8000-000000000001'))
     from public.invoices i
     join public.credit_notes cn on cn.invoice_id = i.id
     join public.refunds r on r.id = cn.refund_id
    where i.id = pg_temp.id('b3.invoice')
    group by i.total_fils),
  '{"invoice_total": 66000, "credit_notes": 1, "amount": 10000, "tax_is_refund_share": true, "on_invoice": true, "issued_by_manager": true}'::jsonb,
  'rule 3, finding 1: issuing the invoice after a refund settled issues that refund''s credit note in the same call, against the invoice covering the payment, with the refund''s VAT share');

select is(pg_temp.balance('a3000000-0000-4000-8000-0000000000b3') -> 'documents', pg_temp.balance('a3000000-0000-4000-8000-0000000000b3') -> 'money',
  'rule 3: pay, refund, then invoice — valid invoices less valid credit notes equal payments less settled refunds');

set local role authenticated;
select is(
  (select i.id from public.issue_invoice('a3000000-0000-4000-8000-0000000000b3') i),
  (select i.id from ids i where i.label = 'b3.invoice'),
  'Issue now is idempotent: pressing it again returns the same invoice [OUR CHOICE]');
reset role;

select is(pg_temp.missing('a3000000-0000-4000-8000-0000000000b9') ->> 'reason', 'payment_not_invoiced',
  'a fully paid booking that was never confirmed is listed under Missing invoices for Issue now [OUR CHOICE]');


set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000002"}';
insert into ids select 'b4.deposit', r.payment_id
  from public.record_booking_payment('a3000000-0000-4000-8000-0000000000b4', 'cash', 30000, null, null, 'Deposit') r;
reset role;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';

select is(
  jsonb_build_object('invoices', pg_temp.invoices_of('a3000000-0000-4000-8000-0000000000b4'),
                     'missing', pg_temp.missing('a3000000-0000-4000-8000-0000000000b4')),
  '{"invoices": 0, "missing": null}'::jsonb,
  'a part payment on a live booking issues nothing and is not yet a missing invoice [OUR CHOICE]');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000002"}';
insert into ids select 'b4.balance', r.payment_id
  from public.record_booking_payment('a3000000-0000-4000-8000-0000000000b4', 'card_terminal', 36000, null, null, 'Balance') r;
reset role;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';

select is(
  (select jsonb_build_object('count', count(*), 'total', min(i.total_fils), 'automatic', bool_and(i.issued_by is null),
            'covered', (select count(*) from public.invoice_payments c join public.invoices v on v.id = c.invoice_id
                         where v.booking_id = 'a3000000-0000-4000-8000-0000000000b4'),
            'lock_timeout', current_setting('lock_timeout'),
            'deadline', coalesce(current_setting('wellplace.document_step_deadline', true), ''))
     from public.invoices i where i.booking_id = 'a3000000-0000-4000-8000-0000000000b4'),
  '{"count": 1, "total": 66000, "automatic": true, "covered": 2, "lock_timeout": "7s", "deadline": ""}'::jsonb,
  'rule 1: the desk payment that completes a split payment issues one invoice covering both payments, and the caller''s lock_timeout is restored [OUR CHOICE — project owner''s direction, 14 September 2026]');

select ok(
  exists (select 1 from audit.entries e join public.invoices i on i.id::text = e.entity_id
           where i.booking_id = 'a3000000-0000-4000-8000-0000000000b4' and e.action = 'issue_invoice'
             and (e.new_value ->> 'is_automatic')::boolean
             and e.actor_id = 'a3000000-0000-4000-8000-000000000002'),
  '[§3, INV-13] the automatic issue writes its own audit entry, naming the receptionist whose payment triggered it');


set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000002"}';
select * from public.record_booking_payment('a3000000-0000-4000-8000-0000000000b5', 'cash', 66000, null, null, 'Paid at the desk');
reset role;

update public.bookings set overrun_minutes = 12, overrun_fils = 5500 where id = 'a3000000-0000-4000-8000-0000000000b5';

set local role authenticated;
insert into ids select 'b5.overstay', r.payment_id
  from public.record_booking_payment('a3000000-0000-4000-8000-0000000000b5', 'cash', 5500, null, null, 'Overstay') r;
reset role;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';

select is(
  (select p.tax_fils from public.payments p where p.id = pg_temp.id('b5.overstay')),
  5500 - round(5500 / 1.05)::integer,
  'finding 3: an overstay payment freezes the VAT inside the overstay charge instead of zero [§7.6, Q-21]');

select is(
  (select jsonb_agg(jsonb_build_object('total', i.total_fils, 'overrun', i.overrun_fils, 'tax', i.tax_fils,
                                       'kinds', (select jsonb_agg(l ->> 'kind') from jsonb_array_elements(i.lines) l))
                    order by i.sequence_no)
     from public.invoices i where i.booking_id = 'a3000000-0000-4000-8000-0000000000b5'),
  jsonb_build_array(
    jsonb_build_object('total', 66000, 'overrun', 0, 'tax', 3143, 'kinds', jsonb_build_array('visit')),
    jsonb_build_object('total', 5500, 'overrun', 5500, 'tax', 5500 - round(5500 / 1.05)::integer, 'kinds', jsonb_build_array('overrun'))),
  'rule 3: the overstay paid after the first invoice gets its own additional invoice with its VAT, and the first invoice is untouched [§7.6]');

select is(
  (select c.payment_id from public.invoice_payments c join public.invoices i on i.id = c.invoice_id
    where i.booking_id = 'a3000000-0000-4000-8000-0000000000b5' and i.overrun_fils > 0),
  pg_temp.id('b5.overstay'),
  'and that additional invoice covers exactly the overstay payment [§8]');


set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000002"}';
insert into ids select 'b2.payment', r.payment_id
  from public.record_booking_payment('a3000000-0000-4000-8000-0000000000b2', 'cash', 66000, null, null, 'Paid at the desk') r;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';
insert into ids select 'b2.refund', public.request_payment_refund(
  (select i.id from ids i where i.label = 'b2.payment'), 20000, 'Goodwill after a late start', 'a3000000-0000-4000-8000-00000000f201');
insert into ids select 'b2.withdrawn', public.request_payment_refund(
  (select i.id from ids i where i.label = 'b2.payment'), 5000, 'Entered twice', 'a3000000-0000-4000-8000-00000000f202');
reset role;

insert into ids select 'b2.invoice', i.id from public.invoices i where i.booking_id = 'a3000000-0000-4000-8000-0000000000b2';

select is((select count(*)::integer from public.credit_notes cn where cn.booking_id = 'a3000000-0000-4000-8000-0000000000b2'), 0,
  'rule 5: a refund that is still pending creates no credit note');

set local role authenticated;
select * from public.withdraw_refund_request((select i.id from ids i where i.label = 'b2.withdrawn'), 'Entered twice by mistake');
select * from public.confirm_refund_return((select i.id from ids i where i.label = 'b2.refund'), 'BANKB2', 'Returned by bank transfer');
reset role;

select is(
  (select jsonb_build_object(
            'count', count(*), 'amount', min(cn.amount_fils),
            'tax_is_refund_share', bool_and(cn.tax_fils = r.tax_fils and cn.tax_fils > 0),
            'invoice', bool_and(cn.invoice_id = pg_temp.id('b2.invoice')),
            'number', bool_and(cn.credit_note_number ~ ('^CN-' || to_char(now() at time zone 'Asia/Dubai', 'YYYY') || '-[0-9]{6,}$')),
            'automatic', bool_and(cn.issued_by is null), 'is_test', bool_or(cn.is_test))
     from public.credit_notes cn join public.refunds r on r.id = cn.refund_id
    where cn.refund_id = pg_temp.id('b2.refund')),
  '{"count": 1, "amount": 20000, "tax_is_refund_share": true, "invoice": true, "number": true, "automatic": true, "is_test": false}'::jsonb,
  'rule 5, finding 4: confirming the return issues one CN-{Dubai year} credit note against the invoice covering the refunded payment, with the refund''s VAT share');

select is((select count(*)::integer from public.credit_notes cn where cn.refund_id = pg_temp.id('b2.withdrawn')), 0,
  'rule 5: a withdrawn refund request creates nothing');

select is(
  (select jsonb_build_object(
            'invoice_number', cn.invoice_number = i.invoice_number,
            'refund_number', cn.refund ->> 'number' = r.reference,
            'payment_number', cn.refund ->> 'payment_number' = p.reference,
            'reason', cn.reason,
            'bill_to', cn.bill_to = i.bill_to,
            'issuer', cn.issuer = i.issuer,
            'supply_date', cn.supply_date = i.supply_date,
            'line', jsonb_build_object('kind', cn.lines -> 0 ->> 'kind', 'quantity', cn.lines -> 0 -> 'quantity',
                                       'tax', (cn.lines -> 0 ->> 'tax_fils')::integer = cn.tax_fils))
     from public.credit_notes cn
     join public.invoices i on i.id = cn.invoice_id
     join public.refunds r on r.id = cn.refund_id
     join public.payments p on p.id = r.payment_id
    where cn.refund_id = pg_temp.id('b2.refund')),
  '{"invoice_number": true, "refund_number": true, "payment_number": true, "reason": "Goodwill after a late start", "bill_to": true, "issuer": true, "supply_date": true, "line": {"kind": "refund", "quantity": 1, "tax": true}}'::jsonb,
  'the credit note names the original invoice, the refund and payment numbers and the reason, and copies the invoice''s issuer, bill-to and date of supply [OUR CHOICE — market standard]');

select ok(
  exists (select 1 from audit.entries e join public.credit_notes cn on cn.id::text = e.entity_id
           where cn.refund_id = pg_temp.id('b2.refund') and e.action = 'issue_credit_note'),
  '[§3, INV-13] issuing the credit note wrote its own audit entry');

set local role authenticated;
select throws_ok(
  $$select * from public.void_invoice((select i.id from ids i where i.label = 'b2.invoice'), 'Wrong customer name')$$,
  'WP085', null,
  'rule 7: an invoice that has credit notes cannot be voided on its own');
reset role;

select is(
  jsonb_build_object('documents', pg_temp.balance('a3000000-0000-4000-8000-0000000000b2') -> 'document_vat',
                     'balance', pg_temp.balance('a3000000-0000-4000-8000-0000000000b2') -> 'documents'),
  jsonb_build_object('documents', pg_temp.balance('a3000000-0000-4000-8000-0000000000b2') -> 'money_vat',
                     'balance', pg_temp.balance('a3000000-0000-4000-8000-0000000000b2') -> 'money'),
  'rule 3: pay, invoice, then a partial refund — the money and the VAT on valid documents equal the money and VAT kept');


set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000002"}';
insert into ids select 'b6.payment', r.payment_id
  from public.record_booking_payment('a3000000-0000-4000-8000-0000000000b6', 'cash', 66000, null, null, 'Paid at the desk') r;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';
insert into ids select 'b6.refund1', public.request_payment_refund(
  (select i.id from ids i where i.label = 'b6.payment'), 20000, 'Shortened visit', 'a3000000-0000-4000-8000-00000000f601');
select * from public.confirm_refund_return((select i.id from ids i where i.label = 'b6.refund1'), 'BANKB61', 'Returned');
insert into ids select 'b6.refund2', public.request_payment_refund(
  (select i.id from ids i where i.label = 'b6.payment'), 6000, 'Add-on unavailable', 'a3000000-0000-4000-8000-00000000f602');
select * from public.confirm_refund_return((select i.id from ids i where i.label = 'b6.refund2'), 'BANKB62', 'Returned');
reset role;

insert into ids select 'b6.invoice', i.id from public.invoices i where i.booking_id = 'a3000000-0000-4000-8000-0000000000b6';

set local role authenticated;

select throws_ok(
  $$select * from public.regenerate_invoice((select i.id from ids i where i.label = 'b6.invoice'), 'Company details', '{"trn": "12345"}'::jsonb)$$,
  '22023', null,
  'rule 6: a customer TRN that is not fifteen digits is refused');

select throws_ok(
  $$select * from public.regenerate_invoice((select i.id from ids i where i.label = 'b6.invoice'), 'Company details', '{"email": "other@example.test"}'::jsonb)$$,
  '22023', null,
  'rule 6: only the name, company, TRN and address can be corrected');

select throws_ok(
  $$select * from public.regenerate_invoice((select i.id from ids i where i.label = 'b6.invoice'), '  ', null)$$,
  '22023', null,
  'rule 6: regenerating needs a reason');

insert into ids select 'b6.new', i.id from public.regenerate_invoice(
  (select i.id from ids i where i.label = 'b6.invoice'),
  'Customer asked for their company details',
  '{"company": "Example Holdings", "trn": "100000000000003", "address": "Unit 5, Example Road, Dubai"}'::jsonb) i;

reset role;

select is(
  jsonb_build_object(
    'invoice_void_reason', (select i.void_reason from public.invoices i where i.id = pg_temp.id('b6.invoice')),
    'old_credit_notes_voided', (select bool_and(cn.voided_at is not null) and count(*) = 2 from public.credit_notes cn where cn.invoice_id = pg_temp.id('b6.invoice')),
    'old_coverage_voided', (select bool_and(c.voided_at is not null) from public.invoice_payments c where c.invoice_id = pg_temp.id('b6.invoice'))),
  '{"invoice_void_reason": "Customer asked for their company details", "old_credit_notes_voided": true, "old_coverage_voided": true}'::jsonb,
  'rule 6: regenerate voids the invoice, its credit notes and its payment links with the reason');

select is(
  (select jsonb_build_object(
            'total', n.total_fils, 'replaces', n.replaces_invoice_id = o.id, 'later_number', n.sequence_no > o.sequence_no,
            'company', n.bill_to ->> 'company', 'trn', n.bill_to ->> 'trn', 'address', n.bill_to ->> 'address',
            'name_kept', n.bill_to ->> 'name' = o.bill_to ->> 'name',
            'same_payment', (select c.payment_id from public.invoice_payments c where c.invoice_id = n.id and c.voided_at is null) = pg_temp.id('b6.payment'))
     from public.invoices n, public.invoices o
    where n.id = pg_temp.id('b6.new') and o.id = pg_temp.id('b6.invoice')),
  '{"total": 66000, "replaces": true, "later_number": true, "company": "Example Holdings", "trn": "100000000000003", "address": "Unit 5, Example Road, Dubai", "name_kept": true, "same_payment": true}'::jsonb,
  'rule 6: the replacement takes the next number, covers the same payment and carries the corrected bill-to');

select is(
  (select jsonb_build_object('count', count(*), 'amounts', jsonb_agg(cn.amount_fils order by cn.amount_fils),
                             'company', bool_and(cn.bill_to ->> 'company' = 'Example Holdings'))
     from public.credit_notes cn where cn.invoice_id = pg_temp.id('b6.new') and cn.voided_at is null),
  '{"count": 2, "amounts": [6000, 20000], "company": true}'::jsonb,
  'rule 6: and fresh credit notes for the refunds already settled on that payment');

select is(pg_temp.balance('a3000000-0000-4000-8000-0000000000b6') -> 'documents', pg_temp.balance('a3000000-0000-4000-8000-0000000000b6') -> 'money',
  'rule 3: regenerate after refunds keeps valid invoices less valid credit notes equal to payments less settled refunds');

set local role authenticated;

select throws_ok(
  $$select * from public.regenerate_invoice((select i.id from ids i where i.label = 'b6.invoice'), 'Again', null)$$,
  'WP079', null,
  'rule 6: a voided invoice cannot be regenerated again');

select throws_ok(
  $$select * from public.void_invoice((select i.id from ids i where i.label = 'b6.new'), 'Mistake')$$,
  'WP085', null,
  'rule 7: nor can the replacement be voided while it has credit notes');

reset role;

select ok(
  exists (select 1 from audit.entries e
           where e.action = 'regenerate_invoice' and e.entity_id = pg_temp.id('b6.invoice')::text
             and e.reason = 'Customer asked for their company details'
             and e.actor_id = 'a3000000-0000-4000-8000-000000000001'
             and e.new_value ->> 'invoice_id' = pg_temp.id('b6.new')::text),
  '[§3, INV-13] the regeneration writes its own audit entry with the reason and the replacement');


insert into ids select 'b4.invoice', i.id from public.invoices i where i.booking_id = 'a3000000-0000-4000-8000-0000000000b4';

set local role authenticated;
select * from public.void_invoice((select i.id from ids i where i.label = 'b4.invoice'), 'Issued to the wrong company');
reset role;

select is(
  jsonb_build_object(
    'missing', pg_temp.missing('a3000000-0000-4000-8000-0000000000b4') ->> 'reason',
    'released', (select bool_and(c.voided_at is not null) from public.invoice_payments c where c.invoice_id = pg_temp.id('b4.invoice'))),
  '{"missing": "payment_not_invoiced", "released": true}'::jsonb,
  'rule 7: a voided invoice releases its payments and the booking returns to Missing invoices');

insert into counters select 'invoice.before', n.last_sequence_no from internal.invoice_numbering n;

savepoint before_issue;
set local role authenticated;
select * from public.issue_invoice('a3000000-0000-4000-8000-0000000000b4');
rollback to savepoint before_issue;
reset role;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';

select is((select n.last_sequence_no from internal.invoice_numbering n), (select c.value from counters c where c.label = 'invoice.before'),
  'a rolled-back issue leaves the invoice counter where it was');

set local role authenticated;
insert into ids select 'b4.reissued', i.id from public.issue_invoice('a3000000-0000-4000-8000-0000000000b4') i;
reset role;

select is(
  (select jsonb_build_object('next_number', i.sequence_no = (select c.value + 1 from counters c where c.label = 'invoice.before'),
                             'covered', (select count(*) from public.invoice_payments c where c.invoice_id = i.id and c.voided_at is null))
     from public.invoices i where i.id = pg_temp.id('b4.reissued')),
  '{"next_number": true, "covered": 2}'::jsonb,
  'so Issue now takes the very next number and covers both payments again');


set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000002"}';
select * from public.record_booking_payment('a3000000-0000-4000-8000-0000000000b7', 'complimentary', 0, null, null, 'Complimentary visit');
insert into ids select 'b8.deposit', r.payment_id
  from public.record_booking_payment('a3000000-0000-4000-8000-0000000000b8', 'cash', 20000, null, null, 'Deposit') r;
reset role;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';

select is(
  jsonb_build_object('invoices', pg_temp.invoices_of('a3000000-0000-4000-8000-0000000000b7'),
                     'missing', pg_temp.missing('a3000000-0000-4000-8000-0000000000b7')),
  '{"invoices": 0, "missing": null}'::jsonb,
  '[INV-20] rule 2: a complimentary booking is never invoiced and never missing');

select is(pg_temp.missing('a3000000-0000-4000-8000-0000000000b8'), null,
  'a deposit on a live booking is not yet a missing invoice');

update public.bookings set status = 'cancelled' where id = 'a3000000-0000-4000-8000-0000000000b8';

select is(pg_temp.missing('a3000000-0000-4000-8000-0000000000b8'),
  '{"reason": "payment_not_invoiced", "uncovered": 20000, "uncredited": 0}'::jsonb,
  'finding 6: once the booking is cancelled the money it kept is listed under Missing invoices');

set local role authenticated;
insert into ids select 'b8.invoice', i.id from public.issue_invoice('a3000000-0000-4000-8000-0000000000b8') i;
reset role;

select is(
  (select jsonb_build_object('total', i.total_fils, 'tax', i.tax_fils = p.tax_fils,
                             'lines', (select jsonb_agg(jsonb_build_object('kind', l ->> 'kind', 'label', l ->> 'label')) from jsonb_array_elements(i.lines) l))
     from public.invoices i, public.payments p
    where i.id = pg_temp.id('b8.invoice') and p.id = pg_temp.id('b8.deposit')),
  '{"total": 20000, "tax": true, "lines": [{"kind": "visit", "label": "Visit part payment"}]}'::jsonb,
  'rule 3 wins over rule 2: Issue now documents the money kept on the cancelled booking at its own frozen VAT');


set local request.jwt.claims = '';
select pg_temp.open_checkout('dup', 9932, timestamptz '2043-02-02 06:00Z');
insert into ids select 'dup.first', pg_temp.prepare('dup');
insert into steps select 'dup.first.failed', pg_temp.settle(pg_temp.id('dup.first'), 'failed');
insert into ids select 'dup.second', pg_temp.prepare('dup');
insert into steps select 'dup.second.success', pg_temp.settle(pg_temp.id('dup.second'), 'success');
insert into steps select 'dup.first.success', pg_temp.settle(pg_temp.id('dup.first'), 'success');
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';

select is(
  jsonb_build_object(
    'same_booking', pg_temp.booking_of(pg_temp.id('dup.first')) = pg_temp.booking_of(pg_temp.id('dup.second')),
    'second', (select s.result ->> 'status' from steps s where s.label = 'dup.second.success'),
    'first', (select s.result ->> 'status' from steps s where s.label = 'dup.first.success'),
    'invoices', pg_temp.invoices_of(pg_temp.booking_of(pg_temp.id('dup.second'))),
    'first_covered', exists (select 1 from public.invoice_payments c where c.payment_id = pg_temp.id('dup.first'))),
  '{"same_booking": true, "second": "confirmed", "first": "refunded", "invoices": 1, "first_covered": false}'::jsonb,
  'rule 3: a late success the settlement refunds itself is never put on an invoice [§8.2]');

select is(pg_temp.missing(pg_temp.booking_of(pg_temp.id('dup.first'))), null,
  'and never makes the booking a missing invoice');

set local role authenticated;
select * from public.confirm_refund_return(
  (select r.id from public.refunds r where r.payment_id = (select i.id from ids i where i.label = 'dup.first')),
  'PROVREFUNDA', 'Returned through the provider');
reset role;

select is(
  (select count(*)::integer from public.credit_notes cn join public.refunds r on r.id = cn.refund_id
    where r.payment_id = pg_temp.id('dup.first')),
  0,
  'rule 3: and settling that automatic refund creates no credit note');


set local request.jwt.claims = '';
select pg_temp.open_checkout('online.test', 9933, timestamptz '2043-02-03 06:00Z');
insert into ids select 'online.test.payment', pg_temp.prepare('online.test');
insert into steps select 'online.test', pg_temp.settle(pg_temp.id('online.test.payment'), 'success');
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';

insert into ids select 'online.test.invoice', i.id from public.invoices i
 where i.booking_id = pg_temp.booking_of(pg_temp.id('online.test.payment'));
insert into ids select 'online.test.receipt', a.receipt_token from internal.checkout_attempts a
 where a.payment_id = pg_temp.id('online.test.payment');

select is(
  (select jsonb_build_object('is_test', i.is_test, 'automatic', i.issued_by is null,
                             'payment_is_test', (i.payments -> 0 ->> 'is_test')::boolean,
                             'provider_reference', i.payments -> 0 ->> 'provider_reference' like 'SIM-%',
                             'paid_at', i.payments -> 0 ->> 'paid_at' is not null)
     from public.invoices i where i.id = pg_temp.id('online.test.invoice')),
  '{"is_test": true, "automatic": true, "payment_is_test": true, "provider_reference": true, "paid_at": true}'::jsonb,
  'rules 1 and 8: an online settlement issues the invoice automatically, marked as a test document for a simulated payment');

set local role authenticated;
insert into ids select 'online.test.refund', public.request_payment_refund(
  (select i.id from ids i where i.label = 'online.test.payment'), 10000, 'Simulated goodwill', 'a3000000-0000-4000-8000-00000000f901');
reset role;

insert into ids select 'online.test.credit', cn.id from public.credit_notes cn where cn.refund_id = pg_temp.id('online.test.refund');

select is(
  (select cn.amount_fils || '|' || cn.is_test from public.credit_notes cn where cn.id = pg_temp.id('online.test.credit')),
  '10000|true',
  'rules 5 and 8: a simulated refund, recorded as returned at once, issues its credit note immediately as a test document');

select is(
  (select jsonb_agg(jsonb_build_object('type', d ->> 'type', 'id', d ->> 'id', 'isTest', d -> 'isTest') order by d ->> 'type' desc)
     from jsonb_array_elements(public.guest_receipt(pg_temp.id('online.test.receipt'), 90) -> 'documents') d),
  jsonb_build_array(
    jsonb_build_object('type', 'invoice', 'id', pg_temp.id('online.test.invoice'), 'isTest', true),
    jsonb_build_object('type', 'credit_note', 'id', pg_temp.id('online.test.credit'), 'isTest', true)),
  '§6.5: the guest receipt lists the booking''s valid invoice and credit note');

select is(
  (select jsonb_build_object('type', r ->> 'type', 'id', r -> 'document' ->> 'id', 'booking', r ->> 'bookingReference' = b.reference,
                             'customer', r ->> 'customerReference' = c.reference,
                             'no_suite', position('suite' in r::text) = 0, 'issued_by', r -> 'document' -> 'issued_by')
     from (select public.guest_document(pg_temp.id('online.test.receipt'), 90, pg_temp.id('online.test.invoice')) as r) x,
          public.bookings b join public.customers c on c.id = b.customer_id
    where b.id = pg_temp.booking_of(pg_temp.id('online.test.payment'))),
  jsonb_build_object('type', 'invoice', 'id', pg_temp.id('online.test.invoice'), 'booking', true, 'customer', true,
                     'no_suite', true, 'issued_by', 'null'::jsonb),
  '[INV-01, INV-25] the receipt token reads its own invoice in full, with booking and customer references and no suite');

select is(
  public.guest_document(pg_temp.id('online.test.receipt'), 90, pg_temp.id('b2.invoice')),
  null,
  '[INV-25] a receipt token cannot read another booking''s document');

select is(
  public.guest_document(pg_temp.id('online.test.receipt'), 0, pg_temp.id('online.test.invoice')),
  null,
  '[§13, INV-25] and reads nothing once its validity period is not positive');


insert into counters select 'fail.invoice', n.last_sequence_no from internal.invoice_numbering n;
alter table public.invoices add constraint ai_invoices_refuse_insert check (false) not valid;

set local lock_timeout = '7s';
set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000002"}';

select lives_ok(
  $$select * from public.record_booking_payment('a3000000-0000-4000-8000-0000000000ba', 'cash', 66000, null, null, 'Paid at the desk')$$,
  'rule 4, finding 5: when writing the invoice itself fails after its number was taken, the desk payment still succeeds');

reset role;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';
alter table public.invoices drop constraint ai_invoices_refuse_insert;

select is(
  jsonb_build_object(
    'invoices', pg_temp.invoices_of('a3000000-0000-4000-8000-0000000000ba'),
    'counter_unchanged', (select n.last_sequence_no from internal.invoice_numbering n) = (select c.value from counters c where c.label = 'fail.invoice'),
    'paid', (select p.status from public.payments p where p.booking_id = 'a3000000-0000-4000-8000-0000000000ba'),
    'lock_timeout', current_setting('lock_timeout'),
    'missing', pg_temp.missing('a3000000-0000-4000-8000-0000000000ba') ->> 'reason'),
  '{"invoices": 0, "counter_unchanged": true, "paid": "paid", "lock_timeout": "7s", "missing": "payment_not_invoiced"}'::jsonb,
  'finding 5: no invoice, no number consumed, the payment is paid, lock_timeout is restored and the booking is listed missing');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000002"}';
insert into ids select 'bb.payment', r.payment_id
  from public.record_booking_payment('a3000000-0000-4000-8000-0000000000bb', 'cash', 66000, null, null, 'Paid at the desk') r;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';
insert into ids select 'bb.refund', public.request_payment_refund(
  (select i.id from ids i where i.label = 'bb.payment'), 5000, 'Towel missing', 'a3000000-0000-4000-8000-00000000fb01');
reset role;

insert into ids select 'bb.invoice', i.id from public.invoices i where i.booking_id = 'a3000000-0000-4000-8000-0000000000bb';
alter table public.credit_notes add constraint ai_credit_notes_refuse_insert check (false) not valid;

set local role authenticated;
select lives_ok(
  $$select * from public.confirm_refund_return((select i.id from ids i where i.label = 'bb.refund'), 'BANKBB', 'Returned')$$,
  'rule 4, finding 5: when the credit note cannot be written the refund confirmation still succeeds');
reset role;

alter table public.credit_notes drop constraint ai_credit_notes_refuse_insert;

select is(
  jsonb_build_object(
    'settled', (select r.settled_at is not null from public.refunds r where r.id = pg_temp.id('bb.refund')),
    'credit_notes', (select count(*) from public.credit_notes cn where cn.refund_id = pg_temp.id('bb.refund')),
    'missing', pg_temp.missing('a3000000-0000-4000-8000-0000000000bb')),
  '{"settled": true, "credit_notes": 0, "missing": {"reason": "refund_not_credited", "uncovered": 0, "uncredited": 5000}}'::jsonb,
  'the refund is settled without a credit note and the booking is listed as a refund not credited');

set local role authenticated;
select is(
  (select i.id from public.issue_invoice('a3000000-0000-4000-8000-0000000000bb') i),
  (select i.id from ids i where i.label = 'bb.invoice'),
  'Issue now returns the booking''s existing invoice');
reset role;

select is(
  jsonb_build_object(
    'credit_notes', (select count(*) from public.credit_notes cn where cn.refund_id = pg_temp.id('bb.refund') and cn.invoice_id = pg_temp.id('bb.invoice')),
    'missing', pg_temp.missing('a3000000-0000-4000-8000-0000000000bb')),
  '{"credit_notes": 1, "missing": null}'::jsonb,
  'and issues the missing credit note, so the booking leaves Missing invoices');


select throws_ok(
  $$select internal.take_document_lock('probe')
      from (select pg_catalog.set_config('wellplace.document_step_deadline',
                                         (pg_catalog.clock_timestamp() - interval '1 second')::text, true)) s$$,
  '55P03', null,
  'concurrency finding: once an automatic step''s deadline has passed, no further lock wait starts');

select throws_ok(
  $$update public.credit_notes set amount_fils = 1 where refund_id = (select i.id from ids i where i.label = 'b2.refund')$$,
  'WP079', null, '[INV-21] an issued credit note cannot be changed, even directly');

select throws_ok(
  $$delete from public.credit_notes where refund_id = (select i.id from ids i where i.label = 'b2.refund')$$,
  'WP079', null, '[INV-14] and is never deleted');

select throws_ok(
  $$update public.invoice_payments set amount_fils = 1 where payment_id = (select i.id from ids i where i.label = 'b2.payment')$$,
  'WP079', null, '[INV-21] the payments an invoice covers cannot be changed');

select throws_ok(
  $$delete from public.invoice_payments where payment_id = (select i.id from ids i where i.label = 'b2.payment')$$,
  'WP079', null, '[INV-14] nor deleted');

select throws_ok(
  $$update public.invoices set is_test = true where id = (select i.id from ids i where i.label = 'b2.invoice')$$,
  'WP079', null, '[INV-21] and the new invoice snapshot columns are as immutable as the old ones');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000002"}';

select is(
  (select (select count(*) from public.credit_notes) + (select count(*) from public.invoice_payments)
          + (select count(*) from public.management_credit_notes) + (select count(*) from public.management_documents)
          + (select count(*) from public.management_missing_invoices))::integer,
  0,
  '[INV-15] Reception without the figures permission reads no credit note, invoice link, document or missing invoice');

select throws_ok(
  $$select * from public.regenerate_invoice((select i.id from ids i where i.label = 'b6.new'), 'Reception tries', null)$$,
  '42501', null,
  '[INV-15] and cannot regenerate an invoice');

reset role;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001"}';

select ok(
  has_function_privilege('service_role', 'public.guest_document(uuid,integer,uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.guest_document(uuid,integer,uuid)', 'execute')
    and not has_function_privilege('anon', 'public.guest_document(uuid,integer,uuid)', 'execute'),
  '[§13, INV-25] the guest document read is executable by the service role only');

select ok(
  not has_table_privilege('anon', 'public.credit_notes', 'select')
    and not has_table_privilege('authenticated', 'public.credit_notes', 'insert')
    and not has_table_privilege('authenticated', 'public.credit_notes', 'update')
    and not has_table_privilege('authenticated', 'public.credit_notes', 'delete')
    and not has_table_privilege('service_role', 'public.credit_notes', 'insert')
    and not has_table_privilege('service_role', 'public.invoice_payments', 'insert')
    and not has_table_privilege('authenticated', 'public.invoice_payments', 'insert')
    and not has_table_privilege('anon', 'public.management_documents', 'select')
    and not has_table_privilege('anon', 'public.management_credit_notes', 'select')
    and not has_table_privilege('anon', 'public.management_missing_invoices', 'select')
    and not has_function_privilege('anon', 'public.regenerate_invoice(uuid,text,jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.issue_invoice(uuid,jsonb)', 'execute'),
  '[INV-01, R-02] anon reaches nothing, and no role writes a credit note or an invoice link directly');

select ok(
  not has_function_privilege('authenticated', 'internal.issue_booking_invoice(uuid,uuid,jsonb,uuid)', 'execute')
    and not has_function_privilege('service_role', 'internal.issue_booking_invoice(uuid,uuid,jsonb,uuid)', 'execute')
    and not has_function_privilege('authenticated', 'internal.issue_missing_credit_notes(uuid,uuid)', 'execute')
    and not has_function_privilege('authenticated', 'internal.issue_invoice_when_paid(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'internal.issue_credit_notes_when_refunded(uuid)', 'execute')
    and not has_table_privilege('authenticated', 'internal.credit_note_numbering', 'update')
    and not has_table_privilege('service_role', 'internal.credit_note_numbering', 'update'),
  '[R-15] the issuing routines and the credit note counter are not reachable by any application role');


select is(
  (select jsonb_agg(b.reference order by b.reference)
     from public.bookings b
    where (b.reference like 'WPAI%' or b.id in (select p.booking_id from public.payments p join ids i on i.id = p.id))
      and pg_temp.missing(b.id) is null
      and (pg_temp.balance(b.id) -> 'documents' is distinct from pg_temp.balance(b.id) -> 'money'
           or pg_temp.balance(b.id) -> 'document_vat' is distinct from pg_temp.balance(b.id) -> 'money_vat')),
  null,
  'rule 3, finding P2-A: for every booking in this test with nothing missing, valid invoices less valid credit notes equal payments received less refunds settled, in money and in VAT');

select is(
  (select count(*)::integer
     from public.invoices i
    where i.voided_at is null
      and i.id <> pg_temp.id('be.legacy')
      and i.booking_id in (select b.id from public.bookings b where b.reference like 'WPAI%'
                           union select p.booking_id from public.payments p join ids x on x.id = p.id)
      and (
        exists (select 1 from jsonb_array_elements(i.lines) l
                 where not (l ?& array['quantity', 'unit_price_fils', 'vat_rate_percent', 'tax_fils'])
                    or jsonb_typeof(l -> 'quantity') <> 'number' or jsonb_typeof(l -> 'unit_price_fils') <> 'number')
        or (select sum((l ->> 'tax_fils')::integer) from jsonb_array_elements(i.lines) l) <> i.tax_fils)),
  0,
  'every line of every valid invoice stores its quantity, unit price, VAT rate and VAT, and the lines'' VAT adds up to the invoice VAT [OUR CHOICE — market standard]');

select is(
  (select jsonb_build_object(
            'invoices', (select max(i.sequence_no) - min(i.sequence_no) + 1 = count(*) from public.invoices i),
            'credit_notes', (select max(cn.sequence_no) - min(cn.sequence_no) + 1 = count(*) from public.credit_notes cn))),
  '{"invoices": true, "credit_notes": true}'::jsonb,
  'invoice and credit note numbers are gapless, voided documents keeping theirs, through the failed and rolled-back issues above');

select * from finish();
rollback;
