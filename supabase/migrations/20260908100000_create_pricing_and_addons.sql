create type public.guest_price_kind as enum ('adult', 'child');

comment on type public.guest_price_kind is
  'Which of the two rate cards a price tier belongs to [CLIENT, the booking pricing specification §2].

Deliberately not public.guest_kind, which public.booking_guests uses. That enum records a fact about a person who came to the venue and §6.2 fixes it at two values; this one names a rate card, and §7 requires Management to change pricing without a code change. The day a third card appears — a senior rate, a member rate — it is a value added here, where nothing but configuration reads it, rather than a value added to the enum every guest row is stored in. The two carry the same two labels today and that is a coincidence, not a shared meaning.';

create type public.addon_kind as enum (
  'rental',
  'consumable',
  'per_person',
  'per_booking'
);

comment on type public.addon_kind is
  'What an add-on is, for the customer-facing card and for Reception preparation [§8]. The specification names exactly these four: show whether the item is a rental, consumable, per-person item or per-booking item. per_person is a label on the card and NOT a quantity rule — §8 is explicit that no add-on quantity is ever derived from the guest count.';

create type public.promo_kind as enum (
  'fixed',
  'percent',
  'addon_free'
);

comment on type public.promo_kind is
  'What a voucher code does [§8, §10.4]. Character-identical to VoucherKind in src/lib/domain/vouchers/index.ts, which owns the acceptance rules and the refusal wording the guest sees. fixed and percent reduce the booking; addon_free is the §8 case that has no equivalent in the booking discount at all — it sets a targeted add-on to AED 0 and adds it to the cart if it was not there. Two spellings of one kind is how a guard silently stops guarding, so a change here is a change there in the same commit.';


