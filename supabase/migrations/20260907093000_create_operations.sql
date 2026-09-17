create type public.cleaning_status as enum (
  'pending',
  'in_progress',
  'confirmed'
);

comment on type public.cleaning_status is
  'The three §9.2 cleaning actions made into states: "start, assign and confirm '
  'completion of a cleaning task". Assignment is not a state — a task can be '
  'assigned before or after it starts — so it is a column, not a fourth label. '
  'There is deliberately no cancelled value: a suite that came free was either '
  'cleaned or it was not, and a cleaning task nobody confirmed is exactly the '
  '§9.3 alert this table exists to raise.';

create type public.task_status as enum (
  'open',
  'in_progress',
  'done',
  'cancelled'
);

comment on type public.task_status is
  'The status of an assigned task [§10.6 — OUR CHOICE for the values]. §10.6 '
  'requires "due date, priority, note and status" and enumerates none of them, '
  'so these four are ours: the two terminal outcomes are kept apart because a '
  'task that was cancelled is not a task that was done, and collapsing them '
  'would make the §9.2 "work on and complete assigned tasks" count wrong. '
  'Change this list and the Reception task list changes with it, so a new value '
  'is a migration and a decision, never a convenience.';

create type public.task_priority as enum (
  'low',
  'normal',
  'high',
  'urgent'
);

comment on type public.task_priority is
  'Task priority [§10.6 — OUR CHOICE for the values]. §10.6 names priority as a '
  'field and never says what its values are. Four levels with an unmistakable '
  'middle, so the default carries no urgency by accident. An ordered enum '
  'rather than an integer, so a sort cannot silently invert when somebody '
  'decides 1 means highest.';

create type public.alert_kind as enum (
  'hold_expiring',
  'payment_without_suite',
  'payment_failed',
  'message_failed',
  'arrival_overdue',
  'checkin_overdue',
  'cleaning_unconfirmed',
  'upcoming_conflict',
  'refund_pending',
  'manual_review_pending'
);

comment on type public.alert_kind is
  'The §9.3 operational alerts. The labels are character-identical to '
  'ALERT_KINDS in src/lib/domain/alerts/index.ts, and in the same order: the '
  'pure predicates that raise each one are unit-tested there, and a value the '
  'database spells differently is a detected alert that cannot be written. A '
  'change here is a change there in the same commit. Ten values decompose §9.3''s '
  'seven bullets faithfully rather than inventing anything — bullet three splits '
  'into payment_failed and message_failed, bullet four into arrival_overdue and '
  'checkin_overdue, bullet seven into refund_pending and manual_review_pending. '
  'Each split exists because the two halves are raised by different facts, are '
  'resolved by different people, and would otherwise share one row and hide each '
  'other.';

create type public.alert_severity as enum (
  'critical',
  'warning',
  'info'
);

comment on type public.alert_severity is
  'How loudly an alert asks for attention. Character-identical to AlertSeverity '
  'in src/lib/domain/alerts/index.ts, where ALERT_SEVERITY maps every kind to '
  'exactly one of these. §9.3 lists the alerts and grades none of them, so the '
  'grading is [OUR CHOICE] and the mapping deliberately lives in the domain '
  'module rather than in a check constraint here — see the comment on '
  'public.alerts.severity.';

create type public.message_channel as enum (
  'email',
  'whatsapp'
);

comment on type public.message_channel is
  'How a message reaches the guest [§12]: "at minimum email and one official '
  'WhatsApp Business integration". Click-to-Chat is not a value here — it is a '
  'link a guest presses, not a message we send, so it produces no row. Both '
  'providers sit behind adapters in src/lib/messaging [§3, R-06], so swapping '
  'Resend or the WhatsApp Cloud API changes no enum.';

create type public.message_status as enum (
  'queued',
  'sent',
  'failed',
  'cancelled'
);

