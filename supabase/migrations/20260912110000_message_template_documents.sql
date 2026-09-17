alter table public.message_templates
  add column preheader           text,
  add column document            jsonb,
  add column draft_document      jsonb,
  add column draft_subject       text,
  add column draft_preheader     text,
  add column document_updated_at timestamptz,
  add column draft_updated_at    timestamptz;

alter table public.message_templates
  add constraint message_templates_document_shaped
    check (
      document is null
      or (jsonb_typeof(document) = 'object' and jsonb_typeof(document -> 'blocks') = 'array')
    ),

  add constraint message_templates_draft_document_shaped
    check (
      draft_document is null
      or (jsonb_typeof(draft_document) = 'object' and jsonb_typeof(draft_document -> 'blocks') = 'array')
    ),

  add constraint message_templates_preheader_length
    check (preheader is null or length(btrim(preheader)) between 1 and 300),

  add constraint message_templates_draft_subject_length
    check (draft_subject is null or length(btrim(draft_subject)) between 1 and 300),

  add constraint message_templates_draft_preheader_length
    check (draft_preheader is null or length(btrim(draft_preheader)) between 1 and 300),

  add constraint message_templates_document_stamped
    check ((document is null) = (document_updated_at is null)),

  add constraint message_templates_draft_stamped
    check ((draft_document is null) = (draft_updated_at is null));

alter table public.message_templates
  alter column body drop not null;

alter table public.message_templates
  drop constraint message_templates_body_length,
  add constraint message_templates_body_length
    check (body is null or length(btrim(body)) between 1 and 20000);

comment on column public.message_templates.body is
  'The plain-text form of the message, and no longer the whole of a template. '
  'NULL IS NOW A REAL STATE AND IT MEANS "this template has no plain-text '
  'version": a manager who builds a message in the block editor has authored a '
  'document, not a paragraph, and the row created for them carries no body. A '
  'blank body is still refused — message_templates_body_length keeps the 1 to '
  '20000 bound for every body that is present — so the difference between "not '
  'written" and "written as nothing" survives, which is the guarantee the '
  'not-null constraint was really protecting.';

comment on constraint message_templates_body_length on public.message_templates is
  '[§12] A body, if there is one, is between 1 and 20000 characters after '
  'trimming. The null branch is what the block editor needed: it creates a row '
  'the moment a document is first drafted for a key, and there is no honest '
  'plain-text wording to put in it. Inventing one would be seeding wording '
  'nobody approved, which is the mistake this table has avoided from the start.';

comment on column public.message_templates.document is
  'The published authored document — the ordered list of typed blocks a manager '
  'built in the block editor, stored exactly as AuthoredDocument is shaped in '
  'src/lib/domain/email/document.ts. Null means nothing has been published for '
  'this key and the coded default in src/lib/config/message-documents.ts governs '
  'what the guest receives, which is the state every row ships in. The plain '
  'body column beside it is untouched by the editor and stays the fallback for '
  'the plain-text path.';

comment on column public.message_templates.draft_document is
  'The document being worked on, invisible to the send path. A draft is saved '
  'and re-saved as often as the manager likes and nothing reads it until '
  'public.publish_message_template moves it across, which is the whole point of '
  'the split: editing the wording that reaches a guest must not be the same act '
  'as changing it [§12, §5.1].';

comment on column public.message_templates.preheader is
  'The published preview line an inbox shows beside the subject. Email only, '
  'like subject, and null when none was authored. It is written by '
  'public.publish_message_template from the draft and by nothing else.';

comment on column public.message_templates.draft_subject is
  'The unpublished subject, flattened to text with its {{variable}} tokens left '
  'in place. The authored document carries the subject as inline nodes as well; '
  'this column exists so the template list can show a subject without parsing '
  'every document, and so publishing is a column copy rather than a render.';

comment on column public.message_templates.draft_preheader is
  'The unpublished preview line, flattened the same way as draft_subject.';

comment on column public.message_templates.document_updated_at is
  'When this key was last published. Null exactly when document is null, which '
  'message_templates_document_stamped enforces — "there is a published document" '
  'is one fact and must not be recorded in two columns that can disagree.';

comment on column public.message_templates.draft_updated_at is
  'When the draft was last saved, null exactly when there is no draft.';