create table public.price_rules (
  id   uuid primary key default gen_random_uuid(),

  code text unique,

  guest_kind public.guest_price_kind not null,

  from_hour integer not null,
  to_hour   integer,

  regular_fils_per_hour integer not null,
  offer_fils_per_hour   integer,
  offer_percent         numeric(5,2),

  weekdays integer[],

  season_from date,
  season_to   date,

  start_from_minutes integer,
  start_to_minutes   integer,

  priority  integer not null default 0,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint price_rules_code_shaped
    check (code is null or code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint price_rules_code_length
    check (code is null or length(code) between 2 and 64),

  constraint price_rules_from_hour_positive
    check (from_hour >= 1),
  constraint price_rules_hour_band_ordered
    check (to_hour is null or to_hour >= from_hour),

  constraint price_rules_regular_rate_non_negative
    check (regular_fils_per_hour >= 0),
  constraint price_rules_offer_rate_non_negative
    check (offer_fils_per_hour is null or offer_fils_per_hour >= 0),
  constraint price_rules_offer_percent_bounded
    check (offer_percent is null or (offer_percent >= 0 and offer_percent <= 100)),

  constraint price_rules_offer_is_exactly_one
    check (num_nonnulls(offer_fils_per_hour, offer_percent) = 1),

  constraint price_rules_weekdays_shaped
    check (
      weekdays is null
      or (
        array_length(weekdays, 1) between 1 and 7
        and weekdays <@ array[0, 1, 2, 3, 4, 5, 6]
      )
    ),

  constraint price_rules_season_ordered
    check (season_from is null or season_to is null or season_to >= season_from),

  constraint price_rules_start_window_paired
    check (num_nonnulls(start_from_minutes, start_to_minutes) <> 1),
  constraint price_rules_start_window_bounded
    check (
      start_from_minutes is null
      or (
        start_from_minutes between 0 and 1440
        and start_to_minutes between 0 and 1440
        and start_to_minutes > start_from_minutes
      )
    )
);

comment on table public.price_rules is
  'One row per hourly rate tier [CLIENT §2, §7; §6.4, §10.2]. The columns are a one-to-one transcription of PriceTier in src/lib/domain/pricing/index.ts, which is the only implementation of §6.4: the booking flow, Reception, the §10.4 test-price preview, receipts and every §11.2 figure walk the same rows through the same function, so there is exactly one pricing implementation and a tier that cannot be expressed here is a tier the product cannot sell.

A rate is configuration, never a literal [§10.2, INV-16, R-05]. §7 requires every rate, tier and applicable-hours band to be editable without a code change and to be recorded in the audit log, which an UPDATE through an audited RPC satisfies and a constant in TypeScript does not.

Written only by RPCs; no role holds an INSERT, UPDATE or DELETE grant on this table [R-02].';

comment on column public.price_rules.code is
  'The stable handle for a tier the seed owns, and null for every tier Management creates later [OUR CHOICE].

The four launch tiers are seeded from LAUNCH_PRICE_TIERS in src/lib/config/pricing.ts by scripts/generate-seed.mjs, which imports that constant rather than restating it, so the seeded rows and the constant cannot disagree. This column carries the same slug the constant uses for its id, which is what lets the seed be re-run, lets supabase/tests/pricing-schema.sql name a tier it is asserting about, and lets a human reading the table see which rows came from the launch specification. It is nullable because a tier created in the Management console has no counterpart in the repository and inventing a slug for it would be a second naming system nobody maintains.';

comment on column public.price_rules.guest_kind is
  'Which rate card this tier belongs to [CLIENT §2]. Adult and child rate cards are calculated independently and then added [§5]; there is no derivation of one from the other, so a child rate is never a percentage of an adult rate in this schema.';

comment on column public.price_rules.from_hour is
  'The first hour of the booking this tier prices, counted from one and inclusive [CLIENT §2].

The engine walks a booking hour by hour and selects a tier for each hour, so the launch structure — hours 1 to 2 at one rate and hours 3 onward at another — is two rows and not a special case in code. That is also why §2''s rule that additional-hour rates cannot be purchased as a standalone one-hour booking is enforced by booking.durations_hours, a setting, and not by this table: the tier prices the third hour of a booking, it does not authorise a booking length.';

comment on column public.price_rules.to_hour is
  'The last hour this tier prices, inclusive, or null for open-ended [CLIENT §2]. The additional-hour tiers are open-ended on purpose: raising the maximum duration in booking.durations_hours must not silently leave the sixth hour unpriced, and an unpriced hour makes the engine return the no_tier outcome rather than a wrong total.';

comment on column public.price_rules.regular_fils_per_hour is
  'The comparison rate for one hour, in integer fils, 1 AED = 100 [R-16].

§2 requires this crossed out beside the offer rate and §6 requires the saving shown, so it is stored even where it equals the offer rate. It is never derived backwards from a discount percentage, because a comparison price that moves when a discount is retuned is not a comparison price.';

comment on column public.price_rules.offer_fils_per_hour is
  'The rate the guest is charged for one hour, in integer fils [CLIENT §2].

Exactly one of this column and offer_percent carries a value. §2 allows a tier to be configured either as a configured AED rate or as a percentage off the comparison rate, and where a percentage is used the customer-facing rate is rounded to the nearest AED 0.50 by resolveOfferRate in src/lib/domain/pricing. That rounding lives there and only there: a rounding rule implemented twice drifts, and the drift shows up as a receipt that disagrees with the summary the guest accepted.';

comment on column public.price_rules.offer_percent is
  'A percentage off the comparison rate, exact to two places, as an alternative to a configured AED rate [CLIENT §2]. Stored as numeric, never as an approximate binary type [R-16]. Null at launch: all four confirmed tiers carry a configured AED rate, and §2''s displayed 25, 36 and 35 per cent are calculated from the two stored rates rather than driving them.';

comment on column public.price_rules.weekdays is
  'The days this tier applies to, or null for every day.

This column, season_from, season_to, start_from_minutes and start_to_minutes together are §7''s "future weekday, time-of-day or seasonal price variations". They exist and they are NULL AT LAUNCH, because §1 fixes that the same prices apply on every weekday and at every time of day for now. They are built today so that the first seasonal rate is an INSERT rather than a migration, a code change and a redeploy.

Zero is Sunday and six is Saturday, matching Date.getUTCDay(), which is the convention src/lib/services already uses to resolve hours.regular [OUR CHOICE — the specification does not state one].';

comment on column public.price_rules.season_from is
  'Inclusive start of a seasonal band, or null. Compared as a plain date against the booking date in Dubai, not against a timestamp, so a season boundary is the same for every start time on the day [§13, INV-24].';

comment on column public.price_rules.start_from_minutes is
  'Minutes after midnight, Dubai wall clock, bounding the start times this tier applies to. Half-open — a tier from 1080 to 1440 covers a start at 18:00 and not one at 24:00 — matching withinWindow in src/lib/domain/pricing. Both bounds are set together or neither is.';

comment on column public.price_rules.priority is
  'Which tier wins where several match. selectTier resolves a tie on priority first, then on how specific the tier is, then on id, so the choice is deterministic and a duplicate rule cannot make a price depend on row order. Higher wins, matching public.suites, where a lower number wins — the two are deliberately different words, allocation priority and pricing priority, and they are not the same axis.';

comment on constraint price_rules_offer_is_exactly_one on public.price_rules is
  'One of the two offer forms, never both and never neither [CLIENT §2]. Both would leave the engine choosing between two answers to one question, and resolveOfferRate prefers the configured rate silently, which is exactly the kind of quiet precedence that gets discovered in a receipt. Neither would be a tier with no offer, which §2 does not describe; a tier that sells at the comparison rate is written as an offer rate equal to it, or as a percentage of zero, and stays visible as a decision.';

create index price_rules_lookup_idx
  on public.price_rules (guest_kind, from_hour)
  where is_active;

create trigger price_rules_set_updated_at
  before update on public.price_rules
  for each row execute function internal.set_updated_at();

alter table public.price_rules enable row level security;


alter table public.addons
  rename column price_fils to offer_price_fils;

alter table public.addons
  rename constraint addons_price_non_negative to addons_offer_price_non_negative;

alter table public.addons
  add column regular_price_fils integer not null default 0,
  add column saving_label       text,
  add column kind               public.addon_kind not null default 'per_booking',
  add column default_quantity   integer not null default 1,
  add column min_quantity       integer not null default 1,
  add column max_quantity       integer not null default 1,
  add column is_locked          boolean not null default false,
  add column inventory          integer,
  add column available_from     date,
  add column available_to       date,
  add column reception_note     text;

alter table public.addons
  alter column regular_price_fils drop default;

alter table public.addons
  add constraint addons_regular_price_non_negative
    check (regular_price_fils >= 0),
  add constraint addons_regular_price_not_below_offer
    check (regular_price_fils >= offer_price_fils),
  add constraint addons_saving_label_length
    check (saving_label is null or length(btrim(saving_label)) between 1 and 80),
  add constraint addons_quantities_positive
    check (min_quantity >= 1 and default_quantity >= 1 and max_quantity >= 1),
  add constraint addons_quantities_ordered
    check (min_quantity <= default_quantity and default_quantity <= max_quantity),
  add constraint addons_inventory_non_negative
    check (inventory is null or inventory >= 0),
  add constraint addons_availability_ordered
    check (available_from is null or available_to is null
        or available_to >= available_from),
  add constraint addons_reception_note_length
    check (reception_note is null or length(btrim(reception_note)) between 1 and 2000);

alter table public.addons
  add column price_fils integer not null
    generated always as (offer_price_fils) stored;

comment on column public.addons.offer_price_fils is
  'What one unit costs the guest, in integer fils, 1 AED = 100 [R-16].

AED 0 IS THE AUTOMATIC INCLUSION TRIGGER. §8 states that every active and eligible add-on whose current offer price is set to AED 0 in Management is automatically included in the booking cart, that no separate auto-add switch exists and that no click from the guest is required. The rule therefore lives in this value and nowhere else, which is why isAutomaticallyIncluded in src/lib/domain/vouchers/index.ts reads exactly this column being zero and why no boolean beside it may be introduced to say the same thing twice.

A zero here is a decision by Management, never a missing value. An item whose commercial terms are unknown is is_active false, not zero.

The value a guest was charged is snapshotted onto public.booking_addons at booking time, so repricing an add-on never moves a booking that has been sold [INV-21].';

comment on column public.addons.regular_price_fils is
  'The comparison price shown struck through, in integer fils [§8].

Stored rather than derived, and constrained never to fall below the offer price. §8 requires the original price to stay visible and crossed out even on an AED 0 automatically included item, while forbidding a discount percentage or a saving label beside that item — so an included item is a row where this is positive and offer_price_fils is zero, and that pair is the whole of the display rule.

Equal to offer_price_fils where nothing is being compared. It has no default: an add-on shipped without a stated comparison price would silently claim a saving of its own full value.';

comment on column public.addons.price_fils is
  'DEPRECATED COMPATIBILITY MIRROR of offer_price_fils. It exists for exactly two callers and is scheduled for removal.

public.create_reception_booking, created by 20260908090000, snapshots this column onto public.booking_addons, and listAddonPrices in src/lib/db/queries/bookings.ts selects it by name. Both are rewritten by the step that adds the pricing and voucher RPCs, and this column is dropped in that same migration. Dropping it here would have left a live, tested Reception RPC broken at run time by a schema-only change, which is a worse trade than a documented mirror with a removal date.

Generated and therefore unwritable, so nothing can set it out of step with the offer price, and the mirror is semantically exact: what a guest is charged is the offer price. NOT NULL is load-bearing rather than tidy — supabase gen types reports a nullable generated column as number | null, and listAddonPrices would stop compiling on the type change alone, which is the breakage this column exists to avoid. Do not read it in new code.';

comment on column public.addons.saving_label is
  'The customer-facing saving wording for a paid offer [§8], for example a short phrase beside the struck-through comparison price. Never shown beside an AED 0 item: §8 forbids a discount percentage or a saving label on an automatically included item, and that suppression is the rendering rule, not a reason to leave this null.';

comment on column public.addons.kind is
  'Rental, consumable, per-person or per-booking [§8]. A label on the card and in Reception preparation views, never a quantity rule. per_person in particular does NOT multiply by the guest count — §8 states in two places that changing the number of guests must never change an add-on quantity. The default is the neutral per_booking so that the column could be added to a table that ships empty without inventing a commercial classification for rows that do not exist yet.';

comment on column public.addons.default_quantity is
  'What enters the cart when the item is added, or when an AED 0 item is included automatically [§8]. Normally one.

QUANTITIES ARE NEVER LINKED TO GUEST COUNT. §8 says so twice, once for paid items and once for automatically included ones, so no trigger, view, function or service may derive a quantity here from public.booking_guests. The guest adjusts it by hand within min_quantity and max_quantity, and clampQuantity in src/lib/domain/vouchers/index.ts is the single implementation of that clamp.';

comment on column public.addons.max_quantity is
  'The ceiling the guest may raise a line to [§8]. Defaults equal to the minimum, which makes a newly created add-on fixed at one unit until Management widens it — a conservative default rather than an invented commercial one. An item is guest-adjustable exactly when this exceeds min_quantity.';

comment on column public.addons.is_locked is
  'Whether an automatically included item may be removed by the guest [§8]: Management can decide whether an automatically added item is locked or may be removed. Snapshotted onto the booking line, because whether the guest could have removed it is part of what was sold.';

comment on column public.addons.inventory is
  'Units available, or null for unlimited [§8]. Null and zero are different: null is unlimited, zero is the sold-out state §8 requires the card to show. Not decremented by this table — a claim on stock belongs to the transaction that sells it, exactly as a claim on a suite does.';

comment on column public.addons.available_from is
  'Sales dates [§8]. Outside the window the card is unavailable rather than absent, so the §4.1 unavailable state has something to render and a seasonal item does not vanish from Reception mid-configuration.';

comment on column public.addons.reception_note is
  'The §8 Reception preparation or return note. Operational, never rendered on a guest-facing surface [§3].';


create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),

  code text not null unique,

  kind public.promo_kind not null,

  amount_fils integer,
  percent     numeric(5,2),

  valid_from date,
  valid_to   date,

  max_uses          integer,
  used_count        integer not null default 0,
  per_customer_limit integer,

  is_combinable boolean not null default true,
  is_active     boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint promo_codes_code_uppercase check (code = upper(code)),
  constraint promo_codes_code_shaped
    check (code ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'),
  constraint promo_codes_code_length check (length(code) between 3 and 40),

  constraint promo_codes_kind_matches_value
    check (
      (kind = 'fixed'      and amount_fils is not null and percent is null)
      or (kind = 'percent'    and percent is not null and amount_fils is null)
      or (kind = 'addon_free' and percent is null     and amount_fils is null)
    ),

  constraint promo_codes_amount_non_negative
    check (amount_fils is null or amount_fils >= 0),
  constraint promo_codes_percent_bounded
    check (percent is null or (percent >= 0 and percent <= 100)),

  constraint promo_codes_validity_ordered
    check (valid_from is null or valid_to is null or valid_to >= valid_from),

  constraint promo_codes_max_uses_positive
    check (max_uses is null or max_uses > 0),
  constraint promo_codes_used_count_non_negative
    check (used_count >= 0),
  constraint promo_codes_per_customer_limit_positive
    check (per_customer_limit is null or per_customer_limit > 0)
);

