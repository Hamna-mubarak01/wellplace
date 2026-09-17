

begin;
select plan(110);

insert into public.staff (id, email, full_name, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'wl.reception@example.test',  'WL Reception',  'reception'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'wl.management@example.test', 'WL Management', 'management');

select has_table('public', 'waitlist_entries', 'the waitlist table exists [§5.2]');

select is(
  (select relrowsecurity from pg_class
    where oid = 'public.waitlist_entries'::regclass),
  true,
  'RLS is enabled on waitlist_entries [R-13]');

select hasnt_column('public', 'waitlist_entries', 'age',
  'age is NOT stored on the table — it is derived [§5.2]');
select has_column('public', 'waitlist_leads', 'age_years',
  'the calculated age is delivered by the view instead [§5.2]');

select is(
  (select p.prosecdef from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'submit_waitlist_entry'),
  true,
  'submit_waitlist_entry is SECURITY DEFINER');

select is(
  (select array_to_string(p.proconfig, ' ') from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'submit_waitlist_entry'),
  'search_path=""',
  'submit_waitlist_entry pins search_path to empty [R-15]');

set local role anon;

select lives_ok(
  $$select * from public.submit_waitlist_entry(
      'ms','Test','Lead','Test.Lead@example.test',
      (current_date - interval '30 years')::date,
      '+971501234567','AE','waitlist_page','https://example.test/',
      'meta','cpc','launch','hero','onsen')$$,
  'anon CAN submit the public waitlist form — the one grant it holds [§5.2]');

select is(
  (select r.status::text from public.submit_waitlist_entry(
      'mr','Second','Person','second.person@example.test',
      (current_date - interval '41 years')::date,
      '+971502222222','AE',null,null,null,null,null,null,null) r),
  'created',
  'a new address is created [§5.2]');

select lives_ok(
  $$select * from public.submit_waitlist_entry(
      'mr','Attacker','Overwrite','  TEST.LEAD@EXAMPLE.TEST ',
      (current_date - interval '56 years')::date,
      '+491701234567','DE','hostile','https://evil.test/',
      'evil','evil','evil','evil','evil')$$,
  'a repeat signup does NOT throw [§5.2, R-32]');

select is(
  (select r.status::text from public.submit_waitlist_entry(
      'mr','Attacker','Overwrite',' test.lead@EXAMPLE.test  ',
      (current_date - interval '56 years')::date,
      '+491701234567','DE',null,null,null,null,null,null,null) r),
  'already_registered',
  'the duplicate comes back as a VALUE, case- and whitespace-insensitive [§5.2, R-32]');

select is(
  (select r.entry_id from public.submit_waitlist_entry(
      'mr','Attacker','Overwrite','test.lead@example.test',
      (current_date - interval '56 years')::date,
      '+491701234567','DE',null,null,null,null,null,null,null) r),
  null::uuid,
  'the duplicate reveals no entry id — nothing to correlate or enumerate');

select is(
  (select r.submitted_at from public.submit_waitlist_entry(
      'mr','Attacker','Overwrite','test.lead@example.test',
      (current_date - interval '56 years')::date,
      '+491701234567','DE',null,null,null,null,null,null,null) r),
  null::timestamptz,
  'the duplicate reveals no signup date');

select throws_ok(
  $$select * from public.waitlist_entries$$, '42501', null,
  'anon CANNOT read waitlist entries [§13]');

select throws_ok(
  $$select * from public.waitlist_leads$$, '42501', null,
  'anon CANNOT read the leads view [§13]');

select throws_ok(
  $$select email from public.waitlist_entries limit 1$$, '42501', null,
  'anon CANNOT read a single email address either [§13]');

select throws_ok(
  $$insert into public.waitlist_entries
      (salutation, first_name, last_name, email, date_of_birth, phone_e164, phone_country)
    values ('mr','Direct','Insert','direct@example.test', date '1990-01-01','+971500000000','AE')$$,
  '42501', null,
  'anon CANNOT insert directly — the RPC is the only route [R-02]');

select throws_ok(
  $$update public.waitlist_entries set email = 'hijack@example.test'$$,
  '42501', null,
  'anon CANNOT update a lead directly [R-02]');

