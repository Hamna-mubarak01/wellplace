create type public.payment_status as enum (
  'open',
  'pending',
  'paid',
  'partially_refunded',
  'fully_refunded',
  'failed',
  'cancelled',
  'manual_review'
);

comment on type public.payment_status is
  'The eight contractual payment states [§8]. The labels are character-identical '
  'to PAYMENT_STATUSES in src/components/console/reception/booking-filters.ts, '
  'which the Reception payment filter reads: two spellings of one state is how a '
  'filter silently stops matching, so a change here is a change there in the same '
  'commit. §8 says "at minimum" and this list is exactly its minimum — nothing '
  'has been invented on top. manual_review is a state a human owns, not an error '
  'code, which is why it sits in the enum rather than in a nullable flag.';

create type public.payment_method as enum (
  'cash',
  'card_terminal',
  'payment_link',
  'online',
  'complimentary'
);

comment on type public.payment_method is
  'How the money was taken. §8 names the four Reception recordings verbatim — '
  '"Reception may record cash, card terminal, payment link or complimentary '
  'payment for walk-ins" — and online is the guest checkout of §6.1. This is the '
  'settlement channel, NOT the card scheme or the wallet: the hosted checkout presents cards, '
  'Apple Pay, Google Pay and Tabby inside one hosted checkout and every one of '
  'them arrives here as online. Splitting the enum by scheme would make the '
  'provider a schema concern and break the §3 rule that a provider change never '
  'rebuilds the booking core.';


create table public.payments (
  id             uuid primary key default gen_random_uuid(),

  booking_id     uuid not null references public.bookings(id),

  status         public.payment_status not null,
  method         public.payment_method not null,

  amount_fils      integer not null,
  service_fee_fils integer not null default 0,

  provider_reference text,

  recorded_by  uuid references public.staff(id),
  recorded_at  timestamptz not null default now(),

  note         text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint payments_money_non_negative
    check (amount_fils >= 0 and service_fee_fils >= 0),

  constraint payments_provider_reference_length
    check (provider_reference is null
       or length(btrim(provider_reference)) between 1 and 128),

  constraint payments_provider_reference_carries_no_card
    check (
      provider_reference is null
      or (
        provider_reference !~ '[0-9]{15}'
        and provider_reference !~ '[0-9]{4}[ -][0-9]{4}[ -][0-9]{4}[ -][0-9]{2,4}'
      )
    ),

  constraint payments_note_length
    check (note is null or length(btrim(note)) between 1 and 2000)
);

comment on table public.payments is
  'One payment against one booking [§8]. Covers the guest checkout and every '
  'Reception recording — cash, card terminal, payment link and complimentary — '
  'because §8 requires gateway transaction, booking, receipt and refund to be '
  'uniquely linked and reconcilable, and two tables for one concept cannot be '
  'reconciled. Not one row per booking: a retry after a failure, a link reissued '
  'at the desk and a part payment are separate rows with separate outcomes, and '
  '§11.2 needs each of them. Written only by RPCs; no role holds an INSERT, '
  'UPDATE or DELETE grant on this table [R-02, R-14].';

comment on column public.payments.booking_id is
  'Required, and deliberately NOT on delete cascade — the same reasoning '
  'public.bookings.customer_id already carries. A financial record must not '
  'vanish as a side effect of removing something upstream of it. The reference '
  'refuses the delete instead, so the decision about a payment attached to a '
  'booking being removed is taken in code, under audit, by whoever wants it.';

comment on column public.payments.status is
  'One of the eight §8 states. There is no transition check in the database: the '
  'permitted moves belong beside the booking transition table in '
  'src/lib/domain, where a rejected move can return a typed result instead of '
  'raising 23514 at a guest mid-checkout [R-32].';

comment on column public.payments.amount_fils is
  'Integer fils, 1 AED = 100 [R-16]. Non-negative rather than positive, because '
  'a complimentary booking is a genuine payment record of zero [§11.2, INV-20] — '
  'it must be reconcilable and it must never be counted as revenue, and a row '
  'that cannot exist can be neither.';

