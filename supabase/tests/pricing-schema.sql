begin;
select plan(61);

insert into public.staff (id, email, full_name, role) values
  ('c1111111-1111-4111-8111-111111111111', 'pr.reception@example.test',  'PR Reception',  'reception'),
  ('c2222222-2222-4222-8222-222222222222', 'pr.management@example.test', 'PR Management', 'management');

insert into public.customers
  (id, first_name, last_name, email, phone_e164, phone_country, date_of_birth)
values
  ('c0000000-0000-4000-8000-000000000001', 'Price', 'Guest',
   'price.guest@example.test', '+971500002001', 'AE', date '1990-01-01'),
  ('c0000000-0000-4000-8000-000000000002', 'Second', 'Guest',
   'price.second@example.test', '+971500002002', 'AE', date '1990-01-01');

insert into public.bookings
  (id, reference, customer_id, source, status, experience_period,
   cleaning_buffer_minutes)
values
  ('c9000000-0000-4000-8000-000000000001', 'WPPRICE1',
   'c0000000-0000-4000-8000-000000000001', 'online', 'confirmed',
   tstzrange(timestamptz '2027-04-01 09:00+04',
             timestamptz '2027-04-01 12:00+04', '[)'), 20),
  ('c9000000-0000-4000-8000-000000000002', 'WPPRICE2',
   'c0000000-0000-4000-8000-000000000001', 'online', 'confirmed',
   tstzrange(timestamptz '2027-04-02 09:00+04',
             timestamptz '2027-04-02 12:00+04', '[)'), 20),
  ('c9000000-0000-4000-8000-000000000003', 'WPPRICE3',
   'c0000000-0000-4000-8000-000000000002', 'online', 'confirmed',
   tstzrange(timestamptz '2027-04-03 09:00+04',
             timestamptz '2027-04-03 12:00+04', '[)'), 20);

select has_table('public', 'price_rules',
  'the hourly rate card exists [CLIENT §2, §7]');
select has_table('public', 'promo_codes',
  'voucher codes exist [§8, §10.4]');
select has_table('public', 'promo_code_addons',
  'a code can target specific add-ons [§8]');
select has_table('public', 'promo_code_redemptions',
  'every use of a code is recorded [§8]');

select is(
  (select relrowsecurity from pg_class where oid = 'public.price_rules'::regclass),
  true, 'RLS is enabled on price_rules [R-13]');
select is(
  (select relrowsecurity from pg_class where oid = 'public.promo_codes'::regclass),
  true, 'RLS is enabled on promo_codes [R-13]');
select is(
  (select relrowsecurity from pg_class where oid = 'public.promo_code_addons'::regclass),
  true, 'RLS is enabled on promo_code_addons [R-13]');
select is(
  (select relrowsecurity from pg_class where oid = 'public.promo_code_redemptions'::regclass),
  true, 'RLS is enabled on promo_code_redemptions [R-13]');

select is(
  (select array_agg(e.enumlabel::text order by e.enumsortorder)
     from pg_enum e where e.enumtypid = 'public.guest_price_kind'::regtype),
  array['adult','child'],
  'guest_price_kind carries the two §2 rate cards');

select is(
  (select array_agg(e.enumlabel::text order by e.enumsortorder)
     from pg_enum e where e.enumtypid = 'public.addon_kind'::regtype),
  array['rental','consumable','per_person','per_booking'],
  'addon_kind carries the four §8 item types');

select is(
  (select array_agg(e.enumlabel::text order by e.enumsortorder)
     from pg_enum e where e.enumtypid = 'public.promo_kind'::regtype),
  array['fixed','percent','addon_free'],
  'promo_kind is character-identical to VoucherKind in src/lib/domain/vouchers');

select is(
  (select count(*)::int from public.price_rules),
  4,
  'the four launch tiers are seeded [CLIENT §2]');