select throws_ok(
  $$delete from public.waitlist_entries$$, '42501', null,
  'anon CANNOT delete a lead — §5.2 asks for export, never deletion');

select throws_ok(
  $$select * from public.settings_snapshot$$, '42501', null,
  'anon CANNOT read configuration through the new settings view [INV-01]');

reset role;

select results_eq(
  $$select first_name, last_name, phone_e164, phone_country, utm_source
      from public.waitlist_entries where email = 'test.lead@example.test'$$,
  $$values ('Test','Lead','+971501234567','AE','meta')$$,
  'a repeat submission NEVER overwrites the existing identity or attribution');

select is(
  (select signup_count from public.waitlist_entries where email = 'test.lead@example.test'),
  5,
  'the repeat submissions are counted instead — the record of a returning visitor [§5.2]');

select is(
  (select count(*)::int from public.waitlist_entries where email = 'test.lead@example.test'),
  1,
  'four repeat submissions produced no second row [§5.2]');

select throws_ok(
  $$insert into public.waitlist_entries
      (salutation, first_name, last_name, email, date_of_birth, phone_e164, phone_country)
    values ('mr','Dup','Licate','test.lead@example.test', date '1990-01-01','+971500000000','AE')$$,
  '23505', null,
  'the dedupe index still raises on a raw insert — the RPC is what softens it');

select throws_ok(
  $$insert into public.waitlist_entries
      (salutation, first_name, last_name, email, date_of_birth, phone_e164, phone_country)
    values ('mr', repeat('x', 5000),'Long','long@example.test', date '1990-01-01','+971500000000','AE')$$,
  '23514', null,
  'an oversized name is rejected at the database, not just in the form');

select throws_ok(
  $$insert into public.waitlist_entries
      (salutation, first_name, last_name, email, date_of_birth, phone_e164, phone_country)
    values ('mr','Bad','Phone','badphone@example.test', date '1990-01-01','00971500000000','AE')$$,
  '23514', null,
  'a non-E.164 number is rejected — the flag picker must round-trip [§5.2]');

select throws_ok(
  $$insert into public.waitlist_entries
      (salutation, first_name, last_name, email, date_of_birth, phone_e164, phone_country)
    values ('mr','Future','Born','future@example.test', current_date + 1,'+971500000000','AE')$$,
  '23514', null,
  'a date of birth in the future is rejected [§5.2]');

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}';

select is((select count(*)::int from public.waitlist_entries), 0,
  'reception sees no waitlist entries [ASSUMED — §5.2, §10.7, §13]');

select is((select count(*)::int from public.waitlist_leads), 0,
  'reception sees no leads through the view either — security_invoker holds');

select throws_ok(
  $$insert into public.waitlist_entries
      (salutation, first_name, last_name, email, date_of_birth, phone_e164, phone_country)
    values ('mr','Recep','Tion','recep@example.test', date '1990-01-01','+971500000000','AE')$$,
  '42501', null,
  'reception CANNOT insert a lead directly [R-02]');

set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}';

select is((select count(*)::int from public.waitlist_entries), 2,
  'management reads the waitlist — the D4 leads screen [§5.2]');

select is(
  (select age_years from public.waitlist_leads where email = 'test.lead@example.test'),
  30,
  'the view calculates the age from the stored date of birth [§5.2]');

select is(
  (select utm_campaign from public.waitlist_leads where email = 'test.lead@example.test'),
  'launch',
  'the §5.4 UTM parameters survive to the leads view for campaign reporting');

select throws_ok(
  $$insert into public.waitlist_entries
      (salutation, first_name, last_name, email, date_of_birth, phone_e164, phone_country)
    values ('mr','Manage','Ment','mgmt@example.test', date '1990-01-01','+971500000000','AE')$$,
  '42501', null,
  'management writes through an RPC too, never a direct insert [R-02]');

select throws_ok(
  $$delete from public.waitlist_entries where email = 'test.lead@example.test'$$,
  '42501', null,
  'nobody deletes a lead through the API role [§5.2]');

select ok((select count(*)::int from public.settings_snapshot) > 0,
  'management reads the configuration registry through the new view [§10.2]');
select is(
  (select count(*)::int from public.settings_snapshot),
  (select count(*)::int from public.settings),
  'the view exposes every setting row, hiding none [§10.2]');