comment on constraint message_templates_document_shaped on public.message_templates is
  '[R-31] The cheapest shape that makes the column readable: an object carrying '
  'a blocks array, or nothing. It deliberately does NOT validate a block. The '
  'block union lives in src/lib/domain/email/document.ts and is parsed with Zod '
  'at the boundary; transcribing eleven block kinds into SQL would be a second '
  'copy of a type that changes, and the copy would drift silently. What the '
  'database owes is that a reader can trust document -> ''blocks'' to be an '
  'array, and that a stray string or number can never be stored here.';

comment on constraint message_templates_draft_document_shaped on public.message_templates is
  '[R-31] The same shape rule for the unpublished document. See '
  'message_templates_document_shaped.';


alter table public.message_templates
  drop constraint message_templates_key_known,
  add constraint message_templates_key_known check (key = any (array[
    'waitlist_confirmation',
    'waitlist_signup_notification',
    'staff_invitation',
    'staff_password_reset',
    'contact_acknowledgement',
    'contact_notification',
    'booking_confirmation',
    'payment_received',
    'payment_failed',
    'booking_rescheduled',
    'booking_cancelled',
    'refund_issued',
    'booking_reminder',
    'directions_and_parking',
    'review_request',
    'secure_link',
    'payment_link',
    'invoice_issued'
  ]::text[]));

comment on constraint message_templates_key_known on public.message_templates is
  '[§12] The closed list of message templates, widened from twelve to the '
  'eighteen in SYSTEM_MESSAGE_KEYS in src/lib/config/message-documents.ts, which '
  'this array is character-identical to. THE SIX NEW KEYS REVERSE AN EARLIER '
  'DECISION AND SHOULD BE READ AS SUCH: the original column comment said the '
  'waitlist, contact and staff emails were "not Management-configurable, so they '
  'are outside §12''s suitable templates", and it closed with "Adding them is a '
  'migration, taken when somebody decides they belong". This is that migration. '
  'They are here because every one of them is an email WellPlace actually sends '
  'today, and a template screen that shows twelve messages while the system '
  'sends eighteen tells a manager something untrue about their own business. '
  'The list stays deliberately narrower than messages_template_key_known is '
  'wide: the §11.5 message log still accepts only the twelve guest booking '
  'kinds, because queueing a staff password reset into a guest message log would '
  'put a single-use credential link in a table Reception reads [§13].';

comment on column public.message_templates.key is
  'The template identity, constrained to a closed list that is '
  'character-identical to SYSTEM_MESSAGE_KEYS in '
  'src/lib/config/message-documents.ts. A text key rather than an enum, because '
  'a template is configuration and adding one should not rewrite a type every '
  'view depends on; a check constraint refuses a typo just as firmly. See '
  'message_templates_key_known for why the six non-booking emails joined the '
  'twelve.';


insert into public.message_templates (key, channel, is_active, is_marketing, body)
values
  ('waitlist_confirmation', 'email', true, false,
   'You are on the WellPlace waitlist. We will share first looks before we open, and you will be among the first to hear when booking opens.'),

  ('waitlist_signup_notification', 'email', true, false,
   'Someone has joined the WellPlace waitlist. Open the Management console to see the entry.'),

  ('staff_invitation', 'email', true, false,
   'You have been added to the WellPlace console. Use the link in this message to choose your password.'),

  ('staff_password_reset', 'email', true, false,
   'Use the link in this message to choose a new password for the WellPlace console.'),

  ('contact_acknowledgement', 'email', true, false,
   'Thank you for writing to WellPlace. Your message has reached the team and we will reply as soon as we can.'),

  ('contact_notification', 'email', true, false,
   'A visitor has sent a message through the WellPlace website contact form.')
on conflict (key) do nothing;

comment on table public.message_templates is
  'The §12 automatic templates, and since the block editor the authored '
  'documents behind every system email. Management configures the timing, '
  'channel, active status and content — exactly the four §12 names and nothing '
  'more. IT NO LONGER SHIPS EMPTY, and the reason the original decision has '
  'changed is worth keeping: a row used to be the whole of a template, so '
  'seeding one meant seeding wording nobody had approved, which "would read as '
  'approved wording within a week and could reach a guest". A row is now the '
  'editor''s handle on a message, and what the guest receives is decided by the '
  'document column — null on every seeded row, so the coded default in '
  'src/lib/config/message-documents.ts is what actually sends. The six rows '
  'inserted here carry a one-line plain body because the column is not null and '
  'because the plain-text path still reads it; none of them carries a subject, '
  'so nothing here can be mistaken for authored wording. Written only by RPCs; '
  'no role holds an INSERT, UPDATE or DELETE grant [R-02, R-14].';