comment on type public.message_status is
  'The delivery state of one message [§12, §11.5]. §12 requires failures to be '
  'logged and retried automatically or manually, so failed is a state a row '
  'rests in and not an exception that vanished. cancelled exists for a message '
  'that is no longer worth sending — a reminder for a booking cancelled before '
  'it fired — because deleting the row would remove it from the §11.5 report '
  'that has to explain why the guest never heard from us.';


create table public.cleaning_tasks (
  id           uuid primary key default gen_random_uuid(),

  suite_id     uuid not null references public.suites(id),
  booking_id   uuid references public.bookings(id),

  status       public.cleaning_status not null default 'pending',

  due_from     timestamptz not null,

  started_at   timestamptz,
  assigned_to  uuid references public.staff(id),

  confirmed_at timestamptz,
  confirmed_by uuid references public.staff(id),

  note         text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint cleaning_tasks_confirmed_carries_time
    check ((status = 'confirmed') = (confirmed_at is not null)),

  constraint cleaning_tasks_started_is_not_pending
    check (started_at is null or status <> 'pending'),

  constraint cleaning_tasks_confirmed_by_needs_confirmation
    check (confirmed_by is null or confirmed_at is not null),

  constraint cleaning_tasks_note_length
    check (note is null or length(btrim(note)) between 1 and 2000)
);

comment on table public.cleaning_tasks is
  'A suite needs cleaning [§9.2]. Start, assign and confirm are the three '
  'actions §9.2 names, and this table records who did which and when. '
  'THIS TABLE DOES NOT GATE AVAILABILITY, AND THAT IS A DECISION, NOT AN '
  'OMISSION [Q-16]. §7.1 is explicit that the cleaning buffer is what protects '
  'the next start, and public.suite_occupancy already blocks the buffered period '
  'through its exclusion constraint; the suite therefore returns to availability '
  'when the buffer elapses, whether or not anybody has pressed confirm. An '
  'unconfirmed task raises the §9.3 cleaning_unconfirmed alert and does nothing '
  'else. supercut4 records the client proposing the opposite — that a suite stays '
  'unavailable until Reception confirms the clean — and that is video, not '
  'contract, so doc 1 wins until they answer Q-16. NOTHING IN THE ALLOCATION '
  'PATH MAY READ THIS TABLE. Wiring it into public.hold_suite would make '
  'availability depend on a human action, put a second source of truth beside '
  'the exclusion constraint, and quietly break INV-02''s guarantee that one '
  'table decides who holds a suite. If Q-16 comes back the other way it is a '
  'migration plus a change to the allocation function, taken deliberately.';

comment on column public.cleaning_tasks.booking_id is
  'Nullable. §9.2 also blocks a suite for maintenance or for a reason of its '
  'own, and a suite coming out of a block needs cleaning just as much as one '
  'coming out of a visit. No cascade: the record that a suite was cleaned is '
  'operational history and outlives whatever caused it.';

comment on column public.cleaning_tasks.due_from is
  'When the suite came free — the instant the confirmation deadline is measured '
  'from. src/lib/domain/alerts/index.ts reads exactly this as CleaningFact.dueFrom '
  'and compares it against reception.cleaning_confirm_minutes, a setting [§10.2, '
  'INV-16], so the threshold is Management-configurable and nothing about it is '
  'a literal here. Not created_at: a task can be raised in advance of the suite '
  'actually being free, and measuring from the row''s birth would start the clock '
  'on a suite still occupied.';

comment on column public.cleaning_tasks.assigned_to is
  'Nullable, because §9.2 lists starting, assigning and confirming as three '
  'independent actions and an unassigned task is a real state Reception looks '
  'at. Staff rows are deactivated rather than deleted [§10.6], so this stays '
  'resolvable.';

comment on column public.cleaning_tasks.confirmed_by is
  'Who confirmed the clean [§9.2]. The audit entry written by the confirming RPC '
  'remains the authoritative actor record [§3, INV-13]; this column is what the '
  'Reception timeline shows without a join into the audit schema.';