reset role;
set local role anon;

select is(
  (select r.status::text from public.submit_waitlist_entry(
      'ms','Csv','Import','csv.import@example.test',
      (current_date - interval '33 years')::date,
      '+971503333333','AE','waitlist_page',null,null,null,null,null,null) r),
  'created',
  'the genuine signup lands first [§5.2]');

select is(
  (select r.status::text from public.submit_waitlist_entry(
      'mr','Overwrite','Attempt','csv.import@example.test' || chr(13),
      (current_date - interval '61 years')::date,
      '+491701111111','DE',null,null,null,null,null,null,null) r),
  'already_registered',
  'a trailing CR is the same address — the CSV import case [§5.2]');

select is(
  (select r.status::text from public.submit_waitlist_entry(
      'mr','Overwrite','Attempt','csv.import@example.test' || chr(9),
      (current_date - interval '61 years')::date,
      '+491701111111','DE',null,null,null,null,null,null,null) r),
  'already_registered',
  'a trailing TAB is the same address [§5.2]');

select is(
  (select r.status::text from public.submit_waitlist_entry(
      'mr','Overwrite','Attempt','  csv.import@example.test  ',
      (current_date - interval '61 years')::date,
      '+491701111111','DE',null,null,null,null,null,null,null) r),
  'already_registered',
  'a leading and trailing ordinary space is the same address [§5.2]');

select is(
  (select r.status::text from public.submit_waitlist_entry(
      'mr','Overwrite','Attempt',chr(160) || 'csv.import@example.test' || chr(160),
      (current_date - interval '61 years')::date,
      '+491701111111','DE',null,null,null,null,null,null,null) r),
  'already_registered',
  'a non-breaking space U+00A0 is the same address [§5.2]');

select is(
  (select r.status::text from public.submit_waitlist_entry(
      'mr','Overwrite','Attempt','csv.import@example.test' || chr(8203),
      (current_date - interval '61 years')::date,
      '+491701111111','DE',null,null,null,null,null,null,null) r),
  'already_registered',
  'a zero-width space U+200B is the same address [§5.2]');

select is(
  (select r.status::text from public.submit_waitlist_entry(
      'mr','Overwrite','Attempt','csv.import@example.test.',
      (current_date - interval '61 years')::date,
      '+491701111111','DE',null,null,null,null,null,null,null) r),
  'already_registered',
  'a trailing FQDN dot is the same address [§5.2]');

select is(
  (select r.status::text from public.submit_waitlist_entry(
      'mr','Overwrite','Attempt','CSV.Import@Example.TEST',
      (current_date - interval '61 years')::date,
      '+491701111111','DE',null,null,null,null,null,null,null) r),
  'already_registered',
  'a different case is the same address [§5.2]');

select is(
  (select r.status::text from public.submit_waitlist_entry(
      'ms','Tagged','Person','csv.import+tag@example.test',
      (current_date - interval '44 years')::date,
      '+971504444444','AE',null,null,null,null,null,null,null) r),
  'created',
  '+tag is a DIFFERENT mailbox and gets its own row [ASSUMED — Q-1]');

reset role;

select is(
  (select count(*)::int from public.waitlist_entries
    where dedupe_key = 'csv.import@example.test'),
  1,
  'seven whitespace and case variants produced no second row [§5.2]');

select is(
  (select signup_count from public.waitlist_entries
    where dedupe_key = 'csv.import@example.test'),
  8,
  'every one of the seven variants reached the counter — the generated column '
  'and the RPC lookup use the SAME rule [§5.2]');

select is(
  (select signup_count from public.waitlist_entries
    where dedupe_key = 'csv.import+tag@example.test'),
  1,
  'the tagged address counted only its own submission — nothing merged into it');

select is(
  (select first_name from public.waitlist_entries
    where dedupe_key = 'csv.import@example.test'),
  'Csv',
  'the genuine first name survived every variant submission [§10.5]');

select is(
  (select phone_e164 from public.waitlist_entries
    where dedupe_key = 'csv.import@example.test'),
  '+971503333333',
  'the genuine mobile number survived every variant submission [§10.5]');

