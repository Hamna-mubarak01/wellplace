
begin;
select plan(55);

update public.staff set is_active = false where email not like 'sd.%@example.test';

insert into public.staff (id, email, full_name, role) values
  ('11111111-1111-4111-8111-111111111111', 'sd.actor@example.test',     'SD Actor',     'management'),
  ('22222222-2222-4222-8222-222222222222', 'sd.second@example.test',    'SD Second',    'management'),
  ('33333333-3333-4333-8333-333333333333', 'sd.reception@example.test', 'SD Reception', 'reception'),
  ('44444444-4444-4444-8444-444444444444', 'sd.doer@example.test',      'SD Doer',      'management');

insert into public.staff (id, email, full_name, role, created_by) values
  ('55555555-5555-4555-8555-555555555555', 'sd.created@example.test', 'SD Created', 'reception',
   '44444444-4444-4444-8444-444444444444');

insert into public.staff_permissions (staff_id, permission, granted_by) values
  ('55555555-5555-4555-8555-555555555555', 'manual_price_change',
   '44444444-4444-4444-8444-444444444444');

insert into public.staff_permissions (staff_id, permission, granted_by) values
  ('44444444-4444-4444-8444-444444444444', 'override_suite_allocation',
   '11111111-1111-4111-8111-111111111111');

insert into public.staff_invitations
  (id, email, full_name, role, invited_by, accepted_at, accepted_by) values
  ('aaaaaaa1-0000-4000-8000-000000000001', 'sd.invitee@example.test', 'SD Invitee', 'reception',
   '44444444-4444-4444-8444-444444444444', now(), '44444444-4444-4444-8444-444444444444');

insert into public.staff_invitations
  (id, email, full_name, role, invited_by, revoked_at, revoked_by) values
  ('aaaaaaa1-0000-4000-8000-000000000002', 'sd.revoked@example.test', 'SD Revoked', 'reception',
   '22222222-2222-4222-8222-222222222222', now(), '44444444-4444-4444-8444-444444444444');

insert into public.staff_invitations
  (id, email, full_name, role, invited_by) values
  ('aaaaaaa1-0000-4000-8000-000000000003', 'sd.doer@example.test', 'SD Doer', 'management',
   '22222222-2222-4222-8222-222222222222');

insert into public.waitlist_entries
  (id, salutation, first_name, last_name, email, date_of_birth, phone_e164, phone_country,
   archived_at, archived_by)
values
  ('bbbbbbb1-0000-4000-8000-000000000001', 'ms', 'Perrin', 'Ashgrove',
   'sd.lead@example.test', date '1991-03-14', '+971509998877', 'AE',
   now(), '44444444-4444-4444-8444-444444444444');



select has_function('public', 'delete_staff_member',
  'the deletion function exists [CLIENT 30 Aug 2026]');

select is(
  (select pg_get_function_identity_arguments(p.oid) from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'delete_staff_member'),
  'p_staff_id uuid, p_reason text',
  'the signature is the 2-argument form and the NAMES are the contract [R-02]');

select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'delete_staff_member'),
  1,
  'exactly one overload exists — no second signature reachable by a stale caller');

select is(
  (select p.prosecdef from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'delete_staff_member'),
  true,
  'delete_staff_member is SECURITY DEFINER [R-15]');

select is(
  (select array_to_string(p.proconfig, ' ') from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'delete_staff_member'),
  'search_path=""',
  'it pins search_path to empty [R-15]');

select is(
  (select p.prorettype::regtype::text from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'delete_staff_member'),
  'staff_deletion_result',
  'it returns a typed row, not void [R-14]');

select ok(
  exists (select 1 from information_schema.attributes
           where udt_schema = 'public'
             and udt_name = 'staff_deletion_result'
             and attribute_name = 'email'),
  'the result carries the email, so the caller can delete the matching '
  'Supabase Auth user afterwards');



select ok(
  not has_function_privilege('anon',
    (select p.oid from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'delete_staff_member'),
    'execute'),
  'anon CANNOT execute the deletion RPC [§13, R-13]');