create index cleaning_tasks_suite_idx
  on public.cleaning_tasks (suite_id, due_from desc);

create index cleaning_tasks_booking_idx
  on public.cleaning_tasks (booking_id);

create index cleaning_tasks_assigned_to_idx
  on public.cleaning_tasks (assigned_to);

create index cleaning_tasks_confirmed_by_idx
  on public.cleaning_tasks (confirmed_by);

create index cleaning_tasks_unconfirmed_idx
  on public.cleaning_tasks (due_from)
  where status <> 'confirmed';

comment on index public.cleaning_tasks_unconfirmed_idx is
  'The §9.3 alert scan reads open tasks by age and nothing else, so the index is '
  'partial on the only rows it can ever raise an alert for. It keeps that scan '
  'proportional to the backlog rather than to the history.';

create trigger cleaning_tasks_set_updated_at
  before update on public.cleaning_tasks
  for each row execute function internal.set_updated_at();

alter table public.cleaning_tasks enable row level security;


create table public.tasks (
  id           uuid primary key default gen_random_uuid(),

  title        text not null,
  note         text,

  assigned_to  uuid references public.staff(id),
  assigned_by  uuid references public.staff(id),

  due_on       date,

  priority     public.task_priority not null default 'normal',
  status       public.task_status not null default 'open',

  completed_at timestamptz,
  completed_by uuid references public.staff(id),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint tasks_title_length
    check (length(btrim(title)) between 1 and 200),

  constraint tasks_note_length
    check (note is null or length(btrim(note)) between 1 and 4000),

  constraint tasks_done_carries_time
    check ((status = 'done') = (completed_at is not null)),

  constraint tasks_completed_by_needs_completion
    check (completed_by is null or completed_at is not null)
);

comment on table public.tasks is
  'A task assigned to a person [§10.6]: "Tasks can be assigned to individual '
  'Reception or Management users with due date, priority, note and status". A '
  'first-class entity with its own lifecycle, never a column hung off a booking '
  '— §9.2 has Reception working on and completing tasks that Management raised, '
  'which needs a row that belongs to neither console. Written only by RPCs; no '
  'role holds an INSERT, UPDATE or DELETE grant [R-02, R-14].';

comment on column public.tasks.assigned_to is
  'The individual user §10.6 names. Nullable, because a task can exist before '
  'anybody owns it and an unowned task is precisely what a Reception task list '
  'should show first. Deliberately NOT a role: §10.6 says "individual Reception '
  'or Management users", and assigning to a role makes every task everybody''s '
  'and therefore nobody''s.';

comment on column public.tasks.due_on is
  'A DATE, not a timestamp, and one of the few places on this schema that is '
  'correct [§10.6, R-16]. A due date is a calendar day a person works to, not an '
  'instant, and storing midnight in some zone would turn a Dubai deadline into a '
  'yesterday somewhere else. Every actual event time on this schema stays '
  'timestamptz [INV-24].';

comment on column public.tasks.priority is
  'Defaults to normal, so a task created without a decision does not shout. The '
  'values are ours, not the contract''s — see the comment on '
  'public.task_priority.';

comment on column public.tasks.completed_at is
  'Set exactly when the status reaches done, enforced in both directions. A '
  'cancelled task is deliberately not completed: it carries no completion time, '
  'so §11 can count what was actually finished.';

create index tasks_assigned_to_idx
  on public.tasks (assigned_to);

create index tasks_assigned_by_idx
  on public.tasks (assigned_by);

create index tasks_completed_by_idx
  on public.tasks (completed_by);

create index tasks_open_idx
  on public.tasks (due_on nulls last, priority desc)
  where status in ('open', 'in_progress');

alter table public.tasks enable row level security;


