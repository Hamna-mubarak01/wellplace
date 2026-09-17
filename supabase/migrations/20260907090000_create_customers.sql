
create table public.customers (
  id                  uuid primary key default gen_random_uuid(),

  salutation          public.salutation,
  first_name          text not null,
  last_name           text not null,
  email               text not null,

  date_of_birth       date,

  phone_e164          text not null,
  phone_country       text not null,

  identity_key        text generated always as (internal.normalise_email(email)) stored,

  is_blocked          boolean not null default false,
  warning_note        text,
  internal_note       text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  last_interaction_at timestamptz not null default now(),

  constraint customers_first_name_length check (length(first_name) between 1 and 80),
  constraint customers_last_name_length  check (length(last_name)  between 1 and 80),

  constraint customers_email_length    check (length(email) between 3 and 254),
  constraint customers_email_shaped    check (email like '%_@_%._%'),
  constraint customers_email_lowercase check (email = lower(email)),

  constraint customers_phone_e164_shaped
    check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  constraint customers_phone_country_shaped
    check (phone_country ~ '^[A-Z]{2}$'),

  constraint customers_dob_plausible
    check (date_of_birth is null
       or (date_of_birth > date '1900-01-01' and date_of_birth <= current_date)),

  constraint customers_warning_note_length
    check (warning_note is null or length(warning_note) between 1 and 2000),
  constraint customers_internal_note_length
    check (internal_note is null or length(internal_note) between 1 and 2000)
);

comment on table public.customers is
  'The customer record [§10.5, §11.4]. Contact details, calculated age, tags, '
  'notes, warnings and blocked status. Booking history and total value are not '
  'columns here — they are derived by the reporting views, so INV-21 keeps '
  'summing stored values instead of recomputing them. Written only by RPCs; no '
  'role holds an INSERT, UPDATE or DELETE grant on this table.';

comment on column public.customers.identity_key is
  'The customer identity key [ASSUMED — Q-1]. The normalised email, produced by '
  'the same internal.normalise_email() that deduplicates public.waitlist_entries, '
  'so one person reaching us twice through two surfaces normalises identically. '
  'Doc 1 never states what makes two bookings the same person: §6.1 lets guests '
  'book without an account while §10.5 and §11.4 require a persistent record with '
  'history and a new-versus-returning split. Email is our reading and it is '
  'unconfirmed. Keeping the rule in one generated column plus one unique index is '
  'what makes a move to mobile, or to a normalised pair, a migration rather than a '
  'hunt through application code.';

comment on column public.customers.date_of_birth is
  'Nullable [OUR CHOICE]. §10.5 requires the booker date of birth and §6.2 gates '
  'the 18+ check on it, but that requirement attaches to the booker of a booking, '
  'not to every customer row: Reception can hold a contact before any booking '
  'exists. NOT NULL here would force a caller with no date to invent one, and a '
  'fabricated date corrupts the §10.5 birthday lists and the age gate silently, '
  'which is worse than an honest null. Presence is enforced where the contract '
  'puts it, in the function that creates a booking.';

comment on column public.customers.last_interaction_at is
  'The retention anchor [CONFIRMED, INV-28, R-46]. Personal data is deleted 24 '
  'months after the last interaction, so the retention sweep reads this column and '
  'never created_at. Every RPC that touches a customer moves it forward.';

comment on column public.customers.is_blocked is
  'Blocked status [§10.5]. Also the §11.4 blocked-or-flagged report. Readable by '
  'Reception: a block only Management can see cannot stop anyone at the door.';

comment on column public.customers.warning_note is
  'The §10.5 warning. Operational, shown to whoever meets the guest, which is why '
  'it sits beside the record rather than in public.customer_notes.';

comment on column public.customers.internal_note is
  'The §10.5 internal note. Never rendered on a guest-facing surface [§3].';

create unique index customers_identity_key_idx
  on public.customers (identity_key);

create index customers_last_interaction_at_idx
  on public.customers (last_interaction_at);

create index customers_last_name_idx
  on public.customers (lower(last_name), lower(first_name));

create index customers_phone_e164_idx
  on public.customers (phone_e164);

create index customers_blocked_idx
  on public.customers (last_interaction_at desc)
  where is_blocked;

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function internal.set_updated_at();

alter table public.customers enable row level security;


create table public.customer_tags (
  customer_id uuid not null references public.customers(id) on delete cascade,
  tag         text not null,

  created_at  timestamptz not null default now(),
  created_by  uuid references public.staff(id),

  primary key (customer_id, tag),

  constraint customer_tags_tag_length    check (length(tag) between 1 and 40),
  constraint customer_tags_tag_lowercase check (tag = lower(tag)),
  constraint customer_tags_tag_shaped    check (tag ~ '^[a-z0-9]([a-z0-9 _-]*[a-z0-9])?$')
);

