begin;
select plan(82);

update public.suites set is_active = false;

insert into public.suites (suite_number, priority, status, is_active) values
  (9101, 9110, 'available',   true),
  (9102, 9120, 'available',   true),
  (9103, 9130, 'maintenance', true);

insert into public.staff (id, email, full_name, role) values
  ('d1111111-1111-4111-8111-111111111111', 'br.reception@example.test',  'BR Reception',  'reception'),
  ('d2222222-2222-4222-8222-222222222222', 'br.management@example.test', 'BR Management', 'management'),
  ('d3333333-3333-4333-8333-333333333333', 'br.override@example.test',   'BR Override',   'reception');

insert into public.staff_permissions (staff_id, permission) values
  ('d3333333-3333-4333-8333-333333333333', 'override_suite_allocation');

insert into public.addons
  (id, name, regular_price_fils, offer_price_fils, min_quantity, max_quantity) values
  ('d4444444-4444-4444-8444-444444444444', 'Test Robe', 5000, 5000, 1, 2);

insert into public.customers
  (id, first_name, last_name, email, phone_e164, phone_country, date_of_birth, is_blocked)
values
  ('d5555555-5555-4555-8555-555555555555', 'Blocked', 'Guest',
   'br.blocked@example.test', '+971500009999', 'AE', date '1985-01-01', true);

create temp table bk (label text primary key, id uuid);
grant all on bk to public;

create temp table snap (
  label            text,
  booking_status   text,
  experience_from  timestamptz,
  experience_to    timestamptz,
  suite_id         uuid,
  occupancy_id     uuid,
  occ_is_active    boolean,
  occ_status       text,
  blocked_from     timestamptz,
  blocked_to       timestamptz
);
grant all on snap to public;

create temp view booking_rpc_names as
  select unnest(array[
    'create_reception_booking', 'cancel_booking', 'reschedule_booking',
    'extend_booking', 'move_booking', 'override_booking_buffer',
    'update_booking_details'
  ]) as proname;
grant select on booking_rpc_names to public;



select has_function('public', 'create_reception_booking',
  'the §9.2 desk booking function exists');
select has_function('public', 'cancel_booking',      'cancellation exists [§9.2]');
select has_function('public', 'reschedule_booking',  'atomic reschedule exists [§7.6, INV-12]');
select has_function('public', 'extend_booking',      'planned extension exists [§7.6]');
select has_function('public', 'move_booking',        'the calendar move exists [§9.2]');
select has_function('public', 'override_booking_buffer',
  'the single-booking buffer override exists [§7.1]');
select has_function('public', 'update_booking_details',
  'the notes editor exists [§9.2]');

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
  'the create signature and its argument NAMES are the contract the typed '
  'wrapper in src/lib/db/rpc.ts is written against [R-02]');

select is(
  (select array_to_string(array(
     select p.proargnames[i]
       from pg_proc p, generate_subscripts(p.proargnames, 1) i
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'create_reception_booking'
        and p.proargmodes[i] = 't'
      order by i), ',')),
  'booking_id,reference,suite_id,suite_number',
  'it returns booking_id, reference, suite_id and suite_number — Reception '
  'sees suite numbers [§1.1] and this function is never granted to anon '
  '[INV-01]');

select is(
  (select count(*)::int from pg_proc p join booking_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace),
  7,
  'exactly seven functions and no overloads — a stale caller cannot reach a '
  'second signature');

select is(
  (select count(*)::int from pg_proc p join booking_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace and p.prosecdef),
  7,
  'every one is a definer function, so it writes past RLS deliberately [R-15]');

select is(
  (select count(*)::int from pg_proc p join booking_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace
      and array_to_string(p.proconfig, ' ') = 'search_path=""'),
  7,
  'every one pins search_path to empty [R-15]');

select is(
  (select count(*)::int from pg_proc p join booking_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace
      and p.proretset
      and p.prorettype <> 'void'::regtype),
  7,
  'every one returns a typed row set and never void [R-14]');

