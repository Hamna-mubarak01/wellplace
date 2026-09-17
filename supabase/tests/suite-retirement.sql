begin;
select plan(47);

update public.suites set is_active = false;

insert into public.suites (id, suite_number, priority, status, is_active) values
  ('c9700000-0000-4000-8000-000000000001', 9701, 9710, 'available', true),
  ('c9700000-0000-4000-8000-000000000002', 9702, 9720, 'available', true),
  ('c9700000-0000-4000-8000-000000000003', 9703, 9730, 'available', true),
  ('c9700000-0000-4000-8000-000000000004', 9704, 9740, 'available', true);

insert into public.staff (id, email, full_name, role, is_active) values
  ('d9700000-0000-4000-8000-000000000001', 'srt.manager@example.test',   'SRT Manager',   'management', true),
  ('d9700000-0000-4000-8000-000000000002', 'srt.reception@example.test', 'SRT Reception', 'reception',  true);

create temp table srt (label text primary key, id uuid);
grant all on srt to public;

select has_column('public', 'suites', 'retired_at',
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] suites record when they were retired');

select col_type_is('public', 'suites', 'retired_at', 'timestamp with time zone',
  '[R-16] as timestamptz');

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9700000-0000-4000-8000-000000000002","email":"srt.reception@example.test"}';

insert into srt (label, id)
select 'visit', r.booking_id
  from public.create_reception_booking(
    'walk_in', 'mr', 'Sami', 'Retire', 'sami.retire@example.test',
    date '1988-03-03', '+971500009701', 'AE',
    timestamptz '2041-07-01 10:00+04', 2, 20,
    2, null, null, null, null,
    '{"subtotal_fils":66000,"discount_fils":0,"addons_fils":0,"service_fee_fils":0,"tax_fils":3143,"total_fils":66000}'::jsonb,
    false,
    '[{"document_slug":"legal-terms","document_version":"1.3","checkbox_text":"I agree to WellPlace''s Legal, Privacy & Marketing Terms."}]'::jsonb,
    'Walk-in for the suite retirement test') r;

reset role;

select is(
  (select s.suite_number from public.bookings b join public.suites s on s.id = b.suite_id join srt on srt.id = b.id where srt.label = 'visit'),
  9701,
  'fixture: the upcoming booking sits on suite 9701'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9700000-0000-4000-8000-000000000001","email":"srt.manager@example.test"}';

select lives_ok(
  $$select public.block_suite_period(array['c9700000-0000-4000-8000-000000000002'::uuid], timestamptz '2041-08-01 10:00+04', timestamptz '2041-08-01 12:00+04', 'Planned repaint')$$,
  'fixture: suite 9702 carries a scheduled block'
);

select throws_ok(
  $$select public.retire_suite('c9700000-0000-4000-8000-000000000001', 'Closing')$$,
  'WP072', null,
  '[§8.2] a suite with an upcoming booking cannot be retired, so no guest is left without a suite'
);

select is(
  (select r.status::text || '|' || (r.retired_at is not null)::text
     from public.retire_suite('c9700000-0000-4000-8000-000000000002', 'Closing for renovation') r),
  'out_of_service|true',
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] a suite with only a scheduled block is retired'
);

reset role;

select is(
  (select s.is_active::text || '|' || s.status::text || '|' || s.retirement_reason || '|' || s.retired_by::text
     from public.suites s where s.id = 'c9700000-0000-4000-8000-000000000002'),
  'false|out_of_service|Closing for renovation|d9700000-0000-4000-8000-000000000001',
  'retirement makes the suite inactive and out of service and records the reason and the manager'
);

