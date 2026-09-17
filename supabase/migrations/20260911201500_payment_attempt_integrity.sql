alter table public.payments add column taxable_fils integer not null default 0;

update public.payments
   set taxable_fils = case when tax_fils > 0 then amount_fils else 0 end
 where status in ('paid', 'partially_refunded', 'fully_refunded');

alter table public.payments add constraint payments_taxable_within_amount
  check (taxable_fils >= 0 and taxable_fils <= amount_fils);

comment on column public.payments.taxable_fils is
  '[CLIENT pricing specification: 5% VAT included; OUR CHOICE] The part of this payment that carries VAT. It is the part that falls within the booking''s price once the money the booking already keeps is counted, so the excess of an overpayment carries none. tax_fils is the VAT within this part. Refunds credit VAT only as the money retained drops below it.';

create or replace function internal.assign_payment_tax()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tax     integer;
  v_gross   integer;
  v_kept    bigint;
  v_through bigint;
begin
  if new.status not in ('paid', 'partially_refunded', 'fully_refunded') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status in ('paid', 'partially_refunded', 'fully_refunded') then
    return new;
  end if;

  select coalesce((a.snapshot -> 'breakdown' ->> 'taxFils')::integer, b.tax_fils),
         coalesce((a.snapshot -> 'breakdown' ->> 'totalFils')::integer, b.total_fils)
    into v_tax, v_gross
    from public.bookings b
    left join internal.checkout_attempts a on a.payment_id = new.id
   where b.id = new.booking_id;

  select greatest(0, coalesce(sum(p.amount_fils - coalesce((
           select sum(r.amount_fils) from public.refunds r
            where r.payment_id = p.id and r.withdrawn_at is null), 0)), 0))
    into v_kept
    from public.payments p
   where p.booking_id = new.booking_id
     and p.id <> new.id
     and p.status in ('paid', 'partially_refunded', 'fully_refunded');

  if coalesce(v_gross, 0) > 0 then
    v_through := least(v_kept + new.amount_fils, v_gross);
    new.taxable_fils := greatest(0, v_through - least(v_kept, v_gross));
    new.tax_fils := least(new.amount_fils, greatest(0,
        round(v_tax::numeric * v_through / v_gross)::integer
      - round(v_tax::numeric * least(v_kept, v_gross) / v_gross)::integer));
  else
    new.taxable_fils := 0;
    new.tax_fils := 0;
  end if;
  return new;
end
$$;

comment on function internal.assign_payment_tax() is
  '[OUR CHOICE] Freezes a payment''s VAT and VAT-bearing part the first time it takes money. It apportions against the money the booking already KEEPS — earlier payments less their refunds that were not withdrawn — rather than against their gross, so a new payment after a full refund carries the booking''s VAT again instead of none.';

