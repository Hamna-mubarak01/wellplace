create or replace function public.guest_receipt(p_receipt_token uuid, p_valid_days integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'reference', b.reference, 'status', b.status, 'checkoutResult', a.result,
    'paymentReference', p.provider_reference, 'paymentStatus', p.status, 'simulated', p.is_simulated,
    'currency', a.currency, 'paymentOption', a.payment_option, 'snapshot', a.snapshot, 'createdAt', a.created_at,
    'expiresAt', upper(b.experience_period) + make_interval(days => p_valid_days),
    'refunds', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'amountFils', r.amount_fils, 'taxFils', r.tax_fils, 'pending', r.is_pending,
        'settledAt', r.settled_at, 'requestedAt', r.requested_at) order by r.requested_at)
        from public.refunds r
       where r.payment_id = p.id and r.withdrawn_at is null), '[]'::jsonb),
    'paymentNumber', p.reference)
    from internal.checkout_attempts a
    join public.bookings b on b.id = a.booking_id
    join public.payments p on p.id = a.payment_id
   where a.receipt_token = p_receipt_token
     and a.result in ('confirmed', 'refunded')
     and a.snapshot ? 'progress'
     and a.receipt_revoked_at is null
     and p_valid_days > 0
     and upper(b.experience_period) + make_interval(days => p_valid_days) > now()
$$;

do $$
begin
  execute format(
    'comment on function public.guest_receipt(uuid, integer) is %L',
    coalesce(obj_description('public.guest_receipt(uuid, integer)'::regprocedure, 'pg_proc') || E'\n\n', '')
      || 'PAYMENT NUMBER, SINCE 20260913099500. [OUR CHOICE — project owner''s direction, 13 September 2026] paymentNumber carries the payment''s short WP-P reference so the receipt can lead with it; paymentReference remains the provider reference exactly as before. The opaque token, revocation and expiry conditions are unchanged [§13, INV-25].'
  );
end
$$;
