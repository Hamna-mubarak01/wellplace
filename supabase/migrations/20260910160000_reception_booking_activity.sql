-- [CLIENT, §9.2, §10.6] A single booking's operational history; never the general audit log.
create or replace function public.reception_booking_activity(p_id uuid)
returns table (event_id bigint, action text, occurred_at timestamptz, actor_name text, status text)
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
    select e.id, e.action, e.occurred_at, internal.staff_display_name(e.actor_id), e.new_value ->> 'status'
    from audit.entries e
    where ((e.entity = 'public.bookings' and e.entity_id = p_id::text)
      or (e.entity = 'public.suite_occupancy' and exists (
        select 1 from public.suite_occupancy o where o.id::text = e.entity_id and o.booking_id = p_id)))
      and e.action in ('create_reception_booking', 'confirm_booking', 'record_arrival',
        'check_in_booking', 'check_out_booking', 'cancel_booking', 'reschedule_booking',
        'move_booking', 'extend_booking', 'mark_no_show', 'mark_late_arrival',
        'record_overrun', 'update_booking_details', 'override_booking_buffer')
    order by e.occurred_at desc, e.id desc;
end
$$;
revoke all on function public.reception_booking_activity(uuid) from public, anon;
grant execute on function public.reception_booking_activity(uuid) to authenticated;
comment on function public.reception_booking_activity(uuid) is
  '[CLIENT, §9.2] Active Reception may read one booking operational activity trail. Only action, time, staff display name and booking status are exposed. No arbitrary audit fields, prices, reasons, contacts or unrelated entities.';