create or replace function internal.refund_tax_share(p_payment_id uuid, p_amount_fils integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.taxable_fils > 0 then greatest(0, least(
        p.tax_fils - coalesce(sum(r.tax_fils), 0)::integer,
        (p.tax_fils - coalesce(sum(r.tax_fils), 0)::integer)
          - round(p.tax_fils::numeric
              * least(greatest(p.amount_fils - coalesce(sum(r.amount_fils), 0) - p_amount_fils, 0), p.taxable_fils)
              / p.taxable_fils)::integer))
    else 0 end
    from public.payments p
    left join public.refunds r on r.payment_id = p.id and r.withdrawn_at is null
   where p.id = p_payment_id
   group by p.id, p.amount_fils, p.tax_fils, p.taxable_fils
$$;

comment on function internal.refund_tax_share(uuid, integer) is
  '[CLIENT pricing specification: 5% VAT included; OUR CHOICE] The VAT a new refund of this amount credits: the VAT still held on the payment, less the VAT the money retained after this refund still carries. Retained money carries VAT only up to the payment''s VAT-bearing part, so refunding an overpayment''s excess credits none, a full refund credits exactly what remains, and a series of partial refunds telescopes to the payment''s VAT. Call it before inserting the refund.';

create or replace function internal.release_cancelled_guest_hold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.suite_occupancy oc
     set is_active = false, status = 'released'
    from internal.checkout_attempts a
    join internal.guest_checkout_holds h on h.token = a.token
   where a.booking_id = new.id
     and oc.id = h.occupancy_id
     and oc.kind = 'hold'
     and oc.is_active
     and oc.experience_period = new.experience_period
     and not exists (
       select 1 from internal.checkout_attempts newer
        where newer.token = a.token and newer.booking_id <> new.id and newer.created_at > a.created_at
     );
  return new;
end
$$;

comment on function internal.release_cancelled_guest_hold() is
  '[Contract: the website must stop offering a slot the moment it is freed; OUR CHOICE] Releases the guest''s checkout hold when their booking is cancelled, so a later payment has nothing to convert. It releases only the hold that belongs to THIS booking — same visit time, and no newer checkout in the same session for another booking — because a guest''s session can outlive one booking and hold a time for the next.';

CREATE OR REPLACE FUNCTION public.request_payment_refund(p_payment_id uuid, p_amount_fils integer, p_reason text, p_request_key uuid)
 RETURNS uuid
 LANGUAGE plpgsql
security definer
set search_path = ''
AS $function$
declare
  p          public.payments%rowtype;
  r          public.refunds%rowtype;
  v_refunded bigint;
  v_prior_tax bigint;
  v_tax      integer;
  v_id       uuid;
begin
  if not internal.is_staff() then
    raise exception 'Sign in to process a refund.' using errcode = '42501';
  end if;

  select * into p from public.payments where id = p_payment_id for update;

  select * into r from public.refunds where request_key = p_request_key;
  if found then
    if r.payment_id <> p_payment_id or r.amount_fils <> p_amount_fils or r.reason <> btrim(p_reason) then
      raise exception 'This refund request has already been used.' using errcode = 'WP066';
    end if;
    return r.id;
  end if;

  if p.id is null or p.status not in ('paid', 'partially_refunded') then
    raise exception 'Only a paid balance can be refunded.' using errcode = 'WP066';
  end if;
  if p_amount_fils is null or p_amount_fils <= 0 or p_request_key is null or p_reason is null
     or length(btrim(p_reason)) not between 1 and 500 then
    raise exception 'Enter a positive refund amount and a reason of up to 500 characters.' using errcode = 'WP066';
  end if;

  select coalesce(sum(amount_fils), 0), coalesce(sum(tax_fils), 0)
    into v_refunded, v_prior_tax
    from public.refunds
   where payment_id = p.id
     and withdrawn_at is null;

  if v_refunded + p_amount_fils > p.amount_fils then
    raise exception 'This amount exceeds the remaining refundable balance. Refresh the booking and check previous refunds.' using errcode = 'WP066';
  end if;

  v_tax := internal.refund_tax_share(p.id, p_amount_fils);

  insert into public.refunds (
    payment_id, booking_id, amount_fils, tax_fils, reason, requested_by,
    is_pending, settled_at, provider_reference, request_key
  )
  values (
    p.id, p.booking_id, p_amount_fils, v_tax, btrim(p_reason), internal.current_staff_id(),
    not p.is_simulated,
    case when p.is_simulated then now() end,
    case when p.is_simulated then internal.opaque_reference('SIM-REFUND-', p_request_key) end,
    p_request_key
  )
  returning id into v_id;

  perform internal.write_audit(
    'request_payment_refund', 'public.refunds', v_id::text, null,
    jsonb_build_object('amount_fils', p_amount_fils, 'tax_fils', v_tax, 'simulated', p.is_simulated, 'payment_id', p.id),
    p_reason
  );
  return v_id;
end
$function$;

CREATE OR REPLACE FUNCTION public.settle_payment_event(p_provider text, p_event_id text, p_payment_id uuid, p_outcome text, p_amount_fils integer, p_currency text, p_signature_verified boolean, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
security definer
set search_path = ''
AS $function$
declare
  a              internal.checkout_attempts%rowtype;
  p              public.payments%rowtype;
  b              public.bookings%rowtype;
  o              public.suite_occupancy%rowtype;
  v              public.promo_codes%rowtype;
  allocated      record;
  v_event        uuid;
  v_occupancy    uuid;
  v_suite        uuid;
  v_suite_status public.suite_status;
  v_result       text;
  v_failure      text;
  v_reference    text;
  v_tax          integer;
  v_occupied     integer;
  v_customer     integer;
  v_terminal     boolean;
  v_stale        boolean;
begin
  if not internal.is_worker_session() then
    raise exception 'Payment results are accepted only from the payment callback.' using errcode = '42501';
  end if;
  if p_signature_verified is not true then
    raise exception 'The payment result could not be verified.' using errcode = 'WP065';
  end if;
  if p_outcome is null or p_outcome not in ('success', 'failed', 'cancelled')
     or nullif(btrim(coalesce(p_provider, '')), '') is null
     or nullif(btrim(coalesce(p_event_id, '')), '') is null then
    raise exception 'The payment result could not be verified.' using errcode = 'WP065';
  end if;

  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);

  select * into a from internal.checkout_attempts where payment_id = p_payment_id for update;
  if not found then
    raise exception 'This payment is not part of an online checkout.' using errcode = 'WP065';
  end if;
  select * into p from public.payments where id = p_payment_id for update;
  select * into b from public.bookings where id = a.booking_id for update;

  if (lower(p_provider) = 'simulation') is distinct from p.is_simulated
     or p.amount_fils <> p_amount_fils
     or a.currency <> p_currency then
    raise exception 'The payment result could not be verified.' using errcode = 'WP065';
  end if;

  insert into public.payment_events (payment_id, booking_id, provider, provider_event_id, signature_verified, payload, processed_at)
  values (
    p.id, b.id, lower(p_provider), p_event_id, true,
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('outcome', p_outcome, 'amount_fils', p_amount_fils, 'currency', p_currency),
    now()
  )
  on conflict (provider, provider_event_id) do nothing
  returning id into v_event;

  if v_event is null then
    return jsonb_build_object(
      'status', coalesce(a.result, 'pending'), 'duplicate', true,
      'receiptToken', case when a.result in ('confirmed', 'refunded') then a.receipt_token end,
      'reference', b.reference, 'bookingId', b.id, 'paymentId', p.id);
  end if;

  if a.result is not null and not (p_outcome = 'success' and a.result in ('failed', 'cancelled')) then
    return jsonb_build_object(
      'status', a.result, 'duplicate', true,
      'receiptToken', case when a.result in ('confirmed', 'refunded') then a.receipt_token end,
      'reference', b.reference, 'bookingId', b.id, 'paymentId', p.id);
  end if;

  v_stale := exists (
      select 1 from internal.checkout_attempts newer
       where newer.booking_id = a.booking_id and newer.id <> a.id and newer.created_at > a.created_at
    ) or p.amount_fils <> b.total_fils;

  v_reference := case
    when p.is_simulated then internal.opaque_reference('SIM-', p.id)
    else coalesce(nullif(btrim(p_payload ->> 'transactionReference'), ''), p.provider_reference)
  end;

  if p_outcome = 'success' then
    v_terminal := b.status in ('cancelled', 'completed', 'no_show', 'rescheduled', 'abandoned');

    if v_terminal or p.status = 'cancelled' then
      v_failure := 'This booking was cancelled before the payment completed.';
    elsif v_stale then
      v_failure := 'This payment was for an earlier version of the booking, which has since changed.';
    elsif upper(b.experience_period) <= clock_timestamp() then
      v_failure := 'Your visit had already ended when the payment completed.';
    elsif exists (
      select 1 from internal.checkout_attempts ca
       where ca.id <> a.id and ca.result = 'confirmed' and (ca.booking_id = b.id or ca.token = a.token)
    ) then
      v_failure := 'This booking had already been paid through another payment attempt.';
    end if;

    perform internal.release_expired_occupancy();

    if v_failure is null and a.promo_id is not null then
      select * into v from public.promo_codes where id = a.promo_id for update;
      select count(*), count(*) filter (where bk.customer_id = b.customer_id)
        into v_occupied, v_customer
        from internal.checkout_attempts ca
        join public.bookings bk on bk.id = ca.booking_id
       where ca.promo_id = v.id and ca.id <> a.id and ca.result is null and ca.reservation_expires_at > now();
      v_customer := v_customer + (
        select count(*) from public.promo_code_redemptions r where r.promo_code_id = v.id and r.customer_id = b.customer_id);
      if (v.max_uses is not null and v.used_count + v_occupied >= v.max_uses)
         or (v.per_customer_limit is not null and v_customer >= v.per_customer_limit) then
        v_failure := 'The coupon was no longer available when the payment completed.';
      end if;
    end if;

    if v_failure is null then
      select oc.* into o
        from internal.guest_checkout_holds h
        join public.suite_occupancy oc on oc.id = h.occupancy_id
       where h.token = a.token
         for update of oc;
      if o.id is not null then
        select s.status into v_suite_status from public.suites s where s.id = o.suite_id;
      end if;

      if o.id is not null and o.is_active and o.kind = 'hold' and o.expires_at > clock_timestamp()
         and o.experience_period = b.experience_period
         and v_suite_status not in ('blocked', 'maintenance', 'not_ready', 'out_of_service') then
        update public.suite_occupancy set kind = 'booking', booking_id = b.id, expires_at = null where id = o.id;
        v_occupancy := o.id;
        v_suite := o.suite_id;
      else
        if o.id is not null and o.is_active and o.kind = 'hold' and o.experience_period = b.experience_period then
          update public.suite_occupancy set is_active = false, status = 'released' where id = o.id;
        end if;
        select * into allocated from internal.allocate_suite(
          b.experience_period,
          tstzrange(lower(b.experience_period), upper(b.experience_period) + make_interval(mins => b.cleaning_buffer_minutes), '[)'),
          b.cleaning_buffer_minutes, 'booking', null, b.id, 'Payment completed without a usable hold', false, b.suite_id);
        v_occupancy := allocated.allocated_occupancy_id;
        v_suite := allocated.allocated_suite_id;
        if v_occupancy is null then
          select * into allocated from internal.allocate_suite(
            b.experience_period,
            tstzrange(lower(b.experience_period), upper(b.experience_period) + make_interval(mins => b.cleaning_buffer_minutes), '[)'),
            b.cleaning_buffer_minutes, 'booking', null, b.id, 'Payment completed without a usable hold', false, null);
          v_occupancy := allocated.allocated_occupancy_id;
          v_suite := allocated.allocated_suite_id;
        end if;
        if v_occupancy is null then
          v_failure := 'The time was no longer available when the payment completed.';
        end if;
      end if;
    end if;

    if v_failure is null then
      update public.bookings set status = 'confirmed', occupancy_id = v_occupancy, suite_id = v_suite where id = b.id;
      update public.payments set status = 'paid', provider_reference = v_reference where id = p.id;
      if a.promo_id is not null then
        insert into public.promo_code_redemptions (promo_code_id, booking_id, customer_id) values (a.promo_id, b.id, b.customer_id);
        update public.promo_codes set used_count = used_count + 1 where id = a.promo_id;
      end if;
      v_result := 'confirmed';
    else
      update public.payments set status = 'paid', provider_reference = v_reference where id = p.id
      returning tax_fils into v_tax;

      update public.suite_occupancy oc
         set is_active = false, status = 'released'
        from internal.guest_checkout_holds h
       where h.token = a.token and oc.id = h.occupancy_id and oc.kind = 'hold' and oc.is_active
         and oc.experience_period = b.experience_period and not v_stale;

      if not v_terminal and not v_stale and b.status <> 'confirmed' then
        update public.bookings set status = 'awaiting_recovery', suite_id = null, occupancy_id = null where id = b.id;
      end if;

      if p.amount_fils > 0 then
        insert into public.refunds (payment_id, booking_id, amount_fils, tax_fils, reason, is_pending, requested_at)
        values (p.id, b.id, p.amount_fils, v_tax, v_failure || ' The full amount is to be refunded.', true, now());
      end if;
      v_result := 'refunded';
    end if;
  else
    update public.payments set status = p_outcome::public.payment_status where id = p.id and status in ('open', 'pending');
    if not v_stale then
      update public.bookings set status = 'payment_failed' where id = b.id and status in ('held', 'awaiting_payment');
    end if;
    v_result := p_outcome;
  end if;

  update internal.checkout_attempts set result = v_result where id = a.id;
  update internal.checkout_sessions
     set recovered = recovered or updated_at < now() - make_interval(mins => abandoned_minutes),
         updated_at = now()
   where token = a.token;

  perform internal.write_audit(
    'settle_payment_event', 'public.payments', p.id::text,
    jsonb_build_object('payment_status', p.status, 'booking_status', b.status, 'result', a.result),
    jsonb_build_object('result', v_result, 'provider', lower(p_provider), 'event', p_event_id,
                       'amount_fils', p.amount_fils, 'simulated', p.is_simulated, 'failure', v_failure),
    coalesce(v_failure, 'Payment provider result')
  );

  return jsonb_build_object(
    'status', v_result, 'duplicate', false,
    'receiptToken', case when v_result in ('confirmed', 'refunded') then a.receipt_token end,
    'reference', b.reference, 'bookingId', b.id, 'paymentId', p.id);
end
$function$;

CREATE OR REPLACE FUNCTION public.guest_payment_for_verification(p_token uuid, p_payment_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
set search_path = ''
AS $function$
 select jsonb_build_object('paymentId',p.id,'amountFils',p.amount_fils,'currency',a.currency,'option',a.payment_option,'simulated',p.is_simulated)
 from internal.checkout_attempts a join public.payments p on p.id=a.payment_id where a.token=p_token and p.id=p_payment_id and a.result is null
$function$;

comment on function public.settle_payment_event(text, text, uuid, text, integer, text, boolean, jsonb) is
  '[Contract: "A booking may be confirmed as paid only after a server-side verified payment-provider event, never from the browser redirect alone"; contract late-payment rule; OUR CHOICE] The only writer of an online payment result, reached only from the payment callback after it has verified the provider signature, and callable only by the service role.

A PAYMENT ONLY CONFIRMS THE BOOKING IT WAS TAKEN FOR. A declined payment retries against the same booking, and a retry may change the guests, the time or the price. A success for an earlier attempt — one with a newer attempt on the booking, or whose amount no longer equals the booking''s total — therefore never confirms it: the money goes to an automatic pending refund, and the booking and the guest''s current hold are left alone for the attempt still in progress.

IDEMPOTENCY. The payment_events insert is the signal: a delivery already seen is a no-op that reports the current state. A success that follows a decline on the same, still current attempt is processed as a success, because money has moved.

A SUCCESS NEVER REVIVES A CLOSED BOOKING. A terminal booking or a voided payment keeps its status, and the money goes to a pending refund.

A HELD SUITE TAKEN OUT OF USE IS NOT CONFIRMED; the booking is allocated through allocate_suite instead. Only a hold for this booking''s own visit time is ever released.

NO SUITE, OR NO USABLE BOOKING: CONTROLLED REFUND. The payment is recorded as paid, the booking moves to awaiting_recovery with no suite, and a pending refund is created with no requested_by. The detectors raise payment_without_suite and refund_pending from that state until Management confirms the return; an automatic refund cannot be withdrawn.';

comment on function public.guest_payment_for_verification(uuid, uuid) is
  '[OUR CHOICE] The guest''s own pending payment, for the simulator to settle. Only an attempt with no result yet is returned, so a guest cannot replay a payment that was already declined, cancelled or settled.';
