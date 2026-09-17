create type public.booking_status as enum (
  'draft',
  'held',
  'awaiting_payment',
  'payment_failed',
  'hold_expired',
  'awaiting_recovery',
  'confirmed',
  'checked_in',
  'completed',
  'rescheduled',
  'cancelled',
  'no_show',
  'abandoned'
);

comment on type public.booking_status is
  'The booking lifecycle [OUR CHOICE — doc 1 enumerates payment and suite '
  'states, not booking states]. The labels are character-identical to '
  'BOOKING_STATUSES in src/lib/domain/booking/index.ts, which owns the '
  'transition table: the database stores where a booking is, the pure domain '
  'module decides where it may go next. Two spellings of one state is how a '
  'guard silently stops guarding, so a change here is a change there in the '
  'same commit. awaiting_recovery is the §8.2 late-payment path made visible: '
  'a guest who has paid without a live hold is a state with an owner, never a '
  'silent gap.';

create type public.booking_source as enum (
  'online',
  'walk_in',
  'telephone',
  'manual',
  'complimentary'
);

comment on type public.booking_source is
  'How the booking came to exist. §9.2 names the four Reception creation types '
  '— walk-in, telephone, manual and complimentary — and online is the guest '
  'flow of §6.1. Reception and the website share one engine [§1], so this '
  'column is the only thing that distinguishes them and §11.2 reports on it.';

create type public.guest_kind as enum ('adult', 'child');

comment on type public.guest_kind is
  'Adult or child [§6.2]. The age boundary between the two is '
  'booking.child_max_age and booking.booker_min_age, both settings, so it is '
  'not encoded here.';

alter type public.consent_origin add value if not exists 'booking_form';


