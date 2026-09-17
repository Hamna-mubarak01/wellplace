
begin;
select plan(77);

insert into public.staff (id, email, full_name, role) values
  ('b1111111-1111-4111-8111-111111111111', 'bk.reception@example.test',  'BK Reception',  'reception'),
  ('b2222222-2222-4222-8222-222222222222', 'bk.management@example.test', 'BK Management', 'management');

insert into public.customers
  (id, first_name, last_name, email, phone_e164, phone_country, date_of_birth)
values
  ('b0000000-0000-4000-8000-000000000001', 'Book', 'Customer',
   'book.customer@example.test', '+971500001001', 'AE', date '1990-01-01');

select has_table('public', 'bookings',           'the booking exists [§6, §7, §11]');
select has_table('public', 'booking_guests',     'per-guest rows exist [§6.2]');
select has_table('public', 'addons',             'add-ons are configuration [§10.4]');
select has_table('public', 'booking_addons',     'add-on lines are snapshotted [§10.4, §11.2]');
select has_table('public', 'acceptance_records', 'acceptance is recorded [§6.3]');

select is(
  (select relrowsecurity from pg_class where oid = 'public.bookings'::regclass),
  true, 'RLS is enabled on bookings [R-13]');
select is(
  (select relrowsecurity from pg_class where oid = 'public.booking_guests'::regclass),
  true, 'RLS is enabled on booking_guests [R-13]');
select is(
  (select relrowsecurity from pg_class where oid = 'public.addons'::regclass),
  true, 'RLS is enabled on addons [R-13]');
select is(
  (select relrowsecurity from pg_class where oid = 'public.booking_addons'::regclass),
  true, 'RLS is enabled on booking_addons [R-13]');
select is(
  (select relrowsecurity from pg_class where oid = 'public.acceptance_records'::regclass),
  true, 'RLS is enabled on acceptance_records [R-13]');

select is(
  (select array_agg(e.enumlabel::text order by e.enumsortorder)
     from pg_enum e where e.enumtypid = 'public.booking_status'::regtype),
  array['draft','held','awaiting_payment','payment_failed','hold_expired',
        'awaiting_recovery','confirmed','checked_in','completed','rescheduled',
        'cancelled','no_show','abandoned'],
  'booking_status is character-identical to BOOKING_STATUSES in src/lib/domain/booking');

select is(
  (select array_agg(e.enumlabel::text order by e.enumsortorder)
     from pg_enum e where e.enumtypid = 'public.booking_source'::regtype),
  array['online','walk_in','telephone','manual','complimentary'],
  'booking_source carries the four §9.2 creation types plus online');

select is(
  (select array_agg(e.enumlabel::text order by e.enumsortorder)
     from pg_enum e where e.enumtypid = 'public.guest_kind'::regtype),
  array['adult','child'],
  'guest_kind is adult or child [§6.2]');

select ok(
  exists (select 1 from pg_enum e
           where e.enumtypid = 'public.consent_origin'::regtype
             and e.enumlabel = 'booking_form'),
  'consent_origin carries booking_form, because acceptance now lands with a booking [§6.3]');

select col_not_null('public', 'bookings', 'cleaning_buffer_minutes',
  'the cleaning buffer is stored on the booking, never read back from settings [§7.1]');
select col_is_null('public', 'bookings', 'suite_id',
  'suite_id may be null — paid with no suite secured is a real state [§8.2]');
select col_is_null('public', 'bookings', 'occupancy_id',
  'occupancy_id may be null for the same §8.2 reason');

select has_column('public', 'bookings', 'arrived_at',
  'arrival is its own field [§9.2]');
select has_column('public', 'bookings', 'checked_in_at',
  'check-in is its own field [§9.2]');
select has_column('public', 'bookings', 'checked_out_at',
  'check-out is its own field [§9.2]');

select has_column('public', 'suite_occupancy', 'booking_id',
  'an occupancy row resolves to its booking [§9.1]');
select has_column('public', 'suite_occupancy', 'reason',
  'a block carries a reason [§9.2]');
select has_column('public', 'suite_occupancy', 'created_by',
  'an occupancy row records who created it [§9.2, INV-13]');

select lives_ok(
  $$insert into public.bookings
      (id, reference, customer_id, source, status,
       experience_period, cleaning_buffer_minutes)
    values ('b1000000-0000-4000-8000-000000000001', 'WPA1B2C3',
            'b0000000-0000-4000-8000-000000000001', 'online', 'awaiting_recovery',
            tstzrange(timestamptz '2026-10-01 09:00+04',
                      timestamptz '2026-10-01 11:00+04', '[)'),
            20)$$,
  'a paid guest with no suite is representable [§8.2, INV-11]');