select is(
  (select r.guest_kind::text || '/' || r.from_hour::text || '/' ||
          coalesce(r.to_hour::text, 'open') || '/' ||
          r.regular_fils_per_hour::text || '/' ||
          coalesce(r.offer_fils_per_hour::text, 'null') || '/' ||
          coalesce(r.offer_percent::text, 'null')
     from public.price_rules r where r.code = 'adult-first-two'),
  'adult/1/2/22000/16500/null',
  'adult hours 1-2: AED 220 regular against AED 165, exactly as '
  'LAUNCH_PRICE_TIERS states [CLIENT §2]');

select is(
  (select r.guest_kind::text || '/' || r.from_hour::text || '/' ||
          coalesce(r.to_hour::text, 'open') || '/' ||
          r.regular_fils_per_hour::text || '/' ||
          coalesce(r.offer_fils_per_hour::text, 'null') || '/' ||
          coalesce(r.offer_percent::text, 'null')
     from public.price_rules r where r.code = 'adult-additional'),
  'adult/3/open/22000/14000/null',
  'adult hours 3 onward: AED 140 the additional hour, open-ended [CLIENT §2]');

select is(
  (select r.guest_kind::text || '/' || r.from_hour::text || '/' ||
          coalesce(r.to_hour::text, 'open') || '/' ||
          r.regular_fils_per_hour::text || '/' ||
          coalesce(r.offer_fils_per_hour::text, 'null') || '/' ||
          coalesce(r.offer_percent::text, 'null')
     from public.price_rules r where r.code = 'child-first-two'),
  'child/1/2/17000/12750/null',
  'child hours 1-2: AED 170 regular against AED 127.50 [CLIENT §2]');

select is(
  (select r.guest_kind::text || '/' || r.from_hour::text || '/' ||
          coalesce(r.to_hour::text, 'open') || '/' ||
          r.regular_fils_per_hour::text || '/' ||
          coalesce(r.offer_fils_per_hour::text, 'null') || '/' ||
          coalesce(r.offer_percent::text, 'null')
     from public.price_rules r where r.code = 'child-additional'),
  'child/3/open/17000/11000/null',
  'child hours 3 onward: AED 110 the additional hour, open-ended [CLIENT §2]');

select is(
  (select (2 * r.offer_fils_per_hour)
     from public.price_rules r where r.code = 'adult-first-two'),
  33000,
  'two adult hours come to AED 330, so §4''s minimum two-adult booking is AED 660');

select ok(
  (select bool_and(r.weekdays is null and r.season_from is null
               and r.season_to is null and r.start_from_minutes is null
               and r.start_to_minutes is null)
     from public.price_rules r),
  '§7''s weekday, seasonal and time-of-day columns exist and are null at launch — '
  '§1 fixes one price on every weekday and at every time of day');

select throws_ok(
  $$insert into public.price_rules
      (guest_kind, from_hour, regular_fils_per_hour,
       offer_fils_per_hour, offer_percent)
    values ('adult', 1, 22000, 16500, 25.00)$$,
  '23514', null,
  'a tier carrying BOTH an absolute offer rate and a percentage is refused '
  '[CLIENT §2]');

select throws_ok(
  $$insert into public.price_rules
      (guest_kind, from_hour, regular_fils_per_hour)
    values ('adult', 1, 22000)$$,
  '23514', null,
  'a tier carrying NEITHER an absolute offer rate nor a percentage is refused '
  '[CLIENT §2]');

select lives_ok(
  $$insert into public.price_rules
      (code, guest_kind, from_hour, to_hour, regular_fils_per_hour, offer_percent)
    values ('percent-form', 'adult', 1, 2, 17000, 25.00)$$,
  'a tier expressed as a percentage off is accepted — §2 allows either form');

select throws_ok(
  $$insert into public.price_rules
      (guest_kind, from_hour, regular_fils_per_hour, offer_fils_per_hour)
    values ('adult', 0, 22000, 16500)$$,
  '23514', null,
  'an hour band starting before hour 1 is refused');

