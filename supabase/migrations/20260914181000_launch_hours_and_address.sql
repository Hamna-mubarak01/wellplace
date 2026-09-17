-- [§Operational corrections; §CMS functions]
-- Apply the explicitly approved launch schedule; retain previous settings in
-- the existing audit trail so staging test seasons are not silently discarded.
do $$
declare row record; launch_week jsonb; next_value jsonb;
begin
  select jsonb_object_agg(day, '[{"opens":"08:00","closes":"03:00"}]'::jsonb)
    into launch_week from unnest(array['mon','tue','wed','thu','fri','sat','sun']) day;
  for row in select key, value from public.settings
    where key in ('hours.regular','hours.seasonal','hours.exceptions','hours.closures') for update loop
    next_value := case when row.key = 'hours.regular' then launch_week else null end;
    if row.value is distinct from next_value then
      update public.settings set value = next_value, source_tag = 'approved launch hours', updated_at = now()
        where key = row.key;
      perform internal.write_audit('apply_client_launch_hours','public.settings',row.key,
        jsonb_build_object('value',row.value),jsonb_build_object('value',next_value),
        'Monday–Sunday 08:00–03:00, with no seasonal hours or fixed closures at launch.');
    end if;
  end loop;
end $$;

insert into public.settings (key, value, value_type, source_tag, description)
values ('contact.address', '"Lantern Court\n48 Marina Walk\nBusiness Bay\nDubai, United Arab Emirates"'::jsonb,
  'string', 'central contact settings', 'Venue address')
on conflict (key) do nothing;

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
    'contact.address',
    'tax.vat_percent',
    'tax.inclusive',
    'tax.label',
    'pricing.currency',
    'pricing.rounding_fils',
    'pricing.offer_headline',
    'pricing.offer_subline',
    'pricing.offer_label'
  );

-- A visit after midnight can belong to yesterday's opening window.
create or replace function internal.cleaning_closes_at(p_visit tstzrange) returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare
 visit_day date := (lower(p_visit) at time zone 'Asia/Dubai')::date;
 end_day date := ((upper(p_visit) - interval '1 microsecond') at time zone 'Asia/Dubai')::date;
 d date; weekday text; offset_days integer;
 regular jsonb; seasonal jsonb; exceptions jsonb; closures jsonb; windows jsonb; season jsonb;
 result timestamptz; candidate timestamptz;
begin
 select value into regular from public.settings where key='hours.regular';
 select value into seasonal from public.settings where key='hours.seasonal';
 select value into exceptions from public.settings where key='hours.exceptions';
 select value into closures from public.settings where key='hours.closures';
 if exists(select 1 from jsonb_array_elements(coalesce(nullif(closures,'null'::jsonb),'[]'::jsonb)) e
   where (e->>'from')::date <= end_day and (e->>'to')::date >= visit_day) then return null; end if;
 for offset_days in 0..1 loop
   d := visit_day - offset_days;
   if exists(select 1 from jsonb_array_elements(coalesce(nullif(closures,'null'::jsonb),'[]'::jsonb)) e where d between (e->>'from')::date and (e->>'to')::date) then continue; end if;
   weekday := (array['sun','mon','tue','wed','thu','fri','sat'])[extract(dow from d)::integer+1];
   windows := null; season := null;
   select e->'windows' into windows from jsonb_array_elements(coalesce(nullif(exceptions,'null'::jsonb),'[]'::jsonb)) e where (e->>'date')::date=d limit 1;
   if windows is null then
     select e->'hours' into season from jsonb_array_elements(coalesce(seasonal->'periods','[]'::jsonb)) e where d between (e->>'from')::date and (e->>'to')::date limit 1;
     windows:=coalesce(nullif(season,'null'::jsonb),regular)->weekday;
   end if;
   select min(bounds.closes) into candidate from (
     select (d+(w->>'opens')::time) at time zone 'Asia/Dubai' as opens,
       ((d + case when (w->>'closes')::time < (w->>'opens')::time then 1 else 0 end)
         +(w->>'closes')::time) at time zone 'Asia/Dubai' as closes
     from jsonb_array_elements(coalesce(nullif(windows,'null'::jsonb),'[]'::jsonb)) w
   ) bounds where lower(p_visit)>=bounds.opens and upper(p_visit)<=bounds.closes;
   if candidate is not null then result := least(result, candidate); end if;
 end loop;
 -- A full closure also limits cleaning that would spill into the next day.
 if result is not null and exists(select 1 from jsonb_array_elements(coalesce(nullif(closures,'null'::jsonb),'[]'::jsonb)) e where visit_day + 1 between (e->>'from')::date and (e->>'to')::date) then
   result := least(result, (visit_day + 1)::timestamp at time zone 'Asia/Dubai');
 end if;
 return result;
end $$;