select is(
  (select suite_id from public.bookings
    where id = 'b1000000-0000-4000-8000-000000000001'),
  null,
  'that booking genuinely holds no suite [§8.2]');

select is(
  (select cleaning_buffer_minutes from public.bookings
    where id = 'b1000000-0000-4000-8000-000000000001'),
  20,
  'the buffer the booking was sold with is stored on the row [§7.1, INV-06]');

select throws_ok(
  $$insert into public.bookings
      (reference, customer_id, source, status, experience_period)
    values ('WPNOBUF1', 'b0000000-0000-4000-8000-000000000001', 'online', 'held',
            tstzrange(timestamptz '2026-10-02 09:00+04',
                      timestamptz '2026-10-02 11:00+04', '[)'))$$,
  '23502', null,
  'a booking without a stored cleaning buffer is refused [§7.1]');

select throws_ok(
  $$insert into public.bookings
      (reference, customer_id, source, status, experience_period,
       cleaning_buffer_minutes)
    values ('wpa1b2c3', 'b0000000-0000-4000-8000-000000000001', 'online', 'held',
            tstzrange(timestamptz '2026-10-02 09:00+04',
                      timestamptz '2026-10-02 11:00+04', '[)'), 20)$$,
  '23514', null,
  'a lower-case reference is refused, so the search key cannot case-fork [§9.1]');

select throws_ok(
  $$insert into public.bookings
      (reference, customer_id, source, status, experience_period,
       cleaning_buffer_minutes)
    values ('WP1', 'b0000000-0000-4000-8000-000000000001', 'online', 'held',
            tstzrange(timestamptz '2026-10-02 09:00+04',
                      timestamptz '2026-10-02 11:00+04', '[)'), 20)$$,
  '23514', null,
  'a reference too short to quote over the telephone is refused [§9.1]');

select throws_ok(
  $$insert into public.bookings
      (reference, customer_id, source, status, experience_period,
       cleaning_buffer_minutes)
    values ('WPA1B2C3', 'b0000000-0000-4000-8000-000000000001', 'walk_in', 'held',
            tstzrange(timestamptz '2026-10-02 09:00+04',
                      timestamptz '2026-10-02 11:00+04', '[)'), 20)$$,
  '23505', null,
  'a duplicate reference is refused [§9.1]');

select throws_ok(
  $$insert into public.bookings
      (reference, customer_id, source, status, experience_period,
       cleaning_buffer_minutes)
    values ('WPOPEN01', 'b0000000-0000-4000-8000-000000000001', 'online', 'held',
            tstzrange(timestamptz '2026-10-02 09:00+04', null, '[)'), 20)$$,
  '23514', null,
  'an experience with no end is refused, matching suite_occupancy');

select throws_ok(
  $$insert into public.bookings
      (reference, customer_id, source, status, experience_period,
       cleaning_buffer_minutes, subtotal_fils)
    values ('WPNEG001', 'b0000000-0000-4000-8000-000000000001', 'online', 'held',
            tstzrange(timestamptz '2026-10-02 09:00+04',
                      timestamptz '2026-10-02 11:00+04', '[)'), 20, -1)$$,
  '23514', null,
  'a negative subtotal is refused [R-16, INV-21]');

select throws_ok(
  $$update public.bookings set total_fils = -100
     where id = 'b1000000-0000-4000-8000-000000000001'$$,
  '23514', null,
  'a negative total is refused [R-16, INV-21]');

select throws_ok(
  $$insert into public.bookings
      (reference, customer_id, source, status, experience_period,
       cleaning_buffer_minutes)
    values ('WPCOMP01', 'b0000000-0000-4000-8000-000000000001', 'complimentary',
            'confirmed',
            tstzrange(timestamptz '2026-10-02 09:00+04',
                      timestamptz '2026-10-02 11:00+04', '[)'), 20)$$,
  '23514', null,
  'a complimentary booking cannot be left unflagged and counted as revenue [§11.2, INV-20]');