comment on table public.promo_codes is
  'Voucher codes [§8, §10.4]. The columns are a one-to-one transcription of Voucher in src/lib/domain/vouchers/index.ts, whose checkVoucher owns the acceptance decision and whose eight refusal reasons own the wording the guest reads. A code is configuration, never code [§10.2, INV-16].

Written only by RPCs; no role holds an INSERT, UPDATE or DELETE grant on this table [R-02]. §8 requires validity dates, usage limits, customer eligibility and whether codes may be combined, and every one of those is a column here rather than a rule in a service, so the same answer is given to the booking flow, to Reception and to a report.';

comment on column public.promo_codes.code is
  'The code as the guest types it. Stored upper case and constrained to be so, the same way public.staff.email is constrained to be lower case: normalising on the way in means the unique index is the whole of the duplicate rule and no lookup has to remember to fold case. The shape matches public.bookings.reference deliberately — a code is read aloud over the telephone and hyphen groups of upper-case alphanumerics survive that.';

comment on column public.promo_codes.kind is
  'fixed and percent reduce the booking subtotal and reach the pricing engine as a Promotion. addon_free does not touch the booking price at all: §8 gives it its own behaviour, setting a targeted add-on to AED 0 and adding that add-on at its configured default quantity if it was not in the cart. bookingPromotionFrom in src/lib/domain/vouchers returns null for it for exactly that reason.';