select is(
  (select date_of_birth from public.waitlist_entries
    where dedupe_key = 'csv.import@example.test'),
  (current_date - interval '33 years')::date,
  'the genuine date of birth survived every variant submission [§10.5]');

select is(
  (select count(distinct internal.normalise_email(v))::int
     from (values
       ('csv.import@example.test'),
       ('csv.import@example.test' || chr(13)),
       ('csv.import@example.test' || chr(9)),
       ('  csv.import@example.test  '),
       (chr(160) || 'csv.import@example.test' || chr(160)),
       ('csv.import@example.test' || chr(8203)),
       ('csv.import@example.test.'),
       ('CSV.Import@Example.TEST')
     ) t(v)),
  1,
  'internal.normalise_email maps every variant to ONE key');

select is(
  (select internal.normalise_email(
     '  ' || chr(9) || 'CSV.Import@Example.TEST.' || chr(160) || chr(13))),
  (select dedupe_key from public.waitlist_entries
    where email = 'csv.import@example.test'),
  'the key the RPC looks up by IS the key the generated column stored');

select is(
  (select p.provolatile from pg_proc p
     where p.pronamespace = 'internal'::regnamespace
       and p.proname = 'normalise_email'),
  'i'::"char",
  'internal.normalise_email is IMMUTABLE — required by the generated column');

set local role anon;

select is(
  (select r.status::text from public.submit_waitlist_entry(
      'ms','Honey','Newname','honeypot.new@example.test',
      (current_date - interval '29 years')::date,
      '+971505555555','AE',null,null,null,null,null,null,null,
      true) r),
  'created',
  'a spam submission of a NEW address answers exactly as an honest one does [§5.2]');

select is(
  (select r.status::text from public.submit_waitlist_entry(
      'ms','Honey','Known','honeypot.known@example.test',
      (current_date - interval '38 years')::date,
      '+971506666666','AE','waitlist_page',null,null,null,null,null,null) r),
  'created',
  'the honest lead the oracle would have been run against exists [§5.2]');

select is(
  (select r.status::text from public.submit_waitlist_entry(
      'mr','Probe','Bot','honeypot.known@example.test',
      (current_date - interval '61 years')::date,
      '+491702222222','DE',null,null,null,null,null,null,null,
      true) r),
  'already_registered',
  'a spam submission of an EXISTING address answers exactly as an honest one '
  'does — the honeypot cannot be identified by flipping one field [§5.2, §13]');

select is(
  (select r.entry_id from public.submit_waitlist_entry(
      'mr','Probe','Bot','honeypot.known@example.test',
      (current_date - interval '61 years')::date,
      '+491702222222','DE',null,null,null,null,null,null,null,
      true) r),
  null::uuid,
  'the spam duplicate path leaks no entry id either — identical to the honest one');

reset role;

select is(
  (select signup_count from public.waitlist_entries
    where dedupe_key = 'honeypot.known@example.test'),
  3,
  'the marked submissions ran the full code path and touched the row, so there '
  'is no timing gap to measure [§13]');

select is(
  (select is_spam from public.waitlist_entries
    where dedupe_key = 'honeypot.new@example.test'),
  true,
  'the marked submission was STORED, not discarded [§5.2]');

select is(
  (select is_spam from public.waitlist_entries
    where dedupe_key = 'honeypot.known@example.test'),
  false,
  'a spam duplicate cannot flag an existing honest lead out of the leads screen');

set local role authenticated;

select is(
  (select count(*)::int from public.waitlist_leads
    where email = 'honeypot.new@example.test'),
  0,
  'a marked row never reaches the D4 leads screen [§5.2]');

select is(
  (select count(*)::int from public.waitlist_entries
    where email = 'honeypot.new@example.test'),
  1,
  'but it is still in the base table, auditable and countable [§11.3]');

select is(
  (select count(*)::int from public.waitlist_leads
    where email = 'honeypot.known@example.test'),
  1,
  'the honest lead is untouched by the spam submission against it [§5.2]');

reset role;

select ok(
  has_function_privilege('anon',
    (select p.oid from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'submit_waitlist_entry'),
    'execute'),
  'anon still holds EXECUTE on the waitlist RPC [§5.2]');

