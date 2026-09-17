begin;
select plan(105);

insert into public.staff (id, email, full_name, role) values
  ('d1111111-1111-4111-8111-111111111111', 'ops.reception@example.test',  'Ops Reception',  'reception'),
  ('d2222222-2222-4222-8222-222222222222', 'ops.management@example.test', 'Ops Management', 'management');

insert into public.suites (id, suite_number, priority)
values ('d9000000-0000-4000-8000-000000000001', 901, 900);

insert into public.customers
  (id, first_name, last_name, email, phone_e164, phone_country, date_of_birth)
values
  ('d0000000-0000-4000-8000-000000000001', 'Ops', 'Customer',
   'ops.customer@example.test', '+971500003001', 'AE', date '1990-01-01');

insert into public.bookings
  (id, reference, customer_id, suite_id, source, status, experience_period,
   cleaning_buffer_minutes, total_fils)
values
  ('d1000000-0000-4000-8000-000000000001', 'WPOPS001',
   'd0000000-0000-4000-8000-000000000001',
   'd9000000-0000-4000-8000-000000000001', 'online', 'confirmed',
   tstzrange(timestamptz '2026-11-02 09:00+04',
             timestamptz '2026-11-02 11:00+04', '[)'), 20, 50000);

select has_table('public', 'cleaning_tasks',    'cleaning tasks exist [§9.2]');
select has_table('public', 'tasks',             'assigned tasks are first-class [§10.6]');
select has_table('public', 'alerts',            'operational alerts are rows [§9.3]');
select has_table('public', 'shift_notes',       'shift handover is recorded [§9.2]');
select has_table('public', 'message_templates', 'templates are configuration [§12]');
select has_table('public', 'messages',          'every send attempt is logged [§12, §11.5]');

select is(
  (select relrowsecurity from pg_class where oid = 'public.cleaning_tasks'::regclass),
  true, 'RLS is enabled on cleaning_tasks [R-13]');
select is(
  (select relrowsecurity from pg_class where oid = 'public.tasks'::regclass),
  true, 'RLS is enabled on tasks [R-13]');
select is(
  (select relrowsecurity from pg_class where oid = 'public.alerts'::regclass),
  true, 'RLS is enabled on alerts [R-13]');
select is(
  (select relrowsecurity from pg_class where oid = 'public.shift_notes'::regclass),
  true, 'RLS is enabled on shift_notes [R-13]');
select is(
  (select relrowsecurity from pg_class where oid = 'public.message_templates'::regclass),
  true, 'RLS is enabled on message_templates [R-13]');
select is(
  (select relrowsecurity from pg_class where oid = 'public.messages'::regclass),
  true, 'RLS is enabled on messages [R-13]');

select is(
  (select array_agg(e.enumlabel::text order by e.enumsortorder)
     from pg_enum e where e.enumtypid = 'public.alert_kind'::regtype),
  array['hold_expiring','payment_without_suite','payment_failed','message_failed',
        'arrival_overdue','checkin_overdue','cleaning_unconfirmed',
        'upcoming_conflict','refund_pending','manual_review_pending'],
  'alert_kind is character-identical to ALERT_KINDS in src/lib/domain/alerts/index.ts, in the same order [§9.3]');

select is(
  (select count(*)::int from pg_enum e
    where e.enumtypid = 'public.alert_kind'::regtype),
  10,
  'exactly ten alert kinds decompose the seven §9.3 bullets, and no eleventh was invented');

select is(
  (select array_agg(e.enumlabel::text order by e.enumsortorder)
     from pg_enum e where e.enumtypid = 'public.alert_severity'::regtype),
  array['critical','warning','info'],
  'alert_severity matches AlertSeverity in src/lib/domain/alerts/index.ts');

select is(
  (select array_agg(e.enumlabel::text order by e.enumsortorder)
     from pg_enum e where e.enumtypid = 'public.message_channel'::regtype),
  array['email','whatsapp'],
  'message_channel is §12''s minimum: email and one official WhatsApp Business integration');

select is(
  (select array_agg(e.enumlabel::text order by e.enumsortorder)
     from pg_enum e where e.enumtypid = 'public.message_status'::regtype),
  array['queued','sent','failed','cancelled'],
  'message_status keeps failure as a state a row rests in, so §12 can retry it');