create or replace view public.message_documents with (security_invoker = true) as
select
  t.key,
  t.channel,
  t.is_active,
  t.is_marketing,
  t.subject,
  t.preheader,
  t.body,
  t.timing_minutes,
  t.document,
  t.draft_document,
  t.draft_subject,
  t.draft_preheader,
  t.document is not null       as is_published,
  t.draft_document is not null as has_draft,
  coalesce(jsonb_array_length(t.document -> 'blocks'), 0)       as published_blocks,
  coalesce(jsonb_array_length(t.draft_document -> 'blocks'), 0) as draft_blocks,
  t.document_updated_at,
  t.draft_updated_at,
  t.updated_at
from public.message_templates t;

comment on view public.message_documents is
  '[§12, R-03] Every message template with its published and unpublished '
  'document, for the Management template list and the block editor. Security '
  'invoker, so message_templates_select_staff decides who sees it and this view '
  'adds no visibility of its own — it is a stable read contract and a permission '
  'boundary, not a second policy. is_published, has_draft and the two block '
  'counts are computed here so a list page can show the state of eighteen '
  'templates without shipping eighteen documents to the server component that '
  'only needs to count them.';

revoke all on public.message_documents from public, anon;
grant select on public.message_documents to authenticated;

comment on policy message_templates_select_staff on public.message_templates is
  'Staff read, transcribed from docs/5 §3''s "read business rules" row: a '
  'configured template is a rule about what the guest is told, not a '
  'confidential figure [§10.6], and §9.2 has Reception resending a confirmation, '
  'a reminder, a secure link or a payment link — which it cannot do sensibly '
  'without seeing what it is about to send. The authored document columns fall '
  'under this same policy for the same reason: they are the wording, in a richer '
  'form. Configuring them is Management only [§12, §10.7] and there is still no '
  'write policy on this table — public.set_message_template, '
  'public.save_message_template_draft, public.publish_message_template and '
  'public.reset_message_template are the only writers, each a definer function '
  'that checks the role itself and writes its own audit entry [R-02, R-14].';


