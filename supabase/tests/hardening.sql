begin;
select plan(57);

insert into public.staff (id, email, full_name, role, is_active) values
  ('f1111111-1111-4111-8111-111111111111', 'hard.reception@example.test',  'Hard Reception',  'reception',  true),
  ('f2222222-2222-4222-8222-222222222222', 'hard.management@example.test', 'Hard Management', 'management', true),
  ('f3333333-3333-4333-8333-333333333333', 'hard.override@example.test',   'Hard Override',   'reception',  true),
  ('f4444444-4444-4444-8444-444444444444', 'hard.dormant@example.test',    'Hard Dormant',    'reception',  false);

insert into public.staff_permissions (staff_id, permission, granted_by, reason) values
  ('f2222222-2222-4222-8222-222222222222', 'manual_price_change',
   'f2222222-2222-4222-8222-222222222222', 'so the §6.4 path can be exercised'),
  ('f3333333-3333-4333-8333-333333333333', 'override_suite_allocation',
   'f2222222-2222-4222-8222-222222222222', 'so the §7.1 buffer override can be exercised');

insert into public.customers
  (id, first_name, last_name, email, phone_e164, phone_country, date_of_birth)
values
  ('f0000000-0000-4000-8000-000000000001', 'Hard', 'Guest',
   'hard.guest@example.test', '+971500004001', 'AE', date '1990-01-01');

insert into public.bookings
  (id, reference, customer_id, source, status, experience_period,
   cleaning_buffer_minutes, subtotal_fils, discount_fils, addons_fils,
   service_fee_fils, tax_fils, total_fils, is_complimentary)
values
  ('f1000000-0000-4000-8000-000000000001', 'WPHARD01',
   'f0000000-0000-4000-8000-000000000001', 'walk_in', 'cancelled',
   tstzrange(timestamptz '2027-12-01 09:00+04', timestamptz '2027-12-01 11:00+04', '[)'),
   20, 100000, 0, 5000, 6300, 5300, 116600, false),
  ('f1000000-0000-4000-8000-000000000002', 'WPHARD02',
   'f0000000-0000-4000-8000-000000000001', 'walk_in', 'completed',
   tstzrange(timestamptz '2027-12-02 09:00+04', timestamptz '2027-12-02 11:00+04', '[)'),
   20, 100000, 0, 5000, 6300, 5300, 116600, false),
  ('f1000000-0000-4000-8000-000000000003', 'WPHARD03',
   'f0000000-0000-4000-8000-000000000001', 'complimentary', 'confirmed',
   tstzrange(timestamptz '2027-12-03 09:00+04', timestamptz '2027-12-03 11:00+04', '[)'),
   20, 0, 0, 0, 0, 0, 0, true),
  ('f1000000-0000-4000-8000-000000000004', 'WPHARD04',
   'f0000000-0000-4000-8000-000000000001', 'walk_in', 'confirmed',
   tstzrange(timestamptz '2027-12-04 09:00+04', timestamptz '2027-12-04 11:00+04', '[)'),
   20, 80000, 0, 0, 0, 0, 80000, false),
  ('f1000000-0000-4000-8000-000000000005', 'WPHARD05',
   'f0000000-0000-4000-8000-000000000001', 'walk_in', 'confirmed',
   tstzrange(timestamptz '2027-12-05 09:00+04', timestamptz '2027-12-05 11:00+04', '[)'),
   20, 70000, 0, 0, 0, 0, 70000, false),
  ('f1000000-0000-4000-8000-000000000006', 'WPHARD06',
   'f0000000-0000-4000-8000-000000000001', 'walk_in', 'no_show',
   tstzrange(timestamptz '2027-12-06 09:00+04', timestamptz '2027-12-06 11:00+04', '[)'),
   20, 90000, 0, 0, 0, 0, 90000, false),
  ('f1000000-0000-4000-8000-000000000007', 'WPHARD07',
   'f0000000-0000-4000-8000-000000000001', 'walk_in', 'abandoned',
   tstzrange(timestamptz '2027-12-07 09:00+04', timestamptz '2027-12-07 11:00+04', '[)'),
   20, 90000, 0, 0, 0, 0, 90000, false),
  ('f1000000-0000-4000-8000-000000000008', 'WPHARD08',
   'f0000000-0000-4000-8000-000000000001', 'walk_in', 'confirmed',
   tstzrange(timestamptz '2027-12-08 09:00+04', timestamptz '2027-12-08 11:00+04', '[)'),
   20, 60000, 0, 0, 0, 0, 60000, false);