select throws_ok(
  $$insert into public.price_rules
      (guest_kind, from_hour, to_hour, regular_fils_per_hour, offer_fils_per_hour)
    values ('adult', 4, 2, 22000, 16500)$$,
  '23514', null,
  'an hour band that ends before it starts is refused');

select throws_ok(
  $$insert into public.price_rules
      (guest_kind, from_hour, regular_fils_per_hour, offer_fils_per_hour, weekdays)
    values ('adult', 1, 22000, 16500, array[7])$$,
  '23514', null,
  'a weekday outside 0-6 is refused, so the §7 variation columns cannot store a '
  'convention the engine does not read');

select throws_ok(
  $$insert into public.price_rules
      (guest_kind, from_hour, regular_fils_per_hour, offer_fils_per_hour,
       start_from_minutes)
    values ('adult', 1, 22000, 16500, 600)$$,
  '23514', null,
  'half a start window is refused — both bounds or neither');

select is(
  (select count(*)::int from public.addons where offer_price_fils = 0),
  2,
  'the two §8 placeholder add-ons are seeded at AED 0');

select is(
  (select a.name || '/' || a.regular_price_fils::text || '/' ||
          a.offer_price_fils::text || '/' || a.default_quantity::text || '/' ||
          a.min_quantity::text || '/' || a.max_quantity::text || '/' ||
          a.kind::text || '/' || a.is_locked::text
     from public.addons a where a.name = 'Towel rental'),
  'Towel rental/2500/0/1/1/3/rental/false',
  'towel rental: comparison price struck through, AED 0 charged, default 1, '
  'guest-adjustable, removable [§8]');

select is(
  (select a.name || '/' || a.regular_price_fils::text || '/' ||
          a.offer_price_fils::text || '/' || a.default_quantity::text || '/' ||
          a.min_quantity::text || '/' || a.max_quantity::text || '/' ||
          a.kind::text || '/' || a.is_locked::text
     from public.addons a where a.name = 'Bathrobe rental'),
  'Bathrobe rental/5000/0/1/1/3/rental/false',
  'bathrobe rental: same shape — AED 0 is the automatic-inclusion trigger, with '
  'no separate auto-add switch [§8]');

select is(
  (select count(*)::int from public.addons
    where offer_price_fils = 0 and saving_label is not null),
  0,
  'no saving label sits beside an AED 0 item — §8 forbids one');

select throws_ok(
  $$insert into public.addons
      (name, regular_price_fils, offer_price_fils,
       min_quantity, default_quantity, max_quantity)
    values ('Bad floor', 4000, 4000, 3, 1, 5)$$,
  '23514', null,
  'a default quantity below the minimum is refused [§8]');

select throws_ok(
  $$insert into public.addons
      (name, regular_price_fils, offer_price_fils,
       min_quantity, default_quantity, max_quantity)
    values ('Bad ceiling', 4000, 4000, 1, 4, 2)$$,
  '23514', null,
  'a default quantity above the maximum is refused [§8]');

select throws_ok(
  $$insert into public.addons
      (name, regular_price_fils, offer_price_fils,
       min_quantity, default_quantity, max_quantity)
    values ('Zero floor', 4000, 4000, 0, 0, 2)$$,
  '23514', null,
  'a quantity of zero is refused — a line the guest does not want is absent, '
  'not present at nought [§8]');

select lives_ok(
  $$insert into public.addons
      (id, name, regular_price_fils, offer_price_fils,
       min_quantity, default_quantity, max_quantity, saving_label)
    values ('c4000000-0000-4000-8000-000000000001', 'Paid extra',
            9000, 6000, 1, 1, 4, 'Save AED 30')$$,
  'a paid add-on carries a comparison price, an offer price and a saving label '
  '[§8]');

select throws_ok(
  $$insert into public.addons (name, regular_price_fils, offer_price_fils)
    values ('Upside down', 1000, 4000)$$,
  '23514', null,
  'a comparison price below the price charged is refused — that is not a '
  'comparison [§8]');