select lives_ok(
  $$insert into public.bookings
      (id, reference, customer_id, source, status, experience_period,
       cleaning_buffer_minutes, is_complimentary)
    values ('b1000000-0000-4000-8000-000000000002', 'WPCOMP01',
            'b0000000-0000-4000-8000-000000000001', 'complimentary', 'confirmed',
            tstzrange(timestamptz '2026-10-02 09:00+04',
                      timestamptz '2026-10-02 11:00+04', '[)'), 20, true)$$,
  'a flagged complimentary booking is accepted and reports separately [§11.2, INV-20]');

select throws_ok(
  $$insert into public.bookings
      (reference, customer_id, source, status, experience_period,
       cleaning_buffer_minutes, overrun_minutes)
    values ('WPOVR001', 'b0000000-0000-4000-8000-000000000001', 'online', 'completed',
            tstzrange(timestamptz '2026-10-02 09:00+04',
                      timestamptz '2026-10-02 11:00+04', '[)'), 20, -5)$$,
  '23514', null,
  'a negative overrun is refused [§7.6]');

insert into public.suite_occupancy
  (id, suite_id, kind, experience_period, blocked_period, cleaning_buffer_minutes,
   booking_id)
values
  ('b3000000-0000-4000-8000-000000000001',
   (select id from public.suites where suite_number = 1),
   'booking',
   tstzrange(timestamptz '2026-10-03 09:00+04', timestamptz '2026-10-03 11:00+04', '[)'),
   tstzrange(timestamptz '2026-10-03 09:00+04', timestamptz '2026-10-03 11:20+04', '[)'),
   20,
   'b1000000-0000-4000-8000-000000000001');

update public.bookings
   set occupancy_id = 'b3000000-0000-4000-8000-000000000001',
       suite_id = (select id from public.suites where suite_number = 1)
 where id = 'b1000000-0000-4000-8000-000000000001';

select is(
  (select b.reference from public.suite_occupancy o
     join public.bookings b on b.id = o.booking_id
    where o.id = 'b3000000-0000-4000-8000-000000000001'),
  'WPA1B2C3',
  'the board resolves an occupancy row to its booking [§9.1]');

select throws_ok(
  $$update public.bookings
       set occupancy_id = 'b3000000-0000-4000-8000-000000000001'
     where id = 'b1000000-0000-4000-8000-000000000002'$$,
  '23505', null,
  'one live claim cannot belong to two bookings [§3, INV-02]');

select throws_ok(
  $$insert into public.suite_occupancy
      (suite_id, kind, experience_period, blocked_period, cleaning_buffer_minutes)
    values ((select id from public.suites where suite_number = 2), 'block',
            tstzrange(timestamptz '2026-10-04 09:00+04',
                      timestamptz '2026-10-04 11:00+04', '[)'),
            tstzrange(timestamptz '2026-10-04 09:00+04',
                      timestamptz '2026-10-04 11:00+04', '[)'), 0)$$,
  '23514', null,
  'a block with no reason is refused [§9.2]');

select lives_ok(
  $$insert into public.suite_occupancy
      (suite_id, kind, experience_period, blocked_period, cleaning_buffer_minutes,
       reason, created_by)
    values ((select id from public.suites where suite_number = 2), 'block',
            tstzrange(timestamptz '2026-10-04 09:00+04',
                      timestamptz '2026-10-04 11:00+04', '[)'),
            tstzrange(timestamptz '2026-10-04 09:00+04',
                      timestamptz '2026-10-04 11:00+04', '[)'), 0,
            'Deep clean after the maintenance visit',
            'b1111111-1111-4111-8111-111111111111')$$,
  'a block carrying a reason is accepted [§9.2]');

select lives_ok(
  $$insert into public.booking_guests (booking_id, kind)
    values ('b1000000-0000-4000-8000-000000000001', 'adult')$$,
  'an adult guest carries no age [§6.2]');

select throws_ok(
  $$insert into public.booking_guests (booking_id, kind, age)
    values ('b1000000-0000-4000-8000-000000000001', 'adult', 34)$$,
  '23514', null,
  'an adult must not carry an age — §6.2 asks for one only for a child');

select throws_ok(
  $$insert into public.booking_guests (booking_id, kind)
    values ('b1000000-0000-4000-8000-000000000001', 'child')$$,
  '23514', null,
  'a child guest requires an age [§6.2]');

select lives_ok(
  $$insert into public.booking_guests (booking_id, kind, age)
    values ('b1000000-0000-4000-8000-000000000001', 'child', 11)$$,
  'a child guest carries an age and no date of birth [§6.2, §13]');

select lives_ok(
  $$insert into public.booking_guests (booking_id, kind, age)
    values ('b1000000-0000-4000-8000-000000000001', 'child', 7)$$,
  'the database does not enforce booking.child_min_age — that is a setting [§10.2, INV-16]');