insert into public.payments (id, booking_id, status, method, amount_fils)
values
  ('f2000000-0000-4000-8000-000000000004', 'f1000000-0000-4000-8000-000000000004',
   'paid', 'cash', 80000),
  ('f2000000-0000-4000-8000-000000000005', 'f1000000-0000-4000-8000-000000000005',
   'fully_refunded', 'cash', 70000);

insert into public.messages
  (id, template_key, channel, status, to_address, is_marketing)
values ('f3000000-0000-4000-8000-000000000001', 'booking_confirmation', 'email',
        'queued', 'hard.guest@example.test', false);

create temp table hard_buffer_probe (label text primary key, booking_id uuid);
grant insert, select on hard_buffer_probe to public;


select has_function('internal', 'is_worker_session',
  'the machine call sites are recognised by a named helper, in one place [§11]');

select ok(
  not has_function_privilege('authenticated', 'internal.write_audit(text,text,text,jsonb,jsonb,text)', 'execute'),
  'AUTHENTICATED CANNOT EXECUTE internal.write_audit — it kept the default '
  'PUBLIC grant while authenticated holds USAGE on the internal schema, so any '
  'signed-in session could forge an audit row indistinguishable from a real '
  'one [INV-14]');

select ok(
  not has_function_privilege('anon', 'internal.write_audit(text,text,text,jsonb,jsonb,text)', 'execute'),
  'nor can the unauthenticated role');

select ok(
  has_function_privilege('postgres', 'internal.write_audit(text,text,text,jsonb,jsonb,text)', 'execute'),
  'the owner still can, which is every mutating RPC, because each of those runs '
  'with the definer privileges as the owner [R-14]');

select ok(
  not has_function_privilege('authenticated', 'internal.current_staff_email()', 'execute'),
  'internal.current_staff_email is revoked with it — same default PUBLIC grant');

select ok(
  not has_function_privilege('authenticated', 'internal.require_management()', 'execute'),
  'internal.require_management is revoked with it');

select ok(
  not has_function_privilege('authenticated', 'internal.set_updated_at()', 'execute'),
  'internal.set_updated_at is revoked with it — a trigger function needs no '
  'EXECUTE grant to fire');

select ok(
  not has_function_privilege('authenticated', 'internal.assert_management_remains()', 'execute'),
  'internal.assert_management_remains is revoked with it');

select ok(
  not has_function_privilege('authenticated', 'internal.is_worker_session()', 'execute'),
  'and the new helper is revoked at birth rather than by a later migration');

select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'internal'::regnamespace and p.proacl is null),
  1,
  'EXACTLY ONE function in the internal schema still carries a default PUBLIC '
  'grant. A new one added without a revoke makes this two and fails here, which '
  'is the drift guard the write_audit exposure needed and did not have');

select is(
  (select p.proname from pg_proc p
    where p.pronamespace = 'internal'::regnamespace and p.proacl is null),
  'normalise_email',
  'and it is normalise_email, deliberately: public.customers.identity_key and '
  'public.waitlist_entries.dedupe_key are GENERATED ALWAYS over it, and a '
  'generated column expression IS permission-checked at write time');