select is(
  (select pg_get_function_identity_arguments(p.oid) from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'submit_waitlist_entry'),
  'p_salutation salutation, p_first_name text, p_last_name text, '
  'p_email text, p_date_of_birth date, p_phone_e164 text, '
  'p_phone_country text, p_source text, p_referrer text, '
  'p_utm_source text, p_utm_medium text, p_utm_campaign text, '
  'p_utm_content text, p_utm_term text, p_is_spam boolean, '
  'p_terms_text text, p_terms_version text',
  'the signature is the 17-argument form [CLIENT 31 Aug 2026]. '
  'p_marketing_consent and p_consent_text were REMOVED with the second '
  'checkbox: the one required tick names the Marketing Terms, so acceptance '
  'covers them. The NAMES are asserted because PostgREST binds by name — a '
  'client still posting p_marketing_consent would be ignored, the default '
  'applied, and a row written with no acceptance evidence and no error '
  '[§5.2, §6.3]');

select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'submit_waitlist_entry'),
  1,
  'exactly one submit_waitlist_entry exists — no stale 14-argument overload '
  'left reachable, which would accept spam and store it unmarked');

select is(
  (select array_to_string(array(
     select distinct a.grantee::regrole::text
       from pg_proc p
       cross join lateral aclexplode(p.proacl) a
      where p.pronamespace = 'public'::regnamespace
        and p.proname = 'submit_waitlist_entry'
        and a.privilege_type = 'EXECUTE'
      order by 1), ',')),
  'anon,authenticated,postgres,service_role',
  'EXECUTE is granted to exactly the three API roles and the owner — the '
  'signature changed, the grant did not widen [§13]');

select results_eq(
  $$-- COLLATE is required, not decorative: nspname and proname are `name`,
    -- which carries collation "C", so the concatenation cannot be compared
    -- against the default-collation literal below without being pinned.
    select format('%s.%s', n.nspname, p.proname) collate "default"
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
  'these two are EXACTLY the functions anon can execute — nothing else, and '
  'never hold_suite [§13]');

select ok(
  not has_schema_privilege('anon', 'internal', 'usage'),
  'anon has no USAGE on the internal schema [§13]');

set local role anon;

select throws_ok(
  $$select internal.normalise_email('probe@example.test')$$,
  '42501', null,
  'anon CANNOT call the normalisation rule directly — it lives in internal [§13]');

reset role;

select public.submit_waitlist_entry('ms','Victim','Name','suppression.victim@example.test',
  date '1990-01-01','+971500009001','AE', null,null,null,null,null,null,null, true);

select is((select count(*)::int from public.waitlist_leads
           where email = 'suppression.victim@example.test'), 0,
  'a pre-emptively marked address is held off the leads screen [§5.2]');

select is((public.submit_waitlist_entry('ms','Victim','Name','suppression.victim@example.test',
             date '1990-01-01','+971500009001','AE')).status::text,
  'already_registered',
  'the victim''s own signup answers normally — no hint an attacker was here [§5.2]');

select is((select count(*)::int from public.waitlist_leads
           where email = 'suppression.victim@example.test'), 1,
  'ONE honest submission restores the lead — the mark means "every submission was flagged", not "someone once flagged it" [§5.2, §13]');

select ok((select not is_spam from public.waitlist_entries
           where email = 'suppression.victim@example.test'),
  'the spam mark is cleared, not merely overridden by the view [§5.2]');

select public.submit_waitlist_entry('mr','Pure','Bot','suppression.bot@example.test',
  date '1990-01-01','+971500009002','AE', null,null,null,null,null,null,null, true);
select is((select count(*)::int from public.waitlist_leads
           where email = 'suppression.bot@example.test'), 0,
  'an address that has only ever been flagged stays off the leads screen [§5.2]');


reset role;

select has_table('public', 'marketing_consent_events',
  'the consent history table exists [§5.2, §11.4]');

select is(
  (select relrowsecurity from pg_class
    where oid = 'public.marketing_consent_events'::regclass),
  true,
  'RLS is enabled on marketing_consent_events [R-13]');

set local role anon;

select public.submit_waitlist_entry(
  'ms','Consent','Granted','consent.granted@example.test',
  date '1990-01-01','+971500001001','AE',
  null,null,null,null,null,null,null, false,
  'By joining you agree to our Privacy Policy.', 'v1');

reset role;