comment on table public.customer_tags is
  'Customer tags [§10.5], a filter dimension for the §11.4 customer reports. The '
  'primary key is the pair, so the same tag cannot be attached twice.';

comment on column public.customer_tags.tag is
  'Stored lower case so (customer_id, tag) genuinely deduplicates and "VIP" and '
  '"vip" cannot become two tags. Display casing is a presentation concern.';

comment on column public.customer_tags.created_by is
  'Nullable because a tag applied by a system rule has no staff actor. The audit '
  'entry written by the tagging RPC is the authoritative record either way '
  '[§3, INV-13].';

create index customer_tags_created_by_idx
  on public.customer_tags (created_by);

create index customer_tags_tag_idx
  on public.customer_tags (tag);

alter table public.customer_tags enable row level security;


create table public.customer_notes (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,

  body        text not null,
  author_id   uuid references public.staff(id),

  created_at  timestamptz not null default now(),

  constraint customer_notes_body_length
    check (length(btrim(body)) between 1 and 4000)
);

comment on table public.customer_notes is
  'Internal notes on a customer [§10.5]. One row per note, never an edited blob, '
  'so a note keeps its author and its date and the §11.1 drill-down has something '
  'to land on. Cascades with the customer, because a note about a person is that '
  'person''s data under the 24-month retention rule (INV-28).';

comment on column public.customer_notes.author_id is
  'Nullable so deactivating a staff account never removes the note they wrote. '
  'Staff rows are deactivated rather than deleted [§10.6], so this stays populated '
  'in practice.';

create index customer_notes_customer_idx
  on public.customer_notes (customer_id, created_at desc);

create index customer_notes_author_idx
  on public.customer_notes (author_id);

alter table public.customer_notes enable row level security;


alter table public.marketing_consent_events
  add column customer_id uuid references public.customers(id) on delete cascade;

alter table public.marketing_consent_events
  alter column waitlist_entry_id drop not null;

alter table public.marketing_consent_events
  add constraint marketing_consent_events_one_subject
    check (num_nonnulls(waitlist_entry_id, customer_id) = 1);

comment on column public.marketing_consent_events.customer_id is
  'The §10.5 marketing status of a customer. There is deliberately NO '
  'marketing_status column on public.customers: §11.4 asks for acceptance, '
  'unsubscribes and source, which is history and not a boolean, and '
  'public.waitlist_leads already establishes the pattern of reducing the current '
  'position from this table by seq. A denormalised copy on the customer row would '
  'be a second source of truth, and it drifts the first time an unsubscribe is '
  'written by anything other than the one code path that maintains it. The origin '
  'values for customer-side consent arrive with the migration that builds the '
  'surface writing them, not ahead of it.';

comment on constraint marketing_consent_events_one_subject
  on public.marketing_consent_events is
  'A consent event belongs to exactly one subject — a waitlist entry or a '
  'customer, never both and never neither. This replaces the NOT NULL that '
  'waitlist_entry_id carried while the waitlist was the only subject.';

create index marketing_consent_events_customer_idx
  on public.marketing_consent_events (customer_id, seq desc);


revoke all on public.customers      from anon, authenticated;
revoke all on public.customer_tags  from anon, authenticated;
revoke all on public.customer_notes from anon, authenticated;

grant select on public.customers      to authenticated;
grant select on public.customer_tags  to authenticated;
grant select on public.customer_notes to authenticated;

create policy customers_select_staff on public.customers
  for select to authenticated
  using (internal.is_staff());

create policy customer_tags_select_staff on public.customer_tags
  for select to authenticated
  using (internal.is_staff());

create policy customer_notes_select_staff on public.customer_notes
  for select to authenticated
  using (internal.is_staff());

comment on policy customers_select_staff on public.customers is
  'Transcribed from docs/5 §3: §9.1 requires Reception to search by name, mobile '
  'and email across every booking, which it cannot do without the customer record. '
  'Reception reads and does not write — correction and deletion are '
  'perm:correct_customer_record [§10.5], and every write arrives through a '
  'SECURITY DEFINER RPC that checks the permission and writes its own audit entry '
  '[R-02, INV-13]. Customer total value is confidential [§10.6] and is not a '
  'column here; the view that derives it gates on '
  'internal.has_permission(''view_confidential_figures'').';

comment on policy customer_notes_select_staff on public.customer_notes is
  'Reception reads notes [OUR CHOICE, Q-10]. §10.5 groups tags, notes, warnings '
  'and blocked status as one feature and §10.6 makes confidential *figures* the '
  'permission, not operational text. A note the front desk cannot see is a note '
  'that does not do its job. Narrow this if the client enumerates Q-10 otherwise.';