comment on column public.payments.service_fee_fils is
  'The §8.1 service fee actually charged, stored as its own line so §8 can put '
  'it on the receipt and §11.2 can report it without unpicking a sum. '
  'INV-19: the percentage is applied to the order value BEFORE the fee and never '
  'compounds on itself. This column stores the output of one implementation — '
  'src/lib/domain/pricing/index.ts, the pure engine that also backs the booking '
  'flow, Reception, the §10.4 test-price preview and every receipt. Nothing '
  'recomputes this value from today''s configuration afterwards; reporting sums '
  'what is stored [INV-21], so retuning a percentage tomorrow cannot rewrite what '
  'a guest was charged today.';

comment on column public.payments.provider_reference is
  'The gateway or terminal reference that makes a payment reconcilable [§8], and '
  'one of §9.1''s five search keys. A TOKEN OR A REFERENCE ONLY. §13 is absolute: '
  'no complete card data is held in the application, ever — not a PAN, not a CVV, '
  'not an expiry, not here and not in note. the provider''s hosted checkout means we never '
  'receive those values, and the length cap plus '
  'payments_provider_reference_carries_no_card are the database tripwire for the '
  'day a caller above this layer gets it wrong.';

comment on constraint payments_provider_reference_carries_no_card
  on public.payments is
  'Structural refusal of anything shaped like a card number [§13]: a run of '
  'fifteen or more digits, or four digit groups separated by spaces or hyphens. '
  'Fifteen, not thirteen, is deliberate — a millisecond epoch is exactly thirteen '
  'digits and a provider minting one as a reference must not be rejected in '
  'production. A provider that genuinely issues longer numeric references needs '
  'this widened by migration, as a decision somebody took, never as a hotfix.';

comment on column public.payments.recorded_by is
  'The staff member who recorded it, null for an online payment that has no '
  'session. Deliberately NOT constrained to be present for the desk methods: the '
  '§8.2 recovery path and the queue workers act with no staff actor at all, and a '
  'check forcing an id would make them invent one. The audit entry written by the '
  'recording RPC is the authoritative actor record either way [§3, INV-13].';

comment on column public.payments.recorded_at is
  'When the money was taken or recorded, which is not created_at: Reception '
  'enters a cash payment after the fact, and §11.2 reconciles a day by when it '
  'was taken.';

comment on column public.payments.note is
  'Operational note — why a link was reissued, which terminal took the card. '
  'Never a guest-facing surface [§3], and never card data [§13].';

create index payments_booking_idx
  on public.payments (booking_id);

create index payments_status_idx
  on public.payments (status);

create index payments_provider_reference_idx
  on public.payments (lower(provider_reference));

create index payments_recorded_by_idx
  on public.payments (recorded_by);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function internal.set_updated_at();

alter table public.payments enable row level security;


create table public.payment_events (
  id         uuid primary key default gen_random_uuid(),

  payment_id uuid references public.payments(id),
  booking_id uuid references public.bookings(id),

  provider          text not null,
  provider_event_id text not null,

  signature_verified boolean not null,

  payload      jsonb,

  received_at  timestamptz not null default now(),
  processed_at timestamptz,

  constraint payment_events_provider_lowercase
    check (provider = lower(provider)),
  constraint payment_events_provider_length
    check (length(btrim(provider)) between 1 and 40),
  constraint payment_events_provider_event_id_length
    check (length(btrim(provider_event_id)) between 1 and 200),

  constraint payment_events_provider_event_unique
    unique (provider, provider_event_id)
);

comment on table public.payment_events is
  'Every callback a payment provider has sent us [§8], stored before it is acted '
  'on. This table exists now, ahead of the online-payment work, so that plan adds handling '
  'and no schema — a webhook that arrives while a migration is pending is a lost '
  'payment. Provider plumbing, not an operational surface: Management only.';