create table public.alerts (
  id              uuid primary key default gen_random_uuid(),

  kind            public.alert_kind not null,
  severity        public.alert_severity not null,

  entity          text not null,
  entity_id       text not null,

  opened_at       timestamptz not null default now(),

  resolved_at     timestamptz,
  resolved_by     uuid references public.staff(id),
  resolution_note text,

  detail          jsonb,

  constraint alerts_entity_shaped
    check (entity ~ '^[a-z_.]+$'),

  constraint alerts_entity_length
    check (length(entity) between 1 and 120),

  constraint alerts_entity_id_length
    check (length(btrim(entity_id)) between 1 and 200),

  constraint alerts_resolution_needs_resolving
    check (
      resolved_at is not null
      or (resolved_by is null and resolution_note is null)
    ),

  constraint alerts_resolution_note_length
    check (resolution_note is null
       or length(btrim(resolution_note)) between 1 and 2000)
);

comment on table public.alerts is
  'Open and resolved operational alerts [§9.3], the source of §9.1''s "current '
  'alerts and required actions" and of §11.5''s open-alert reporting. An alert '
  'is a row that stays until somebody or something resolves it, never a '
  'notification that was shown once and lost. Written only by RPCs; no role '
  'holds an INSERT, UPDATE or DELETE grant [R-02, R-14].';

comment on column public.alerts.severity is
  'Stored on the row rather than derived from the kind. The kind-to-severity '
  'mapping is ALERT_SEVERITY in src/lib/domain/alerts/index.ts and the database '
  'deliberately does NOT duplicate it as a check constraint: §9.3 lists the '
  'alerts and grades none of them, so the grading is [OUR CHOICE] and retuning '
  'it must not be a migration. Contrast public.message_templates.is_marketing, '
  'which IS constrained, because a mislabelled template silently breaks INV-17 '
  'and a mislabelled severity only changes what sorts first.';

comment on column public.alerts.entity is
  'The table the alert is about, in the same schema-qualified lower-case shape '
  'audit.entries uses and behind the same check, so one operational vocabulary '
  'covers both. Text and not a foreign key on purpose: alerts point at six '
  'different tables and a polymorphic reference cannot be one column of one '
  'type. The drill-down joins in the §9.3 view, where the kind already says '
  'which table to look in.';

comment on column public.alerts.detail is
  'Whatever the raising scan knew at the time — remaining minutes, the suite, '
  'the provider error. Context for the person who has to act, never the '
  'authoritative record, which stays on the entity the alert points at.';

create unique index alerts_open_unique_idx
  on public.alerts (kind, entity, entity_id)
  where resolved_at is null;

comment on index public.alerts_open_unique_idx is
  'THE IDEMPOTENCY GUARANTEE FOR THE §9.3 SCAN. reconcileAlerts in '
  'src/lib/domain/alerts/index.ts keys every open alert by exactly '
  'kind:entity:entity_id, so re-running the scan must not open a second copy of '
  'something already open. Partial on resolved_at is null, which is what makes '
  'the rule correct rather than merely tight: the same alert can legitimately '
  'recur — a cleaning task confirmed late and neglected again tomorrow — and '
  'once the first is resolved a new one is a new row with its own opened_at, '
  'which is what §11.5 counts. A full unique index would refuse that second '
  'occurrence and lose it. An application-side "is it already open?" check races '
  'the moment two scans overlap; a unique index does not.';

create index alerts_open_idx
  on public.alerts (severity, opened_at desc)
  where resolved_at is null;

create index alerts_entity_idx
  on public.alerts (entity, entity_id, opened_at desc);

create index alerts_resolved_by_idx
  on public.alerts (resolved_by);

alter table public.alerts enable row level security;


create table public.shift_notes (
  id             uuid primary key default gen_random_uuid(),

  author_id      uuid references public.staff(id),

  shift_on       date not null,
  body           text not null,

  handed_over_at timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint shift_notes_body_length
    check (length(btrim(body)) between 1 and 4000)
);

comment on table public.shift_notes is
  'The §9.2 shift-handover note. One row per note, so a handover keeps its '
  'author and its day and the next shift can read what the last one actually '
  'wrote instead of an edited blob. Not attached to a booking or a suite: a '
  'handover is about the day, which is why doc 3''s "real Reception use" defect '
  'class names a shift handover mid-day as its own scenario.';

