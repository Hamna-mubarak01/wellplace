
begin;
select plan(58);

update public.staff set is_active = false where email not like 'ri.%@example.test';

insert into public.staff (id, email, full_name, role) values
  ('61111111-1111-4111-8111-111111111111', 'ri.actor@example.test',     'RI Actor',     'management'),
  ('62222222-2222-4222-8222-222222222222', 'ri.second@example.test',    'RI Second',    'management'),
  ('63333333-3333-4333-8333-333333333333', 'ri.reception@example.test', 'RI Reception', 'reception');

insert into public.staff_invitations
  (id, email, full_name, role, invited_by, invited_at, expires_at) values
  ('ccccccc1-0000-4000-8000-000000000001', 'ri.open@example.test', 'RI Open', 'reception',
   '61111111-1111-4111-8111-111111111111', now() - interval '2 days', now() + interval '5 days'),
  ('ccccccc1-0000-4000-8000-000000000002', 'ri.lapsed@example.test', 'RI Lapsed', 'management',
   '62222222-2222-4222-8222-222222222222', now() - interval '8 days', now() - interval '1 day');

insert into public.staff_invitations
  (id, email, full_name, role, invited_by, accepted_at, accepted_by) values
  ('ccccccc1-0000-4000-8000-000000000003', 'ri.accepted@example.test', 'RI Accepted', 'reception',
   '61111111-1111-4111-8111-111111111111', now() - interval '3 days',
   '63333333-3333-4333-8333-333333333333');

insert into public.staff_invitations
  (id, email, full_name, role, invited_by, revoked_at, revoked_by) values
  ('ccccccc1-0000-4000-8000-000000000004', 'ri.revoked@example.test', 'RI Revoked', 'reception',
   '61111111-1111-4111-8111-111111111111', now() - interval '1 day',
   '62222222-2222-4222-8222-222222222222');



select has_function('public', 'resend_staff_invitation',
  'the resend function exists [CLIENT 30 Aug 2026]');

select is(
  (select pg_get_function_identity_arguments(p.oid) from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'resend_staff_invitation'),
  'p_invitation_id uuid, p_reason text',
  'the signature is the 2-argument form and the NAMES are the contract [R-02]');

select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'resend_staff_invitation'),
  1,
  'exactly one overload exists — no second signature reachable by a stale caller');

select is(
  (select p.prosecdef from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'resend_staff_invitation'),
  true,
  'resend_staff_invitation is SECURITY DEFINER [R-15]');

select is(
  (select array_to_string(p.proconfig, ' ') from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'resend_staff_invitation'),
  'search_path=""',
  'it pins search_path to empty [R-15]');

select is(
  (select p.prorettype::regtype::text from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'resend_staff_invitation'),
  'staff_invitation_resend_result',
  'it returns a typed row, not void [R-14]');

select ok(
  exists (select 1 from information_schema.attributes
           where udt_schema = 'public'
             and udt_name = 'staff_invitation_resend_result'
             and attribute_name = 'email'),
  'the result carries the email, so the Server Action can address the mail '
  'from the same transaction that authorised it');

select ok(
  exists (select 1 from information_schema.attributes
           where udt_schema = 'public'
             and udt_name = 'staff_invitation_resend_result'
             and attribute_name = 'was_expired'),
  'and was_expired, so the console can say the invitation had lapsed rather '
  'than reporting a plain success for two different situations');



select is(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'staff_invitations'
      and column_name = 'resend_count'),
  '0',
  'resend_count defaults to 0, so the migration cannot fail on existing rows');

select is(
  (select is_nullable from information_schema.columns
    where table_schema = 'public' and table_name = 'staff_invitations'
      and column_name = 'last_resent_at'),
  'YES',
  'last_resent_at is nullable — NULL means never resent, and is deliberately '
  'not defaulted to invited_at');

select is(
  (select count(*)::int from public.staff_invitations where resend_count is null),
  0,
  'no invitation anywhere carries a NULL resend_count');



select ok(
  not has_function_privilege('anon',
    (select p.oid from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'resend_staff_invitation'),
    'execute'),
  'anon CANNOT execute the resend RPC [§13, R-13]');

select ok(
  has_function_privilege('authenticated',
    (select p.oid from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'resend_staff_invitation'),
    'execute'),
  'authenticated CAN execute it — the console is the only caller');

