begin;
select plan(28);

insert into public.staff (id, email, full_name, role, is_active) values
  ('d9b00000-0000-4000-8000-000000000001', 'hb.manager@example.test', 'HB Manager', 'management', true);

insert into public.addons (id, name, offer_price_fils, regular_price_fils) values
  ('a9b00000-0000-4000-8000-000000000001', 'HB robe', 5000, 5000);

insert into public.promo_codes (id, code, kind, max_uses, per_customer_limit) values
  ('e9b00000-0000-4000-8000-000000000001', 'WP-HB-OLD', 'addon_free', 5, 1);

insert into public.promo_code_addons (promo_code_id, addon_id) values
  ('e9b00000-0000-4000-8000-000000000001', 'a9b00000-0000-4000-8000-000000000001');

insert into public.promo_codes (id, code, kind, amount_fils) values
  ('e9b00000-0000-4000-8000-000000000002', 'WP-HB-FALL',  'fixed', 1000),
  ('e9b00000-0000-4000-8000-000000000003', 'WP-HB-PURGE', 'fixed', 1000);

create temp table hb (label text primary key, id uuid, code text, detail text, ordinal bigint);
grant all on hb to public;

create function pg_temp.prepare_checkout(p_suite_number integer, p_email text, p_phone text, p_code text, p_cart jsonb)
returns uuid
language plpgsql
as $fn$
declare
  v_token    uuid := gen_random_uuid();
  v_suite    uuid := gen_random_uuid();
  v_hold     uuid;
  v_start    timestamptz := date_trunc('hour', now()) + interval '3 days 2 hours';
  v_progress jsonb;
  v_quote    jsonb;