select ok(
  has_function_privilege('authenticated',
    (select p.oid from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'delete_staff_member'),
    'execute'),
  'authenticated CAN execute it — the console is the only caller');

select is(
  (select array_to_string(array(
     select distinct a.grantee::regrole::text
       from pg_proc p
       cross join lateral aclexplode(p.proacl) a
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'delete_staff_member'
        and a.privilege_type = 'EXECUTE'
      order by 1), ',')),
  'authenticated,postgres,service_role',
  'the EXECUTE ACL is byte-identical to the console functions from '
  '20260829150000 — no wider [§13]');

select results_eq(
  $$select format('%s.%s', n.nspname, p.proname) collate "default"
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and has_function_privilege('anon', p.oid, 'execute')
       and not exists (
         select 1 from pg_depend d
          where d.objid = p.oid
            and d.classid = 'pg_proc'::regclass
            and d.deptype = 'e')
     order by 1$$,
  $$values ('public.count_available_suites'), ('public.submit_waitlist_entry')$$,
  'these two are EXACTLY the functions anon can execute — no console function '
  'has leaked into the public surface, and never hold_suite [§13]');



select is((select con.confdeltype::text from pg_constraint con
            where con.conname = 'staff_created_by_fkey'), 'n',
  'staff.created_by is ON DELETE SET NULL — the self-reference that blocks '
  'deleting anyone whose invitation was ever claimed');

select is((select con.confdeltype::text from pg_constraint con
            where con.conname = 'staff_permissions_granted_by_fkey'), 'n',
  'staff_permissions.granted_by is ON DELETE SET NULL');

select is((select con.confdeltype::text from pg_constraint con
            where con.conname = 'waitlist_entries_archived_by_fkey'), 'n',
  'waitlist_entries.archived_by is ON DELETE SET NULL');

select is((select con.confdeltype::text from pg_constraint con
            where con.conname = 'staff_invitations_invited_by_fkey'), 'n',
  'staff_invitations.invited_by is ON DELETE SET NULL');

select is((select con.confdeltype::text from pg_constraint con
            where con.conname = 'staff_invitations_accepted_by_fkey'), 'n',
  'staff_invitations.accepted_by is ON DELETE SET NULL');

select is((select con.confdeltype::text from pg_constraint con
            where con.conname = 'staff_invitations_revoked_by_fkey'), 'n',
  'staff_invitations.revoked_by is ON DELETE SET NULL');

select is((select con.confdeltype::text from pg_constraint con
            where con.conname = 'staff_permissions_staff_id_fkey'), 'c',
  'staff_permissions.staff_id is still ON DELETE CASCADE — authorisation dies '
  'with the person');

select ok(
  (select not attnotnull from pg_attribute
    where attrelid = 'public.staff_invitations'::regclass
      and attname = 'invited_by'),
  'staff_invitations.invited_by is nullable, so the inviter can be deleted');



select ok(
  not has_table_privilege('authenticated', 'public.staff', 'delete'),
  'authenticated holds no DELETE on public.staff — the SECURITY DEFINER '
  'function is the only way in [R-02]');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'staff' and cmd = 'DELETE'),
  0,
  'and there is no DELETE policy on public.staff either [R-13]');



set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","email":"sd.reception@example.test"}';

select throws_ok(
  $$select public.delete_staff_member('44444444-4444-4444-8444-444444444444')$$,
  '42501', null,
  'reception CANNOT delete a colleague — staff administration is Management '
  '[§10.6, INV-15]');

reset role;

select is(
  (select count(*)::int from public.staff
    where id = '44444444-4444-4444-8444-444444444444'),
  1,
  'the refused call deleted nothing — the check is before the read, in the '
  'same transaction [R-14]');

set local role service_role;

select throws_ok(
  $$select public.delete_staff_member('44444444-4444-4444-8444-444444444444')$$,
  '42501', null,
  'service_role holds EXECUTE by default privilege but carries no staff JWT, '
  'so require_management() still refuses it and no audit row with a NULL actor '
  'is written [INV-13]');