create table public.bookings (
  id            uuid primary key default gen_random_uuid(),

  reference     text not null unique,

  customer_id   uuid not null references public.customers(id),

  suite_id      uuid references public.suites(id),
  occupancy_id  uuid references public.suite_occupancy(id),

  source        public.booking_source not null,
  status        public.booking_status not null,

  experience_period tstzrange not null,

  cleaning_buffer_minutes integer not null,

  arrived_at    timestamptz,
  checked_in_at timestamptz,
  checked_out_at timestamptz,

  late_arrival_minutes integer,
  overrun_minutes      integer,

  personal_request text,
  internal_note    text,

  subtotal_fils    integer not null default 0,
  discount_fils    integer not null default 0,
  addons_fils      integer not null default 0,
  service_fee_fils integer not null default 0,
  tax_fils         integer not null default 0,
  total_fils       integer not null default 0,

  is_complimentary boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.staff(id),

  constraint bookings_reference_shaped
    check (reference ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'),
  constraint bookings_reference_length
    check (length(reference) between 6 and 32),

  constraint bookings_experience_period_bounded
    check (
      not lower_inf(experience_period)
      and not upper_inf(experience_period)
      and not isempty(experience_period)
    ),

  constraint bookings_cleaning_buffer_non_negative
    check (cleaning_buffer_minutes >= 0),

  constraint bookings_late_arrival_non_negative
    check (late_arrival_minutes is null or late_arrival_minutes >= 0),
  constraint bookings_overrun_non_negative
    check (overrun_minutes is null or overrun_minutes >= 0),

  constraint bookings_personal_request_length
    check (personal_request is null
       or length(personal_request) between 1 and 2000),
  constraint bookings_internal_note_length
    check (internal_note is null or length(internal_note) between 1 and 2000),

  constraint bookings_money_non_negative
    check (
      subtotal_fils >= 0
      and discount_fils >= 0
      and addons_fils >= 0
      and service_fee_fils >= 0
      and tax_fils >= 0
      and total_fils >= 0
    ),

  constraint bookings_complimentary_source_is_flagged
    check (source <> 'complimentary' or is_complimentary),

  constraint bookings_occupancy_claimed_once unique (occupancy_id)
);

comment on table public.bookings is
  'The booking [§6, §7, §11]. What the guest bought, what they were charged and '
  'where the visit reached. The claim on a suite lives in '
  'public.suite_occupancy, not here, because only one table can carry the '
  'exclusion constraint that makes double booking impossible [§3, §7.5, '
  'INV-02]. Written only by RPCs; no role holds an INSERT, UPDATE or DELETE '
  'grant on this table [R-02].';

comment on column public.bookings.reference is
  'The human-readable reference quoted by guests and staff, and one of §9.1''s '
  'five search keys. The database constrains its shape only — upper-case '
  'alphanumeric groups, optionally hyphenated, 6 to 32 characters — and never '
  'its prefix or its length in a way that would make a change to the '
  'generator a migration. Generating a collision-free value is the job of the '
  'function that creates a booking. Stored upper case so the lower(reference) '
  'index answers a guest typing it in any case.';

comment on column public.bookings.customer_id is
  'Required. A booking always belongs to a customer record [§10.5], which is '
  'what gives §11.4 its new-versus-returning split. Deliberately NOT '
  'on delete cascade: the INV-28 retention sweep must not silently erase a '
  'financial record as a side effect of removing a contact. The reference '
  'refuses the delete instead, so the sweep has to decide, in code and under '
  'audit, what happens to a booking older than the retention window.';

comment on column public.bookings.suite_id is
  'Nullable ON PURPOSE [§8.2]. A guest can be paid and hold no suite: that is '
  'the recovery path, an alertable operational state that '
  'src/lib/domain/alerts names payment_without_suite, and it must be '
  'representable or the §8.2 flow has nowhere to sit. NOT NULL here would '
  'force the recovery code to invent an allocation it does not have.';

comment on column public.bookings.occupancy_id is
  'The claim this booking currently holds in public.suite_occupancy. Nullable '
  'for the same §8.2 reason as suite_id, and after an atomic reschedule it '
  'points at the new row while the released one keeps its own booking_id — so '
  'the history survives on the occupancy side and the current claim is '
  'unambiguous on this side. Unique, because one live claim cannot belong to '
  'two bookings.';

comment on column public.bookings.experience_period is
  'What the guest bought, without the cleaning buffer [§7.1]. Duplicated from '
  'the occupancy row on purpose: the claim can be released — a reschedule, a '
  'cancellation, the §8.2 gap — and the booking still has to say what was '
  'sold, on the receipt and in every §11 report. Bounded on both sides and '
  'non-empty, matching public.suite_occupancy.';

comment on column public.bookings.cleaning_buffer_minutes is
  'The buffer this booking was sold with [§7.1], stored on the row and never '
  'read back from settings at query time. Changing the default applies to new '
  'bookings; existing ones keep this value. Reading it from settings later '
  'would silently re-date every past booking the first time Management '
  'retunes it, and the §7.1 worked example would stop reproducing.';

comment on column public.bookings.arrived_at is
  'Three distinct fields, not one [§9.2]. Arrival is when the guest reached '
  'the venue, check-in is when the visit started, check-out is when it ended. '
  'Collapsing any pair loses late arrival, overrun, or both.';

comment on column public.bookings.late_arrival_minutes is
  'Recorded, not derived [§9.2]. The rule that turns a lateness into a '
  'consequence is rules.late_arrival, a setting applied above the database.';

comment on column public.bookings.overrun_minutes is
  'The measured overrun [§7.6]. Only the actual overrun is charged, in '
  'commenced increments of overrun.increment_minutes — a setting, so the '
  'rounding is applied by the pricing engine and this column keeps the raw '
  'measurement.';

comment on column public.bookings.personal_request is
  'The guest''s free-text request [§6.1]. The ceiling here is storage sanity, '
  'not the business limit: booking.personal_request_max_length is a setting '
  'and is enforced by the Zod schema at the boundary. A check constraint '
  'holding the business number would make a Management change a migration.';

comment on column public.bookings.internal_note is
  'Operational note. Never rendered on a guest-facing surface [§3].';

comment on column public.bookings.subtotal_fils is
  'The stored priced breakdown [§6.4, §11.2, INV-21]. Reporting sums these '
  'columns and never recomputes a price, so a later change to a price rule '
  'cannot rewrite history. Integer fils throughout [R-16]. There is '
  'deliberately no check constraint asserting that the parts sum to '
  'total_fils: §6.4 allows a manual override under '
  'perm:manual_price_change, and a constraint that fights an authorised, '
  'audited change is a constraint that gets dropped in an incident.';

comment on column public.bookings.total_fils is
  'The amount the guest owes, before any refund. Not gated on this table: '
  'which figures are confidential under §10.6 is unanswered (Q-10), so the '
  'permission check lives in the reporting views that project money, where '
  'internal.has_permission(''view_confidential_figures'') can be applied per '
  'column. Base-table RLS here is staff read, matching docs/5 §3.';

comment on column public.bookings.is_complimentary is
  'INV-20, §11.2: complimentary bookings appear separately and never count as '
  'revenue. A flag rather than a status, because a complimentary booking still '
  'moves through confirmed, checked_in and completed like any other. The '
  'constraint is one-directional: a booking created as complimentary must '
  'carry the flag, while a booking taken as a walk-in and later comped may '
  'also carry it.';

comment on column public.bookings.created_by is
  'The staff member who created it, or null for an online guest booking. The '
  'audit entry written by the creating RPC is the authoritative actor record '
  'either way [§3, INV-13]. This is NOT a visibility filter: docs/5 §3 is '
  'explicit that Reception sees every booking and no per-creator filter is '
  'built.';

create index bookings_experience_period_idx
  on public.bookings using gist (experience_period);

create index bookings_status_idx
  on public.bookings (status);

create index bookings_suite_idx
  on public.bookings (suite_id);

create unique index bookings_reference_lookup_idx
  on public.bookings (lower(reference));

create index bookings_customer_idx
  on public.bookings (customer_id);

create index bookings_created_by_idx
  on public.bookings (created_by);

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function internal.set_updated_at();

alter table public.bookings enable row level security;


create table public.booking_guests (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,

  kind       public.guest_kind not null,
  age        integer,

  created_at timestamptz not null default now(),

  constraint booking_guests_age_matches_kind
    check ((kind = 'child') = (age is not null)),

  constraint booking_guests_age_plausible
    check (age is null or age between 0 and 120)
);

comment on table public.booking_guests is
  'One row per guest [§6.2]. A row, not a pair of counters, because §6.2 asks '
  'for the age of each child and a count cannot carry one.';

comment on column public.booking_guests.age is
  'Age in years, never a date of birth: §6.2 requires an age for a child and '
  'explicitly does not require a child''s full date of birth, so storing one '
  'would collect personal data the contract does not ask for [§13]. Present '
  'for a child and absent for an adult, enforced both ways. The permitted '
  'window is booking.child_min_age and booking.child_max_age — settings, '
  'enforced above the database — so the check here is only a storage '
  'plausibility bound and must not be read as the business rule.';

create index booking_guests_booking_idx
  on public.booking_guests (booking_id);

alter table public.booking_guests enable row level security;


create table public.addons (
  id          uuid primary key default gen_random_uuid(),

  name        text not null,
  description text,
  image_path  text,

  price_fils  integer not null,

  is_taxable  boolean not null default true,
  is_active   boolean not null default true,
  sort_order  integer not null default 100,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint addons_name_length check (length(btrim(name)) between 1 and 120),
  constraint addons_description_length
    check (description is null or length(description) between 1 and 2000),
  constraint addons_image_path_length
    check (image_path is null or length(image_path) between 1 and 512),
  constraint addons_price_non_negative check (price_fils >= 0)
);

comment on table public.addons is
  'Bookable extras [§10.4]. Configuration, not code — Management creates and '
  'prices them. SHIPS EMPTY on purpose: no price list has been supplied '
  '(Q-15) and a seeded placeholder reads as confirmed within a week. An empty '
  'add-on step is a correct empty state [§4.1], not a blocked screen. Names '
  'are deliberately not unique, so a retired add-on can be superseded by a new '
  'one carrying the same name; public.booking_addons snapshots the name it '
  'sold anyway.';

comment on column public.addons.price_fils is
  'Integer fils, 1 AED = 100 [R-16]. The value a guest actually paid is '
  'snapshotted onto public.booking_addons at booking time, so editing this '
  'never moves a past booking [INV-21].';

comment on column public.addons.is_taxable is
  'Whether tax.vat_percent applies to this line [ASSUMED — Q-4]. The rate and '
  'its treatment are unanswered, so the flag exists and defaults to on while '
  'the rate stays unset and the computed tax stays zero.';

create index addons_active_order_idx
  on public.addons (sort_order, name)
  where is_active;

create trigger addons_set_updated_at
  before update on public.addons
  for each row execute function internal.set_updated_at();

alter table public.addons enable row level security;


create table public.booking_addons (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  addon_id   uuid references public.addons(id) on delete set null,

  name_snapshot    text not null,
  unit_price_fils  integer not null,
  quantity         integer not null default 1,

  line_total_fils  integer
    generated always as (unit_price_fils * quantity) stored,

  created_at timestamptz not null default now(),

  constraint booking_addons_name_snapshot_length
    check (length(btrim(name_snapshot)) between 1 and 120),
  constraint booking_addons_unit_price_non_negative
    check (unit_price_fils >= 0),
  constraint booking_addons_quantity_positive
    check (quantity > 0)
);

comment on table public.booking_addons is
  'The add-on lines of a booking [§10.4, §11.2]. Name and unit price are '
  'snapshotted at booking time so §11 never recomputes a past order from '
  'today''s configuration [INV-21], and so a receipt reprinted next year still '
  'says what the guest bought.';

comment on column public.booking_addons.addon_id is
  'Nullable, and set null rather than cascade if an add-on is ever hard '
  'deleted: the line describes something the guest was charged for and must '
  'survive the disappearance of its configuration row. The snapshot columns '
  'are what reporting reads; this reference is only the drill-down.';

comment on column public.booking_addons.line_total_fils is
  'Generated and stored, so §11.2 sums a column instead of trusting every '
  'caller to multiply the same way [INV-21].';

create index booking_addons_booking_idx
  on public.booking_addons (booking_id);

create unique index booking_addons_one_line_per_addon_idx
  on public.booking_addons (booking_id, addon_id);

alter table public.booking_addons enable row level security;


create table public.acceptance_records (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id),

  accepted_at timestamptz not null default now(),

  source      public.booking_source not null,

  document_slug    text not null,
  document_version text not null,

  checkbox_text    text not null,

  constraint acceptance_records_document_slug_shaped
    check (document_slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'),
  constraint acceptance_records_document_slug_length
    check (length(document_slug) between 1 and 64),
  constraint acceptance_records_document_version_length
    check (length(btrim(document_version)) between 1 and 64),
  constraint acceptance_records_checkbox_text_length
    check (length(btrim(checkbox_text)) between 1 and 2000)
);

comment on table public.acceptance_records is
  'Proof of what a guest agreed to [§6.3]: the booking, the moment, where it '
  'happened, the document slug and version, and the literal sentence that was '
  'ticked. ONE REQUIRED CHECKBOX, not several [CLIENT 31 Aug 2026, Q-14] — the '
  'same rule public.waitlist_entries already follows — so one acceptance '
  'writes one row per document it names, all sharing the same wording and the '
  'same instant. No foreign key to the legal text: the documents live in '
  'src/lib/config/legal/documents.ts at version 1.3 and a reference to a '
  'mutable row would let a later edit change what a guest is recorded as '
  'having agreed to. Never deleted with a booking, so the reference does not '
  'cascade.';

comment on column public.acceptance_records.checkbox_text is
  'The exact string rendered beside the tick box, supplied by the caller from '
  'src/lib/config/consent.ts, so the wording shown and the wording stored are '
  'one constant and cannot drift apart. Storing a key instead would leave the '
  'evidence pointing at a string somebody can edit.';

comment on column public.acceptance_records.source is
  'Where the acceptance was given [§6.3]. Reuses public.booking_source '
  'because §6.3''s source is the same axis §9.2 already enumerates — an '
  'acceptance taken at the desk for a telephone booking is a different record '
  'from one ticked online, and reporting should not have to guess.';

create index acceptance_records_booking_idx
  on public.acceptance_records (booking_id);

create unique index acceptance_records_one_per_document_idx
  on public.acceptance_records (booking_id, document_slug);

alter table public.acceptance_records enable row level security;


alter table public.suite_occupancy
  add column booking_id uuid references public.bookings(id),
  add column reason     text,
  add column created_by uuid references public.staff(id);

alter table public.suite_occupancy
  add constraint suite_occupancy_reason_length
    check (reason is null or length(btrim(reason)) between 1 and 500),
  add constraint suite_occupancy_block_has_reason
    check (kind <> 'block' or reason is not null);

comment on column public.suite_occupancy.booking_id is
  'The booking this claim belongs to, where there is one. Null for a block or '
  'a maintenance window, which belong to the venue rather than to a guest, and '
  'null for a hold until the payment converts it. Not unique: a rescheduled '
  'booking leaves its released row behind pointing here, which is exactly the '
  'history §9.1''s suite timeline needs to explain a gap.';

comment on column public.suite_occupancy.reason is
  'Why a suite was taken out of service [§9.2]. Required for a block, because '
  'a block with no reason is a suite nobody can explain at the desk. '
  'Maintenance is left free, since a maintenance window usually carries its '
  'reason in the task that raised it.';

comment on column public.suite_occupancy.created_by is
  'The staff member who created the claim, or null for a hold taken by the '
  'public booking flow, which has no session. The audit entry written by the '
  'creating function remains the authoritative actor record [§3, INV-13].';

create index suite_occupancy_booking_idx
  on public.suite_occupancy (booking_id);

create index suite_occupancy_created_by_idx
  on public.suite_occupancy (created_by);


revoke all on public.bookings           from anon, authenticated;
revoke all on public.booking_guests     from anon, authenticated;
revoke all on public.addons             from anon, authenticated;
revoke all on public.booking_addons     from anon, authenticated;
revoke all on public.acceptance_records from anon, authenticated;

grant select on public.bookings           to authenticated;
grant select on public.booking_guests     to authenticated;
grant select on public.addons             to authenticated;
grant select on public.booking_addons     to authenticated;
grant select on public.acceptance_records to authenticated;

create policy bookings_select_staff on public.bookings
  for select to authenticated
  using (internal.is_staff());

create policy booking_guests_select_staff on public.booking_guests
  for select to authenticated
  using (internal.is_staff());

create policy addons_select_staff on public.addons
  for select to authenticated
  using (internal.is_staff());

create policy booking_addons_select_staff on public.booking_addons
  for select to authenticated
  using (internal.is_staff());

create policy acceptance_records_select_staff on public.acceptance_records
  for select to authenticated
  using (internal.is_staff());

comment on policy bookings_select_staff on public.bookings is
  'Transcribed from docs/5 §3: "View all bookings, all suites, all views — '
  'yes" for both roles, and docs/5 §1 records that the per-creator filter '
  'claimed in supercut4 is contradicted by §9.1 and is not built. Read only. '
  'There is no insert, update or delete policy on this table by design: every '
  'write is a SECURITY DEFINER function that takes the lock, honours the '
  'exclusion constraint and writes its own audit entry [R-02, R-14, INV-13], '
  'exactly as public.suite_occupancy is already handled. Money columns are '
  'not gated here; Q-10 gating belongs in the reporting views.';

comment on policy addons_select_staff on public.addons is
  'Reception reads the add-on catalogue because §9.2 has it creating walk-in '
  'and telephone bookings, which means selling add-ons. Configuring them is '
  'Management only (docs/5 §3, §10.4) and arrives as an RPC, not as a write '
  'policy.';

comment on policy acceptance_records_select_staff on public.acceptance_records is
  'Reception reads acceptance evidence: §9.1 puts the booking detail in front '
  'of the desk, and "did this guest accept the house rules" is an operational '
  'question asked at the door. Nothing may write through a policy — an '
  'acceptance record is evidence, and evidence that a client session can '
  'insert is not evidence [§6.3].';