select is(
  (select string_agg(p.proname, ', ' order by p.proname) from pg_proc p
    where p.pronamespace = 'internal'::regnamespace
      and has_function_privilege('authenticated', p.oid, 'execute')),
  'alert_booking_id, bookings_superseded_by_confirmed_checkout, bookings_with_live_checkout, current_staff_id, current_staff_role, has_permission, '
  'is_management, is_staff, normalise_email, staff_display_name, '
  'staff_quorum_lock',
  'the whole reachable surface of the internal schema, pinned. bookings_superseded_by_confirmed_checkout joined the list with 20260913095000 for the same reason as bookings_with_live_checkout: public.booking_search is security_invoker and must not count a guest who paid on a later attempt as abandoned, and it returns booking ids and nothing else [OUR CHOICE — project owner''s direction, 13 September 2026]. Every one is a '
  'read-only predicate or the generated-column helper; none of them writes. '
  'bookings_with_live_checkout joined the list with 20260913092000: public.booking_search is security_invoker and derives abandoned from internal.checkout_attempts, which authenticated cannot read, so it returns the ids of bookings with a live checkout reservation and nothing else — no token, amount, snapshot or receipt token [OUR CHOICE — project owner''s direction, 13 September 2026]. '
  'alert_booking_id joined the list with 20260908200000: it reads public.refunds '
  'under the definer''s privileges so a Reception alert can name its booking, '
  'and it returns a booking id and nothing else — no amount, no reason, no '
  'settlement state [§9.3, §10.6, INV-15]');

select ok(
  (select internal.normalise_email('  MiXeD@Example.TEST ')) = 'mixed@example.test',
  'normalise_email still normalises, so the two generated columns still compute');


set local role authenticated;
set local request.jwt.claims = '{"sub":"f1111111-1111-4111-8111-111111111111","email":"hard.reception@example.test"}';

select throws_ok(
  $$select internal.write_audit('cancel_booking', 'public.bookings', 'x', null, null, 'forged')$$,
  '42501', null,
  'A PLAIN AUTHENTICATED SESSION CANNOT WRITE AN AUDIT ENTRY. This is the '
  'reproduction from the adversary pass, and it now raises instead of landing a '
  'row [INV-14, §10.6]');

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"f4444444-4444-4444-8444-444444444444","email":"hard.dormant@example.test"}';

select throws_ok(
  $$select internal.write_audit('cancel_booking', 'public.bookings', 'x', null, null, 'forged')$$,
  '42501', null,
  'nor can a deactivated account, which is_staff() already refuses everywhere '
  'else and which wrote an audit row perfectly happily before this');

reset role;


set local role authenticated;
set local request.jwt.claims = '{"sub":"f2222222-2222-4222-8222-222222222222","email":"hard.management@example.test"}';

select throws_ok(
  $$select public.set_manual_booking_price(
      'f1000000-0000-4000-8000-000000000001', 50000, 'reprice a cancelled booking')$$,
  'WP014', null,
  'A CANCELLED BOOKING CANNOT BE REPRICED. §11.2 has already counted it as a '
  'booking that took nothing, and there was no status gate here at all');

select throws_ok(
  $$select public.set_manual_booking_price(
      'f1000000-0000-4000-8000-000000000007', 50000, 'reprice an abandoned booking')$$,
  'WP014', null,
  'nor an abandoned one — §11.3 reports checkout abandonment and the figure is '
  'the point of the row');

select lives_ok(
  $$select public.set_manual_booking_price(
      'f1000000-0000-4000-8000-000000000006', 45000, 'no-show charge under rules.no_show')$$,
  'a no_show MAY be repriced — rules.no_show is a real §10.2 setting and a '
  'no-show charge has nowhere else to live today');

select is(
  (select p.total_fils
     from public.set_manual_booking_price(
       'f1000000-0000-4000-8000-000000000002', 50000, 'goodwill reduction after the visit') p),
  50000,
  'a completed booking may be repriced — that is when an overrun or a goodwill '
  'reduction actually gets agreed');

reset role;

