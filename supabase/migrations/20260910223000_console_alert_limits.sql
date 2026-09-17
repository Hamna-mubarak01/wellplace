create or replace function internal.alert_threshold(p_key text)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select s.minutes
    from (select case when jsonb_typeof(value) = 'number'
      then (value #>> '{}')::numeric end as minutes
      from public.settings where key = p_key) s
    where s.minutes = trunc(s.minutes)
      and s.minutes <= case when p_key = 'reception.hold_expiry_warning_minutes' then 120 else 720 end
      and s.minutes >= case
        when p_key = 'reception.hold_expiry_warning_minutes' then 1 else 0 end
  ), ('{"reception.hold_expiry_warning_minutes":3,"reception.arrival_overdue_minutes":10,"reception.checkin_overdue_minutes":15,"reception.cleaning_confirm_minutes":30}'::jsonb ->> p_key)::numeric)
$$;
comment on function internal.alert_threshold(text) is '[§9.3; OUR CHOICE] Matches the shared console setting limits: overdue reminders 0–720 minutes; hold warning 1–120 minutes. Missing or invalid values use the registry defaults. Parity is covered by the alert-worker tests.';
