with added as (
  insert into public.settings (key, value, value_type, source_tag, description) values
    ('invoice.issuer_legal_name', null, 'string', '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11]', 'Legal name on tax invoices'),
    ('invoice.issuer_trn',        null, 'string', '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11]', 'Tax registration number'),
    ('invoice.issuer_address',    null, 'string', '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11]', 'Address on tax invoices'),
    ('invoice.number_prefix',     null, 'string', '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11]', 'Invoice number prefix')
  on conflict (key) do nothing
  returning key, value
)
select internal.write_audit(
  'initialize_setting', 'public.settings', s.key, null,
  jsonb_build_object('value', s.value),
  'Add storage for the tax invoice issuer details. Invoices cannot be issued until the legal name, tax registration number and address are entered in Settings. [CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11]'
)
from added s;

create table internal.invoice_numbering (
  id               boolean primary key default true,
  last_sequence_no bigint  not null default 0,
  constraint invoice_numbering_single_row check (id),
  constraint invoice_numbering_non_negative check (last_sequence_no >= 0)
);

insert into internal.invoice_numbering (id, last_sequence_no) values (true, 0);

revoke all on internal.invoice_numbering from public, anon, authenticated, service_role;

comment on table internal.invoice_numbering is
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] The single counter behind public.invoices.sequence_no. A row, not a SEQUENCE: nextval is not transactional, so any rollback after it would leave a hole in the invoice numbers, and a gap is only acceptable where an invoice was voided and kept its number. public.issue_invoice increments this row inside its own transaction, after every refusal has been checked, so a failed issue consumes no number. Concurrent issues queue on the row lock.';

create table public.invoices (
  id               uuid primary key default gen_random_uuid(),
  invoice_number   text not null unique,
  sequence_no      bigint not null unique,
  booking_id       uuid not null references public.bookings(id),
  customer_id      uuid not null references public.customers(id),
  issued_at        timestamptz not null default clock_timestamp(),
  issued_by        uuid references public.staff(id) on delete set null,
  issuer           jsonb not null,
  bill_to          jsonb not null,
  lines            jsonb not null,
  tax              jsonb not null,
  subtotal_fils    integer not null,
  discount_fils    integer not null,
  addons_fils      integer not null,
  service_fee_fils integer not null,
  tax_fils         integer not null,
  total_fils       integer not null,
  paid_fils        integer not null,
  currency         text not null,
  voided_at        timestamptz,
  voided_by        uuid references public.staff(id) on delete set null,
  void_reason      text,
  constraint invoices_money_non_negative check (
    subtotal_fils >= 0 and discount_fils >= 0 and addons_fils >= 0 and service_fee_fils >= 0
    and tax_fils >= 0 and total_fils >= 0 and paid_fils > 0
  ),
  constraint invoices_sequence_positive check (sequence_no > 0),
  constraint invoices_number_shaped check (invoice_number ~ '^[A-Z0-9]{1,12}-[0-9]{4}-[0-9]{6,}$'),
  constraint invoices_currency_shaped check (currency ~ '^[A-Z]{3}$'),
  constraint invoices_issuer_shaped check (
    jsonb_typeof(issuer) = 'object' and issuer ?& array['legal_name', 'trn', 'address']
  ),
  constraint invoices_bill_to_shaped check (jsonb_typeof(bill_to) = 'object'),
  constraint invoices_lines_shaped check (jsonb_typeof(lines) = 'array'),
  constraint invoices_tax_shaped check (jsonb_typeof(tax) = 'object'),
  constraint invoices_void_recorded check ((voided_at is null) = (void_reason is null)),
  constraint invoices_void_reason_length check (
    void_reason is null or length(btrim(void_reason)) between 1 and 500
  )
);

create unique index invoices_one_live_per_booking_idx on public.invoices (booking_id) where voided_at is null;
create index invoices_booking_idx on public.invoices (booking_id);
create index invoices_customer_idx on public.invoices (customer_id);
create index invoices_issued_by_idx on public.invoices (issued_by);
create index invoices_voided_by_idx on public.invoices (voided_by);
create index invoices_issued_order_idx on public.invoices (issued_at desc, sequence_no desc);

alter table public.invoices enable row level security;

revoke all on public.invoices from public, anon, authenticated;
grant select on public.invoices to authenticated;

create policy invoices_select_confidential on public.invoices
  for select to authenticated
  using ((select internal.has_permission('view_confidential_figures'::public.named_permission)));