select is(
  (select b.subtotal_fils || '|' || b.discount_fils || '|' || b.addons_fils || '|'
       || b.service_fee_fils || '|' || b.tax_fils || '|' || b.total_fils
     from public.bookings b where b.id = 'f1000000-0000-4000-8000-000000000002'),
  '50000|0|0|0|2381|50000',
  'THE WHOLE NEW FIGURE GOES TO subtotal_fils, DISCOUNT, ADD-ONS AND FEE ARE '
  'ZEROED, AND THE VAT INSIDE THE AGREED PRICE IS STORED. A hand-set price is not '
  'a computed breakdown, so it is not rescaled across the old lines; since '
  '20260911235000 it is a VAT-inclusive gross, as the client pricing '
  'specification says every price is, and its VAT is 50000 less round(50000 / 1.05) '
  '[CLIENT pricing specification; Q-4 closed]');

select is(
  (select (b.subtotal_fils - b.discount_fils + b.addons_fils
           + b.service_fee_fils) - b.total_fils
     from public.bookings b where b.id = 'f1000000-0000-4000-8000-000000000002'),
  0,
  'so the components sum to total_fils exactly, with the VAT inside that total '
  'rather than added to it. Before 20260908090000 they read 116600 against a '
  'total of 50000, and INV-21 says reporting sums stored values');

select is(
  (select e.old_value ->> 'subtotal_fils' || '|' || (e.old_value ->> 'total_fils')
     from audit.entries e
    where e.action = 'set_manual_booking_price'
      and e.entity_id = 'f1000000-0000-4000-8000-000000000002'
    order by e.id desc limit 1),
  '100000|116600',
  'and the complete prior breakdown survives in the audit entry, so nothing the '
  'normalisation overwrote is lost [INV-13]');

select is(
  (select e.new_value ->> 'service_fee_fils'
     from audit.entries e
    where e.action = 'set_manual_booking_price'
      and e.entity_id = 'f1000000-0000-4000-8000-000000000002'
    order by e.id desc limit 1),
  '0',
  'the new value records what was actually written, not what was there before — '
  'the old entry copied the stale components into new_value');

set local role authenticated;
set local request.jwt.claims = '{"sub":"f1111111-1111-4111-8111-111111111111","email":"hard.reception@example.test"}';

select throws_ok(
  $$select public.set_manual_booking_price(
      'f1000000-0000-4000-8000-000000000008', 1000, 'no permission')$$,
  'WP031', null,
  'and perm:manual_price_change is still the gate, unchanged [§6.4, docs/5 §2]');

reset role;


set local role authenticated;
set local request.jwt.claims = '{"sub":"f1111111-1111-4111-8111-111111111111","email":"hard.reception@example.test"}';

select throws_ok(
  $$select public.record_booking_payment(
      'f1000000-0000-4000-8000-000000000003', 'cash', 95000, null, null, 'cash on a comp')$$,
  'WP033', null,
  'A COMPLIMENTARY BOOKING CANNOT TAKE MONEY. The zero-amount rule was checked '
  'against the payment method and never against the booking [§11.2, INV-20]');

select is(
  (select p.booking_comped::text
     from public.record_booking_payment(
       'f1000000-0000-4000-8000-000000000003', 'complimentary', 0, null, null,
       'the ordinary comp') p),
  'true',
  'a zero complimentary payment against a complimentary booking is still the '
  'ordinary way a comp is recorded, and still works');

select throws_ok(
  $$select public.record_booking_payment(
      'f1000000-0000-4000-8000-000000000004', 'complimentary', 0, null, null, 'comp it away')$$,
  'WP034', null,
  'A BOOKING HOLDING PAID MONEY CANNOT BE COMPED. It used to flip '
  'is_complimentary true while 80000 fils stayed paid, which makes one of the '
  'two §11.2 numbers wrong whichever way that report is written');