create function public.save_message_template_draft(
  p_key       text,
  p_document  jsonb,
  p_subject   text,
  p_preheader text
)
returns table (
  template_key   text,
  has_draft      boolean,
  has_document   boolean,
  draft_blocks   integer,
  draft_saved_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key       text        := nullif(btrim(coalesce(p_key, '')), '');
  v_subject   text        := nullif(btrim(coalesce(p_subject, '')), '');
  v_preheader text        := nullif(btrim(coalesce(p_preheader, '')), '');
  v_saved_at  timestamptz := now();
  v_old       jsonb;
begin
  perform internal.require_management();

  if p_document is null then
    raise exception 'A draft needs a document. Add at least one block, then save.'
      using errcode = 'WP084';
  end if;

  select jsonb_build_object(
           'document',  t.draft_document,
           'subject',   t.draft_subject,
           'preheader', t.draft_preheader
         )
    into v_old
    from public.message_templates t
   where t.key = v_key
   for update;

  insert into public.message_templates
    (key, channel, is_active, is_marketing, body,
     draft_document, draft_subject, draft_preheader, draft_updated_at)
  values
    (v_key, 'email', true, v_key = 'review_request', null,
     p_document, v_subject, v_preheader, v_saved_at)
  on conflict (key) do update
     set draft_document   = excluded.draft_document,
         draft_subject    = excluded.draft_subject,
         draft_preheader  = excluded.draft_preheader,
         draft_updated_at = excluded.draft_updated_at
  returning
      public.message_templates.draft_document is not null,
      public.message_templates.document is not null,
      coalesce(jsonb_array_length(public.message_templates.draft_document -> 'blocks'), 0)
    into has_draft, has_document, draft_blocks;

  perform internal.write_audit(
    'save_message_template_draft',
    'public.message_templates',
    v_key,
    v_old,
    jsonb_build_object(
      'document',  p_document,
      'subject',   v_subject,
      'preheader', v_preheader
    ),
    'Email template draft edited from the console'
  );

  template_key   := v_key;
  draft_saved_at := v_saved_at;
  return next;
end
$$;

comment on function public.save_message_template_draft(text, jsonb, text, text) is
  '[§12, §5.1] Saves the unpublished document for one message template. '
  'Management only, transcribed from docs/5 §3 "Edit CMS content, SEO, '
  'templates — reception no, management yes".

IT TOUCHES THE DRAFT COLUMNS AND NOTHING ELSE. document, subject, preheader, body, channel, is_active and timing_minutes are all left exactly as they were, so a manager can rework a confirmation email for a week while the current one keeps going out unchanged. That separation is the reason the draft columns exist at all, and it is why this function does not share a code path with public.set_message_template, which is a whole-row replace of the plain template.

IT CREATES THE ROW WHEN THERE IS NONE, and that is not a convenience. Twelve of the eighteen keys have no row until somebody configures them — the table ships all but the six system emails empty — so a function that required a row would leave two thirds of the editor unable to save. A row created this way carries channel email because a block document is an email, is_active true, is_marketing derived from the key exactly as public.set_message_template derives it and message_templates_marketing_matches_kind then checks, and NO plain body: there is no honest plain-text wording for a message that has only ever been drawn as blocks, and inventing one would seed wording nobody approved. Note the consequence for the plain template screen, which reads a row''s existence as "somebody has written this": a key stays unwritten there until a draft is saved for it, which is true.

IT VALIDATES THE SHAPE AND NOT THE CONTENT. message_templates_draft_document_shaped refuses anything that is not an object carrying a blocks array; a null document is refused here with WP084 because the draft columns record "there is a draft", and a draft with no document is not one. Everything else — which block kinds exist, which variables a key may use, whether a link is https — is Zod''s at the boundary and inspectDocument''s in src/lib/domain/email/document.ts. A second copy in SQL would drift from the first the week the block union changes. An unknown key is refused by message_templates_key_known with 23514 naming the constraint, deliberately not by a list repeated here — the same choice public.set_message_template made and for the same reason.

THE REASON IS WRITTEN BY THE CODE, NOT TYPED BY THE PERSON. "A field edit does not ask why" [CLIENT, 8 September 2026], so the entry reads "Email template draft edited from the console" — the consoleEdit convention in src/lib/validation/audit-reason.ts, composed here because this signature deliberately carries no p_reason. The entry itself is unnarrowed: actor, action, entity, key, the whole previous draft and the whole new one [INV-13]. Storing the complete documents rather than a summary is on purpose — §11.5 and §10.6 need an answer to "what did this say when that message went out", and a block count cannot give one.';

revoke all on function public.save_message_template_draft(text, jsonb, text, text) from public;
grant execute on function public.save_message_template_draft(text, jsonb, text, text)
  to authenticated, service_role;


create function public.publish_message_template(p_key text)
returns table (
  template_key     text,
  published_blocks integer,
  published_at     timestamptz,
  has_draft        boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key          text        := nullif(btrim(coalesce(p_key, '')), '');
  v_published_at timestamptz := now();
  v_draft        jsonb;
  v_old          jsonb;
  v_new          jsonb;
begin
  perform internal.require_management();

  select
      t.draft_document,
      jsonb_build_object(
        'document',  t.document,
        'subject',   t.subject,
        'preheader', t.preheader
      ),
      jsonb_build_object(
        'document',  t.draft_document,
        'subject',   t.draft_subject,
        'preheader', t.draft_preheader
      )
    into v_draft, v_old, v_new
    from public.message_templates t
   where t.key = v_key
   for update;

  if not found or v_draft is null then
    raise exception 'There are no unpublished changes to publish.'
      using errcode = 'WP083';
  end if;

  update public.message_templates t
     set document            = t.draft_document,
         subject             = t.draft_subject,
         preheader           = t.draft_preheader,
         document_updated_at = v_published_at,
         draft_document      = null,
         draft_subject       = null,
         draft_preheader     = null,
         draft_updated_at    = null
   where t.key = v_key
  returning
      coalesce(jsonb_array_length(t.document -> 'blocks'), 0),
      t.draft_document is not null
    into published_blocks, has_draft;

  perform internal.write_audit(
    'publish_message_template',
    'public.message_templates',
    v_key,
    v_old,
    v_new,
    'Email template published from the console'
  );

  template_key := v_key;
  published_at := v_published_at;
  return next;
end
$$;

comment on function public.publish_message_template(text) is
  '[§12, §5.1] Moves the draft document into the published one for a single message template. Management only. One transaction: the copy across, the clearing of the draft and the audit entry either all happen or none do.

THIS IS THE MOMENT THE WORDING CHANGES FOR A GUEST, and it is the only one. Saving a draft changes nothing a guest can receive, which is why the two are separate functions rather than one with a flag: a flag makes publishing something a caller can do by accident. It refuses with WP083 when there is no draft, so publishing twice is a refusal and not a silent no-op that would leave the manager unsure which version is live. A key with no row at all takes the same WP083 and the same sentence, because a template nobody has drafted has nothing to publish — it creates no row, so publishing can never be the act that brings a template into existence.

IT PUBLISHES THE SUBJECT AND PREHEADER TOO, and note what that means for the plain template. subject is one column, shared with the §12 plain-text template public.set_message_template writes, so publishing a document whose subject is empty clears the plain subject with it. That is deliberate — one template has one subject, and two subjects that disagree is the defect this avoids — but it is why a manager who used the old plain editor sees their subject replaced rather than merged. body is never touched: the plain-text fallback survives publication and keeps its own wording.

The audit entry carries the complete previously published document as the old value and the complete newly published one as the new value, so §11.5 can answer what a template said on any date [INV-13]. The reason is composed by the code — "Email template published from the console", the consoleEdit convention in src/lib/validation/audit-reason.ts — because a field edit does not ask why [CLIENT, 8 September 2026].';

revoke all on function public.publish_message_template(text) from public;
grant execute on function public.publish_message_template(text) to authenticated, service_role;


create function public.reset_message_template(p_key text)
returns table (
  template_key     text,
  cleared_document boolean,
  cleared_draft    boolean,
  reset_at         timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key      text        := nullif(btrim(coalesce(p_key, '')), '');
  v_reset_at timestamptz := now();
  v_old      jsonb;
begin
  perform internal.require_management();

  select
      jsonb_build_object(
        'document',        t.document,
        'subject',         t.subject,
        'preheader',       t.preheader,
        'draft_document',  t.draft_document,
        'draft_subject',   t.draft_subject,
        'draft_preheader', t.draft_preheader
      ),
      t.document is not null,
      t.draft_document is not null
    into v_old, cleared_document, cleared_draft
    from public.message_templates t
   where t.key = v_key
   for update;

  if not found or not (cleared_document or cleared_draft) then
    raise exception 'There is nothing to reset. This message already uses the wording WellPlace ships with.'
      using errcode = 'WP082';
  end if;

  update public.message_templates t
     set document            = null,
         subject             = null,
         preheader           = null,
         document_updated_at = null,
         draft_document      = null,
         draft_subject       = null,
         draft_preheader     = null,
         draft_updated_at    = null
   where t.key = v_key;

  perform internal.write_audit(
    'reset_message_template',
    'public.message_templates',
    v_key,
    v_old,
    jsonb_build_object(
      'document',        null,
      'subject',         null,
      'preheader',       null,
      'draft_document',  null,
      'draft_subject',   null,
      'draft_preheader', null
    ),
    'Email template reset from the console'
  );

  template_key := v_key;
  reset_at     := v_reset_at;
  return next;
end
$$;

comment on function public.reset_message_template(text) is
  '[§12, §5.1] Returns one message template to the wording WellPlace ships with. Management only. It clears the published document, the draft, the subject and the preheader, which is exactly the state a row is created in, so the coded default for that key in src/lib/config/message-documents.ts governs the message again.

IT DOES NOT DELETE THE ROW, and that is the whole design. The row is the template''s identity: its key, channel, active flag, timing and plain body all survive, along with every audit entry pointing at it. Deleting and recreating would lose the channel and timing a manager had configured, and would make the audit trail read as though the template had ceased to exist. Reset is a clearing, not a removal.

IT CLEARS THE SUBJECT, for the same reason publication writes it: subject is one column shared with the plain §12 template. A reset that left the last published subject behind would leave the coded default half in force, which is worse than either state. body is kept — the column is not null, and the plain-text fallback is not part of what was authored here.

cleared_document and cleared_draft report what was actually there, so a caller can tell a reset that changed something from one that confirmed a template was already at its default. A template with nothing authored is refused with WP082 rather than quietly succeeding, whether it has a row or has never had one: in both states the template is already at its coded default, there is nothing to clear, and a success would tell the manager something happened when it did not. The audit entry carries the complete cleared document as the old value [INV-13]; the reason is composed by the code, following consoleEdit in src/lib/validation/audit-reason.ts.';

revoke all on function public.reset_message_template(text) from public;
grant execute on function public.reset_message_template(text) to authenticated, service_role;
