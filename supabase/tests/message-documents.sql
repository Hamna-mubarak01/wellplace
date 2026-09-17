begin;
select plan(69);

insert into public.staff (id, email, full_name, role, is_active) values
  ('e7000000-0000-4000-8000-000000000001', 'md.management@example.test', 'MD Management', 'management', true),
  ('e7000000-0000-4000-8000-000000000002', 'md.reception@example.test',  'MD Reception',  'reception',  true);

create temp view system_email_keys as
  select unnest(array[
    'waitlist_confirmation', 'waitlist_signup_notification', 'staff_invitation',
    'staff_password_reset', 'contact_acknowledgement', 'contact_notification'
  ]) as key;
grant select on system_email_keys to public;

create temp view document_rpc_names as
  select unnest(array[
    'save_message_template_draft', 'publish_message_template', 'reset_message_template'
  ]) as proname;
grant select on document_rpc_names to public;


select has_column('public', 'message_templates', 'document',
  '[§12] a template carries the authored document a manager built in the block editor');

select col_type_is('public', 'message_templates', 'document', 'jsonb',
  'as jsonb — an ordered list of typed blocks is a document, not eleven tables');

select has_column('public', 'message_templates', 'draft_document',
  'and the unpublished one beside it, so editing is not publishing [§5.1]');

select has_column('public', 'message_templates', 'preheader',
  'the published preview line an inbox shows beside the subject');

select has_column('public', 'message_templates', 'draft_subject',
  'with an unpublished subject');

select has_column('public', 'message_templates', 'draft_preheader',
  'and an unpublished preview line');

select has_column('public', 'message_templates', 'document_updated_at',
  'when it was last published [R-16]');

select has_column('public', 'message_templates', 'draft_updated_at',
  'and when the draft was last saved [R-16]');

select col_is_null('public', 'message_templates', 'body',
  'the plain body is now optional — a message authored only as blocks has no honest plain-text wording, and inventing one would seed wording nobody approved [§12]');

select throws_ok(
  $$insert into public.message_templates (key, channel, body)
    values ('contact_notification', 'email', '   ')$$,
  '23514', null,
  'a blank body is still refused, so "not written" and "written as nothing" stay different states');

select is(
  (select count(*)::int from public.message_templates t join system_email_keys k on k.key = t.key),
  6,
  '[§12] the six system emails ship as rows — 20260912110000 reverses the original "ships empty" decision, because a row is no longer the wording');

select is(
  (select count(*)::int from public.message_templates t join system_email_keys k on k.key = t.key
    where t.channel = 'email' and t.is_active and not t.is_marketing),
  6,
  'every one is an active email and transactional — message_templates_marketing_matches_kind holds for all six [INV-17]');

select is(
  (select count(*)::int from public.message_templates t join system_email_keys k on k.key = t.key
    where t.document is null and t.draft_document is null and t.subject is null),
  6,
  'and none carries an authored document or subject, so the coded default in src/lib/config/message-documents.ts is what actually sends');

select is(
  (select count(*)::int from public.message_templates t join system_email_keys k on k.key = t.key
    where length(btrim(t.body)) > 0),
  6,
  'each carries a one-line plain body, because the plain-text path still reads that column');

select ok(
  (select bool_and(pg_get_constraintdef(c.oid) like '%' || k.key || '%')
     from pg_constraint c, system_email_keys k
    where c.conname = 'message_templates_key_known'),
  '[§12] the closed key list names all six, and is character-identical to SYSTEM_MESSAGE_KEYS in src/lib/config/message-documents.ts');

select throws_ok(
  $$insert into public.message_templates (key, channel, body)
    values ('newsletter_blast', 'email', 'Buy things')$$,
  '23514', null,
  'a key outside the eighteen is still refused by the table itself');

select throws_ok(
  $$update public.message_templates set document = '"just a string"'::jsonb, document_updated_at = now()
     where key = 'contact_notification'$$,
  '23514', null,
  '[R-31] a document that is not an object is refused — the cheap shape check the database owes');

select throws_ok(
  $$update public.message_templates set document = '{"blocks": {}}'::jsonb, document_updated_at = now()
     where key = 'contact_notification'$$,
  '23514', null,
  'and so is one whose blocks are not an array, so a reader can trust document -> blocks');

select throws_ok(
  $$update public.message_templates set document = '{"blocks": []}'::jsonb
     where key = 'contact_notification'$$,
  '23514', null,
  '"there is a published document" is one fact — a document with no published stamp is refused [message_templates_document_stamped]');

select lives_ok(
  $$update public.message_templates
       set document = '{"blocks": [{"kind": "divider", "id": "d-0"}]}'::jsonb,
           document_updated_at = now()
     where key = 'contact_notification'$$,
  'a document carrying a blocks array is stored, and nothing inside a block is validated here — that is Zod''s job at the boundary [R-31]');