select is(
  (select p.booking_comped::text
     from public.record_booking_payment(
       'f1000000-0000-4000-8000-000000000005', 'complimentary', 0, null, null,
       'comp after a full refund') p),
  'true',
  'but a booking whose payment was FULLY REFUNDED may be comped — the money '
  'went back, so nothing is double-counted');

select is(
  (select p.booking_comped::text
     from public.record_booking_payment(
       'f1000000-0000-4000-8000-000000000008', 'complimentary', 0, null, null,
       'comp a booking that never paid') p),
  'true',
  'and a booking that never took a payment comps as it always did');

reset role;

select is(
  (select b.is_complimentary::text
     from public.bookings b where b.id = 'f1000000-0000-4000-8000-000000000004'),
  'false',
  'the refused comp left the booking alone — a raise aborts the statement, so '
  'the flag never moved [R-14]');


set local role authenticated;
set local request.jwt.claims = '{"sub":"f1111111-1111-4111-8111-111111111111","email":"hard.reception@example.test"}';

select lives_ok(
  $$select public.create_reception_booking(
      'walk_in', 'mr', 'Buffer', 'Zero', 'buffer.zero@example.test',
      date '1990-01-01', '+971500004010', 'AE',
      timestamptz '2028-01-05 10:00+04', 2, 0, 2, null, '[]'::jsonb, null, null,
      '{"total_fils":1}'::jsonb, false, '[]'::jsonb, 'zero buffer')$$,
  'RECEPTION MAY SET A BUFFER OTHER THAN THE CONFIGURED ONE, because '
  'perm:override_suite_allocation is now fixed to reception. Without that '
  'permission the call still raises WP035 [§7.1; Project owner''s direction, 17 September 2026]');

insert into hard_buffer_probe
select 'null-buffer', c.booking_id
  from public.create_reception_booking(
    'walk_in', 'mr', 'Buffer', 'Null', 'buffer.null@example.test',
    date '1990-01-01', '+971500004011', 'AE',
    timestamptz '2028-01-06 10:00+04', 2, null, 2, null, '[]'::jsonb, null, null,
    '{"total_fils":1}'::jsonb, false, '[]'::jsonb, 'null buffer') c;

insert into hard_buffer_probe
select 'same-as-default', c.booking_id
  from public.create_reception_booking(
    'walk_in', 'mr', 'Buffer', 'Same', 'buffer.same@example.test',
    date '1990-01-01', '+971500004012', 'AE',
    timestamptz '2028-01-07 10:00+04', 2, 20, 2, null, '[]'::jsonb, null, null,
    '{"total_fils":1}'::jsonb, false, '[]'::jsonb, 'same as default') c;

select is(
  (select b.cleaning_buffer_minutes
     from hard_buffer_probe p join public.bookings b on b.id = p.booking_id
    where p.label = 'null-buffer'),
  20,
  'A NULL BUFFER READS cleaning.buffer_minutes from public.settings [R-05]. The '
  'caller no longer has to know the number, which is what made passing zero '
  'possible in the first place');

select is(
  (select b.cleaning_buffer_minutes
     from hard_buffer_probe p join public.bookings b on b.id = p.booking_id
    where p.label = 'same-as-default'),
  20,
  'and passing the configured value explicitly is accepted from anyone — the '
  'console sends exactly this and must keep working unchanged');

reset role;

select is(
  (select upper(o.blocked_period) - upper(o.experience_period)
     from public.suite_occupancy o
     join public.bookings b on b.occupancy_id = o.id
    where b.experience_period = tstzrange(
      timestamptz '2028-01-06 10:00+04', timestamptz '2028-01-06 12:00+04', '[)')),
  interval '20 minutes',
  'and the buffer reaches the exclusion constraint: blocked_period runs twenty '
  'minutes past the experience, which is the §7.1 worked example [INV-06]');

set local role authenticated;
set local request.jwt.claims = '{"sub":"f2222222-2222-4222-8222-222222222222","email":"hard.management@example.test"}';

