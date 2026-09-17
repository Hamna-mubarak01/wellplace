begin;
select plan(61);

insert into public.suites (suite_number, priority, status, is_active) values
  (9301, 9310, 'available', true);

insert into public.staff (id, email, full_name, role, is_active) values
  ('f1111111-1111-4111-8111-111111111111', 'mg.reception@example.test',  'MG Reception',  'reception',  true),
  ('f2222222-2222-4222-8222-222222222222', 'mg.management@example.test', 'MG Management', 'management', true),
  ('f3333333-3333-4333-8333-333333333333', 'mg.target@example.test',     'MG Target',     'reception',  true),
  ('f4444444-4444-4444-8444-444444444444', 'mg.retired@example.test',    'MG Retired',    'reception',  false);

insert into public.settings (key, value, value_type, source_tag, description) values
  ('zz.test.integer', '10'::jsonb,      'integer', '§10.2', 'test integer'),
  ('zz.test.object',  '{"a": 1}'::jsonb, 'object',  '§10.2', 'test object');

create temp table mg (label text primary key, id uuid);
grant all on mg to public;

create temp view management_rpc_names as
  select unnest(array[
    'set_setting', 'save_suite_setup',
    'grant_staff_permission', 'revoke_staff_permission',
    'set_message_template'
  ]) as proname;
grant select on management_rpc_names to public;



select has_function('public', 'set_setting',
  'the §10.2 configuration writer exists');
select has_function('public', 'save_suite_setup',
  '[CLIENT] The suite configuration editor exists');
select has_function('public', 'grant_staff_permission',
  'the §10.6 grant exists');
select has_function('public', 'revoke_staff_permission',
  'the §10.6 revoke exists');
select has_function('public', 'set_message_template',
  'the §12 template editor exists');

select is(
  (select count(*)::int from pg_proc p join management_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace),
  5,
  'five functions and no overloads — a stale caller cannot reach a second '
  'signature');

select is(
  (select count(*)::int from pg_proc p join management_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace and p.prosecdef),
  5,
  'every one writes past RLS deliberately [R-15]');

select is(
  (select count(*)::int from pg_proc p join management_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace
      and array_to_string(p.proconfig, ' ') = 'search_path=""'),
  5,
  'every one pins search_path to empty [R-15]');

select is(
  (select count(*)::int from pg_proc p join management_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace
      and p.proretset and p.prorettype <> 'void'::regtype),
  5,
  'every one returns a typed row set and never void [R-14]');

select is(
  (select count(*)::int from pg_proc p join management_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('anon', p.oid, 'execute')),
  0,
  'anon holds EXECUTE on none of them — configuring the venue is a staff '
  'action [§13, docs/5 §3]');

select is(
  (select count(*)::int from pg_proc p join management_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('authenticated', p.oid, 'execute')),
  5,
  'authenticated holds EXECUTE on all five — the role gate lives inside the '
  'function, not in the grant');



set local request.jwt.claims = '{"sub":"f1111111-1111-4111-8111-111111111111","email":"mg.reception@example.test"}';
set local role authenticated;

select throws_ok(
  $$select public.set_setting('zz.test.integer', '11'::jsonb, 'because')$$,
  '42501', null,
  'Reception cannot write a setting — docs/5 §3 "configure opening hours, '
  'booking rules, buffer, hold: reception no, management yes"');

select throws_ok(
  $$select public.save_suite_setup(
      (select id from public.suites where suite_number = 9301), 9301, 'Garden',false,'because',0,null)$$,
  '42501', null,
  'Reception cannot edit suite configuration — docs/5 §3 "configure allocation '
  'priority: reception no, management yes"');

select throws_ok(
  $$select public.grant_staff_permission(
      'f3333333-3333-4333-8333-333333333333', 'manual_price_change', 'because')$$,
  '42501', null,
  'Reception cannot grant itself a named permission [§10.6, docs/5 §3]');

select throws_ok(
  $$select public.revoke_staff_permission(
      'f3333333-3333-4333-8333-333333333333', 'manual_price_change', 'because')$$,
  '42501', null,
  'nor revoke one [§10.6, docs/5 §3]');