select is(
  (select count(*)::int from public.addons where offer_price_fils > 0),
  0,
  'no priced add-on ships — no catalogue has been supplied [§8, Q-15]. The two '
  'AED 0 rows the seed carries are the §8 placeholders');

insert into public.addons
  (id, name, regular_price_fils, offer_price_fils, sort_order, max_quantity)
values ('b4000000-0000-4000-8000-000000000001', 'Signature scrub', 15000, 15000, 10, 4);

select lives_ok(
  $$insert into public.booking_addons
      (booking_id, addon_id, name_snapshot, unit_price_fils, quantity)
    values ('b1000000-0000-4000-8000-000000000001',
            'b4000000-0000-4000-8000-000000000001',
            'Signature scrub', 15000, 2)$$,
  'an add-on line snapshots its name and unit price [§10.4, §11.2]');

select is(
  (select line_total_fils from public.booking_addons
    where booking_id = 'b1000000-0000-4000-8000-000000000001'),
  30000,
  'the line total is stored, not recomputed by the caller [INV-21]');

update public.addons
   set name = 'Renamed scrub', regular_price_fils = 99000, offer_price_fils = 99000
 where id = 'b4000000-0000-4000-8000-000000000001';

select is(
  (select name_snapshot || ':' || unit_price_fils::text from public.booking_addons
    where booking_id = 'b1000000-0000-4000-8000-000000000001'),
  'Signature scrub:15000',
  'repricing an add-on never moves a booking already sold [INV-21]');

select throws_ok(
  $$insert into public.booking_addons
      (booking_id, addon_id, name_snapshot, unit_price_fils, quantity)
    values ('b1000000-0000-4000-8000-000000000001',
            'b4000000-0000-4000-8000-000000000001',
            'Signature scrub', 15000, 1)$$,
  '23505', null,
  'the same add-on cannot appear twice on one booking — quantity is what varies');

select lives_ok(
  $$insert into public.acceptance_records
      (booking_id, source, document_slug, document_version, checkbox_text)
    values ('b1000000-0000-4000-8000-000000000001', 'online',
            'privacy-policy', '1.3',
            'I agree to WellPlace''s Legal, Privacy & Marketing Terms.')$$,
  'an acceptance record is written against the booking [§6.3]');

select is(
  (select checkbox_text from public.acceptance_records
    where booking_id = 'b1000000-0000-4000-8000-000000000001'
      and document_slug = 'privacy-policy'),
  'I agree to WellPlace''s Legal, Privacy & Marketing Terms.',
  'the literal sentence the guest ticked is stored, not a key to it [§6.3, Q-14]');

select throws_ok(
  $$insert into public.acceptance_records
      (booking_id, source, document_slug, document_version, checkbox_text)
    values ('b1000000-0000-4000-8000-000000000001', 'online',
            'privacy-policy', '1.4',
            'I agree to WellPlace''s Legal, Privacy & Marketing Terms.')$$,
  '23505', null,
  'one acceptance per document per booking [§6.3]');

select lives_ok(
  $$insert into public.acceptance_records
      (booking_id, source, document_slug, document_version, checkbox_text)
    values ('b1000000-0000-4000-8000-000000000001', 'online',
            'marketing-terms', '1.3',
            'I agree to WellPlace''s Legal, Privacy & Marketing Terms.')$$,
  'one tick covers several documents and writes a row for each [CLIENT 31 Aug 2026, Q-14]');

select throws_ok(
  $$insert into public.acceptance_records
      (booking_id, source, document_slug, document_version, checkbox_text)
    values ('b1000000-0000-4000-8000-000000000001', 'online',
            'legal-terms', '1.3', '   ')$$,
  '23514', null,
  'an acceptance with no wording is refused — a blank string proves nothing [§6.3]');

update public.bookings set updated_at = timestamptz '2020-01-01 00:00:00+00'
 where id = 'b1000000-0000-4000-8000-000000000001';

select is(
  (select updated_at from public.bookings
    where id = 'b1000000-0000-4000-8000-000000000001'),
  now(),
  'a caller cannot backdate a booking''s updated_at by hand [R-16]');

update public.addons set sort_order = 20
 where id = 'b4000000-0000-4000-8000-000000000001';

select is(
  (select updated_at from public.addons
    where id = 'b4000000-0000-4000-8000-000000000001'),
  now(),
  'the updated_at trigger fires on the add-on catalogue too [R-16]');