select is(
  (select count(*)::int from pg_proc p join booking_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('anon', p.oid, 'execute')),
  0,
  'anon holds EXECUTE on none of them — a booking write is a staff action '
  '[§13, docs/5 §3]');

select is(
  (select count(*)::int from pg_proc p join booking_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('authenticated', p.oid, 'execute')),
  7,
  'authenticated holds EXECUTE on all seven — Reception operates the venue '
  '[docs/5 §3]');

select is(
  (select count(*)::int from pg_proc p join booking_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('service_role', p.oid, 'execute')),
  7,
  'service_role holds EXECUTE — cron and the webhook worker have no user '
  'session');

select ok(
  not exists (
    select 1 from pg_proc p join booking_rpc_names n on n.proname = p.proname
     where p.pronamespace = 'public'::regnamespace
       and exists (
         select 1 from unnest(p.proargnames) an
          where an ilike '%suite_number%' and an like 'p\_%')),
  'no INPUT parameter is a suite number — a caller never selects a suite by '
  'the number a guest must not see [INV-01]');



set local role authenticated;
set local request.jwt.claims = '{"sub":"d1111111-1111-4111-8111-111111111111","email":"br.reception@example.test"}';

insert into bk (label, id)
select 'first', r.booking_id
  from public.create_reception_booking(
    'walk_in', 'mr', 'Adam', 'Stone', 'Adam.Stone@example.test',
    date '1990-05-05', '+971500001234', 'AE',
    timestamptz '2027-03-01 06:00:00+00', 3, 20,
    2, array[9]::integer[],
    '[{"addon_id":"d4444444-4444-4444-8444-444444444444","quantity":2}]'::jsonb,
    '  Quiet suite please  ', 'VIP referral',
    '{"subtotal_fils":50000,"discount_fils":2500,"addons_fils":10000,'
    '"service_fee_fils":3600,"tax_fils":0,"total_fils":61100}'::jsonb,
    false,
    '[{"document_slug":"legal-terms","document_version":"1.3",'
    '"checkbox_text":"I agree to WellPlace''s Legal, Privacy & Marketing Terms."}]'::jsonb,
    'Walk-in at the desk') r;

reset role;

select is(
  (select count(*)::int from bk where label = 'first'),
  1,
  'a walk-in returns exactly one row — reception may execute these [docs/5 §3]');

select is(
  (select b.status::text from public.bookings b join bk on bk.id = b.id
    where bk.label = 'first'),
  'confirmed',
  'a Reception booking starts confirmed — the guest is at the desk [§9.2]');

select ok(
  (select b.reference ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'
      and length(b.reference) between 6 and 32
     from public.bookings b join bk on bk.id = b.id where bk.label = 'first'),
  'the generated reference satisfies bookings_reference_shaped and its length '
  'bound [§9.1]');

select is(
  (select c.identity_key from public.customers c
     join public.bookings b on b.customer_id = c.id
     join bk on bk.id = b.id where bk.label = 'first'),
  'adam.stone@example.test',
  'the customer was created and keyed on the normalised email [§10.5, Q-1]');

select is(
  (select c.date_of_birth from public.customers c
     join public.bookings b on b.customer_id = c.id
     join bk on bk.id = b.id where bk.label = 'first'),
  date '1990-05-05',
  'the booker date of birth is stored on the customer record [§10.5]');

select is(
  (select array_agg(g.kind::text || coalesce(':' || g.age::text, '')
                    order by g.kind::text, g.age)
     from public.booking_guests g join bk on bk.id = g.booking_id
    where bk.label = 'first'),
  array['adult','adult','child:9'],
  'one row per guest, and only the child carries an age [§6.2]');

select is(
  (select g.name_snapshot || '/' || g.unit_price_fils::text || '/' ||
          g.quantity::text || '/' || g.line_total_fils::text
     from public.booking_addons g join bk on bk.id = g.booking_id
    where bk.label = 'first'),
  'Test Robe/5000/2/10000',
  'the add-on line snapshots the name and unit price standing today [§10.4, '
  'INV-21]');