select is(
  (select count(*)::int from public.marketing_consent_events c
     join public.waitlist_entries e on e.id = c.waitlist_entry_id
    where e.email = 'consent.granted@example.test'),
  1,
  'a first submission writes exactly one consent event [§11.4]');

select is(
  (select c.consent_text from public.marketing_consent_events c
     join public.waitlist_entries e on e.id = c.waitlist_entry_id
    where e.email = 'consent.granted@example.test'),
  'By joining you agree to our Privacy Policy.',
  'the wording stored is the ACCEPTANCE sentence [CLIENT 31 Aug 2026]. The one '
  'tick names the Marketing Terms, so the sentence the person read is what '
  'evidences the marketing position too [§6.3 principle]');

select ok(
  (select c.granted from public.marketing_consent_events c
     join public.waitlist_entries e on e.id = c.waitlist_entry_id
    where e.email = 'consent.granted@example.test'),
  'submitting the form grants — the tick names the Marketing Terms [§11.4]');

select hasnt_column('public', 'waitlist_leads', 'marketing_consent',
  'the leads view no longer publishes a per-lead marketing column [CLIENT 31 '
  'Aug 2026] — every public signup grants, so it would read the same for every '
  'row. public.marketing_consent_events keeps the history');

select is(
  (select terms_acceptance_text from public.waitlist_entries
    where email = 'consent.granted@example.test'),
  'By joining you agree to our Privacy Policy.',
  'the literal acceptance sentence the person ticked is recorded [§6.3]');

select is(
  (select terms_acceptance_version from public.waitlist_entries
    where email = 'consent.granted@example.test'),
  'v1',
  'the accepted legal-text version is recorded alongside the wording [§6.3]');

select is(
  (select terms_acceptance_version from public.waitlist_leads
    where email = 'consent.granted@example.test'),
  'v1',
  'the leads view publishes the accepted version under its new name [§5.2]');

select ok(
  (select created_at is not null from public.waitlist_entries
    where email = 'consent.granted@example.test'),
  'created_at carries the acceptance timestamp — a single-step form needs no '
  'separate terms_accepted_at [§6.3]');

select hasnt_column('public', 'waitlist_entries', 'privacy_notice_text',
  'the old privacy-notice column name is gone, not shadowed by a leftover');
select hasnt_column('public', 'waitlist_entries', 'privacy_notice_version',
  'the old privacy-notice version column name is gone too');
select hasnt_column('public', 'waitlist_leads', 'privacy_notice_version',
  'the leads view no longer publishes the old column name — a dropped-and-'
  'recreated view, not a rename that kept the alias');

select col_is_null('public', 'waitlist_entries', 'terms_acceptance_text',
  'terms_acceptance_text stays NULLABLE — rows predating the checkbox exist and '
  'an honest NULL beats a backfilled guess [§6.3]');
select col_is_null('public', 'waitlist_entries', 'terms_acceptance_version',
  'terms_acceptance_version stays NULLABLE for the same reason [§6.3]');

select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.waitlist_entries'::regclass
      and conname in ('waitlist_entries_terms_acceptance_text_length',
                      'waitlist_entries_terms_acceptance_version_length')),
  2,
  'both length constraints were RENAMED, not dropped — the guard survived the '
  'column rename');

select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.waitlist_entries'::regclass
      and conname like '%privacy_notice%'),
  0,
  'no constraint still carries the old privacy-notice name');

select throws_ok(
  $$update public.waitlist_entries
       set terms_acceptance_version = repeat('v', 65)
     where email = 'consent.granted@example.test'$$,
  '23514',
  null,
  'the renamed version check still rejects an over-long value');

set local role anon;

select public.submit_waitlist_entry(
  'mr','Consent','Unquoted','consent.unquoted@example.test',
  date '1990-01-01','+971500001002','AE',
  null,null,null,null,null,null,null, false,
  null, null);

reset role;

select is(
  (select count(*)::int from public.waitlist_entries
    where email = 'consent.unquoted@example.test'),
  1,
  'the entry is still created — a missing wording is a caller fault, never a '
  'lost signup [§5.2]');

