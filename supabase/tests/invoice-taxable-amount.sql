begin;
select plan(26);

insert into public.staff (id, email, full_name, role, is_active) values
  ('d9900000-0000-4000-8000-000000000001', 'vat.manager@example.test', 'VAT Manager', 'management', true);

insert into public.staff_permissions (staff_id, permission, granted_by, reason) values
  ('d9900000-0000-4000-8000-000000000001', 'manual_price_change',
   'd9900000-0000-4000-8000-000000000001', 'Taxable amount test grant');

insert into public.customers (id, first_name, last_name, email, phone_e164, phone_country) values
  ('c9900000-0000-4000-8000-0000000000c1', 'Tara', 'Levy', 'tara.levy@example.test', '+971500009901', 'AE');

insert into public.addons (id, name, regular_price_fils, offer_price_fils, min_quantity, default_quantity, max_quantity, is_taxable) values
  ('a9900000-0000-4000-8000-000000000001', 'VAT test robe',    2000, 2000, 1, 1, 2, true),
  ('a9900000-0000-4000-8000-000000000002', 'VAT test voucher', 2500, 2500, 1, 1, 1, false);

insert into public.bookings
  (id, reference, customer_id, source, status, experience_period, cleaning_buffer_minutes,
   subtotal_fils, discount_fils, addons_fils, service_fee_fils, tax_fils, total_fils, is_complimentary)
values
  ('b9900000-0000-4000-8000-000000000001', 'WPVAT0001', 'c9900000-0000-4000-8000-0000000000c1', 'online', 'confirmed',
   tstzrange(timestamptz '2041-12-01 10:00+04', timestamptz '2041-12-01 12:00+04', '[)'), 20,
   60000, 5000, 6500, 3690, 2810, 65190, false),
  ('b9900000-0000-4000-8000-000000000002', 'WPVAT0002', 'c9900000-0000-4000-8000-0000000000c1', 'walk_in', 'completed',
   tstzrange(timestamptz '2041-12-02 10:00+04', timestamptz '2041-12-02 12:00+04', '[)'), 20,
   58000, 0, 2000, 0, 2857, 60000, false),
  ('b9900000-0000-4000-8000-000000000003', 'WPVAT0003', 'c9900000-0000-4000-8000-0000000000c1', 'walk_in', 'completed',
   tstzrange(timestamptz '2041-12-03 10:00+04', timestamptz '2041-12-03 12:00+04', '[)'), 20,
   40000, 0, 0, 0, 2000, 42000, false),
  ('b9900000-0000-4000-8000-000000000004', 'WPVAT0004', 'c9900000-0000-4000-8000-0000000000c1', 'walk_in', 'completed',
   tstzrange(timestamptz '2041-12-04 10:00+04', timestamptz '2041-12-04 12:00+04', '[)'), 20,
   66000, 0, 0, 0, 3143, 66000, false);

update public.bookings set overrun_minutes = 35, overrun_fils = 21996
 where id = 'b9900000-0000-4000-8000-000000000004';

insert into public.booking_addons (booking_id, addon_id, name_snapshot, unit_price_fils, quantity) values
  ('b9900000-0000-4000-8000-000000000001', 'a9900000-0000-4000-8000-000000000001', 'VAT test robe',    2000, 2),
  ('b9900000-0000-4000-8000-000000000001', 'a9900000-0000-4000-8000-000000000002', 'VAT test voucher', 2500, 1),
  ('b9900000-0000-4000-8000-000000000002', 'a9900000-0000-4000-8000-000000000001', 'VAT test robe',    2000, 1);

insert into public.payments (booking_id, status, method, amount_fils) values
  ('b9900000-0000-4000-8000-000000000001', 'paid', 'online', 65190),
  ('b9900000-0000-4000-8000-000000000002', 'paid', 'cash',   50000),
  ('b9900000-0000-4000-8000-000000000003', 'paid', 'cash',   42000),
  ('b9900000-0000-4000-8000-000000000004', 'paid', 'cash',   87996);

create temp table vat (label text primary key, id uuid);
grant all on vat to public;

select col_not_null('public', 'booking_addons', 'is_taxable',
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] every sold add-on line records whether it bears VAT');

select col_hasnt_default('public', 'booking_addons', 'is_taxable',
  'and has no default, which would be applied before the snapshot and hide an exempt add-on');

select is(
  (select string_agg(ba.name_snapshot || ':' || ba.is_taxable::text, ',' order by ba.name_snapshot)
     from public.booking_addons ba where ba.booking_id = 'b9900000-0000-4000-8000-000000000001'),
  'VAT test robe:true,VAT test voucher:false',
  '[§8] a new line takes its VAT flag from the add-on when the writer leaves it empty'
);