comment on column public.shift_notes.shift_on is
  'The operating day the note belongs to, as a DATE. The one place a calendar '
  'day is the right storage type [R-16]: a shift is named by its day in Dubai, '
  'and a night shift crossing midnight UTC still belongs to the day Reception '
  'calls it. Every instant on this table stays timestamptz [INV-24].';

comment on column public.shift_notes.handed_over_at is
  'Null until the note has actually been handed over, so a note written and '
  'never passed on is visible as an unfinished handover rather than '
  'indistinguishable from a completed one.';

comment on column public.shift_notes.author_id is
  'Nullable so deactivating a staff account never removes the note they left '
  '[§10.6], matching public.customer_notes.';

create index shift_notes_shift_on_idx
  on public.shift_notes (shift_on desc, created_at desc);

create index shift_notes_author_idx
  on public.shift_notes (author_id);

create trigger shift_notes_set_updated_at
  before update on public.shift_notes
  for each row execute function internal.set_updated_at();

alter table public.shift_notes enable row level security;


create table public.message_templates (
  key            text primary key,

  channel        public.message_channel not null,

  is_active      boolean not null default true,
  is_marketing   boolean not null default false,

  subject        text,
  body           text not null,

  timing_minutes integer,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint message_templates_key_known
    check (key in (
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
      'payment_link'
    )),

  constraint message_templates_marketing_matches_kind
    check (is_marketing = (key = 'review_request')),

  constraint message_templates_whatsapp_has_no_subject
    check (channel <> 'whatsapp' or subject is null),

  constraint message_templates_subject_length
    check (subject is null or length(btrim(subject)) between 1 and 300),

  constraint message_templates_body_length
    check (length(btrim(body)) between 1 and 20000),

  constraint message_templates_timing_plausible
    check (timing_minutes is null
       or timing_minutes between -525600 and 525600)
);

comment on table public.message_templates is
  'The §12 automatic templates. Management configures the timing, channel, '
  'active status and content — exactly the four §12 names and nothing more. '
  'SHIPS EMPTY on purpose: §12 puts the content under Management and none has '
  'been supplied, so a seeded placeholder would read as approved wording within '
  'a week and could reach a guest. A missing template is a correct empty state '
  '[§4.1], and the send path falls back to the rendered templates in '
  'src/lib/messaging/templates rather than sending nothing. Written only by '
  'RPCs; no role holds an INSERT, UPDATE or DELETE grant [R-02, R-14].';

comment on column public.message_templates.key is
  'The template identity, constrained to a closed list that is '
  'character-identical to BOOKING_TEMPLATE_KEYS in '
  'src/lib/domain/messaging/index.ts. The eleven cover §12''s nine named '
  'templates plus the two §6.5 and §8 guest links — secure_link and '
  'payment_link — which §9.2 requires Reception to be able to resend. A text '
  'key rather than an enum, because a template is configuration and adding one '
  'should not rewrite a type every view depends on; a check constraint refuses '
  'a typo just as firmly. THE THREE NON-BOOKING EMAILS ARE NOT HERE — contact, '
  'waitlist and staff invitation are rendered in src/lib/messaging/templates and '
  'are not Management-configurable, so they are outside §12''s "suitable '
  'templates" and outside this list. Adding them is a migration, taken when '
  'somebody decides they belong in the §11.5 message log.';