comment on column public.promo_codes.used_count is
  'A counter, not the authority. public.promo_code_redemptions holds one row per use and is what makes max_uses and per_customer_limit enforceable instead of decorative; this column exists so the common check does not scan that table. The RPC that redeems a code writes both in one transaction [R-14], and a repair that recomputes this from the redemption rows must always be safe to run.';

comment on column public.promo_codes.is_combinable is
  'Whether the code may be applied alongside another offer [§8]. Refused as not_combinable by checkVoucher when it is false and another promotion is present. It says nothing about the Special Offer rates in public.price_rules, which are the standing price and not a promotion.';

comment on constraint promo_codes_kind_matches_value on public.promo_codes is
  'The kind and its value must agree. A percent code carrying an amount, or a fixed code carrying a percentage, is a row whose meaning depends on which field the reader happens to consult, and discountFor in src/lib/domain/pricing consults exactly one of them. addon_free carries neither, because it sets a price to zero rather than reducing one.';

create index promo_codes_active_idx
  on public.promo_codes (code)
  where is_active;

create trigger promo_codes_set_updated_at
  before update on public.promo_codes
  for each row execute function internal.set_updated_at();

alter table public.promo_codes enable row level security;


create table public.promo_code_addons (
  promo_code_id uuid not null references public.promo_codes(id) on delete cascade,
  addon_id      uuid not null references public.addons(id) on delete cascade,

  created_at timestamptz not null default now(),

  primary key (promo_code_id, addon_id)
);

