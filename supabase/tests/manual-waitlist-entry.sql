
begin;
select plan(42);

insert into public.staff (id, email, full_name, role) values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'mw.reception@example.test',  'MW Reception',  'reception'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'mw.management@example.test', 'MW Management', 'management');



select has_function('public', 'create_waitlist_entry_manual',
  'the manual-add function exists [§5.2]');

select is(
  (select pg_get_function_identity_arguments(p.oid) from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'create_waitlist_entry_manual'),
  'p_salutation salutation, p_first_name text, p_last_name text, '
  'p_email text, p_date_of_birth date, p_phone_e164 text, '
  'p_phone_country text, p_reason text',
  'the signature is the 8-argument form and the NAMES are the contract '
  '[§5.2, R-02]');

select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'create_waitlist_entry_manual'
      and 'p_marketing_consent' = any(p.proargnames)),
  0,
  'there is NO p_marketing_consent argument — a manager cannot consent on '
  'somebody else''s behalf [§12]');

select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'create_waitlist_entry_manual'
      and (p.proargnames && array['p_terms_text','p_terms_version'])),
  0,
  'there are NO terms-acceptance arguments — nothing was accepted and there '
  'must be no way to claim otherwise [§6.3]');

select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'create_waitlist_entry_manual'),
  1,
  'exactly one overload exists — no second signature reachable by a stale caller');

select is(
  (select p.prosecdef from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'create_waitlist_entry_manual'),
  true,
  'create_waitlist_entry_manual is SECURITY DEFINER [R-15]');

select is(
  (select array_to_string(p.proconfig, ' ') from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'create_waitlist_entry_manual'),
  'search_path=""',
  'it pins search_path to empty [R-15]');



select ok(
  not has_function_privilege('anon',
    (select p.oid from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'create_waitlist_entry_manual'),
    'execute'),
  'anon CANNOT execute the manual-add RPC [§13, R-13]');

select ok(
  has_function_privilege('authenticated',
    (select p.oid from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'create_waitlist_entry_manual'),
    'execute'),
  'authenticated CAN execute it — the console is the only caller [§5.2]');

select is(
  (select array_to_string(array(
     select distinct a.grantee::regrole::text
       from pg_proc p
       cross join lateral aclexplode(p.proacl) a
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'create_waitlist_entry_manual'
        and a.privilege_type = 'EXECUTE'
      order by 1), ',')),
  'authenticated,postgres,service_role',
  'the EXECUTE ACL is exactly the six console functions'' ACL — no wider. '
  'service_role is there from the 20260828093500 default privileges, not from '
  'this migration, and require_management() still refuses it [§13]');

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
  exists (select 1 from pg_enum e
            join pg_type t on t.oid = e.enumtypid
           where t.typnamespace = 'public'::regnamespace
             and t.typname = 'consent_origin'
             and e.enumlabel = 'console_manual'),
  'consent_origin carries console_manual [§11.4]');

select ok(
  exists (select 1 from pg_enum e
            join pg_type t on t.oid = e.enumtypid
           where t.typnamespace = 'public'::regnamespace
             and t.typname = 'consent_origin'
             and e.enumlabel = 'waitlist_form'),
  'and still carries waitlist_form — the label was added, not replaced [R-11]');



set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","email":"mw.reception@example.test"}';

select throws_ok(
  $$select public.create_waitlist_entry_manual(
      'mr','Recep','Tion','recep.add@example.test',
      date '1990-01-01','+971500000101','AE')$$,
  '42501', null,
  'reception CANNOT add a lead by hand — /manage/waitlist is Management [§10.6, INV-15]');

reset role;

select is(
  (select count(*)::int from public.waitlist_entries
    where dedupe_key = 'recep.add@example.test'),
  0,
  'the refused call wrote nothing — the check is before the insert, in the same '
  'transaction [R-14]');

set local role service_role;

select throws_ok(
  $$select public.create_waitlist_entry_manual(
      'mr','Service','Role','sr.add@example.test',
      date '1990-01-01','+971500000102','AE')$$,
  '42501', null,
  'service_role holds EXECUTE by default privilege but carries no staff JWT, so '
  'require_management() still refuses it — and an audit row with a NULL actor '
  'is never written [INV-13]');

