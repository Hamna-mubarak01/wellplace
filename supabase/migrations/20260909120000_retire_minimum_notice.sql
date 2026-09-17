-- [CLIENT 8 September 2026] Remove advance notice; guests may book the next free grid start.
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

-- Preserve the retired value in audit history before removing the setting.
select internal.write_audit(
  'retire_setting', 'public.settings', s.key,
  jsonb_build_object('value', s.value), null,
  'Client removed minimum advance notice; guests may book the next free grid start.'
)
from public.settings s where s.key = 'booking.min_notice_minutes';

delete from public.settings where key = 'booking.min_notice_minutes';