select is(
  (select array_agg(e.enumlabel::text order by e.enumsortorder)
     from pg_enum e where e.enumtypid = 'public.task_status'::regtype),
  array['open','in_progress','done','cancelled'],
  'task_status [§10.6 — OUR CHOICE], with done and cancelled kept apart');

select is(
  (select array_agg(e.enumlabel::text order by e.enumsortorder)
     from pg_enum e where e.enumtypid = 'public.task_priority'::regtype),
  array['low','normal','high','urgent'],
  'task_priority [§10.6 — OUR CHOICE], ordered low to urgent');

select is(
  (select array_agg(e.enumlabel::text order by e.enumsortorder)
     from pg_enum e where e.enumtypid = 'public.cleaning_status'::regtype),
  array['pending','in_progress','confirmed'],
  'cleaning_status is §9.2''s start, assign and confirm reduced to the three states');

select lives_ok(
  $$insert into public.cleaning_tasks
      (id, suite_id, booking_id, due_from)
    values ('da000000-0000-4000-8000-000000000001',
            'd9000000-0000-4000-8000-000000000001',
            'd1000000-0000-4000-8000-000000000001',
            timestamptz '2026-11-02 11:20+04')$$,
  'a cleaning task is raised for the suite the booking just left [§9.2]');

select is(
  (select status::text from public.cleaning_tasks
    where id = 'da000000-0000-4000-8000-000000000001'),
  'pending',
  'a new cleaning task starts pending [§9.2]');

select lives_ok(
  $$update public.cleaning_tasks
       set status = 'in_progress', started_at = now(),
           assigned_to = 'd1111111-1111-4111-8111-111111111111'
     where id = 'da000000-0000-4000-8000-000000000001'$$,
  'starting and assigning moves the task to in_progress [§9.2]');

select throws_ok(
  $$update public.cleaning_tasks set status = 'confirmed'
     where id = 'da000000-0000-4000-8000-000000000001'$$,
  '23514', null,
  'a task cannot reach confirmed without a confirmation time [§9.2]');

select lives_ok(
  $$update public.cleaning_tasks
       set status = 'confirmed', confirmed_at = now(),
           confirmed_by = 'd1111111-1111-4111-8111-111111111111'
     where id = 'da000000-0000-4000-8000-000000000001'$$,
  'confirming completion records who confirmed it and when [§9.2]');

select is(
  (select status::text from public.cleaning_tasks
    where id = 'da000000-0000-4000-8000-000000000001'),
  'confirmed',
  'the task walked pending to in_progress to confirmed [§9.2]');

select throws_ok(
  $$update public.cleaning_tasks
       set status = 'pending', started_at = now()
     where id = 'da000000-0000-4000-8000-000000000001'$$,
  '23514', null,
  'a task that has started cannot be pending again [§9.2]');

select lives_ok(
  $$insert into public.cleaning_tasks (suite_id, due_from)
    values ('d9000000-0000-4000-8000-000000000001',
            timestamptz '2026-11-02 14:00+04')$$,
  'a suite coming out of a block needs cleaning with no booking behind it [§9.2]');

select is(
  (select count(*)::int
     from pg_constraint c
     join pg_class t on t.oid = c.conrelid
    where t.relname = 'cleaning_tasks'
      and pg_get_constraintdef(c.oid) ilike '%suite_occupancy%'),
  0,
  'cleaning_tasks does NOT reach into occupancy — the buffer releases the suite, not the confirm [§7.1, Q-16]');

select lives_ok(
  $$insert into public.tasks
      (id, title, note, assigned_to, assigned_by, due_on, priority)
    values ('db000000-0000-4000-8000-000000000001',
            'Restock the towel cupboard', 'Second shelf is empty',
            'd1111111-1111-4111-8111-111111111111',
            'd2222222-2222-4222-8222-222222222222',
            date '2026-11-03', 'high')$$,
  'Management assigns a task to an individual Reception user [§10.6]');

select is(
  (select status::text || ':' || priority::text from public.tasks
    where id = 'db000000-0000-4000-8000-000000000001'),
  'open:high',
  'a task carries the §10.6 due date, priority, note and status');

select lives_ok(
  $$insert into public.tasks (title) values ('Nobody owns this yet')$$,
  'an unassigned task is a real state a task list must show [§10.6]');

select is(
  (select priority::text from public.tasks where title = 'Nobody owns this yet'),
  'normal',
  'a task created without a decision defaults to normal and does not shout');

