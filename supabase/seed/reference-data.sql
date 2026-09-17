-- GENERATED FILE — do not edit by hand.
insert into public.suites (suite_number, priority, status)
select n, n * 10, 'available'::public.suite_status
from generate_series(1, 7) as n
on conflict (suite_number) do nothing;
insert into public.settings (key, value, value_type, source_tag, description) values
  ('booking.start_interval_minutes', '15'::jsonb, 'integer', '§7.1', 'Time between booking starts'),
  ('booking.durations_hours', '[2,3,4,5,6]'::jsonb, 'array', '§6.1', 'Visit lengths'),
  ('booking.guests_min', '2'::jsonb, 'integer', '§6.1', 'Fewest guests per booking'),
  ('booking.guests_max', '5'::jsonb, 'integer', '[CLIENT] launch pricing specification — supersedes §6.1''s two-to-four', 'Most guests per booking'),
  ('booking.child_min_age', '8'::jsonb, 'integer', '§6.2', 'Youngest child allowed'),
  ('booking.child_max_age', '15'::jsonb, 'integer', '§6.2', 'Last age for child pricing'),
  ('booking.booker_min_age', '18'::jsonb, 'integer', '§6.2', 'Minimum age to make a booking'),
  ('booking.max_horizon_days', '21'::jsonb, 'integer', '§10.2 · [OUR CHOICE] until the client supplies one', 'How far ahead guests can book'),
  ('booking.personal_request_max_length', '500'::jsonb, 'integer', '§6.1 · [OUR CHOICE]', 'Guest note length'),
  ('booking.same_day_cutoff', null, 'time', '§10.2', 'Stop taking bookings for today at'),
  ('cleaning.buffer_minutes', '20'::jsonb, 'integer', '§7.1', 'Cleaning time between visits'),
  ('hold.minutes', '10'::jsonb, 'integer', '§7.3', 'Time allowed to finish payment'),
  ('overrun.increment_minutes', '5'::jsonb, 'integer', '§7.6', 'Charge extra time in blocks of'),
  ('overrun.rate_source', '"regular_hourly"'::jsonb, 'string', '§7.6 · Q-21', 'Overstay charges'),
  ('overrun.fixed_fils_per_increment', null, 'integer', '§7.6 · Q-21', 'Custom overstay amount'),
  ('allocation.strategy', '"fixed_priority"'::jsonb, 'string', '§7.2', 'How suites are assigned'),
  ('urgency.enabled', 'true'::jsonb, 'boolean', '§7.4', 'Show availability messages'),
  ('urgency.threshold_few', '5'::jsonb, 'integer', '§7.4', 'Show “few left” when this many suites remain'),
  ('urgency.threshold_last', '3'::jsonb, 'integer', '§7.4', 'Show “almost full” when this many suites remain'),
  ('urgency.text_few', '"Only a few slots available"'::jsonb, 'string', '§7.4', 'Message when a few suites are left'),
  ('urgency.text_last', '"Last availability for this time"'::jsonb, 'string', '§7.4', 'Message when a time is almost full'),
  ('urgency.text_none', '"Fully booked"'::jsonb, 'string', '§7.4', 'Message when a time is fully booked'),
  ('urgency.text_filling', '"This time is booking up"'::jsonb, 'string', '§7.4', 'Message when a time is getting booked'),
  ('reception.board_default_view', '"day"'::jsonb, 'string', '§9.1 · [OUR CHOICE]', 'Reception’s starting view'),
  ('reception.arrival_overdue_minutes', '10'::jsonb, 'integer', '§9.3 · [OUR CHOICE]', 'Warn when a guest has not arrived'),
  ('reception.checkin_overdue_minutes', '15'::jsonb, 'integer', '§9.3 · [OUR CHOICE]', 'Warn when check-in is taking too long'),
  ('reception.cleaning_confirm_minutes', '30'::jsonb, 'integer', '§9.3 · [OUR CHOICE]', 'Remind Reception to record cleaning'),
  ('reception.default_extension_minutes', '30'::jsonb, 'integer', '§7.6 · [OUR CHOICE]', 'Suggested extra time for a visit'),
  ('reception.hold_expiry_warning_minutes', '3'::jsonb, 'integer', '§9.3 · [OUR CHOICE]', 'Warn before a payment reservation expires'),
  ('fees.tabby.enabled', 'true'::jsonb, 'boolean', '§8.1', 'Add a fee for Tabby payments'),
  ('fees.tabby.percent', '6'::jsonb, 'integer', '§8.1', 'Tabby fee percentage'),
  ('fees.tabby.label', '"Service Fee"'::jsonb, 'string', '§8.1', 'Name of the Tabby fee'),