comment on constraint payment_events_provider_event_unique
  on public.payment_events is
  'THE IDEMPOTENCY GUARANTEE. This single constraint is what makes §16.1''s "a '
  'repeated payment webhook causes no duplicate booking, message or payment" true '
  '[INV-09]: the handler inserts the event first and a unique violation is the '
  'signal that this delivery has already been processed, so it becomes a logged '
  'no-op. Keyed on the pair rather than on the id alone, because two providers '
  'may mint the same identifier and neither owns the other''s namespace. '
  'Application-side "have I seen this?" checks race under retry storms; a unique '
  'index does not.';

comment on column public.payment_events.payment_id is
  'Nullable on purpose. An event can arrive before we know which payment it '
  'belongs to, or belong to none we hold — and §8 requires the delivery to be '
  'recorded regardless, because an unmatched callback is precisely the thing '
  'somebody has to investigate. No cascade: the evidence of what a provider sent '
  'must outlive whatever it pointed at.';

comment on column public.payment_events.signature_verified is
  'The stored result of verifying the signature [§8]. §8 and INV-08 require the '
  'signature to be checked server-side BEFORE the body is parsed, and a booking '
  'is paid only on a verified webhook, never on a browser redirect. Recording the '
  'outcome as a column rather than a filter means a rejected delivery is still '
  'kept, still countable and still alertable [§9.3]; a handler that drops '
  'unverified traffic silently leaves an attack invisible.';

comment on column public.payment_events.payload is
  'The delivery as received, for reconciliation and dispute [§17.5]. Whatever a '
  'provider sends is stored as it arrived and never edited. It must never contain '
  'complete card data [§13]; a hosted checkout does not send it, and if one ever '
  'did, the fix is at the adapter, not a redaction pass here.';

comment on column public.payment_events.processed_at is
  'Null until the event has been acted on, so a delivery accepted but never '
  'handled is visible as a row rather than absent as a gap.';

create index payment_events_payment_idx
  on public.payment_events (payment_id);

create index payment_events_booking_idx
  on public.payment_events (booking_id);

create index payment_events_unprocessed_idx
  on public.payment_events (received_at)
  where processed_at is null;

alter table public.payment_events enable row level security;


create table public.refunds (
  id         uuid primary key default gen_random_uuid(),

  payment_id uuid not null references public.payments(id),
  booking_id uuid not null references public.bookings(id),

  amount_fils integer not null,

  reason      text not null,

  is_pending  boolean not null default true,

  requested_by uuid references public.staff(id),
  requested_at timestamptz not null default now(),
  settled_at   timestamptz,

  provider_reference text,

  constraint refunds_amount_positive
    check (amount_fils > 0),

  constraint refunds_reason_length
    check (length(btrim(reason)) between 1 and 2000),

  constraint refunds_settled_is_not_pending
    check (settled_at is null or not is_pending),

  constraint refunds_provider_reference_length
    check (provider_reference is null
       or length(btrim(provider_reference)) between 1 and 128),

  constraint refunds_provider_reference_carries_no_card
    check (
      provider_reference is null
      or (
        provider_reference !~ '[0-9]{15}'
        and provider_reference !~ '[0-9]{4}[ -][0-9]{4}[ -][0-9]{4}[ -][0-9]{2,4}'
      )
    )
);

comment on table public.refunds is
  'Refunds against a payment [§8, §11.2]. FULL AND PARTIAL ARE NOT TWO KINDS — '
  'both are an amount, and a refund equal to its payment is simply the whole of '
  'it. Modelling them as separate types would put the arithmetic in an enum and '
  'leave two code paths to keep in step. Deliberately NOT on delete cascade from '
  'either reference: money that left the business is a record that survives '
  'whatever it was attached to.';

comment on column public.refunds.amount_fils is
  'Integer fils, strictly positive [R-16]. A zero refund is not a refund, it is a '
  'row somebody meant to delete.';

comment on constraint refunds_amount_positive on public.refunds is
  'THE CEILING IS NOT ENFORCED HERE, AND THAT IS A DECISION. "A refund may not '
  'exceed its payment" cannot be a check constraint: a check sees one row of one '
  'table, and the binding rule is that the SUM of every refund against a payment '
  'stays within it. A trigger aggregating siblings would still be wrong — two '
  'concurrent partial refunds each read a total that excludes the other and both '
  'pass, which is the double-booking race wearing different clothes. The rule '
  'therefore belongs where a lock can be taken: the refund RPC selects its '
  'payment row FOR UPDATE, sums the settled and pending refunds already against '
  'it, and refuses on the total — one transaction, one audit entry [R-14]. This '
  'constraint keeps the part a single row can honestly prove.';

