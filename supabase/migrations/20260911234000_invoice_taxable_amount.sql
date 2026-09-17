alter table public.booking_addons add column is_taxable boolean;

update public.booking_addons ba
   set is_taxable = coalesce((select a.is_taxable from public.addons a where a.id = ba.addon_id), true)
 where ba.is_taxable is null;

create function internal.snapshot_booking_addon_tax()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_taxable is null then
    new.is_taxable := coalesce((select a.is_taxable from public.addons a where a.id = new.addon_id), true);
  end if;
  return new;
end
$$;

revoke all on function internal.snapshot_booking_addon_tax() from public, anon, authenticated, service_role;

create trigger booking_addons_snapshot_tax
  before insert on public.booking_addons
  for each row
  execute function internal.snapshot_booking_addon_tax();

alter table public.booking_addons alter column is_taxable set not null;

comment on column public.booking_addons.is_taxable is
  '[CLIENT pricing specification §8; CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] Whether this sold add-on line bears VAT, snapshotted from public.addons.is_taxable when the line is written, so a later change to the catalogue never alters a line already sold [INV-21]. Rows written before 20260911234000 were backfilled from their add-on''s is_taxable as it stood when that migration ran, not as it stood at the time of sale; a line whose add-on had been deleted was backfilled as VAT-bearing, the catalogue default and the pricing engine''s reading of an unknown add-on.';

comment on function internal.snapshot_booking_addon_tax() is
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] Fills booking_addons.is_taxable from public.addons.is_taxable when a writer leaves it empty, so every booking path snapshots the VAT flag without being changed. A writer that supplies the flag keeps its own value. There is deliberately no column default: a default would be applied before this trigger and hide an exempt add-on.';

alter table public.invoices
  add column taxable_fils integer not null default 0,
  add constraint invoices_taxable_within_total check (taxable_fils >= 0 and taxable_fils <= total_fils);

create function internal.invoice_taxable_fils(
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
               when p_tax_fils > 0
                and p_total_fils = p_subtotal_fils - p_discount_fils + p_addons_fils + p_service_fee_fils + p_tax_fils
               then 0
               else p_tax_fils
             end
         ))::integer
    from addon_lines l
$$;

revoke all on function internal.invoice_taxable_fils(uuid, integer, integer, integer, integer, integer, integer)
  from public, anon, authenticated, service_role;

comment on function internal.invoice_taxable_fils(uuid, integer, integer, integer, integer, integer, integer) is
  '[§8, INV-21; CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] The taxable amount printed on a tax invoice, derived only from stored figures: the visit subtotal less the discount plus the add-on lines snapshotted as VAT-bearing, less the VAT when prices include it. The service fee sits outside VAT [Q-20, ASSUMED] and exempt add-ons are excluded, matching the pricing engine. Two guards keep it true to the stored breakdown. When the add-on lines no longer add up to the booking''s stored add-on total, as after a manual price, the add-ons are treated as part of the agreed price and add nothing, so a manually priced booking gives subtotal less discount less its stored VAT. When the stored total equals goods plus fee plus VAT, the booking was priced with VAT added on top and the VAT is not subtracted. The result is clamped to between zero and the total.';

update public.invoices i
   set taxable_fils = internal.invoice_taxable_fils(
     i.booking_id, i.subtotal_fils, i.discount_fils, i.addons_fils, i.service_fee_fils, i.tax_fils, i.total_fils
   );

comment on column public.invoices.taxable_fils is
  '[§8, INV-21; CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] The taxable amount, excluding VAT, as issued: internal.invoice_taxable_fils over the booking''s stored figures and add-on VAT snapshots at the moment of issue. Invoices issued before 20260911234000 were backfilled from their own snapshotted figures and the add-on snapshots as they stood when that migration ran. Immutable after issue, like every other invoice figure.';

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
      new.service_fee_fils, new.tax_fils, new.total_fils, new.paid_fils, new.currency, new.taxable_fils)
     is distinct from
     (old.id, old.invoice_number, old.sequence_no, old.booking_id, old.customer_id, old.issued_at,
      old.issuer, old.bill_to, old.lines, old.tax, old.subtotal_fils, old.discount_fils, old.addons_fils,
      old.service_fee_fils, old.tax_fils, old.total_fils, old.paid_fils, old.currency, old.taxable_fils)
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

  v_tax := jsonb_build_object(
    'label', coalesce(
      (select nullif(btrim(s.value #>> '{}'), '') from public.settings s where s.key = 'tax.label'),
      'VAT'
    ),
    'rate_percent', (
      select s.value from public.settings s
       where s.key = 'tax.vat_percent' and jsonb_typeof(s.value) = 'number'
    ),
    'is_included', coalesce(
      (select (s.value #>> '{}')::boolean from public.settings s
        where s.key = 'tax.inclusive' and jsonb_typeof(s.value) = 'boolean'),
      true
    )
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
    paid_fils, currency, taxable_fils
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
    v_booking.tax_fils,
    v_booking.total_fils,
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
    )
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
      'paid_fils',         v_invoice.paid_fils,
      'currency',          v_invoice.currency
    ),
    'Tax invoice issued for booking ' || v_booking.reference
  );

  return next v_invoice;
end
$$;

comment on function public.issue_invoice(uuid) is
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11; §8, INV-21] Management issues the UAE tax invoice for one paid booking and gets the invoice row back. Idempotent: while the booking has a live invoice that invoice is returned unchanged and nothing is written. Refuses with WP076 until the legal name, 15-digit tax registration number and address are entered in Settings, and when the number prefix is not letters and digits; WP077 for a complimentary booking; WP078 when no money has been taken or all of it has been returned. The registered legal name lives only in Settings, typed by WellPlace, never in the code [R-44]. Figures are snapshots of the booking''s stored breakdown [INV-21], and since 20260911234000 they include taxable_fils from internal.invoice_taxable_fils and each add-on line carries its is_taxable snapshot, so an exempt add-on never enters the taxable amount. The number is {prefix}-{Dubai year of issue}-{sequence of at least six digits} from internal.invoice_numbering, so numbers are gapless apart from voided invoices, which keep theirs. The booking row is locked first, so two concurrent issues for one booking produce one invoice. Writes its own audit entry.';

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
  i.taxable_fils
from public.invoices i
join public.bookings b on b.id = i.booking_id
left join public.suites s on s.id = b.suite_id
where (select internal.has_permission('view_confidential_figures'::public.named_permission));