select throws_ok(
  $$select public.set_message_template(
      'booking_confirmation', 'email', true, 's', 'b', null, 'because')$$,
  '42501', null,
  'Reception cannot edit the wording that reaches a guest [§12, docs/5 §3 '
  '"edit CMS content, SEO, templates"]');

reset role;
set local request.jwt.claims = '{"sub":"f2222222-2222-4222-8222-222222222222","email":"mg.management@example.test"}';
set local role authenticated;



select throws_ok(
  $$select public.set_setting('zz.no.such.key', '1'::jsonb, 'because')$$,
  'WP048', null,
  'a key with no row in public.settings is refused — the seeded key set is '
  'the closed list and this function does not carry a second copy [§10.2]');

select throws_ok(
  $$select public.set_setting('zz.test.integer', '"ten"'::jsonb, 'because')$$,
  'WP049', null,
  'a string written into an integer setting is refused, because '
  'internal.setting_integer reads that row inside the allocation path');

select throws_ok(
  $$select public.set_setting('zz.test.integer', '10.5'::jsonb, 'because')$$,
  'WP049', null,
  'and a fractional value is refused for an integer setting');

select throws_ok(
  $$select public.set_setting('zz.test.integer', '11'::jsonb, '   ')$$,
  '22023', null,
  'a configuration change without a reason is refused — §3 audits every '
  'manual change with one [INV-13]');

select is(
  (select s.setting_value::text || '|' || s.value_type
     from public.set_setting('zz.test.integer', '11'::jsonb, 'tuning the venue') s),
  '11|integer',
  'the happy path returns the stored value and the declared type');

reset role;

select is(
  (select s.value::text from public.settings s where s.key = 'zz.test.integer'),
  '11',
  'and the row itself is written');

select ok(
  exists (select 1 from audit.entries e
           where e.action = 'set_setting'
             and e.entity_id = 'zz.test.integer'
             and e.old_value ->> 'value' = '10'
             and e.new_value ->> 'value' = '11'
             and e.reason = 'tuning the venue'),
  'with an audit entry carrying the old value, the new value and the reason '
  '[§3, INV-13]');

set local role authenticated;

select is(
  (select s.setting_value is null
     from public.set_setting('zz.test.integer', 'null'::jsonb, 'clearing it') s),
  true,
  'a JSON null clears the setting — SYSTEM.md Part 8 makes "not yet supplied" '
  'a working state, not an error [§2]');

select is(
  (select s.setting_value::text
     from public.set_setting('zz.test.object', '{"b": 2}'::jsonb, 'restructuring') s),
  '{"b": 2}',
  'an object setting accepts an object, so the type guard checks the JSON '
  'kind and never the shape');

select throws_ok(
  $$select public.set_setting('zz.test.object', '2'::jsonb, 'because')$$,
  'WP049', null,
  'and refuses a number for the same key');



select throws_ok(
  $$select public.save_suite_setup((select id from public.suites where suite_number = 9301),9301,'Garden',false,' ',0,null)$$,
  'WP058',null,'[CLIENT] Suite setup requires an audit reason');
select throws_ok(
  $$select public.save_suite_setup((select id from public.suites where suite_number = 9301),0,'Garden',false,'Test',0,null)$$,
  'WP058',null,'[CLIENT] Suite numbers must be positive');
select throws_ok(
  $$select public.save_suite_setup('00000000-0000-4000-8000-000000000000',9301,'Garden',false,'Test',0,null)$$,
  'P0002',null,'[CLIENT] Updating a missing suite does not create it');
select is(
  (select display_name from public.save_suite_setup((select id from public.suites where suite_number=9301),9301,'  Garden  ',false,'Identity updated',0,null)),
  'Garden','[CLIENT] Management updates a suite name');
reset role;
select is((select display_name from public.suites where suite_number=9301),'Garden','Suite name is persisted');
select ok(exists(select 1 from audit.entries where action='update_suite_configuration' and new_value->>'display_name'='Garden' and reason='Identity updated'),
  '[CLIENT] Suite configuration changes are audited');
set local role authenticated;
select is(
  (select coalesce(display_name,'<null>') from public.save_suite_setup((select id from public.suites where suite_number=9301),9301,' ',false,'Name removed',0,null)),
  '<null>','[CLIENT] Clearing the optional name restores the numbered identity');

