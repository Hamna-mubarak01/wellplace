begin;
select plan(61);

update public.suites set is_active = false;

insert into public.suites (suite_number, priority, status, is_active) values
  (9301, 9310, 'available', true),
  (9302, 9320, 'available', true);

insert into public.staff (id, email, full_name, role) values
  ('e1111111-1111-4111-8111-111111111111', 'pc.reception@example.test',  'PC Reception',  'reception'),
  ('e2222222-2222-4222-8222-222222222222', 'pc.management@example.test', 'PC Management', 'management');

insert into public.addons
  (id, name, regular_price_fils, offer_price_fils,
   default_quantity, min_quantity, max_quantity, sort_order)
values
  ('e4000000-0000-4000-8000-000000000001', 'PC Bathrobe', 6000, 4000, 1, 1, 2, 910),
  ('e4000000-0000-4000-8000-000000000002', 'PC Slippers', 3000, 3000, 2, 2, 4, 920);

insert into public.addons
  (id, name, regular_price_fils, offer_price_fils, is_active, sort_order)
values
  ('e4000000-0000-4000-8000-000000000003', 'PC Retired', 1000, 1000, false, 930);

insert into public.addons
  (id, name, regular_price_fils, offer_price_fils, inventory, sort_order)
values
  ('e4000000-0000-4000-8000-000000000004', 'PC Sold Out', 2000, 2000, 0, 940);

insert into public.addons
  (id, name, regular_price_fils, offer_price_fils,
   available_from, available_to, sort_order)
values
  ('e4000000-0000-4000-8000-000000000005', 'PC Next Season', 2000, 2000,
   current_date + 30, current_date + 60, 950);

insert into public.promo_codes (id, code, kind, amount_fils, max_uses) values
  ('e6000000-0000-4000-8000-000000000001', 'PCONCE', 'fixed', 1000, 1);

insert into public.promo_codes (id, code, kind) values
  ('e6000000-0000-4000-8000-000000000002', 'PCFREE',   'addon_free'),
  ('e6000000-0000-4000-8000-000000000003', 'PCGHOST',  'addon_free');

insert into public.promo_code_addons (promo_code_id, addon_id) values
  ('e6000000-0000-4000-8000-000000000002', 'e4000000-0000-4000-8000-000000000001'),
  ('e6000000-0000-4000-8000-000000000003', 'e4000000-0000-4000-8000-000000000003');

create temp table pc (label text primary key, id uuid);
grant all on pc to public;



select has_function('public', 'set_price_tier',
  'the §7 rate-card control exists as an audited RPC [R-02]');
select has_function('public', 'set_addon',
  'the §8 add-on control exists as an audited RPC [R-02]');
select has_function('public', 'set_promo_code',
  'the §8 voucher control exists as an audited RPC [R-02]');

select hasnt_column('public', 'addons', 'price_fils',
  'the deprecated generated mirror addons.price_fils is gone — offer_price_fils '
  'is the only name for what a guest is charged [§8]');

select is(
  (select pg_get_function_identity_arguments(p.oid) from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'create_reception_booking'),
  'p_source booking_source, p_salutation salutation, p_first_name text, '
  'p_last_name text, p_email text, p_date_of_birth date, p_phone_e164 text, '
  'p_phone_country text, p_starts_at timestamp with time zone, '
  'p_duration_hours integer, p_buffer_minutes integer, p_adults integer, '
  'p_child_ages integer[], p_addons jsonb, p_personal_request text, '
  'p_internal_note text, p_price jsonb, p_is_complimentary boolean, '
  'p_acceptance jsonb, p_reason text',
  'the twenty arguments and their NAMES survived the voucher rewrite — the '
  'code travels inside p_price and src/lib/db/rpc.ts does not change [R-02]');



set local role authenticated;
set local request.jwt.claims = '{"sub":"e1111111-1111-4111-8111-111111111111"}';

select throws_ok(
  $$select public.set_price_tier(
      null, 'pc-reception-tier', 'adult', 1, 2, 22000, 16500, null,
      null, null, null, null, null, 0, true, 'Trying it on')$$,
  '42501', null,
  'Reception cannot set a rate — §7 puts the pricing controls in Management '
  '[docs/5 §2, INV-15]');