select is(
  (select a.checkbox_text from public.acceptance_records a join bk on bk.id = a.booking_id
    where bk.label = 'first'),
  'I agree to WellPlace''s Legal, Privacy & Marketing Terms.',
  'the acceptance record stores the literal checkbox sentence, not a key to '
  'it [§6.3]');

select is(
  (select a.document_slug || '@' || a.document_version || ' from ' || a.source::text
     from public.acceptance_records a join bk on bk.id = a.booking_id
    where bk.label = 'first'),
  'legal-terms@1.3 from walk_in',
  'with the document slug, its version and where it was given [§6.3]');

select is(
  (select b.subtotal_fils::text || '/' || b.discount_fils::text || '/' ||
          b.addons_fils::text || '/' || b.service_fee_fils::text || '/' ||
          b.tax_fils::text || '/' || b.total_fils::text
     from public.bookings b join bk on bk.id = b.id where bk.label = 'first'),
  '50000/2500/10000/3600/0/61100',
  'the six priced values are stored verbatim and nothing was recomputed in '
  'SQL [INV-21]');

select is(
  (select b.personal_request || '|' || b.internal_note
     from public.bookings b join bk on bk.id = b.id where bk.label = 'first'),
  'Quiet suite please|VIP referral',
  'free text is trimmed on the way in');

select is(
  (select o.kind::text || '/' || o.status::text || '/' || o.is_active::text
     from public.suite_occupancy o
     join public.bookings b on b.occupancy_id = o.id
     join bk on bk.id = b.id where bk.label = 'first'),
  'booking/active/true',
  'the claim is one active booking row in public.suite_occupancy [§3, INV-02]');

select is(
  (select upper(o.blocked_period)
     from public.suite_occupancy o
     join public.bookings b on b.occupancy_id = o.id
     join bk on bk.id = b.id where bk.label = 'first'),
  timestamptz '2027-03-01 09:20:00+00',
  'a 06:00 start for three hours with a 20 minute buffer blocks to 09:20 — '
  'the §7.1 worked example falls out of the stored range [INV-06]');

select is(
  (select o.expires_at
     from public.suite_occupancy o
     join public.bookings b on b.occupancy_id = o.id
     join bk on bk.id = b.id where bk.label = 'first'),
  null::timestamptz,
  'a booking claim carries no expiry — only a hold does [§7.3]');

select ok(
  exists (select 1 from audit.entries e join bk on bk.id::text = e.entity_id
           where bk.label = 'first'
             and e.action = 'create_reception_booking'
             and e.actor_id = 'd1111111-1111-4111-8111-111111111111'
             and e.reason = 'Walk-in at the desk'
             and e.new_value ? 'reference'),
  'creating a booking wrote its own audit entry with the actor, the new value '
  'and the reason [§3, INV-13, R-14]');



set local role authenticated;

insert into bk (label, id)
select 'second', r.booking_id
  from public.create_reception_booking(
    'telephone', 'ms', 'Bea', 'Stone', 'bea.stone@example.test',
    date '1991-06-06', '+971500001235', 'AE',
    timestamptz '2027-03-01 06:00:00+00', 3, 20,
    2, null, null, null, null, null, false, null, 'Telephone booking') r;

reset role;

select ok(
  (select count(distinct b.suite_id)::int from public.bookings b join bk on bk.id = b.id
    where bk.label in ('first', 'second')) = 2,
  'a second booking for the same window is allocated a DIFFERENT suite — the '
  'exclusion constraint decides, not the caller [§7.5, INV-02]');

set local role authenticated;

select throws_ok(
  $$select public.create_reception_booking(
      'manual', 'mr', 'Cyril', 'Stone', 'cyril.stone@example.test',
      date '1992-07-07', '+971500001236', 'AE',
      timestamptz '2027-03-01 06:00:00+00', 3, 20,
      2, null, null, null, null, null, false, null, 'Third for the same slot')$$,
  'WP010', null,
  'a third booking for a window with only two free suites raises WP010 — the '
  'maintenance suite is never auto-allocated [§7.2, INV-07]');