reset role;



set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","email":"mw.management@example.test"}';

select is(
  (select r.status::text from public.create_waitlist_entry_manual(
      'ms','  Zaraphine ','  Quillsworth ',' Zaraphine.Quillsworth@Example.TEST ',
      date '1988-04-05','+971501112222','ae','Phoned the venue') r),
  'created',
  'management adds a person by hand [§5.2]');

reset role;

select is(
  (select first_name || '/' || last_name || '/' || email || '/' || phone_country
     from public.waitlist_entries where dedupe_key = 'zaraphine.quillsworth@example.test'),
  'Zaraphine/Quillsworth/zaraphine.quillsworth@example.test/AE',
  'names are trimmed, the address normalised and the country upper-cased — the '
  'same handling the public form gives [§5.2]');



select is(
  (select terms_acceptance_text from public.waitlist_entries
    where dedupe_key = 'zaraphine.quillsworth@example.test'),
  null,
  'terms_acceptance_text is NULL — this person never saw the documents, and '
  'copying the public wording in would fabricate evidence [§6.3]');

select is(
  (select terms_acceptance_version from public.waitlist_entries
    where dedupe_key = 'zaraphine.quillsworth@example.test'),
  null,
  'terms_acceptance_version is NULL for the same reason [§6.3]');



select is(
  (select source from public.waitlist_entries
    where dedupe_key = 'zaraphine.quillsworth@example.test'),
  'console_manual',
  'the row records how it came to exist, fixed by the function rather than '
  'accepted from the caller [§11.4]');

select ok(
  (select referrer is null and utm_source is null and utm_medium is null
      and utm_campaign is null and utm_content is null and utm_term is null
     from public.waitlist_entries where dedupe_key = 'zaraphine.quillsworth@example.test'),
  'no referrer and no UTM attribution is invented for a manual add — §5.4 '
  'campaign reporting must not be handed a source that does not exist');

select ok(
  (select not is_spam from public.waitlist_entries
    where dedupe_key = 'zaraphine.quillsworth@example.test'),
  'a manual add is never flagged as spam');



select is(
  (select count(*)::int from public.marketing_consent_events c
     join public.waitlist_entries e on e.id = c.waitlist_entry_id
    where e.dedupe_key = 'zaraphine.quillsworth@example.test'),
  1,
  'a consent event IS written — "staff added them, no consent" must not look '
  'like "never asked" to §11.4');

select ok(
  (select not c.granted from public.marketing_consent_events c
     join public.waitlist_entries e on e.id = c.waitlist_entry_id
    where e.dedupe_key = 'zaraphine.quillsworth@example.test'),
  'granted is false, always [§12, Marketing Terms]');

select is(
  (select c.origin::text from public.marketing_consent_events c
     join public.waitlist_entries e on e.id = c.waitlist_entry_id
    where e.dedupe_key = 'zaraphine.quillsworth@example.test'),
  'console_manual',
  'the origin distinguishes it from a form decline [§11.4]');

select is(
  (select c.consent_text from public.marketing_consent_events c
     join public.waitlist_entries e on e.id = c.waitlist_entry_id
    where e.dedupe_key = 'zaraphine.quillsworth@example.test'),
  null,
  'consent_text is NULL, which the grant_needs_text check permits because only '
  'a GRANT has to be quotable');

set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","email":"mw.management@example.test"}';

select ok(
  (select count(*)::int from public.waitlist_leads
    where email = 'zaraphine.quillsworth@example.test') = 1,
  'the manually added person reaches the leads screen [§5.2]');

select ok(
  (select not c.granted from public.marketing_consent_events c
     join public.waitlist_entries e on e.id = c.waitlist_entry_id
    where e.email = 'zaraphine.quillsworth@example.test'
    order by c.seq desc limit 1),
  'and is recorded as NOT consented — the leads view stopped publishing a '
  'marketing column [CLIENT 31 Aug 2026], so the history is where that is '
  'read [§11.4]');

reset role;



select is(
  (select count(*)::int from audit.entries
    where action = 'create_waitlist_entry_manual'),
  1,
  'the manual add wrote exactly one audit entry [INV-13, R-14]');