comment on constraint message_templates_marketing_matches_kind
  on public.message_templates is
  'INV-17 AT DATABASE LEVEL, AND THE §16.1 ACCEPTANCE TEST BEHIND IT: '
  '"booking-related messages continue to function if marketing communication is '
  'later disabled" [§12]. The classification is transcribed from TEMPLATE_KIND '
  'in src/lib/domain/messaging/index.ts, where review_request is the only '
  'marketing template, and it is a constraint rather than a default because both '
  'directions of getting it wrong are damaging and silent. Flag a booking '
  'confirmation as marketing and the marketing kill-switch stops a guest '
  'learning their booking exists — INV-17 broken, with nothing failing loudly. '
  'Flag the review request as transactional and it escapes the same switch, '
  'which is a consent problem [§11.4]. Note what this constraint does NOT touch: '
  'is_active, channel, timing and body stay entirely Management''s, which is '
  'the whole of what §12 grants them. Re-classifying a template is a migration '
  'and a change to TEMPLATE_KIND in the same commit.';

comment on column public.message_templates.timing_minutes is
  'The §12 timing, in minutes relative to the anchor the template is about, '
  'NEGATIVE BEFORE AND POSITIVE AFTER: a reminder twenty-four hours ahead is '
  '-1440, a review request two hours later is 120. Null means send immediately '
  'on the event. The one-year bound either side is a storage plausibility limit '
  'and must not be read as a business rule — what Management may set is §12''s '
  '"configure the timing", enforced above the database [INV-16].';

comment on column public.message_templates.subject is
  'Email only. A WhatsApp message has no subject line, and a template carrying '
  'one would render a field the channel cannot show. An email template is '
  'expected to carry one and that requirement is enforced at the boundary, not '
  'here, so a half-written template can still be saved.';

create index message_templates_active_idx
  on public.message_templates (channel, key)
  where is_active;

create trigger message_templates_set_updated_at
  before update on public.message_templates
  for each row execute function internal.set_updated_at();

alter table public.message_templates enable row level security;


create table public.messages (
  id                  uuid primary key default gen_random_uuid(),

  template_key        text not null,

  channel             public.message_channel not null,
  status              public.message_status not null default 'queued',

  booking_id          uuid references public.bookings(id),
  customer_id         uuid references public.customers(id),

  to_address          text not null,

  subject             text,
  body                text,

  is_marketing        boolean not null,

  attempt_count       integer not null default 0,
  last_attempt_at     timestamptz,

  failed_at           timestamptz,
  error               text,

  provider_message_id text,

  sent_at             timestamptz,

  created_at          timestamptz not null default now(),

  constraint messages_template_key_known
    check (template_key in (
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
      'payment_link'
    )),

  constraint messages_marketing_matches_template
    check (is_marketing = (template_key = 'review_request')),

  constraint messages_address_matches_channel
    check (
      (channel = 'email'    and to_address like '%_@_%._%')
      or (channel = 'whatsapp' and to_address ~ '^\+[1-9][0-9]{6,14}$')
    ),

  constraint messages_address_length
    check (length(to_address) between 3 and 254),

  constraint messages_whatsapp_has_no_subject
    check (channel <> 'whatsapp' or subject is null),

  constraint messages_subject_length
    check (subject is null or length(btrim(subject)) between 1 and 300),

  constraint messages_body_length
    check (body is null or length(body) between 1 and 20000),

  constraint messages_attempt_count_non_negative
    check (attempt_count >= 0),

  constraint messages_last_attempt_needs_an_attempt
    check (attempt_count > 0 or last_attempt_at is null),

  constraint messages_sent_needs_an_attempt
    check (sent_at is null or attempt_count > 0),

  constraint messages_sent_carries_time
    check ((status = 'sent') = (sent_at is not null)),

  constraint messages_failed_carries_time
    check ((status = 'failed') = (failed_at is not null)),

  constraint messages_error_length
    check (error is null or length(btrim(error)) between 1 and 2000),

  constraint messages_provider_message_id_length
    check (provider_message_id is null
       or length(btrim(provider_message_id)) between 1 and 200)
);

