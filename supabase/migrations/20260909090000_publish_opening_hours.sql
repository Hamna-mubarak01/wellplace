-- [§10.2, CLIENT 8 Sep 2026] Saved opening hours are published immediately:
-- the booking calendar and Contact page must apply seasons, exceptions and
-- closures as well as the ordinary week. These schedules carry dates/times,
-- never suite identities, counts, staff notes or other settings.
create or replace view public.public_booking_settings
  with (security_invoker = false) as
  select
    s.key,
    s.value
  from public.settings s
  where s.key in (
    'booking.start_interval_minutes',
    'booking.durations_hours',
    'booking.guests_min',
    'booking.guests_max',
    'booking.child_min_age',
    'booking.child_max_age',
    'booking.booker_min_age',
    'booking.min_notice_minutes',
    'booking.max_horizon_days',
    'booking.same_day_cutoff',
    'cleaning.buffer_minutes',
    'hold.minutes',
    'urgency.enabled',
    'urgency.threshold_few',
    'urgency.threshold_last',
    'urgency.text_few',
    'urgency.text_last',
    'urgency.text_none',
    'urgency.text_filling',
    'hours.regular',
    'hours.seasonal',
    'hours.exceptions',
    'hours.closures',
    'contact.whatsapp_e164',
    'contact.email',
    'tax.vat_percent',
    'tax.inclusive',
    'tax.label',
    'pricing.currency',
    'pricing.rounding_fils',
    'pricing.offer_headline',
    'pricing.offer_subline',
    'pricing.offer_label'
  );

comment on view public.public_booking_settings is
  'Explicit guest-readable booking, pricing and published opening-hours settings. [CLIENT 8 Sep 2026] Saving hours publishes them; there is no draft schedule. Suite, staff, privacy, security and allocation data remain excluded.';