select throws_ok(
  $$select public.grant_staff_permission(
      'f3333333-3333-4333-8333-333333333333', 'override_suite_allocation', '  ')$$,
  '22023', null,
  'a grant without a reason is refused — docs/5 §2 makes it an event with an '
  'actor and a reason');

select throws_ok(
  $$select public.grant_staff_permission(
      '00000000-0000-4000-8000-000000000000', 'override_suite_allocation', 'because')$$,
  'P0002', null,
  'a grant to an unknown staff id is refused');

select throws_ok(
  $$select public.grant_staff_permission(
      'f4444444-4444-4444-8444-444444444444', 'override_suite_allocation', 'because')$$,
  'WP053', null,
  'a grant to a deactivated account is refused — internal.has_permission '
  'answers false for one whatever it holds, so the row would read as access '
  'that does not exist [§10.6]');

select is(
  (select g.staff_email || '|' || g.permission::text
     from public.grant_staff_permission(
       'f3333333-3333-4333-8333-333333333333',
       'override_suite_allocation',
       'covering the late shift') g),
  'mg.target@example.test|override_suite_allocation',
  'the happy path names the person and the permission [§10.6]');

reset role;

select is(
  (select sp.granted_by::text || '|' || sp.reason
     from public.staff_permissions sp
    where sp.staff_id = 'f3333333-3333-4333-8333-333333333333'
      and sp.permission = 'override_suite_allocation'),
  'f2222222-2222-4222-8222-222222222222|covering the late shift',
  'and the row records who granted it and why');

set local request.jwt.claims = '{"sub":"f3333333-3333-4333-8333-333333333333","email":"mg.target@example.test"}';

select ok(
  internal.has_permission('override_suite_allocation'::public.named_permission),
  'internal.has_permission now answers true for the grantee, which is what '
  'every §7.2 override gate reads');

set local request.jwt.claims = '{"sub":"f2222222-2222-4222-8222-222222222222","email":"mg.management@example.test"}';
set local role authenticated;

select throws_ok(
  $$select public.grant_staff_permission(
      'f3333333-3333-4333-8333-333333333333', 'override_suite_allocation', 'again')$$,
  'WP051', null,
  'a second grant of the same permission is REFUSED, not re-stamped — an '
  'upsert would overwrite the original actor, reason and date [§10.6]');

reset role;

select ok(
  exists (select 1 from audit.entries e
           where e.action = 'grant_staff_permission'
             and e.entity_id = 'f3333333-3333-4333-8333-333333333333:override_suite_allocation'
             and e.old_value is null
             and e.new_value ->> 'email' = 'mg.target@example.test'
             and e.reason = 'covering the late shift'),
  'the grant wrote an audit entry naming the subject and the reason [§3, '
  'INV-13]');

set local role authenticated;

select throws_ok(
  $$select public.revoke_staff_permission(
      'f3333333-3333-4333-8333-333333333333', 'manual_price_change', 'because')$$,
  'WP052', null,
  'revoking something never held is refused — a silent success would read on '
  'screen as "removed" [§10.6]');

select throws_ok(
  $$select public.revoke_staff_permission(
      'f3333333-3333-4333-8333-333333333333', 'override_suite_allocation', ' ')$$,
  '22023', null,
  'and a revoke without a reason is refused just as a grant is');

select is(
  (select r.staff_email || '|' || r.permission::text
     from public.revoke_staff_permission(
       'f3333333-3333-4333-8333-333333333333',
       'override_suite_allocation',
       'shift cover ended') r),
  'mg.target@example.test|override_suite_allocation',
  'the happy revoke names the person and the permission it removed');

reset role;

select is(
  (select count(*)::int from public.staff_permissions sp
    where sp.staff_id = 'f3333333-3333-4333-8333-333333333333'),
  0,
  'and the row is gone');

select ok(
  exists (select 1 from audit.entries e
           where e.action = 'revoke_staff_permission'
             and e.entity_id = 'f3333333-3333-4333-8333-333333333333:override_suite_allocation'
             and e.old_value ->> 'grant_reason' = 'covering the late shift'
             and e.new_value is null
             and e.reason = 'shift cover ended'),
  'the audit entry carries the WHOLE grant it removed, which is why deleting '
  'the row is safe — audit.entries cannot be altered [INV-14]');

