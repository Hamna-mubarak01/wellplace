begin;
select plan(50);

insert into public.staff (id, email, full_name, role, is_active) values
  ('d9800000-0000-4000-8000-000000000001', 'inv.manager@example.test',   'INV Manager',   'management', true),
  ('d9800000-0000-4000-8000-000000000002', 'inv.reception@example.test', 'INV Reception', 'reception',  true),
  ('d9800000-0000-4000-8000-000000000003', 'inv.figures@example.test',   'INV Figures',   'reception',  true);

insert into public.staff_permissions (staff_id, permission, granted_by, reason) values
  ('d9800000-0000-4000-8000-000000000003', 'view_confidential_figures',
   'd9800000-0000-4000-8000-000000000001', 'Invoice test grant');

insert into public.customers (id, salutation, first_name, last_name, email, phone_e164, phone_country) values
  ('c9800000-0000-4000-8000-0000000000c1', 'ms', 'Ines', 'Voice', 'ines.voice@example.test', '+971500009801', 'AE');

insert into public.bookings
  (id, reference, customer_id, suite_id, source, status, experience_period, cleaning_buffer_minutes,
   subtotal_fils, discount_fils, addons_fils, service_fee_fils, tax_fils, total_fils, is_complimentary)
values
  ('b9800000-0000-4000-8000-000000000001', 'WPINV0001', 'c9800000-0000-4000-8000-0000000000c1',
   (select id from public.suites order by suite_number limit 1), 'online', 'confirmed',
   tstzrange(timestamptz '2041-11-01 10:00+04', timestamptz '2041-11-01 12:00+04', '[)'), 20,
   60000, 5000, 10000, 3900, 3281, 68900, false),
  ('b9800000-0000-4000-8000-000000000002', 'WPINV0002', 'c9800000-0000-4000-8000-0000000000c1',
   null, 'complimentary', 'confirmed',
   tstzrange(timestamptz '2041-11-02 10:00+04', timestamptz '2041-11-02 12:00+04', '[)'), 20,
   0, 0, 0, 0, 0, 0, true),
  ('b9800000-0000-4000-8000-000000000003', 'WPINV0003', 'c9800000-0000-4000-8000-0000000000c1',
   null, 'telephone', 'confirmed',
   tstzrange(timestamptz '2041-11-03 10:00+04', timestamptz '2041-11-03 12:00+04', '[)'), 20,
   40000, 0, 0, 0, 1905, 40000, false),
  ('b9800000-0000-4000-8000-000000000004', 'WPINV0004', 'c9800000-0000-4000-8000-0000000000c1',
   null, 'telephone', 'cancelled',
   tstzrange(timestamptz '2041-11-04 10:00+04', timestamptz '2041-11-04 12:00+04', '[)'), 20,
   40000, 0, 0, 0, 1905, 40000, false),
  ('b9800000-0000-4000-8000-000000000005', 'WPINV0005', 'c9800000-0000-4000-8000-0000000000c1',
   null, 'walk_in', 'completed',
   tstzrange(timestamptz '2041-11-05 10:00+04', timestamptz '2041-11-05 12:00+04', '[)'), 20,
   50000, 0, 0, 0, 0, 50000, false),
  ('b9800000-0000-4000-8000-000000000006', 'WPINV0006', 'c9800000-0000-4000-8000-0000000000c1',
   null, 'walk_in', 'completed',
   tstzrange(timestamptz '2041-11-06 10:00+04', timestamptz '2041-11-06 12:00+04', '[)'), 20,
   30000, 0, 0, 0, 1429, 30000, false);

insert into public.booking_guests (booking_id, kind, age) values
  ('b9800000-0000-4000-8000-000000000001', 'adult', null),
  ('b9800000-0000-4000-8000-000000000001', 'adult', null),
  ('b9800000-0000-4000-8000-000000000001', 'child', 10);