select throws_ok(
  $$select public.create_reception_booking(
      'online', 'mr', 'Guest', 'Online', 'guest.online@example.test',
      date '1992-07-07', '+971500001237', 'AE',
      timestamptz '2027-04-01 06:00:00+00', 3, 20,
      2, null, null, null, null, null, false, null, null)$$,
  '22023', null,
  'p_source refuses online — the §6.1 guest flow holds first and pays before '
  'it has a booking');

select throws_ok(
  $$select public.create_reception_booking(
      'walk_in', 'mr', 'No', 'Birthday', 'no.birthday@example.test',
      null, '+971500001238', 'AE',
      timestamptz '2027-04-01 06:00:00+00', 3, 20,
      2, null, null, null, null, null, false, null, null)$$,
  'WP011', null,
  'a booking with no booker date of birth raises WP011 — A1 left the column '
  'nullable and put the requirement here [§10.5]');

select throws_ok(
  $$select public.create_reception_booking(
      'walk_in', 'mr', 'Too', 'Young', 'too.young@example.test',
      current_date - 4000, '+971500001239', 'AE',
      timestamptz '2027-04-01 06:00:00+00', 3, 20,
      2, null, null, null, null, null, false, null, null)$$,
  'WP011', null,
  'a booker under booking.booker_min_age raises WP011, and the age comes from '
  'public.settings [§6.2, R-05]');

select throws_ok(
  $$select public.create_reception_booking(
      'walk_in', 'mr', 'Too', 'Many', 'too.many@example.test',
      date '1990-01-01', '+971500001240', 'AE',
      timestamptz '2027-04-01 06:00:00+00', 3, 20,
      9, null, null, null, null, null, false, null, null)$$,
  'WP011', null,
  'more guests than booking.guests_max raises WP011 [§6.1]');

select throws_ok(
  $$select public.create_reception_booking(
      'walk_in', 'mr', 'Small', 'Child', 'small.child@example.test',
      date '1990-01-01', '+971500001241', 'AE',
      timestamptz '2027-04-01 06:00:00+00', 3, 20,
      2, array[3], null, null, null, null, false, null, null)$$,
  'WP011', null,
  'a child younger than booking.child_min_age raises WP011 [§6.2]');

select throws_ok(
  $$select public.create_reception_booking(
      'walk_in', 'ms', 'Blocked', 'Guest', 'br.blocked@example.test',
      date '1985-01-01', '+971500009999', 'AE',
      timestamptz '2027-04-01 06:00:00+00', 3, 20,
      2, null, null, null, null, null, false, null, null)$$,
  'WP012', null,
  'a blocked customer is refused with WP012 [§10.5]');

reset role;

select is(
  (select count(*)::int from public.bookings),
  2,
  'not one of the refused calls left a booking behind — each is one '
  'transaction [R-14]');



set local role authenticated;

insert into bk (label, id)
select 'later', r.booking_id
  from public.create_reception_booking(
    'manual', 'mr', 'Cyril', 'Stone', 'cyril.stone@example.test',
    date '1992-07-07', '+971500001236', 'AE',
    timestamptz '2027-03-01 12:00:00+00', 2, 20,
    2, null, null, null, null, null, false, null, 'Afternoon booking') r;

reset role;

insert into snap
select 'later', b.status::text, lower(b.experience_period), upper(b.experience_period),
       b.suite_id, b.occupancy_id, o.is_active, o.status::text,
       lower(o.blocked_period), upper(o.blocked_period)
  from public.bookings b
  join bk on bk.id = b.id
  join public.suite_occupancy o on o.id = b.occupancy_id
 where bk.label = 'later';

select is(
  (select count(*)::int
     from bk, lateral internal.reclaim_booking_window(
       bk.id,
       tstzrange(timestamptz '2027-03-01 06:00:00+00',
                 timestamptz '2027-03-01 09:00:00+00', '[)'),
       20, null, false, 'no room anywhere')
    where bk.label = 'later'),
  0,
  'the reclaim helper returns zero rows when nothing is free — it does not '
  'raise, so the caller chooses WP016 or WP010 [R-32]');