set local role authenticated;



select throws_ok(
  $$select public.set_message_template(
      'booking_confirmation', 'email', true, 's', 'b', null, '  ')$$,
  '22023', null,
  'a template change without a reason is refused [§3, INV-13]');

select throws_ok(
  $$select public.set_message_template(
      'not_a_template', 'email', true, 's', 'b', null, 'because')$$,
  '23514', null,
  'an unknown key is refused by message_templates_key_known, not by a second '
  'copy of the list inside the function [§12]');

select throws_ok(
  $$select public.set_message_template(
      'booking_confirmation', 'whatsapp', true, 'a subject', 'b', null, 'because')$$,
  '23514', null,
  'a WhatsApp template with a subject is refused by '
  'message_templates_whatsapp_has_no_subject');

select throws_ok(
  $$select public.set_message_template(
      'booking_confirmation', 'email', true, 's', '   ', null, 'because')$$,
  '23514', null,
  'and a blank body is refused by message_templates_body_length');

select is(
  (select t.was_created::text || '|' || t.is_marketing::text || '|' || t.channel::text
     from public.set_message_template(
       'booking_confirmation', 'email', true,
       'Your booking is confirmed', 'See you soon.', null,
       'first wording') t),
  'true|false|email',
  'the first write creates the row, and a booking confirmation is NOT '
  'marketing — INV-17 at database level');

reset role;

select is(
  (select t.subject || '|' || t.body
     from public.message_templates t where t.key = 'booking_confirmation'),
  'Your booking is confirmed|See you soon.',
  'and the row itself is written');

select ok(
  exists (select 1 from audit.entries e
           where e.action = 'create_message_template'
             and e.entity_id = 'booking_confirmation'
             and e.old_value is null
             and e.reason = 'first wording'),
  'the first write is audited as a creation with no old value [§3, INV-13]');

set local role authenticated;

select is(
  (select t.was_created::text || '|' || t.timing_minutes::text
     from public.set_message_template(
       'booking_confirmation', 'email', false,
       'Your booking is confirmed', 'Revised wording.', 30,
       'second wording') t),
  'false|30',
  'the second write replaces the row rather than creating one');

select is(
  (select t.is_marketing::text
     from public.set_message_template(
       'review_request', 'email', true,
       'How was your visit', 'Tell us.', 4320,
       'review wording') t),
  'true',
  'is_marketing is DERIVED from the key, never passed — review_request is the '
  'one marketing template and message_templates_marketing_matches_kind checks '
  'the derivation [INV-17, §11.4]');

reset role;

select ok(
  exists (select 1 from audit.entries e
           where e.action = 'set_message_template'
             and e.entity_id = 'booking_confirmation'
             and e.old_value ->> 'body' = 'See you soon.'
             and e.new_value ->> 'body' = 'Revised wording.'
             and e.reason = 'second wording'),
  'and the replacement is audited with the complete old row and the complete '
  'new one — §11.5 answers "what did this template say when that message went '
  'out"');



set local role anon;

select throws_ok(
  $$select public.set_setting('zz.test.integer', '1'::jsonb, 'because')$$,
  '42501', null,
  'anon cannot write a setting');

select throws_ok(
  $$select public.save_suite_setup(
      '00000000-0000-4000-8000-000000000000', 1, null,false,'because',0,null)$$,
  '42501', null,
  'anon cannot edit suite configuration');

select throws_ok(
  $$select public.grant_staff_permission(
      '00000000-0000-4000-8000-000000000000', 'manual_price_change', 'because')$$,
  '42501', null,
  'anon cannot grant a permission');

select throws_ok(
  $$select public.revoke_staff_permission(
      '00000000-0000-4000-8000-000000000000', 'manual_price_change', 'because')$$,
  '42501', null,
  'anon cannot revoke one');

select throws_ok(
  $$select public.set_message_template(
      'booking_confirmation', 'email', true, 's', 'b', null, 'because')$$,
  '42501', null,
  'anon cannot edit a guest-facing template');

reset role;


select * from finish();
rollback;