comment on table public.promo_code_addons is
  'Which add-ons a code targets [§8]: voucher codes can target one or more specific add-ons, not only the main booking price. A join table and not a column, because the relationship is many to many in both directions — one code may free several items, and one item may be freed by several codes.

Cascading on both sides is correct here and nowhere else in this schema: this table records a rule that is currently in force, not evidence of anything that happened. What a guest actually received is public.booking_addons, which snapshots and never cascades.';

create index promo_code_addons_addon_idx
  on public.promo_code_addons (addon_id);

alter table public.promo_code_addons enable row level security;


create table public.promo_code_redemptions (
  id uuid primary key default gen_random_uuid(),

  promo_code_id uuid not null references public.promo_codes(id),
  booking_id    uuid not null references public.bookings(id) on delete cascade,
  customer_id   uuid not null references public.customers(id),

  redeemed_at timestamptz not null default now(),

  constraint promo_code_redemptions_once_per_booking
    unique (promo_code_id, booking_id)
);

comment on table public.promo_code_redemptions is
  'One row per use of a code [§8]. This table is what turns max_uses and per_customer_limit from decoration into a rule: checkVoucher refuses on usedCount and customerUsedCount, and both are counted here.

The unique constraint on the code and the booking is the idempotency guarantee — a retried checkout, a re-submitted form or a webhook replayed out of order cannot spend one code twice against one booking, in the same way public.payment_events refuses a repeated provider event [INV-09].

The reference to public.promo_codes does not cascade: a redemption is a record of something that happened and must survive the retirement of the code that caused it. The reference to a booking does cascade, matching public.booking_addons, because a booking row that never survived is not evidence of a redemption either.';

comment on column public.promo_code_redemptions.customer_id is
  'Who used it, for §8''s customer eligibility and per_customer_limit. Denormalised from the booking on purpose: the limit is asked about a person before a booking exists, and Q-1 leaves the identity key itself unsettled, so the count is taken against the customer record rather than against an email string.';

create index promo_code_redemptions_booking_idx
  on public.promo_code_redemptions (booking_id);

create index promo_code_redemptions_customer_idx
  on public.promo_code_redemptions (promo_code_id, customer_id);