select throws_ok(
  $$insert into public.promo_codes (code, kind, percent)
    values ('WPFIXEDNOVALUE', 'fixed', 10.00)$$,
  '23514', null,
  'a fixed code carrying a percentage is refused [§8]');

select throws_ok(
  $$insert into public.promo_codes (code, kind, amount_fils)
    values ('WPPERCENTBAD', 'percent', 5000)$$,
  '23514', null,
  'a percentage code carrying an absolute value is refused [§8]');

select throws_ok(
  $$insert into public.promo_codes (code, kind)
    values ('WPFIXEDEMPTY', 'fixed')$$,
  '23514', null,
  'a fixed code with no value at all is refused [§8]');

select throws_ok(
  $$insert into public.promo_codes (code, kind, amount_fils)
    values ('WPFREEBAD', 'addon_free', 5000)$$,
  '23514', null,
  'an add-on code carrying a discount value is refused — it sets a price to '
  'zero, it does not reduce one [§8]');

select throws_ok(
  $$insert into public.promo_codes (code, kind, amount_fils)
    values ('wplower', 'fixed', 5000)$$,
  '23514', null,
  'a lower-case code is refused, so the unique index is the whole of the '
  'duplicate rule');

select lives_ok(
  $$insert into public.promo_codes
      (id, code, kind, max_uses, per_customer_limit)
    values ('c5000000-0000-4000-8000-000000000001', 'FREE-ROBE', 'addon_free',
            2, 1)$$,
  'an add-on code carries limits and no value [§8]');

select lives_ok(
  $$insert into public.promo_code_addons (promo_code_id, addon_id)
    values ('c5000000-0000-4000-8000-000000000001',
            (select id from public.addons where name = 'Bathrobe rental'))$$,
  'a code targets a specific add-on [§8]');

select lives_ok(
  $$insert into public.promo_code_redemptions
      (promo_code_id, booking_id, customer_id)
    values ('c5000000-0000-4000-8000-000000000001',
            'c9000000-0000-4000-8000-000000000001',
            'c0000000-0000-4000-8000-000000000001')$$,
  'a redemption is recorded against the booking that used it [§8]');

select throws_ok(
  $$with unlimited as (
      insert into public.promo_codes (code, kind, amount_fils)
      values ('WPNOLIMIT', 'fixed', 1000)
      returning id)
    insert into public.promo_code_redemptions
      (promo_code_id, booking_id, customer_id)
    select unlimited.id,
           'c9000000-0000-4000-8000-000000000001',
           'c0000000-0000-4000-8000-000000000001'
      from unlimited cross join generate_series(1, 2)$$,
  '23505', null,
  'the same code cannot be redeemed twice against one booking — a retried '
  'checkout or a replayed webhook cannot spend it again. Proved on a code with '
  'no usage limit, so the unique constraint and not the coupon guard refuses it '
  '[§8, INV-09]');

select throws_ok(
  $$insert into public.promo_code_redemptions
      (promo_code_id, booking_id, customer_id)
    values ('c5000000-0000-4000-8000-000000000001',
            'c9000000-0000-4000-8000-000000000002',
            'c0000000-0000-4000-8000-000000000001')$$,
  'WP064', null,
  'the same customer cannot redeem a per_customer_limit=1 code on a second '
  'booking — guard_coupon_reservation refuses it at the table [CLIENT pricing '
  'specification §8: usage limits]');

select lives_ok(
  $$insert into public.promo_code_redemptions
      (promo_code_id, booking_id, customer_id)
    values ('c5000000-0000-4000-8000-000000000001',
            'c9000000-0000-4000-8000-000000000003',
            'c0000000-0000-4000-8000-000000000002')$$,
  'the same code on a second customer''s booking is a second redemption, which '
  'is what makes max_uses countable [§8]');