select is(
  (select count(*)::int from public.marketing_consent_events c
     join public.waitlist_entries e on e.id = c.waitlist_entry_id
    where e.email = 'consent.unquoted@example.test'),
  0,
  'but NO consent event is written without the sentence that evidences it — '
  'the table check would refuse it anyway [§6.3, §11.4]');

set local role anon;

select public.submit_waitlist_entry(
  'ms','Consent','Granted','consent.granted@example.test',
  date '1990-01-01','+971500001001','AE',
  null,null,null,null,null,null,null, false,
  'By joining you agree to our Privacy Policy.', 'v1');

reset role;

select is(
  (select count(*)::int from public.marketing_consent_events c
     join public.waitlist_entries e on e.id = c.waitlist_entry_id
    where e.email = 'consent.granted@example.test'),
  1,
  'resubmitting an already-granted address writes no second event — the '
  'history records decisions, not repeat visits [§11.4]');

insert into public.marketing_consent_events
  (waitlist_entry_id, granted, origin, consent_text)
select e.id, false, 'waitlist_form', null
  from public.waitlist_entries e
 where e.email = 'consent.granted@example.test';

select is(
  (select count(*)::int from public.marketing_consent_events c
     join public.waitlist_entries e on e.id = c.waitlist_entry_id
    where e.email = 'consent.granted@example.test'),
  2,
  'withdrawing writes a SECOND event — the history is append-only [§11.4]');

select ok(
  (select not c.granted from public.marketing_consent_events c
     join public.waitlist_entries e on e.id = c.waitlist_entry_id
    where e.email = 'consent.granted@example.test'
    order by c.seq desc limit 1),
  'the latest event is the withdrawal, which is what a reader reduces to [§11.4]');

select is(
  (select count(*)::int from public.marketing_consent_events c
     join public.waitlist_entries e on e.id = c.waitlist_entry_id
    where e.email = 'consent.granted@example.test' and c.granted),
  1,
  'the original grant is NOT overwritten — withdrawal adds, never edits [§11.4]');

select throws_ok(
  $$insert into public.marketing_consent_events
      (waitlist_entry_id, granted, origin, consent_text)
    select id, true, 'waitlist_form', null
      from public.waitlist_entries
     where email = 'consent.unquoted@example.test'$$,
  '23514',
  null,
  'a GRANT without its exact wording is refused by the database [§6.3 principle]');

select results_eq(
  $$select distinct confdeltype::text from pg_constraint
     where conrelid = 'public.marketing_consent_events'::regclass
       and contype = 'f'$$,
  array['c'],
  'EVERY foreign key on consent events cascades — the table now carries two subjects, a waitlist entry and a customer, and nothing survives the 24-month deletion through either [R-46, INV-28]');

select ok(
  not has_table_privilege('anon', 'public.marketing_consent_events', 'insert'),
  'anon cannot insert consent events directly [R-02]');
select ok(
  not has_table_privilege('authenticated', 'public.marketing_consent_events', 'insert'),
  'authenticated cannot insert consent events directly [R-02]');
select ok(
  not has_table_privilege('authenticated', 'public.marketing_consent_events', 'update'),
  'authenticated cannot rewrite consent history [R-02, §11.4]');
select ok(
  not has_table_privilege('authenticated', 'public.marketing_consent_events', 'delete'),
  'authenticated cannot delete consent history [R-02, §11.4]');

select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'submit_waitlist_entry'),
  1,
  'the 15-argument signature is gone — no stale overload that silently drops consent');

select ok(
  has_table_privilege('authenticated', 'public.waitlist_leads', 'select'),
  'authenticated CAN read the leads view — the Management console is the only '
  'consumer, and 20260831160000 dropped and recreated this view without '
  're-issuing the grant, which took the waitlist screen down with "permission '
  'denied for view waitlist_leads" [§5.2]');

select ok(
  not has_table_privilege('anon', 'public.waitlist_leads', 'select'),
  'anon still CANNOT read it — restoring the grant did not widen it [§13]');

select ok(
  not has_table_privilege('authenticated', 'public.waitlist_leads', 'insert')
  and not has_table_privilege('authenticated', 'public.waitlist_leads', 'update')
  and not has_table_privilege('authenticated', 'public.waitlist_leads', 'delete'),
  'and it is read-only — every write goes through an RPC [R-02]');

select * from finish();
rollback;