update public.message_templates
   set document = null, document_updated_at = null
 where key = 'contact_notification';

select has_function('public', 'save_message_template_draft', array['text', 'jsonb', 'text', 'text'],
  '[§5.1] a draft is saved by its own function');

select has_function('public', 'publish_message_template', array['text'],
  'publishing is a separate act, never a flag on the save');

select has_function('public', 'reset_message_template', array['text'],
  'and a template can be returned to the wording WellPlace ships with');

select is(
  (select count(*)::int from pg_proc p join document_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace
      and p.prosecdef and array_to_string(p.proconfig, ' ') = 'search_path=""'),
  3,
  '[R-15] all three run as definer with an empty search path');

select is(
  (select count(*)::int from pg_proc p join document_rpc_names n on n.proname = p.proname
    where p.pronamespace = 'public'::regnamespace
      and p.proretset and p.prorettype <> 'void'::regtype),
  3,
  '[R-14] all three return a typed row and never void');

select ok(
  not has_function_privilege('anon', 'public.save_message_template_draft(text,jsonb,text,text)', 'execute')
    and not has_function_privilege('anon', 'public.publish_message_template(text)', 'execute')
    and not has_function_privilege('anon', 'public.reset_message_template(text)', 'execute'),
  '[§13] an unauthenticated caller holds EXECUTE on none of them');

select ok(
  (select c.reloptions::text like '%security_invoker=%'
     from pg_class c where c.oid = 'public.message_documents'::regclass),
  '[R-03] the read goes through a security-invoker view, so message_templates_select_staff decides who sees it');

select ok(
  not has_table_privilege('anon', 'public.message_documents', 'select'),
  'and an unauthenticated caller cannot read it at all [§13]');


set local request.jwt.claims = '{"sub":"e7000000-0000-4000-8000-000000000002","email":"md.reception@example.test"}';
set local role authenticated;

select is(
  (select count(*)::int from public.message_documents),
  6,
  '[docs/5 §3] Reception reads the templates, because §9.2 has it resending them');

select throws_ok(
  $$select * from public.save_message_template_draft('booking_confirmation', '{"blocks": []}'::jsonb, 'x', null)$$,
  '42501', null,
  '[docs/5 §3, INV-15] but Reception cannot save a draft — "edit templates: reception no, management yes"');

select throws_ok(
  $$select * from public.publish_message_template('booking_confirmation')$$,
  '42501', null,
  'nor publish one, which is the act that changes what a guest is told [§12]');

select throws_ok(
  $$select * from public.reset_message_template('contact_notification')$$,
  '42501', null,
  'nor reset one');

reset role;

select is(
  (select count(*)::int from audit.entries where entity = 'public.message_templates'),
  0,
  'and not one refusal wrote an audit entry, because not one of them changed anything');


set local request.jwt.claims = '{"sub":"e7000000-0000-4000-8000-000000000001","email":"md.management@example.test"}';
set local role authenticated;

select throws_ok(
  $$select * from public.save_message_template_draft('booking_confirmation', null, 'x', null)$$,
  'WP084', null,
  'a draft with no document is refused — the draft columns record "there is a draft", and that is not one');

select is(
  (select d.has_draft::text || '|' || d.has_document::text || '|' || d.draft_blocks::text
     from public.save_message_template_draft(
       'booking_confirmation',
       '{"subject": [], "preheader": [], "blocks": [{"kind": "divider", "id": "d-1"}, {"kind": "spacer", "id": "s-1", "height": 24}]}'::jsonb,
       '  Your booking is confirmed  ', '  See you soon  ') d),
  'true|false|2',
  '[§5.1] a draft is saved for a key that had no row at all — twelve of the eighteen start that way, and an editor that could not save them would be two thirds unusable');

select is(
  (select v.channel::text || '|' || v.is_active::text || '|' || v.is_marketing::text || '|' || (v.body is null)::text
     from public.message_documents v where v.key = 'booking_confirmation'),
  'email|true|false|true',
  'the row it created is an active transactional email with NO plain body — no wording is invented on a manager''s behalf');

select is(
  (select v.is_published::text || '|' || (v.subject is null)::text || '|' || v.published_blocks::text
     from public.message_documents v where v.key = 'booking_confirmation'),
  'false|true|0',
  'AND THE PUBLISHED SIDE IS UNTOUCHED BY A SAVE. Nothing a guest can receive changed, which is the whole reason the draft columns exist [§5.1]');

reset role;