select throws_ok(
  $$select public.set_addon(
      null, 'PC Reception Addon', null, null, 'rental', 5000, 5000, null,
      1, 1, 1, false, null, null, null, null, true, true, 100, 'Trying it on')$$,
  '42501', null,
  'Reception cannot create an add-on [§8, docs/5 §2]');

select throws_ok(
  $$select public.set_promo_code(
      null, 'PCRECEPTION', 'fixed', 5000, null, null, null, null,
      null, null, true, true, 'Trying it on')$$,
  '42501', null,
  'Reception cannot create a voucher code [§8, docs/5 §2]');

reset role;



set local role authenticated;
set local request.jwt.claims = '{"sub":"e2222222-2222-4222-8222-222222222222"}';

select throws_ok(
  $$select public.set_price_tier(
      null, 'pc-both', 'adult', 1, 2, 22000, 16500, 25,
      null, null, null, null, null, 0, true, 'Both offer forms')$$,
  'WP043', null,
  'a tier carrying BOTH an offer rate and a percentage is refused with a named '
  'code, not a raw 23514 [CLIENT §2]');

select throws_ok(
  $$select public.set_price_tier(
      null, 'pc-neither', 'adult', 1, 2, 22000, null, null,
      null, null, null, null, null, 0, true, 'Neither offer form')$$,
  'WP043', null,
  'and a tier carrying NEITHER is refused the same way — a tier with no offer '
  'is not something §2 describes');

select throws_ok(
  $$select public.set_price_tier(
      null, 'pc-no-reason', 'adult', 1, 2, 22000, 16500, null,
      null, null, null, null, null, 0, true, '   ')$$,
  '22023', null,
  'a rate change with no reason is refused — §7 requires it recorded in the '
  'audit log and a blank reason is not a record [INV-13]');

select throws_ok(
  $$select public.set_addon(
      null, 'PC Bad Range', null, null, 'rental', 5000, 5000, null,
      1, 3, 2, false, null, null, null, null, true, true, 100, 'Bad range')$$,
  'WP044', null,
  'an add-on whose minimum exceeds its maximum is refused [§8]');

select throws_ok(
  $$select public.set_addon(
      null, 'PC Backwards', null, null, 'rental', 1000, 5000, null,
      1, 1, 1, false, null, null, null, null, true, true, 100, 'Backwards')$$,
  'WP045', null,
  'a comparison price BELOW the offer price is refused — it would print a '
  'saving that runs backwards [§8]');

select throws_ok(
  $$select public.set_promo_code(
      null, 'PCMISMATCH', 'percent', 5000, null, null, null, null,
      null, null, true, true, 'Percent carrying an amount')$$,
  'WP046', null,
  'a percent code carrying an amount is refused — discountFor consults exactly '
  'one of the two fields [§8]');

select throws_ok(
  $$select public.set_promo_code(
      null, 'PCEMPTYFIXED', 'fixed', null, null, null, null, null,
      null, null, true, true, 'Fixed carrying nothing')$$,
  'WP046', null,
  'and a fixed code carrying no amount is refused for the same reason');

select throws_ok(
  $$select public.set_promo_code(
      null, 'PCNOTARGET', 'addon_free', null, null, null, null, null,
      null, null, true, true, 'Frees nothing')$$,
  'WP047', null,
  'an addon_free code that names no add-on is refused here rather than at the '
  'till as no_eligible_addon [§8]');

select throws_ok(
  $$select public.set_promo_code(
      null, 'PCGHOSTTARGET', 'addon_free', null, null,
      array['e4000000-0000-4000-8000-0000000000ff'::uuid],
      null, null, null, null, true, true, 'Targets nothing that exists')$$,
  'WP047', null,
  'and a code targeting an add-on that does not exist is refused [§8]');

insert into pc (label, id)
select 'tier', r.price_rule_id
  from public.set_price_tier(
    null, 'pc-launch-adult', 'adult', 1, 2, 22000, 16500, null,
    null, null, null, null, null, 5, true,
    'Launch adult rate for the first two hours') r;

insert into pc (label, id)
select 'addon', r.addon_id
  from public.set_addon(
    null, 'PC Managed Robe', 'A robe Management created', null, 'rental',
    9000, 7000, 'Save AED 20', 1, 1, 3, false, null, null, null,
    'Set out before arrival', true, true, 100,
    'Adding the robe to the launch catalogue') r;

