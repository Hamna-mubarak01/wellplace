create function public.confirm_refund_return(p_refund_id uuid, p_reference text, p_reason text)
returns table (refund_id uuid, booking_id uuid)
language plpgsql security definer set search_path = '' as $$
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
  if v_refund.settled_at is null then
    update public.refunds r set is_pending = false, settled_at = now(), provider_reference = btrim(p_reference) where r.id = p_refund_id;
    perform internal.write_audit('confirm_refund_return', 'public.refunds', p_refund_id::text,
      jsonb_build_object('is_pending', v_refund.is_pending, 'settled_at', v_refund.settled_at),
      jsonb_build_object('is_pending', false, 'settled_at', now(), 'provider_reference', btrim(p_reference)), p_reason);
  end if;
  return query select v_refund.id, v_refund.booking_id;
end
$$;
revoke all on function public.confirm_refund_return(uuid,text,text) from public, anon;
grant execute on function public.confirm_refund_return(uuid,text,text) to authenticated;
comment on function public.confirm_refund_return(uuid,text,text) is '[§8, §11.2; OUR CHOICE] Management records a return already completed through the original payment method, with reference and audited reason. Never transfers money. Payment-first locks serialize with refund requests; repeat confirmation preserves the original settlement and audit.';