select is(
  (select a.actor_email || '/' || a.actor_role::text || '/' || a.entity || '/' || a.reason
     from audit.entries a where a.action = 'create_waitlist_entry_manual'),
  'mw.management@example.test/management/public.waitlist_entries/Phoned the venue',
  'actor, role, entity and reason are all recorded [INV-13]');

select is(
  (select a.entity_id from audit.entries a
    where a.action = 'create_waitlist_entry_manual'),
  (select e.id::text from public.waitlist_entries e
    where e.dedupe_key = 'zaraphine.quillsworth@example.test'),
  'entity_id points at the row that was created [INV-13, INV-22]');

select is(
  (select a.old_value from audit.entries a
    where a.action = 'create_waitlist_entry_manual'),
  null,
  'old_value is NULL — nothing existed before [INV-13]');

select is(
  (select a.new_value from audit.entries a
    where a.action = 'create_waitlist_entry_manual'
      and a.entity = 'public.waitlist_entries'),
  jsonb_build_object(
    'email_domain',             'example.test',
    'source',                   'console_manual',
    'marketing_consent',        false,
    'terms_acceptance_version', null::text),
  'new_value records the FACTS of the creation [INV-13]');

select ok(
  (select not exists (
     select 1 from audit.entries a
      where a.entity = 'public.waitlist_entries'
        and (a.new_value::text ilike any (array[
               '%zaraphine%', '%quillsworth%',
               '%@example.test%', '%+971501112222%', '%1988-04-05%'])
          or a.old_value::text ilike any (array[
               '%zaraphine%', '%quillsworth%',
               '%@example.test%', '%+971501112222%', '%1988-04-05%'])))),
  'the audit entry holds NO name, address, phone or date of birth — an '
  'unerasable second copy would defeat erase_waitlist_entry, R-46 and INV-28');



set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","email":"mw.management@example.test"}';

select is(
  (select r.status::text from public.create_waitlist_entry_manual(
      'ms','Zaraphine','Quillsworth','ZARAPHINE.QUILLSWORTH@example.test  ',
      date '1988-04-05','+971501112222','AE','again') r),
  'already_registered',
  'a second manual add of the same address comes back as a VALUE, not an '
  'exception (R-32), case- and whitespace-insensitive');

select is(
  (select r.entry_id from public.create_waitlist_entry_manual(
      'ms','Zaraphine','Quillsworth','zaraphine.quillsworth@example.test',
      date '1988-04-05','+971501112222','AE') r),
  (select e.id from public.waitlist_entries e
    where e.dedupe_key = 'zaraphine.quillsworth@example.test'),
  'the duplicate hands back the EXISTING entry id so the console can link to '
  'the record — unlike the anon path, which must not be an enumeration oracle');

select ok(
  (select r.submitted_at is not null from public.create_waitlist_entry_manual(
      'ms','Zaraphine','Quillsworth','zaraphine.quillsworth@example.test',
      date '1988-04-05','+971501112222','AE') r),
  'and the original signup date, so the console can say since when');

reset role;

select is(
  (select signup_count from public.waitlist_entries
    where dedupe_key = 'zaraphine.quillsworth@example.test'),
  1,
  'signup_count is NOT incremented by a manual duplicate — attributing a signup '
  'to somebody who did not make one corrupts §11.3 and §11.4');

select is(
  (select count(*)::int from public.marketing_consent_events c
     join public.waitlist_entries e on e.id = c.waitlist_entry_id
    where e.dedupe_key = 'zaraphine.quillsworth@example.test'),
  1,
  'the duplicate writes no second consent event — the person''s own recorded '
  'position stands and a manual add must not overwrite it [§11.4]');

select is(
  (select count(*)::int from audit.entries
    where action = 'create_waitlist_entry_manual'),
  1,
  'and no audit entry — nothing changed, and a row whose old_value equals its '
  'new_value is noise in an append-only log');

select is(
  (select count(*)::int from public.waitlist_entries
    where dedupe_key = 'zaraphine.quillsworth@example.test'),
  1,
  'three duplicate attempts produced no second row [§5.2]');

select * from finish();
rollback;