alter table public.promo_code_redemptions enable row level security;


alter table public.booking_addons
  add column regular_price_fils integer,
  add column is_included        boolean not null default false,
  add column is_locked          boolean not null default false,
  add column voucher_code       text;

alter table public.booking_addons
  add constraint booking_addons_regular_price_non_negative
    check (regular_price_fils is null or regular_price_fils >= 0),
  add constraint booking_addons_voucher_code_uppercase
    check (voucher_code is null or voucher_code = upper(voucher_code)),
  add constraint booking_addons_voucher_code_length
    check (voucher_code is null or length(voucher_code) between 3 and 40);

comment on column public.booking_addons.regular_price_fils is
  'The comparison price this line was sold against, snapshotted [§8, §11.2, INV-21]. Nullable for the lines written before this column existed and for a line with nothing to compare. §11.2 subtracts it from the charged price to state what an included or discounted item was worth without asking today''s catalogue, which may have been repriced since.';

comment on column public.booking_addons.is_included is
  'Whether this line was given rather than bought [§8, §11.2].

The distinction §11.2 needs is the one INV-21 will not let it recompute: a towel at AED 0 because the catalogue offer price is zero, a towel at AED 0 because a voucher targeted it, and a towel that was paid for are three different facts, and by the time a report runs the catalogue may say something else entirely. This flag plus voucher_code carries all three.

Deliberately NOT constrained to equal unit_price_fils being zero. The tie would be true today, but it would also mean that public.create_reception_booking, which does not yet set this column, would start failing the moment an AED 0 add-on exists in the catalogue — and the seed now contains two. The flag is written by the function that sells the line, and that function is where the rule belongs.';

comment on column public.booking_addons.is_locked is
  'Whether the guest could have removed this line [§8]. Snapshotted from the add-on, because whether an included item was removable is part of what was sold and Management may change it afterwards.';

comment on column public.booking_addons.voucher_code is
  'The code that reduced this line to AED 0, where one did [§8]. The literal code and not a reference: the row is a record of what the guest received, and a code can be retired, renamed or deleted without that record changing. public.promo_code_redemptions is the countable side of the same event.';


revoke all on public.price_rules            from anon, authenticated;
revoke all on public.promo_codes            from anon, authenticated;
revoke all on public.promo_code_addons      from anon, authenticated;
revoke all on public.promo_code_redemptions from anon, authenticated;

grant select on public.price_rules            to authenticated;
grant select on public.promo_codes            to authenticated;
grant select on public.promo_code_addons      to authenticated;
grant select on public.promo_code_redemptions to authenticated;

create policy price_rules_select_staff on public.price_rules
  for select to authenticated
  using (internal.is_staff());

create policy promo_codes_select_staff on public.promo_codes
  for select to authenticated
  using (internal.is_staff());

create policy promo_code_addons_select_staff on public.promo_code_addons
  for select to authenticated
  using (internal.is_staff());

create policy promo_code_redemptions_select_staff on public.promo_code_redemptions
  for select to authenticated
  using (internal.is_staff());

comment on policy price_rules_select_staff on public.price_rules is
  'Transcribed from docs/5 §3. Reception reads the rate card because §9.2 has it creating walk-in, telephone, manual and complimentary bookings, and it cannot quote a total it may not read; docs/5 also grants both roles a read of the business rules on the ground that a configured rule is not a confidential figure under §10.6. Configuring prices is Management only in the same table, and that arrives as an audited RPC, never as a write policy [R-02, R-14].

No anon grant here. The guest widget needs rates, and a dedicated public view will expose what a price is while saying nothing about how the venue is configured — widening this grant would instead hand an unauthenticated caller the whole tier structure, including the seasonal and weekday rules the venue has not launched yet.';

comment on policy promo_codes_select_staff on public.promo_codes is
  'Reception reads codes because §9.2 has it taking bookings at the desk and a guest arrives holding a code. Nothing may write through a policy: the counter, the redemption row and the audit entry are one transaction [R-14], and a client-side UPDATE of used_count is exactly how a usage limit becomes decorative.

No anon grant either. A code list readable without a session is a code list that is scraped, and §13 requires least privilege.';

comment on policy promo_code_redemptions_select_staff on public.promo_code_redemptions is
  'Staff read, so Reception can answer why a code was refused at the desk without a Management escalation. The rows name a customer and a booking, both of which docs/5 §3 already grants Reception in full. No money is exposed here, so Q-10 does not bite.';
