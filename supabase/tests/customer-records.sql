begin;
select plan(14);

insert into public.staff (id, email, full_name, role) values
  ('cc000000-0000-4000-8000-0000000000f1', 'records.manager@example.test', 'Records Manager', 'management'),
  ('cc000000-0000-4000-8000-0000000000f2', 'records.desk@example.test', 'Records Desk', 'reception');

insert into public.customers (id, first_name, last_name, email, phone_e164, phone_country) values
  ('cc000000-0000-4000-8000-0000000000c1', 'Hana', 'Historied', 'records.history@example.test', '+971500000071', 'AE');

insert into public.bookings (id, reference, customer_id, source, status, experience_period, cleaning_buffer_minutes)
values ('cc000000-0000-4000-8000-0000000000b1', 'WPRECORD0001', 'cc000000-0000-4000-8000-0000000000c1', 'telephone', 'cancelled',
        tstzrange(timestamptz '2024-01-01 10:00+04', timestamptz '2024-01-01 12:00+04', '[)'), 20);

set local role authenticated;
set local request.jwt.claims = '{"sub":"cc000000-0000-4000-8000-0000000000f1","email":"records.manager@example.test"}';

select isnt(
  (select r.customer_id from public.create_customer('ms', 'Nour', 'Newcomer', 'Records.New@Example.test', date '1990-05-04',
    '+971500000072', 'ae', null, 'Customer created from the console') r),
  null,
  'Management adds a customer from the console [§10.5]');

select is(
  (select c.phone_country || ' ' || c.email from public.customers c where c.email = 'records.new@example.test'),
  'AE records.new@example.test',
  'the email is stored lower-cased and the country upper-cased');

select throws_ok(
  $$select * from public.create_customer(null, 'Nour', 'Again', 'records.new@example.test', null, '+971500000073', 'AE', null, 'Customer created from the console')$$,
  'WP087',
  'A customer with this email already exists. Search for them instead.',
  'a second customer with the same email is refused rather than duplicated [Q-1]');

select matches(
  (select r.reference from public.update_customer(
    (select c.id from public.customers c where c.email = 'records.new@example.test'),
    'mr', 'Nour', 'Renamed', null, '+971500000074', 'AE', 'Prefers mornings', 'Customer edited from the console') r),
  '^WP-C[0-9]+$',
  'Management edits a customer and gets their reference back');

select is(
  (select concat_ws('|', c.salutation, c.last_name, c.date_of_birth, c.phone_e164, c.internal_note, c.email)
     from public.customers c where c.email = 'records.new@example.test'),
  'mr|Renamed|+971500000074|Prefers mornings|records.new@example.test',
  'the edit changes the details and never the email');

select throws_ok(
  $$select * from public.update_customer('cc000000-0000-4000-8000-0000000000c1', null, 'Hana', 'Historied', null, '+971500000071', 'AE', null, '   ')$$,
  '22023',
  'A reason is required for this change.',
  'a blank reason is refused [INV-13]');

select throws_ok(
  $$select * from public.delete_customer('cc000000-0000-4000-8000-0000000000c1', 'Customer deleted from the console')$$,
  'WP088',
  'This customer has bookings or messages on record, so they cannot be deleted. Block them instead.',
  'a customer with a booking cannot be deleted, so the booking record survives');

select lives_ok(
  $$select * from public.delete_customer((select c.id from public.customers c where c.email = 'records.new@example.test'), 'Customer deleted from the console')$$,
  'Management deletes a customer with no history');

select is(
  (select count(*)::int from public.customers c where c.email = 'records.new@example.test'),
  0,
  'the deleted customer is gone');

set local request.jwt.claims = '{"sub":"cc000000-0000-4000-8000-0000000000f2","email":"records.desk@example.test"}';

select lives_ok(
  $$select * from public.create_customer(null, 'Desk', 'Allowed', 'records.desk.allowed@example.test', null, '+971500000075', 'AE', null, 'Customer created from the console')$$,
  'Reception adds a customer, because customer correction is fixed to its role [docs/5 §2; Project owner''s direction, 17 September 2026]');

select lives_ok(
  $$select * from public.update_customer('cc000000-0000-4000-8000-0000000000c1', null, 'Hana', 'Historied', null, '+971500000071', 'AE', null, 'Customer edited from the console')$$,
  'Reception edits a customer by role [docs/5 §2; Project owner''s direction, 17 September 2026]');

select throws_ok(
  $$select * from public.delete_customer('cc000000-0000-4000-8000-0000000000c1', 'Customer deleted from the console')$$,
  'WP088', null,
  'Reception passes the permission check to delete, and meets the same history rule Management does [docs/5 §2; Project owner''s direction, 17 September 2026]');

reset role;

select is(
  (select count(*)::int from audit.entries a
    where a.entity = 'public.customers'
      and a.entity_id = (select e.entity_id from audit.entries e
                          where e.action = 'create_customer' and e.new_value ->> 'email' = 'records.new@example.test')
      and a.action in ('create_customer', 'update_customer', 'delete_customer')),
  3,
  'adding, editing and deleting each write an audit entry [INV-13]');

select ok(
  not has_function_privilege('anon', 'public.create_customer(public.salutation, text, text, text, date, text, text, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.update_customer(uuid, public.salutation, text, text, date, text, text, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.delete_customer(uuid, text)', 'execute'),
  'a visitor with no session cannot run any of the customer record functions');

select * from finish();
rollback;