insert into public.booking_addons (id, booking_id, addon_id, name_snapshot, unit_price_fils, quantity, is_taxable) values
  ('e9900000-0000-4000-8000-000000000001', 'b9900000-0000-4000-8000-000000000003', null, 'Written off-catalogue', 0, 1, null),
  ('e9900000-0000-4000-8000-000000000002', 'b9900000-0000-4000-8000-000000000003', 'a9900000-0000-4000-8000-000000000002', 'Writer chose', 0, 1, true);

select is(
  (select string_agg(ba.name_snapshot || ':' || ba.is_taxable::text, ',' order by ba.name_snapshot)
     from public.booking_addons ba where ba.booking_id = 'b9900000-0000-4000-8000-000000000003'),
  'Writer chose:true,Written off-catalogue:true',
  'a line with no catalogue add-on is VAT-bearing, as the pricing engine reads an unknown add-on, and a writer that supplies the flag keeps it'
);

delete from public.booking_addons where booking_id = 'b9900000-0000-4000-8000-000000000003';

update public.addons set is_taxable = true where id = 'a9900000-0000-4000-8000-000000000002';

select is(
  (select ba.is_taxable from public.booking_addons ba
    where ba.booking_id = 'b9900000-0000-4000-8000-000000000001' and ba.addon_id = 'a9900000-0000-4000-8000-000000000002'),
  false,
  '[INV-21] a later catalogue change does not alter a line already sold'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9900000-0000-4000-8000-000000000001","email":"vat.manager@example.test"}';

select lives_ok(
  $$select public.set_setting('invoice.issuer_legal_name', '"Sample Issuer Trading L.L.C."'::jsonb, 'Taxable amount test'),
           public.set_setting('invoice.issuer_address', '"Unit 1, Example Street, Dubai"'::jsonb, 'Taxable amount test'),
           public.set_setting('invoice.issuer_trn', '"100123456700003"'::jsonb, 'Taxable amount test')$$,
  'fixture: the issuer details are entered'
);

select is(
  (select m.total_fils from public.set_manual_booking_price('b9900000-0000-4000-8000-000000000002', 50000, 'Agreed package price') m),
  50000,
  'fixture: the manager sets an agreed price of AED 500'
);

reset role;

select is(
  (select b.subtotal_fils || '|' || b.discount_fils || '|' || b.addons_fils || '|' || b.service_fee_fils || '|' || b.tax_fils || '|' || b.total_fils
     from public.bookings b where b.id = 'b9900000-0000-4000-8000-000000000002'),
  '50000|0|0|0|2381|50000',
  '[CLIENT pricing specification: all prices include 5% VAT] a manual total is a VAT-inclusive gross, so its VAT, 50000 less round(50000 / 1.05), is stored'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9900000-0000-4000-8000-000000000001","email":"vat.manager@example.test"}';

insert into vat (label, id)
select 'exempt', i.id from public.issue_invoice('b9900000-0000-4000-8000-000000000001') i;
insert into vat (label, id)
select 'manual', i.id from public.issue_invoice('b9900000-0000-4000-8000-000000000002') i;
insert into vat (label, id)
select 'on_top', i.id from public.issue_invoice('b9900000-0000-4000-8000-000000000003') i;

select lives_ok(
  $$select public.set_setting('tax.inclusive', 'false'::jsonb, 'Taxable amount test')$$,
  'fixture: the tax.inclusive setting is switched off after these bookings were priced'
);

insert into vat (label, id)
select 'overstay', i.id from public.issue_invoice('b9900000-0000-4000-8000-000000000004') i;

select is(
  (select m.taxable_fils from public.management_invoices m join vat on vat.id = m.id where vat.label = 'exempt'),
  56190,
  '[§8, INV-21] the taxable amount excludes the exempt add-on and the service fee, and the VAT inside the price'
);

select is(
  (select m.taxable_fils + m.tax_fils from public.management_invoices m join vat on vat.id = m.id where vat.label = 'exempt'),
  60000 - 5000 + 4000,
  'so taxable amount plus VAT is exactly the VAT-bearing gross: the visit less the discount plus the VAT-bearing add-on'
);

select isnt(
  (select m.taxable_fils from public.management_invoices m join vat on vat.id = m.id where vat.label = 'exempt'),
  (select m.total_fils - m.service_fee_fils - m.tax_fils from public.management_invoices m join vat on vat.id = m.id where vat.label = 'exempt'),
  'which is not the total less fee less VAT that the page could otherwise only guess'
);

select is(
  (select string_agg((l ->> 'label') || ':' || (l ->> 'is_taxable'), ',' order by l ->> 'label')
     from public.invoices i join vat on vat.id = i.id, jsonb_array_elements(i.lines) l
    where vat.label = 'exempt' and l ->> 'kind' = 'addon'),
  'VAT test robe:true,VAT test voucher:false',
  'each add-on line on the invoice carries its VAT snapshot'
);

select is(
  (select m.taxable_fils || '|' || m.tax_fils || '|' || m.total_fils from public.management_invoices m join vat on vat.id = m.id where vat.label = 'manual'),
  '47619|2381|50000',
  'a manually priced booking is invoiced with its VAT: taxable 47619 plus VAT 2381 is the agreed 50000, and its stale add-on line adds nothing'
);

select is(
  (select m.taxable_fils || '|' || (m.taxable_fils + m.tax_fils = m.total_fils)::text
     from public.management_invoices m join vat on vat.id = m.id where vat.label = 'on_top'),
  '40000|true',
  'a booking priced with VAT added on top keeps its whole goods value as the taxable amount'
);

select is(
  (select string_agg(vat.label || ':' || (m.tax ->> 'is_included'), ',' order by vat.label)
     from public.management_invoices m join vat on vat.id = m.id where vat.label in ('exempt', 'on_top')),
  'exempt:true,on_top:false',
  '[§8] whether VAT is shown as included is read from the booking''s own figures'
);

select is(
  (select m.tax ->> 'is_included' from public.management_invoices m join vat on vat.id = m.id where vat.label = 'overstay'),
  'true',
  'and not from the tax.inclusive setting, which was switched off after the booking was priced'
);

select is(
  (select m.total_fils || '|' || m.tax_fils || '|' || m.taxable_fils || '|' || m.overrun_fils || '|' || m.paid_fils
     from public.management_invoices m join vat on vat.id = m.id where vat.label = 'overstay'),
  '87996|4190|83806|21996|87996',
  '[§7.6, INV-21, Q-21] a stored overstay is invoiced: it joins the total, its VAT at the inclusive rate (21996 less round(21996 / 1.05) = 1047) joins the VAT, and its net joins the taxable amount'
);

select is(
  (select (l ->> 'label') || '|' || (l ->> 'minutes') || '|' || (l ->> 'amount_fils') || '|' || (l ->> 'is_taxable')
     from public.invoices i join vat on vat.id = i.id, jsonb_array_elements(i.lines) l
    where vat.label = 'overstay' and l ->> 'kind' = 'overrun'),
  'Overstay|35|21996|true',
  'and appears as its own overrun line with the stored minutes'
);

reset role;

select ok(
  (select count(*) = 4 from public.invoices i join vat on vat.id = i.id
    where i.taxable_fils >= 0 and i.taxable_fils <= i.total_fils),
  'every issued taxable amount lies between zero and the total'
);

select throws_ok(
  $$update public.invoices set taxable_fils = 1 where id = (select id from vat where label = 'exempt')$$,
  'WP079', null,
  '[INV-21] the taxable amount is as immutable as every other invoice figure'
);

select throws_ok(
  $$update public.invoices set overrun_fils = 0 where id = (select id from vat where label = 'overstay')$$,
  'WP079', null,
  '[INV-21] and so is the overstay charge'
);

select throws_ok(
  $$insert into public.invoices (invoice_number, sequence_no, booking_id, customer_id, issuer, bill_to, lines, tax,
      subtotal_fils, discount_fils, addons_fils, service_fee_fils, tax_fils, total_fils, paid_fils, currency, taxable_fils, supply_date)
    values ('INV-2041-999999', 999999, 'b9900000-0000-4000-8000-000000000003', 'c9900000-0000-4000-8000-0000000000c1',
      '{"legal_name":"x","trn":"x","address":"x"}', '{}', '[]', '{}', 1, 0, 0, 0, 0, 1, 1, 'AED', 2, date '2041-12-03')$$,
  '23514', null,
  'and a taxable amount above the total is refused by the table itself'
);

select ok(
  (select i.taxable_fils = internal.invoice_taxable_fils(i.booking_id, i.subtotal_fils, i.discount_fils, i.addons_fils, i.service_fee_fils, i.tax_fils, i.total_fils)
     from public.invoices i join vat on vat.id = i.id where vat.label = 'exempt'),
  'issue_invoice and the backfill use the same formula'
);

select ok(
  not has_function_privilege('authenticated', 'internal.invoice_taxable_fils(uuid,integer,integer,integer,integer,integer,integer)', 'execute')
    and not has_function_privilege('authenticated', 'internal.snapshot_booking_addon_tax()', 'execute')
    and not has_function_privilege('authenticated', 'internal.vat_added_on_top(integer,integer,integer,integer,integer,integer)', 'execute'),
  '[INV-14] none of the new internal functions is reachable from a signed-in session'
);

select ok(
  not has_table_privilege('service_role', 'public.invoices', 'insert')
    and not has_table_privilege('service_role', 'public.invoices', 'update')
    and not has_table_privilege('service_role', 'public.invoices', 'delete')
    and not has_table_privilege('service_role', 'public.invoices', 'truncate')
    and not has_table_privilege('service_role', 'internal.invoice_numbering', 'update'),
  '[§13] the service role cannot write, delete or truncate invoices, nor move their counter'
);

select * from finish();
rollback;