-- PLACEHOLDER, not a client decision [§2].
--
-- [§Operational corrections] Confirmed launch hours, closing the next day.
  ('hours.regular', '{"mon":[{"opens":"08:00","closes":"03:00"}],"tue":[{"opens":"08:00","closes":"03:00"}],"wed":[{"opens":"08:00","closes":"03:00"}],"thu":[{"opens":"08:00","closes":"03:00"}],"fri":[{"opens":"08:00","closes":"03:00"}],"sat":[{"opens":"08:00","closes":"03:00"}],"sun":[{"opens":"08:00","closes":"03:00"}]}'::jsonb, 'object', '§Operational corrections', 'Regular opening hours per weekday, Dubai wall clock'),
  ('hours.seasonal', null, 'object', '§10.2', 'Temporary weekly hours'),
  ('hours.exceptions', null, 'array', '§10.2', 'Different hours for one day'),
  ('hours.closures', null, 'array', '§10.2', 'Days the venue is closed'),
  ('rules.cancellation', null, 'object', '§10.2 · Q-5', 'Cancellation policy'),
  ('rules.reschedule', null, 'object', '§10.2 · Q-5', 'Changing a booking'),
  ('rules.refund', null, 'object', '§10.2 · Q-5', 'Refund policy'),
  ('rules.no_show', null, 'object', '§10.2 · Q-5', 'Guests who do not arrive'),
  ('rules.late_arrival', null, 'object', '§10.2 · Q-5', 'Guests who arrive late'),
  ('security.waitlist_rate_limit_enabled', 'true'::jsonb, 'boolean', '[CLIENT] optional spam limits', 'Limit repeated waitlist submissions'),
  ('security.waitlist_rate_limit_per_hour', '5'::jsonb, 'integer', '§13 · [OUR CHOICE]', 'Waitlist submissions allowed'),
  ('security.waitlist_rate_limit_window_minutes', '60'::jsonb, 'integer', '§13 · [OUR CHOICE]', 'Count waitlist submissions over'),
  ('security.contact_rate_limit_enabled', 'true'::jsonb, 'boolean', '[CLIENT] optional spam limits', 'Limit repeated contact messages'),
  ('security.contact_rate_limit_per_hour', '5'::jsonb, 'integer', '§13 · [OUR CHOICE]', 'Contact messages allowed'),
  ('security.contact_rate_limit_window_minutes', '60'::jsonb, 'integer', '§13 · [OUR CHOICE]', 'Count contact messages over'),
  ('security.availability_rate_limit_enabled', 'true'::jsonb, 'boolean', '[CLIENT] optional spam limits', 'Limit repeated booking searches'),
  ('security.availability_rate_limit_per_hour', '240'::jsonb, 'integer', '§13 · [OUR CHOICE]', 'Booking searches allowed'),
  ('security.availability_rate_limit_window_minutes', '60'::jsonb, 'integer', '§13 · [OUR CHOICE]', 'Count booking searches over'),
  ('privacy.retention_months', '24'::jsonb, 'integer', 'CONFIRMED', 'How long guest details are kept'),
  ('privacy.delete_on_withdrawal', 'true'::jsonb, 'boolean', 'CONFIRMED', 'Delete details after consent is withdrawn'),
  ('tax.vat_percent', '5'::jsonb, 'decimal', '[CLIENT] launch pricing specification', 'VAT percentage'),
  ('tax.inclusive', 'true'::jsonb, 'boolean', '[CLIENT] launch pricing specification', 'Prices already include VAT'),
  ('tax.label', '"VAT"'::jsonb, 'string', '[CLIENT] launch pricing specification', 'Name of the tax'),
  ('pricing.currency', '"AED"'::jsonb, 'string', '§6.4', 'Price currency'),
  ('pricing.rounding_fils', '50'::jsonb, 'integer', '[CLIENT] launch pricing specification', 'Round offer prices to the nearest'),
  ('pricing.offer_headline', '"Special offer — AED 165 per adult, per hour. Minimum booking: 2 guests for 2 hours. Prices include 5% VAT."'::jsonb, 'string', '[CLIENT] launch pricing specification', 'Main offer message'),
  ('pricing.offer_subline', '"Stay longer and save more — additional hours from only AED 140 per adult."'::jsonb, 'string', '[CLIENT] launch pricing specification', 'Extra offer message'),
  ('pricing.offer_label', '"Special offer"'::jsonb, 'string', '[CLIENT] launch pricing specification', 'Label beside an offer price'),
  ('contact.whatsapp_e164', null, 'string', '§4.3', 'WhatsApp number'),
  ('contact.email', null, 'string', '§4.3', 'Booking help email')