insert into pc (label, id)
select 'promo', r.promo_code_id
  from public.set_promo_code(
    null, 'PCMANAGED', 'addon_free', null, null,
    array['e4000000-0000-4000-8000-000000000001'::uuid,
          'e4000000-0000-4000-8000-000000000002'::uuid],
    null, null, 25, 1, true, true,
    'A code that frees the robe and the slippers') r;

reset role;

select is(
  (select r.offer_fils_per_hour from public.price_rules r
    where r.id = (select id from pc where label = 'tier')),
  16500,
  'Management created a rate tier and it landed at AED 165 per adult hour '
  '[CLIENT §2]');

select is(
  (select count(*)::int from audit.entries e
    where e.action = 'set_price_tier'
      and e.entity = 'public.price_rules'
      and e.entity_id = (select id::text from pc where label = 'tier')
      and e.actor_id = 'e2222222-2222-4222-8222-222222222222'
      and e.old_value is null
      and e.new_value ->> 'offer_fils_per_hour' = '16500'
      and e.reason = 'Launch adult rate for the first two hours'),
  1,
  'and it wrote its OWN audit entry with the actor, the whole new row and the '
  'reason [R-14, INV-13]');

select is(
  (select a.max_quantity from public.addons a
    where a.id = (select id from pc where label = 'addon')),
  3,
  'Management created an add-on with its own quantity ceiling [§8]');

select is(
  (select count(*)::int from audit.entries e
    where e.action = 'set_addon'
      and e.entity = 'public.addons'
      and e.entity_id = (select id::text from pc where label = 'addon')
      and e.new_value ->> 'offer_price_fils' = '7000'),
  1,
  'and set_addon wrote its own audit entry [R-14]');

select is(
  (select count(*)::int from public.promo_code_addons pa
    where pa.promo_code_id = (select id from pc where label = 'promo')),
  2,
  'set_promo_code wrote the targeted add-ons in the SAME transaction as the '
  'code — a code that exists for a moment with no targets is redeemable '
  'against nothing [§8]');

select is(
  (select count(*)::int from audit.entries e
    where e.action = 'set_promo_code'
      and e.entity = 'public.promo_codes'
      and e.entity_id = (select id::text from pc where label = 'promo')
      and jsonb_array_length(e.new_value -> 'target_addon_ids') = 2),
  1,
  'and its audit entry carries the targeted add-ons, not only the code row '
  '[R-14]');

select is(
  (select p.used_count from public.promo_codes p
    where p.id = (select id from pc where label = 'promo')),
  0,
  'used_count is not an argument and starts at nought — only a redemption '
  'moves it [§8]');



select has_view('public', 'public_price_rules',
  'the guest widget has a rate card it can read with no session [§6.1]');
select has_view('public', 'public_addons',
  'and an add-on catalogue [§8, §6.1]');

select results_eq(
  $$select column_name::text collate "default"
      from information_schema.columns
     where table_schema = 'public' and table_name = 'public_price_rules'
     order by 1$$,
  array['from_hour', 'guest_kind', 'id', 'offer_fils_per_hour',
        'offer_percent', 'priority', 'regular_fils_per_hour',
        'season_from', 'season_to', 'start_from_minutes',
        'start_to_minutes', 'to_hour', 'weekdays'],
  'public_price_rules publishes the thirteen PriceTier fields and NOTHING '
  'else — no suite id, no suite number, no capacity, no is_active [INV-01]');

select results_eq(
  $$select column_name::text collate "default"
      from information_schema.columns
     where table_schema = 'public' and table_name = 'public_addons'
     order by 1$$,
  array['default_quantity', 'description', 'eligible_max_guests', 'eligible_max_hours',
        'eligible_min_guests', 'eligible_min_hours', 'id', 'image_path', 'is_locked',
        'is_sold_out', 'is_taxable', 'kind', 'max_quantity', 'min_quantity', 'name',
        'offer_price_fils', 'regular_price_fils', 'saving_label'],
  'public_addons publishes the card, VAT applicability and the guest and visit-length '
  'eligibility the widget checks — no inventory level, no reception_note, no suite id, '
  'no suite number, no capacity [§3, §8, INV-01]');

select ok(
  not exists (
    select 1 from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name in ('public_price_rules', 'public_addons')
       and (c.column_name::text like '%suite%'
            or c.column_name::text like '%capacity%')),
  'neither public view carries a column naming a suite or a capacity, asserted '
  'by pattern as well as by list [§3, INV-01]');