select throws_ok(
  $$update public.tasks set status = 'done'
     where id = 'db000000-0000-4000-8000-000000000001'$$,
  '23514', null,
  'a task cannot be done without a completion time [§10.6]');

select lives_ok(
  $$update public.tasks
       set status = 'done', completed_at = now(),
           completed_by = 'd1111111-1111-4111-8111-111111111111'
     where id = 'db000000-0000-4000-8000-000000000001'$$,
  'Reception completes an assigned Management task [§9.2, §10.6]');

select throws_ok(
  $$insert into public.tasks (title) values ('   ')$$,
  '23514', null,
  'a task with no title is refused [§5.5]');

select lives_ok(
  $$insert into public.alerts (id, kind, severity, entity, entity_id)
    values ('dc000000-0000-4000-8000-000000000001',
            'cleaning_unconfirmed', 'warning', 'public.cleaning_tasks',
            'da000000-0000-4000-8000-000000000001')$$,
  'the §9.3 cleaning_unconfirmed alert opens against the task that caused it');

select throws_ok(
  $$insert into public.alerts (kind, severity, entity, entity_id)
    values ('cleaning_unconfirmed', 'warning', 'public.cleaning_tasks',
            'da000000-0000-4000-8000-000000000001')$$,
  '23505', null,
  'RE-RUNNING THE SCAN CANNOT OPEN A SECOND COPY: kind:entity:entity_id is unique while open [§9.3, reconcileAlerts]');

select lives_ok(
  $$insert into public.alerts (kind, severity, entity, entity_id)
    values ('cleaning_unconfirmed', 'warning', 'public.cleaning_tasks',
            'da000000-0000-4000-8000-000000000002')$$,
  'the same kind against a different entity id is a different alert [§9.3]');

select lives_ok(
  $$insert into public.alerts (kind, severity, entity, entity_id)
    values ('arrival_overdue', 'warning', 'public.bookings',
            'd1000000-0000-4000-8000-000000000001')$$,
  'a different kind against the same entity is a different alert [§9.3]');

select lives_ok(
  $$update public.alerts
       set resolved_at = now(),
           resolved_by = 'd1111111-1111-4111-8111-111111111111',
           resolution_note = 'Suite checked and signed off'
     where id = 'dc000000-0000-4000-8000-000000000001'$$,
  'resolving an alert records who closed it and why [§9.3]');

select lives_ok(
  $$insert into public.alerts (kind, severity, entity, entity_id)
    values ('cleaning_unconfirmed', 'warning', 'public.cleaning_tasks',
            'da000000-0000-4000-8000-000000000001')$$,
  'THE SAME ALERT MAY RECUR ONCE RESOLVED: the unique index is partial, so a second neglect is a new row [§9.3, §11.5]');

select is(
  (select count(*)::int from public.alerts
    where kind = 'cleaning_unconfirmed'
      and entity_id = 'da000000-0000-4000-8000-000000000001'),
  2,
  'the resolved occurrence and the new one both survive, which is what §11.5 counts');

select is(
  (select count(*)::int from public.alerts
    where kind = 'cleaning_unconfirmed'
      and entity_id = 'da000000-0000-4000-8000-000000000001'
      and resolved_at is null),
  1,
  'exactly one occurrence is open at a time [§9.1]');

select throws_ok(
  $$insert into public.alerts (kind, severity, entity, entity_id)
    values ('payment_failed', 'critical', 'Public.Bookings', 'x')$$,
  '23514', null,
  'an alert entity uses the same lower-case shape audit.entries does');

select throws_ok(
  $$insert into public.alerts
      (kind, severity, entity, entity_id, resolution_note)
    values ('refund_pending', 'warning', 'public.refunds', 'r1', 'Closed already')$$,
  '23514', null,
  'an alert cannot carry a resolution it has not been resolved with [§9.3]');

select lives_ok(
  $$insert into public.shift_notes (author_id, shift_on, body)
    values ('d1111111-1111-4111-8111-111111111111', date '2026-11-02',
            'Suite 901 heater is slow to warm. Told maintenance.')$$,
  'a shift-handover note is stored against its operating day [§9.2]');

select is(
  (select handed_over_at from public.shift_notes
    where shift_on = date '2026-11-02'),
  null,
  'a note written but not handed over is visible as unfinished [§9.2]');

