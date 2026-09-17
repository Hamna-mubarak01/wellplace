with added as (
  insert into public.settings (key, value, value_type, source_tag, description) values
    ('urgency.few_enabled', null, 'boolean', '[CLIENT]', 'Few slots notice'),
    ('urgency.last_enabled', null, 'boolean', '[CLIENT]', 'Last availability notice'),
    ('urgency.none_enabled', null, 'boolean', '[CLIENT]', 'Fully booked notice'),
    ('urgency.mode', null, 'string', '[OUR CHOICE]', 'Live availability or a general message'),
    ('urgency.text_general', null, 'string', '[OUR CHOICE]', 'General booking message')
  on conflict (key) do nothing returning key, value
)
select internal.write_audit('initialize_setting', 'public.settings', key, null,
  jsonb_build_object('value', value), '[CLIENT] Independent booking notice controls.') from added;

select internal.write_audit('fix_setting', 'public.settings', key,
  jsonb_build_object('value', value), jsonb_build_object('value', case when key = 'booking.personal_request_max_length' then '500'::jsonb else 'null'::jsonb end),
  '[CLIENT] Fix guest notes at 500 characters and remove the same-day cutoff.')
from public.settings where key in ('booking.personal_request_max_length', 'booking.same_day_cutoff');
update public.settings set value = case when key = 'booking.personal_request_max_length' then '500'::jsonb else null end
where key in ('booking.personal_request_max_length', 'booking.same_day_cutoff');

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
    'urgency.few_enabled',
    'urgency.last_enabled',
    'urgency.none_enabled',
    'urgency.mode',
    'urgency.text_general',
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

create or replace function internal.detect_operational_alerts(p_now timestamptz)
returns table (kind public.alert_kind, severity public.alert_severity, entity text, entity_id text)
language sql stable security definer set search_path = ''
as $$
  with booking_facts as materialized (
    select b.*, payment.status as payment_status
    from public.bookings b
    left join lateral (
      select p.status from public.payments p where p.booking_id = b.id
      order by case p.status when 'manual_review' then 0 when 'failed' then 1 when 'paid' then 2 else 3 end, p.id
      limit 1
    ) payment on true
    where b.status in ('confirmed', 'checked_in', 'awaiting_recovery', 'hold_expired')
  ), detected (kind, entity, entity_id) as (
    select 'payment_without_suite', 'public.bookings', b.id::text from booking_facts b
    where b.payment_status = 'paid' and b.suite_id is null
    union all
    select 'payment_failed', 'public.bookings', b.id::text from booking_facts b where b.payment_status = 'failed'
    union all
    select 'manual_review_pending', 'public.bookings', b.id::text from booking_facts b where b.payment_status = 'manual_review'
    union all
    select 'arrival_overdue', 'public.bookings', b.id::text from booking_facts b
    where b.status = 'confirmed' and b.arrived_at is null
      and extract(epoch from (p_now - lower(b.experience_period))) / 60 >= internal.alert_threshold('reception.arrival_overdue_minutes')
    union all
    select 'message_failed', 'public.messages', m.id::text from public.messages m
    where m.status = 'failed' and m.failed_at is not null
    union all
    select 'refund_pending', 'public.refunds', r.id::text from public.refunds r where r.is_pending
    union all
    select 'upcoming_conflict', 'public.suite_occupancy', o.id::text from public.suite_occupancy o
    where o.is_active and o.kind in ('block', 'maintenance') and lower(o.experience_period) >= p_now
  )
  select d.kind::public.alert_kind, internal.alert_severity(d.kind::public.alert_kind), d.entity, d.entity_id
  from detected d
$$;

comment on function internal.detect_operational_alerts(timestamptz) is
  '[CLIENT] Retire check-in, cleaning-confirmation and expiring-payment reminders. Keep late arrivals, payment failures, unallocated payments and other operational alerts. Cleaning availability still follows the stored buffer.';

insert into internal.alert_refresh_events default values on conflict do nothing;