set local role anon;

select lives_ok(
  $$select * from public.public_price_rules$$,
  'a guest with no account actually reads the rate card, not merely holds the '
  'grant [§6.1]');

select lives_ok(
  $$select * from public.public_addons$$,
  'and reads the add-on catalogue [§8]');

select is(
  (select r.offer_fils_per_hour from public.public_price_rules r
    where r.guest_kind = 'adult' and r.from_hour = 1 and r.to_hour = 2
      and r.regular_fils_per_hour = 22000
    order by r.priority desc limit 1),
  16500,
  'and the rate it reads is the one Management set [CLIENT §2]');

select is(
  (select count(*)::int from public.public_addons a
    where a.id = 'e4000000-0000-4000-8000-000000000003'),
  0,
  'a switched-off add-on is absent from the public catalogue [§8]');

select is(
  (select count(*)::int from public.public_addons a
    where a.id = 'e4000000-0000-4000-8000-000000000005'),
  0,
  'and so is one outside its sales dates [§8]');

select is(
  (select a.is_sold_out from public.public_addons a
    where a.id = 'e4000000-0000-4000-8000-000000000004'),
  true,
  'but a SOLD-OUT add-on is still published, with is_sold_out derived from a '
  'stock level the guest never sees — §8 asks for the state, not the number');

select is(
  (select a.is_sold_out from public.public_addons a
    where a.id = 'e4000000-0000-4000-8000-000000000001'),
  false,
  'and a null inventory is unlimited rather than sold out [§8]');

select throws_ok(
  $$select * from public.promo_codes$$,
  '42501', null,
  'a guest with no account CANNOT read the voucher catalogue — a code list '
  'readable without a session is a code list that is scraped [§13]');

select throws_ok(
  $$select * from public.price_rules$$,
  '42501', null,
  'nor the raw rate card, including the seasonal bands the venue has not '
  'launched [§10.2]');

select throws_ok(
  $$select * from public.addons$$,
  '42501', null,
  'nor the raw add-on table, which carries the stock level and the Reception '
  'preparation note [§3, §8]');

select throws_ok(
  $$select * from public.promo_code_redemptions$$,
  '42501', null,
  'nor who has used which code [§13]');

select ok(
  not has_table_privilege('anon', 'public.public_addons', 'insert')
  and not has_table_privilege('anon', 'public.public_addons', 'update')
  and not has_table_privilege('anon', 'public.public_addons', 'delete'),
  'the public catalogue is readable and nothing else');

reset role;



set local role authenticated;
set local request.jwt.claims = '{"sub":"e1111111-1111-4111-8111-111111111111"}';

select throws_ok(
  $$select public.create_reception_booking(
      'walk_in', 'mr', 'Quantity', 'Ceiling', 'pc.ceiling@example.test',
      date '1990-01-01', '+971500003001', 'AE',
      timestamptz '2027-05-01 06:00:00+00', 2, 20, 2, null,
      '[{"addon_id":"e4000000-0000-4000-8000-000000000001","quantity":3}]'::jsonb,
      null, null, null, false, null, 'Over the ceiling')$$,
  'WP037', null,
  'a booking asking for three of an add-on capped at two is refused — §8 gives '
  'each item its own minimum and maximum');

select throws_ok(
  $$select public.create_reception_booking(
      'walk_in', 'mr', 'Quantity', 'Floor', 'pc.floor@example.test',
      date '1990-01-01', '+971500003002', 'AE',
      timestamptz '2027-05-01 06:00:00+00', 2, 20, 2, null,
      '[{"addon_id":"e4000000-0000-4000-8000-000000000002","quantity":1}]'::jsonb,
      null, null, null, false, null, 'Under the floor')$$,
  'WP037', null,
  'and one below the configured minimum is refused by the same rule [§8]');

select throws_ok(
  $$select public.create_reception_booking(
      'walk_in', 'mr', 'Retired', 'Item', 'pc.retired@example.test',
      date '1990-01-01', '+971500003003', 'AE',
      timestamptz '2027-05-01 06:00:00+00', 2, 20, 2, null,
      '[{"addon_id":"e4000000-0000-4000-8000-000000000003","quantity":1}]'::jsonb,
      null, null, null, false, null, 'Switched off')$$,
  'WP038', null,
  'a switched-off add-on cannot be sold at the desk either [§8]');