insert into public.booking_addons (booking_id, addon_id, name_snapshot, unit_price_fils, quantity) values
  ('b9800000-0000-4000-8000-000000000001', null, 'Bathrobe', 3000, 2),
  ('b9800000-0000-4000-8000-000000000001', null, 'Fruit plate', 4000, 1),
  ('b9800000-0000-4000-8000-000000000005', null, 'Bathrobe', 3000, 1);

insert into public.payments (id, booking_id, status, method, amount_fils) values
  ('e9800000-0000-4000-8000-000000000001', 'b9800000-0000-4000-8000-000000000001', 'paid', 'cash', 68900),
  ('e9800000-0000-4000-8000-000000000004', 'b9800000-0000-4000-8000-000000000004', 'paid', 'card_terminal', 40000),
  ('e9800000-0000-4000-8000-000000000005', 'b9800000-0000-4000-8000-000000000005', 'paid', 'cash', 50000),
  ('e9800000-0000-4000-8000-000000000006', 'b9800000-0000-4000-8000-000000000006', 'paid', 'cash', 30000);

insert into public.refunds (payment_id, booking_id, amount_fils, reason, is_pending, settled_at, requested_by) values
  ('e9800000-0000-4000-8000-000000000004', 'b9800000-0000-4000-8000-000000000004', 40000,
   'No suite could be kept', false, now(), null);

create temp table inv (label text primary key, id uuid, number text, seq bigint);
grant all on inv to public;

select has_table('public', 'invoices',
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] tax invoices are a table of their own');

select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.invoices'::regclass),
  '[R-13] with row level security enabled'
);

select is(
  (select count(*)::integer from public.settings s
    where s.key in ('invoice.issuer_legal_name', 'invoice.issuer_trn', 'invoice.issuer_address', 'invoice.number_prefix')),
  4,
  'the four invoice settings have storage, so Management can enter them'
);

select ok(
  not has_table_privilege('authenticated', 'public.invoices', 'insert')
    and not has_table_privilege('authenticated', 'public.invoices', 'update')
    and not has_table_privilege('authenticated', 'public.invoices', 'delete'),
  '[R-02] no direct write reaches the invoice table'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9800000-0000-4000-8000-000000000001","email":"inv.manager@example.test"}';

select throws_ok(
  $$select * from public.issue_invoice('b9800000-0000-4000-8000-000000000001')$$,
  'WP076', null,
  'no invoice is issued before the issuer details are entered in Settings'
);

select lives_ok(
  $$select public.set_setting('invoice.issuer_legal_name', '"Sample Issuer Trading L.L.C."'::jsonb, 'Invoice test'),
           public.set_setting('invoice.issuer_address', '"Unit 1, Example Street, Dubai"'::jsonb, 'Invoice test'),
           public.set_setting('invoice.issuer_trn', '"12345"'::jsonb, 'Invoice test')$$,
  'Management enters the issuer details through the audited settings writer'
);

select throws_ok(
  $$select * from public.issue_invoice('b9800000-0000-4000-8000-000000000001')$$,
  'WP076', null,
  'a tax registration number that is not fifteen digits still refuses'
);

select lives_ok(
  $$select public.set_setting('invoice.issuer_trn', '"100123456700003"'::jsonb, 'Invoice test')$$,
  'a fifteen-digit tax registration number is saved'
);

insert into inv (label, id, number, seq)
select 'first', i.id, i.invoice_number, i.sequence_no
  from public.issue_invoice('b9800000-0000-4000-8000-000000000001') i;

select is(
  (select count(*)::integer from inv where label = 'first'),
  1,
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] a paid booking gets its invoice'
);

select is(
  (select number from inv where label = 'first'),
  (select 'INV-' || to_char(now() at time zone 'Asia/Dubai', 'YYYY') || '-' || lpad(seq::text, 6, '0') from inv where label = 'first'),
  'the number is the default prefix, the Dubai year and the sequence padded to six digits'
);

