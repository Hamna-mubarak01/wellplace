create or replace function public.refund_payment_and_cancel_booking(
  p_payment_id  uuid,
  p_amount_fils integer,
  p_reason      text,
  p_request_key uuid
)
returns table (refund_id uuid, booking_cancelled boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking_id uuid;
  v_status     public.booking_status;
  v_occupancy  uuid;
  v_suite      uuid;
  v_refund     uuid;
  v_released   uuid;
begin
  if not internal.is_staff() then
    raise exception 'Sign in to process a refund.' using errcode = '42501';
  end if;

  select p.booking_id into v_booking_id from public.payments p where p.id = p_payment_id;
  if v_booking_id is null then
    raise exception 'Only a paid balance can be refunded.' using errcode = 'WP066';
  end if;

  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);

  select b.status, b.occupancy_id, b.suite_id
    into v_status, v_occupancy, v_suite
    from public.bookings b
   where b.id = v_booking_id
   for no key update;

  v_refund := public.request_payment_refund(p_payment_id, p_amount_fils, p_reason, p_request_key);

  if v_status not in (
    'held'::public.booking_status,
    'awaiting_payment'::public.booking_status,
    'payment_failed'::public.booking_status,
    'awaiting_recovery'::public.booking_status,
    'confirmed'::public.booking_status
  ) then
    refund_id := v_refund;
    booking_cancelled := false;
    return next;
    return;
  end if;

  update public.suite_occupancy o
     set is_active = false,
         status    = 'released'::public.occupancy_status
   where o.id = v_occupancy
     and o.is_active
  returning o.id into v_released;

  update public.bookings b
     set status = 'cancelled'::public.booking_status
   where b.id = v_booking_id;

  perform internal.write_audit(
    'cancel_booking_with_refund', 'public.bookings', v_booking_id::text,
    jsonb_build_object('status', v_status, 'suite_id', v_suite, 'occupancy_id', v_occupancy),
    jsonb_build_object('status', 'cancelled', 'refund_id', v_refund, 'released_occupancy_id', v_released),
    btrim(p_reason)
  );

  refund_id := v_refund;
  booking_cancelled := true;
  return next;
end
$$;

revoke all on function public.refund_payment_and_cancel_booking(uuid, integer, text, uuid) from public, anon;
grant execute on function public.refund_payment_and_cancel_booking(uuid, integer, text, uuid) to authenticated;

comment on function public.refund_payment_and_cancel_booking(uuid, integer, text, uuid) is
  '[Project owner''s direction, 17 September 2026] Records a refund through public.request_payment_refund and, in the same transaction, cancels the booking and releases its suite claim exactly as public.cancel_booking does, so the slot is offered again at once. Staff choose it in the refund dialog; a refund without cancelling stays available for a guest who was charged on the wrong card and pays again. A booking that has already started, ended or been cancelled keeps its status and booking_cancelled comes back false. Any active staff member may call it, as any may request a refund. Retrying with the same request key returns the same refund and cancels nothing twice.';