select is(
  (select b.status::text || '|' || lower(b.experience_period)::text || '|' ||
          upper(b.experience_period)::text || '|' || b.suite_id::text || '|' ||
          b.occupancy_id::text || '|' || o.is_active::text || '|' ||
          o.status::text || '|' || lower(o.blocked_period)::text || '|' ||
          upper(o.blocked_period)::text
     from public.bookings b
     join bk on bk.id = b.id
     join public.suite_occupancy o on o.id = b.occupancy_id
    where bk.label = 'later'),
  (select s.booking_status || '|' || s.experience_from::text || '|' ||
          s.experience_to::text || '|' || s.suite_id::text || '|' ||
          s.occupancy_id::text || '|' || s.occ_is_active::text || '|' ||
          s.occ_status || '|' || s.blocked_from::text || '|' || s.blocked_to::text
     from snap s where s.label = 'later'),
  'and the old claim is byte for byte what it was — the helper released it, '
  'found nothing, and rolled its own release back inside a subtransaction. '
  'This assertion does not depend on the caller raising [§7.6, INV-12]');

set local role authenticated;

select throws_ok(
  $$select public.reschedule_booking(
      (select id from bk where label = 'later'),
      timestamptz '2027-03-01 06:00:00+00', 'guest wants the morning', 3)$$,
  'WP016', null,
  'a reschedule with nowhere to go raises WP016 [§7.6]');

reset role;

select is(
  (select b.status::text || '|' || lower(b.experience_period)::text || '|' ||
          b.occupancy_id::text || '|' || o.is_active::text || '|' || o.status::text
     from public.bookings b
     join bk on bk.id = b.id
     join public.suite_occupancy o on o.id = b.occupancy_id
    where bk.label = 'later'),
  (select s.booking_status || '|' || s.experience_from::text || '|' ||
          s.occupancy_id::text || '|' || s.occ_is_active::text || '|' || s.occ_status
     from snap s where s.label = 'later'),
  'the §16.1 case: a failed atomic reschedule leaves the old booking and its '
  'occupancy row exactly as they were [INV-12]');



insert into snap
select 'first', b.status::text, lower(b.experience_period), upper(b.experience_period),
       b.suite_id, b.occupancy_id, o.is_active, o.status::text,
       lower(o.blocked_period), upper(o.blocked_period)
  from public.bookings b
  join bk on bk.id = b.id
  join public.suite_occupancy o on o.id = b.occupancy_id
 where bk.label = 'first';

set local role authenticated;

select is(
  (select r.experience_from::text || '|' || r.experience_to::text || '|' || r.status::text
     from bk, lateral public.reschedule_booking(
       bk.id, timestamptz '2027-03-02 06:00:00+00', 'guest moved a day', 3)  r
    where bk.label = 'first'),
  '2027-03-02 06:00:00+00|2027-03-02 09:00:00+00|confirmed',
  'a reschedule that can be satisfied returns the new window and keeps the '
  'status confirmed — statusAfter(reschedule, confirmed) is confirmed in '
  'src/lib/domain/booking, not the rescheduled label');

reset role;

select is(
  (select o.status::text || '/' || o.is_active::text
     from public.suite_occupancy o
     join snap s on s.occupancy_id = o.id
    where s.label = 'first'),
  'released/false',
  'the old claim is released by status and the row is still there [R-17] — '
  '§11.3 reads it and a delete would destroy the only record');

select ok(
  (select b.occupancy_id <> s.occupancy_id
     from public.bookings b join bk on bk.id = b.id
     join snap s on s.label = bk.label
    where bk.label = 'first'),
  'and the booking now points at the new claim [§3.1]');



set local role authenticated;

insert into bk (label, id)
select 'evening', r.booking_id
  from public.create_reception_booking(
    'walk_in', 'ms', 'Dana', 'Stone', 'dana.stone@example.test',
    date '1993-08-08', '+971500001242', 'AE',
    timestamptz '2027-03-01 14:30:00+00', 1, 20,
    2, null, null, null, null, null, false, null, 'Late afternoon') r;

reset role;