comment on column public.refunds.reason is
  'Required [§11.2]. A refund with no reason cannot be reconciled at month end '
  'and cannot be explained to the guest who asks why.';

comment on column public.refunds.is_pending is
  '§8 lists a pending refund state, so it is a state and not an inference. '
  'Deliberately NOT coupled to settled_at in both directions: a refund also stops '
  'being pending by FAILING at the provider, which leaves it unsettled and needing '
  'an operational alert [§9.3]. Only the one safe direction is constrained — a '
  'settled refund cannot still be pending.';

comment on column public.refunds.requested_by is
  'The staff member who issued it, null when nobody did. §8.2''s third branch '
  'initiates an automatic refund when a paying guest cannot be given any suite, '
  'and that path has no session; docs/5 §3 gates the human action instead — '
  '"issue a refund: reception no, management yes". The audit entry remains the '
  'authoritative actor record [INV-13].';

comment on column public.refunds.provider_reference is
  'The gateway reference for the refund leg, so §8''s "gateway transaction, '
  'booking, receipt and refund uniquely linked and reconcilable" holds end to '
  'end. Subject to the same §13 refusal of card data as public.payments.';

create index refunds_payment_idx
  on public.refunds (payment_id);

create index refunds_booking_idx
  on public.refunds (booking_id);

create index refunds_requested_by_idx
  on public.refunds (requested_by);

create index refunds_pending_idx
  on public.refunds (requested_at)
  where is_pending;

alter table public.refunds enable row level security;


create table public.payment_method_fees (
  method       public.payment_method primary key,

  is_enabled   boolean not null default false,
  percent      numeric(5,2) not null default 0,

  customer_label text not null,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.staff(id),

  constraint payment_method_fees_percent_range
    check (percent >= 0 and percent <= 100),

  constraint payment_method_fees_customer_label_length
    check (length(btrim(customer_label)) between 1 and 60)
);

comment on table public.payment_method_fees is
  'The §8.1 service fee, configured per payment method. Management may enable, '
  'disable and set the percentage and the customer-facing label, and every change '
  'is audited [§8.1, INV-13] — activation status, percentage, label, method, time '
  'and the Management user, which is exactly what an audit entry carries, so no '
  'shadow history table is built here. SHIPS EMPTY on purpose: the only figure '
  'the client has named is Tabby at 6%, that value already lives in '
  'src/lib/config/registry.ts as fees.tabby.percent, and nothing else is '
  'confirmed (Q-7, Q-15). A seeded placeholder reads as agreed within a week. An '
  'unset method means no fee, which is the correct behaviour of a screen reading '
  'an unset value [§10.2]. THE TABBY GAP IS KNOWN AND UNRESOLVED: Tabby is a '
  'checkout option inside the hosted checkout, not a settlement channel, so it is not a '
  'public.payment_method value and cannot be keyed here today. The registry '
  'carries the configured Tabby fee, this table generalises the mechanism per '
  'method, and the two are reconciled by a migration once the client confirms '
  'which methods carry a fee — not by guessing a key now.';

comment on column public.payment_method_fees.is_enabled is
  'Defaults to OFF [§8.1]. "Public activation and the actual percentage remain '
  'under WellPlace control", so a method that reaches this table without an '
  'explicit decision charges nobody.';

comment on column public.payment_method_fees.percent is
  'The §8.1 percentage, applied to the order value BEFORE the fee and never '
  'compounding on itself [INV-19]. Exact fixed-point arithmetic, never a binary '
  'floating type [R-16]: this value multiplies money, and a stored 6.1 that is '
  'not exactly 6.1 puts a fils of drift into every line it touches and into the '
  'daily reconciliation that has to balance. The 0 to 100 bound is a storage '
  'plausibility limit and must not be read as a business rule — what Management '
  'may set is §8.1''s "freely", enforced above the database [INV-16].';