select lives_ok(
  $$insert into public.booking_addons
      (booking_id, addon_id, name_snapshot, unit_price_fils,
       regular_price_fils, quantity, is_included, is_locked, voucher_code)
    values ('c9000000-0000-4000-8000-000000000001',
            (select id from public.addons where name = 'Bathrobe rental'),
            'Bathrobe rental', 0, 5000, 1, true, false, 'FREE-ROBE')$$,
  'a sold line snapshots the comparison price, whether it was included and the '
  'code that freed it [§11.2, INV-21]');

select is(
  (select g.is_included::text || '/' || g.regular_price_fils::text || '/' ||
          g.line_total_fils::text || '/' || coalesce(g.voucher_code, 'none')
     from public.booking_addons g
    where g.booking_id = 'c9000000-0000-4000-8000-000000000001'),
  'true/5000/0/FREE-ROBE',
  'reporting tells an included item from a purchased one without recomputing '
  'anything [§11.2, INV-21]');

set local role authenticated;
set local request.jwt.claims = '{"sub":"c1111111-1111-4111-8111-111111111111"}';

select is(
  (select count(*)::int from public.price_rules),
  5,
  'reception: reads the rate card, because §9.2 has it quoting walk-in totals');

select is(
  (select count(*)::int from public.promo_codes),
  1,
  'reception: reads voucher codes, because a guest arrives at the desk holding one');

select is(
  (select count(*)::int from public.promo_code_addons),
  1,
  'reception: reads which add-ons a code targets [§8]');

select is(
  (select count(*)::int from public.promo_code_redemptions),
  2,
  'reception: reads redemptions, so it can say why a code was refused [§8]');

select throws_ok(
  $$insert into public.price_rules
      (guest_kind, from_hour, regular_fils_per_hour, offer_fils_per_hour)
    values ('adult', 1, 100, 50)$$,
  '42501', null,
  'reception: CANNOT configure prices — docs/5 §3 gives that to Management '
  'alone, through an audited RPC [R-02, R-14]');

select throws_ok(
  $$update public.price_rules set offer_fils_per_hour = 1
     where code = 'adult-first-two'$$,
  '42501', null,
  'reception: CANNOT retune a rate [§10.4, docs/5 §3]');

select throws_ok(
  $$insert into public.promo_codes (code, kind, amount_fils)
    values ('WPSNEAK', 'fixed', 100000)$$,
  '42501', null,
  'reception: CANNOT mint a voucher code [§10.4, docs/5 §3]');

select throws_ok(
  $$update public.promo_codes set used_count = 0 where code = 'FREE-ROBE'$$,
  '42501', null,
  'reception: CANNOT reset a usage counter — a limit a session can rewrite is '
  'decorative [§8]');

select throws_ok(
  $$delete from public.promo_code_redemptions$$,
  '42501', null,
  'reception: CANNOT erase a redemption [§8, §10.6]');

set local request.jwt.claims = '{"sub":"c2222222-2222-4222-8222-222222222222"}';

select throws_ok(
  $$update public.price_rules set offer_fils_per_hour = 1
     where code = 'adult-first-two'$$,
  '42501', null,
  'management: configures prices through an audited RPC, not a table write — §7 '
  'requires every rate change recorded in the audit log [R-02, R-14, INV-13]');

reset role;
set local role anon;

select throws_ok($$select * from public.price_rules$$, '42501', null,
  'anon: CANNOT read the rate card — guest pricing comes through a dedicated '
  'public view, not by widening this grant [§13, INV-01]');
select throws_ok($$select * from public.promo_codes$$, '42501', null,
  'anon: CANNOT read voucher codes, which would be a code list to scrape [§13]');
select throws_ok($$select * from public.promo_code_addons$$, '42501', null,
  'anon: CANNOT read what a code targets [§13]');
select throws_ok($$select * from public.promo_code_redemptions$$, '42501', null,
  'anon: CANNOT read who used a code [§13]');

reset role;
select * from finish();
rollback;