select is(
  (select row(i.subtotal_fils, i.discount_fils, i.addons_fils, i.service_fee_fils, i.tax_fils, i.total_fils)::text
     from public.invoices i join inv on inv.id = i.id where inv.label = 'first'),
  (select row(b.subtotal_fils, b.discount_fils, b.addons_fils, b.service_fee_fils, b.tax_fils, b.total_fils)::text
     from public.bookings b where b.id = 'b9800000-0000-4000-8000-000000000001'),
  '[INV-21] every figure equals the booking''s stored breakdown'
);

select is(
  (select i.paid_fils || '|' || i.currency from public.invoices i join inv on inv.id = i.id where inv.label = 'first'),
  '68900|AED',
  'paid_fils is the money taken, in AED'
);

select is(
  (select jsonb_array_length(i.lines) || '|' || (select sum((l ->> 'amount_fils')::integer) from jsonb_array_elements(i.lines) l)
     from public.invoices i join inv on inv.id = i.id where inv.label = 'first'),
  '5|68900',
  'the lines are the visit, two add-on snapshots, the discount and the fee, and they add up to the stored total'
);

select is(
  (select (i.lines -> 0 ->> 'adults') || '|' || (i.lines -> 0 ->> 'children') || '|'
          || (select string_agg((l ->> 'label') || ':' || (l ->> 'amount_fils'), ',' order by l ->> 'label')
                from jsonb_array_elements(i.lines) l where l ->> 'kind' = 'addon')
     from public.invoices i join inv on inv.id = i.id where inv.label = 'first'),
  '2|1|Bathrobe:6000,Fruit plate:4000',
  'the visit line carries the guests and the add-on lines carry their snapshot names and amounts'
);

select is(
  (select (i.issuer ->> 'legal_name') || '|' || (i.issuer ->> 'trn') || '|' || (i.bill_to ->> 'name') || '|' || (i.tax ->> 'label')
     from public.invoices i join inv on inv.id = i.id where inv.label = 'first'),
  'Sample Issuer Trading L.L.C.|100123456700003|Ines Voice|VAT',
  'the issuer, the customer and the tax label are snapshotted onto the invoice'
);

select is(
  (select i.id from public.issue_invoice('b9800000-0000-4000-8000-000000000001') i),
  (select id from inv where label = 'first'),
  'issuing again returns the same invoice'
);

reset role;

select is(
  (select count(*)::integer from public.invoices i where i.booking_id = 'b9800000-0000-4000-8000-000000000001'),
  1,
  'and creates no second invoice'
);

select is(
  (select count(*)::integer from audit.entries e join inv on inv.id::text = e.entity_id
    where inv.label = 'first' and e.action = 'issue_invoice' and e.actor_id = 'd9800000-0000-4000-8000-000000000001'),
  1,
  '[§3, INV-13] issuing wrote one audit entry naming the manager, and the idempotent call wrote none'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9800000-0000-4000-8000-000000000001","email":"inv.manager@example.test"}';

select throws_ok(
  $$select * from public.issue_invoice('b9800000-0000-4000-8000-000000000002')$$,
  'WP077', null,
  '[INV-20] a complimentary booking has nothing to invoice'
);

select throws_ok(
  $$select * from public.issue_invoice('b9800000-0000-4000-8000-000000000003')$$,
  'WP078', null,
  'a booking with no money taken is refused'
);

select throws_ok(
  $$select * from public.issue_invoice('b9800000-0000-4000-8000-000000000004')$$,
  'WP078', null,
  'and so is a booking whose money was returned in full'
);

select throws_ok(
  $$select * from public.issue_invoice('b9800000-0000-4000-8000-00000000ffff')$$,
  'P0002', null,
  'an unknown booking is reported as missing'
);

insert into inv (label, id, number, seq)
select 'manual', i.id, i.invoice_number, i.sequence_no
  from public.issue_invoice('b9800000-0000-4000-8000-000000000005') i;

select is(
  (select seq from inv where label = 'manual'),
  (select seq + 1 from inv where label = 'first'),
  'refused issues consume no number, so the next invoice takes the very next one'
);

select is(
  (select (select sum((l ->> 'amount_fils')::integer) from jsonb_array_elements(i.lines) l) || '|' || (i.lines -> 1 ->> 'is_included')
     from public.invoices i join inv on inv.id = i.id where inv.label = 'manual'),
  '50000|true',
  'after a manual price the add-on is listed as included, so the lines still agree with the stored total'
);

select is(
  (select v.voided_by::text || '|' || v.void_reason
     from inv, lateral public.void_invoice(inv.id, 'Customer asked for their company details') v
    where inv.label = 'first'),
  'd9800000-0000-4000-8000-000000000001|Customer asked for their company details',
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] Management voids an invoice with a reason'
);