select throws_ok(
  $$insert into public.shift_notes (shift_on, body)
    values (date '2026-11-02', '  ')$$,
  '23514', null,
  'an empty handover note is refused [§9.2]');

select is(
  (select count(*)::int from public.message_templates),
  6,
  'the six system emails ship as rows — 20260912110000 reversed "templates ship EMPTY" once a row stopped being the wording [§12]');

select is(
  (select count(*)::int from public.message_templates
    where document is null and draft_document is null and subject is null),
  6,
  'and every one of them ships with NO authored document and no subject, so the coded default in src/lib/config/message-documents.ts is what sends — a seeded row can never be mistaken for approved wording [§12]');

select lives_ok(
  $$insert into public.message_templates (key, channel, subject, body)
    values ('booking_confirmation', 'email', 'Your WellPlace booking',
            'Hello {{first_name}}, your booking is confirmed.')$$,
  'Management configures a booking template [§12]');

select is(
  (select is_marketing from public.message_templates
    where key = 'booking_confirmation'),
  false,
  'is_marketing defaults to FALSE, so a template is transactional unless it says otherwise [INV-17]');

select is(
  (select is_active from public.message_templates
    where key = 'booking_confirmation'),
  true,
  'a configured template is active by default [§12]');

select throws_ok(
  $$update public.message_templates set is_marketing = true
     where key = 'booking_confirmation'$$,
  '23514', null,
  'INV-17: A TRANSACTIONAL TEMPLATE CAN NEVER BE SILENTLY MARKETING — disabling marketing must not stop a booking confirmation [§12, §16.1]');

select is(
  (select count(*)::int
     from pg_constraint c
     join pg_class t on t.oid = c.conrelid
    where t.relname = 'message_templates'
      and c.contype = 'c'
      and c.conname = 'message_templates_marketing_matches_kind'),
  1,
  'the refusal is a CHECK constraint on the table, so no caller and no role bypasses it [INV-17]');

select throws_ok(
  $$insert into public.message_templates (key, channel, subject, body)
    values ('review_request', 'email', 'How was your visit?', 'Tell us more.')$$,
  '23514', null,
  'the review request cannot be filed as transactional either — that would escape the marketing switch [§11.4]');

select lives_ok(
  $$insert into public.message_templates
      (key, channel, subject, body, is_marketing, timing_minutes)
    values ('review_request', 'email', 'How was your visit?', 'Tell us more.',
            true, 120)$$,
  'review_request is the one marketing template, matching TEMPLATE_KIND [§12]');

select lives_ok(
  $$insert into public.message_templates
      (key, channel, body, timing_minutes)
    values ('booking_reminder', 'whatsapp', 'Your visit is tomorrow.', -1440)$$,
  'a WhatsApp reminder is timed in minutes before the booking [§12]');

select throws_ok(
  $$insert into public.message_templates (key, channel, subject, body)
    values ('secure_link', 'whatsapp', 'Subject', 'Body')$$,
  '23514', null,
  'a WhatsApp template carries no subject line — the channel cannot show one [§12]');

select throws_ok(
  $$insert into public.message_templates (key, channel, body)
    values ('newsletter_blast', 'email', 'Buy things')$$,
  '23514', null,
  'a key outside BOOKING_TEMPLATE_KEYS is refused [§12]');

select lives_ok(
  $$insert into public.messages
      (id, template_key, channel, booking_id, customer_id, to_address,
       subject, body, is_marketing)
    values ('dd000000-0000-4000-8000-000000000001', 'booking_confirmation',
            'email', 'd1000000-0000-4000-8000-000000000001',
            'd0000000-0000-4000-8000-000000000001',
            'ops.customer@example.test', 'Your WellPlace booking',
            'Hello Ops, your booking is confirmed.', false)$$,
  'a booking confirmation is queued against its booking [§12]');

select is(
  (select status::text || ':' || attempt_count::text from public.messages
    where id = 'dd000000-0000-4000-8000-000000000001'),
  'queued:0',
  'a queued message has made no attempt yet [§11.5]');

select throws_ok(
  $$insert into public.messages
      (template_key, channel, to_address, is_marketing)
    values ('booking_confirmation', 'email', 'x@example.test', true)$$,
  '23514', null,
  'INV-17 on the message too: a booking confirmation cannot be logged as marketing [§12]');

