begin;
select plan(24);

insert into public.customers (id, first_name, last_name, email, phone_e164, phone_country, last_interaction_at) values
  ('ae000000-0000-4000-8000-0000000000c1', 'Olda', 'Leadwell',     'retention.old.lead@example.test',     '+971500000051', 'AE', now() - interval '25 months'),
  ('ae000000-0000-4000-8000-0000000000c2', 'Rhea', 'Recentlead',   'retention.recent.lead@example.test',  '+971500000052', 'AE', now() - interval '1 month'),
  ('ae000000-0000-4000-8000-0000000000c3', 'Bo',   'Booker',       'retention.old.booker@example.test',   '+971500000053', 'AE', now() - interval '25 months'),
  ('ae000000-0000-4000-8000-0000000000c4', 'Cora', 'Contacted',    'retention.contacted@example.test',    '+971500000054', 'AE', now() - interval '25 months'),
  ('ae000000-0000-4000-8000-0000000000c5', 'Una',  'Unsubscribed', 'retention.unsubscribed@example.test', '+971500000055', 'AE', now() - interval '25 months'),
  ('ae000000-0000-4000-8000-0000000000c6', 'Nia',  'Noted',        'retention.noted@example.test',        '+971500000056', 'AE', now() - interval '25 months'),
  ('ae000000-0000-4000-8000-0000000000c7', 'Wes',  'Warned',       'retention.warned@example.test',       '+971500000057', 'AE', now() - interval '25 months'),
  ('ae000000-0000-4000-8000-0000000000c8', 'Bea',  'Blocked',      'retention.blocked@example.test',      '+971500000058', 'AE', now() - interval '25 months');

insert into public.bookings (id, reference, customer_id, source, status, experience_period, cleaning_buffer_minutes)
values ('ae000000-0000-4000-8000-0000000000b3', 'WPRETAIN0001', 'ae000000-0000-4000-8000-0000000000c3', 'telephone', 'cancelled',
        tstzrange(timestamptz '2024-01-01 10:00+04', timestamptz '2024-01-01 12:00+04', '[)'), 20);

insert into public.customer_notes (customer_id, body, created_at) values
  ('ae000000-0000-4000-8000-0000000000c1', 'Asked about gift vouchers', now() - interval '25 months'),
  ('ae000000-0000-4000-8000-0000000000c6', 'Asked for a quieter suite next time', now());
insert into public.customer_tags (customer_id, tag) values ('ae000000-0000-4000-8000-0000000000c1', 'enquiry');
insert into public.marketing_consent_events (customer_id, granted, origin, consent_text, occurred_at)
select v.customer_id, v.granted, e.origin, 'I agree', v.occurred_at
  from (select unnest(enum_range(null::public.consent_origin)) as origin limit 1) e
 cross join (values
   ('ae000000-0000-4000-8000-0000000000c1'::uuid, true,  now() - interval '25 months'),
   ('ae000000-0000-4000-8000-0000000000c5'::uuid, true,  now() - interval '26 months'),
   ('ae000000-0000-4000-8000-0000000000c5'::uuid, false, now())) v (customer_id, granted, occurred_at);

insert into audit.entries (occurred_at, action, entity, entity_id, old_value, new_value, reason)
values (now() - interval '25 months', 'set_customer_warning', 'public.customers', 'ae000000-0000-4000-8000-0000000000c1',
        '{"warning_note": null, "is_blocked": false}', '{"warning_note": null, "is_blocked": false}', 'Checked at the desk');

insert into public.messages (id, template_key, channel, customer_id, to_address, is_marketing, created_at) values
  ('ae000000-0000-4000-8000-0000000000e1', 'secure_link', 'email', 'ae000000-0000-4000-8000-0000000000c1',
   'retention.old.lead@example.test', false, now() - interval '25 months'),
  ('ae000000-0000-4000-8000-0000000000e4', 'secure_link', 'email', 'ae000000-0000-4000-8000-0000000000c4',
   'retention.contacted@example.test', false, now());

insert into internal.checkout_sessions (token, progress, consent, abandoned_minutes, customer_id, updated_at) values
  ('ae000000-0000-4000-8000-0000000000a1', '{}'::jsonb, '[]'::jsonb, 30, 'ae000000-0000-4000-8000-0000000000c1', now()),
  ('ae000000-0000-4000-8000-0000000000a2', '{}'::jsonb, '[]'::jsonb, 30, null, now() - interval '25 months');