select throws_ok(
  $$select * from public.void_invoice((select id from inv where label = 'first'), 'Again')$$,
  'WP079', null,
  'an invoice is voided once'
);

select throws_ok(
  $$select * from public.void_invoice((select id from inv where label = 'manual'), ' ')$$,
  '22023', null,
  'voiding needs a reason'
);

insert into inv (label, id, number, seq)
select 'reissued', i.id, i.invoice_number, i.sequence_no
  from public.issue_invoice('b9800000-0000-4000-8000-000000000001') i;

select ok(
  (select r.id <> f.id and r.number <> f.number and r.seq = m.seq + 1
     from inv r, inv f, inv m
    where r.label = 'reissued' and f.label = 'first' and m.label = 'manual'),
  'after a void the booking gets a fresh invoice with the next number'
);

reset role;

select is(
  (select string_agg(i.invoice_number || ':' || (i.voided_at is not null)::text, ',' order by i.sequence_no)
     from public.invoices i where i.booking_id = 'b9800000-0000-4000-8000-000000000001'),
  (select f.number || ':true,' || r.number || ':false' from inv f, inv r where f.label = 'first' and r.label = 'reissued'),
  'the voided invoice keeps its number beside the live one'
);

select ok(
  exists (select 1 from audit.entries e join inv on inv.id::text = e.entity_id
           where inv.label = 'first' and e.action = 'void_invoice'
             and e.reason = 'Customer asked for their company details'),
  '[§3, INV-13] voiding wrote its own audit entry with the reason'
);

select throws_ok(
  $$update public.invoices set total_fils = 1 where id = (select id from inv where label = 'reissued')$$,
  'WP079', null,
  '[INV-21] an issued invoice''s figures cannot be changed, even directly'
);

select throws_ok(
  $$delete from public.invoices where id = (select id from inv where label = 'first')$$,
  'WP079', null,
  'and no invoice, voided or not, is ever deleted'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9800000-0000-4000-8000-000000000001","email":"inv.manager@example.test"}';

select lives_ok(
  $$select public.set_setting('invoice.number_prefix', '"wpx"'::jsonb, 'Invoice test')$$,
  'Management changes the number prefix'
);

insert into inv (label, id, number, seq)
select 'prefixed', i.id, i.invoice_number, i.sequence_no
  from public.issue_invoice('b9800000-0000-4000-8000-000000000006') i;

select ok(
  (select number like 'WPX-%' from inv where label = 'prefixed'),
  'and the next invoice number uses it, in capitals'
);

select is(
  (select m.booking_reference || '|' || (m.suite_number is not null)::text || '|' || m.state || '|' || m.issued_by_name
     from public.management_invoices m join inv on inv.id = m.id where inv.label = 'reissued'),
  'WPINV0001|true|issued|INV Manager',
  'the Management reader returns the invoice with its booking reference and suite number'
);

select is(
  (select p.customer_name || '|' || p.method::text || '|' || (p.suite_number is not null)::text
     from public.management_payment_ledger p where p.payment_id = 'e9800000-0000-4000-8000-000000000001'),
  'Ines Voice|cash|true',
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] the payment ledger carries customer, method and suite'
);