select throws_ok(
  $$insert into public.messages
      (template_key, channel, to_address, is_marketing)
    values ('review_request', 'email', 'x@example.test', false)$$,
  '23514', null,
  'a review request cannot be logged as transactional [§11.4]');

select throws_ok(
  $$insert into public.messages
      (template_key, channel, to_address, is_marketing)
    values ('booking_reminder', 'whatsapp', 'ops.customer@example.test', false)$$,
  '23514', null,
  'a WhatsApp message addressed to an email address is refused [§12]');

select throws_ok(
  $$insert into public.messages
      (template_key, channel, to_address, is_marketing)
    values ('booking_reminder', 'email', '+971500003001', false)$$,
  '23514', null,
  'an email addressed to a mobile number is refused [§12]');

select lives_ok(
  $$insert into public.messages
      (id, template_key, channel, customer_id, to_address, body, is_marketing)
    values ('dd000000-0000-4000-8000-000000000002', 'booking_reminder',
            'whatsapp', 'd0000000-0000-4000-8000-000000000001',
            '+971500003001', 'Your visit is tomorrow.', false)$$,
  'a WhatsApp message is addressed in E.164, the same shape customers store [§6.1]');

select throws_ok(
  $$update public.messages
       set status = 'sent', sent_at = now()
     where id = 'dd000000-0000-4000-8000-000000000001'$$,
  '23514', null,
  'a message cannot be marked sent without a recorded attempt — no silent re-fire [§9.2, §11.5]');

select lives_ok(
  $$update public.messages
       set attempt_count = attempt_count + 1, last_attempt_at = now(),
           status = 'sent', sent_at = now(),
           provider_message_id = 'resend_0001'
     where id = 'dd000000-0000-4000-8000-000000000001'$$,
  'sending counts the attempt on the row [§11.5]');

select lives_ok(
  $$update public.messages
       set attempt_count = attempt_count + 1, last_attempt_at = now(),
           provider_message_id = 'resend_0002'
     where id = 'dd000000-0000-4000-8000-000000000001'$$,
  'RECEPTION RESEND IS A RECORDED ATTEMPT, NOT A SILENT RE-FIRE [§9.2, §11.5]');

select is(
  (select attempt_count from public.messages
    where id = 'dd000000-0000-4000-8000-000000000001'),
  2,
  'the resend left two counted attempts on one message, which §11.5 reports');

select throws_ok(
  $$insert into public.messages
      (template_key, channel, to_address, is_marketing, status)
    values ('payment_link', 'email', 'x@example.test', false, 'failed')$$,
  '23514', null,
  'a failed message must say when it failed, or §9.3 cannot age it');

select lives_ok(
  $$update public.messages
       set attempt_count = attempt_count + 1, last_attempt_at = now(),
           status = 'failed', failed_at = now(), error = 'provider timeout'
     where id = 'dd000000-0000-4000-8000-000000000002'$$,
  'a failed WhatsApp delivery is logged, never dropped [§12, §11.5]');

select throws_ok(
  $$update public.messages set status = 'queued'
     where id = 'dd000000-0000-4000-8000-000000000002'$$,
  '23514', null,
  'a retried message cannot keep failed_at — a stale one leaves the §9.3 alert open forever');

select lives_ok(
  $$update public.messages
       set status = 'queued', failed_at = null
     where id = 'dd000000-0000-4000-8000-000000000002'$$,
  'clearing failed_at with the retry is what lets reconcileAlerts close message_failed [§9.3]');

select is(
  (select last_attempt_at is not null from public.messages
    where id = 'dd000000-0000-4000-8000-000000000002'),
  true,
  'the retry keeps last_attempt_at, so when it failed is not lost [§11.5]');

set local role authenticated;
set local request.jwt.claims = '{"sub":"d1111111-1111-4111-8111-111111111111"}';

select is(
  (select count(*)::int from public.cleaning_tasks),
  2,
  'reception: reads cleaning tasks [docs/5 §3, §9.2]');

select is(
  (select count(*)::int from public.tasks),
  2,
  'reception: reads every task, not only its own [docs/5 §3, §9.2]');

select is(
  (select count(*)::int from public.alerts),
  4,
  'reception: reads the alert centre — §9.1 puts current alerts on the daily overview');

select is(
  (select count(*)::int from public.shift_notes),
  1,
  'reception: reads the handover note [docs/5 §3, §9.2]');