comment on table public.messages is
  'Every message we have tried to send [§12, §11.5]. §11.5 reports "delivery and '
  'errors for email and WhatsApp messages, including retry attempts", so this '
  'table is the evidence for that report and not a convenience log. ATTEMPTS ARE '
  'COUNTED ON THE ROW, WHICH IS THE POINT: §9.2''s "resend confirmation, '
  'reminder, secure link or payment link" must be a RECORDED ATTEMPT AND NEVER A '
  'SILENT RE-FIRE, so a resend increments attempt_count and moves '
  'last_attempt_at on the message it is resending rather than quietly calling '
  'the provider again. A guest who says they received four confirmations and a '
  'log that shows one is a dispute nobody can settle [§17.5]. Written only by '
  'RPCs; no role holds an INSERT, UPDATE or DELETE grant [R-02, R-14].';

comment on column public.messages.template_key is
  'Which template produced this message, constrained to the same closed list as '
  'public.message_templates.key. Deliberately NOT a foreign key to that table: '
  'message_templates ships empty by design, and a reference would mean the first '
  'booking confirmation cannot be logged until Management has configured one — '
  'the §12 fallback would send the message and lose the record of it. It also '
  'keeps the §11.5 history readable after a template row is removed.';

comment on column public.messages.is_marketing is
  'Snapshotted onto the message, not joined from the template, so §11.5 can '
  'still classify a message whose template was later removed or reconfigured. '
  'Constrained to agree with the template key for the same INV-17 reason the '
  'template table is — see the comment on '
  'message_templates_marketing_matches_kind. Deliberately has NO default: the '
  'caller states what it is sending, because a column that defaults to '
  'transactional is a column that classifies a marketing send as transactional '
  'the first time somebody forgets it.';

comment on column public.messages.to_address is
  'The email address or the E.164 mobile number, matched against the channel so '
  'the two cannot be swapped. E.164 with a leading plus, the same shape '
  'public.customers.phone_e164 stores, so a number round-trips between the two '
  'without normalising [§6.1].';

comment on column public.messages.body is
  'The rendered body as sent, so §11.5 and any later dispute can see what the '
  'guest actually received rather than what today''s template would produce. '
  'Nullable, because a message queued but never rendered has none — an absent '
  'body is that fact, not a blank message.';

comment on column public.messages.failed_at is
  'Set exactly while the message IS failed, cleared when a retry moves it on, '
  'enforced in both directions against the status. This is load-bearing for '
  '§9.3: src/lib/domain/alerts/index.ts raises message_failed on '
  'MessageFact.failedAt being non-null, and reconcileAlerts resolves an alert '
  'the moment the scan stops detecting it. A failed_at kept as history after a '
  'successful retry would leave the alert open forever and train Reception to '
  'ignore the alert list. When the message failed is preserved by '
  'last_attempt_at, which the retry does not clear.';

comment on column public.messages.attempt_count is
  'Incremented on every delivery attempt, automatic or manual [§12, §11.5]. A '
  'sent message must carry at least one attempt, which is the database tripwire '
  'for a caller that marks something sent without going through the adapter.';

comment on column public.messages.provider_message_id is
  'The Resend or WhatsApp identifier for the delivery, so a provider-side '
  'investigation can be tied back to a booking. Deliberately not unique: a retry '
  'of the same message produces a new provider id and both belong to this one '
  'row, and the provider owns its own namespace anyway.';

create index messages_booking_idx
  on public.messages (booking_id, created_at desc);

create index messages_customer_idx
  on public.messages (customer_id, created_at desc);

create index messages_template_idx
  on public.messages (template_key, created_at desc);

create index messages_queued_idx
  on public.messages (created_at)
  where status = 'queued';

create index messages_failed_idx
  on public.messages (failed_at desc)
  where status = 'failed';

create index messages_provider_message_id_idx
  on public.messages (provider_message_id);

alter table public.messages enable row level security;


revoke all on public.cleaning_tasks    from anon, authenticated;
revoke all on public.tasks             from anon, authenticated;
revoke all on public.alerts            from anon, authenticated;
revoke all on public.shift_notes       from anon, authenticated;
revoke all on public.message_templates from anon, authenticated;
revoke all on public.messages          from anon, authenticated;