comment on table public.invoices is
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11; §8, §11.2, INV-21] UAE tax invoices, one live invoice per paid booking. Every figure is copied from the booking''s stored priced breakdown and add-on snapshots at the moment of issue and is never recomputed. issuer holds the legal name, tax registration number and address from Settings as they were at issue; bill_to holds the customer''s name and contact details; tax holds the tax label, rate and whether prices include it, from Settings at issue. paid_fils is money taken on the booking less refunds whose return was confirmed, at issue. The suite number is not part of the document, because a guest never sees one [§3, INV-01]. Readable only with view_confidential_figures, which Management holds implicitly; there is no direct write grant, public.issue_invoice and public.void_invoice are the only writers, and internal.guard_invoice_record refuses any other change and every delete.';

comment on column public.invoices.lines is
  'Presentation lines, in order: the visit at the booking''s stored subtotal, one line per add-on snapshot, the discount as a negative amount, and the service fee. When the add-on snapshots no longer add up to the booking''s stored add-on total, as after a manual price, the add-ons are listed as included at zero so that the lines still agree with the stored figures.';

create function internal.guard_invoice_record()
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
      new.service_fee_fils, new.tax_fils, new.total_fils, new.paid_fils, new.currency)
     is distinct from
     (old.id, old.invoice_number, old.sequence_no, old.booking_id, old.customer_id, old.issued_at,
      old.issuer, old.bill_to, old.lines, old.tax, old.subtotal_fils, old.discount_fils, old.addons_fils,
      old.service_fee_fils, old.tax_fils, old.total_fils, old.paid_fils, old.currency)
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

create trigger invoices_guard_record
  before update or delete on public.invoices
  for each row
  execute function internal.guard_invoice_record();

comment on function internal.guard_invoice_record() is
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] An issued tax invoice is immutable. The only change allowed is voiding it once, and a staff account being deleted may clear issued_by or voided_by through their ON DELETE SET NULL. Deleting an invoice is refused, so a voided invoice keeps its number.';

create function public.issue_invoice(p_booking_id uuid)
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
               'is_included',     case when v_addons_consistent then a.is_included else true end
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
    paid_fils, currency
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
    v_currency
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
      'paid_fils',         v_invoice.paid_fils,
      'currency',          v_invoice.currency
    ),
    'Tax invoice issued for booking ' || v_booking.reference
  );

  return next v_invoice;
end
$$;

revoke all on function public.issue_invoice(uuid) from public, anon;
grant execute on function public.issue_invoice(uuid) to authenticated;

comment on function public.issue_invoice(uuid) is
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11; §8, INV-21] Management issues the UAE tax invoice for one paid booking and gets the invoice row back. Idempotent: while the booking has a live invoice that invoice is returned unchanged and nothing is written. Refuses with WP076 until the legal name, 15-digit tax registration number and address are entered in Settings, and when the number prefix is not letters and digits; WP077 for a complimentary booking; WP078 when no money has been taken or all of it has been returned. The registered legal name lives only in Settings, typed by WellPlace, never in the code [R-44]. Figures are snapshots of the booking''s stored breakdown [INV-21]; the number is {prefix}-{Dubai year of issue}-{sequence of at least six digits} from internal.invoice_numbering, so numbers are gapless apart from voided invoices, which keep theirs. The booking row is locked first, so two concurrent issues for one booking produce one invoice. Writes its own audit entry.';

create function public.void_invoice(p_invoice_id uuid, p_reason text)
returns setof public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_before public.invoices%rowtype;
  v_after  public.invoices%rowtype;
begin
  perform internal.require_management();

  if v_reason is null or length(v_reason) > 500 then
    raise exception 'Enter a reason of up to 500 characters for voiding this invoice.'
      using errcode = '22023';
  end if;

  select * into v_before from public.invoices i where i.id = p_invoice_id for update;

  if not found then
    raise exception 'This invoice could not be found. Refresh the list and open it again.'
      using errcode = 'P0002';
  end if;

  if v_before.voided_at is not null then
    raise exception 'This invoice has already been voided.'
      using errcode = 'WP079';
  end if;

  update public.invoices i
     set voided_at   = clock_timestamp(),
         voided_by   = internal.current_staff_id(),
         void_reason = v_reason
   where i.id = p_invoice_id
  returning * into v_after;

  perform internal.write_audit(
    'void_invoice',
    'public.invoices',
    p_invoice_id::text,
    jsonb_build_object('invoice_number', v_before.invoice_number, 'voided_at', null),
    jsonb_build_object(
      'invoice_number', v_after.invoice_number,
      'booking_id',     v_after.booking_id,
      'voided_at',      v_after.voided_at
    ),
    v_reason
  );

  return next v_after;
end
$$;

revoke all on function public.void_invoice(uuid, text) from public, anon;
grant execute on function public.void_invoice(uuid, text) to authenticated;

