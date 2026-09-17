create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function internal.set_updated_at();

comment on trigger tasks_set_updated_at on public.tasks is
  'Repairs an omission in 20260907093000_create_operations.sql, which gave this trigger to public.cleaning_tasks, public.shift_notes and public.message_templates and missed public.tasks.

Nothing was observably wrong without it. Every write to public.tasks goes through an RPC that sets updated_at explicitly [R-02], so the column has always been correct. That is precisely why it needed fixing rather than leaving: the next person to touch this table has no reason to suspect the one place the convention does not hold, and a task list sorted by recency against a stale column is a defect nobody would think to look for here.

Forward-only [R-11]. The omission is repaired by a new migration, never by editing the one that made it.';


create or replace function public.record_booking_payment(
  p_booking_id         uuid,
  p_method             public.payment_method,
  p_amount_fils        integer,
  p_provider_reference text,
  p_note               text,
  p_reason             text
)
returns table (
  payment_id       uuid,
  booking_id       uuid,
  payment_status   public.payment_status,
  payment_method   public.payment_method,
  amount_fils      integer,
  recorded_by      uuid,
  recorded_at      timestamptz,
  booking_comped   boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking_status public.booking_status;
  v_reference      text;
  v_was_comped     boolean;
  v_is_comped      boolean;
  v_actor          uuid    := internal.current_staff_id();
  v_provider_ref   text    := nullif(btrim(coalesce(p_provider_reference, '')), '');
  v_note           text    := nullif(btrim(coalesce(p_note, '')), '');
  v_payment_id     uuid;
  v_recorded_at    timestamptz;
begin
  if not internal.is_staff() then
    raise exception 'record_booking_payment: an active staff session is required — §9.2 recording is a desk action with a named actor [INV-13]'
      using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'record_booking_payment: a reason is required — every manual change is audited with one [§3, INV-13]'
      using errcode = '22023';
  end if;

  if p_method is null then
    raise exception 'record_booking_payment: p_method is required — §8 reconciles on how the money was taken'
      using errcode = '22004';
  end if;

  if p_method = 'online'::public.payment_method then
    raise exception 'record_booking_payment: an online payment becomes paid on the signature-verified provider webhook and never by hand [§3, §8, INV-08]'
      using errcode = 'WP025';
  end if;

  if p_amount_fils is null then
    raise exception 'record_booking_payment: p_amount_fils is required, in integer fils [R-16]'
      using errcode = '22004';
  end if;

  if p_method = 'complimentary'::public.payment_method and p_amount_fils <> 0 then
    raise exception 'record_booking_payment: a complimentary payment is exactly zero and never counts as revenue, got % [§11.2, INV-20]',
      p_amount_fils
      using errcode = 'WP027';
  end if;

  if p_method <> 'complimentary'::public.payment_method and p_amount_fils <= 0 then
    raise exception 'record_booking_payment: p_amount_fils must be greater than zero for %, got %',
      p_method, p_amount_fils
      using errcode = 'WP026';
  end if;

  select b.status, b.reference, b.is_complimentary
    into v_booking_status, v_reference, v_was_comped
    from public.bookings b
   where b.id = p_booking_id
   for update;

  if v_booking_status is null then
    raise exception 'record_booking_payment: no booking with id %', p_booking_id
      using errcode = 'P0002';
  end if;

  v_is_comped := v_was_comped
                 or p_method = 'complimentary'::public.payment_method;

  insert into public.payments as p (
    booking_id,
    status,
    method,
    amount_fils,
    provider_reference,
    note,
    recorded_by
  )
  values (
    p_booking_id,
    'paid'::public.payment_status,
    p_method,
    p_amount_fils,
    v_provider_ref,
    v_note,
    v_actor
  )
  returning p.id, p.recorded_at
       into v_payment_id, v_recorded_at;

  if v_is_comped and not v_was_comped then
    update public.bookings b
       set is_complimentary = true
     where b.id = p_booking_id;
  end if;

  perform internal.write_audit(
    'record_booking_payment',
    'public.payments',
    v_payment_id::text,
    null::jsonb,
    jsonb_build_object(
      'booking_id',         p_booking_id,
      'booking_reference',  v_reference,
      'booking_status',     v_booking_status,
      'status',             'paid',
      'method',             p_method,
      'amount_fils',        p_amount_fils,
      'provider_reference', v_provider_ref,
      'note',               v_note,
      'recorded_by',        v_actor,
      'recorded_at',        v_recorded_at
    ),
    p_reason
  );

  if v_is_comped and not v_was_comped then
    perform internal.write_audit(
      'record_booking_payment',
      'public.bookings',
      p_booking_id::text,
      jsonb_build_object('is_complimentary', v_was_comped),
      jsonb_build_object(
        'is_complimentary', true,
        'reference',        v_reference,
        'payment_id',       v_payment_id
      ),
      p_reason
    );
  end if;

  payment_id     := v_payment_id;
  booking_id     := p_booking_id;
  payment_status := 'paid'::public.payment_status;
  payment_method := p_method;
  amount_fils    := p_amount_fils;
  recorded_by    := v_actor;
  recorded_at    := v_recorded_at;
  booking_comped := v_is_comped;
  return next;
end
$$;


create or replace function public.void_booking_payment(
  p_payment_id uuid,
  p_reason     text
)
returns table (
  payment_id      uuid,
  booking_id      uuid,
  payment_status  public.payment_status,
  previous_status public.payment_status,
  amount_fils     integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking_id uuid;
  v_status     public.payment_status;
  v_method     public.payment_method;
  v_amount     integer;
begin
  if not internal.is_staff() then
    raise exception 'void_booking_payment: an active staff session is required [§9.2, INV-13]'
      using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'void_booking_payment: a reason is required — every manual change is audited with one [§3, INV-13]'
      using errcode = '22023';
  end if;

  select p.booking_id, p.status, p.method, p.amount_fils
    into v_booking_id, v_status, v_method, v_amount
    from public.payments p
   where p.id = p_payment_id
   for update;

  if v_booking_id is null then
    raise exception 'void_booking_payment: no payment with id %', p_payment_id
      using errcode = 'P0002';
  end if;

  if v_status = 'cancelled'::public.payment_status then
    raise exception 'void_booking_payment: payment % was already cancelled [§8]', p_payment_id
      using errcode = 'WP028';
  end if;

  if v_status in (
    'paid'::public.payment_status,
    'partially_refunded'::public.payment_status,
    'fully_refunded'::public.payment_status
  ) then
    raise exception 'void_booking_payment: a payment in % has taken money and is undone by a refund with an amount and a reason, never by a status flip [§8, §11.2, §4.3]',
      v_status
      using errcode = 'WP028';
  end if;

  update public.payments p
     set status = 'cancelled'::public.payment_status
   where p.id = p_payment_id;

  perform internal.write_audit(
    'void_booking_payment',
    'public.payments',
    p_payment_id::text,
    jsonb_build_object(
      'status',      v_status,
      'method',      v_method,
      'amount_fils', v_amount,
      'booking_id',  v_booking_id
    ),
    jsonb_build_object(
      'status',      'cancelled',
      'method',      v_method,
      'amount_fils', v_amount,
      'booking_id',  v_booking_id
    ),
    p_reason
  );

  payment_id      := p_payment_id;
  booking_id      := v_booking_id;
  payment_status  := 'cancelled'::public.payment_status;
  previous_status := v_status;
  amount_fils     := v_amount;
  return next;
end
$$;


create or replace function public.record_refund(
  p_payment_id  uuid,
  p_amount_fils integer,
  p_reason      text
)
returns table (
  refund_id           uuid,
  payment_id          uuid,
  booking_id          uuid,
  amount_fils         integer,
  refunded_total_fils integer,
  payment_amount_fils integer,
  payment_status      public.payment_status,
  is_pending          boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
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
   where r.payment_id = p_payment_id;

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
    reason,
    requested_by
  )
  values (
    p_payment_id,
    v_booking_id,
    p_amount_fils,
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
$$;


create or replace function public.set_manual_booking_price(
  p_booking_id uuid,
  p_total_fils integer,
  p_reason     text
)
returns table (
  booking_id          uuid,
  reference           text,
  total_fils          integer,
  previous_total_fils integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reference  text;
  v_old_total  integer;
  v_status     public.booking_status;
  v_subtotal   integer;
  v_discount   integer;
  v_addons     integer;
  v_service    integer;
  v_tax        integer;
begin
  if not internal.has_permission('manual_price_change'::public.named_permission) then
    raise exception 'set_manual_booking_price: a manual price change needs perm:manual_price_change, and §6.4 requires it of Management too [docs/5 §2]'
      using errcode = 'WP031';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'set_manual_booking_price: a reason is required — §6.4 names permission, a reason and an audit entry together'
      using errcode = '22023';
  end if;

  if p_total_fils is null then
    raise exception 'set_manual_booking_price: p_total_fils is required, in integer fils [R-16]'
      using errcode = '22004';
  end if;

  if p_total_fils < 0 then
    raise exception 'set_manual_booking_price: p_total_fils must be zero or more, got %',
      p_total_fils
      using errcode = 'WP026';
  end if;

  select b.reference, b.status, b.total_fils,
         b.subtotal_fils, b.discount_fils, b.addons_fils,
         b.service_fee_fils, b.tax_fils
    into v_reference, v_status, v_old_total,
         v_subtotal, v_discount, v_addons,
         v_service, v_tax
    from public.bookings b
   where b.id = p_booking_id
   for update;

  if v_reference is null then
    raise exception 'set_manual_booking_price: no booking with id %', p_booking_id
      using errcode = 'P0002';
  end if;

  update public.bookings b
     set total_fils = p_total_fils
   where b.id = p_booking_id;

  perform internal.write_audit(
    'set_manual_booking_price',
    'public.bookings',
    p_booking_id::text,
    jsonb_build_object(
      'total_fils', v_old_total,
      'reference',  v_reference,
      'status',     v_status
    ),
    jsonb_build_object(
      'total_fils',       p_total_fils,
      'reference',        v_reference,
      'status',           v_status,
      'subtotal_fils',    v_subtotal,
      'discount_fils',    v_discount,
      'addons_fils',      v_addons,
      'service_fee_fils', v_service,
      'tax_fils',         v_tax
    ),
    p_reason
  );

  booking_id          := p_booking_id;
  reference           := v_reference;
  total_fils          := p_total_fils;
  previous_total_fils := v_old_total;
  return next;
end
$$;


create or replace function public.set_payment_method_fee(
  p_method         public.payment_method,
  p_is_enabled     boolean,
  p_percent        numeric,
  p_customer_label text,
  p_reason         text
)
returns table (
  method         public.payment_method,
  is_enabled     boolean,
  percent        numeric,
  customer_label text,
  updated_at     timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_label       text := nullif(btrim(coalesce(p_customer_label, '')), '');
  v_existed     boolean;
  v_was_enabled boolean;
  v_was_percent numeric;
  v_was_label   text;
  v_now_enabled boolean;
  v_now_percent numeric;
  v_now_label   text;
  v_updated     timestamptz;
  v_actor       uuid := internal.current_staff_id();
begin
  if not internal.is_management() then
    raise exception 'set_payment_method_fee: configuring §8.1 is Management only — docs/5 §3, "configure prices, promo codes, add-ons: reception no"'
      using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'set_payment_method_fee: a reason is required — §8.1 requires every change to be logged [INV-13]'
      using errcode = '22023';
  end if;

  if p_method is null then
    raise exception 'set_payment_method_fee: p_method is required — §8.1 configures the charge per payment method'
      using errcode = '22004';
  end if;

  if p_is_enabled is null then
    raise exception 'set_payment_method_fee: p_is_enabled is required — §8.1 gives Management a visible on and a complete off, and a boolean has no third value meaning unchanged'
      using errcode = '22004';
  end if;

  if p_percent is null then
    raise exception 'set_payment_method_fee: p_percent is required [§8.1]'
      using errcode = '22004';
  end if;

  if p_percent < 0 or p_percent > 100 then
    raise exception 'set_payment_method_fee: p_percent must be between 0 and 100, got %',
      p_percent
      using errcode = 'WP032';
  end if;

  if v_label is null then
    raise exception 'set_payment_method_fee: a customer-facing label is required — §8.1 puts this line in front of a guest and §5.5 refuses to tell them nothing'
      using errcode = '22023';
  end if;

  select true, f.is_enabled, f.percent, f.customer_label
    into v_existed, v_was_enabled, v_was_percent, v_was_label
    from public.payment_method_fees f
   where f.method = p_method
   for update;

  insert into public.payment_method_fees as f (
    method,
    is_enabled,
    percent,
    customer_label,
    updated_by
  )
  values (
    p_method,
    p_is_enabled,
    p_percent,
    v_label,
    v_actor
  )
  on conflict on constraint payment_method_fees_pkey do update
     set is_enabled     = excluded.is_enabled,
         percent        = excluded.percent,
         customer_label = excluded.customer_label,
         updated_by     = excluded.updated_by
  returning f.is_enabled, f.percent, f.customer_label, f.updated_at
       into v_now_enabled, v_now_percent, v_now_label, v_updated;

  perform internal.write_audit(
    'set_payment_method_fee',
    'public.payment_method_fees',
    p_method::text,
    case when coalesce(v_existed, false)
      then jsonb_build_object(
             'is_enabled',     v_was_enabled,
             'percent',        v_was_percent,
             'customer_label', v_was_label
           )
      else null::jsonb
    end,
    jsonb_build_object(
      'method',         p_method,
      'is_enabled',     v_now_enabled,
      'percent',        v_now_percent,
      'customer_label', v_now_label,
      'updated_by',     v_actor
    ),
    p_reason
  );

  method         := p_method;
  is_enabled     := v_now_enabled;
  percent        := v_now_percent;
  customer_label := v_now_label;
  updated_at     := v_updated;
  return next;
end
$$;


comment on function public.record_booking_payment(uuid, public.payment_method, integer, text, text, text) is
  'Record a payment taken at the desk [§8, §9.2]. §9.2 names the action verbatim: "record cash, card terminal, payment link, online payment and complimentary".

IT REFUSES p_method = ''online'' WITH WP025, and that refusal is why the method is an argument at all. §3 and INV-08 are absolute - a booking is paid only after a server-verified webhook, never from a browser redirect - so an online payment reaches public.payments through the provider handler and through nothing else. Letting Reception mark one paid by hand would drive a hole straight through INV-08 that nothing above this layer could see, because the row would be indistinguishable from a settled one. The webhook, its signature check and the §8.2 recovery flow are a separate plan; this function is deliberately blind to them and consumes nothing from public.payment_events.

EVERYTHING ELSE IT RECORDS BECOMES paid IMMEDIATELY, and that is not a contradiction of INV-08. Cash and a card terminal produce no callback for anybody to verify. The receptionist who took the notes, or who watched the terminal approve, IS the verification, and the audit entry names them [INV-13]. payment_link is permitted because §8 lists it as a Reception action: what this row records is a link that was settled out of band and is being written down after the event. §8''s rule that an open payment link is not yet earned is a statement about an OPEN link, and this row is not one.

A complimentary payment must be exactly zero - WP027 - and it also sets public.bookings.is_complimentary. §11.2 and INV-20 keep complimentary bookings separate and out of every revenue figure, and a comped visit recorded only as a zero payment row would still be counted as a paying booking by any report that reads the booking rather than the payment. Every other method must be above zero, WP026, because a zero cash payment is not a payment.

p_provider_reference IS A REFERENCE OR A TOKEN AND NEVER A CARD NUMBER. §13 is absolute that no complete card data is held anywhere in this application - not a PAN, not a CVV, not an expiry, not here and not in p_note. payments_provider_reference_carries_no_card is the database tripwire and it is deliberately NOT restated in this body: one copy of a pattern cannot drift from another copy, and a shape rule has no race to lose, so the constraint is the whole enforcement rather than a backstop to it.

There is no service-charge argument and the row is written without one. The §8.1 line a guest was charged is already inside the booking''s stored breakdown, and writing it again on a desk recording would count it twice in the §11.2 daily reconciliation. public.payments.service_fee_fils belongs to the online checkout, which the online-payment plan owns.

THE BOOKING STATUS IS NOT CHECKED, deliberately. Money that was taken is a fact, and refusing to write down a fact because the booking is cancelled or a no-show would leave a receptionist holding cash the system denies exists - §10.2''s no-show and late-arrival rules are precisely where that happens. Part payments are expected for the same reason: public.payments is one row per attempt, never one per booking.';


comment on function public.void_booking_payment(uuid, text) is
  'Cancel a payment without destroying it [§8]. The row keeps its method, its value and its history and moves to cancelled, because §11.2 reports "open, failed, late and duplicate payment events" and a delete would remove the only record that the attempt was ever made. Nothing in this schema deletes a payment.

WHAT IT WILL NOT DO IS VOID A PAYMENT THAT TOOK MONEY. paid, partially_refunded and fully_refunded are refused with WP028. §4.3 transcribes §8''s state machine and cancelled is reachable from open and pending, never from paid: a payment that has been taken is undone by public.record_refund, which records a value, a reason and a row §11.2 can report on. Flipping it to cancelled instead would make money vanish from a reconciliation that has to balance, under a status that says nothing about where it went.

The consequence is worth stating plainly, because it is an operational cost rather than an oversight. public.record_booking_payment writes paid, so a desk entry made in error cannot be voided by the receptionist who made it - it is corrected by a Management refund. That follows the contract''s own state machine instead of our convenience, and a Reception correction window is a decision WellPlace takes, not one we assume. What this function is FOR is the open payment link nobody paid and the pending gateway attempt that was abandoned, both of which §8 keeps out of earned figures until they are confirmed.

Staff-gated rather than Management-gated: §9.2 gives Reception the payment actions and voiding an unpaid link is one of them. Cancelling twice raises WP028 as well, because the first time is the time it happened.';


comment on function public.record_refund(uuid, integer, text) is
  'Issue a refund against a payment [§8, §11.2]. MANAGEMENT ONLY, transcribed from docs/5 §3: "issue a refund - reception: no, management: yes". A reception account holding view_confidential_figures can READ refunds and still cannot write one; reading and writing are two questions and the policy on public.refunds answers only the first.

THIS FUNCTION IS WHERE THE CEILING LIVES, and 20260907092000_create_payments.sql left it here on purpose. "A refund may not exceed its payment" cannot be a check constraint: a check sees one row of one table, and the binding rule is that the SUM of every refund against a payment stays inside it. A trigger aggregating siblings would still be wrong, and wrong in the way that only appears under load - two concurrent partial refunds each read a running sum that excludes the other, both pass, and the payment gives back more than it took. That is the double-booking race wearing different clothes and it gets the same treatment the suites get: the row is locked before the question is asked. SELECT ... FOR UPDATE on public.payments serialises every refund against one payment through a single row lock, the sum is taken inside that lock, and WP029 refuses on the running sum. The second of two concurrent partial refunds waits for the first to commit and then sees it.

Full and partial are not two kinds. A refund equal to what is left is simply the whole of it, and the payment moves to fully_refunded rather than partially_refunded on that arithmetic alone. There is no flag, and no second code path to keep in step.

The refund is created PENDING. §8 lists a pending refund as a state and it is the honest one: the Management decision to give money back is made here, and the money moves when the provider says it did. Nothing in this migration settles one, because settlement arrives as a provider callback and that is the online-payment plan. A refund can also stop being pending by FAILING at the provider, which leaves it unsettled and needing a §9.3 alert, which is why public.refunds constrains only the safe direction.

WP030 refuses a payment that is neither paid nor partially_refunded. Giving back money that was never taken is not a refund, and §4.3 has no such edge.

The §8.2 automatic refund runs with NO USER SESSION and therefore cannot call this function today - internal.is_management() is false for a queue worker. That is deliberate rather than forgotten: docs/5 states this rule explicitly and weakening it for a plan that has not been written yet would be the wrong order. The §8.2 work adds its own entry point and takes that decision in the open.';


comment on function public.set_manual_booking_price(uuid, integer, text) is
  'Set a booking total by hand [§6.4]. "Manual price changes require permission, a reason and an audit-log entry" names three things, and this function refuses without any one of them.

perm:manual_price_change IS REQUIRED OF MANAGEMENT TOO. docs/5 §2 is explicit that this permission and override_suite_allocation are granted implicitly by neither role, unlike view_confidential_figures and correct_customer_record. A management session without the grant gets WP031 exactly as a reception session does. internal.has_permission already encodes that asymmetry and this function does not restate it, so the two cannot disagree.

INV-21: THE SUPPLIED VALUE IS STORED AND NOTHING IS RECOMPUTED. There is exactly one pricing implementation - src/lib/domain/pricing/index.ts - it is pure, and it backs the booking flow, Reception, the §10.4 test-price preview, receipts and Reporting. Any arithmetic here would be a second implementation from the moment either one changed. Reporting sums what is stored [§11.2].

Only total_fils moves. The rest of the stored breakdown - subtotal, discount, add-ons, service charge and tax - is left exactly as the engine produced it and is written into the audit entry beside the change, so the gap between an authorised override and the computed parts is visible rather than quietly closed. public.bookings deliberately carries no constraint asserting that the parts sum to the whole, and this is the reason.

The booking status is not checked. §6.4 puts no window on a correction, and a total corrected after a completed visit is the ordinary month-end case.';


comment on function public.set_payment_method_fee(public.payment_method, boolean, numeric, text, text) is
  'Configure the §8.1 service charge for one payment method. Management only [docs/5 §3, "configure prices, promo codes, add-ons: reception no"], a reason is required, and the audit entry carries activation status, percentage, label, method, change time and the Management user. That is the complete list §8.1 asks to be logged, which is why no shadow history table exists for it [INV-13, INV-14].

INV-19 IS NOT ENFORCED HERE AND MUST NEVER BE ADDED HERE. This function stores configuration and calculates nothing. The percentage is applied to the order value BEFORE the charge and never compounds on itself in exactly one place: percentOfFils in src/lib/domain/pricing/index.ts, the pure engine that also backs the booking flow, Reception, the §10.4 test-price preview and every receipt. A calculation in SQL would be a second implementation, and the copy that drifts is always the one nobody is testing. What reaches public.payments and public.bookings is the OUTPUT of that engine, stored, and never recomputed afterwards [INV-21].

What comes back, and what is audited, is READ FROM THE STORED ROW rather than echoed from the arguments. public.payment_method_fees holds a fixed-point column of two decimal places, so a caller sending 2.505 is stored as 2.51, and a function that replied 2.505 would have told Management something the table does not hold. The caller sees the row.

Upsert rather than insert-or-fail. public.payment_method_fees ships empty, so a method is configured for the first time by the same action that changes it later, and the audit entry is what distinguishes them: old_value is null the first time and the previous row every time after. Two Management users configuring the same method at once is a race an if-exists-then-update would lose, which is why the conflict clause is here at all.

It names payment_method_fees_pkey rather than the column, and it has to. The output column is called method, plpgsql resolves ON CONFLICT (method) against its own variables first, and the whole function fails at run time with an ambiguous column reference. Naming the constraint takes the identifier out of that namespace. Renaming the output column would have worked too and was rejected: the public shape of the function is what src/lib/db/rpc.ts and the generated types carry, and it should read as the table does.

p_is_enabled and p_percent are BOTH REQUIRED. A boolean has no third value meaning "leave this alone", and defaulting either would let somebody editing a label silently switch a charge on, or move it. §8.1 gives Management a visible enable and a complete disable; both have to be stated by the caller.

The 0 to 100 bound on p_percent, WP032, is a storage plausibility limit and NOT a business rule. §8.1 lets Management set the figure freely and INV-16 keeps business values out of code; this refuses only what could not have been intended. It mirrors payment_method_fees_percent_range so a caller gets a message naming the argument rather than a bare constraint violation.

THE TABBY GAP IS UNCHANGED. Tabby is a checkout option inside the hosted checkout and not a settlement channel, so it is not a public.payment_method value and cannot be keyed here today. fees.tabby.percent in src/lib/config/registry.ts carries the client''s 6% and this table generalises the mechanism per method. The two are reconciled by a migration once the client confirms which methods carry a charge, never by guessing a key now.';


revoke all on function public.record_booking_payment(uuid, public.payment_method, integer, text, text, text) from public;
revoke all on function public.void_booking_payment(uuid, text) from public;
revoke all on function public.record_refund(uuid, integer, text) from public;
revoke all on function public.set_manual_booking_price(uuid, integer, text) from public;
revoke all on function public.set_payment_method_fee(public.payment_method, boolean, numeric, text, text) from public;

grant execute on function public.record_booking_payment(uuid, public.payment_method, integer, text, text, text)
  to authenticated, service_role;
grant execute on function public.void_booking_payment(uuid, text)
  to authenticated, service_role;
grant execute on function public.record_refund(uuid, integer, text)
  to authenticated, service_role;
grant execute on function public.set_manual_booking_price(uuid, integer, text)
  to authenticated, service_role;
grant execute on function public.set_payment_method_fee(public.payment_method, boolean, numeric, text, text)
  to authenticated, service_role;
