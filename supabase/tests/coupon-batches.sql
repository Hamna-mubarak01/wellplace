begin;
select plan(52);

insert into public.staff (id, email, full_name, role, is_active) values
  ('d9900000-0000-4000-8000-000000000001', 'cb.manager@example.test',   'CB Manager',   'management', true),
  ('d9900000-0000-4000-8000-000000000002', 'cb.reception@example.test', 'CB Reception', 'reception',  true);

insert into public.addons (id, name, offer_price_fils, regular_price_fils) values
  ('a9900000-0000-4000-8000-000000000001', 'CB test robe', 0, 5000);

insert into public.customers (id, salutation, first_name, last_name, email, phone_e164, phone_country) values
  ('c9900000-0000-4000-8000-0000000000c1', 'ms', 'Cora', 'Batch', 'cora.batch@example.test', '+971500009901', 'AE');

insert into public.bookings
  (id, reference, customer_id, suite_id, source, status, experience_period, cleaning_buffer_minutes,
   subtotal_fils, discount_fils, addons_fils, service_fee_fils, tax_fils, total_fils, is_complimentary)
values
  ('b9900000-0000-4000-8000-000000000001', 'WPCB0001', 'c9900000-0000-4000-8000-0000000000c1',
   null, 'telephone', 'confirmed',
   tstzrange(timestamptz '2041-12-01 10:00+04', timestamptz '2041-12-01 12:00+04', '[)'), 20,
   40000, 0, 0, 0, 1905, 40000, false),
  ('b9900000-0000-4000-8000-000000000002', 'WPCB0002', 'c9900000-0000-4000-8000-0000000000c1',
   null, 'telephone', 'confirmed',
   tstzrange(timestamptz '2041-12-02 10:00+04', timestamptz '2041-12-02 12:00+04', '[)'), 20,
   40000, 0, 0, 0, 1905, 40000, false);

insert into public.promo_codes (id, code, kind, percent, max_uses) values
  ('e9900000-0000-4000-8000-000000000001', 'WP-CB-USED', 'percent', 10, 10);

create temp table cb (label text primary key, id uuid, code text, batch uuid);
grant all on cb to public;

create function pg_temp.coupon_refusal(p_sql text) returns text language plpgsql as $fn$
declare
  v_state  text;
  v_detail text;
begin
  execute p_sql;
  return 'no error';
exception when others then
  get stacked diagnostics v_state = returned_sqlstate, v_detail = pg_exception_detail;
  return v_state || '|' || coalesce(v_detail, '');
end
$fn$;
grant execute on function pg_temp.coupon_refusal(text) to public;


select has_column('public', 'promo_codes', 'batch_id',
  '[CLIENT coupon request 2026-09-12] a coupon records the generation run it belongs to');

select col_type_is('public', 'promo_codes', 'batch_id', 'uuid',
  'as a uuid shared by the run');

select has_column('public', 'promo_codes', 'batch_name',
  'and the name the manager gave that run');

select has_index('public', 'promo_codes', 'promo_codes_batch_idx',
  'a batch can be listed without scanning every coupon');

select has_column('public', 'promo_code_redemptions', 'code_snapshot',
  '[CLIENT coupon request 2026-09-12] a redemption keeps the code the guest used');

select col_not_null('public', 'promo_code_redemptions', 'code_snapshot',
  'on every row, including those written before the column existed');

select has_function('public', 'generate_checkout_coupons', array['jsonb', 'text[]', 'text', 'text'],
  '[CLIENT coupon request 2026-09-12] coupons are generated in bulk by one function');

select ok(
  (select p.prosecdef and 'search_path=""' = any (p.proconfig)
     from pg_proc p
    where p.oid = 'public.generate_checkout_coupons(jsonb,text[],text,text)'::regprocedure),
  '[R-15] it runs as definer with an empty search path'
);

select ok(
  not has_function_privilege('anon', 'public.generate_checkout_coupons(jsonb,text[],text,text)', 'execute'),
  '[§13] an unauthenticated caller holds no EXECUTE on it'
);

select ok(
  not has_function_privilege('authenticated', 'internal.snapshot_redeemed_coupon_code()', 'execute')
    and not has_function_privilege('anon', 'internal.snapshot_redeemed_coupon_code()', 'execute'),
  'the snapshot trigger function is not client-callable'
);

set local role anon;