select is(
  (select r.state || '|' || r.is_automatic::text || '|' || r.booking_reference || '|' || r.payment_method::text
     from public.management_refund_ledger r where r.booking_id = 'b9800000-0000-4000-8000-000000000004'),
  'returned|true|WPINV0004|card_terminal',
  'the refund ledger is separate, and shows a returned automatic refund with its booking and method'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d9800000-0000-4000-8000-000000000002","email":"inv.reception@example.test"}';

select throws_ok(
  $$select * from public.issue_invoice('b9800000-0000-4000-8000-000000000003')$$,
  '42501', null,
  '[INV-15] Reception cannot issue an invoice'
);

select throws_ok(
  $$select * from public.void_invoice((select id from inv where label = 'reissued'), 'Reception tries')$$,
  '42501', null,
  '[INV-15] nor void one'
);

select is(
  (select count(*)::integer from public.invoices),
  0,
  '[INV-15] Reception without the figures permission reads no invoices'
);

select is(
  (select (select count(*) from public.management_invoices) + (select count(*) from public.management_payment_ledger)
          + (select count(*) from public.management_refund_ledger))::integer,
  0,
  '[INV-15] and no row of the three Finance ledgers'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d9800000-0000-4000-8000-000000000003","email":"inv.figures@example.test"}';

select ok(
  (select count(*) from public.management_invoices) = 0,
  '[§10.6, INV-15; Project owner''s direction, 17 September 2026] a receptionist with a stored view_confidential_figures grant still reads no invoice, because permissions are fixed by role'
);

select throws_ok(
  $$select * from public.issue_invoice('b9800000-0000-4000-8000-000000000003')$$,
  '42501', null,
  'but reading is not issuing: issuing stays with Management'
);

reset role;

select ok(
  not has_table_privilege('anon', 'public.invoices', 'select')
    and not has_table_privilege('anon', 'public.management_invoices', 'select')
    and not has_table_privilege('anon', 'public.management_payment_ledger', 'select')
    and not has_table_privilege('anon', 'public.management_refund_ledger', 'select')
    and not has_function_privilege('anon', 'public.issue_invoice(uuid,jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.void_invoice(uuid,text)', 'execute'),
  '[INV-01] the unauthenticated role reaches nothing invoice related'
);

select ok(
  not has_table_privilege('authenticated', 'internal.invoice_numbering', 'select')
    and not has_table_privilege('authenticated', 'internal.invoice_numbering', 'update'),
  'and no signed-in session can read or move the invoice counter'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9800000-0000-4000-8000-000000000001","email":"inv.manager@example.test"}';

insert into inv (label, id)
select 'message', m.message_id
  from public.queue_message(
    'invoice_issued', 'email',
    'b9800000-0000-4000-8000-000000000001', 'c9800000-0000-4000-8000-0000000000c1',
    'ines.voice@example.test', 'Your tax invoice', 'Your tax invoice is attached.') m;

select is(
  (select m.template_key || '|' || m.is_marketing::text || '|' || m.status::text
     from public.messages m join inv on inv.id = m.id where inv.label = 'message'),
  'invoice_issued|false|queued',
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11; §12, INV-17] queue_message accepts an invoice email, and it is not marketing'
);

select is(
  (select a.attempt_count || '|' || a.status::text
     from inv, lateral public.record_message_attempt(inv.id, 'sent', 'provider-invoice-1', null) a
    where inv.label = 'message'),
  '1|sent',
  '[§11.5] its delivery attempt is recorded like any other guest message'
);

select is(
  (select t.is_marketing
     from public.set_message_template('invoice_issued', 'email', true, 'Your tax invoice', 'Your tax invoice is attached.', null, 'Invoice template test') t),
  false,
  '[§12] Management may keep a template for invoice emails, and it is transactional'
);

reset role;

select throws_ok(
  $$insert into public.messages (template_key, channel, to_address, is_marketing)
    values ('invoice_issued', 'email', 'ines.voice@example.test', true)$$,
  '23514', null,
  '[INV-17] no path files an invoice email as marketing, so switching marketing off never stops one'
);

select throws_ok(
  $$insert into public.messages (template_key, channel, to_address, is_marketing)
    values ('invoice_sent', 'email', 'ines.voice@example.test', false)$$,
  '23514', null,
  '[§12] and the key list is still closed'
);

select * from finish();
rollback;