grant select on public.cleaning_tasks    to authenticated;
grant select on public.tasks             to authenticated;
grant select on public.alerts            to authenticated;
grant select on public.shift_notes       to authenticated;
grant select on public.message_templates to authenticated;
grant select on public.messages          to authenticated;

create policy cleaning_tasks_select_staff on public.cleaning_tasks
  for select to authenticated
  using (internal.is_staff());

create policy tasks_select_staff on public.tasks
  for select to authenticated
  using (internal.is_staff());

create policy alerts_select_staff on public.alerts
  for select to authenticated
  using (internal.is_staff());

create policy shift_notes_select_staff on public.shift_notes
  for select to authenticated
  using (internal.is_staff());

create policy message_templates_select_staff on public.message_templates
  for select to authenticated
  using (internal.is_staff());

create policy messages_select_staff on public.messages
  for select to authenticated
  using (internal.is_staff());

comment on policy cleaning_tasks_select_staff on public.cleaning_tasks is
  'Transcribed from docs/5 §3, "Cleaning tasks — start, assign, confirm: '
  'reception yes, management yes" and "Notes, shift handover, tasks, alerts: '
  'yes, yes". Read only. There is no insert, update or delete policy on any '
  'table in this migration by design: every write is a SECURITY DEFINER RPC that '
  'writes its own audit entry [R-02, R-14, INV-13], and those arrive with A7. No '
  'per-creator filter, matching docs/5 §1 — Reception sees the whole floor, not '
  'only its own rows.';

comment on policy tasks_select_staff on public.tasks is
  'Transcribed from docs/5 §3. Both roles read every task, not only the ones '
  'assigned to them: §9.2 has Reception "work on and complete assigned '
  'Management or Reception tasks", which needs the list, and a task list '
  'filtered to the assignee hides the unassigned task nobody has picked up. '
  'Assignment is a routing hint, never a visibility boundary. Read only.';

comment on policy alerts_select_staff on public.alerts is
  'Transcribed from docs/5 §3: "Notes, shift handover, tasks, alerts — '
  'reception: yes". §9.1 puts "current alerts and required actions" on the '
  'Reception daily overview, so an alert Reception cannot see is an alert that '
  'does not work. Note that this reads the alert, not the confidential figure '
  'behind it: refund_pending tells Reception a refund needs attention, while the '
  'amount stays behind '
  'internal.has_permission(''view_confidential_figures'') on public.refunds '
  '[§10.6, INV-15]. Read only — resolving an alert is an RPC that records who '
  'resolved it and why.';

comment on policy shift_notes_select_staff on public.shift_notes is
  'Transcribed from docs/5 §3, "shift handover: yes, yes". A handover note only '
  'one shift can read is not a handover. Read only.';

comment on policy message_templates_select_staff on public.message_templates is
  'Staff read, transcribed from docs/5 §3''s "read business rules" row: a '
  'configured template is a rule about what the guest is told, not a '
  'confidential figure [§10.6], and §9.2 has Reception resending a confirmation, '
  'a reminder, a secure link or a payment link — which it cannot do sensibly '
  'without seeing what it is about to send. Configuring them is Management only '
  '[§12, §10.7] and arrives as an audited RPC, never a write policy.';

comment on policy messages_select_staff on public.messages is
  'Staff read, transcribed from docs/5 §3. §9.2''s resend and §9.1''s daily '
  'overview both need the message history, and a resend that cannot see whether '
  'the first attempt failed is a guess. ONE CAVEAT, AND IT IS NOT SETTLED: a '
  'payment_link or secure_link body contains a link docs/5 §3 classifies as '
  'confidential under perm:view_confidential_figures, on our reading of §10.6 '
  '[OUR CHOICE, Q-10]. The base table stays operational-read because removing '
  'it would remove the §9.2 resend with it; the gating belongs in the A9 '
  'reporting and console views, which project the body and can redact per '
  'column on internal.has_permission(''view_confidential_figures''). If Q-10 '
  'comes back narrower, that view is the one place that changes.';
