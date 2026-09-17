
begin;
select plan(47);



insert into public.settings (key, value, value_type, source_tag, description) values
  ('booking.start_interval_minutes', '15'::jsonb,   'integer', 'test', 'test'),
  ('booking.durations_hours',        '[2,3]'::jsonb,'array',   'test', 'test'),
  ('booking.guests_min',             '2'::jsonb,    'integer', 'test', 'test'),
  ('booking.guests_max',             '4'::jsonb,    'integer', 'test', 'test'),
  ('booking.child_min_age',          '8'::jsonb,    'integer', 'test', 'test'),
  ('booking.child_max_age',          '15'::jsonb,   'integer', 'test', 'test'),
  ('booking.booker_min_age',         '18'::jsonb,   'integer', 'test', 'test'),
  ('booking.min_notice_minutes',     '90'::jsonb,          'integer', 'test', 'test'),
  ('booking.max_horizon_days',       null,          'integer', 'test', 'test'),
  ('booking.same_day_cutoff',        null,          'time',    'test', 'test'),
  ('cleaning.buffer_minutes',        '20'::jsonb,   'integer', 'test', 'test'),
  ('hold.minutes',                   '10'::jsonb,   'integer', 'test', 'test'),
  ('urgency.enabled',                'true'::jsonb, 'boolean', 'test', 'test'),
  ('urgency.threshold_few',          '5'::jsonb,    'integer', 'test', 'test'),
  ('urgency.threshold_last',         '3'::jsonb,    'integer', 'test', 'test'),
  ('urgency.text_few',               '"a"'::jsonb,  'string',  'test', 'test'),
  ('urgency.text_last',              '"b"'::jsonb,  'string',  'test', 'test'),
  ('urgency.text_none',              '"c"'::jsonb,  'string',  'test', 'test'),
  ('urgency.text_filling',           '"d"'::jsonb,  'string',  'test', 'test'),
  ('hours.seasonal',                 '{"periods":[]}'::jsonb, 'object', 'test', 'test'),
  ('hours.exceptions',               '[]'::jsonb, 'array', 'test', 'test'),
  ('hours.regular',                  '{}'::jsonb,   'object',  'test', 'test'),
  ('contact.whatsapp_e164',          '"+971500000000"'::jsonb, 'string', 'test', 'test'),
  ('contact.email',                  '"bookings@example.test"'::jsonb, 'string', 'test', 'test'),
  ('tax.vat_percent',                '5'::jsonb,    'decimal', 'test', 'test'),
  ('tax.inclusive',                  'true'::jsonb, 'boolean', 'test', 'test'),
  ('tax.label',                      '"VAT"'::jsonb, 'string', 'test', 'test'),
  ('pricing.currency',               '"AED"'::jsonb, 'string', 'test', 'test'),
  ('pricing.rounding_fils',          '50'::jsonb,   'integer', 'test', 'test'),
  ('pricing.offer_headline',         '"e"'::jsonb,  'string',  'test', 'test'),
  ('pricing.offer_subline',          '"f"'::jsonb,  'string',  'test', 'test'),
  ('pricing.offer_label',            '"g"'::jsonb,  'string',  'test', 'test')
on conflict (key) do nothing;

insert into public.settings (key, value, value_type, source_tag, description) values
  ('allocation.strategy',                        '"fixed_priority"'::jsonb, 'string',  'test', 'test'),
  ('fees.tabby.percent',                         '6'::jsonb,                'integer', 'test', 'test'),
  ('security.availability_rate_limit_per_hour',  '240'::jsonb,              'integer', 'test', 'test'),
  ('rules.cancellation',                         '{}'::jsonb,               'object',  'test', 'test'),
  ('privacy.retention_months',                   '24'::jsonb,               'integer', 'test', 'test'),
  ('hours.closures',                             '[]'::jsonb,               'array',   'test', 'test'),
  ('contact.staff_escalation_phone',             '"+971500000001"'::jsonb,  'string',  'test', 'test')
on conflict (key) do nothing;



