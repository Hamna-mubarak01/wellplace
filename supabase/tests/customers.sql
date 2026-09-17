begin;
select plan(58);

insert into public.staff (id, email, full_name, role) values
  ('c1111111-1111-4111-8111-111111111111', 'cu.reception@example.test',  'CU Reception',  'reception'),
  ('c2222222-2222-4222-8222-222222222222', 'cu.management@example.test', 'CU Management', 'management');

select has_table('public', 'customers', 'the customer record exists [§10.5]');
select has_table('public', 'customer_tags', 'customer tags exist [§10.5]');
select has_table('public', 'customer_notes', 'customer notes exist [§10.5]');

select is(
  (select relrowsecurity from pg_class where oid = 'public.customers'::regclass),
  true,
  'RLS is enabled on customers [R-13]');
select is(
  (select relrowsecurity from pg_class where oid = 'public.customer_tags'::regclass),
  true,
  'RLS is enabled on customer_tags [R-13]');
select is(
  (select relrowsecurity from pg_class where oid = 'public.customer_notes'::regclass),
  true,
  'RLS is enabled on customer_notes [R-13]');

select hasnt_column('public', 'customers', 'marketing_status',
  'marketing status is NOT a column — history, not a boolean [§11.4]');
select has_column('public', 'marketing_consent_events', 'customer_id',
  'consent history can belong to a customer instead [§10.5, §11.4]');

select col_is_null('public', 'customers', 'date_of_birth',
  'date_of_birth is nullable — a customer record can pre-date a booking [OUR CHOICE]');

select has_index('public', 'customers', 'customers_identity_key_idx',
  'the identity key is indexed [Q-1]');
select has_index('public', 'customers', 'customers_last_interaction_at_idx',
  'the retention anchor is indexed [INV-28, R-46]');

select lives_ok(
  $$insert into public.customers
      (id, salutation, first_name, last_name, email, phone_e164, phone_country)
    values ('d0000000-0000-4000-8000-000000000001','ms','Dupe','Customer',
            'dupe@example.test','+971500000001','AE')$$,
  'a customer with no date of birth is accepted [§10.5, OUR CHOICE]');

select is(
  (select identity_key from public.customers
    where id = 'd0000000-0000-4000-8000-000000000001'),
  'dupe@example.test',
  'identity_key is the normalised email [Q-1 ASSUMED]');

select throws_ok(
  $$insert into public.customers (first_name, last_name, email, phone_e164, phone_country)
    values ('Space','Padded','  dupe@example.test ','+971500000002','AE')$$,
  '23505', null,
  'a whitespace-padded duplicate is rejected by the identity index [Q-1]');

select throws_ok(
  $$insert into public.customers (first_name, last_name, email, phone_e164, phone_country)
    values ('Dot','Suffixed','dupe@example.test.','+971500000002','AE')$$,
  '23505', null,
  'a trailing-dot duplicate is rejected by the identity index [Q-1]');

select throws_ok(
  $$insert into public.customers (first_name, last_name, email, phone_e164, phone_country)
    values ('Bad','Email','notanemail','+971500000002','AE')$$,
  '23514', null,
  'an unshaped email is refused');

select throws_ok(
  $$insert into public.customers (first_name, last_name, email, phone_e164, phone_country)
    values ('Upper','Email','Mixed@Example.test','+971500000002','AE')$$,
  '23514', null,
  'an uppercase email is refused, so the identity key cannot be case-forked');

select throws_ok(
  $$insert into public.customers (first_name, last_name, email, phone_e164, phone_country)
    values ('Tiny','Email','a@','+971500000002','AE')$$,
  '23514', null,
  'a too-short email is refused');

select throws_ok(
  $$insert into public.customers (first_name, last_name, email, phone_e164, phone_country)
    values ('No','Plus','no.plus@example.test','0501234567','AE')$$,
  '23514', null,
  'a phone number without a country code is refused [§6.1]');

select throws_ok(
  $$insert into public.customers (first_name, last_name, email, phone_e164, phone_country)
    values ('Zero','Lead','zero.lead@example.test','+0501234567','AE')$$,
  '23514', null,
  'a phone number with a leading zero country code is refused');

select throws_ok(
  $$insert into public.customers (first_name, last_name, email, phone_e164, phone_country)
    values ('Short','Phone','short.phone@example.test','+97150','AE')$$,
  '23514', null,
  'a phone number below E.164 length is refused');

select throws_ok(
  $$insert into public.customers (first_name, last_name, email, phone_e164, phone_country)
    values ('Lower','Country','lower.country@example.test','+971500000002','ae')$$,
  '23514', null,
  'a lowercase country code is refused');

select throws_ok(
  $$insert into public.customers (first_name, last_name, email, phone_e164, phone_country)
    values ('Long','Country','long.country@example.test','+971500000002','ARE')$$,
  '23514', null,
  'a three-letter country code is refused — ISO 3166-1 alpha-2 only');