select is(
  (select count(distinct b.suite_id)::int from public.bookings b join bk on bk.id = b.id
    where bk.label in ('later', 'evening')),
  1,
  'the 14:30 booking lands on the same suite as the 12:00 one, which ends at '
  '14:00 and is blocked to 14:20 [§7.1]');

set local role authenticated;

select throws_ok(
  $$select public.extend_booking(
      (select id from bk where label = 'later'), 60, 'guest wants an hour more')$$,
  'WP015', null,
  'an extension that would reach the next booking or its cleaning buffer '
  'raises WP015 [§7.6]');

reset role;

select is(
  (select upper(o.blocked_period)
     from public.suite_occupancy o join public.bookings b on b.occupancy_id = o.id
     join bk on bk.id = b.id where bk.label = 'later'),
  timestamptz '2027-03-01 14:20:00+00',
  'and the refused extension changed nothing');

set local role authenticated;

select is(
  (select e.experience_to::text || '|' || e.blocked_to::text
     from bk, lateral public.extend_booking(bk.id, 5, 'five more minutes') e
    where bk.label = 'later'),
  '2027-03-01 14:05:00+00|2027-03-01 14:25:00+00',
  'an extension that keeps the later booking and its buffer protected is '
  'confirmed, and the buffer moves with it [§7.6, §7.1]');

reset role;

select is(
  (select upper(b.experience_period) from public.bookings b join bk on bk.id = b.id
    where bk.label = 'later'),
  timestamptz '2027-03-01 14:05:00+00',
  'the booking row and the occupancy row agree about the new end');



set local role authenticated;

select ok(
  internal.has_permission('override_suite_allocation'),
  'a receptionist now holds perm:override_suite_allocation by role, so the WP035 '
  'buffer guard is reached only by an account without it [§7.1, Q-19; Project '
  'owner''s direction, 17 September 2026]');

reset role;
set local request.jwt.claims = '{"sub":"d2222222-2222-4222-8222-222222222222","email":"br.management@example.test"}';
set local role authenticated;

select ok(
  internal.has_permission('override_suite_allocation'),
  'and Management holds it by role as well [§7.2, Q-19; OUR CHOICE, 17 September 2026]');

reset role;
set local request.jwt.claims = '{"sub":"d3333333-3333-4333-8333-333333333333","email":"br.override@example.test"}';
set local role authenticated;

select throws_ok(
  $$select public.override_booking_buffer(
      (select id from bk where label = 'later'), 60, 'long clean')$$,
  'WP068', null,
  'a buffer that would reach the next claim is refused with WP068, which names '
  'the time cleaning must finish by — the conflict check §7.1 requires');

select is(
  (select o.cleaning_buffer_minutes::text || '|' || o.blocked_to::text
     from bk, lateral public.override_booking_buffer(bk.id, 5, 'tight turnaround') o
    where bk.label = 'later'),
  '5|2027-03-01 14:10:00+00',
  'a receptionist holding perm:override_suite_allocation may override at the '
  'desk, and blocked_period is recomputed from the stored experience_period '
  '[§7.1, Q-19]');

reset role;

select is(
  (select b.cleaning_buffer_minutes from public.bookings b join bk on bk.id = b.id
    where bk.label = 'later'),
  5,
  'and bookings.cleaning_buffer_minutes is written too — the two columns must '
  'never disagree [§7.1]');

select ok(
  exists (select 1 from audit.entries e
           where e.action = 'override_booking_buffer'
             and e.actor_id = 'd3333333-3333-4333-8333-333333333333'::uuid
             and e.old_value ->> 'cleaning_buffer_minutes' = '20'
             and e.new_value ->> 'cleaning_buffer_minutes' = '5'
             and e.reason = 'tight turnaround'),
  'the override wrote an audit entry naming the receptionist who made it, '
  'with the old value, the new value and a reason [§7.1, §3, INV-13]');

reset role;
set local request.jwt.claims = '{"sub":"d1111111-1111-4111-8111-111111111111","email":"br.reception@example.test"}';
set local role authenticated;