select has_view('public', 'public_booking_settings',
  'the narrow public settings view exists [§6.1]');

select has_column('public', 'public_booking_settings', 'key',   'it exposes key');
select has_column('public', 'public_booking_settings', 'value', 'it exposes value');

select results_eq(
  $$-- COLLATE is required, not decorative: information_schema.column_name is a
    -- `sql_identifier`, which carries collation "C" and cannot be compared
    -- against a default-collation literal without being pinned. Same reason
    -- supabase/tests/waitlist.sql pins it.
    select column_name::text collate "default"
      from information_schema.columns
     where table_schema = 'public' and table_name = 'public_booking_settings'
     order by 1$$,
  array['key', 'value'],
  'and NOTHING else — the guest gets key and value, not our source tags');



select results_eq(
  $$select key from public.public_booking_settings order by key$$,
  $$values
     ('booking.booker_min_age'),
     ('booking.child_max_age'),
     ('booking.child_min_age'),
     ('booking.durations_hours'),
     ('booking.guests_max'),
     ('booking.guests_min'),
     ('booking.max_horizon_days'),
     ('booking.same_day_cutoff'),
     ('booking.start_interval_minutes'),
     ('cleaning.buffer_minutes'),
     ('contact.address'),
     ('contact.email'),
     ('contact.whatsapp_e164'),
     ('hold.minutes'),
     ('hours.closures'),
     ('hours.exceptions'),
     ('hours.regular'),
     ('hours.seasonal'),
     ('pricing.currency'),
     ('pricing.offer_headline'),
     ('pricing.offer_label'),
     ('pricing.offer_subline'),
     ('pricing.rounding_fils'),
     ('tax.inclusive'),
     ('tax.label'),
     ('tax.vat_percent'),
     ('urgency.enabled'),
     ('urgency.few_enabled'),
     ('urgency.last_enabled'),
     ('urgency.mode'),
     ('urgency.none_enabled'),
     ('urgency.text_few'),
     ('urgency.text_filling'),
     ('urgency.text_general'),
     ('urgency.text_last'),
     ('urgency.text_none'),
     ('urgency.threshold_few'),
     ('urgency.threshold_last')$$,
  'the view publishes EXACTLY the thirty-eight booking, pricing and public contact keys and not one '
  'more — contact.address is the venue address shown on the site since 20260914181000');

select is(
  (select count(*)::int from public.public_booking_settings),
  38,
  'thirty-eight rows, counted independently of the set comparison above');

select is(
  (select count(*)::int from public.public_booking_settings where key = 'allocation.strategy'),
  0,
  'allocation.strategy is NOT published — it tells an attacker how suites are '
  'picked, which turns a count into a per-suite occupancy report [INV-01, §7.2]');

select is(
  (select count(*)::int from public.public_booking_settings where key = 'fees.tabby.percent'),
  0,
  'fees.tabby.percent is NOT published — the guest is shown the resulting fee '
  'line, never the rule that produced it [§8.1]');

select is(
  (select count(*)::int from public.public_booking_settings
    where key = 'security.availability_rate_limit_per_hour'),
  0,
  'security.availability_rate_limit_per_hour is NOT published — publishing the '
  'limit publishes the number to stay under [§13]');

select is(
  (select count(*)::int from public.public_booking_settings
    where key like 'rules.%' or key like 'privacy.%'),
  0,
  'no rules.* or privacy.* key is published — the cancellation, refund and '
  'retention rules are Management configuration, not price display [§10.2]');

select is(
  (select count(*)::int from public.public_booking_settings
    where key like 'tax.%' or key like 'pricing.%'),
  8,
  'but ALL EIGHT tax.* and pricing.* keys ARE published, and that reverses a '
  'deliberate earlier exclusion. tax.* was withheld while Q-4 was open. The '
  'launch pricing specification answers it: §1 fixes that every displayed and '
  'calculated price includes 5% VAT and §6 requires the guest to be told so in '
  'the offer headline and again in the booking summary. A rate the page must '
  'print cannot be a value the page may not read [CLIENT §1, §6]');

