create or replace function public.withdraw_refund_request(p_refund_id uuid, p_reason text)
returns table (refund_id uuid, payment_id uuid, booking_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment  uuid;
  v_paid     integer;
  v_returned bigint;
  r          public.refunds%rowtype;
begin
  if not internal.is_staff() then
    raise exception 'Sign in to withdraw a refund request.' using errcode = '42501';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 1 and 500 then
    raise exception 'Enter a reason of up to 500 characters.' using errcode = '22023';
  end if;

  select rf.payment_id into v_payment from public.refunds rf where rf.id = p_refund_id;
  if v_payment is null then
    raise exception 'That refund request could not be found.' using errcode = 'P0002';
  end if;

  select pm.amount_fils into v_paid from public.payments pm where pm.id = v_payment for update;
  select * into r from public.refunds rf where rf.id = p_refund_id for update;

  if not r.is_pending or r.settled_at is not null or r.withdrawn_at is not null then
    raise exception 'Only a refund that is still pending can be withdrawn.' using errcode = 'WP066';
  end if;
  if r.requested_by is null then
    raise exception 'This refund was started automatically because the payment could not be used for the booking. It can be confirmed as returned, but not withdrawn.' using errcode = 'WP066';
  end if;

  update public.refunds rf
     set is_pending = false,
         withdrawn_at = now(),
         withdrawn_by = internal.current_staff_id(),
         withdrawal_reason = btrim(p_reason)
   where rf.id = r.id;

  select coalesce(sum(rf.amount_fils), 0) into v_returned
    from public.refunds rf
   where rf.payment_id = v_payment and rf.settled_at is not null;

  update public.payments pm
     set status = case
       when v_returned = 0 then 'paid'::public.payment_status
       when v_returned >= v_paid then 'fully_refunded'::public.payment_status
       else 'partially_refunded'::public.payment_status end
   where pm.id = v_payment
     and pm.status in ('paid', 'partially_refunded', 'fully_refunded');

  perform internal.write_audit(
    'withdraw_refund_request', 'public.refunds', r.id::text,
    jsonb_build_object('is_pending', true, 'amount_fils', r.amount_fils),
    jsonb_build_object('is_pending', false, 'withdrawn', true, 'amount_fils', r.amount_fils, 'payment_id', r.payment_id),
    p_reason
  );

  refund_id := r.id;
  payment_id := r.payment_id;
  booking_id := r.booking_id;
  return next;
end
$$;