on conflict (key) do update
  set value_type = excluded.value_type,
      source_tag = excluded.source_tag;
-- CONFIRMED CLIENT CONFIGURATION, not a placeholder [CLIENT §2].
--
-- the booking pricing specification §2 fixes
-- these four rates: adult AED 220/hour regular against AED 165 for hours 1-2
-- and AED 140 from hour 3, child AED 170/hour regular against AED 127.50 and
-- AED 110. They are the launch price list, they are the client's own numbers,
-- and unlike hours.regular below nothing here is invented.
--
-- They are NOT restated in this file. scripts/generate-seed.mjs imports
-- LAUNCH_PRICE_TIERS from src/lib/config/pricing.ts and prints it, so the
-- seeded rows and the constant the pricing engine is tested against cannot
-- drift apart -- there is only one copy of the numbers. Change the constant,
-- regenerate, and supabase/tests/pricing-schema.sql re-checks the result.
--
-- ON CONFLICT DO NOTHING, matching the suites seed: a reset builds them, and a
-- staging database where Management has retuned a rate is left alone. §7
-- requires those rates to be editable without a code change, and a seed that
-- overwrote them on every run would quietly make that untrue.
insert into public.price_rules
  (code, guest_kind, from_hour, to_hour, regular_fils_per_hour,
   offer_fils_per_hour, offer_percent, weekdays, season_from, season_to,
   start_from_minutes, start_to_minutes, priority) values
  ('adult-first-two', 'adult', 1, 2, 22000, 16500, null, null, null, null, null, null, 0),
  ('adult-additional', 'adult', 3, null, 22000, 14000, null, null, null, null, null, null, 0),
  ('child-first-two', 'child', 1, 2, 17000, 12750, null, null, null, null, null, null, 0),
  ('child-additional', 'child', 3, null, 17000, 11000, null, null, null, null, null, null, 0)
on conflict (code) do nothing;
-- PLACEHOLDER, not a client decision [§8, §2].
--
-- §8 states that the commercial add-on catalogue and its final prices will be
-- supplied separately, and sanctions building the booking flow and the
-- Management controls now against configurable placeholder entries. These two
-- are those entries. The names come from §8's own worked example; the
-- comparison prices, the quantity ceiling and the notes are ours and are made
-- up.
--
-- They live in the SEED and not in a registry default, for the same reason
-- hours.regular does. Seed data is demo data; a default is what production
-- falls back to, and a plausible AED 25 towel sitting there would be read as
-- confirmed within a week. In production public.addons stays empty until
-- WellPlace supplies a catalogue, and the add-on step shows its §4.1 empty
-- state until they do.
--
-- offer_price_fils IS ZERO ON PURPOSE. §8 makes AED 0 the automatic-inclusion
-- trigger with no separate auto-add switch, so a zero-priced seeded row is the
-- only way that rule is demonstrable on a developer's machine: both items
-- enter the cart at their default quantity of 1, keep their comparison price
-- struck through, and carry no saving label, which is why saving_label is null
-- rather than empty.
--
-- max_quantity is 3 and is deliberately not 2 or 5. §8 says twice that a
-- quantity is never linked to the guest count, so a ceiling that happened to
-- equal booking.guests_min or booking.guests_max would invite exactly the
-- derivation the specification forbids.
insert into public.addons
  (id, name, description, kind, regular_price_fils, offer_price_fils,
   default_quantity, min_quantity, max_quantity, sort_order, reception_note) values
  ('a5100000-0000-4000-8000-000000000001', 'Towel rental', 'A fresh set of spa towels, laid out in your suite before you arrive.', 'rental', 2500, 0, 1, 1, 3, 10, 'Set out before arrival. Collect with the linen at cleaning.'),
  ('a5100000-0000-4000-8000-000000000002', 'Bathrobe rental', 'A warm cotton bathrobe for the length of your visit.', 'rental', 5000, 0, 1, 1, 3, 20, 'Set out before arrival. Collect with the linen at cleaning.')
on conflict (id) do nothing;