select is(
  (select count(*)::int from public.message_templates),
  9,
  'reception: reads templates, because §9.2 has it resending them — the three written above and the six system emails 20260912110000 seeds');

select is(
  (select count(*)::int from public.messages),
  2,
  'reception: reads the message log [§9.2, §11.5]');

select ok(
  not internal.has_permission('view_confidential_figures'),
  'reception: holds no confidential-figures grant by role alone [§10.6, INV-15]');

select throws_ok(
  $$insert into public.cleaning_tasks (suite_id, due_from)
    values ('d9000000-0000-4000-8000-000000000001', now())$$,
  '42501', null,
  'reception: CANNOT write a cleaning task directly — the RPC audits it [R-02, R-14, INV-13]');

select throws_ok(
  $$update public.cleaning_tasks set status = 'confirmed', confirmed_at = now()
     where id = 'da000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'reception: CANNOT confirm a clean without going through the audited RPC [INV-13]');

select throws_ok(
  $$delete from public.cleaning_tasks
     where id = 'da000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'reception: CANNOT delete a cleaning task [§10.6]');

select throws_ok(
  $$insert into public.tasks (title) values ('Sneaky')$$,
  '42501', null,
  'reception: CANNOT write a task directly [R-02]');

select throws_ok(
  $$insert into public.alerts (kind, severity, entity, entity_id)
    values ('payment_failed', 'critical', 'public.bookings', 'x')$$,
  '42501', null,
  'reception: CANNOT raise an alert directly [R-02]');

select throws_ok(
  $$update public.alerts set resolved_at = now()
     where resolved_at is null$$,
  '42501', null,
  'reception: CANNOT silently close an alert [§9.3, INV-13]');

select throws_ok(
  $$delete from public.alerts$$,
  '42501', null,
  'reception: CANNOT delete an alert [§10.6]');

select throws_ok(
  $$insert into public.shift_notes (shift_on, body)
    values (date '2026-11-02', 'Sneaky')$$,
  '42501', null,
  'reception: CANNOT write a handover note directly [R-02]');

select throws_ok(
  $$update public.message_templates set body = 'Changed'
     where key = 'booking_confirmation'$$,
  '42501', null,
  'reception: CANNOT edit a template — configuring them is Management [§12, docs/5 §3]');

select throws_ok(
  $$insert into public.messages
      (template_key, channel, to_address, is_marketing)
    values ('booking_confirmation', 'email', 'x@example.test', false)$$,
  '42501', null,
  'reception: CANNOT write a message row directly — a resend is an audited RPC [§9.2, R-02]');

select throws_ok(
  $$update public.messages set attempt_count = 0
     where id = 'dd000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'reception: CANNOT erase a recorded attempt [§11.5, INV-14 in spirit]');

set local request.jwt.claims = '{"sub":"d2222222-2222-4222-8222-222222222222"}';

select is(
  (select count(*)::int from public.alerts),
  4,
  'management: reads the same alert centre [docs/5 §3]');

select throws_ok(
  $$update public.message_templates set body = 'Changed'
     where key = 'booking_confirmation'$$,
  '42501', null,
  'management: configures a template through an audited RPC, not a table write [§12, R-14]');

select throws_ok(
  $$insert into public.tasks (title) values ('Direct write')$$,
  '42501', null,
  'management: CANNOT write a task directly either [R-02, R-14]');

reset role;
set local role anon;

select throws_ok($$select * from public.cleaning_tasks$$, '42501', null,
  'anon: CANNOT read cleaning tasks [§13]');
select throws_ok($$select * from public.tasks$$, '42501', null,
  'anon: CANNOT read tasks [§13]');
select throws_ok($$select * from public.alerts$$, '42501', null,
  'anon: CANNOT read alerts [§13]');
select throws_ok($$select * from public.shift_notes$$, '42501', null,
  'anon: CANNOT read handover notes [§13]');
select throws_ok($$select * from public.message_templates$$, '42501', null,
  'anon: CANNOT read templates [§13]');
select throws_ok($$select * from public.messages$$, '42501', null,
  'anon: CANNOT read the message log [§13]');
select throws_ok(
  $$insert into public.messages
      (template_key, channel, to_address, is_marketing)
    values ('payment_link', 'email', 'attacker@example.test', false)$$,
  '42501', null,
  'anon: CANNOT queue a message — a payment link is not a public write [§13]');

reset role;
select * from finish();
rollback;