select is(
  (select count(*)::int from public.public_booking_settings
    where key in ('hours.seasonal', 'hours.exceptions', 'hours.closures')),
  3,
  'all four opening-hours settings publish on save so real booking dates and '
  'public hours agree [§10.2, CLIENT 8 Sep 2026]');



select is(
  (select count(*)::int from public.public_booking_settings
    where key = 'contact.whatsapp_e164'),
  1,
  'contact.whatsapp_e164 IS published — the Click-to-Chat link cannot be drawn '
  'without it and a number a guest cannot see is not a channel [§4.3]');

select is(
  (select count(*)::int from public.public_booking_settings where key = 'contact.email'),
  1,
  'contact.email IS published — the booking-help mailto [§4.3]');

select is(
  (select count(*)::int from public.public_booking_settings
    where key = 'contact.staff_escalation_phone'),
  0,
  'but an unlisted contact.* key is NOT published — the filter is a literal '
  'list, so a THIRD contact key is a reviewable edit and not housekeeping');

select ok(
  pg_get_viewdef('public.public_booking_settings'::regclass) not like '%~~%',
  'the key filter is an explicit literal list, NOT a prefix pattern — a pattern '
  'publishes the next key somebody adds under it');

select ok(
  not coalesce(
    (select c.reloptions from pg_class c
      where c.oid = 'public.public_booking_settings'::regclass)
    @> array['security_invoker=true'],
    false),
  'the view runs with DEFINER rights and IS the boundary — anon has no grant on '
  'public.settings, so an invoker view would return 42501 to every guest');



select ok(
  has_table_privilege('anon', 'public.public_booking_settings', 'select'),
  'anon may select the public settings view — §6.1 books guests with no account');

select ok(
  has_table_privilege('authenticated', 'public.public_booking_settings', 'select'),
  'authenticated may too — Reception and the guest flow share one config source [§1]');

select ok(
  has_function_privilege('anon',
    'public.count_available_suites(timestamptz[], integer, integer)', 'execute'),
  'anon may execute count_available_suites — the §7.4 tiles cannot be drawn '
  'without it, and it is read-only and `stable`');

select ok(
  has_function_privilege('authenticated',
    'public.count_available_suites(timestamptz[], integer, integer)', 'execute'),
  'authenticated still may — one availability source [§1, §9.2]');

select ok(
  has_function_privilege('service_role',
    'public.count_available_suites(timestamptz[], integer, integer)', 'execute'),
  'service_role still may — §8.2 recovery checks availability from the webhook');



select ok(
  not has_function_privilege('anon',
    'public.hold_suite(timestamptz, integer, integer, integer)', 'execute'),
  'anon STILL cannot execute hold_suite — it allocates scarce inventory and '
  'mutates; that is the whole difference from count_available_suites [§7.5]');

select ok(
  not has_table_privilege('anon', 'public.settings', 'select'),
  'anon STILL cannot select public.settings — the narrow view did not come at '
  'the price of a grant on the registry [§10.2]');

select ok(
  not has_table_privilege('anon', 'public.settings_snapshot', 'select'),
  'anon STILL cannot select public.settings_snapshot — the staff-wide config '
  'contract is untouched');

select ok(
  not has_table_privilege('anon', 'public.suites', 'select'),
  'anon STILL cannot select public.suites — no suite number reaches a guest '
  '[§3, INV-01]');

select ok(
  not has_table_privilege('anon', 'public.suite_occupancy', 'select'),
  'anon STILL cannot select public.suite_occupancy [INV-01]');

select ok(
  not has_table_privilege('anon', 'public.staff', 'select'),
  'anon STILL cannot select public.staff [§13]');

select ok(
  not has_table_privilege('anon', 'public.public_booking_settings', 'insert'),
  'anon may read the view and nothing else — no insert');

select ok(
  not has_table_privilege('anon', 'public.public_booking_settings', 'update'),
  'no update');

select ok(
  not has_table_privilege('anon', 'public.public_booking_settings', 'delete'),
  'no delete');