reset role;



set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","email":"sd.actor@example.test"}';

select throws_ok(
  $$select public.delete_staff_member('11111111-1111-4111-8111-111111111111')$$,
  'WP001', null,
  'a member cannot delete themselves, under its own SQLSTATE so the console '
  'can say why');

reset role;

select is(
  (select count(*)::int from public.staff
    where id = '11111111-1111-4111-8111-111111111111'),
  1,
  'and they are still there');



set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","email":"sd.actor@example.test"}';

select is(
  (select r.email from public.delete_staff_member(
     '44444444-4444-4444-8444-444444444444', 'Left the company') r),
  'sd.doer@example.test',
  'management deletes a member who has invited a colleague, granted a '
  'permission and archived a lead — the FK repointing is what makes this '
  'possible at all');

reset role;

select is(
  (select count(*)::int from public.staff
    where id = '44444444-4444-4444-8444-444444444444'),
  0,
  'the staff row is gone — this is a hard delete, not a deactivation');

select is(
  (select count(*)::int from public.staff_permissions
    where staff_id = '44444444-4444-4444-8444-444444444444'),
  0,
  'their own permission grants went with them via ON DELETE CASCADE');



select ok(
  (select created_by is null from public.staff
    where id = '55555555-5555-4555-8555-555555555555'),
  'the staff row they created survives with created_by NULL');

select ok(
  (select granted_by is null from public.staff_permissions
    where staff_id = '55555555-5555-4555-8555-555555555555'
      and permission = 'manual_price_change'),
  'the permission they granted somebody else survives with granted_by NULL — '
  'the grant is not revoked by their departure');

select ok(
  (select invited_by is null and accepted_by is null from public.staff_invitations
    where id = 'aaaaaaa1-0000-4000-8000-000000000001'),
  'the invitation they sent and accepted survives with both attributions NULL');

select ok(
  (select revoked_by is null and revoked_at is not null from public.staff_invitations
    where id = 'aaaaaaa1-0000-4000-8000-000000000002'),
  'an invitation they revoked keeps its revoked_at and loses only the actor');

select ok(
  (select archived_by is null and archived_at is not null from public.waitlist_entries
    where id = 'bbbbbbb1-0000-4000-8000-000000000001'),
  'the lead they archived stays archived — archived_at is the operational fact '
  'and must not be undone by a staff change [§5.2]');

select is(
  (select count(*)::int from public.staff_invitations
    where id in ('aaaaaaa1-0000-4000-8000-000000000001',
                 'aaaaaaa1-0000-4000-8000-000000000002')),
  2,
  'nothing was cascade-DELETED — the invitation history is intact, only the '
  'attribution is lost. audit.entries.actor_email is what preserves who did it');



select ok(
  (select revoked_at is not null from public.staff_invitations
    where id = 'aaaaaaa1-0000-4000-8000-000000000003'),
  'a still-open invitation for the deleted address is revoked, so the next '
  'magic link cannot walk them back in through claim_staff_invitation()');

