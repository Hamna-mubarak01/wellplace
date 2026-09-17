create trigger suite_occupancy_refuses_retired_suite_change
  before update on public.suite_occupancy
  for each row
  when (new.is_active and (
    not old.is_active
    or new.blocked_period is distinct from old.blocked_period
    or new.experience_period is distinct from old.experience_period
    or new.suite_id is distinct from old.suite_id
  ))
  execute function internal.refuse_retired_suite_claim();

comment on function internal.refuse_retired_suite_claim() is
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11; §7.2] No live claim may be placed on, widened on, moved onto or revived on a retired suite. suite_occupancy_refuses_retired_suite runs it on every insert; since 20260911235000 suite_occupancy_refuses_retired_suite_change runs it on an update that leaves the claim active while reactivating it, changing its experience or blocked period, or changing its suite, which is how extend_booking and override_booking_buffer widen a claim. Deactivating, releasing or expiring a claim on a retired suite is untouched. internal.allocate_suite already skips inactive suites, so this is the backstop for every other path.';

create function internal.vat_added_on_top(
  p_subtotal_fils    integer,
  p_discount_fils    integer,
  p_addons_fils      integer,
  p_service_fee_fils integer,
  p_tax_fils         integer,
  p_total_fils       integer
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_tax_fils > 0
     and p_total_fils = p_subtotal_fils - p_discount_fils + p_addons_fils + p_service_fee_fils + p_tax_fils
$$;

revoke all on function internal.vat_added_on_top(integer, integer, integer, integer, integer, integer)
  from public, anon, authenticated, service_role;

comment on function internal.vat_added_on_top(integer, integer, integer, integer, integer, integer) is
  '[§8, INV-21; CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] Reads a stored breakdown''s VAT treatment from the figures alone: VAT was added on top when the total equals goods plus fee plus VAT, and is otherwise included in the price. The pricing engine writes the total one way or the other, so this never consults the tax.inclusive setting, which may have changed since the booking was priced.';

create or replace function internal.invoice_taxable_fils(
  p_booking_id       uuid,
  p_subtotal_fils    integer,
  p_discount_fils    integer,
  p_addons_fils      integer,
  p_service_fee_fils integer,
  p_tax_fils         integer,
  p_total_fils       integer
)
returns integer
language sql
stable
set search_path = ''
as $$
  with addon_lines as (
    select coalesce(sum(a.line_total_fils), 0)                          as all_fils,
           coalesce(sum(a.line_total_fils) filter (where a.is_taxable), 0) as taxable_fils
      from public.booking_addons a
     where a.booking_id = p_booking_id
  )
  select greatest(0, least(
           p_total_fils,
           p_subtotal_fils - p_discount_fils
           + case when l.all_fils = p_addons_fils then l.taxable_fils else 0 end
           - case
               when internal.vat_added_on_top(p_subtotal_fils, p_discount_fils, p_addons_fils, p_service_fee_fils, p_tax_fils, p_total_fils)
               then 0
               else p_tax_fils
             end
         ))::integer
    from addon_lines l
$$;

create or replace function public.set_manual_booking_price(p_booking_id uuid, p_total_fils integer, p_reason text)
returns table (booking_id uuid, reference text, total_fils integer, previous_total_fils integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reference     text;
  v_old_total     integer;
  v_status        public.booking_status;
  v_subtotal      integer;
  v_discount      integer;
  v_addons        integer;
  v_service       integer;
  v_tax           integer;
  v_vat_percent   numeric;
  v_new_tax       integer;
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

  if v_status not in (
    'draft'::public.booking_status,
    'held'::public.booking_status,
    'awaiting_payment'::public.booking_status,
    'payment_failed'::public.booking_status,
    'awaiting_recovery'::public.booking_status,
    'confirmed'::public.booking_status,
    'checked_in'::public.booking_status,
    'completed'::public.booking_status,
    'no_show'::public.booking_status
  ) then
    raise exception 'set_manual_booking_price: a booking in % cannot be repriced [§4.4, §11.2]',
      v_status
      using errcode = 'WP014';
  end if;

  v_vat_percent := (
    select (s.value #>> '{}')::numeric
      from public.settings s
     where s.key = 'tax.vat_percent' and jsonb_typeof(s.value) = 'number'
  );

  v_new_tax := case
    when v_vat_percent is not null and v_vat_percent > 0
      then p_total_fils - round(p_total_fils::numeric / (1 + v_vat_percent / 100))::integer
    else 0
  end;

  update public.bookings b
     set subtotal_fils    = p_total_fils,
         discount_fils    = 0,
         addons_fils      = 0,
         service_fee_fils = 0,
         tax_fils         = v_new_tax,
         total_fils       = p_total_fils
   where b.id = p_booking_id;

  perform internal.write_audit(
    'set_manual_booking_price',
    'public.bookings',
    p_booking_id::text,
    jsonb_build_object(
      'reference',        v_reference,
      'status',           v_status,
      'subtotal_fils',    v_subtotal,
      'discount_fils',    v_discount,
      'addons_fils',      v_addons,
      'service_fee_fils', v_service,
      'tax_fils',         v_tax,
      'total_fils',       v_old_total
    ),
    jsonb_build_object(
      'reference',        v_reference,
      'status',           v_status,
      'subtotal_fils',    p_total_fils,
      'discount_fils',    0,
      'addons_fils',      0,
      'service_fee_fils', 0,
      'tax_fils',         v_new_tax,
      'total_fils',       p_total_fils
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

do $$
begin
  execute format(
    'comment on function public.set_manual_booking_price(uuid, integer, text) is %L',
    obj_description('public.set_manual_booking_price(uuid, integer, text)'::regprocedure, 'pg_proc')
      || E'\n\n'
      || 'VAT, SINCE 20260911235000. [CLIENT pricing specification: all displayed and calculated prices include 5% VAT; CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] The paragraph above predates the pricing specification and no longer holds for tax_fils: Q-4 is closed and tax.vat_percent is set, so a hand-set total is a VAT-inclusive gross and its VAT is stored rather than invented. tax_fils is the total less round(total / (1 + tax.vat_percent / 100)), the same arithmetic as the pricing engine''s taxWithin, and zero only while tax.vat_percent is unset or zero. The rest of the breakdown rule stands: the whole figure goes to subtotal_fils, discount, add-ons and fee are zeroed, subtotal less discount plus add-ons plus fee still equals total_fils, and the VAT sits inside that total. The audit entry''s new value records the VAT written.'
  );
end
$$;

alter table public.invoices
  add column overrun_fils integer not null default 0,
  add constraint invoices_overrun_non_negative check (overrun_fils >= 0);

comment on column public.invoices.overrun_fils is
  '[§7.6, §8, INV-21; CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] The booking''s stored overstay charge (bookings.overrun_fils) at issue. record_overrun keeps it outside the booking total, so the invoice adds it: total_fils includes it, it appears as its own overrun line with the minutes, and being charged at VAT-inclusive rates [Q-21] its VAT component, overrun less round(overrun / (1 + tax.vat_percent / 100)), is added to tax_fils and the rest to taxable_fils. Invoices issued before 20260911235000 carry zero here and were not recomputed; an invoice is immutable, so correcting one is a void and a reissue.';

create or replace function internal.guard_invoice_record()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'An issued invoice is kept permanently. Void it instead.'
      using errcode = 'WP079';
  end if;

  if (new.id, new.invoice_number, new.sequence_no, new.booking_id, new.customer_id, new.issued_at,
      new.issuer, new.bill_to, new.lines, new.tax, new.subtotal_fils, new.discount_fils, new.addons_fils,
      new.service_fee_fils, new.tax_fils, new.total_fils, new.paid_fils, new.currency, new.taxable_fils,
      new.overrun_fils)
     is distinct from
     (old.id, old.invoice_number, old.sequence_no, old.booking_id, old.customer_id, old.issued_at,
      old.issuer, old.bill_to, old.lines, old.tax, old.subtotal_fils, old.discount_fils, old.addons_fils,
      old.service_fee_fils, old.tax_fils, old.total_fils, old.paid_fils, old.currency, old.taxable_fils,
      old.overrun_fils)
     or (new.issued_by is distinct from old.issued_by and new.issued_by is not null)
     or (old.voided_at is not null and (
           new.voided_at is distinct from old.voided_at
           or new.void_reason is distinct from old.void_reason
           or (new.voided_by is distinct from old.voided_by and new.voided_by is not null)))
  then
    raise exception 'An issued invoice cannot be changed. Void it and issue a new one instead.'
      using errcode = 'WP079';
  end if;

  return new;
end
$$;

revoke all on function internal.guard_invoice_record() from public, anon, authenticated, service_role;

create or replace function public.issue_invoice(p_booking_id uuid)
returns setof public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking           public.bookings%rowtype;
  v_customer          public.customers%rowtype;
  v_existing          public.invoices%rowtype;
  v_invoice           public.invoices%rowtype;
  v_name              text;
  v_trn               text;
  v_address           text;
  v_prefix            text;
  v_currency          text;
  v_fee_label         text;
  v_tax               jsonb;
  v_gross             bigint;
  v_returned          bigint;
  v_adults            integer;
  v_children          integer;
  v_addons_consistent boolean;
  v_lines             jsonb;
  v_sequence          bigint;
  v_now               timestamptz := clock_timestamp();
  v_on_top            boolean;
  v_vat_percent       numeric;
  v_overrun           integer;
  v_overrun_tax       integer;
begin
  perform internal.require_management();

  select * into v_booking from public.bookings b where b.id = p_booking_id for update;

  if not found then
    raise exception 'This booking could not be found. Refresh the list and open it again.'
      using errcode = 'P0002';
  end if;

  select * into v_existing from public.invoices i where i.booking_id = p_booking_id and i.voided_at is null;

  if found then
    return next v_existing;
    return;
  end if;

  v_name    := (select nullif(btrim(s.value #>> '{}'), '') from public.settings s where s.key = 'invoice.issuer_legal_name');
  v_trn     := (select nullif(btrim(s.value #>> '{}'), '') from public.settings s where s.key = 'invoice.issuer_trn');
  v_address := (select nullif(btrim(s.value #>> '{}'), '') from public.settings s where s.key = 'invoice.issuer_address');
  v_prefix  := upper(coalesce(
    (select nullif(btrim(s.value #>> '{}'), '') from public.settings s where s.key = 'invoice.number_prefix'),
    'INV'
  ));

  if v_name is null or v_address is null or v_trn is null
     or v_trn !~ '^[0-9]{15}$' or v_prefix !~ '^[A-Z0-9]{1,12}$' then
    raise exception 'The invoice details in Settings are incomplete. Enter the legal name, the 15-digit tax registration number and the address, and use only letters and numbers in the invoice number prefix, before issuing an invoice.'
      using errcode = 'WP076';
  end if;

  if v_booking.is_complimentary then
    raise exception 'This booking is complimentary, so there is nothing to invoice.'
      using errcode = 'WP077';
  end if;

  select coalesce(sum(p.amount_fils), 0)
    into v_gross
    from public.payments p
   where p.booking_id = p_booking_id
     and p.status in (
       'paid'::public.payment_status,
       'partially_refunded'::public.payment_status,
       'fully_refunded'::public.payment_status
     );

  select coalesce(sum(r.amount_fils), 0)
    into v_returned
    from public.refunds r
   where r.booking_id = p_booking_id
     and r.settled_at is not null;

  if v_gross <= 0 or v_gross - v_returned <= 0 then
    raise exception 'No payment is held for this booking, so an invoice cannot be issued. Issue it once a payment has been received; a fully refunded booking has nothing to invoice.'
      using errcode = 'WP078';
  end if;

  select * into v_customer from public.customers c where c.id = v_booking.customer_id;

  select (count(*) filter (where g.kind = 'adult'::public.guest_kind))::integer,
         (count(*) filter (where g.kind = 'child'::public.guest_kind))::integer
    into v_adults, v_children
    from public.booking_guests g
   where g.booking_id = p_booking_id;

  v_currency := coalesce(
    (select nullif(upper(btrim(s.value #>> '{}')), '') from public.settings s where s.key = 'pricing.currency'),
    'AED'
  );

  v_fee_label := coalesce(
    (select nullif(btrim(s.value #>> '{}'), '') from public.settings s where s.key = 'fees.tabby.label'),
    'Service Fee'
  );

  v_on_top := internal.vat_added_on_top(
    v_booking.subtotal_fils, v_booking.discount_fils, v_booking.addons_fils,
    v_booking.service_fee_fils, v_booking.tax_fils, v_booking.total_fils
  );

  v_vat_percent := (
    select (s.value #>> '{}')::numeric
      from public.settings s
     where s.key = 'tax.vat_percent' and jsonb_typeof(s.value) = 'number'
  );

  v_overrun := greatest(coalesce(v_booking.overrun_fils, 0), 0);

  v_overrun_tax := case
    when v_overrun > 0 and coalesce(v_vat_percent, 0) > 0
      then v_overrun - round(v_overrun::numeric / (1 + v_vat_percent / 100))::integer
    else 0
  end;

  v_tax := jsonb_build_object(
    'label', coalesce(
      (select nullif(btrim(s.value #>> '{}'), '') from public.settings s where s.key = 'tax.label'),
      'VAT'
    ),
    'rate_percent', (
      select s.value from public.settings s
       where s.key = 'tax.vat_percent' and jsonb_typeof(s.value) = 'number'
    ),
    'is_included', not v_on_top
  );

  v_addons_consistent := coalesce(
    (select sum(a.line_total_fils) from public.booking_addons a where a.booking_id = p_booking_id),
    0
  ) = v_booking.addons_fils;

  v_lines :=
    jsonb_build_array(jsonb_build_object(
      'kind',            'visit',
      'label',           'Visit',
      'adults',          v_adults,
      'children',        v_children,
      'starts_at',       lower(v_booking.experience_period),
      'ends_at',         upper(v_booking.experience_period),
      'quantity',        null,
      'unit_price_fils', null,
      'amount_fils',     v_booking.subtotal_fils,
      'is_included',     false
    ))
    || coalesce((
      select jsonb_agg(jsonb_build_object(
               'kind',            'addon',
               'label',           a.name_snapshot,
               'quantity',        a.quantity,
               'unit_price_fils', case when v_addons_consistent then a.unit_price_fils else 0 end,
               'amount_fils',     case when v_addons_consistent then a.line_total_fils else 0 end,
               'is_included',     case when v_addons_consistent then a.is_included else true end,
               'is_taxable',      a.is_taxable
             ) order by a.created_at, a.id)
        from public.booking_addons a
       where a.booking_id = p_booking_id
    ), '[]'::jsonb)
    || case when v_overrun > 0 then jsonb_build_array(jsonb_build_object(
         'kind',            'overrun',
         'label',           'Overstay',
         'minutes',         v_booking.overrun_minutes,
         'quantity',        null,
         'unit_price_fils', null,
         'amount_fils',     v_overrun,
         'is_included',     false,
         'is_taxable',      true
       )) else '[]'::jsonb end
    || case when v_booking.discount_fils > 0 then jsonb_build_array(jsonb_build_object(
         'kind',            'discount',
         'label',           'Discount',
         'quantity',        null,
         'unit_price_fils', null,
         'amount_fils',     -v_booking.discount_fils,
         'is_included',     false
       )) else '[]'::jsonb end
    || case when v_booking.service_fee_fils > 0 then jsonb_build_array(jsonb_build_object(
         'kind',            'service_fee',
         'label',           v_fee_label,
         'quantity',        null,
         'unit_price_fils', null,
         'amount_fils',     v_booking.service_fee_fils,
         'is_included',     false
       )) else '[]'::jsonb end;

  update internal.invoice_numbering n
     set last_sequence_no = n.last_sequence_no + 1
   where n.id
  returning n.last_sequence_no into v_sequence;

  insert into public.invoices (
    invoice_number, sequence_no, booking_id, customer_id, issued_at, issued_by,
    issuer, bill_to, lines, tax,
    subtotal_fils, discount_fils, addons_fils, service_fee_fils, tax_fils, total_fils,
    paid_fils, currency, taxable_fils, overrun_fils
  )
  values (
    v_prefix || '-' || to_char(v_now at time zone 'Asia/Dubai', 'YYYY') || '-'
      || lpad(v_sequence::text, greatest(6, length(v_sequence::text)), '0'),
    v_sequence,
    p_booking_id,
    v_booking.customer_id,
    v_now,
    internal.current_staff_id(),
    jsonb_build_object('legal_name', v_name, 'trn', v_trn, 'address', v_address),
    jsonb_build_object(
      'salutation', v_customer.salutation,
      'first_name', v_customer.first_name,
      'last_name',  v_customer.last_name,
      'name',       btrim(v_customer.first_name || ' ' || v_customer.last_name),
      'email',      v_customer.email,
      'phone_e164', v_customer.phone_e164
    ),
    v_lines,
    v_tax,
    v_booking.subtotal_fils,
    v_booking.discount_fils,
    v_booking.addons_fils,
    v_booking.service_fee_fils,
    v_booking.tax_fils + v_overrun_tax,
    v_booking.total_fils + v_overrun,
    (v_gross - v_returned)::integer,
    v_currency,
    internal.invoice_taxable_fils(
      p_booking_id,
      v_booking.subtotal_fils,
      v_booking.discount_fils,
      v_booking.addons_fils,
      v_booking.service_fee_fils,
      v_booking.tax_fils,
      v_booking.total_fils
    ) + (v_overrun - v_overrun_tax),
    v_overrun
  )
  returning * into v_invoice;

  perform internal.write_audit(
    'issue_invoice',
    'public.invoices',
    v_invoice.id::text,
    null::jsonb,
    jsonb_build_object(
      'invoice_number',    v_invoice.invoice_number,
      'sequence_no',       v_invoice.sequence_no,
      'booking_id',        p_booking_id,
      'booking_reference', v_booking.reference,
      'total_fils',        v_invoice.total_fils,
      'tax_fils',          v_invoice.tax_fils,
      'taxable_fils',      v_invoice.taxable_fils,
      'overrun_fils',      v_invoice.overrun_fils,
      'paid_fils',         v_invoice.paid_fils,
      'currency',          v_invoice.currency
    ),
    'Tax invoice issued for booking ' || v_booking.reference
  );

  return next v_invoice;
end
$$;

comment on function public.issue_invoice(uuid) is
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11; §8, INV-21] Management issues the UAE tax invoice for one paid booking and gets the invoice row back. Idempotent: while the booking has a live invoice that invoice is returned unchanged and nothing is written. Refuses with WP076 until the legal name, 15-digit tax registration number and address are entered in Settings, and when the number prefix is not letters and digits; WP077 for a complimentary booking; WP078 when no money has been taken or all of it has been returned. The registered legal name lives only in Settings, typed by WellPlace, never in the code [R-44]. Figures are snapshots of the booking''s stored breakdown [INV-21]: taxable_fils from internal.invoice_taxable_fils, each add-on line with its is_taxable snapshot, and since 20260911235000 the stored overstay charge as its own overrun line, included in total_fils, with its VAT at the inclusive rate added to tax_fils and its net to taxable_fils [§7.6, Q-21]. Whether VAT is shown as included is read from the booking''s own figures by internal.vat_added_on_top, not from the tax.inclusive setting; the rate is still the tax.vat_percent setting at issue. The number is {prefix}-{Dubai year of issue}-{sequence of at least six digits} from internal.invoice_numbering, so numbers are gapless apart from voided invoices, which keep theirs. The booking row is locked first, so two concurrent issues for one booking produce one invoice. Writes its own audit entry.';

create or replace view public.management_invoices with (security_invoker = true) as
select
  i.id,
  i.invoice_number,
  i.sequence_no,
  i.booking_id,
  b.reference                                        as booking_reference,
  b.suite_id,
  s.suite_number,
  i.customer_id,
  i.bill_to ->> 'name'                               as customer_name,
  i.bill_to ->> 'email'                              as customer_email,
  i.issued_at,
  i.issued_by,
  internal.staff_display_name(i.issued_by)           as issued_by_name,
  i.issuer,
  i.bill_to,
  i.lines,
  i.tax,
  i.subtotal_fils,
  i.discount_fils,
  i.addons_fils,
  i.service_fee_fils,
  i.tax_fils,
  i.total_fils,
  i.paid_fils,
  i.currency,
  i.voided_at,
  i.voided_by,
  internal.staff_display_name(i.voided_by)           as voided_by_name,
  i.void_reason,
  case when i.voided_at is null then 'issued' else 'voided' end as state,
  i.taxable_fils,
  i.overrun_fils
from public.invoices i
join public.bookings b on b.id = i.booking_id
left join public.suites s on s.id = b.suite_id
where (select internal.has_permission('view_confidential_figures'::public.named_permission));

revoke insert, update, delete, truncate on public.invoices from service_role;
revoke insert, update, delete, truncate on internal.invoice_numbering from service_role;

comment on table public.invoices is
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11; §8, §11.2, INV-21] UAE tax invoices, one live invoice per paid booking. Every figure is copied from the booking''s stored priced breakdown, add-on snapshots and stored overstay charge at the moment of issue and is never recomputed. issuer holds the legal name, tax registration number and address from Settings as they were at issue; bill_to holds the customer''s name and contact details; tax holds the tax label and rate from Settings at issue and whether VAT is included as read from the booking''s own figures. paid_fils is money taken on the booking less refunds whose return was confirmed, at issue. The suite number is not part of the document, because a guest never sees one [§3, INV-01]. Readable only with view_confidential_figures, which Management holds implicitly. No role, the service role included, holds a write grant: public.issue_invoice and public.void_invoice are the only writers, and internal.guard_invoice_record refuses any other change and every delete.';
