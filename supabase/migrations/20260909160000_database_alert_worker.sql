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
      and s.minutes <= 9007199254740991
      and s.minutes >= case
        when p_key = 'reception.hold_expiry_warning_minutes' then 1 else 0 end
  ), ('{"reception.hold_expiry_warning_minutes":3,"reception.arrival_overdue_minutes":10,"reception.checkin_overdue_minutes":15,"reception.cleaning_confirm_minutes":30}'::jsonb ->> p_key)::numeric)
$$;
comment on function internal.alert_threshold(text) is
  '[§9.3; OUR CHOICE] Registry defaults generated from src/lib/config/registry.ts. Null, absent and invalid values fall back exactly as the application does, including the JavaScript/Zod safe integer ceiling; saved Management values win. Regression tests compare defaults against the registry. Change defaults through a forward migration.';

create or replace function internal.alert_severity(p_kind public.alert_kind)
returns public.alert_severity
language sql immutable set search_path = ''
as $$
  select ('{"hold_expiring":"info","payment_without_suite":"critical","payment_failed":"critical","message_failed":"warning","arrival_overdue":"warning","checkin_overdue":"warning","cleaning_unconfirmed":"warning","upcoming_conflict":"critical","refund_pending":"warning","manual_review_pending":"warning"}'::jsonb ->> p_kind::text)::public.alert_severity
$$;
comment on function internal.alert_severity(public.alert_kind) is
  '[OUR CHOICE; §9.3] Generated from ALERT_SEVERITY in src/lib/domain/alerts; parity is tested against that public UI vocabulary.';

revoke all on function internal.alert_threshold(text), internal.alert_severity(public.alert_kind)
  from public, anon, authenticated, service_role;

create table internal.alert_refresh_events (
  transaction_id xid8 primary key default pg_current_xact_id(),
  created_at timestamptz not null default clock_timestamp()
);

comment on table internal.alert_refresh_events is
  '[§9.3; OUR CHOICE] Transactional outbox: one refresh signal per committed operational transaction, without guest data. Rolled-back changes leave no event. Worker failures retain signals for retry; signals created during a scan remain for the next run.';

create table internal.alert_worker_state (
  singleton boolean primary key default true check (singleton),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error_code text,
  consecutive_failures integer not null default 0,
  last_report jsonb
);
insert into internal.alert_worker_state (singleton) values (true);

revoke all on internal.alert_refresh_events, internal.alert_worker_state
  from public, anon, authenticated, service_role;

create or replace function internal.enqueue_alert_refresh()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into internal.alert_refresh_events default values on conflict do nothing;
  return null;
end
$$;

comment on function internal.enqueue_alert_refresh() is
  '[§9.3; OUR CHOICE] Enqueue only; no network call or alert scan in a booking transaction. Each transaction has its own key so concurrent bookings do not wait on a shared queue row.';
revoke all on function internal.enqueue_alert_refresh() from public, anon, authenticated, service_role;

do $$
declare v_table text;
begin
  foreach v_table in array array['suite_occupancy', 'bookings', 'payments', 'cleaning_tasks', 'messages', 'refunds', 'settings']
  loop
    execute format('create trigger alert_refresh_event after insert or update or delete on public.%I for each statement execute function internal.enqueue_alert_refresh()', v_table);
  end loop;
end
$$;

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
    select 'hold_expiring', 'public.suite_occupancy', o.id::text
    from public.suite_occupancy o
    where o.is_active and o.kind = 'hold' and o.expires_at > p_now
      and extract(epoch from (o.expires_at - p_now)) / 60 <= internal.alert_threshold('reception.hold_expiry_warning_minutes')
    union all
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
    select 'checkin_overdue', 'public.bookings', b.id::text from booking_facts b
    where b.arrived_at is not null and b.checked_in_at is null
      and extract(epoch from (p_now - b.arrived_at)) / 60 >= internal.alert_threshold('reception.checkin_overdue_minutes')
    union all
    select 'cleaning_unconfirmed', 'public.cleaning_tasks', c.id::text from public.cleaning_tasks c
    where c.confirmed_at is null
      and extract(epoch from (p_now - c.due_from)) / 60 >= internal.alert_threshold('reception.cleaning_confirm_minutes')
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
  '[§9.3; OUR CHOICE] Native replacement for gatherFacts + scanForAlerts. One database snapshot, no HTTP reads that can fail silently and resolve valid alerts. Preserves the existing detection conditions, payment precedence, grading and Management thresholds. The TypeScript pure detectors remain the parity-test oracle.';
