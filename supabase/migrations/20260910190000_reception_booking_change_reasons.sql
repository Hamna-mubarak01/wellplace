create or replace function public.reception_booking_change_reasons(p_id uuid)
returns table (event_id bigint, action text, occurred_at timestamptz, actor_name text, reason text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not internal.is_staff() then
    raise exception 'An active Reception session is required' using errcode = '42501';
  end if;
  perform internal.require_desk_operator();
  if not exists (select 1 from public.bookings where id = p_id) then
    raise exception 'The booking could not be found' using errcode = 'P0002';
  end if;
  return query
    select latest.id, latest.action, latest.occurred_at, internal.staff_display_name(latest.actor_id), latest.reason
    from (
      select distinct on (e.action) e.id, e.action, e.occurred_at, e.actor_id, e.reason
      from audit.entries e
      where ((e.entity = 'public.bookings' and e.entity_id = p_id::text)
        or (e.entity = 'public.suite_occupancy' and exists (
          select 1 from public.suite_occupancy o where o.id::text = e.entity_id and o.booking_id = p_id)))
        and e.action in ('move_booking', 'reschedule_booking', 'extend_booking')
        and nullif(btrim(e.reason), '') is not null
      order by e.action, e.occurred_at desc, e.id desc
    ) latest
    order by latest.occurred_at desc, latest.id desc;
end
$$;
revoke all on function public.reception_booking_change_reasons(uuid) from public, anon;
grant execute on function public.reception_booking_change_reasons(uuid) to authenticated;
comment on function public.reception_booking_change_reasons(uuid) is
  '[CLIENT, §9.2, §10.6] Latest move, rescheduling and extension reasons for one booking, available only to active Reception. No other audit actions or payloads are exposed.';