insert into public.staff (id, email, full_name, role) values
  ('ae000000-0000-4000-8000-0000000000f1', 'retention.corrector@example.test', 'Retention Corrector', 'reception');
insert into public.staff_permissions (staff_id, permission) values
  ('ae000000-0000-4000-8000-0000000000f1', 'correct_customer_record');

create function pg_temp.fixtures() returns text[] language sql stable as $$
  select coalesce(array_agg(c.last_name order by c.last_name), '{}')
    from public.customers c
   where c.id in ('ae000000-0000-4000-8000-0000000000c1', 'ae000000-0000-4000-8000-0000000000c2',
                  'ae000000-0000-4000-8000-0000000000c3', 'ae000000-0000-4000-8000-0000000000c4',
                  'ae000000-0000-4000-8000-0000000000c5', 'ae000000-0000-4000-8000-0000000000c6',
                  'ae000000-0000-4000-8000-0000000000c7', 'ae000000-0000-4000-8000-0000000000c8')
$$;

create function pg_temp.sessions() returns jsonb language sql stable as $$
  select jsonb_build_object(
    'recent', exists (select 1 from internal.checkout_sessions s where s.token = 'ae000000-0000-4000-8000-0000000000a1'),
    'old',    exists (select 1 from internal.checkout_sessions s where s.token = 'ae000000-0000-4000-8000-0000000000a2'))
$$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"ae000000-0000-4000-8000-0000000000f1","email":"retention.corrector@example.test"}';

select is(
  (select r.warning_note from public.set_customer_warning('ae000000-0000-4000-8000-0000000000c7', 'Arrived late twice', null, 'Front desk report') r),
  'Arrived late twice',
  'a staff member with correct_customer_record sets a warning on an old lead today [§10.5]');

select is(
  (select r.is_blocked from public.set_customer_warning('ae000000-0000-4000-8000-0000000000c8', null, true, 'Payment dispute') r),
  true,
  'a staff member with correct_customer_record blocks an old lead today [§10.5]');

reset role;

set local client_min_messages = error;

update public.settings set value = null where key = 'privacy.retention_months';

select lives_ok($$select internal.purge_checkout_progress()$$,
  'the retention job runs while privacy.retention_months is unset [INV-28]');

select is(pg_temp.fixtures(), array['Blocked', 'Booker', 'Contacted', 'Leadwell', 'Noted', 'Recentlead', 'Unsubscribed', 'Warned'],
  'and deletes nothing while the retention period is unset [INV-28; SYSTEM.md Part 8]');

update public.settings set value = '24.5'::jsonb where key = 'privacy.retention_months';

select lives_ok($$select internal.purge_checkout_progress()$$,
  'a fractional retention period no longer makes the daily job fail with 22P02 [INV-28; OUR CHOICE — project owner''s direction, 13 September 2026]');

update public.settings set value = '"two years"'::jsonb where key = 'privacy.retention_months';

select lives_ok($$select internal.purge_checkout_progress()$$,
  'a text retention period no longer makes the daily job fail with 22P02 [INV-28; OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  jsonb_build_object('customers', pg_temp.fixtures(), 'sessions', pg_temp.sessions()),
  jsonb_build_object(
    'customers', array['Blocked', 'Booker', 'Contacted', 'Leadwell', 'Noted', 'Recentlead', 'Unsubscribed', 'Warned'],
    'sessions', '{"recent": true, "old": true}'::jsonb),
  'a retention period that is not a whole number deletes no customer and no checkout progress, because no cutoff can be derived from it [INV-28; OUR CHOICE — project owner''s direction, 13 September 2026]');

update public.settings set value = '0'::jsonb where key = 'privacy.retention_months';

select lives_ok($$select internal.purge_checkout_progress()$$,
  'the retention job runs with a retention period below one month [INV-28; OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(pg_temp.fixtures(), array['Blocked', 'Booker', 'Contacted', 'Leadwell', 'Noted', 'Recentlead', 'Unsubscribed', 'Warned'],
  'a retention period that is not a positive whole number deletes no customer [INV-28; OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(pg_temp.sessions(), '{"recent": true, "old": false}'::jsonb,
  'while the checkout-progress purge still runs as before, removing the session older than its cutoff [§6.3; INV-28]');