begin
  insert into public.suites (id, suite_number, status, priority)
  values (v_suite, p_suite_number, 'available', p_suite_number);

  insert into public.suite_occupancy (suite_id, kind, experience_period, blocked_period, cleaning_buffer_minutes, expires_at)
  values (v_suite, 'hold',
          tstzrange(v_start, v_start + interval '2 hours', '[)'),
          tstzrange(v_start, v_start + interval '2 hours 20 minutes', '[)'),
          20, now() + interval '10 minutes')
  returning id into v_hold;

  insert into internal.guest_checkout_holds (token, occupancy_id) values (v_token, v_hold);

  v_progress := jsonb_build_object(
    'identity', jsonb_build_object(
      'salutation', 'ms', 'firstName', 'Hana', 'lastName', 'Batch', 'email', p_email,
      'dateOfBirth', '1990-01-01', 'phoneE164', p_phone, 'phoneCountry', 'AE'),
    'selection', jsonb_build_object(
      'startsAt', to_char(v_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS".000Z"'),
      'durationHours', 2, 'adults', 2, 'childAges', '[]'::jsonb,
      'addonQuantities', (select coalesce(jsonb_object_agg(l ->> 'id', (l ->> 'quantity')::integer), '{}'::jsonb)
                            from jsonb_array_elements(p_cart) l),
      'voucherCode', p_code, 'personalRequest', '', 'paymentOption', 'card'),
    'acceptedTerms', true,
    'lastCompletedStep', 'confirm');

  perform public.save_checkout_progress(
    v_token, v_progress,
    '[{"document_slug":"legal-terms","document_version":"1.3","checkbox_text":"I agree"}]'::jsonb, 30);

  v_quote := jsonb_build_object(
    'breakdown', jsonb_build_object(
      'outcome', 'priced', 'subtotalFils', 66000, 'discountFils', 0, 'addonsTotalFils', 0,
      'serviceFeeFils', 0, 'taxFils', 3143, 'totalFils', 66000, 'regularTotalFils', 88000,
      'savingFils', 22000, 'taxIsIncluded', true, 'lines', '[]'::jsonb),
    'cart', p_cart,
    'taxLabel', 'VAT',
    'offerLabel', 'Special offer',
    'progress', v_progress);

  return (public.prepare_guest_payment(v_token, gen_random_uuid(), v_quote, public.checkout_revision(), 'AED', true) ->> 'paymentId')::uuid;
end
$fn$;


select has_function('internal', 'trim_whitespace', array['text'],
  '[CLIENT coupon request 2026-09-12] one helper defines the whitespace a batch name may not start or end with');

select has_index('internal', 'checkout_attempts', 'checkout_attempts_booking_idx',
  'the redemption trigger finds a booking''s latest payment attempt through an index');

insert into hb (label, id) values
  ('pay-renamed', pg_temp.prepare_checkout(9811, 'hb.renamed@example.test', '+971500009811', 'WP-HB-OLD',
    '[{"id":"a9b00000-0000-4000-8000-000000000001","name":"HB robe","unitPriceFils":0,"quantity":1,"regularUnitPriceFils":5000,"isLocked":false,"voucherCode":"WP-HB-OLD"}]'::jsonb));

insert into hb (label, id) values
  ('pay-malformed', pg_temp.prepare_checkout(9812, 'hb.malformed@example.test', '+971500009812', 'WP-HB-FALL', '[]'::jsonb));

insert into hb (label, id) values
  ('pay-purged', pg_temp.prepare_checkout(9813, 'hb.purged@example.test', '+971500009813', 'WP-HB-PURGE', '[]'::jsonb));

select is(
  (select a.snapshot #>> '{progress,selection,voucherCode}' || '|' || a.promo_id::text
     from internal.checkout_attempts a
    where a.payment_id = (select hb.id from hb where hb.label = 'pay-renamed')),
  'WP-HB-OLD|e9b00000-0000-4000-8000-000000000001',
  'fixture: the open checkout recorded the code the guest typed and the coupon it reserved'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9b00000-0000-4000-8000-000000000001","email":"hb.manager@example.test"}';

select lives_ok(
  $$select public.save_checkout_coupon(
      '{"id":"e9b00000-0000-4000-8000-000000000001","code":"WP-HB-NEW","kind":"percent","amountFils":null,"percent":50,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":5,"perCustomerLimit":1,"isCombinable":true,"isActive":true,"reason":"Coupon edited from the console"}'::jsonb,
      (select p.updated_at from public.promo_codes p where p.id = 'e9b00000-0000-4000-8000-000000000001'))$$,
  'fixture: while the payment is open the manager renames the reserved coupon and changes its type'
);

insert into hb (label, id, code)
select 'reissued', g.promo_code_id, g.code
  from public.generate_checkout_coupons(
    '{"kind":"fixed","amountFils":20000,"percent":null,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb,
    array['WP-HB-OLD'],
    'Old name reissued',
    null
  ) g;

reset role;

update internal.checkout_attempts a
   set snapshot = jsonb_set(a.snapshot, '{progress,selection,voucherCode}', '"not a code!"'::jsonb)
 where a.payment_id = (select hb.id from hb where hb.label = 'pay-malformed');

update public.promo_codes set code = 'WP-HB-FALL-NOW' where id = 'e9b00000-0000-4000-8000-000000000002';

update internal.checkout_attempts a
   set snapshot = a.snapshot - 'progress'
 where a.payment_id = (select hb.id from hb where hb.label = 'pay-purged');

update public.promo_codes set code = 'WP-HB-PURGE-NOW' where id = 'e9b00000-0000-4000-8000-000000000003';

update hb
   set detail = public.settle_payment_event('simulation', 'HB-EVT-' || hb.label, hb.id, 'success', p.amount_fils, 'AED', true, '{}'::jsonb) ->> 'status'
  from public.payments p
 where p.id = hb.id
   and hb.label like 'pay-%';

select is(
  (select string_agg(hb.label || ':' || coalesce(hb.detail, 'none'), ',' order by hb.label) from hb where hb.label like 'pay-%'),
  'pay-malformed:confirmed,pay-purged:confirmed,pay-renamed:confirmed',
  'all three payments settle, including the two whose recorded code cannot be used'
);

select is(
  (select r.code_snapshot
     from public.promo_code_redemptions r
     join public.payments p on p.booking_id = r.booking_id
    where p.id = (select hb.id from hb where hb.label = 'pay-renamed')),
  'WP-HB-OLD',
  '[CLIENT coupon request 2026-09-12] the redemption keeps the code the guest used, although the coupon was renamed while the payment was open'
);

select is(
  (select r.promo_code_id::text
     from public.promo_code_redemptions r
     join public.payments p on p.booking_id = r.booking_id
    where p.id = (select hb.id from hb where hb.label = 'pay-renamed')),
  'e9b00000-0000-4000-8000-000000000001',
  'and it counts against the coupon the guest reserved, not the new coupon that took over its old code'
);

select ok(
  (select bool_and(r.code_snapshot = ba.voucher_code)
     from public.promo_code_redemptions r
     join public.payments p on p.booking_id = r.booking_id
     join public.booking_addons ba on ba.booking_id = r.booking_id
    where p.id = (select hb.id from hb where hb.label = 'pay-renamed')),
  '[§11.2] so it agrees with the add-on line the guest was sold'
);

select is(
  (select string_agg(p.code || '=' || p.used_count::text, ',' order by p.code)
     from public.promo_codes p
    where p.id in ('e9b00000-0000-4000-8000-000000000001', (select hb.id from hb where hb.label = 'reissued'))),
  'WP-HB-NEW=1,WP-HB-OLD=0',
  'the renamed coupon carries the use and the reissued code is still unspent'
);

select is(
  (select r.code_snapshot
     from public.promo_code_redemptions r
     join public.payments p on p.booking_id = r.booking_id
    where p.id = (select hb.id from hb where hb.label = 'pay-malformed')),
  'WP-HB-FALL-NOW',
  'a recorded code that does not have the shape of a code falls back to the coupon''s current code, and the redemption is still written'
);

select is(
  (select r.code_snapshot
     from public.promo_code_redemptions r
     join public.payments p on p.booking_id = r.booking_id
    where p.id = (select hb.id from hb where hb.label = 'pay-purged')),
  'WP-HB-PURGE-NOW',
  'and so does a checkout whose recorded progress is gone'
);

select throws_ok(
  $$insert into public.promo_code_redemptions (promo_code_id, booking_id, customer_id, code_snapshot)
    select (select hb.id from hb where hb.label = 'reissued'), b.id, b.customer_id, 'bad code'
      from public.bookings b
      join public.payments p on p.booking_id = b.id
     where p.id = (select hb.id from hb where hb.label = 'pay-renamed')$$,
  '23514', null,
  'a snapshot supplied by a writer must still have the shape of a code'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9b00000-0000-4000-8000-000000000001","email":"hb.manager@example.test"}';

select throws_ok(
  $$select * from public.generate_checkout_coupons('{"kind":"fixed","amountFils":1000,"percent":null,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb, array['WP-HB-N1', null, 'WP-HB-N2'])$$,
  'WP080', 'Every coupon needs a code. Remove the empty entries and generate again.',
  '[CLIENT coupon request 2026-09-12] a null entry is refused with a message the manager can act on'
);

select throws_ok(
  $$select * from public.generate_checkout_coupons('{"kind":"fixed","amountFils":1000,"percent":null,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb, array['WP-HB-N3', chr(9) || chr(160) || ' '])$$,
  'WP080', 'Every coupon needs a code. Remove the empty entries and generate again.',
  'as is an entry that is only whitespace'
);

select is(
  (select count(*)::integer from public.promo_codes p where p.code in ('WP-HB-N1', 'WP-HB-N2', 'WP-HB-N3')),
  0,
  'and nothing was created'
);

insert into hb (label, id, code)
select 'tabbed', g.promo_code_id, g.code
  from public.generate_checkout_coupons(
    '{"kind":"fixed","amountFils":1000,"percent":null,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb,
    array['WP-HB-TAB'],
    chr(9) || 'Summer brand' || chr(10) || chr(160),
    null
  ) g;

insert into hb (label, id, code)
select 'blank-name', g.promo_code_id, g.code
  from public.generate_checkout_coupons(
    '{"kind":"fixed","amountFils":1000,"percent":null,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb,
    array['WP-HB-BLANK'],
    chr(9) || chr(12288),
    null
  ) g;

insert into hb (label, id, code)
select 'long-name', g.promo_code_id, g.code
  from public.generate_checkout_coupons(
    '{"kind":"fixed","amountFils":1000,"percent":null,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb,
    array['WP-HB-LONG'],
    chr(9) || repeat('x', 80) || chr(13) || chr(10),
    null
  ) g;

select is(
  (select p.batch_name from public.promo_codes p join hb on hb.id = p.id where hb.label = 'tabbed'),
  'Summer brand',
  '[CLIENT coupon request 2026-09-12] the function trims tabs, line breaks and no-break spaces from a batch name'
);

select ok(
  (select p.batch_id is not null and p.batch_name is null
     from public.promo_codes p join hb on hb.id = p.id where hb.label = 'blank-name'),
  'a batch name that is only whitespace is stored as none'
);

select is(
  (select char_length(p.batch_name) from public.promo_codes p join hb on hb.id = p.id where hb.label = 'long-name'),
  80,
  'and the 80-character limit is measured after trimming'
);

reset role;

select throws_ok(
  $$insert into public.promo_codes (code, kind, amount_fils, batch_id, batch_name)
    values ('WP-HB-DIRECT1', 'fixed', 1000, gen_random_uuid(), chr(9) || 'Tabbed')$$,
  '23514', null,
  'a direct write whose batch name starts with a tab is refused'
);

select throws_ok(
  $$insert into public.promo_codes (code, kind, amount_fils, batch_id, batch_name)
    values ('WP-HB-DIRECT2', 'fixed', 1000, gen_random_uuid(), 'Trailing' || chr(10))$$,
  '23514', null,
  'as is one that ends with a line break'
);

select throws_ok(
  $$insert into public.promo_codes (code, kind, amount_fils, batch_id, batch_name)
    values ('WP-HB-DIRECT3', 'fixed', 1000, gen_random_uuid(), 'No-break' || chr(160))$$,
  '23514', null,
  'or with a no-break space'
);

select lives_ok(
  $$insert into public.promo_codes (code, kind, amount_fils, batch_id, batch_name)
    values ('WP-HB-DIRECT4', 'fixed', 1000, gen_random_uuid(), 'Inner' || chr(9) || 'tab')$$,
  'whitespace inside a batch name is left alone'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9b00000-0000-4000-8000-000000000001","email":"hb.manager@example.test"}';

insert into hb (label, id, code, ordinal)
select 'order-' || g.n, g.promo_code_id, g.code, g.n
  from public.generate_checkout_coupons(
    '{"kind":"fixed","amountFils":1000,"percent":null,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb,
    array['WP-HB-ZULU', 'wp-hb-alpha', 'WP-HB-MIKE'],
    'Order check',
    null
  ) with ordinality as g(promo_code_id, code, batch_id, n);

select is(
  (select string_agg(hb.code, ',' order by hb.ordinal) from hb where hb.label like 'order-%'),
  'WP-HB-ZULU,WP-HB-ALPHA,WP-HB-MIKE',
  '[CLIENT coupon request 2026-09-12] rows come back in the order the codes were given'
);

select ok(
  exists (
    select 1
      from pg_locks l
     where l.locktype = 'advisory'
       and l.pid = pg_backend_pid()
       and l.granted
       and l.objsubid = 1
       and l.classid = ((hashtext('wellplace.coupon_generation')::bigint >> 32) & 4294967295)::oid
       and l.objid = (hashtext('wellplace.coupon_generation')::bigint & 4294967295)::oid),
  'a batch holds the coupon-generation lock until its transaction ends, so an overlapping batch waits for it instead of deadlocking'
);

reset role;

select is(
  (select string_agg(p.code, ',' order by e.id)
     from audit.entries e
     join public.promo_codes p on p.id::text = e.entity_id
    where e.action = 'set_promo_code'
      and p.code in ('WP-HB-ZULU', 'WP-HB-ALPHA', 'WP-HB-MIKE')),
  'WP-HB-ALPHA,WP-HB-MIKE,WP-HB-ZULU',
  'but the coupons were created in code order, so two batches always take their locks in the same order'
);

select is(
  (select e.new_value -> 'codes'
     from audit.entries e
    where e.action = 'generate_checkout_coupons'
      and e.new_value ->> 'batch_name' = 'Order check'),
  '["WP-HB-ZULU", "WP-HB-ALPHA", "WP-HB-MIKE"]'::jsonb,
  '[§3, INV-13] the batch audit entry keeps the codes in the order the manager gave them'
);

select ok(
  not has_function_privilege('anon', 'internal.trim_whitespace(text)', 'execute')
    and not has_function_privilege('authenticated', 'internal.trim_whitespace(text)', 'execute')
    and has_function_privilege('service_role', 'internal.trim_whitespace(text)', 'execute'),
  'the helper is executable only by the roles that can write promo_codes directly, because the batch-name constraint calls it; the signed-in role writes coupons through definer functions and needs no grant'
);

select lives_ok(
  $$set local role service_role;
    insert into public.promo_codes (code, kind, amount_fils, batch_id, batch_name)
    values ('WP-HB-SERVICE', 'fixed', 1000, gen_random_uuid(), 'Service write');
    reset role$$,
  'so a direct write by the service role still passes the constraint'
);

select * from finish();
rollback;