select is(
  (select revoked_by from public.staff_invitations
    where id = 'aaaaaaa1-0000-4000-8000-000000000003'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'revoked by the manager who performed the deletion');

select is(
  (select count(*)::int from public.staff_invitations
    where id = 'aaaaaaa1-0000-4000-8000-000000000003'),
  1,
  'revoked, NOT deleted — closing by status keeps the record, as R-17 does for '
  'holds');

select is(
  (select count(*)::int from audit.entries
    where action = 'revoke_staff_invitation'
      and entity_id = 'aaaaaaa1-0000-4000-8000-000000000003'),
  1,
  'the cascaded revocation writes its own audit entry under the existing '
  'action name, so a query for invitation revocations finds it [INV-13]');



select is(
  (select count(*)::int from audit.entries
    where action = 'delete_staff_member'
      and entity = 'public.staff'
      and entity_id = '44444444-4444-4444-8444-444444444444'),
  1,
  'exactly one audit entry, with the right action and entity [INV-13, R-14]');

select is(
  (select old_value ->> 'email' from audit.entries
    where action = 'delete_staff_member'
      and entity_id = '44444444-4444-4444-8444-444444444444'),
  'sd.doer@example.test',
  'old_value carries the deleted address. This is deliberately NOT the '
  'email-domain-only treatment erase_waitlist_entry() uses: R-46 and INV-28 '
  'govern customer data, and audit.entries already stores actor_email');

select is(
  (select old_value ->> 'role' from audit.entries
    where action = 'delete_staff_member'
      and entity_id = '44444444-4444-4444-8444-444444444444'),
  'management',
  'old_value carries the role they held');

select is(
  (select old_value ->> 'is_active' from audit.entries
    where action = 'delete_staff_member'
      and entity_id = '44444444-4444-4444-8444-444444444444'),
  'true',
  'old_value carries whether they were still active');

select is(
  (select (old_value ->> 'open_invitations_revoked')::int from audit.entries
    where action = 'delete_staff_member'
      and entity_id = '44444444-4444-4444-8444-444444444444'),
  1,
  'old_value records that one live invitation was closed by the deletion');

select ok(
  (select new_value is null from audit.entries
    where action = 'delete_staff_member'
      and entity_id = '44444444-4444-4444-8444-444444444444'),
  'new_value is NULL — there is no after-state for a deleted row');

select is(
  (select reason from audit.entries
    where action = 'delete_staff_member'
      and entity_id = '44444444-4444-4444-8444-444444444444'),
  'Left the company',
  'the reason is stored [§3, INV-13]');

select is(
  (select actor_email from audit.entries
    where action = 'delete_staff_member'
      and entity_id = '44444444-4444-4444-8444-444444444444'),
  'sd.actor@example.test',
  'the actor is the manager who did it, read from the session — never the '
  'person who was removed, and never a parameter [INV-13]');

select is(
  (select actor_role::text from audit.entries
    where action = 'delete_staff_member'
      and entity_id = '44444444-4444-4444-8444-444444444444'),
  'management',
  'and their role at the time');



update public.staff set is_active = false
 where id = '22222222-2222-4222-8222-222222222222';

select is(
  (select count(*)::int from public.staff where role = 'management' and is_active),
  1,
  'exactly one active management account remains — the state the guard exists '
  'for [OUR CHOICE]');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","email":"sd.actor@example.test"}';

select throws_ok(
  $$select public.delete_staff_member('11111111-1111-4111-8111-111111111111')$$,
  'WP002', null,
  'the last active management account cannot be DELETED — without this one '
  'click makes the console permanently unadministrable [OUR CHOICE]');

select throws_ok(
  $$select public.set_staff_active('11111111-1111-4111-8111-111111111111', false)$$,
  'WP002', null,
  'and it cannot be DEACTIVATED either — current_staff_role() filters on '
  'is_active, so deactivation locks everybody out just as thoroughly');

reset role;

select is(
  (select count(*)::int from public.staff
    where id = '11111111-1111-4111-8111-111111111111' and is_active),
  1,
  'both refusals left the account in place and active');

select is(
  (select count(*)::int from audit.entries
    where action = 'set_staff_active'
      and entity_id = '11111111-1111-4111-8111-111111111111'),
  0,
  'and neither wrote an audit entry — nothing changed');

update public.staff set is_active = true
 where id = '22222222-2222-4222-8222-222222222222';

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","email":"sd.actor@example.test"}';

select lives_ok(
  $$select public.set_staff_active('22222222-2222-4222-8222-222222222222', false,
      'Control: not the last one')$$,
  'a management account that is NOT the last one can still be deactivated — '
  'the guard is not over-broad');

reset role;

select is(
  (select count(*)::int from public.staff
    where id = '22222222-2222-4222-8222-222222222222' and is_active),
  0,
  'and that deactivation actually took effect');

select * from finish();
rollback;