select is(
  (select array_to_string(array(
     select distinct a.grantee::regrole::text
       from pg_proc p
       cross join lateral aclexplode(p.proacl) a
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'resend_staff_invitation'
        and a.privilege_type = 'EXECUTE'
      order by 1), ',')),
  'authenticated,postgres,service_role',
  'the EXECUTE ACL is byte-identical to the console functions from '
  '20260829150000 and to delete_staff_member — no wider [§13]');

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



select ok(
  not has_table_privilege('authenticated', 'public.staff_invitations', 'update'),
  'authenticated holds no UPDATE on public.staff_invitations — the SECURITY '
  'DEFINER function is the only way to move an expiry [R-02]');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'staff_invitations' and cmd = 'UPDATE'),
  0,
  'and there is no UPDATE policy on public.staff_invitations either [R-13]');



set local role authenticated;
set local request.jwt.claims = '{"sub":"63333333-3333-4333-8333-333333333333","email":"ri.reception@example.test"}';

select throws_ok(
  $$select public.resend_staff_invitation('ccccccc1-0000-4000-8000-000000000001')$$,
  '42501', null,
  'reception CANNOT resend an invitation — staff administration is Management '
  '[§10.6, INV-15]');

reset role;

select is(
  (select resend_count from public.staff_invitations
    where id = 'ccccccc1-0000-4000-8000-000000000001'),
  0,
  'the refused call changed nothing — the check is before the read, in the '
  'same transaction [R-14]');

set local role service_role;

select throws_ok(
  $$select public.resend_staff_invitation('ccccccc1-0000-4000-8000-000000000001')$$,
  '42501', null,
  'service_role holds EXECUTE by default privilege but carries no staff JWT, '
  'so require_management() still refuses it and no audit row with a NULL actor '
  'is written [INV-13]');

reset role;

select is(
  (select count(*)::int from audit.entries
    where action = 'resend_staff_invitation'
      and entity_id = 'ccccccc1-0000-4000-8000-000000000001'),
  0,
  'and neither refusal wrote an audit entry — nothing changed');



set local role authenticated;
set local request.jwt.claims = '{"sub":"61111111-1111-4111-8111-111111111111","email":"ri.actor@example.test"}';

select throws_ok(
  $$select public.resend_staff_invitation('ccccccc1-0000-4000-8000-00000000ffff')$$,
  'P0002', null,
  'an unknown invitation id is P0002, the same as every other console function');



select is(
  (select r.email from public.resend_staff_invitation(
     'ccccccc1-0000-4000-8000-000000000001', 'They never received the first one') r),
  'ri.open@example.test',
  'management resends an open invitation and gets the address back, so the '
  'mail is addressed from the same transaction that authorised it');

reset role;

select is(
  (select resend_count from public.staff_invitations
    where id = 'ccccccc1-0000-4000-8000-000000000001'),
  1,
  'resend_count is incremented, so §11.5-style abuse review can see an address '
  'that has been mailed repeatedly');

select ok(
  (select last_resent_at is not null from public.staff_invitations
    where id = 'ccccccc1-0000-4000-8000-000000000001'),
  'last_resent_at is stamped');

select ok(
  (select expires_at > now() + interval '23 hours' from public.staff_invitations
    where id = 'ccccccc1-0000-4000-8000-000000000001'),
  'expires_at is a fresh 24 hours from the resend — claim_staff_invitation() '
  'needs expires_at > now() and the operator has just re-confirmed the access');

select ok(
  (select expires_at < now() + interval '25 hours' from public.staff_invitations
    where id = 'ccccccc1-0000-4000-8000-000000000001'),
  'and it is only 24 hours, not the seven days this function shipped with — a '
  'resend SHORTENS a fixture that had five days left, which is the whole point '
  'of one clock instead of two');

select ok(
  (select invited_at < now() - interval '1 day' from public.staff_invitations
    where id = 'ccccccc1-0000-4000-8000-000000000001'),
  'invited_at is NOT moved — when this person was first invited is the history '
  'revoke-and-reinvite destroys and this feature exists to keep');

select is(
  (select count(*)::int from public.staff_invitations
    where email = 'ri.open@example.test'),
  1,
  'and there is still exactly ONE invitation row for that address');