comment on function public.void_invoice(uuid, text) is
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] Management voids an issued invoice with a reason and gets the voided row back. The invoice and its number are kept; public.issue_invoice then issues a fresh invoice with the next number for the same booking. WP079 when the invoice is already void. Writes its own audit entry.';

create view public.management_invoices with (security_invoker = true) as
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
  case when i.voided_at is null then 'issued' else 'voided' end as state
from public.invoices i
join public.bookings b on b.id = i.booking_id
left join public.suites s on s.id = b.suite_id
where (select internal.has_permission('view_confidential_figures'::public.named_permission));

revoke all on public.management_invoices from public, anon;
grant select on public.management_invoices to authenticated;

comment on view public.management_invoices is
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] Invoices for the Management Finance section, with the booking reference and the booking''s current suite number for the console list. The suite number is for staff only and must never be printed on the invoice a guest receives [§3, INV-01]. Security invoker over public.invoices, so its confidential-figures policy applies.';

create view public.management_payment_ledger with (security_invoker = true) as
select
  p.id                                            as payment_id,
  p.booking_id,
  b.reference                                     as booking_reference,
  b.suite_id,
  s.suite_number,
  b.customer_id,
  btrim(c.first_name || ' ' || c.last_name)       as customer_name,
  c.email                                         as customer_email,
  p.method,
  p.status,
  p.amount_fils,
  p.service_fee_fils,
  p.tax_fils,
  p.is_simulated,
  p.provider_reference,
  p.note,
  p.recorded_at,
  internal.staff_display_name(p.recorded_by)      as recorded_by_name,
  coalesce(r.requested_fils, 0)                   as refund_requested_fils,
  coalesce(r.pending_fils, 0)                     as refund_pending_fils,
  coalesce(r.returned_fils, 0)                    as refunded_fils,
  greatest(0, p.amount_fils - coalesce(r.requested_fils, 0)) as refundable_fils
from public.payments p
join public.bookings b on b.id = p.booking_id
join public.customers c on c.id = b.customer_id
left join public.suites s on s.id = b.suite_id
left join lateral (
  select
    (sum(x.amount_fils) filter (where x.withdrawn_at is null))::integer   as requested_fils,
    (sum(x.amount_fils) filter (where x.is_pending))::integer             as pending_fils,
    (sum(x.amount_fils) filter (where x.settled_at is not null))::integer as returned_fils
  from public.refunds x
  where x.payment_id = p.id
) r on true
where (select internal.has_permission('view_confidential_figures'::public.named_permission));

revoke all on public.management_payment_ledger from public, anon;
grant select on public.management_payment_ledger to authenticated;

comment on view public.management_payment_ledger is
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11; §10.1, §11.2] Every payment across the venue for the Management Finance section, with its booking reference, suite, customer and method, and its refunds summarised: requested (not withdrawn), pending, returned, and the amount still refundable. A venue-wide payment list is a confidential figure, so rows are returned only with view_confidential_figures.';

create view public.management_refund_ledger with (security_invoker = true) as
select
  r.id                                            as refund_id,
  r.payment_id,
  r.booking_id,
  b.reference                                     as booking_reference,
  b.suite_id,
  s.suite_number,
  b.customer_id,
  btrim(c.first_name || ' ' || c.last_name)       as customer_name,
  c.email                                         as customer_email,
  p.method                                        as payment_method,
  p.is_simulated,
  r.amount_fils,
  r.tax_fils,
  case
    when r.withdrawn_at is not null then 'withdrawn'
    when r.settled_at is not null then 'returned'
    else 'pending'
  end                                             as state,
  r.requested_by is null                          as is_automatic,
  r.reason,
  r.requested_at,
  internal.staff_display_name(r.requested_by)     as requested_by_name,
  r.settled_at,
  r.provider_reference,
  r.withdrawn_at,
  internal.staff_display_name(r.withdrawn_by)     as withdrawn_by_name,
  r.withdrawal_reason
from public.refunds r
join public.payments p on p.id = r.payment_id
join public.bookings b on b.id = r.booking_id
join public.customers c on c.id = b.customer_id
left join public.suites s on s.id = b.suite_id
where (select internal.has_permission('view_confidential_figures'::public.named_permission));

revoke all on public.management_refund_ledger from public, anon;
grant select on public.management_refund_ledger to authenticated;

comment on view public.management_refund_ledger is
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11; §8, §11.2] Every refund for the Management Finance section, logged separately from payments: booking reference, customer, suite, the original payment method, amount and VAT share, and whether it is pending, returned or withdrawn. is_automatic marks a refund the payment settlement started itself, which has no requesting staff member and cannot be withdrawn. Security invoker over public.refunds, whose confidential-figures policy applies.';
