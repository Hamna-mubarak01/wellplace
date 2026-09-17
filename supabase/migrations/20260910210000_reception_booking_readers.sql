create or replace function public.reception_customers(p_search text default '', p_id uuid default null)
returns table (id uuid, salutation public.salutation, first_name text, last_name text, email text, date_of_birth date, phone_e164 text, phone_country text, is_blocked boolean)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not internal.is_staff() then
    raise exception 'An active Reception session is required' using errcode = '42501';
  end if;
  perform internal.require_desk_operator();
  return query select c.id, c.salutation, c.first_name, c.last_name, c.email, c.date_of_birth,
    c.phone_e164, c.phone_country, c.is_blocked
  from public.customers c
  where (p_id is null or c.id = p_id)
    and (p_id is not null or nullif(btrim(p_search), '') is null
      or strpos(lower(c.first_name || ' ' || c.last_name || ' ' || c.email || ' ' || c.phone_e164), lower(btrim(p_search))) > 0)
  order by c.last_interaction_at desc nulls last, c.id
  limit 25;
end
$$;
revoke all on function public.reception_customers(text, uuid) from public, anon;
grant execute on function public.reception_customers(text, uuid) to authenticated;
comment on function public.reception_customers(text, uuid) is '[CLIENT, §6.1, §9.2] Limited customer contact lookup for booking and rebooking, without confidential customer aggregates.';

create or replace function public.reception_booking_suites(p_starts_at timestamptz, p_duration_hours integer)
returns table (id uuid, suite_number integer, available boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare v_buffer integer;
begin
  if not internal.is_staff() then
    raise exception 'An active Reception session is required' using errcode = '42501';
  end if;
  perform internal.require_desk_operator();
  if p_starts_at is null or not isfinite(p_starts_at) or p_duration_hours is null or p_duration_hours <= 0 then
    raise exception 'Choose a valid visit time and duration' using errcode = '22023';
  end if;
  select (s.value #>> '{}')::integer into strict v_buffer from public.settings s where s.key = 'cleaning.buffer_minutes';
  return query select s.id, s.suite_number,
    s.status not in ('blocked', 'maintenance', 'not_ready', 'out_of_service') and not exists (
      select 1 from public.suite_occupancy o where o.suite_id = s.id and o.is_active
        and (o.expires_at is null or o.expires_at > statement_timestamp())
        and o.blocked_period && tstzrange(p_starts_at, p_starts_at + make_interval(hours => p_duration_hours, mins => v_buffer), '[)')
    )
  from public.suites s where s.is_active order by s.suite_number;
end
$$;
revoke all on function public.reception_booking_suites(timestamptz, integer) from public, anon;
grant execute on function public.reception_booking_suites(timestamptz, integer) to authenticated;
comment on function public.reception_booking_suites(timestamptz, integer) is '[CLIENT, §7.2] Advisory suite choices include cleaning time. Creation rechecks the exact selected suite under the allocation lock.';

create or replace function public.reception_booking_audit(p_id uuid)
returns table (event_id bigint, action text, occurred_at timestamptz, actor_name text, reason text)
language plpgsql stable security definer set search_path = ''
as $$
declare v_customer_id uuid;
begin
  if not internal.is_staff() then
    raise exception 'An active Reception session is required' using errcode = '42501';
  end if;
  perform internal.require_desk_operator();
  select b.customer_id into v_customer_id from public.bookings b where b.id = p_id;
  if not found then
    raise exception 'The booking could not be found' using errcode = 'P0002';
  end if;
  return query select e.id, e.action, e.occurred_at, internal.staff_display_name(e.actor_id), nullif(btrim(e.reason), '')
  from audit.entries e
  where (e.entity = 'public.bookings' and e.entity_id = p_id::text)
    or (e.entity = 'public.suite_occupancy' and e.action in ('move_booking', 'reschedule_booking', 'extend_booking') and exists (
      select 1 from public.suite_occupancy o where o.id::text = e.entity_id and o.booking_id = p_id))
    or (e.entity = 'public.customers' and e.entity_id = v_customer_id::text
      and e.action in ('create_customer', 'complete_customer', 'correct_customer_record', 'set_customer_warning'))
    or (e.entity = 'public.payments' and exists (select 1 from public.payments p where p.id::text = e.entity_id and p.booking_id = p_id))
    or (e.entity = 'public.refunds' and exists (select 1 from public.refunds r join public.payments p on p.id = r.payment_id where r.id::text = e.entity_id and p.booking_id = p_id))
    or (e.entity = 'public.messages' and exists (select 1 from public.messages m where m.id::text = e.entity_id and m.booking_id = p_id))
  order by e.occurred_at desc, e.id desc;
end
$$;
revoke all on function public.reception_booking_audit(uuid) from public, anon;
grant execute on function public.reception_booking_audit(uuid) to authenticated;
comment on function public.reception_booking_audit(uuid) is '[CLIENT, §9.2, §10.6] One booking and its customer actions, with actor, time and reason only; no audit payloads or unrelated booking history.';