select is(
  (select e.cleaning_buffer_minutes
     from bk, lateral public.override_booking_buffer(bk.id, 25, 'suite still being cleaned') e
    where bk.label = 'later'),
  25,
  'but that SAME receptionist, still without the grant, CAN reserve MORE '
  'cleaning time: extending only claims more of the suite''s own time and can '
  'never free a slot early, so it is not a suite-allocation override '
  '[CLIENT 11 September 2026]');

select lives_ok(
  $$select public.override_booking_buffer(
      (select id from bk where label = 'later'), 20, 'back to normal')$$,
  'and, holding the override by role, the receptionist may shorten it again '
  '[§7.1; Project owner''s direction, 17 September 2026]');

reset role;

select ok(
  exists (select 1 from audit.entries e
           where e.action = 'override_booking_buffer'
             and e.actor_id = 'd1111111-1111-4111-8111-111111111111'::uuid
             and e.old_value ->> 'cleaning_buffer_minutes' = '5'
             and e.new_value ->> 'cleaning_buffer_minutes' = '25'
             and e.reason = 'suite still being cleaned'),
  'and the extension is audited exactly like the override — actor, old value, '
  'new value and reason — so nothing about INV-13 was weakened');

set local request.jwt.claims = '{"sub":"d3333333-3333-4333-8333-333333333333","email":"br.override@example.test"}';
set local role authenticated;

select is(
  (select e.cleaning_buffer_minutes
     from bk, lateral public.override_booking_buffer(bk.id, 5, 'cleaning finished early') e
    where bk.label = 'later'),
  5,
  'and the account that DOES hold the grant can shorten it again, which is '
  'the half of §7.1 that still needs permission');

reset role;




set local request.jwt.claims = '{"sub":"d1111111-1111-4111-8111-111111111111","email":"br.reception@example.test"}';
set local role authenticated;

select ok(
  internal.has_permission('override_suite_allocation'),
  'reception may place a booking on a maintenance suite, because the override is '
  'fixed to its role [§7.2, §9.2; Project owner''s direction, 17 September 2026]');

reset role;
set local request.jwt.claims = '{"sub":"d2222222-2222-4222-8222-222222222222","email":"br.management@example.test"}';
set local role authenticated;

select ok(
  internal.has_permission('override_suite_allocation'),
  'and so may Management, which holds every named permission by role '
  '[§7.2; OUR CHOICE, 17 September 2026]');

reset role;
set local request.jwt.claims = '{"sub":"d3333333-3333-4333-8333-333333333333","email":"br.override@example.test"}';
set local role authenticated;

select is(
  (select m.suite_number::text || '|' || m.experience_from::text || '|' ||
          m.experience_to::text
     from bk, lateral public.move_booking(
       bk.id,
       (select id from public.suites where suite_number = 9103),
       timestamptz '2027-03-01 18:00:00+00', true, 'only suite left') m
    where bk.label = 'later'),
  '9103|2027-03-01 18:00:00+00|2027-03-01 20:05:00+00',
  'with the permission the move onto the maintenance suite succeeds and the '
  'duration is preserved [§9.2]');

reset role;

select is(
  (select upper(o.blocked_period)
     from public.suite_occupancy o join public.bookings b on b.occupancy_id = o.id
     join bk on bk.id = b.id where bk.label = 'later'),
  timestamptz '2027-03-01 20:10:00+00',
  'the moved claim carries the booking''s own overridden five minute buffer, '
  'not the settings default [§7.1]');

select ok(
  exists (select 1 from audit.entries e join bk on bk.id::text = e.entity_id
           where bk.label = 'later'
             and e.action = 'move_booking'
             and (e.new_value ->> 'allow_unavailable')::boolean
             and e.actor_id = 'd3333333-3333-4333-8333-333333333333'),
  'the move wrote an audit entry naming the actor who held the override '
  '[§3, INV-13]');



set local request.jwt.claims = '{"sub":"d1111111-1111-4111-8111-111111111111","email":"br.reception@example.test"}';
set local role authenticated;

select is(
  (select c.status::text
     from bk, lateral public.cancel_booking(bk.id, 'guest changed their mind') c
    where bk.label = 'second'),
  'cancelled',
  'a confirmed booking can be cancelled [§9.2]');