set local role authenticated;
set local request.jwt.claims = '{"sub":"62222222-2222-4222-8222-222222222222","email":"ri.second@example.test"}';

select is(
  (select r.resend_count from public.resend_staff_invitation(
     'ccccccc1-0000-4000-8000-000000000001', 'Second attempt') r),
  2,
  'a second resend increments again and the running total is returned — the '
  'counter is not a boolean "has been resent"');

reset role;



set local role authenticated;
set local request.jwt.claims = '{"sub":"61111111-1111-4111-8111-111111111111","email":"ri.actor@example.test"}';

select throws_ok(
  $$select public.resend_staff_invitation('ccccccc1-0000-4000-8000-000000000003')$$,
  'WP003', null,
  'an ACCEPTED invitation is refused under its own SQLSTATE — that person has '
  'an account and needs a password reset, not an invitation, and the console '
  'has to be able to tell the operator which');

reset role;

select ok(
  (select resend_count = 0 and last_resent_at is null from public.staff_invitations
    where id = 'ccccccc1-0000-4000-8000-000000000003'),
  'and nothing about it moved');



set local role authenticated;
set local request.jwt.claims = '{"sub":"61111111-1111-4111-8111-111111111111","email":"ri.actor@example.test"}';

select throws_ok(
  $$select public.resend_staff_invitation('ccccccc1-0000-4000-8000-000000000004')$$,
  'WP004', null,
  'a REVOKED invitation is refused under a DIFFERENT SQLSTATE — resending it '
  'would undo a revocation nobody reconsidered');

reset role;

select ok(
  (select revoked_at is not null and resend_count = 0 from public.staff_invitations
    where id = 'ccccccc1-0000-4000-8000-000000000004'),
  'and it stays revoked');



select ok(
  (select expires_at <= now() from public.staff_invitations
    where id = 'ccccccc1-0000-4000-8000-000000000002'),
  'the lapsed fixture really has expired before the call');

set local role authenticated;
set local request.jwt.claims = '{"sub":"61111111-1111-4111-8111-111111111111","email":"ri.actor@example.test"}';

select ok(
  (select r.was_expired from public.resend_staff_invitation(
     'ccccccc1-0000-4000-8000-000000000002', 'Link lapsed before they opened it') r),
  'an EXPIRED invitation is resent and the result says it had lapsed');

reset role;

select ok(
  (select expires_at > now() from public.staff_invitations
    where id = 'ccccccc1-0000-4000-8000-000000000002'),
  'its expires_at has moved into the future, which is what makes the link '
  'claimable again — claim_staff_invitation() filters on expires_at > now()');

select ok(
  (select expires_at between now() + interval '23 hours'
                        and now() + interval '25 hours'
     from public.staff_invitations
    where id = 'ccccccc1-0000-4000-8000-000000000002'),
  'and it is a full fresh 24-hour window, not a few minutes salvaged from the '
  'old one [CLIENT, 30 August 2026]');

select ok(
  (select invited_at < now() - interval '7 days' from public.staff_invitations
    where id = 'ccccccc1-0000-4000-8000-000000000002'),
  'the original invitation date survives the rescue');

select ok(
  (select accepted_at is null and revoked_at is null from public.staff_invitations
    where id = 'ccccccc1-0000-4000-8000-000000000002'),
  'and it is still open, so the person can now claim it');



select is(
  (select count(*)::int from audit.entries
    where action = 'resend_staff_invitation'
      and entity = 'public.staff_invitations'
      and entity_id = 'ccccccc1-0000-4000-8000-000000000002'),
  1,
  'exactly one audit entry, with the right action and entity [INV-13, R-14]');

select is(
  (select old_value ->> 'email' from audit.entries
    where action = 'resend_staff_invitation'
      and entity_id = 'ccccccc1-0000-4000-8000-000000000002'),
  'ri.lapsed@example.test',
  'old_value carries the address that was re-mailed');

select is(
  (select (old_value ->> 'was_expired')::boolean from audit.entries
    where action = 'resend_staff_invitation'
      and entity_id = 'ccccccc1-0000-4000-8000-000000000002'),
  true,
  'old_value records that the invitation had lapsed when it was resent');