select results_eq(
  $$select p.proargnames[i]::text collate "default"
      from pg_proc p, generate_subscripts(p.proargnames, 1) i
     where p.oid = 'public.count_available_suites(timestamptz[], integer, integer)'::regprocedure
       and p.proargmodes[i] = 't'
     order by i$$,
  array['starts_at', 'remaining', 'reduced_by_demand'],
  'count_available_suites returns starts_at, remaining and reduced_by_demand '
  'ONLY — no suite id, no suite number, no total [INV-01, §3]');



set local role anon;

select lives_ok(
  $$select key, value from public.public_booking_settings$$,
  'anon actually reads the view, not merely holds the grant');

select is(
  (select count(*)::int from public.public_booking_settings),
  38,
  'and sees all thirty-eight rows as anon — including the two whose value is '
  'NULL, because a not-yet-supplied setting must not vanish from the contract '
  '[§2]');

select results_eq(
  $$select key from public.public_booking_settings
     where key like 'contact.%' order by key$$,
  array['contact.address', 'contact.email', 'contact.whatsapp_e164'],
  'anon reads the three published contact keys and ONLY those three — asking for the '
  'whole contact.* prefix does not reach the internal escalation line [§4.3]');

select is(
  (select count(*)::int from public.public_booking_settings where key = 'allocation.strategy'),
  0,
  'and still no allocation.strategy when actually running as anon');

select throws_ok(
  $$select * from public.settings$$,
  '42501', null,
  'anon is refused on public.settings at the privilege layer [§10.2]');

select throws_ok(
  $$select * from public.settings_snapshot$$,
  '42501', null,
  'anon is refused on public.settings_snapshot at the privilege layer');

select throws_ok(
  $$select suite_number from public.suites$$,
  '42501', null,
  'anon is refused on public.suites [§3, INV-01]');

select throws_ok(
  $$select * from public.suite_occupancy$$,
  '42501', null,
  'anon is refused on public.suite_occupancy [INV-01]');

select throws_ok(
  $$select * from public.hold_suite('2027-07-01 09:00+04'::timestamptz, 2, 20, 10)$$,
  '42501', null,
  'anon is refused on hold_suite — the allocating door stayed shut [§7.5]');

select throws_ok(
  $$insert into public.settings (key, value, value_type, source_tag, description)
    values ('sneak.key', '1'::jsonb, 'integer', 'x', 'x')$$,
  '42501', null,
  'anon cannot write configuration [§10.2]');

select lives_ok(
  $$select * from public.count_available_suites(
      array['2027-07-01 09:00+04'::timestamptz, '2027-07-01 09:15+04'::timestamptz],
      2, 20)$$,
  'anon actually executes count_available_suites end to end — SECURITY DEFINER '
  'carries it past the missing read grant on public.suites [§7.4]');

select is(
  (select count(*)::int from public.count_available_suites(
     array['2027-07-01 09:00+04'::timestamptz, '2027-07-01 09:15+04'::timestamptz],
     2, 20)),
  2,
  'one row per input instant, as anon — the tile contract holds for a guest '
  'with no account [§6.1, §7.4]');

select throws_ok(
  $$select * from public.count_available_suites(
      (select array_agg('2027-07-01 09:00+04'::timestamptz + (n * interval '1 minute'))
         from generate_series(1, 201) n),
      2, 20)$$,
  'WP009', null,
  'the 200-instant cap still refuses an oversized call from anon');

reset role;



insert into public.staff (id, email, full_name, role) values
  ('55555555-5555-4555-8555-555555555555', 'pbs.mgmt@example.test', 'PBS Management', 'management');

set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-4555-8555-555555555555"}';

select ok(
  (select count(*)::int from public.settings_snapshot) > 30,
  'management still reads the FULL registry through settings_snapshot — the '
  'public view is an addition, not a replacement [§10.2]');

select is(
  (select count(*)::int from public.public_booking_settings),
  38,
  'and reads the same thirty-eight through the public view');

reset role;


select * from finish();
rollback;
