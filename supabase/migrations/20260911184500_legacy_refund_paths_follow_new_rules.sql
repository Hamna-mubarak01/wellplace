create function internal.refund_tax_share(p_payment_id uuid, p_amount_fils integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.amount_fils > 0 then greatest(0, least(p.tax_fils,
        round(p.tax_fils::numeric * (coalesce(sum(r.amount_fils), 0) + p_amount_fils) / p.amount_fils)::integer)
      - coalesce(sum(r.tax_fils), 0)::integer)
    else 0 end
    from public.payments p
    left join public.refunds r on r.payment_id = p.id and r.withdrawn_at is null
   where p.id = p_payment_id
   group by p.id, p.amount_fils, p.tax_fils
$$;

revoke all on function internal.refund_tax_share(uuid, integer) from public, anon, authenticated;

comment on function internal.refund_tax_share(uuid, integer) is
  '[CLIENT pricing specification: 5% VAT included; OUR CHOICE] The VAT a new refund of this amount credits, apportioned cumulatively from the VAT frozen on the payment and net of the refunds already requested and not withdrawn. Call it before inserting the refund.';

CREATE OR REPLACE FUNCTION public.record_refund(p_payment_id uuid, p_amount_fils integer, p_reason text)
 RETURNS TABLE(refund_id uuid, payment_id uuid, booking_id uuid, amount_fils integer, refunded_total_fils integer, payment_amount_fils integer, payment_status payment_status, is_pending boolean)
 LANGUAGE plpgsql
security definer
set search_path = ''
AS $function$
declare
  v_booking_id  uuid;
  v_status      public.payment_status;
  v_new_status  public.payment_status;
  v_method      public.payment_method;
  v_paid        integer;
  v_refunded    bigint;
  v_refund_id   uuid;
  v_pending     boolean;
  v_actor       uuid := internal.current_staff_id();
begin
  if not internal.is_management() then
    raise exception 'record_refund: issuing a refund is Management only — docs/5 §3, "issue a refund: reception no, management yes"'
      using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'record_refund: a reason is required — §11.2 reports refunds with their reasons and one that cannot be explained cannot be reconciled'
      using errcode = '22023';
  end if;

  if p_amount_fils is null then
    raise exception 'record_refund: p_amount_fils is required, in integer fils [R-16]'
      using errcode = '22004';
  end if;

  if p_amount_fils <= 0 then
    raise exception 'record_refund: p_amount_fils must be greater than zero, got % — a zero refund is a row somebody meant not to write',
      p_amount_fils
      using errcode = 'WP026';
  end if;

  select p.booking_id, p.status, p.method, p.amount_fils
    into v_booking_id, v_status, v_method, v_paid
    from public.payments p
   where p.id = p_payment_id
   for update;

  if v_booking_id is null then
    raise exception 'record_refund: no payment with id %', p_payment_id
      using errcode = 'P0002';
  end if;

  if v_status not in (
    'paid'::public.payment_status,
    'partially_refunded'::public.payment_status
  ) then
    raise exception 'record_refund: a payment in % has taken nothing to give back [§8, §4.3]',
      v_status
      using errcode = 'WP030';
  end if;

  select coalesce(sum(r.amount_fils), 0)
    into v_refunded
    from public.refunds r
   where r.payment_id = p_payment_id
     and r.withdrawn_at is null;

  if v_refunded + p_amount_fils > v_paid then
    raise exception 'record_refund: % on top of % already refunded exceeds the % this payment took [§8, §11.2]',
      p_amount_fils, v_refunded, v_paid
      using errcode = 'WP029';
  end if;

  v_refunded := v_refunded + p_amount_fils;

  insert into public.refunds as r (
    payment_id,
    booking_id,
    amount_fils,
    tax_fils,
    reason,
    requested_by
  )
  values (
    p_payment_id,
    v_booking_id,
    p_amount_fils,
    internal.refund_tax_share(p_payment_id, p_amount_fils),
    btrim(p_reason),
    v_actor
  )
  returning r.id, r.is_pending
       into v_refund_id, v_pending;

  v_new_status := case
    when v_refunded >= v_paid then 'fully_refunded'::public.payment_status
    else 'partially_refunded'::public.payment_status
  end;

  update public.payments p
     set status = v_new_status
   where p.id = p_payment_id;

  perform internal.write_audit(
    'record_refund',
    'public.refunds',
    v_refund_id::text,
    jsonb_build_object(
      'payment_id',          p_payment_id,
      'payment_status',      v_status,
      'payment_amount_fils', v_paid,
      'refunded_total_fils', v_refunded - p_amount_fils
    ),
    jsonb_build_object(
      'payment_id',          p_payment_id,
      'booking_id',          v_booking_id,
      'method',              v_method,
      'amount_fils',         p_amount_fils,
      'refunded_total_fils', v_refunded,
      'payment_status',      v_new_status,
      'is_pending',          v_pending,
      'requested_by',        v_actor
    ),
    p_reason
  );

  refund_id           := v_refund_id;
  payment_id          := p_payment_id;
  booking_id          := v_booking_id;
  amount_fils         := p_amount_fils;
  refunded_total_fils := v_refunded::integer;
  payment_amount_fils := v_paid;
  payment_status      := v_new_status;
  is_pending          := v_pending;
  return next;
end
$function$;

CREATE OR REPLACE FUNCTION public.confirm_refund_return(p_refund_id uuid, p_reference text, p_reason text)
 RETURNS TABLE(refund_id uuid, booking_id uuid)
 LANGUAGE plpgsql
security definer
set search_path = ''
AS $function$
declare v_refund public.refunds%rowtype; v_payment_id uuid;
begin
  perform internal.require_management();
  if nullif(btrim(p_reference), '') is null or length(btrim(p_reference)) > 64
    or nullif(btrim(p_reason), '') is null or length(btrim(p_reason)) > 500 then
    raise exception 'Enter a payment reference and a short reason for confirming the return.' using errcode = '22023';
  end if;
  select r.payment_id into v_payment_id from public.refunds r where r.id = p_refund_id;
  if not found then raise exception 'The refund could not be found.' using errcode = 'P0002'; end if;
  perform 1 from public.payments p where p.id = v_payment_id for update;
  select * into v_refund from public.refunds r where r.id = p_refund_id for update;
  if v_refund.withdrawn_at is not null then
    raise exception 'This refund request was withdrawn, so there is nothing to confirm.' using errcode = 'WP071';
  end if;
  if v_refund.settled_at is null then
    update public.refunds r set is_pending = false, settled_at = now(), provider_reference = btrim(p_reference) where r.id = p_refund_id;
    perform internal.write_audit('confirm_refund_return', 'public.refunds', p_refund_id::text,
      jsonb_build_object('is_pending', v_refund.is_pending, 'settled_at', v_refund.settled_at),
      jsonb_build_object('is_pending', false, 'settled_at', now(), 'provider_reference', btrim(p_reference)), p_reason);
  end if;
  return query select v_refund.id, v_refund.booking_id;
end
$function$;

comment on function public.record_refund(uuid, integer, text) is
  '[Contract: payments, receipts, refunds; OUR CHOICE] The older Management refund recorder, kept because pgTAP and direct Management use still reach it; the consoles now use request_payment_refund. It follows the same ceiling (refunds that were withdrawn do not count) and credits VAT from the payment''s frozen tax through internal.refund_tax_share. It still moves the payment to partially or fully refunded when the request is recorded, as it always has; refund_settlement_status recomputes the status from settled amounts when the return is confirmed.';

comment on function public.confirm_refund_return(uuid, text, text) is
  '[Contract: payments, receipts, refunds; OUR CHOICE] Management''s confirmation that a refund''s money has left WellPlace. A withdrawn request is refused with WP071 and a plain message, instead of failing the refunds_withdrawn_is_stopped check with a generic one, which a stale Management page could otherwise trigger after Reception withdrew the request.';