update public.settings set value = '24'::jsonb where key = 'privacy.retention_months';

select lives_ok($$select internal.purge_checkout_progress()$$,
  'the retention job runs with a 24-month retention period [INV-28; R-46]');

select ok(not ('Leadwell' = any(pg_temp.fixtures())),
  'a lead with no booking whose last interaction, consent event, note and warning change are all older than the retention period is deleted [INV-28; R-46; CONFIRMED]');

select ok('Recentlead' = any(pg_temp.fixtures()),
  'a lead who interacted within the retention period is kept [INV-28]');

select ok('Booker' = any(pg_temp.fixtures()),
  'an old customer with a booking of any status is kept, because anonymising or exempting them is Q-17 and still open [Q-17]');

select ok('Contacted' = any(pg_temp.fixtures()),
  'an old lead who was sent a message within the retention period is kept [INV-28; OUR CHOICE]');

select ok('Unsubscribed' = any(pg_temp.fixtures()),
  'an old lead who unsubscribed within the retention period is kept, so a recaptured email cannot be marketed again [INV-28; §11.4; OUR CHOICE — project owner''s direction, 13 September 2026]');

select ok('Noted' = any(pg_temp.fixtures()),
  'an old lead with a staff note written within the retention period is kept [INV-28; OUR CHOICE — project owner''s direction, 13 September 2026]');

select ok('Warned' = any(pg_temp.fixtures()),
  'an old lead whose warning was set within the retention period is kept [INV-28; OUR CHOICE — project owner''s direction, 13 September 2026]');

select ok('Blocked' = any(pg_temp.fixtures()),
  'an old lead who was blocked within the retention period is kept [INV-28; OUR CHOICE — project owner''s direction, 13 September 2026]');

select is(
  jsonb_build_object(
    'notes',    (select count(*) from public.customer_notes where customer_id = 'ae000000-0000-4000-8000-0000000000c1'),
    'tags',     (select count(*) from public.customer_tags where customer_id = 'ae000000-0000-4000-8000-0000000000c1'),
    'consent',  (select count(*) from public.marketing_consent_events where customer_id = 'ae000000-0000-4000-8000-0000000000c1'),
    'messages', (select count(*) from public.messages where id = 'ae000000-0000-4000-8000-0000000000e1')),
  '{"notes": 0, "tags": 0, "consent": 0, "messages": 0}'::jsonb,
  'the deleted lead''s notes, tags, consent history and booking-less messages go with them [INV-28; OUR CHOICE]');

select is(
  (select jsonb_build_object('kept', true, 'customer_id', s.customer_id)
     from internal.checkout_sessions s where s.token = 'ae000000-0000-4000-8000-0000000000a1'),
  '{"kept": true, "customer_id": null}'::jsonb,
  'a checkout session still inside the retention period survives with its customer link set null [OUR CHOICE]');

select is(
  (select jsonb_agg(e.new_value) from audit.entries e where e.action = 'purge_expired_leads' and e.occurred_at = now()),
  (select jsonb_agg(e.new_value) from audit.entries e
    where e.action = 'purge_expired_leads' and e.occurred_at = now()
      and (select array_agg(k order by k) from jsonb_object_keys(e.new_value) k) = array['customers', 'messages']
      and e.old_value is null and e.entity_id is null),
  'the purge''s audit entry records counts of customers and messages and nothing else [INV-28; INV-14]');

select is(
  (select count(*)::integer from audit.entries e
    where e.occurred_at = now()
      and (coalesce(e.new_value::text, '') || coalesce(e.old_value::text, '') || coalesce(e.reason, '')) ~* 'leadwell|retention\.old\.lead|\+971500000051'),
  0,
  'no personal data of the deleted lead is copied into audit.entries [INV-28; INV-14]');

select ok(
  not has_function_privilege('anon', 'internal.purge_checkout_progress()', 'execute')
    and not has_function_privilege('authenticated', 'internal.purge_checkout_progress()', 'execute')
    and not has_function_privilege('service_role', 'internal.purge_checkout_progress()', 'execute'),
  'no application role can run the retention job [R-15; §13]');

select * from finish();
rollback;