select throws_ok(
  $$select public.create_reception_booking(
      'walk_in', 'mr', 'Buffer', 'Mgmt', 'buffer.mgmt@example.test',
      date '1990-01-01', '+971500004013', 'AE',
      timestamptz '2028-01-08 10:00+04', 2, 0, 2, null, '[]'::jsonb, null, null,
      '{"total_fils":1}'::jsonb, false, '[]'::jsonb, 'management tries zero')$$,
  'WP057', null,
  'MANAGEMENT ALONE IS REFUSED TOO, and since 20260910150000 for a plainer '
  'reason than the missing grant: taking a walk-in is desk work and the desk is '
  'closed to Management. docs/5 §2 still says override_suite_allocation is '
  'granted by neither role implicitly, which the receptionist above proves '
  '[CLIENT 10 September 2026, §7.2]');

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"f3333333-3333-4333-8333-333333333333","email":"hard.override@example.test"}';

insert into hard_buffer_probe
select 'authorised-override', c.booking_id
  from public.create_reception_booking(
    'walk_in', 'mr', 'Buffer', 'Over', 'buffer.over@example.test',
    date '1990-01-01', '+971500004014', 'AE',
    timestamptz '2028-01-09 10:00+04', 2, 0, 2, null, '[]'::jsonb, null, null,
    '{"total_fils":1}'::jsonb, false, '[]'::jsonb, 'authorised zero buffer') c;

select is(
  (select b.cleaning_buffer_minutes
     from hard_buffer_probe p join public.bookings b on b.id = p.booking_id
    where p.label = 'authorised-override'),
  0,
  'a reception account HOLDING perm:override_suite_allocation may depart from '
  'the default — §7.1 allows an authorised override, it is the unauthorised one '
  'that was the defect');

reset role;

select is(
  (select e.new_value ->> 'buffer_is_configured'
     from audit.entries e
    where e.action = 'create_reception_booking'
      and e.new_value ->> 'cleaning_buffer_minutes' = '0'
    order by e.id desc limit 1),
  'false',
  'and the audit entry says the buffer was not the configured one, so §11 can '
  'find the overrides without re-deriving them [INV-13]');

select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'create_reception_booking'),
  1,
  'still exactly one create_reception_booking and no overload — a second '
  'signature would let a stale caller reach the unguarded version');

select is(
  (select p.pronargs::int from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'create_reception_booking'),
  20,
  'and it still takes twenty arguments, because src/lib/db/rpc.ts sends twenty '
  'named ones and this fix was not allowed to change them');


select is(
  coalesce(current_setting('role', true), 'unset'),
  'none',
  'the role GUC reads none on a direct database connection that never issued '
  'SET ROLE, which is the migration and seed call site [§11]');

set local role authenticated;

select is(
  coalesce(current_setting('role', true), 'unset'),
  'authenticated',
  'and it reads the switched role afterwards. THIS IS THE ONLY IDENTITY THAT '
  'SURVIVES INTO A DEFINER-PRIVILEGED FUNCTION: current_user reports the owner '
  'there, and session_user reports authenticator on a hosted project, which is '
  'a member of every one of the three API roles');

reset role;

set local role service_role;

select is(
  coalesce(current_setting('role', true), 'unset'),
  'service_role',
  'and it reads service_role for the worker, which is what lets the four §9.3 '
  'and §12 functions admit the cron explicitly instead of admitting an absent '
  'identity');

reset role;

select ok(
  pg_has_role('authenticator', 'service_role', 'member'),
  'MEANWHILE authenticator IS A MEMBER OF service_role, which is why '
  'pg_has_role(session_user, ...) was rejected as the test: it is true for '
  'every request that ever arrives and would have looked like a fix');


set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';

