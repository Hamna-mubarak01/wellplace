create or replace function public.request_payment_refund(p_payment_id uuid,p_amount_fils integer,p_reason text,p_request_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.payments%rowtype; r public.refunds%rowtype; total bigint; rid uuid; refund_tax integer; original_tax integer; original_total integer;
begin
 if not internal.is_staff() then raise exception 'Sign in to process a refund.' using errcode='42501'; end if;
 select * into p from public.payments where id=p_payment_id for update;
 select * into r from public.refunds where request_key=p_request_key;
 if found then
   if r.payment_id<>p_payment_id or r.amount_fils<>p_amount_fils or r.reason<>btrim(p_reason) then raise exception 'This refund request has already been used.' using errcode='WP066'; end if;
   return r.id;
 end if;
 if p.id is null or p.status not in ('paid','partially_refunded') then raise exception 'Only a paid balance can be refunded.' using errcode='WP066'; end if;
 if p_amount_fils is null or p_amount_fils<=0 or p_request_key is null or p_reason is null or length(btrim(p_reason)) not between 1 and 500 then raise exception 'Enter a positive refund amount and a reason of up to 500 characters.' using errcode='WP066'; end if;
 select coalesce(sum(amount_fils),0) into total from public.refunds where payment_id=p.id;
 if total+p_amount_fils>p.amount_fils then raise exception 'This amount exceeds the remaining refundable balance. Refresh the booking and check previous refunds.' using errcode='WP066'; end if;
 select coalesce((a.snapshot->'breakdown'->>'taxFils')::integer,b.tax_fils),coalesce((a.snapshot->'breakdown'->>'totalFils')::integer,b.total_fils)
 into original_tax,original_total from public.bookings b left join internal.checkout_attempts a on a.payment_id=p.id where b.id=p.booking_id;
 select case when original_total>0 then greatest(0,least(original_tax,round(original_tax::numeric*(total+p_amount_fils)/original_total)::integer)-coalesce((select sum(prior.tax_fils) from public.refunds prior where prior.payment_id=p.id),0)) else 0 end into refund_tax;
 insert into public.refunds(payment_id,booking_id,amount_fils,tax_fils,reason,requested_by,is_pending,settled_at,provider_reference,request_key)
 values(p.id,p.booking_id,p_amount_fils,refund_tax,btrim(p_reason),internal.current_staff_id(),not p.is_simulated,case when p.is_simulated then now() end,
 case when p.is_simulated then 'SIM-REFUND-'||p_request_key::text end,p_request_key) returning id into rid;
 if p.is_simulated then update public.payments set status=case when total+p_amount_fils=p.amount_fils then 'fully_refunded'::public.payment_status else 'partially_refunded'::public.payment_status end where id=p.id; end if;
 perform internal.write_audit('request_payment_refund','public.refunds',rid::text,null,jsonb_build_object('amount_fils',p_amount_fils,'simulated',p.is_simulated,'payment_id',p.id),p_reason);
 return rid;
end $$;
comment on function public.request_payment_refund(uuid,integer,text,uuid) is '[§8; CLIENT refund/VAT request] Online VAT credits use the immutable payment quote, including after a booking is changed. Existing desk payments fall back to the booking tax record. Preserves staff authorization, request idempotency, payment locking and cumulative refund ceilings.';