select throws_ok(
  $$select * from public.generate_checkout_coupons('{"kind":"fixed","amountFils":1000,"percent":null,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb, array['WP-CB-ANON'])$$,
  '42501', null,
  '[§13] anon cannot execute it'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d9900000-0000-4000-8000-000000000002","email":"cb.reception@example.test"}';

select throws_ok(
  $$select * from public.generate_checkout_coupons('{"kind":"fixed","amountFils":1000,"percent":null,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb, array['WP-CB-DESK'])$$,
  '42501', null,
  '[INV-15] Reception cannot generate coupons'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d9900000-0000-4000-8000-000000000001","email":"cb.manager@example.test"}';

insert into cb (label, id, code, batch)
select 'gen' || g.n, g.promo_code_id, g.code, g.batch_id
  from public.generate_checkout_coupons(
    '{"kind":"percent","amountFils":null,"percent":15,"addonIds":[],"validFrom":"2041-01-01","validTo":"2041-12-31","maxUses":1,"perCustomerLimit":1,"isCombinable":false,"isActive":true}'::jsonb,
    array[' wp-cb-one ', 'WP-CB-TWO', 'wp-cb-three'],
    '  Spring Brand  ',
    'Spring campaign'
  ) with ordinality as g(promo_code_id, code, batch_id, n);

select is(
  (select string_agg(cb.code, ',' order by cb.label) from cb where cb.label like 'gen%'),
  'WP-CB-ONE,WP-CB-TWO,WP-CB-THREE',
  '[CLIENT coupon request 2026-09-12] three codes are created, normalised, and returned in the order given'
);

select is(
  (select count(distinct cb.batch)::integer from cb where cb.label like 'gen%' and cb.batch is not null),
  1,
  'and all three share one batch id'
);

select ok(
  (select bool_and(p.batch_id = cb.batch and p.batch_name = 'Spring Brand')
     from cb join public.promo_codes p on p.id = cb.id
    where cb.label like 'gen%'),
  'each stored coupon carries the batch id and the trimmed batch name'
);

select is(
  (select string_agg(distinct
            p.kind::text || '|' || p.percent::text || '|' || coalesce(p.amount_fils::text, 'none') || '|' ||
            p.valid_from::text || '|' || p.valid_to::text || '|' || p.max_uses::text || '|' ||
            p.per_customer_limit::text || '|' || p.is_combinable::text || '|' || p.is_active::text, ',')
     from cb join public.promo_codes p on p.id = cb.id
    where cb.label like 'gen%'),
  'percent|15.00|none|2041-01-01|2041-12-31|1|1|false|true',
  '[CLIENT coupon request 2026-09-12] every coupon in the batch has the discount and validity the manager set'
);

select is(
  (select p.batch_name from public.promo_codes p where p.code = 'WP-CB-TWO'),
  'Spring Brand',
  '[INV-15] Management reads the batch columns through the existing staff read policy'
);

insert into cb (label, id, code, batch)
select 'solo', g.promo_code_id, g.code, g.batch_id
  from public.generate_checkout_coupons(
    '{"kind":"fixed","amountFils":2000,"percent":null,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb,
    array['WP-CB-SOLO'],
    '   ',
    null
  ) g;

select ok(
  (select p.batch_id = cb.batch and p.batch_name is null
     from cb join public.promo_codes p on p.id = cb.id
    where cb.label = 'solo'),
  'a blank batch name is stored as none, and the coupon still records its batch'
);

reset role;

select is(
  (select count(*)::integer
     from audit.entries e
     join cb on cb.id::text = e.entity_id
    where cb.label like 'gen%'
      and e.action = 'set_promo_code'
      and e.entity = 'public.promo_codes'
      and e.old_value is null
      and e.reason = 'Spring campaign'
      and e.actor_id = 'd9900000-0000-4000-8000-000000000001'),
  3,
  '[§3, INV-13] each generated coupon has its own audit entry with the actor and the reason'
);

select ok(
  exists (
    select 1
      from audit.entries e
     where e.action = 'generate_checkout_coupons'
       and e.entity_id = (select cb.batch::text from cb where cb.label = 'gen1')
       and e.new_value ->> 'count' = '3'
       and e.new_value ->> 'batch_name' = 'Spring Brand'
       and e.new_value -> 'codes' = '["WP-CB-ONE", "WP-CB-TWO", "WP-CB-THREE"]'::jsonb
       and e.reason = 'Spring campaign'
       and e.actor_id = 'd9900000-0000-4000-8000-000000000001'),
  '[§3, INV-13] and the batch has one entry naming its codes, name and reason'
);

select is(
  (select e.reason
     from audit.entries e
    where e.action = 'generate_checkout_coupons'
      and e.entity_id = (select cb.batch::text from cb where cb.label = 'solo')),
  'Coupons generated from the console',
  'without a typed reason the audit entry carries the console default'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9900000-0000-4000-8000-000000000001","email":"cb.manager@example.test"}';

select throws_ok(
  $$select * from public.generate_checkout_coupons('{"kind":"fixed","amountFils":1000,"percent":null,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb, array['WP-CB-DUP', 'wp-cb-dup ', 'WP-CB-OTHER', 'WP-CB-OTHER'])$$,
  'WP080', null,
  '[CLIENT coupon request 2026-09-12] a list that repeats a code is refused'
);

select is(
  pg_temp.coupon_refusal($$select * from public.generate_checkout_coupons('{"kind":"fixed","amountFils":1000,"percent":null,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb, array['WP-CB-DUP', 'wp-cb-dup ', 'WP-CB-OTHER', 'WP-CB-OTHER'])$$),
  'WP080|WP-CB-DUP,WP-CB-OTHER',
  'and DETAIL names each repeated code once, compared after normalising'
);

select is(
  (select count(*)::integer from public.promo_codes p where p.code in ('WP-CB-DUP', 'WP-CB-OTHER')),
  0,
  'and nothing was created'
);

select throws_ok(
  $$select * from public.generate_checkout_coupons('{"kind":"fixed","amountFils":1000,"percent":null,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb, array['WP-CB-FRESH', 'wp-cb-two', 'WP-CB-ONE'])$$,
  'WP081', null,
  '[CLIENT coupon request 2026-09-12] a list containing codes that already exist is refused'
);

select is(
  pg_temp.coupon_refusal($$select * from public.generate_checkout_coupons('{"kind":"fixed","amountFils":1000,"percent":null,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb, array['WP-CB-FRESH', 'wp-cb-two', 'WP-CB-ONE'])$$),
  'WP081|WP-CB-ONE,WP-CB-TWO',
  'and DETAIL lists the conflicting codes, so only those need regenerating'
);

select is(
  (select count(*)::integer from public.promo_codes p where p.code = 'WP-CB-FRESH'),
  0,
  'and the free code in the same list was not created'
);

select throws_ok(
  $$select * from public.generate_checkout_coupons('{"kind":"fixed","amountFils":1000,"percent":null,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb, array(select 'WP-CB-X' || g from generate_series(1, 501) g))$$,
  'WP080', null,
  '501 codes in one call are refused'
);

select is(
  (select count(*)::integer
     from public.generate_checkout_coupons(
       '{"kind":"fixed","amountFils":1000,"percent":null,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb,
       array(select 'WP-CB-M' || g from generate_series(1, 500) g),
       'Largest batch',
       null)),
  500,
  'and exactly 500 are created'
);

select throws_ok(
  $$select * from public.generate_checkout_coupons('{"kind":"fixed","amountFils":1000,"percent":null,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb, array[]::text[])$$,
  'WP080', null,
  'an empty list is refused'
);

select throws_ok(
  $$select * from public.generate_checkout_coupons('{"kind":"fixed","amountFils":1000,"percent":null,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb, null)$$,
  'WP080', null,
  'as is a missing list'
);

select throws_ok(
  $$select * from public.generate_checkout_coupons('{"kind":"fixed","amountFils":1000,"percent":null,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb, array['WP-CB-NAMED'], repeat('B', 81))$$,
  'WP080', null,
  'a batch name longer than 80 characters is refused'
);

select throws_ok(
  $$select * from public.generate_checkout_coupons('{"kind":"fixed","amountFils":1000,"percent":null,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb, array['WP-CB-GOOD', 'NOT A CODE'])$$,
  '22023', null,
  '[§8] a code that is not three to forty upper-case alphanumerics in hyphen groups is refused by set_promo_code'
);

select is(
  (select count(*)::integer from public.promo_codes p where p.code = 'WP-CB-GOOD'),
  0,
  'and the valid code ahead of it was not kept, because the call is all or nothing'
);

select throws_ok(
  $$select * from public.generate_checkout_coupons('{"kind":"percent","amountFils":null,"percent":150,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb, array['WP-CB-PCT'])$$,
  '22023', null,
  'a template with a percentage above 100 is refused'
);

select throws_ok(
  $$select * from public.generate_checkout_coupons('{"kind":"addon_free","amountFils":null,"percent":null,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb, array['WP-CB-FREE'])$$,
  'WP047', null,
  'a free add-on template that names no add-on is refused'
);

select throws_ok(
  $$select * from public.generate_checkout_coupons('{"kind":"fixed","amountFils":1000,"percent":10,"addonIds":[],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb, array['WP-CB-BOTH'])$$,
  'WP046', null,
  'a template whose kind and value disagree is refused'
);

select throws_ok(
  $$select * from public.generate_checkout_coupons('{"kind":"fixed","amountFils":1000,"percent":null,"addonIds":[],"validFrom":"2041-05-01","validTo":"2041-04-01","maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb, array['WP-CB-DATES'])$$,
  '22023', null,
  'a template whose expiry is before its start is refused'
);

insert into cb (label, id, code, batch)
select 'robe' || g.n, g.promo_code_id, g.code, g.batch_id
  from public.generate_checkout_coupons(
    '{"kind":"addon_free","amountFils":null,"percent":null,"addonIds":["a9900000-0000-4000-8000-000000000001"],"validFrom":null,"validTo":null,"maxUses":null,"perCustomerLimit":null,"isCombinable":true,"isActive":true}'::jsonb,
    array['WP-CB-ROBE1', 'WP-CB-ROBE2'],
    'Robe week',
    'Robe promotion'
  ) with ordinality as g(promo_code_id, code, batch_id, n);

select is(
  (select count(*)::integer
     from cb
     join public.promo_code_addons pa on pa.promo_code_id = cb.id
    where cb.label like 'robe%'
      and pa.addon_id = 'a9900000-0000-4000-8000-000000000001'),
  2,
  '[§8] a free add-on batch targets the chosen add-on on every coupon'
);

reset role;

select throws_ok(
  $$insert into public.promo_codes (code, kind, amount_fils, batch_name) values ('WP-CB-ORPHAN', 'fixed', 1000, 'Orphan')$$,
  '23514', null,
  'a batch name cannot exist without a batch id'
);

select throws_ok(
  $$insert into public.promo_codes (code, kind, amount_fils, batch_id, batch_name) values ('WP-CB-PADDED', 'fixed', 1000, gen_random_uuid(), ' Padded ')$$,
  '23514', null,
  'and a stored batch name is trimmed'
);

insert into public.promo_code_redemptions (promo_code_id, booking_id, customer_id)
values ('e9900000-0000-4000-8000-000000000001', 'b9900000-0000-4000-8000-000000000001', 'c9900000-0000-4000-8000-0000000000c1');

update public.promo_codes set used_count = 1 where id = 'e9900000-0000-4000-8000-000000000001';

select is(
  (select r.code_snapshot from public.promo_code_redemptions r
    where r.promo_code_id = 'e9900000-0000-4000-8000-000000000001'
      and r.booking_id = 'b9900000-0000-4000-8000-000000000001'),
  'WP-CB-USED',
  '[CLIENT coupon request 2026-09-12] a redemption written without a snapshot, as every existing writer does, gets the coupon''s code'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9900000-0000-4000-8000-000000000001","email":"cb.manager@example.test"}';

select lives_ok(
  $$select public.save_checkout_coupon(
      '{"id":"e9900000-0000-4000-8000-000000000001","code":"wp-cb-renamed","kind":"fixed","amountFils":2500,"percent":null,"addonIds":[],"validFrom":null,"validTo":"2041-06-30","maxUses":10,"perCustomerLimit":null,"isCombinable":true,"isActive":true,"reason":"Coupon edited from the console"}'::jsonb,
      (select p.updated_at from public.promo_codes p where p.id = 'e9900000-0000-4000-8000-000000000001'))$$,
  '[CLIENT coupon request 2026-09-12] the manager can rename a used coupon and change its discount type'
);

select is(
  (select p.code || '|' || p.kind::text || '|' || p.amount_fils::text || '|' || coalesce(p.percent::text, 'none') || '|' || p.valid_to::text || '|' || p.used_count::text
     from public.promo_codes p where p.id = 'e9900000-0000-4000-8000-000000000001'),
  'WP-CB-RENAMED|fixed|2500|none|2041-06-30|1',
  'the new name, discount and expiry are saved and the usage count is untouched'
);

select is(
  (select r.code_snapshot from public.promo_code_redemptions r
    where r.promo_code_id = 'e9900000-0000-4000-8000-000000000001'
      and r.booking_id = 'b9900000-0000-4000-8000-000000000001'),
  'WP-CB-USED',
  '[§11.2] the redemption recorded before the rename keeps the code the guest used'
);

reset role;

select ok(
  exists (
    select 1 from audit.entries e
     where e.action = 'set_promo_code'
       and e.entity_id = 'e9900000-0000-4000-8000-000000000001'
       and e.old_value ->> 'code' = 'WP-CB-USED'
       and e.new_value ->> 'code' = 'WP-CB-RENAMED'
       and e.old_value ->> 'kind' = 'percent'
       and e.new_value ->> 'kind' = 'fixed'
       and e.actor_id = 'd9900000-0000-4000-8000-000000000001'),
  '[§3, INV-13] the rename is audited with the old and new code and discount type'
);

insert into public.promo_code_redemptions (promo_code_id, booking_id, customer_id)
values ('e9900000-0000-4000-8000-000000000001', 'b9900000-0000-4000-8000-000000000002', 'c9900000-0000-4000-8000-0000000000c1');

select is(
  (select r.code_snapshot from public.promo_code_redemptions r
    where r.promo_code_id = 'e9900000-0000-4000-8000-000000000001'
      and r.booking_id = 'b9900000-0000-4000-8000-000000000002'),
  'WP-CB-RENAMED',
  'a redemption after the rename records the new code'
);

update public.promo_codes set used_count = 3 where id = 'e9900000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9900000-0000-4000-8000-000000000001","email":"cb.manager@example.test"}';

select throws_ok(
  $$select public.save_checkout_coupon(
      '{"id":"e9900000-0000-4000-8000-000000000001","code":"WP-CB-RENAMED","kind":"fixed","amountFils":2500,"percent":null,"addonIds":[],"validFrom":null,"validTo":"2041-06-30","maxUses":2,"perCustomerLimit":null,"isCombinable":true,"isActive":true,"reason":"Coupon edited from the console"}'::jsonb,
      (select p.updated_at from public.promo_codes p where p.id = 'e9900000-0000-4000-8000-000000000001'))$$,
  'WP067', null,
  '[§8] the usage limit still cannot be set below the uses already redeemed'
);

select throws_ok(
  $$select public.save_checkout_coupon(
      '{"id":"e9900000-0000-4000-8000-000000000001","code":"WP-CB-RENAMED","kind":"fixed","amountFils":3000,"percent":null,"addonIds":[],"validFrom":null,"validTo":"2041-06-30","maxUses":10,"perCustomerLimit":null,"isCombinable":true,"isActive":true,"reason":"Coupon edited from the console"}'::jsonb,
      timestamptz '2000-01-01 00:00+00')$$,
  'WP067', null,
  'an edit made against a stale copy of the coupon is still refused'
);

select throws_ok(
  $$select public.save_checkout_coupon(
      '{"id":"e9900000-0000-4000-8000-000000000001","code":"WP-CB-ONE","kind":"fixed","amountFils":2500,"percent":null,"addonIds":[],"validFrom":null,"validTo":"2041-06-30","maxUses":10,"perCustomerLimit":null,"isCombinable":true,"isActive":true,"reason":"Coupon edited from the console"}'::jsonb,
      (select p.updated_at from public.promo_codes p where p.id = 'e9900000-0000-4000-8000-000000000001'))$$,
  '23505', null,
  'renaming a coupon to a code another coupon already uses is refused'
);

select lives_ok(
  $$select public.save_checkout_coupon(
      jsonb_build_object(
        'id', cb.id, 'code', 'wp-cb-two-b', 'kind', 'percent', 'amountFils', null, 'percent', 20,
        'addonIds', '[]'::jsonb, 'validFrom', '2041-01-01', 'validTo', '2041-09-30',
        'maxUses', 1, 'perCustomerLimit', 1, 'isCombinable', false, 'isActive', true,
        'reason', 'Coupon edited from the console'),
      p.updated_at)
      from cb join public.promo_codes p on p.id = cb.id
     where cb.label = 'gen2'$$,
  'a coupon from a batch can be edited on its own'
);

select ok(
  (select p.code = 'WP-CB-TWO-B' and p.percent = 20 and p.valid_to = date '2041-09-30'
          and p.batch_id = cb.batch and p.batch_name = 'Spring Brand'
     from cb join public.promo_codes p on p.id = cb.id
    where cb.label = 'gen2'),
  '[CLIENT coupon request 2026-09-12] and the edit keeps its batch id and batch name'
);

reset role;

select * from finish();
rollback;