revoke all on function internal.detect_operational_alerts(timestamptz) from public, anon, authenticated, service_role;

create or replace function internal.run_alert_worker()
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_last_success timestamptz;
  v_detected jsonb;
  v_alert record;
  v_opened integer := 0;
  v_resolved integer := 0;
  v_new boolean;
  v_events integer;
  v_report jsonb;
begin
  if not pg_try_advisory_xact_lock(hashtext('wellplace.alert_worker')::bigint) then
    return jsonb_build_object('status', 'busy');
  end if;

  select s.last_success_at into v_last_success from internal.alert_worker_state s where s.singleton;
  if v_last_success > v_now - interval '30 seconds'
    and not exists (select 1 from internal.alert_refresh_events) then
    return jsonb_build_object('status', 'idle');
  end if;

  begin
    delete from internal.alert_refresh_events;
    get diagnostics v_events = row_count;

    select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) into v_detected
      from internal.detect_operational_alerts(v_now) d;

    for v_alert in
      select * from jsonb_to_recordset(v_detected)
        as d(kind public.alert_kind, severity public.alert_severity, entity text, entity_id text)
      order by d.kind, d.entity, d.entity_id
    loop
      select a.is_new into v_new from public.open_alert(
        v_alert.kind, v_alert.severity, v_alert.entity, v_alert.entity_id, null
      ) a;
      if v_new then v_opened := v_opened + 1; end if;
    end loop;

    for v_alert in
      select a.id from public.alerts a
      where a.resolved_at is null and not exists (
        select 1 from jsonb_to_recordset(v_detected)
          as d(kind public.alert_kind, severity public.alert_severity, entity text, entity_id text)
        where a.kind = d.kind and a.entity = d.entity and a.entity_id = d.entity_id
      )
      order by a.id for update of a
    loop
      perform public.resolve_alert(v_alert.id, 'Condition cleared');
      v_resolved := v_resolved + 1;
    end loop;

    v_report := jsonb_build_object('status', 'ok', 'opened', v_opened, 'resolved', v_resolved,
      'detected', jsonb_array_length(v_detected), 'events', v_events);
    update internal.alert_worker_state set last_attempt_at = v_now, last_success_at = v_now,
      last_error_code = null, consecutive_failures = 0, last_report = v_report where singleton;
    return v_report;
  exception when others then
    update internal.alert_worker_state set last_attempt_at = v_now, last_error_code = sqlstate,
      consecutive_failures = consecutive_failures + 1,
      last_report = jsonb_build_object('status', 'error', 'code', sqlstate) where singleton;
    raise warning 'WellPlace alert worker failed (%); pending events retained for retry', sqlstate;
    return jsonb_build_object('status', 'error', 'code', sqlstate);
  end;
end
$$;

comment on function internal.run_alert_worker() is
  '[§9.3; OUR CHOICE] Database-owned alert consumer: checks committed events every 10 seconds and elapsed-time conditions at least every 30 seconds while pg_cron is running. No Vercel invocation, browser session, URL or secret. Serializes workers only, never allocation. Reconciliation and event acknowledgement commit together; an error rolls both back and persists SQLSTATE without guest details. Failed work retries on the next tick. Inspect internal.alert_worker_state and cron.job_run_details. Can be invoked manually by the database owner. No application-role EXECUTE grant.';
revoke all on function internal.run_alert_worker() from public, anon, authenticated, service_role;

insert into internal.alert_refresh_events default values;

create extension if not exists pg_cron;
select cron.schedule('wellplace-alert-worker', '10 seconds', 'select internal.run_alert_worker();');