select throws_ok(
  $$insert into public.customers
      (first_name, last_name, email, phone_e164, phone_country, date_of_birth)
    values ('Future','Birth','future.birth@example.test','+971500000002','AE',
            current_date + 1)$$,
  '23514', null,
  'a date of birth in the future is refused [§6.2]');

select throws_ok(
  $$insert into public.customers (first_name, last_name, email, phone_e164, phone_country)
    values ('','Empty','empty.name@example.test','+971500000002','AE')$$,
  '23514', null,
  'an empty first name is refused');

select lives_ok(
  $$insert into public.customers
      (id, first_name, last_name, email, phone_e164, phone_country, date_of_birth)
    values ('d0000000-0000-4000-8000-000000000004','Dated','Customer',
            'dated@example.test','+971500000004','AE', date '1990-06-15')$$,
  'a plausible date of birth is stored [§10.5]');

insert into public.customers
  (id, first_name, last_name, email, phone_e164, phone_country, created_at, updated_at)
values
  ('d0000000-0000-4000-8000-000000000003','Trig','Ger','trigger@example.test',
   '+971500000003','AE', timestamptz '2020-01-01 00:00:00+00', timestamptz '2020-01-01 00:00:00+00');

update public.customers set first_name = 'Trigger'
 where id = 'd0000000-0000-4000-8000-000000000003';

select is(
  (select updated_at from public.customers
    where id = 'd0000000-0000-4000-8000-000000000003'),
  now(),
  'the updated_at trigger fires on every update [R-16]');

select is(
  (select created_at from public.customers
    where id = 'd0000000-0000-4000-8000-000000000003'),
  timestamptz '2020-01-01 00:00:00+00',
  'created_at is never rewritten by the trigger');

update public.customers set updated_at = timestamptz '2020-01-01 00:00:00+00'
 where id = 'd0000000-0000-4000-8000-000000000003';

select is(
  (select updated_at from public.customers
    where id = 'd0000000-0000-4000-8000-000000000003'),
  now(),
  'a caller cannot backdate updated_at by hand');

select lives_ok(
  $$insert into public.customer_tags (customer_id, tag, created_by)
    values ('d0000000-0000-4000-8000-000000000001','vip',
            'c2222222-2222-4222-8222-222222222222')$$,
  'a customer can be tagged [§10.5]');

select throws_ok(
  $$insert into public.customer_tags (customer_id, tag)
    values ('d0000000-0000-4000-8000-000000000001','VIP')$$,
  '23514', null,
  'an uppercase tag is refused, so one tag cannot become two');

select throws_ok(
  $$insert into public.customer_tags (customer_id, tag)
    values ('d0000000-0000-4000-8000-000000000001','vip')$$,
  '23505', null,
  'the same tag cannot be attached twice [§10.5]');

select throws_ok(
  $$insert into public.customer_tags (customer_id, tag)
    values ('d0000000-0000-4000-8000-000000000001','')$$,
  '23514', null,
  'an empty tag is refused');

select lives_ok(
  $$insert into public.customer_notes (customer_id, body, author_id)
    values ('d0000000-0000-4000-8000-000000000001','Prefers the quiet suite.',
            'c1111111-1111-4111-8111-111111111111')$$,
  'a note can be written against a customer [§10.5]');

select throws_ok(
  $$insert into public.customer_notes (customer_id, body)
    values ('d0000000-0000-4000-8000-000000000001','    ')$$,
  '23514', null,
  'a blank note is refused');

insert into public.customers
  (id, first_name, last_name, email, phone_e164, phone_country)
values
  ('d0000000-0000-4000-8000-000000000002','Cascade','Customer',
   'cascade@example.test','+971500000005','AE');

insert into public.customer_tags (customer_id, tag)
  values ('d0000000-0000-4000-8000-000000000002','returning');
insert into public.customer_notes (customer_id, body)
  values ('d0000000-0000-4000-8000-000000000002','Deleted with the customer.');
insert into public.marketing_consent_events (customer_id, granted, origin)
  values ('d0000000-0000-4000-8000-000000000002', false, 'console_manual');

delete from public.customers where id = 'd0000000-0000-4000-8000-000000000002';

select is(
  (select count(*)::int from public.customer_tags
    where customer_id = 'd0000000-0000-4000-8000-000000000002'),
  0,
  'tags are removed with the customer [INV-28]');

select is(
  (select count(*)::int from public.customer_notes
    where customer_id = 'd0000000-0000-4000-8000-000000000002'),
  0,
  'notes are removed with the customer [INV-28]');

select is(
  (select count(*)::int from public.marketing_consent_events
    where customer_id = 'd0000000-0000-4000-8000-000000000002'),
  0,
  'consent history is removed with the customer [INV-28, R-46]');

