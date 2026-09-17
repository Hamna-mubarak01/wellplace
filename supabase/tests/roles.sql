

begin;
select plan(35);

insert into public.staff (id, email, full_name, role) values
  ('11111111-1111-4111-8111-111111111111', 'test.reception@example.test', 'Test Reception', 'reception'),
  ('22222222-2222-4222-8222-222222222222', 'test.management@example.test','Test Management','management'),
  ('33333333-3333-4333-8333-333333333333', 'test.deactivated@example.test','Test Deactivated','management');
update public.staff set is_active = false where id = '33333333-3333-4333-8333-333333333333';

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111"}';

select is(internal.current_staff_role()::text, 'reception',
  'reception: role resolves from the session');

select ok(internal.is_staff(),        'reception: is_staff() is true');
select ok(not internal.is_management(),'reception: is_management() is false');

select is((select count(*)::int from public.suites), 7,
  'reception: sees all seven suites [§9.1]');

select ok((select count(*)::int from public.settings) > 0,
  'reception: reads the configuration registry [§10.2]');
select ok(
  (select value is not null from public.settings where key = 'cleaning.buffer_minutes'),
  'reception: can read a specific business rule it needs to work [§10.2]');

select throws_ok(
  $$insert into public.suites (suite_number, priority) values (99, 990)$$,
  '42501', null,
  'reception: CANNOT create a suite [§10.3]');

select throws_ok(
  $$update public.suites set priority = 1 where suite_number = 1$$,
  '42501', null,
  'reception: CANNOT re-prioritise a suite [§10.3]');

select throws_ok(
  $$insert into public.staff (id, email, full_name, role)
    values ('44444444-4444-4444-8444-444444444444','sneak@example.test','Sneak','management')$$,
  '42501', null,
  'reception: CANNOT create a staff account [§10.6]');

select throws_ok(
  $$insert into public.staff_permissions (staff_id, permission)
    values ('11111111-1111-4111-8111-111111111111','view_confidential_figures')$$,
  '42501', null,
  'reception: CANNOT grant itself a permission [§10.6]');

select throws_ok(
  $$update public.settings set value = '99'::jsonb where key = 'cleaning.buffer_minutes'$$,
  '42501', null,
  'reception: CANNOT change a business rule [§10.2]');

select results_eq(
  $$select id from public.staff order by id$$,
  array['11111111-1111-4111-8111-111111111111'::uuid],
  'reception: sees its own staff row and no other [§10.6]');

select throws_ok(
  $$insert into public.suite_occupancy
      (suite_id, kind, experience_period, blocked_period, cleaning_buffer_minutes)
    select id, 'block',
      tstzrange(now(), now() + interval '2 hours'),
      tstzrange(now(), now() + interval '2 hours 20 minutes'), 20
    from public.suites limit 1$$,
  '42501', null,
  'reception: CANNOT write occupancy directly — RPC only [R-02, §7.5]');

select throws_ok(
  $$update public.staff set is_active = false
    where id = '22222222-2222-4222-8222-222222222222'$$,
  '42501', null,
  'reception: CANNOT deactivate a colleague [§10.6]');

select throws_ok(
  $$delete from public.staff_permissions
    where staff_id = '22222222-2222-4222-8222-222222222222'$$,
  '42501', null,
  'reception: CANNOT revoke another staff member''s permission [§10.6]');

select is((select count(*)::int from public.suite_occupancy), 0,
  'reception: CAN read occupancy, and sees an empty day [§9.1]');

select is((select count(*)::int from public.staff_permissions
           where staff_id = '22222222-2222-4222-8222-222222222222'), 0,
  'reception: cannot see another staff member''s permissions [§10.6]');

select ok(not internal.has_permission('view_confidential_figures'),
  'reception: no confidential figures without an explicit grant [§10.6]');
select ok(internal.has_permission('override_suite_allocation'),
  'reception: suite override by role [Project owner''s direction, 17 September 2026]');
select ok(not internal.has_permission('manual_price_change'),
  'reception: no manual price change without a grant [§6.4]');

set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222"}';

select ok(internal.is_management(), 'management: is_management() is true');

select is(
  (select count(*)::int from public.staff
   where id in ('11111111-1111-4111-8111-111111111111',
                '22222222-2222-4222-8222-222222222222',
                '33333333-3333-4333-8333-333333333333')), 3,
  'management: sees every staff row, including deactivated [§10.6]');

select throws_ok(
  $$insert into public.staff (id, email, full_name, role)
    values ('55555555-5555-4555-8555-555555555555','new.hire@example.test','New Hire','reception')$$,
  '42501', null,
  'management: creates accounts through an RPC, never a direct insert [R-02]');

select throws_ok(
  $$update public.settings set value = '25'::jsonb where key = 'cleaning.buffer_minutes'$$,
  '42501', null,
  'management: changes rules through an RPC so the change is audited [R-02, INV-13]');

select ok(internal.has_permission('view_confidential_figures'),
  'management: confidential figures by role [§10.6]');

select ok(internal.has_permission('override_suite_allocation'),
  'management: suite override by role [OUR CHOICE, 17 September 2026]');
select ok(internal.has_permission('manual_price_change'),
  'management: manual price by role [OUR CHOICE, 17 September 2026]');

reset role;
insert into public.staff_permissions (staff_id, permission)
  values ('11111111-1111-4111-8111-111111111111','view_confidential_figures');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111"}';
select ok(not internal.has_permission('view_confidential_figures'),
  'reception: a stored grant never adds confidential figures [Project owner''s direction, 17 September 2026]');

select ok(internal.has_permission('correct_customer_record'),
  'reception: customer correction by role [Project owner''s direction, 17 September 2026]');

set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333"}';
select ok(not internal.is_staff(),
  'deactivated account: resolves to no role at all [§10.6]');

reset role;
set local role anon;
select throws_ok($$select suite_number from public.suites$$, '42501', null,
  'anon: CANNOT read suites — no suite number can reach a guest [§3, INV-01]');
select throws_ok($$select * from public.suite_occupancy$$, '42501', null,
  'anon: CANNOT read occupancy [INV-01]');
select throws_ok($$select * from public.settings$$, '42501', null,
  'anon: CANNOT read business configuration [INV-01]');
select throws_ok($$select * from public.staff$$, '42501', null,
  'anon: CANNOT read the staff roster [§13]');
select throws_ok($$select * from public.staff_permissions$$, '42501', null,
  'anon: CANNOT read permissions [§13]');

reset role;
select * from finish();
rollback;