reset role;

select is(
  (select o.status::text || '/' || o.is_active::text
     from public.suite_occupancy o join public.bookings b on b.occupancy_id = o.id
     join bk on bk.id = b.id where bk.label = 'second'),
  'released/false',
  'the claim is released by status and the row survives [R-17, §11.3]');

set local role authenticated;

select throws_ok(
  $$select public.cancel_booking(
      (select id from bk where label = 'second'), 'again')$$,
  'WP014', null,
  'cancelling a cancelled booking raises WP014 — the database agrees with '
  'ACTION_RESULT.cancel in src/lib/domain/booking');

select throws_ok(
  $$select public.reschedule_booking(
      (select id from bk where label = 'second'),
      timestamptz '2027-03-05 06:00:00+00', 'try anyway', 3)$$,
  'WP014', null,
  'and a cancelled booking cannot be rescheduled — reschedule is legal only '
  'from confirmed');

select throws_ok(
  $$select public.extend_booking(
      (select id from bk where label = 'second'), 30, 'try anyway')$$,
  'WP014', null,
  'nor extended — extend is legal only from confirmed or checked_in');

select throws_ok(
  $$select public.cancel_booking(
      (select id from bk where label = 'first'), '   ')$$,
  '22023', null,
  'a blank reason is refused — §3 wants the audit entry to carry one');

select is(
  (select u.personal_request is null and u.internal_note = 'Called ahead'
     from bk, lateral public.update_booking_details(
       bk.id, '   ', ' Called ahead ', 'guest rang to add a note') u
    where bk.label = 'first'),
  true,
  'the notes editor trims, stores a blank as null, and touches nothing else '
  '[§9.2]');

reset role;

select is(
  (select array_agg(distinct e.action order by e.action)
     from audit.entries e
    where e.action in (
      'create_reception_booking', 'cancel_booking', 'reschedule_booking',
      'extend_booking', 'move_booking', 'override_booking_buffer',
      'update_booking_details')),
  array['cancel_booking','create_reception_booking','extend_booking',
        'move_booking','override_booking_buffer','reschedule_booking',
        'update_booking_details'],
  'every one of the seven mutations wrote its own audit entry [R-14, INV-13]');

select ok(
  not exists (select 1 from audit.entries e
               where e.action in (
                 'create_reception_booking', 'cancel_booking', 'reschedule_booking',
                 'extend_booking', 'move_booking', 'override_booking_buffer',
                 'update_booking_details')
                 and (e.actor_id is null or e.reason is null or e.entity_id is null)),
  'and not one of them was written without an actor, an entity id or a reason '
  '[§3, INV-13]');

select ok(
  exists (select 1 from audit.entries e where e.action = 'allocate_suite_booking'),
  'the allocator wrote its own entries as well — every claim on a suite is '
  'traceable [§3]');



set local request.jwt.claims = '';
set local role anon;

select throws_ok(
  $$select public.create_reception_booking(
      'walk_in', 'mr', 'An', 'On', 'an.on@example.test', date '1990-01-01',
      '+971500001299', 'AE', timestamptz '2027-05-01 06:00:00+00', 3, 20,
      2, null, null, null, null, null, false, null, null)$$,
  '42501', null,
  'anon cannot create a booking [§13, INV-01]');

select throws_ok(
  $$select public.cancel_booking(
      '00000000-0000-4000-8000-000000000000', 'because')$$,
  '42501', null,
  'anon cannot cancel one');

select throws_ok(
  $$select public.move_booking(
      '00000000-0000-4000-8000-000000000000',
      '00000000-0000-4000-8000-000000000000',
      timestamptz '2027-05-01 06:00:00+00', true, 'because')$$,
  '42501', null,
  'anon cannot move one');

select throws_ok(
  $$select public.update_booking_details(
      '00000000-0000-4000-8000-000000000000', 'x', 'y', 'because')$$,
  '42501', null,
  'anon cannot edit the notes on one');

reset role;


select * from finish();
rollback;