select is(
  (select (old_value ->> 'resend_count')::int from audit.entries
    where action = 'resend_staff_invitation'
      and entity_id = 'ccccccc1-0000-4000-8000-000000000002'),
  0,
  'old_value carries the count before [INV-13]');

select is(
  (select (new_value ->> 'resend_count')::int from audit.entries
    where action = 'resend_staff_invitation'
      and entity_id = 'ccccccc1-0000-4000-8000-000000000002'),
  1,
  'new_value carries the count after [INV-13]');

select ok(
  (select (old_value ->> 'expires_at')::timestamptz
          < (new_value ->> 'expires_at')::timestamptz
     from audit.entries
    where action = 'resend_staff_invitation'
      and entity_id = 'ccccccc1-0000-4000-8000-000000000002'),
  'and the expiry before and after, so the audit log alone shows the window '
  'was extended and by how much [§3, INV-13]');

select is(
  (select reason from audit.entries
    where action = 'resend_staff_invitation'
      and entity_id = 'ccccccc1-0000-4000-8000-000000000002'),
  'Link lapsed before they opened it',
  'the reason is stored [§3, INV-13]');

select is(
  (select actor_email from audit.entries
    where action = 'resend_staff_invitation'
      and entity_id = 'ccccccc1-0000-4000-8000-000000000002'),
  'ri.actor@example.test',
  'the actor is the manager who did it, read from the session — never the '
  'person who was invited, and never a parameter [INV-13]');

select is(
  (select actor_role::text from audit.entries
    where action = 'resend_staff_invitation'
      and entity_id = 'ccccccc1-0000-4000-8000-000000000002'),
  'management',
  'and their role at the time');

select is(
  (select count(*)::int from audit.entries
    where action = 'resend_staff_invitation'
      and entity_id = 'ccccccc1-0000-4000-8000-000000000001'),
  2,
  'the twice-resent invitation has two entries — one per resend, never one '
  'summarising both [INV-13]');

select is(
  (select count(*)::int from audit.entries
    where action = 'resend_staff_invitation'
      and entity_id in ('ccccccc1-0000-4000-8000-000000000003',
                        'ccccccc1-0000-4000-8000-000000000004')),
  0,
  'and the two refusals wrote none');


select is(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'staff_invitations'
      and column_name = 'expires_at'),
  '(now() + ''24:00:00''::interval)',
  'the column default is 24 hours — this is the value a BRAND-NEW invitation '
  'gets, because invite_staff_member() does not name expires_at on its INSERT');

select is(
  (select count(*)::int from pg_proc
    where pronamespace = 'public'::regnamespace and prosrc like '%7 days%'),
  0,
  'and no function in public still carries a seven-day literal anywhere');

set local role authenticated;
set local request.jwt.claims = '{"sub":"61111111-1111-4111-8111-111111111111","email":"ri.actor@example.test"}';

select lives_ok(
  $$select public.invite_staff_member('ri.window@example.test', 'RI Window', 'reception')$$,
  'a fresh invitation can be created');

reset role;

select ok(
  (select expires_at between now() + interval '23 hours'
                         and now() + interval '25 hours'
     from public.staff_invitations where email = 'ri.window@example.test'),
  'a NEW invitation lands 24 hours out, proving the column DEFAULT — not seven '
  'days, and not the one hour the emailed link used to have');

update public.staff_invitations
   set expires_at = now() + interval '30 days'
 where email = 'ri.window@example.test';

set local role authenticated;
set local request.jwt.claims = '{"sub":"61111111-1111-4111-8111-111111111111","email":"ri.actor@example.test"}';

select lives_ok(
  $$select public.invite_staff_member('ri.window@example.test', 'RI Window', 'management')$$,
  're-inviting the same open address takes the ON CONFLICT path rather than '
  'raising on staff_invitations_pending_email_idx');

reset role;

select ok(
  (select expires_at < now() + interval '25 hours'
     from public.staff_invitations where email = 'ri.window@example.test'),
  'and the re-invite pulls a 30-day deadline back to 24 hours, which is the '
  'literal INSIDE invite_staff_member() doing the work — the column default '
  'cannot reach the ON CONFLICT DO UPDATE path');

select is(
  (select count(*)::int from public.staff_invitations
    where email = 'ri.window@example.test'),
  1,
  'and the re-invite upserted rather than inserting a second open row');


select * from finish();
rollback;