comment on column public.payment_method_fees.customer_label is
  'What the guest sees on the separate fee line before final confirmation [§8.1] '
  '— "Service Fee" is the client''s example, not a fixed string. Required and '
  'non-blank, because an unlabelled charge on a checkout is the §5.5 failure of '
  'telling somebody nothing.';

comment on column public.payment_method_fees.updated_by is
  'A convenience for the configuration screen, which shows who last changed a '
  'fee. NOT the record §8.1 requires: audit.entries is, it is append-only and it '
  'keeps the old value as well as the new [INV-13, INV-14].';

create index payment_method_fees_updated_by_idx
  on public.payment_method_fees (updated_by);

create trigger payment_method_fees_set_updated_at
  before update on public.payment_method_fees
  for each row execute function internal.set_updated_at();

alter table public.payment_method_fees enable row level security;


revoke all on public.payments            from anon, authenticated;
revoke all on public.payment_events      from anon, authenticated;
revoke all on public.refunds             from anon, authenticated;
revoke all on public.payment_method_fees from anon, authenticated;

grant select on public.payments            to authenticated;
grant select on public.payment_events      to authenticated;
grant select on public.refunds             to authenticated;
grant select on public.payment_method_fees to authenticated;

create policy payments_select_staff on public.payments
  for select to authenticated
  using (internal.is_staff());

create policy payment_events_select_management on public.payment_events
  for select to authenticated
  using (internal.is_management());

create policy refunds_select_confidential on public.refunds
  for select to authenticated
  using (internal.has_permission('view_confidential_figures'));

create policy payment_method_fees_select_staff on public.payment_method_fees
  for select to authenticated
  using (internal.is_staff());

comment on policy payments_select_staff on public.payments is
  'Transcribed from docs/5 §3. Reception reads: "record a payment — yes" is a '
  'Reception action [§9.2], and §9.1 makes payment reference one of the five '
  'search keys, neither of which works against a table it cannot see. Read only, '
  'and there is no insert, update or delete policy by design — recording a '
  'payment goes through a SECURITY DEFINER RPC that writes its own audit entry '
  '[R-02, R-14, INV-13], which the Reception payment plan owns. What Reception '
  'may not see is the confidential FIGURE — revenue, net, refund totals — and '
  'that gating lives in the reporting views on '
  'internal.has_permission(''view_confidential_figures''), per column, because '
  'Q-10 is unanswered and a base-table lockout would also remove the operational '
  'read §9.2 requires.';

comment on policy refunds_select_confidential on public.refunds is
  'Transcribed from docs/5 §3, two rows at once. "Issue a refund — reception: no, '
  'management: yes" governs the write and arrives as an RPC. READING is the '
  'separate question and the stricter answer applies: "see revenue, net figures, '
  'refund totals — reception: perm:view_confidential_figures". So Management sees '
  'refunds, and Reception only with the explicit named grant. One call does both, '
  'because internal.has_permission resolves view_confidential_figures implicitly '
  'for management — spelling out is_management() beside it would be a second '
  'place for the two to disagree.';

comment on policy payment_events_select_management on public.payment_events is
  'Management only [OUR CHOICE, §13 least privilege]. Provider callbacks are '
  'plumbing, not an operational surface: nothing in §9 asks Reception to read a '
  'webhook, and the table holds raw provider payloads. Narrowing costs nothing '
  'now; widening after the fact does not undo an exposure.';

comment on policy payment_method_fees_select_staff on public.payment_method_fees is
  'Staff read, transcribed from docs/5 §3: "read business rules — hours, '
  'durations, buffer, cancellation terms: yes" for both roles. A configured fee '
  'is a RULE, not a figure — §10.6 makes confidential figures the permission, and '
  'Reception quoting a walk-in a total it cannot see the components of is the '
  'rule failing at the desk. Configuring is Management only [§10.4, §8.1] and '
  'arrives as an audited RPC, never a write policy.';
