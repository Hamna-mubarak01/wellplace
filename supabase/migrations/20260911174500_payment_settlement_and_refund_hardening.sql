create function internal.opaque_reference(p_prefix text, p_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select p_prefix || upper(translate(p_id::text, '0123456789-', 'GHJKLMNPQR'))
$$;

revoke all on function internal.opaque_reference(text, uuid) from public, anon, authenticated;

comment on function internal.opaque_reference(text, uuid) is
  '[OUR CHOICE] Letters-only provider references. payments_provider_reference_carries_no_card rejects fifteen consecutive digits or a 4-4-4-n digit pattern, and a UUID written with its dashes contains the second often enough that about 1 in 300 simulated settlements failed the check and left the guest waiting forever. Every digit is mapped to a letter and the dashes are dropped, so the reference cannot resemble a card number at all.';

alter table public.payments add column tax_fils integer not null default 0;
alter table public.payments add constraint payments_tax_non_negative check (tax_fils >= 0);

with money as (
  select
    p.id,
    p.amount_fils,
    coalesce((a.snapshot -> 'breakdown' ->> 'taxFils')::integer, b.tax_fils) as booking_tax,
    coalesce((a.snapshot -> 'breakdown' ->> 'totalFils')::integer, b.total_fils) as booking_gross,
    sum(p.amount_fils) over (partition by p.booking_id order by p.recorded_at, p.id) as paid_through,
    coalesce(sum(p.amount_fils) over (
      partition by p.booking_id order by p.recorded_at, p.id
      rows between unbounded preceding and 1 preceding), 0) as paid_before
  from public.payments p
  join public.bookings b on b.id = p.booking_id
  left join internal.checkout_attempts a on a.payment_id = p.id
  where p.status in ('paid', 'partially_refunded', 'fully_refunded')
)
update public.payments p
   set tax_fils = case
     when m.booking_gross > 0 then least(m.amount_fils, greatest(0,
         round(m.booking_tax::numeric * least(m.paid_through, m.booking_gross) / m.booking_gross)::integer
       - round(m.booking_tax::numeric * least(m.paid_before, m.booking_gross) / m.booking_gross)::integer))
     else 0 end
  from money m
 where m.id = p.id;

alter table public.payments add constraint payments_tax_within_amount check (tax_fils <= amount_fils);

comment on column public.payments.tax_fils is
  '[CLIENT pricing specification: 5% VAT included; OUR CHOICE] The VAT carried by this payment, frozen when the payment first takes money. It is apportioned cumulatively across the booking''s money-taking payments, so the payments of a fully paid booking sum to the booking''s VAT exactly. Freezing it is what stops a later manual price change from rewriting the VAT on money already taken, and every refund credits VAT from this value rather than from the booking''s current figures.';

create function internal.assign_payment_tax()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tax    integer;
  v_gross  integer;
  v_before bigint;
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

  select coalesce(sum(p.amount_fils), 0)
    into v_before
    from public.payments p
   where p.booking_id = new.booking_id
     and p.id <> new.id
     and p.status in ('paid', 'partially_refunded', 'fully_refunded');

  new.tax_fils := case
    when coalesce(v_gross, 0) > 0 then least(new.amount_fils, greatest(0,
        round(v_tax::numeric * least(v_before + new.amount_fils, v_gross) / v_gross)::integer
      - round(v_tax::numeric * least(v_before, v_gross) / v_gross)::integer))
    else 0 end;
  return new;
end
$$;

revoke all on function internal.assign_payment_tax() from public, anon, authenticated;

create trigger payments_assign_tax
  before insert or update of status on public.payments
  for each row execute function internal.assign_payment_tax();

comment on function internal.assign_payment_tax() is
  '[OUR CHOICE] Freezes a payment''s VAT the first time it takes money, for desk and online payments alike, so record_booking_payment and the guest settlement need no change. A payment already carrying money keeps its value when it moves on to partially or fully refunded.';

alter table public.refunds
  add column withdrawn_at timestamptz,
  add column withdrawn_by uuid references public.staff(id),
  add column withdrawal_reason text;

alter table public.refunds add constraint refunds_withdrawn_is_stopped
  check (withdrawn_at is null or (not is_pending and settled_at is null));
alter table public.refunds add constraint refunds_withdrawal_reason_length
  check (withdrawal_reason is null or length(btrim(withdrawal_reason)) between 1 and 500);

comment on column public.refunds.withdrawn_at is
  '[OUR CHOICE] Set when staff withdraw a refund request that never left WellPlace. A withdrawn refund is not pending and not settled, frees its amount back to the refundable balance, and is kept for the audit trail rather than deleted.';

drop policy refunds_select_reception on public.refunds;

create or replace function public.request_payment_refund(
  p_payment_id  uuid,
  p_amount_fils integer,
  p_reason      text,
  p_request_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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

  v_tax := case
    when p.amount_fils > 0 then greatest(0, least(p.tax_fils,
        round(p.tax_fils::numeric * (v_refunded + p_amount_fils) / p.amount_fils)::integer) - v_prior_tax::integer)
    else 0 end;

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
$$;

comment on function public.request_payment_refund(uuid, integer, text, uuid) is
  '[Project owner''s direction, 11 September 2026; contract: payments, receipts, refunds] Any active staff member may request a refund, per the project owner''s instruction that Reception process refunds from its own console. The payment row is locked first and the ceiling sums every refund that has not been withdrawn, pending and settled alike. VAT is credited cumulatively from the VAT frozen on the payment, so a full refund reverses it exactly and a series of partial refunds never overshoots. A simulated refund settles at once and the refund_settlement_status trigger moves the payment on; a live one stays pending until the provider confirms it.';

create function public.withdraw_refund_request(p_refund_id uuid, p_reason text)
returns table (refund_id uuid, payment_id uuid, booking_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment uuid;
  r         public.refunds%rowtype;
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

  perform 1 from public.payments pm where pm.id = v_payment for update;
  select * into r from public.refunds rf where rf.id = p_refund_id for update;

  if not r.is_pending or r.settled_at is not null or r.withdrawn_at is not null then
    raise exception 'Only a refund that is still pending can be withdrawn.' using errcode = 'WP066';
  end if;

  update public.refunds rf
     set is_pending = false,
         withdrawn_at = now(),
         withdrawn_by = internal.current_staff_id(),
         withdrawal_reason = btrim(p_reason)
   where rf.id = r.id;

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

revoke all on function public.withdraw_refund_request(uuid, text) from public, anon;
grant execute on function public.withdraw_refund_request(uuid, text) to authenticated, service_role;

comment on function public.withdraw_refund_request(uuid, text) is
  '[OUR CHOICE] Withdraws a refund request that has not been settled, for example when staff re-accommodate a guest instead of refunding them. Before this existed, confirm_refund_return was the only way to close a pending refund, so a mistaken request reserved its amount forever and kept the refund_pending alert open. The payment row is locked before the refund, in the same order as request_payment_refund and record_refund.';

create function public.booking_refunds(p_booking_id uuid)
returns table (
  refund_id    uuid,
  payment_id   uuid,
  amount_fils  integer,
  tax_fils     integer,
  is_pending   boolean,
  requested_at timestamptz,
  settled_at   timestamptz,
  withdrawn_at timestamptz,
  reason       text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not internal.is_staff() then
    raise exception 'Sign in to read this booking.' using errcode = '42501';
  end if;
  return query
    select r.id, r.payment_id, r.amount_fils, r.tax_fils, r.is_pending, r.requested_at, r.settled_at, r.withdrawn_at, r.reason
      from public.refunds r
     where r.booking_id = p_booking_id
     order by r.requested_at, r.id;
end
$$;

revoke all on function public.booking_refunds(uuid) from public, anon;
grant execute on function public.booking_refunds(uuid) to authenticated, service_role;

comment on function public.booking_refunds(uuid) is
  '[Contract: "Reception cannot see confidential Management figures without explicit permission"; OUR CHOICE] The refunds of ONE booking, for the staff member handling that booking. The refund ledger as a whole stays behind view_confidential_figures through refunds_select_confidential: the contract names refunds among the Management figures, and the refunds_select_reception policy that opened every refund to every staff member has been dropped. Knowing what has already been refunded on the booking in front of you is operational, and Reception cannot refund safely without it.';

create or replace function internal.update_settled_refund_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paid     integer;
  v_returned bigint;
begin
  if new.settled_at is null then
    return new;
  end if;

  select amount_fils into v_paid from public.payments where id = new.payment_id for update;
  select coalesce(sum(amount_fils), 0) into v_returned
    from public.refunds
   where payment_id = new.payment_id and settled_at is not null;

  update public.payments
     set status = case when v_returned >= v_paid then 'fully_refunded'::public.payment_status
                       else 'partially_refunded'::public.payment_status end
   where id = new.payment_id;

  if v_returned >= v_paid then
    update public.bookings
       set status = 'cancelled', suite_id = null, occupancy_id = null
     where id = new.booking_id and status = 'awaiting_recovery';
    if found then
      perform internal.write_audit(
        'close_recovered_booking', 'public.bookings', new.booking_id::text,
        jsonb_build_object('status', 'awaiting_recovery'),
        jsonb_build_object('status', 'cancelled', 'refund_id', new.id),
        'The guest''s payment was refunded in full after no suite could be kept'
      );
    end if;
  end if;
  return new;
end
$$;

comment on function internal.update_settled_refund_status() is
  '[Contract: payments, receipts, refunds; OUR CHOICE] Moves a payment to partially or fully refunded from settled amounts only; a pending or withdrawn request does not claim that money moved. When the full refund of a booking waiting for recovery settles, the booking is closed as cancelled, which also clears its payment_without_suite alert.';

create function internal.release_cancelled_guest_hold()
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
     and oc.is_active;
  return new;
end
$$;

revoke all on function internal.release_cancelled_guest_hold() from public, anon, authenticated;

create trigger bookings_release_guest_hold
  after update of status on public.bookings
  for each row
  when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  execute function internal.release_cancelled_guest_hold();

comment on function internal.release_cancelled_guest_hold() is
  '[Contract: the website must stop offering a slot the moment it is taken or freed; OUR CHOICE] cancel_booking releases bookings.occupancy_id, which is still empty for a guest who has not yet paid, so the guest''s checkout hold used to survive the cancellation and a later payment converted it straight back into a confirmed booking. Releasing the hold here frees the suite at once and leaves nothing for a late payment to convert. A trigger rather than an edit to cancel_booking, whose desk-operator guard position is pinned by reception-operations-boundary.sql.';

alter table internal.checkout_attempts add column receipt_revoked_at timestamptz;

alter table internal.checkout_sessions add constraint checkout_sessions_payload_bounded
  check (pg_column_size(progress) <= 16384 and pg_column_size(consent) <= 16384);

create or replace function public.checkout_revision()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select md5(jsonb_build_array(
    (select jsonb_agg(jsonb_build_array(s.key, s.value) order by s.key)
       from public.settings s
      where s.key like 'tax.%' or s.key like 'fees.%' or s.key like 'pricing.%'),
    (select jsonb_agg(to_jsonb(p) - 'created_at' - 'updated_at' order by p.id) from public.price_rules p),
    (select jsonb_agg(to_jsonb(a) - 'created_at' - 'updated_at' order by a.id) from public.addons a),
    (select jsonb_agg(to_jsonb(c) - 'used_count' - 'created_at' - 'updated_at' order by c.id) from public.promo_codes c),
    (select jsonb_agg(to_jsonb(c) - 'created_at' order by c.promo_code_id, c.addon_id) from public.promo_code_addons c)
  )::text)
$$;

comment on function public.checkout_revision() is
  '[Pricing specification: the complete final amount is shown before payment; OUR CHOICE] Fingerprint of everything that can change what a guest pays: tax, fee and pricing settings, rate rules, add-ons and coupons. It used to hash every settings row including updated_at, so saving any setting at all, even the WhatsApp number, told every guest mid-checkout that prices had changed. Guest rules and opening hours are re-checked separately when payment starts, so they are not part of the price fingerprint.';

CREATE OR REPLACE FUNCTION public.prepare_guest_payment(p_token uuid, p_request_id uuid, p_quote jsonb, p_revision text, p_currency text, p_simulated boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 s internal.checkout_sessions%rowtype; a internal.checkout_attempts%rowtype;
 o public.suite_occupancy%rowtype; c public.customers%rowtype; v public.promo_codes%rowtype;
 identity jsonb; choice jsonb; price jsonb; previous_booking jsonb; bid uuid; pid uuid; occupied integer; customer_uses integer;
 today date := (now() at time zone 'Asia/Dubai')::date;
begin
 perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);
 select * into s from internal.checkout_sessions where token=p_token for update;
 if not found then raise exception 'Your booking session expired. Please enter your details again.' using errcode='WP062'; end if;
 select * into a from internal.checkout_attempts where request_id=p_request_id;
 if found then
   if a.token<>p_token then raise exception 'This payment does not belong to your booking.' using errcode='WP062'; end if;
   return jsonb_build_object('paymentId',a.payment_id,'amountFils',(a.snapshot->'breakdown'->>'totalFils')::integer,'currency',a.currency,'expiresAt',a.reservation_expires_at,'simulated',p_simulated);
 end if;
 if exists(select 1 from internal.checkout_attempts where token=p_token and result in ('confirmed','refunded')) then
   raise exception 'This booking is already complete. Open your receipt before starting another booking.' using errcode='WP062'; end if;
 if exists(select 1 from internal.checkout_attempts where token=p_token and result is null and reservation_expires_at>now()) then
   raise exception 'A payment is already waiting. Return to the payment step to finish it.' using errcode='WP062'; end if;
 perform 1 from public.settings order by key for share;
 perform 1 from public.price_rules order by id for share;
 perform 1 from public.addons order by id for share;
 perform 1 from public.promo_codes order by id for update;
 if p_revision is distinct from public.checkout_revision() then
   raise exception 'Prices or offers have changed. Review the updated total before paying.' using errcode='WP063'; end if;
 if p_currency<>'AED' or p_quote->'breakdown'->>'outcome'<>'priced' then raise exception 'Your price could not be verified.' using errcode='WP063'; end if;
 if s.progress is distinct from p_quote->'progress' then raise exception 'Your booking changed in another window. Review the details before paying.' using errcode='WP062'; end if;
 identity:=s.progress->'identity'; choice:=s.progress->'selection'; price:=p_quote->'breakdown';
 select oc.* into o from internal.guest_checkout_holds h join public.suite_occupancy oc on oc.id=h.occupancy_id where h.token=p_token for update of oc;
 if o.id is null or not o.is_active or o.expires_at<=clock_timestamp() or o.kind<>'hold'
   or lower(o.experience_period) is distinct from (choice->>'startsAt')::timestamptz
   or upper(o.experience_period) is distinct from (choice->>'startsAt')::timestamptz+make_interval(hours=>(choice->>'durationHours')::integer) then
   raise exception 'Your time hold has expired. Choose an available time before paying.' using errcode='WP062'; end if;
 select * into c from public.customers where identity_key=internal.normalise_email(identity->>'email') for update;
 if c.id is null then
   insert into public.customers(salutation,first_name,last_name,email,date_of_birth,phone_e164,phone_country)
   values((identity->>'salutation')::public.salutation,identity->>'firstName',identity->>'lastName',identity->>'email',(identity->>'dateOfBirth')::date,identity->>'phoneE164',identity->>'phoneCountry')
   on conflict(identity_key) do update set last_interaction_at=now() returning * into c;
 end if;
 if c.is_blocked then raise exception 'Please contact WellPlace to arrange this booking.' using errcode='WP062'; end if;
 update public.customers set last_interaction_at=now() where id=c.id;
 if nullif(choice->>'voucherCode','') is not null then
   select * into v from public.promo_codes where code=upper(choice->>'voucherCode') for update;
   if v.id is null or not v.is_active or today< v.valid_from or today>v.valid_to then
     raise exception 'This coupon is no longer valid. Remove it or enter another code.' using errcode='WP064'; end if;
   select count(*),count(*) filter(where b.customer_id=c.id) into occupied,customer_uses
   from internal.checkout_attempts ca join public.bookings b on b.id=ca.booking_id
   where ca.promo_id=v.id and ca.result is null and ca.reservation_expires_at>now();
   customer_uses:=customer_uses+(select count(*) from public.promo_code_redemptions r where r.promo_code_id=v.id and r.customer_id=c.id);
   if (v.max_uses is not null and v.used_count+occupied>=v.max_uses) or (v.per_customer_limit is not null and customer_uses>=v.per_customer_limit) then
     raise exception 'This coupon has reached its usage limit. Remove it or enter another code.' using errcode='WP064'; end if;
 end if;
 select ca.booking_id,to_jsonb(previous) into bid,previous_booking from internal.checkout_attempts ca join public.bookings previous on previous.id=ca.booking_id
 where ca.token=p_token and ca.result in ('failed','cancelled') and previous.status='payment_failed'
   and previous.is_simulated=p_simulated
   and not exists(select 1 from public.payments history where history.booking_id=previous.id and history.status not in ('failed','cancelled'))
 order by ca.created_at desc limit 1 for update of previous;
 if bid is null then
 insert into public.bookings(reference,customer_id,suite_id,source,status,experience_period,cleaning_buffer_minutes,personal_request,
 subtotal_fils,discount_fils,addons_fils,service_fee_fils,tax_fils,total_fils,is_simulated)
 values(internal.next_booking_reference(),c.id,o.suite_id,'online','awaiting_payment',o.experience_period,o.cleaning_buffer_minutes,nullif(choice->>'personalRequest',''),
 (price->>'subtotalFils')::integer,(price->>'discountFils')::integer,(price->>'addonsTotalFils')::integer,(price->>'serviceFeeFils')::integer,(price->>'taxFils')::integer,(price->>'totalFils')::integer,p_simulated) returning id into bid;
 else
   update public.bookings set status='awaiting_payment',customer_id=c.id,suite_id=o.suite_id,experience_period=o.experience_period,cleaning_buffer_minutes=o.cleaning_buffer_minutes,
     personal_request=nullif(choice->>'personalRequest',''),subtotal_fils=(price->>'subtotalFils')::integer,discount_fils=(price->>'discountFils')::integer,
     addons_fils=(price->>'addonsTotalFils')::integer,service_fee_fils=(price->>'serviceFeeFils')::integer,tax_fils=(price->>'taxFils')::integer,total_fils=(price->>'totalFils')::integer where id=bid;
   delete from public.booking_guests where booking_id=bid;
   delete from public.booking_addons where booking_id=bid;
 end if;
 insert into public.booking_guests(booking_id,kind) select bid,'adult' from generate_series(1,(choice->>'adults')::integer);
 insert into public.booking_guests(booking_id,kind,age) select bid,'child',value::integer from jsonb_array_elements_text(choice->'childAges');
 insert into public.booking_addons(booking_id,addon_id,name_snapshot,unit_price_fils,quantity,regular_price_fils,is_included,is_locked,voucher_code)
 select bid,(l->>'id')::uuid,l->>'name',(l->>'unitPriceFils')::integer,(l->>'quantity')::integer,(l->>'regularUnitPriceFils')::integer,
 (l->>'unitPriceFils')::integer=0,coalesce((l->>'isLocked')::boolean,false),nullif(choice->>'voucherCode','') from jsonb_array_elements(p_quote->'cart') l;
 insert into public.acceptance_records(booking_id,accepted_at,source,document_slug,document_version,checkbox_text)
 select bid,s.consent_accepted_at,'online',d->>'document_slug',d->>'document_version',d->>'checkbox_text' from jsonb_array_elements(s.consent) d on conflict (booking_id,document_slug) do nothing;
 insert into public.payments(booking_id,status,method,amount_fils,service_fee_fils,is_simulated,note)
 values(bid,'pending','online',(price->>'totalFils')::integer,(price->>'serviceFeeFils')::integer,p_simulated,case when p_simulated then 'Simulation — no money charged' else null end) returning id into pid;
 insert into internal.checkout_attempts(token,request_id,booking_id,payment_id,snapshot,currency,payment_option,promo_id,reservation_expires_at)
 values(p_token,p_request_id,bid,pid,p_quote||jsonb_build_object('progress',s.progress),p_currency,choice->>'paymentOption',v.id,o.expires_at);
 perform internal.write_audit('prepare_guest_payment','public.bookings',bid::text,previous_booking,jsonb_build_object('payment_id',pid,'total_fils',price->'totalFils','simulated',p_simulated),'Guest checkout');
 return jsonb_build_object('paymentId',pid,'amountFils',(price->>'totalFils')::integer,'currency',p_currency,'expiresAt',o.expires_at,'simulated',p_simulated);
end $function$;


comment on function public.prepare_guest_payment(uuid, uuid, jsonb, text, text, boolean) is
  '[Contract: payments; pricing specification; OUR CHOICE] A declined or cancelled payment retries against its original booking reference, and each attempt keeps its own immutable quote and provider result; the original hold expiry is never extended. A hold keeps the cleaning buffer it was taken with: the check that refused a hold whose buffer no longer matched cleaning.buffer_minutes is removed, because a changed default applies to new claims only, and it blocked a declined guest from retrying until their hold expired.';

drop function public.settle_guest_payment(uuid, uuid, text, text, integer, text);

create function public.settle_payment_event(
  p_provider           text,
  p_event_id           text,
  p_payment_id         uuid,
  p_outcome            text,
  p_amount_fils        integer,
  p_currency           text,
  p_signature_verified boolean,
  p_payload            jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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

  v_reference := case
    when p.is_simulated then internal.opaque_reference('SIM-', p.id)
    else coalesce(nullif(btrim(p_payload ->> 'transactionReference'), ''), p.provider_reference)
  end;

  if p_outcome = 'success' then
    v_terminal := b.status in ('cancelled', 'completed', 'no_show', 'rescheduled', 'abandoned');

    if v_terminal or p.status = 'cancelled' then
      v_failure := 'This booking was cancelled before the payment completed.';
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
        if o.id is not null and o.is_active and o.kind = 'hold' then
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
       where h.token = a.token and oc.id = h.occupancy_id and oc.kind = 'hold' and oc.is_active;

      if not v_terminal and b.status <> 'confirmed' then
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
    update public.bookings set status = 'payment_failed' where id = b.id and status in ('held', 'awaiting_payment');
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
$$;

revoke all on function public.settle_payment_event(text, text, uuid, text, integer, text, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.settle_payment_event(text, text, uuid, text, integer, text, boolean, jsonb) to service_role;

comment on function public.settle_payment_event(text, text, uuid, text, integer, text, boolean, jsonb) is
  '[Contract: "A booking may be confirmed as paid only after a server-side verified payment-provider event, never from the browser redirect alone"; §8.2 late payment; OUR CHOICE] The only writer of an online payment result, reached only from the payment callback route after it has verified the provider signature, and callable only by the service role.

IDEMPOTENCY. The payment_events insert is the signal: a delivery whose (provider, provider_event_id) has been seen is a no-op that reports the current state. A success that follows a decline on the same payment is not dropped — it is processed as a success, because money has moved.

A SUCCESS NEVER REVIVES A CLOSED BOOKING. If the booking reached a terminal status, or the payment was voided, before the money arrived, the booking is left as it is and the full amount goes to a pending refund.

A HELD SUITE TAKEN OUT OF USE IS NOT CONFIRMED. If the guest''s hold is on a suite that is now blocked, under maintenance, not ready or out of service, the hold is released and the booking is allocated through allocate_suite, which never auto-allocates those suites.

NO SUITE, OR NO USABLE BOOKING: CONTROLLED REFUND. The payment is recorded as paid, the booking moves to awaiting_recovery with no suite, and a pending refund is created for the full amount. The contract requires an immediate operational alert, informing the guest, and an automatic or controlled refund; the state is chosen so the existing detectors raise payment_without_suite and refund_pending and keep them open until staff confirm the refund or withdraw it to re-accommodate the guest. An alert inserted directly would be resolved by the alert worker within ten seconds, because the worker closes any open alert its detectors no longer see.';

CREATE OR REPLACE FUNCTION internal.detect_operational_alerts(p_now timestamp with time zone)
 RETURNS TABLE(kind alert_kind, severity alert_severity, entity text, entity_id text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with booking_facts as materialized (
    select b.*, payment.status as payment_status
    from public.bookings b
    left join lateral (
      select p.status from public.payments p where p.booking_id = b.id
      order by case p.status when 'manual_review' then 0 when 'paid' then 1 when 'failed' then 2 else 3 end, p.id
      limit 1
    ) payment on true
    where b.status in ('confirmed', 'checked_in', 'awaiting_recovery', 'hold_expired')
  ), detected (kind, entity, entity_id) as (
    select 'payment_without_suite', 'public.bookings', b.id::text from booking_facts b
    where b.payment_status = 'paid' and b.suite_id is null
    union all
    select 'payment_failed', 'public.bookings', b.id::text from booking_facts b where b.payment_status = 'failed'
    union all
    select 'manual_review_pending', 'public.bookings', b.id::text from booking_facts b where b.payment_status = 'manual_review'
    union all
    select 'arrival_overdue', 'public.bookings', b.id::text from booking_facts b
    where b.status = 'confirmed' and b.arrived_at is null
      and extract(epoch from (p_now - lower(b.experience_period))) / 60 >= internal.alert_threshold('reception.arrival_overdue_minutes')
    union all
    select 'message_failed', 'public.messages', m.id::text from public.messages m
    where m.status = 'failed' and m.failed_at is not null
    union all
    select 'refund_pending', 'public.refunds', r.id::text from public.refunds r where r.is_pending
    union all
    select 'upcoming_conflict', 'public.suite_occupancy', o.id::text from public.suite_occupancy o
    where o.is_active and o.kind in ('block', 'maintenance') and lower(o.experience_period) >= p_now
  )
  select d.kind::public.alert_kind, internal.alert_severity(d.kind::public.alert_kind), d.entity, d.entity_id
  from detected d
$function$;

comment on function internal.detect_operational_alerts(timestamptz) is
  '[§9.3 alerts; OUR CHOICE] One snapshot of every alert condition. A booking''s payment status now ranks paid above failed: a declined payment retries against the same booking, so a guest who was declined once and then paid carries both rows, and ranking failed first raised a permanent payment_failed alert on a confirmed, fully paid booking. Manual review still outranks everything.';

drop function public.guest_receipt(uuid);

create function public.guest_receipt(p_receipt_token uuid, p_valid_days integer)
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
       where r.payment_id = p.id and r.withdrawn_at is null), '[]'::jsonb))
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

revoke all on function public.guest_receipt(uuid, integer) from public, anon, authenticated;
grant execute on function public.guest_receipt(uuid, integer) to service_role;

comment on function public.guest_receipt(uuid, integer) is
  '[Contract: "receive confirmation plus a secure management link"; INV-25 opaque, expiring, revocable guest links; ASSUMED lifetime] The receipt behind an opaque token. It stops resolving once the link has been revoked, or once the configured number of days after the visit has passed. The lifetime is passed in from src/lib/config/receipt.ts rather than held in SQL, and is ASSUMED until WellPlace confirms how long a guest should be able to open it. Withdrawn refund requests are not shown.';

create function public.revoke_receipt_link(p_booking_id uuid, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not internal.is_staff() then
    raise exception 'Sign in to change this booking.' using errcode = '42501';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 1 and 500 then
    raise exception 'Enter a reason of up to 500 characters.' using errcode = '22023';
  end if;

  update internal.checkout_attempts
     set receipt_revoked_at = now()
   where booking_id = p_booking_id and receipt_revoked_at is null;
  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise exception 'This booking has no active receipt link.' using errcode = 'P0002';
  end if;

  perform internal.write_audit(
    'revoke_receipt_link', 'public.bookings', p_booking_id::text,
    jsonb_build_object('receipt_link', 'active'),
    jsonb_build_object('receipt_link', 'revoked', 'attempts', v_count),
    p_reason
  );
  return v_count;
end
$$;

revoke all on function public.revoke_receipt_link(uuid, text) from public, anon;
grant execute on function public.revoke_receipt_link(uuid, text) to authenticated, service_role;

comment on function public.revoke_receipt_link(uuid, text) is
  '[INV-25 revocable guest links; OUR CHOICE] Stops a booking''s receipt link from opening, for example when a guest reports that it was forwarded to the wrong person. It is deliberately not triggered by a cancellation: a cancelled guest still needs the receipt to see their refund.';

drop function public.checkout_funnel(integer);

create function public.checkout_funnel(p_abandoned_minutes integer, p_limit integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform internal.require_management();
  if p_limit is null or p_limit < 1 then
    raise exception 'Choose how many checkouts to show.' using errcode = '22023';
  end if;
  return coalesce((
    select jsonb_agg(t order by t.updated_at desc)
      from (
        select s.report_id,
               s.progress -> 'identity' ->> 'firstName' as first_name,
               s.progress -> 'identity' ->> 'lastName' as last_name,
               s.progress -> 'identity' ->> 'email' as email,
               case when exists (select 1 from internal.checkout_attempts a where a.token = s.token and a.result = 'confirmed')
                    then 'payment' else s.progress ->> 'lastCompletedStep' end as last_step,
               s.progress -> 'selection' as selection,
               s.recovered,
               s.updated_at,
               case when exists (select 1 from internal.checkout_attempts a where a.token = s.token and a.result = 'confirmed') then 'booked'
                    when s.updated_at < now() - make_interval(mins => p_abandoned_minutes) then 'abandoned'
                    else 'in_progress' end as status
          from internal.checkout_sessions s
         order by s.updated_at desc
         limit p_limit
      ) t
  ), '[]'::jsonb);
end
$$;

revoke all on function public.checkout_funnel(integer, integer) from public, anon;
grant execute on function public.checkout_funnel(integer, integer) to authenticated, service_role;

comment on function public.checkout_funnel(integer, integer) is
  '[CLIENT booking offers detail: incomplete bookings; OUR CHOICE] Management''s view of saved checkouts: the last completed step, the selections, whether the guest came back, and booked / abandoned / in progress, which are the client''s own suggested names. The row cap is passed in from src/lib/config/checkout-flow.ts.';

comment on column public.payments.is_simulated is
  '[Project owner''s direction, 11 September 2026; OUR CHOICE] No money moves. Simulated payments are kept apart from live revenue and can be settled only through the signed payment callback.';

comment on function public.save_checkout_coupon(jsonb, timestamptz) is
  '[CLIENT pricing specification §8: voucher codes and their Management controls] Audited Management coupon controls with inclusive Dubai dates and optimistic concurrency. A used code keeps its code and discount type.';

comment on function internal.guard_coupon_reservation() is
  '[CLIENT pricing specification §8: usage limits] The coupon ceiling enforced at the table itself. Reception redemptions and online reservations share one locked counter, so max_uses and per_customer_limit hold on every insert, not only inside the functions that redeem.';

comment on column public.refunds.tax_fils is
  '[CLIENT pricing specification: 5% VAT included; OUR CHOICE apportionment] The VAT credited by this refund, apportioned cumulatively from the VAT frozen on its payment, so a full refund reverses it exactly.';


create function public.payment_message_context(p_payment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_context jsonb;
begin
  if not internal.is_staff() and not internal.is_worker_session() then
    raise exception 'Sign in to send a booking message.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'paymentId', p.id,
    'bookingId', b.id,
    'customerId', b.customer_id,
    'reference', b.reference,
    'email', c.email,
    'firstName', c.first_name,
    'lastName', c.last_name,
    'startsAt', lower(b.experience_period),
    'endsAt', upper(b.experience_period),
    'adults', (select count(*) from public.booking_guests g where g.booking_id = b.id and g.kind = 'adult'),
    'children', (select count(*) from public.booking_guests g where g.booking_id = b.id and g.kind = 'child'),
    'amountFils', p.amount_fils,
    'taxFils', p.tax_fils,
    'taxLabel', a.snapshot ->> 'taxLabel',
    'simulated', p.is_simulated,
    'result', a.result,
    'holdExpiresAt', a.reservation_expires_at,
    'receiptToken', case when a.result in ('confirmed', 'refunded') and a.receipt_revoked_at is null then a.receipt_token end,
    'refundPendingFils', (select coalesce(sum(r.amount_fils), 0) from public.refunds r where r.payment_id = p.id and r.is_pending),
    'refundSettledFils', (select coalesce(sum(r.amount_fils), 0) from public.refunds r where r.payment_id = p.id and r.settled_at is not null)
  )
    into v_context
    from public.payments p
    join public.bookings b on b.id = p.booking_id
    join public.customers c on c.id = b.customer_id
    left join internal.checkout_attempts a on a.payment_id = p.id
   where p.id = p_payment_id;

  return v_context;
end
$$;

revoke all on function public.payment_message_context(uuid) from public, anon;
grant execute on function public.payment_message_context(uuid) to authenticated, service_role;

comment on function public.payment_message_context(uuid) is
  '[Contract: automatic booking confirmation, payment, failed-payment and refund messages; OUR CHOICE] Everything a guest message about one payment may state, read from stored values only (INV-21) and never re-priced. It carries no suite number or capacity (INV-01). Staff and the payment callback may read it; the guest never calls it.';

comment on function public.save_checkout_progress(uuid, jsonb, jsonb, integer) is
  '[CLIENT booking offers detail: save incomplete bookings once step one and consent are complete; OUR CHOICE: no audit entry] Saves a guest''s checkout only after the terms are accepted. It deliberately writes no audit.entries row: it is a debounced autosave that runs on nearly every keystroke-level change, the guest has no staff identity to record as actor, and the evidence that matters is kept on the row itself — the exact consent wording and its version, consent_accepted_at, and the last completed step. Everything that turns the checkout into a booking, a payment or a refund is audited in its own function.';