select ok(
  exists (select 1 from audit.entries e
           where e.action = 'save_message_template_draft'
             and e.entity = 'public.message_templates'
             and e.entity_id = 'booking_confirmation'
             and e.new_value -> 'document' -> 'blocks' ->> 0 is not null
             and e.new_value ->> 'subject' = 'Your booking is confirmed'
             and e.reason = 'Email template draft edited from the console'
             and e.actor_email = 'md.management@example.test'),
  '[INV-13] the save is audited with the actor, the whole new document and a reason the code composed, following consoleEdit in src/lib/validation/audit-reason.ts');

set local role authenticated;

select is(
  (select p.published_blocks::text || '|' || p.has_draft::text
     from public.publish_message_template('booking_confirmation') p),
  '2|false',
  '[§12] publishing moves the draft across and clears it, so there is one live version and no second copy to disagree with it');

select is(
  (select v.is_published::text || '|' || v.preheader || '|' || v.has_draft::text
          || '|' || (v.draft_subject is null)::text || '|' || (v.draft_preheader is null)::text
     from public.message_documents v where v.key = 'booking_confirmation'),
  'true|See you soon|false|true|true',
  'the document and its preheader are published, trimmed, and every draft column is emptied');

select ok(
  (select v.subject is null from public.message_documents v where v.key = 'booking_confirmation'),
  'AND THE FLAT SUBJECT IS LEFT ALONE — still null, because this row was created by the block editor and nothing has ever written a plain subject to it. It belongs to the older booking send path, which renders a paying guest''s confirmation from subject and body; publishing a block document must not reach into it [§5.1, §12]');

select is(
  (select (v.document_updated_at is not null)::text || '|' || (v.draft_updated_at is null)::text
     from public.message_documents v where v.key = 'booking_confirmation'),
  'true|true',
  'and the two stamps follow their documents exactly, which message_templates_document_stamped and message_templates_draft_stamped enforce');

select throws_ok(
  $$select * from public.publish_message_template('booking_confirmation')$$,
  'WP083', null,
  'publishing a second time is a refusal, not a silent no-op that would leave a manager unsure which version is live');

select throws_ok(
  $$select * from public.publish_message_template('payment_link')$$,
  'WP083', null,
  'and a key nobody has drafted has nothing to publish — publishing never brings a template into existence');

select is(
  (select d.has_document::text || '|' || d.draft_blocks::text
     from public.save_message_template_draft(
       'booking_confirmation',
       '{"subject": [], "preheader": [], "blocks": [{"kind": "heading", "id": "h-1", "content": []}]}'::jsonb,
       'A reworked subject', null) d),
  'true|1',
  'a new draft is written over a published template');

select is(
  (select v.published_blocks::text || '|' || (v.subject is null)::text || '|' || v.draft_blocks::text
     from public.message_documents v where v.key = 'booking_confirmation'),
  '2|true|1',
  'AND THE LIVE WORDING KEEPS GOING OUT UNCHANGED while it is reworked — the published document, its block count and the untouched flat subject are exactly as they were [§5.1]');

select is(
  (select r.cleared_document::text || '|' || r.cleared_draft::text
     from public.reset_message_template('booking_confirmation') r),
  'true|true',
  'reset clears BOTH sides and says what it actually cleared');

select is(
  (select v.is_published::text || '|' || v.has_draft::text || '|' || (v.subject is null)::text
          || '|' || (v.preheader is null)::text || '|' || (v.document_updated_at is null)::text
     from public.message_documents v where v.key = 'booking_confirmation'),
  'false|false|true|true|true',
  'so the coded default in src/lib/config/message-documents.ts governs the message again [§12]');

select is(
  (select count(*)::int from public.message_templates where key = 'booking_confirmation'),
  1,
  'THE ROW SURVIVES A RESET. The row is the template''s identity — its key, channel, timing and every audit entry pointing at it — and a reset is a clearing, never a removal');

select throws_ok(
  $$select * from public.reset_message_template('booking_confirmation')$$,
  'WP082', null,
  'resetting a template that is already at its default is refused rather than reported as a change that happened');

select is(
  (select d.has_draft::text || '|' || d.draft_blocks::text
     from public.save_message_template_draft('review_request', '{"blocks": []}'::jsonb, 'How was your visit', null) d),
  'true|0',
  'the review request can be drafted like any other template');

reset role;

select is(
  (select t.is_marketing::text from public.message_templates t where t.key = 'review_request'),
  'true',
  '[INV-17, §11.4] and the row created for it is marketing — is_marketing is DERIVED from the key and checked by message_templates_marketing_matches_kind, never passed in');

select throws_ok(
  $$update public.message_templates set is_marketing = true where key = 'contact_notification'$$,
  '23514', null,
  'a transactional template still cannot be silently reclassified as marketing, which is what would stop it when marketing is switched off [INV-17]');