select throws_ok(
  $$select public.create_reception_booking(
      'walk_in', 'mr', 'Sold', 'Out', 'pc.soldout@example.test',
      date '1990-01-01', '+971500003020', 'AE',
      timestamptz '2027-05-01 06:00:00+00', 2, 20, 2, null,
      '[{"addon_id":"e4000000-0000-4000-8000-000000000004","quantity":1}]'::jsonb,
      null, null, null, false, null, 'Sold-out item')$$,
  'WP038', null,
  'a sold-out add-on is refused even when submitted directly to Reception booking [§8]');

select throws_ok(
  $$select public.create_reception_booking(
      'walk_in', 'mr', 'Unknown', 'Code', 'pc.unknown@example.test',
      date '1990-01-01', '+971500003004', 'AE',
      timestamptz '2027-05-01 06:00:00+00', 2, 20, 2, null, null,
      null, null,
      '{"total_fils":66000,"voucher_code":"PCNOSUCHCODE"}'::jsonb,
      false, null, 'Unknown code')$$,
  'WP039', null,
  'a voucher code the venue does not carry is refused [§8]');

select throws_ok(
  $$select public.create_reception_booking(
      'walk_in', 'mr', 'Ghost', 'Target', 'pc.ghost@example.test',
      date '1990-01-01', '+971500003005', 'AE',
      timestamptz '2027-05-01 06:00:00+00', 2, 20, 2, null, null,
      null, null,
      '{"total_fils":66000,"voucher_code":"PCGHOST"}'::jsonb,
      false, null, 'Frees only a retired item')$$,
  'WP042', null,
  'and one whose only target is switched off applies to nothing, which '
  'checkVoucher calls no_eligible_addon [§8]');

insert into pc (label, id)
select 'voucher_booking', r.booking_id
  from public.create_reception_booking(
    'walk_in', 'ms', 'Vera', 'Voucher', 'pc.voucher@example.test',
    date '1990-01-01', '+971500003010', 'AE',
    timestamptz '2027-05-02 06:00:00+00', 2, 20, 2, null,
    '[{"addon_id":"e4000000-0000-4000-8000-000000000001","quantity":1}]'::jsonb,
    null, null,
    '{"subtotal_fils":66000,"addons_fils":0,"total_fils":66000,"voucher_code":"PCFREE"}'::jsonb,
    false, null, 'Voucher booking') r;

insert into pc (label, id)
select 'autoadd_booking', r.booking_id
  from public.create_reception_booking(
    'walk_in', 'ms', 'Auto', 'Added', 'pc.autoadd@example.test',
    date '1990-01-01', '+971500003011', 'AE',
    timestamptz '2027-05-03 06:00:00+00', 2, 20, 2, null, '[]'::jsonb,
    null, null,
    '{"subtotal_fils":66000,"total_fils":66000,"voucher_code":"PCFREE"}'::jsonb,
    false, null, 'Voucher with an empty cart') r;

insert into pc (label, id)
select 'once_booking', r.booking_id
  from public.create_reception_booking(
    'walk_in', 'mr', 'Only', 'Once', 'pc.once@example.test',
    date '1990-01-01', '+971500003012', 'AE',
    timestamptz '2027-05-04 06:00:00+00', 2, 20, 2, null, null,
    null, null,
    '{"subtotal_fils":66000,"discount_fils":1000,"total_fils":65000,"voucher_code":"PCONCE"}'::jsonb,
    false, null, 'The single permitted use') r;

insert into pc (label, id)
select 'limit_booking', r.booking_id
  from public.create_reception_booking(
    'walk_in', 'mr', 'Per', 'Customer', 'pc.limit@example.test',
    date '1990-01-01', '+971500003014', 'AE',
    timestamptz '2027-05-06 06:00:00+00', 2, 20, 2, null, '[]'::jsonb,
    null, null,
    '{"subtotal_fils":66000,"total_fils":66000,"voucher_code":"PCMANAGED"}'::jsonb,
    false, null, 'The one use this guest is allowed') r;

