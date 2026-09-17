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
    'paymentNumber', p.reference,
    'documents', coalesce((
      select jsonb_agg(d.document order by d.issued_at, d.number)
        from (
          select i.issued_at,
                 i.invoice_number as number,
                 jsonb_build_object(
                   'id', i.id, 'type', 'invoice', 'number', i.invoice_number, 'issuedAt', i.issued_at,
                   'totalFils', i.total_fils, 'taxFils', i.tax_fils, 'currency', i.currency,
                   'isTest', i.is_test, 'invoiceNumber', null) as document
            from public.invoices i
           where i.booking_id = b.id and i.voided_at is null
          union all
          select cn.issued_at,
                 cn.credit_note_number,
                 jsonb_build_object(
                   'id', cn.id, 'type', 'credit_note', 'number', cn.credit_note_number, 'issuedAt', cn.issued_at,
                   'totalFils', cn.amount_fils, 'taxFils', cn.tax_fils, 'currency', cn.currency,
                   'isTest', cn.is_test, 'invoiceNumber', cn.invoice_number)
            from public.credit_notes cn
           where cn.booking_id = b.id and cn.voided_at is null
        ) d), '[]'::jsonb))
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
      || 'DOCUMENTS, SINCE 20260914092000. [OUR CHOICE — project owner''s direction, 14 September 2026; §6.5 "reopen or request the confirmation, receipt or invoice"] documents lists the booking''s valid tax invoices and credit notes in issue order: id, type (invoice or credit_note), number, issuedAt, totalFils (the refunded amount for a credit note), taxFils, currency, isTest and, for a credit note, the invoiceNumber it credits. Voided documents are left out. Nothing names a suite [§3, INV-01]. public.guest_document returns one of them in full under the same token rules. Every other key, the opaque token, revocation and expiry are unchanged [§13, INV-25].'
  );
end
$$;


create function public.guest_document(p_receipt_token uuid, p_valid_days integer, p_document_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with receipt as (
    select b.id        as booking_id,
           b.reference as booking_reference,
           c.reference as customer_reference
      from internal.checkout_attempts a
      join public.bookings b on b.id = a.booking_id
      join public.customers c on c.id = b.customer_id
     where a.receipt_token = p_receipt_token
       and a.result in ('confirmed', 'refunded')
       and a.snapshot ? 'progress'
       and a.receipt_revoked_at is null
       and p_valid_days > 0
       and upper(b.experience_period) + make_interval(days => p_valid_days) > now()
     limit 1
  )
  select coalesce(
    (select jsonb_build_object(
              'type',              'invoice',
              'bookingReference',  r.booking_reference,
              'customerReference', r.customer_reference,
              'document',          to_jsonb(i) || jsonb_build_object('issued_by', null, 'voided_by', null))
       from receipt r
       join public.invoices i on i.booking_id = r.booking_id
      where i.id = p_document_id and i.voided_at is null),
    (select jsonb_build_object(
              'type',              'credit_note',
              'bookingReference',  r.booking_reference,
              'customerReference', r.customer_reference,
              'document',          to_jsonb(cn) || jsonb_build_object('issued_by', null, 'voided_by', null))
       from receipt r
       join public.credit_notes cn on cn.booking_id = r.booking_id
      where cn.id = p_document_id and cn.voided_at is null)
  )
$$;

revoke all on function public.guest_document(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.guest_document(uuid, integer, uuid) to service_role;

comment on function public.guest_document(uuid, integer, uuid) is
  '[OUR CHOICE — project owner''s direction, 14 September 2026; §6.5; §13, INV-25] The full snapshot of one valid tax invoice or credit note for the guest''s PDF download, keyed on the guest''s opaque receipt token and the document id. It returns a document only when the token passes exactly the rules of public.guest_receipt (a confirmed or refunded checkout with saved progress, not revoked, p_valid_days above zero and the visit ended less than p_valid_days ago) and the document belongs to that token''s booking and is not voided; otherwise null, so a guessed or foreign document id reveals nothing. The result is type, bookingReference (WP-B), customerReference (WP-C) and document, the row as stored with issued_by and voided_by blanked. Neither table holds a suite, so no suite number can reach the guest [§3, INV-01]. Executable by the service role only; the guest has no session, and src/lib/db/guest-checkout.ts is the only caller.';