set local role authenticated;
set local request.jwt.claims = '{"sub":"b1111111-1111-4111-8111-111111111111"}';

select is(
  (select count(*)::int from public.bookings),
  2,
  'reception: sees every booking, with no per-creator filter [§9.1, docs/5 §1]');

select is(
  (select count(*)::int from public.booking_guests),
  3,
  'reception: reads the guest list of a booking [§9.1]');

select is(
  (select count(*)::int from public.addons),
  3,
  'reception: reads the add-on catalogue it sells from [§9.2] — the two seeded '
  '§8 placeholders and the one this test created');

select is(
  (select count(*)::int from public.booking_addons),
  1,
  'reception: reads the add-on lines of a booking [§9.1]');

select is(
  (select count(*)::int from public.acceptance_records),
  2,
  'reception: reads what the guest accepted [§6.3, §9.1]');

select throws_ok(
  $$insert into public.bookings
      (reference, customer_id, source, status, experience_period,
       cleaning_buffer_minutes)
    values ('WPSNEAK1', 'b0000000-0000-4000-8000-000000000001', 'walk_in', 'confirmed',
            tstzrange(timestamptz '2026-10-05 09:00+04',
                      timestamptz '2026-10-05 11:00+04', '[)'), 20)$$,
  '42501', null,
  'reception: CANNOT create a booking directly — only an RPC takes the lock [R-02, §7.5]');

select throws_ok(
  $$update public.bookings set status = 'cancelled'
     where id = 'b1000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'reception: CANNOT change a booking directly — every change is audited [R-14, INV-13]');

select throws_ok(
  $$delete from public.bookings
     where id = 'b1000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'reception: CANNOT delete a booking [§10.6, INV-13]');

select throws_ok(
  $$insert into public.booking_guests (booking_id, kind)
    values ('b1000000-0000-4000-8000-000000000001', 'adult')$$,
  '42501', null,
  'reception: CANNOT add a guest directly [R-02]');

select throws_ok(
  $$insert into public.acceptance_records
      (booking_id, source, document_slug, document_version, checkbox_text)
    values ('b1000000-0000-4000-8000-000000000001', 'walk_in',
            'legal-terms', '1.3', 'Ticked on the guest''s behalf.')$$,
  '42501', null,
  'reception: CANNOT write acceptance evidence directly [§6.3]');

select throws_ok(
  $$insert into public.addons (name, regular_price_fils, offer_price_fils)
    values ('Sneaky extra', 100, 100)$$,
  '42501', null,
  'reception: CANNOT configure add-ons [§10.4, docs/5 §3]');

set local request.jwt.claims = '{"sub":"b2222222-2222-4222-8222-222222222222"}';

select is(
  (select count(*)::int from public.bookings),
  2,
  'management: sees every booking [§10.1]');

select throws_ok(
  $$insert into public.addons (name, regular_price_fils, offer_price_fils)
    values ('Managed extra', 100, 100)$$,
  '42501', null,
  'management: configures add-ons through an audited RPC, not a table write [R-02, R-14]');

select throws_ok(
  $$update public.bookings set total_fils = 1
     where id = 'b1000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'management: a manual price change is perm:manual_price_change through an RPC [§6.4]');

reset role;
set local role anon;

select throws_ok($$select * from public.bookings$$, '42501', null,
  'anon: CANNOT read bookings [§13, INV-01]');
select throws_ok($$select * from public.booking_guests$$, '42501', null,
  'anon: CANNOT read guest details [§13]');
select throws_ok($$select * from public.addons$$, '42501', null,
  'anon: CANNOT read the add-on catalogue directly [§13]');
select throws_ok($$select * from public.booking_addons$$, '42501', null,
  'anon: CANNOT read add-on lines [§13]');
select throws_ok($$select * from public.acceptance_records$$, '42501', null,
  'anon: CANNOT read acceptance records [§13]');

select throws_ok(
  $$insert into public.bookings
      (reference, customer_id, source, status, experience_period,
       cleaning_buffer_minutes)
    values ('WPANON01', 'b0000000-0000-4000-8000-000000000001', 'online', 'held',
            tstzrange(timestamptz '2026-10-06 09:00+04',
                      timestamptz '2026-10-06 11:00+04', '[)'), 20)$$,
  '42501', null,
  'anon: CANNOT create a booking — the public flow goes through an RPC [R-02, §7.5]');

reset role;
select * from finish();
rollback;