select lives_ok(
  $$insert into public.marketing_consent_events
      (customer_id, granted, origin, consent_text)
    values ('d0000000-0000-4000-8000-000000000001', true, 'console_manual',
            'I agree to WellPlace''s Legal, Privacy & Marketing Terms.')$$,
  'a consent event can belong to a customer [§10.5]');

insert into public.marketing_consent_events (customer_id, granted, origin)
  values ('d0000000-0000-4000-8000-000000000001', false, 'console_manual');

select is(
  (select ev.granted from public.marketing_consent_events ev
    where ev.customer_id = 'd0000000-0000-4000-8000-000000000001'
    order by ev.seq desc limit 1),
  false,
  'marketing status is derived from the newest event, never a stored flag [§11.4]');

insert into public.waitlist_entries
  (salutation, first_name, last_name, email, date_of_birth, phone_e164, phone_country)
values
  ('mr','Wait','List','wait.list@example.test', date '1990-01-01','+971500000009','AE');

select throws_ok(
  $$insert into public.marketing_consent_events
      (waitlist_entry_id, customer_id, granted, origin)
    values ((select id from public.waitlist_entries where email = 'wait.list@example.test'),
            'd0000000-0000-4000-8000-000000000001', false, 'console_manual')$$,
  '23514', null,
  'a consent event cannot belong to a waitlist entry AND a customer');

select throws_ok(
  $$insert into public.marketing_consent_events
      (waitlist_entry_id, customer_id, granted, origin)
    values (null, null, false, 'console_manual')$$,
  '23514', null,
  'a consent event cannot belong to nobody');

set local role authenticated;
set local request.jwt.claims = '{"sub":"c1111111-1111-4111-8111-111111111111"}';

select is(
  (select count(*)::int from public.customers where email = 'dupe@example.test'),
  1,
  'reception: CAN read a customer record — §9.1 search by name, mobile, email');

select is(
  (select count(*)::int from public.customer_tags
    where customer_id = 'd0000000-0000-4000-8000-000000000001'),
  1,
  'reception: CAN read customer tags [§9.1, §10.5]');

select is(
  (select count(*)::int from public.customer_notes
    where customer_id = 'd0000000-0000-4000-8000-000000000001'),
  1,
  'reception: CAN read customer notes and warnings [§9.1, §10.5]');

select throws_ok(
  $$insert into public.customers (first_name, last_name, email, phone_e164, phone_country)
    values ('Sneak','Insert','sneak@example.test','+971500000006','AE')$$,
  '42501', null,
  'reception: CANNOT create a customer directly — RPC only [R-02]');

select throws_ok(
  $$update public.customers set last_name = 'Rewritten'
     where id = 'd0000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'reception: CANNOT correct a customer record [§10.5 perm:correct_customer_record]');

select throws_ok(
  $$delete from public.customers where id = 'd0000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'reception: CANNOT delete a customer record [§10.5]');

select throws_ok(
  $$insert into public.customer_notes (customer_id, body)
    values ('d0000000-0000-4000-8000-000000000001','Written without an audit entry.')$$,
  '42501', null,
  'reception: CANNOT write a note directly — every write is audited [R-02, INV-13]');

select throws_ok(
  $$insert into public.customer_tags (customer_id, tag)
    values ('d0000000-0000-4000-8000-000000000001','sneaky')$$,
  '42501', null,
  'reception: CANNOT tag directly — RPC only [R-02]');

select ok(internal.has_permission('correct_customer_record'),
  'reception: customer correction by role, still only through an audited RPC [Project owner''s direction, 17 September 2026]');

set local request.jwt.claims = '{"sub":"c2222222-2222-4222-8222-222222222222"}';

select is(
  (select count(*)::int from public.customers where email = 'dupe@example.test'),
  1,
  'management: CAN read a customer record [§10.5]');

select throws_ok(
  $$insert into public.customers (first_name, last_name, email, phone_e164, phone_country)
    values ('Management','Insert','mgmt.insert@example.test','+971500000007','AE')$$,
  '42501', null,
  'management: creates customers through an RPC so the change is audited [R-02, INV-13]');

select ok(internal.has_permission('correct_customer_record'),
  'management: customer correction by role [§10.5 ASSUMED]');

reset role;
set local role anon;

select throws_ok(
  $$select * from public.customers$$, '42501', null,
  'anon: CANNOT read customer records [§13]');

select throws_ok(
  $$select * from public.customer_tags$$, '42501', null,
  'anon: CANNOT read customer tags [§13]');

select throws_ok(
  $$select * from public.customer_notes$$, '42501', null,
  'anon: CANNOT read customer notes [§13]');

select throws_ok(
  $$insert into public.customers (first_name, last_name, email, phone_e164, phone_country)
    values ('Anon','Insert','anon.insert@example.test','+971500000008','AE')$$,
  '42501', null,
  'anon: CANNOT create a customer record [R-02, §13]');

reset role;
select * from finish();
rollback;