select throws_ok(
  $$select public.create_reception_booking(
      'walk_in', 'mr', 'Per', 'Customer', 'pc.limit@example.test',
      date '1990-01-01', '+971500003014', 'AE',
      timestamptz '2027-05-07 06:00:00+00', 2, 20, 2, null, '[]'::jsonb,
      null, null,
      '{"subtotal_fils":66000,"total_fils":66000,"voucher_code":"PCMANAGED"}'::jsonb,
      false, null, 'The same guest, a second time')$$,
  'WP041', null,
  'the per-customer limit is counted from the redemption rows against the '
  'customer record, not against an email string, because Q-1 leaves the '
  'identity key unsettled [§8]');

select throws_ok(
  $$select public.create_reception_booking(
      'walk_in', 'mr', 'Second', 'Use', 'pc.second@example.test',
      date '1990-01-01', '+971500003013', 'AE',
      timestamptz '2027-05-05 06:00:00+00', 2, 20, 2, null, null,
      null, null,
      '{"subtotal_fils":66000,"discount_fils":1000,"total_fils":65000,"voucher_code":"PCONCE"}'::jsonb,
      false, null, 'One use too many')$$,
  'WP040', null,
  'the second use of a code capped at one is refused — the limit is a rule '
  'rather than decoration because the redemption and the counter move in the '
  'same transaction [§8]');

reset role;

select is(
  (select count(*)::int from public.promo_code_redemptions x
    where x.promo_code_id = 'e6000000-0000-4000-8000-000000000001'
      and x.booking_id = (select id from pc where label = 'once_booking')),
  1,
  'the accepted booking wrote its redemption row [§8]');

select is(
  (select p.used_count from public.promo_codes p
    where p.id = 'e6000000-0000-4000-8000-000000000001'),
  1,
  'and moved used_count in the same transaction — that is what makes max_uses '
  'enforceable [§8]');

select is(
  (select count(*)::int from audit.entries e
    where e.action = 'redeem_promo_code'
      and e.entity = 'public.promo_codes'
      and e.entity_id = 'e6000000-0000-4000-8000-000000000001'
      and e.old_value ->> 'used_count' = '0'
      and e.new_value ->> 'used_count' = '1'),
  1,
  'and the redemption is audited with the counter before and after [R-14]');

select is(
  (select count(*)::int from public.promo_code_redemptions x
    where x.promo_code_id = 'e6000000-0000-4000-8000-000000000001'),
  1,
  'the refused second attempt left NO redemption behind — one transaction '
  '[R-14]');

select is(
  (select ba.unit_price_fils from public.booking_addons ba
    where ba.booking_id = (select id from pc where label = 'voucher_booking')),
  0,
  'the voucher reduced the targeted add-on line to AED 0 [§8]');

select is(
  (select ba.regular_price_fils from public.booking_addons ba
    where ba.booking_id = (select id from pc where label = 'voucher_booking')),
  6000,
  'while the comparison price is snapshotted onto the line, so §11.2 can say '
  'what the item was worth without asking today''s catalogue [INV-21]');

select is(
  (select ba.voucher_code from public.booking_addons ba
    where ba.booking_id = (select id from pc where label = 'voucher_booking')),
  'PCFREE',
  'and the line records WHICH code reduced it — a towel free because the '
  'catalogue says so and one free because a code said so are different facts '
  '[§11.2]');

select is(
  (select ba.is_included from public.booking_addons ba
    where ba.booking_id = (select id from pc where label = 'voucher_booking')),
  true,
  'the line is flagged as given rather than bought [§8, §11.2]');

select is(
  (select ba.name_snapshot from public.booking_addons ba
    where ba.booking_id = (select id from pc where label = 'autoadd_booking')),
  'PC Bathrobe',
  'an addon_free code adds its target to a cart that did not contain it, at '
  'the configured default quantity [§8]');

select is(
  (select ba.quantity from public.booking_addons ba
    where ba.booking_id = (select id from pc where label = 'autoadd_booking')),
  1,
  'and that quantity is the add-on''s own default, never anything derived '
  'from the guest count [§8]');

select is(
  (select count(*)::int from public.booking_addons ba
    where ba.booking_id = (select id from pc where label = 'once_booking')),
  0,
  'a fixed code adds no add-on line at all — it reduces the booking price, '
  'which arrives already computed in p_price [INV-21]');

select is(
  (select e.new_value ->> 'voucher_code' from audit.entries e
    where e.action = 'create_reception_booking'
      and e.entity_id = (select id::text from pc where label = 'voucher_booking')),
  'PCFREE',
  'and the booking audit entry names the code that was applied [INV-13]');


select * from finish();
rollback;