select ok(
  exists (select 1 from audit.entries e
           where e.action = 'publish_message_template'
             and e.entity_id = 'booking_confirmation'
             and e.old_value ->> 'document' is null
             and e.new_value -> 'document' -> 'blocks' ->> 0 is not null
             and e.reason = 'Email template published from the console'),
  '[INV-13, §11.5] the publication is audited with the document that was live before it and the one that replaced it');

select ok(
  exists (select 1 from audit.entries e
           where e.action = 'reset_message_template'
             and e.entity_id = 'booking_confirmation'
             and e.old_value -> 'document' -> 'blocks' ->> 0 is not null
             and e.new_value ->> 'document' is null
             and e.reason = 'Email template returned to its built-in wording from the console'),
  '[INV-13] and the reset is audited with the complete wording it cleared, so §11.5 can still answer what a template said');

select is(
  (select count(*)::int from audit.entries
    where entity = 'public.message_templates'
      and actor_email = 'md.management@example.test'),
  5,
  '[R-14] every one of the five successful calls wrote its own audit entry, and no caller was trusted to do it');

select has_function('public', 'message_document_for_send', array['text'],
  '[§12, doc 3 §5.6] the send path has its own reader, because the waitlist and contact emails are sent with no user session at all');

select ok(
  (select p.prosecdef and 'search_path=""' = any (p.proconfig)
     from pg_proc p where p.oid = 'public.message_document_for_send(text)'::regprocedure),
  '[R-15] it runs as definer with an empty search path, which is the only reason it can read past RLS safely');

select is(
  (select array_to_string(p.proargnames, ',')
     from pg_proc p where p.oid = 'public.message_document_for_send(text)'::regprocedure),
  'p_key,subject,preheader,document,is_active,is_marketing,footer,footer_design,header_design',
  'AND IT RETURNS THE PUBLISHED DOCUMENT, ITS FLAGS AND THE PUBLISHED HEADER AND FOOTER, AND NOTHING ELSE — no draft_document, no draft_subject, no body, no timestamps. A send path that could see a draft would make the draft columns pointless [§5.1]');

select ok(
  not has_function_privilege('anon', 'public.message_document_for_send(text)', 'execute'),
  '[INV-01, §13] anon holds no EXECUTE — the browser holds the anon key, and a template reader it could call would publish every published document');

select ok(
  not has_function_privilege('authenticated', 'public.message_document_for_send(text)', 'execute'),
  'and neither does authenticated — a staff session reads templates through public.message_documents under RLS, never through this');

select ok(
  has_function_privilege('service_role', 'public.message_document_for_send(text)', 'execute'),
  'service_role alone holds it, reached only from src/lib/db/message-templates-send.ts [doc 3 §5.6]');

set local request.jwt.claims = '{"sub":"e7000000-0000-4000-8000-000000000001","email":"md.management@example.test"}';
set local role authenticated;

select is(
  (select d.has_draft::text
     from public.save_message_template_draft(
       'contact_acknowledgement',
       '{"blocks": [{"kind": "divider", "id": "d-2"}, {"kind": "spacer", "id": "s-2", "height": 24}]}'::jsonb,
       'We have received your message', 'We will reply shortly') d),
  'true',
  'a system email is authored and');

select is(
  (select p.published_blocks::text from public.publish_message_template('contact_acknowledgement') p),
  '2',
  'published, which is the state a send reads');

select throws_ok(
  $$select * from public.message_document_for_send('contact_acknowledgement')$$,
  '42501', null,
  'EVEN A MANAGER''S OWN SESSION IS REFUSED. This is not a convenience reader with a narrow shape — it is unreachable from the browser and from a staff session alike, which is what confines it to the one server module that has no user [§13]');

select is(
  (select d.has_document::text
     from public.save_message_template_draft(
       'contact_acknowledgement',
       '{"blocks": [{"kind": "heading", "id": "h-9", "content": []}]}'::jsonb,
       'A rewrite nobody has approved', null) d),
  'true',
  'then a new draft is written over the published wording');

reset role;

select is(
  (select d.preheader || '|' || jsonb_array_length(d.document -> 'blocks')::text
          || '|' || d.is_active::text || '|' || d.is_marketing::text
     from public.message_document_for_send('contact_acknowledgement') d),
  'We will reply shortly|2|true|false',
  'and the send still reads the PUBLISHED document and preheader — two blocks, not the one in the draft, so an unfinished rewrite can never reach a guest [§5.1, §12]');

select ok(
  (select d.subject is null from public.message_document_for_send('contact_acknowledgement') d),
  'the flat subject stays null for a template that has only ever been written as blocks — the authored subject travels inside the document, and this column belongs to the older booking send path [§12]');

select is(
  (select count(*)::int from public.message_document_for_send('payment_link')),
  0,
  'a key nobody has configured returns no row, and the send falls back to the coded default in src/lib/config/message-documents.ts [§4.1]');

select * from finish();
rollback;