select throws_ok(
  $$select public.open_alert('arrival_overdue', 'warning', 'public.bookings', 'probe-a', null)$$,
  'WP036', null,
  'A SESSION WITH NO STAFF IDENTITY CANNOT RAISE AN ALERT. The old guard fired '
  'only when a sub claim was present and did not resolve, so a token carrying '
  'no sub at all walked straight through [§9.3]');

select throws_ok(
  $$select public.resolve_alert('f9000000-0000-4000-8000-000000000001', 'note')$$,
  'WP036', null,
  'nor resolve one');

select throws_ok(
  $$select public.queue_message(
      'booking_confirmation', 'email', null, null, 'a@b.co', 's', 'b')$$,
  'WP036', null,
  'nor queue a message [§12]');

select throws_ok(
  $$select public.record_message_attempt(
      'f3000000-0000-4000-8000-000000000001', 'sent', 'x', null)$$,
  'WP036', null,
  'nor record a delivery attempt [§12, §11.5]');

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"f9999999-9999-4999-8999-999999999999","role":"authenticated"}';

select throws_ok(
  $$select public.open_alert('arrival_overdue', 'warning', 'public.bookings', 'probe-b', null)$$,
  'WP008', null,
  'WP008 KEEPS ITS EXACT MEANING — a session presenting a staff id that is not '
  'an active staff member. Nothing reading that code changes');

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"f4444444-4444-4444-8444-444444444444","role":"authenticated"}';

select throws_ok(
  $$select public.open_alert('arrival_overdue', 'warning', 'public.bookings', 'probe-c', null)$$,
  'WP008', null,
  'including a deactivated account');

reset role;

set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';

select is(
  (select a.is_new::text
     from public.open_alert(
       'arrival_overdue', 'warning', 'public.bookings', 'probe-worker', null) a),
  'true',
  'THE CRON PATH STILL WORKS. A7 refused to require is_staff() here because a '
  '§9.3 scan runs with no user session, and a fix that broke it would silently '
  'stop every alert from ever being raised in production — far worse than the '
  'gap it closed');

select is(
  (select m.status::text
     from public.queue_message(
       'booking_confirmation', 'email', null, null, 'worker@example.test', 's', 'b') m),
  'queued',
  'and so does the §12 queue worker');

select is(
  (select m.attempt_count
     from public.record_message_attempt(
       'f3000000-0000-4000-8000-000000000001', 'sent', 'prov-1', null) m),
  1,
  'and so does the delivery worker recording an attempt');

select ok(
  not internal.is_staff(),
  'and none of that came from a staff session — the worker is admitted as the '
  'worker, explicitly, which is the whole point of the change');

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"f1111111-1111-4111-8111-111111111111","email":"hard.reception@example.test"}';

select is(
  (select a.is_new::text
     from public.open_alert(
       'arrival_overdue', 'warning', 'public.bookings', 'probe-staff', null) a),
  'true',
  'and Reception still raises alerts as it always did');

select is(
  (select (r.resolved_by = 'f1111111-1111-4111-8111-111111111111')::text
     from public.alerts a,
          lateral public.resolve_alert(a.id, 'cleared at the desk') r
    where a.entity_id = 'probe-staff' and a.resolved_at is null),
  'true',
  'and still resolves them under its own name [§9.3]');

reset role;

select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('open_alert', 'resolve_alert', 'queue_message',
                        'record_message_attempt', 'create_reception_booking',
                        'record_booking_payment', 'set_manual_booking_price')
      and has_function_privilege('anon', p.oid, 'execute')),
  0,
  'and the unauthenticated role reaches none of the seven functions this '
  'migration replaced [INV-01, §13]');

select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('open_alert', 'resolve_alert', 'queue_message',
                        'record_message_attempt', 'create_reception_booking',
                        'record_booking_payment', 'set_manual_booking_price')
      and array_to_string(p.proconfig, ' ') = 'search_path=""'
      and p.prosecdef),
  7,
  'every one of the seven still pins an empty search_path and still runs with '
  'the definer privileges [R-15]');


select * from finish();
rollback;