select ok(
  exists (
    select 1 from audit.entries e
     where e.action = 'retire_suite'
       and e.entity_id = 'c9700000-0000-4000-8000-000000000002'
       and e.reason = 'Closing for renovation'
       and e.actor_id = 'd9700000-0000-4000-8000-000000000001'
       and e.old_value ->> 'status' = 'available'),
  '[§3, INV-13] retiring writes its own audit entry with the old status, the actor and the reason'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9700000-0000-4000-8000-000000000001","email":"srt.manager@example.test"}';

select throws_ok(
  $$select public.retire_suite('c9700000-0000-4000-8000-000000000002', 'Again')$$,
  'WP074', null,
  'a retired suite cannot be retired twice'
);

select throws_ok(
  $$select public.set_suite_status('c9700000-0000-4000-8000-000000000002', 'available', 'Ready again')$$,
  'WP074', null,
  'changing the status of a retired suite is refused; return to service is the way back'
);

select is(
  (select b.is_blocked
     from public.block_suite_period(array['c9700000-0000-4000-8000-000000000002'::uuid], timestamptz '2041-09-01 10:00+04', timestamptz '2041-09-01 12:00+04', 'Block a retired suite') b),
  false,
  'a block requested on a retired suite is reported as not placed'
);

select is(
  (select count(*)::integer from public.suite_occupancy o where o.suite_id = 'c9700000-0000-4000-8000-000000000002'),
  1,
  'and no new claim was written for it'
);

select is(
  (select s.is_active
     from public.save_suite_setup('c9700000-0000-4000-8000-000000000002', 9702, 'Garden', false, 'Renamed while retired', 9720, null) s),
  false,
  'editing a retired suite''s details does not return it to service'
);

reset role;

select ok(
  (select s.retired_at is not null and s.status = 'out_of_service' and s.display_name = 'Garden'
     from public.suites s where s.id = 'c9700000-0000-4000-8000-000000000002'),
  'and the retirement survives the edit while the new name is saved'
);

select is(
  (select count(*)::integer from public.reception_board r where r.suite_id = 'c9700000-0000-4000-8000-000000000002'),
  0,
  'a retired suite and its scheduled claims drop off the Reception board'
);

update public.suites set status = 'maintenance' where suite_number in (9703, 9704);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9700000-0000-4000-8000-000000000002","email":"srt.reception@example.test"}';

select is_empty(
  $$select * from public.hold_suite(timestamptz '2041-07-01 10:00+04', 2, 20, 15)$$,
  '[§7.2, INV-07] a retired suite is never allocated, even when it is the only suite free by time'
);

select is(
  (select c.remaining from public.count_available_suites(array[timestamptz '2041-07-01 10:00+04'], 2, 20) c),
  0,
  '[§7.4] and it is never offered as availability'
);

select is(
  (select count(*)::integer from public.reception_booking_suites(timestamptz '2041-07-01 10:00+04', 2) c where c.suite_number = 9702),
  0,
  'the desk suite picker does not list it'
);

select is(
  (select count(*)::integer from srt, lateral public.booking_move_options(srt.id) o where srt.label = 'visit' and o.suite_number = 9702),
  0,
  'nor does the booking move list'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d9700000-0000-4000-8000-000000000001","email":"srt.manager@example.test"}';

select is(
  (select (m.retired_at is not null)::text || '|' || m.has_history::text || '|' || m.upcoming_bookings || '|' || m.retired_by_name || '|' || m.retirement_reason
     from public.management_suite_inventory m where m.id = 'c9700000-0000-4000-8000-000000000002'),
  'true|true|0|SRT Manager|Closing for renovation',
  'Management still lists the retired suite with its retirement and its history'
);

select is(
  (select m.upcoming_bookings from public.management_suite_inventory m where m.id = 'c9700000-0000-4000-8000-000000000001'),
  1,
  'and counts the upcoming booking that prevents retiring suite 9701'
);

select is(
  (select r.status::text || '|' || r.is_active::text
     from public.return_suite_to_service('c9700000-0000-4000-8000-000000000002', 'Renovation finished') r),
  'available|true',
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] retiring is reversible'
);

reset role;

select ok(
  (select s.retired_at is null and s.retired_by is null and s.retirement_reason is null
     from public.suites s where s.id = 'c9700000-0000-4000-8000-000000000002'),
  'returning to service clears the retirement fields'
);

select ok(
  exists (
    select 1 from audit.entries e
     where e.action = 'return_suite_to_service'
       and e.entity_id = 'c9700000-0000-4000-8000-000000000002'
       and e.old_value ->> 'retirement_reason' = 'Closing for renovation'),
  '[§3, INV-13] and the audit entry keeps the earlier retirement reason'
);

select is(
  (select count(*)::integer from public.reception_board r where r.suite_id = 'c9700000-0000-4000-8000-000000000002' and r.kind = 'block'),
  1,
  'the scheduled block reappears on the board unchanged'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9700000-0000-4000-8000-000000000002","email":"srt.reception@example.test"}';

select is(
  (select c.remaining from public.count_available_suites(array[timestamptz '2041-07-01 10:00+04'], 2, 20) c),
  1,
  'and the suite is offered again'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"d9700000-0000-4000-8000-000000000001","email":"srt.manager@example.test"}';

select throws_ok(
  $$select public.return_suite_to_service('c9700000-0000-4000-8000-000000000002', 'Again')$$,
  'WP075', null,
  'a suite in service cannot be returned to service'
);

select throws_ok(
  $$select public.delete_suite('c9700000-0000-4000-8000-000000000001', 'Remove it')$$,
  'WP073', null,
  '[§11.2] a suite with booking history cannot be deleted'
);

reset role;

insert into public.suite_occupancy (suite_id, kind, experience_period, blocked_period, cleaning_buffer_minutes, expires_at)
values ('c9700000-0000-4000-8000-000000000003', 'hold',
        tstzrange(timestamptz '2041-07-05 10:00+04', timestamptz '2041-07-05 12:00+04', '[)'),
        tstzrange(timestamptz '2041-07-05 10:00+04', timestamptz '2041-07-05 12:20+04', '[)'),
        20, now() + interval '10 minutes');

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9700000-0000-4000-8000-000000000001","email":"srt.manager@example.test"}';

select throws_ok(
  $$select public.retire_suite('c9700000-0000-4000-8000-000000000003', 'Closing')$$,
  'WP072', null,
  '[§7.3] a live payment reservation also prevents retirement'
);

reset role;

update public.suite_occupancy set expires_at = now() - interval '1 minute'
 where suite_id = 'c9700000-0000-4000-8000-000000000003' and kind = 'hold';

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9700000-0000-4000-8000-000000000001","email":"srt.manager@example.test"}';

select lives_ok(
  $$select public.retire_suite('c9700000-0000-4000-8000-000000000003', 'Closing')$$,
  '[INV-05] but an expired reservation does not, whether or not the sweep has run'
);

select throws_ok(
  $$select public.delete_suite('c9700000-0000-4000-8000-000000000003', 'Remove it')$$,
  'WP073', null,
  'an expired reservation is still history, so that suite is retired rather than deleted'
);

select is(
  (select d.suite_number from public.delete_suite('c9700000-0000-4000-8000-000000000004', 'Added by mistake') d),
  9704,
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] a suite that was never used is deleted'
);

reset role;

select is(
  (select count(*)::integer from public.suites s where s.id = 'c9700000-0000-4000-8000-000000000004'),
  0,
  'the row is gone'
);

select ok(
  exists (
    select 1 from audit.entries e
     where e.action = 'delete_suite'
       and e.entity_id = 'c9700000-0000-4000-8000-000000000004'
       and e.old_value ->> 'suite_number' = '9704'
       and e.reason = 'Added by mistake'),
  '[§3, INV-13] and the audit entry holds the suite as it was'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9700000-0000-4000-8000-000000000002","email":"srt.reception@example.test"}';

select throws_ok(
  $$select public.retire_suite('c9700000-0000-4000-8000-000000000001', 'Reception tries')$$,
  '42501', null,
  '[INV-15] Reception cannot retire a suite'
);

select throws_ok(
  $$select public.delete_suite('c9700000-0000-4000-8000-000000000001', 'Reception tries')$$,
  '42501', null,
  '[INV-15] nor delete one'
);

reset role;

insert into public.customers (id, first_name, last_name, email, phone_e164, phone_country) values
  ('c9700000-0000-4000-8000-0000000000c1', 'Night', 'Owl', 'night.owl@example.test', '+971500009702', 'AE');

insert into public.bookings (reference, customer_id, suite_id, source, status, experience_period, cleaning_buffer_minutes) values
  ('WPSRT0001', 'c9700000-0000-4000-8000-0000000000c1', 'c9700000-0000-4000-8000-000000000001', 'telephone', 'confirmed',
   tstzrange(timestamptz '2041-07-10 22:00+04', timestamptz '2041-07-11 01:00+04', '[)'), 20),
  ('WPSRT0002', 'c9700000-0000-4000-8000-0000000000c1', 'c9700000-0000-4000-8000-000000000001', 'telephone', 'cancelled',
   tstzrange(timestamptz '2041-07-12 10:00+04', timestamptz '2041-07-12 12:00+04', '[)'), 20);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9700000-0000-4000-8000-000000000001","email":"srt.manager@example.test"}';

select is(
  (select string_agg(d.booked_on::text || ':' || d.bookings, ',' order by d.booked_on)
     from public.suite_booked_dates('c9700000-0000-4000-8000-000000000001', date '2041-07-01', date '2041-07-31') d),
  '2041-07-01:1,2041-07-10:1,2041-07-11:1',
  '[§13] booked dates are Dubai dates, a visit crossing midnight counts on both, and a cancelled booking on none'
);

select throws_ok(
  $$select * from public.suite_booked_dates('c9700000-0000-4000-8000-000000000001', date '2041-07-31', date '2041-07-01')$$,
  '22023', null,
  'a reversed date range is refused rather than shown as empty'
);

reset role;

select throws_ok(
  $$update public.suites set is_active = true where suite_number = 9703$$,
  'WP074', null,
  'no path, not even a direct update, reactivates a retired suite'
);

select throws_ok(
  $$insert into public.suite_occupancy (suite_id, kind, experience_period, blocked_period, cleaning_buffer_minutes, reason)
    values ('c9700000-0000-4000-8000-000000000003', 'block',
            tstzrange(timestamptz '2041-10-01 10:00+04', timestamptz '2041-10-01 12:00+04', '[)'),
            tstzrange(timestamptz '2041-10-01 10:00+04', timestamptz '2041-10-01 12:00+04', '[)'),
            0, 'Direct claim')$$,
  'WP074', null,
  '[INV-02] and no claim reaches a retired suite by any path, the allocator being only the first line'
);

select is(
  (select count(*)::integer from pg_constraint c where c.conname = 'suites_retired_is_out_of_service' and c.contype = 'c'),
  1,
  'and a check constraint stands behind that message'
);

insert into public.suites (id, suite_number, priority, status, is_active) values
  ('c9700000-0000-4000-8000-000000000005', 9705, 9750, 'available', true);

insert into public.bookings (id, reference, customer_id, suite_id, source, status, experience_period, cleaning_buffer_minutes) values
  ('c9700000-0000-4000-8000-0000000000b5', 'WPSRT0005', 'c9700000-0000-4000-8000-0000000000c1',
   'c9700000-0000-4000-8000-000000000005', 'telephone', 'confirmed',
   tstzrange(date_trunc('minute', now()) - interval '150 minutes', date_trunc('minute', now()) - interval '30 minutes', '[)'), 20);

insert into public.suite_occupancy (id, suite_id, kind, experience_period, blocked_period, cleaning_buffer_minutes, booking_id)
select 'c9700000-0000-4000-8000-0000000000e5', b.suite_id, 'booking', b.experience_period,
       tstzrange(lower(b.experience_period), upper(b.experience_period) + interval '20 minutes', '[)'), 20, b.id
  from public.bookings b where b.id = 'c9700000-0000-4000-8000-0000000000b5';

update public.bookings set occupancy_id = 'c9700000-0000-4000-8000-0000000000e5'
 where id = 'c9700000-0000-4000-8000-0000000000b5';

insert into public.suite_occupancy (id, suite_id, kind, experience_period, blocked_period, cleaning_buffer_minutes, reason) values
  ('c9700000-0000-4000-8000-0000000000e6', 'c9700000-0000-4000-8000-000000000005', 'block',
   tstzrange(timestamptz '2041-11-01 10:00+04', timestamptz '2041-11-01 12:00+04', '[)'),
   tstzrange(timestamptz '2041-11-01 10:00+04', timestamptz '2041-11-01 12:00+04', '[)'), 0, 'Planned deep clean');

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9700000-0000-4000-8000-000000000001","email":"srt.manager@example.test"}';

select lives_ok(
  $$select public.retire_suite('c9700000-0000-4000-8000-000000000005', 'Closing for refit')$$,
  'fixture: a suite whose last booking has ended, with its claim still on record, is retired'
);

select throws_ok(
  $$select public.extend_booking('c9700000-0000-4000-8000-0000000000b5', 120, 'Guest arrived late, give the full time')$$,
  'WP074', null,
  '[§7.2, INV-02] extending a booking on a retired suite is refused, so an ended claim cannot be widened back into a live one'
);

reset role;

select throws_ok(
  $$update public.suite_occupancy
       set blocked_period = tstzrange(lower(blocked_period), upper(blocked_period) + interval '3 hours', '[)')
     where id = 'c9700000-0000-4000-8000-0000000000e5'$$,
  'WP074', null,
  'nor can any other path widen a claim on a retired suite'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9700000-0000-4000-8000-000000000001","email":"srt.manager@example.test"}';

select lives_ok(
  $$select public.release_suite_block('c9700000-0000-4000-8000-0000000000e6', 'Deep clean no longer needed')$$,
  'releasing a scheduled block on a retired suite still works'
);

reset role;

select lives_ok(
  $$update public.suite_occupancy set is_active = false, status = 'released'
     where id = 'c9700000-0000-4000-8000-0000000000e5'$$,
  'and so does deactivating any other claim on it'
);

select throws_ok(
  $$update public.suite_occupancy set is_active = true, status = 'active'
     where id = 'c9700000-0000-4000-8000-0000000000e5'$$,
  'WP074', null,
  'but a released claim on a retired suite cannot be revived'
);

select * from finish();
rollback;
