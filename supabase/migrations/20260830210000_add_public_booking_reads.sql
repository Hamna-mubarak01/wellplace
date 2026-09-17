


create view public.public_booking_settings as
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
    'hours.regular'
  );

comment on view public.public_booking_settings is
  'The twenty §10.2 settings the unauthenticated booking flow needs [§6.1]. '
  'Same (key, value) shape as public.settings_snapshot so snapshotFromRows in '
  'src/lib/config/index.ts consumes it unchanged. The key list is an explicit '
  'literal, never a prefix pattern: a pattern would publish the next key added '
  'under that prefix silently, an explicit list makes it a reviewable edit. '
  'Deliberately excludes fees.*, rules.*, allocation.*, privacy.*, security.*, '
  'tax.* and hours.seasonal/exceptions/closures. Runs with definer rights and '
  'IS the permission boundary (R-03) — see the note above; public.settings '
  'stays unreadable by anon.';

revoke all on public.public_booking_settings from anon, authenticated;

grant select on public.public_booking_settings to anon, authenticated;



grant execute on function public.count_available_suites(timestamptz[], integer, integer)
  to anon;
