create function internal.document_step_lock_timeout()
returns text
language sql
immutable
set search_path = ''
as $$
  select '1s'::text
$$;

revoke all on function internal.document_step_lock_timeout() from public, anon, authenticated, service_role;

comment on function internal.document_step_lock_timeout() is
  '[OUR CHOICE — project owner''s direction, 14 September 2026] The total time the automatic invoice and credit note steps may wait for locks, one second. It is a technical bound, not a business rule. internal.issue_invoice_when_paid and internal.issue_credit_notes_when_refunded turn it into a deadline for the whole step (internal.document_step_deadline); a step that cannot get its locks before the deadline gives up, and the payment or refund it rode on commits without the document, which then appears in public.management_missing_invoices. Invoices never block money.';

create function internal.document_step_deadline()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select nullif(pg_catalog.current_setting('wellplace.document_step_deadline', true), '')::timestamptz
$$;

revoke all on function internal.document_step_deadline() from public, anon, authenticated, service_role;

comment on function internal.document_step_deadline() is
  '[OUR CHOICE — project owner''s direction, 14 September 2026; concurrency finding: lock_timeout bounds each lock wait, not the whole step] The wall-clock deadline of the automatic document step running in this transaction, from the transaction-local setting wellplace.document_step_deadline, or null outside such a step (Management''s Issue now, Regenerate and Void wait normally).';

create function internal.arm_document_step_lock_timeout()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_deadline     timestamptz := internal.document_step_deadline();
  v_remaining_ms bigint;
begin
  if v_deadline is null then
    return;
  end if;

  v_remaining_ms := floor(extract(epoch from (v_deadline - pg_catalog.clock_timestamp())) * 1000)::bigint;

  if v_remaining_ms < 1 then
    raise exception 'The document step ran out of time before it could take its lock.'
      using errcode = '55P03';
  end if;

  perform pg_catalog.set_config('lock_timeout', v_remaining_ms::text || 'ms', true);
end
$$;

revoke all on function internal.arm_document_step_lock_timeout() from public, anon, authenticated, service_role;

comment on function internal.arm_document_step_lock_timeout() is
  '[OUR CHOICE — project owner''s direction, 14 September 2026] Inside an automatic document step, sets lock_timeout transaction-locally to the milliseconds left before internal.document_step_deadline, and raises lock_not_available (55P03) once none are left, because a lock_timeout of zero would mean wait forever. Outside a step it does nothing.';

create function internal.take_document_lock(p_key text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform internal.arm_document_step_lock_timeout();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('wellplace.documents'), pg_catalog.hashtext(p_key));
  perform internal.arm_document_step_lock_timeout();
end
$$;

revoke all on function internal.take_document_lock(text) from public, anon, authenticated, service_role;

comment on function internal.take_document_lock(text) is
  '[OUR CHOICE — project owner''s direction, 14 September 2026] The transaction-level advisory lock that serialises tax document writers: keyed on a booking id for every writer of that booking''s invoices, credit notes and invoice-to-payment links, and on invoice_numbering or credit_note_numbering before a counter is incremented, so the counter rows are never queued on by these functions. An advisory lock is one heavyweight wait, so inside an automatic step the remaining time before the deadline bounds it exactly; lock_timeout is re-armed afterwards for the next wait. Outside a step it waits normally.

LOCK ORDER. [OUR CHOICE — project owner''s direction, 14 September 2026; concurrency findings: a refund waited for a Management invoice writer, and Regenerate deadlocked with confirm_refund_return] Every path takes its locks in one order: the payment rows (Management''s invoice writers take all of the booking''s payments FOR KEY SHARE, ordered by id; a money path takes its own payment), then the refund row where there is one, then the booking row, then this booking document lock, then the invoice counter, then the credit note counter. The row locks are FOR NO KEY UPDATE on the money paths (public.settle_payment_event, public.record_booking_payment, public.request_payment_refund, public.confirm_refund_return) and on the booking in public.issue_invoice, public.void_invoice and public.regenerate_invoice, never FOR UPDATE, because no key column changes; FOR NO KEY UPDATE does not conflict with the FOR KEY SHARE locks that the foreign keys of refunds, payments, invoices, invoice links and credit notes take, and FOR KEY SHARE does not conflict with FOR NO KEY UPDATE, so a refund or payment never queues behind an invoice writer on a row, and a writer holding the booking and document locks never waits for a payment or refund row held by a money path that is itself waiting for the document lock. Rows locked inside an automatic step (the credit note step''s booking row, a customer, another payment or refund, a counter row) are taken through internal.lock_rows_for_document, whose wait is capped by the step''s deadline. A raw FOR UPDATE lock on a booking or payment row taken by anything else still blocks the implicit FOR KEY SHARE of a refund or payment insert before any step begins; that wait belongs to the foreign key and no document code can shorten it.';

create function internal.lock_rows_for_document(p_locking_query text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_deadline timestamptz := internal.document_step_deadline();
  v_half_ms  bigint;
begin
  if v_deadline is null then
    execute p_locking_query;
    return;
  end if;

  v_half_ms := floor(extract(epoch from (v_deadline - pg_catalog.clock_timestamp())) * 500)::bigint;

  if v_half_ms >= 1 then
    begin
      perform pg_catalog.set_config('lock_timeout', v_half_ms::text || 'ms', true);
      execute p_locking_query;
      return;
    exception
      when lock_not_available or deadlock_detected then
        null;
    end;
  end if;

  loop
    begin
      execute p_locking_query || ' nowait';
      return;
    exception
      when lock_not_available then
        if pg_catalog.clock_timestamp() >= v_deadline then
          raise;
        end if;
        perform pg_catalog.pg_sleep(0.01);
    end;
  end loop;
end
$$;

revoke all on function internal.lock_rows_for_document(text) from public, anon, authenticated, service_role;

comment on function internal.lock_rows_for_document(text) is
  '[OUR CHOICE — project owner''s direction, 14 September 2026; concurrency finding] Takes the row locks a document write needs before it writes: FOR UPDATE on a counter row, and FOR KEY SHARE on the booking, customer, payment, refund and invoice rows its foreign keys would otherwise lock implicitly. p_locking_query is a fully qualified SELECT ending in its locking clause, built only by the invoice functions. Outside an automatic step it waits normally. Inside one it first waits in the lock queue with lock_timeout set to half the time left before internal.document_step_deadline, then, if that wait timed out or was ended by the deadlock detector, retries the query with NOWAIT every 10 ms until the deadline, and only then raises lock_not_available: a waiting lock, never a skipped one. A plain row lock can wait twice in one statement (first on the tuple lock of a waiter ahead of it, then on the holder''s transaction) with a fresh lock_timeout each time, which is why a queue of payments could previously wait two timeouts; halving the queued wait keeps both waits together within the time left, and the retries never go past the deadline, so the call returns by the deadline plus one 10 ms retry interval.';


drop index public.invoices_one_live_per_booking_idx;

alter table public.invoices
  add column is_test             boolean not null default false,
  add column supply_date         date,
  add column payments            jsonb   not null default '[]'::jsonb,
  add column replaces_invoice_id uuid    references public.invoices(id),
  add constraint invoices_payments_shaped check (jsonb_typeof(payments) = 'array');

create index invoices_replaces_invoice_idx on public.invoices (replaces_invoice_id);


create function internal.invoice_payment_snapshot(p_payment_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
           'payment_id',         p.id,
           'number',             p.reference,
           'method',             p.method,
           'provider_reference', p.provider_reference,
           'amount_fils',        p.amount_fils,
           'tax_fils',           p.tax_fils,
           'paid_at',            coalesce((
                                   select min(e.processed_at)
                                     from public.payment_events e
                                    where e.payment_id = p.id and e.payload ->> 'outcome' = 'success'
                                 ), p.recorded_at),
           'is_test',            p.is_simulated)
    from public.payments p
   where p.id = p_payment_id
$$;

revoke all on function internal.invoice_payment_snapshot(uuid) from public, anon, authenticated, service_role;

comment on function internal.invoice_payment_snapshot(uuid) is
  '[OUR CHOICE — project owner''s direction, 14 September 2026; §8] What a tax invoice prints about one payment it covers: the WP-P number, method, provider reference, amount, its frozen VAT, when it was paid and whether it was a test payment. paid_at is the first verified success event for an online payment, and the recording time for a payment taken at the desk.';


create table public.invoice_payments (
  invoice_id  uuid        not null references public.invoices(id),
  payment_id  uuid        not null references public.payments(id),
  amount_fils integer     not null,
  tax_fils    integer     not null,
  voided_at   timestamptz,
  primary key (invoice_id, payment_id),
  constraint invoice_payments_amount_positive check (amount_fils > 0),
  constraint invoice_payments_tax_within_amount check (tax_fils >= 0 and tax_fils <= amount_fils)
);

create index invoice_payments_payment_idx on public.invoice_payments (payment_id);
create unique index invoice_payments_one_valid_per_payment_idx
  on public.invoice_payments (payment_id) where voided_at is null;

alter table public.invoice_payments enable row level security;

revoke all on public.invoice_payments from public, anon, authenticated, service_role;
grant select on public.invoice_payments to authenticated;

create policy invoice_payments_select_confidential on public.invoice_payments
  for select to authenticated
  using ((select internal.has_permission('view_confidential_figures'::public.named_permission)));

comment on table public.invoice_payments is
  '[OUR CHOICE — project owner''s direction, 14 September 2026; §8 "Gateway transaction, booking, receipt/invoice and refund must be uniquely linked and reconcilable"] Which payments each tax invoice covers. A payment is always covered whole, by at most one valid invoice (invoice_payments_one_valid_per_payment_idx), so every amount paid is on exactly one valid invoice and a credit note can follow its refund to the invoice that covers the refunded payment. amount_fils and tax_fils are the payment''s amount and frozen VAT at issue. voided_at is set in the same transaction that voids the invoice, which frees the payment for a replacement. An invoice issued since 20260914091000 has a total equal to the payments it covers. An invoice issued before it was written for the booking''s whole value, so its total can exceed the payments it covers; that gap absorbs later payments. The migration linked every paid payment of each valid earlier invoice''s booking, excluding payments the settlement refunded itself, in the order recorded, while their running total stayed within the invoice total, and internal.absorb_invoice_gaps links later payments the same way before any new invoice is issued, so a balance paid after an earlier invoice is never invoiced twice. A payment is never split: one that does not fit the remaining gap is refused with WP086 until Management regenerates the earlier invoice. Readable with view_confidential_figures; no role writes it directly, and internal.guard_invoice_record refuses every change except voiding once and every delete.';

insert into public.invoice_payments (invoice_id, payment_id, amount_fils, tax_fils)
select x.invoice_id, x.payment_id, x.amount_fils, x.tax_fils
  from (
    select i.id as invoice_id,
           i.total_fils,
           p.id as payment_id,
           p.amount_fils,
           p.tax_fils,
           sum(p.amount_fils) over (partition by i.id order by p.recorded_at, p.id) as running_fils
      from public.invoices i
      join public.payments p on p.booking_id = i.booking_id
     where i.voided_at is null
       and p.status in ('paid'::public.payment_status, 'partially_refunded'::public.payment_status,
                        'fully_refunded'::public.payment_status)
       and p.amount_fils > 0
       and not exists (
         select 1 from public.refunds r
          where r.payment_id = p.id and r.requested_by is null and r.withdrawn_at is null)
  ) x
 where x.running_fils <= x.total_fils;

update public.invoices i
   set supply_date = (lower(b.experience_period) at time zone 'Asia/Dubai')::date,
       is_test     = b.is_simulated or exists (
                       select 1 from public.invoice_payments c
                         join public.payments p on p.id = c.payment_id
                        where c.invoice_id = i.id and p.is_simulated),
       payments    = coalesce((
                       select jsonb_agg(internal.invoice_payment_snapshot(c.payment_id) order by p.recorded_at, p.id)
                         from public.invoice_payments c
                         join public.payments p on p.id = c.payment_id
                        where c.invoice_id = i.id), '[]'::jsonb)
  from public.bookings b
 where b.id = i.booking_id;

alter table public.invoices alter column supply_date set not null;

comment on column public.invoices.is_test is
  '[OUR CHOICE — project owner''s direction, 13–14 September 2026] True when the booking is simulated or any payment the invoice covers was taken through the payment simulation. The printed document then says "Test — no money charged. Not a tax invoice." Invoices issued before 20260914091000 were backfilled from their booking and the payments backfilled into public.invoice_payments. Immutable after issue.';

comment on column public.invoices.supply_date is
  '[OUR CHOICE — project owner''s direction, 14 September 2026; UAE tax invoice content] The date of supply: the Dubai calendar date on which the visit starts, at issue. Invoices issued before 20260914091000 were backfilled from the booking''s visit as it stood when that migration ran. Immutable after issue.';

comment on column public.invoices.payments is
  '[OUR CHOICE — project owner''s direction, 14 September 2026; §8] The payments this invoice covers as printed, in the order they were recorded, each from internal.invoice_payment_snapshot: WP-P number, method, provider reference, amount, VAT, paid_at and is_test. public.invoice_payments is the queryable link; this is the frozen copy the document prints. Invoices issued before 20260914091000 carry the payments backfilled into public.invoice_payments, and a voided one carries none.';

comment on column public.invoices.replaces_invoice_id is
  '[OUR CHOICE — project owner''s direction, 14 September 2026] The invoice this one replaced through public.regenerate_invoice, or null for an invoice issued on payment or by Issue now.';

comment on column public.invoices.bill_to is
  '[OUR CHOICE — project owner''s direction, 13–14 September 2026] Who the invoice is addressed to, at issue: salutation, first_name, last_name, name, email and phone_e164 from the customer, and since 20260914091000 company, trn (15 digits) and address, which are null unless Management supplied them through public.issue_invoice or public.regenerate_invoice. A regenerated invoice starts from the bill-to of the invoice it replaces. Invoices issued before 20260914091000 have no company, trn or address keys; readers treat a missing key as null.';

comment on column public.invoices.lines is
  'Presentation lines, in order: the visit at the booking''s stored subtotal, one line per add-on snapshot, the overstay, the discount as a negative amount, the service fee, and any payment on account. When the add-on snapshots no longer add up to the booking''s stored add-on total, as after a manual price, the add-ons are listed as included at zero so that the lines still agree with the stored figures. Since 20260914091000 every line stores quantity, unit_price_fils, vat_rate_percent and tax_fils at issue [OUR CHOICE — project owner''s direction, 14 September 2026; UAE tax invoice content]: the booking''s stored VAT is shared across its VAT-bearing lines in proportion to their amounts, the rounding remainder on the visit line, so the lines'' tax_fils add up to the invoice''s tax_fils; the service fee [Q-20, ASSUMED] and exempt add-ons carry rate 0 and VAT 0; a payment on account (kind payment_on_account) carries the VAT its payment froze, and the invoice''s VAT is always the covered payments'' frozen VAT. An invoice for part of a booking (a later payment, a balance or money kept on a booking that was never fully paid) has an overstay line and a visit balance or part payment line instead. Lines issued before 20260914091000 carry null quantity and unit price for the visit, discount and fee, and no vat_rate_percent or tax_fils.';

comment on column public.invoices.paid_fils is
  '[OUR CHOICE — project owner''s direction, 14 September 2026] Since 20260914091000 the total of the payments this invoice covers, which is also total_fils. Before it, the money taken on the booking less refunds whose return was confirmed, at issue.';


create or replace function internal.guard_invoice_record()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_new     jsonb;
  v_old     jsonb;
  v_mutable constant text[] := array['voided_at', 'voided_by', 'void_reason', 'issued_by'];
begin
  if tg_op = 'DELETE' then
    raise exception 'An issued invoice or credit note is kept permanently. Void it instead.'
      using errcode = 'WP079';
  end if;

  v_new := to_jsonb(new);
  v_old := to_jsonb(old);

  if (v_new - v_mutable) is distinct from (v_old - v_mutable)
     or ((v_new -> 'issued_by') is distinct from (v_old -> 'issued_by') and (v_new ->> 'issued_by') is not null)
     or ((v_old ->> 'voided_at') is not null and (
           (v_new -> 'voided_at') is distinct from (v_old -> 'voided_at')
           or (v_new -> 'void_reason') is distinct from (v_old -> 'void_reason')
           or ((v_new -> 'voided_by') is distinct from (v_old -> 'voided_by') and (v_new ->> 'voided_by') is not null)))
  then
    raise exception 'An issued invoice or credit note cannot be changed. Regenerate the invoice instead.'
      using errcode = 'WP079';
  end if;

  return new;
end
$$;

revoke all on function internal.guard_invoice_record() from public, anon, authenticated, service_role;

comment on function internal.guard_invoice_record() is
  '[CLIENT console redesign brief 2026-09-11; OUR CHOICE — project owner''s direction, 14 September 2026] Issued tax invoices, credit notes and the invoice-to-payment links are immutable. The only change allowed is voiding a row once (voided_at, and on invoices and credit notes voided_by and void_reason), and a staff account being deleted may clear issued_by or voided_by through their ON DELETE SET NULL. Every delete is refused, so a voided document keeps its number. Since 20260914091000 it compares every column except those, so a column added later is immutable without editing this function, and it guards public.invoices, public.credit_notes and public.invoice_payments.';

create trigger invoice_payments_guard_record
  before update or delete on public.invoice_payments
  for each row
  execute function internal.guard_invoice_record();


create table internal.credit_note_numbering (
  id               boolean primary key default true,
  last_sequence_no bigint  not null default 0,
  constraint credit_note_numbering_single_row check (id),
  constraint credit_note_numbering_non_negative check (last_sequence_no >= 0)
);

insert into internal.credit_note_numbering (id, last_sequence_no) values (true, 0);

revoke all on internal.credit_note_numbering from public, anon, authenticated, service_role;

comment on table internal.credit_note_numbering is
  '[OUR CHOICE — project owner''s direction, 13–14 September 2026] The single counter behind public.credit_notes.sequence_no, the same pattern as internal.invoice_numbering: a row, not a SEQUENCE, because nextval is not transactional and a rolled-back issue would leave a hole. internal.issue_missing_credit_notes increments it inside the issuing transaction, so a failed issue consumes no number. Concurrent issues queue on the row lock.';


create table public.credit_notes (
  id                 uuid primary key default gen_random_uuid(),
  credit_note_number text        not null unique,
  sequence_no        bigint      not null unique,
  invoice_id         uuid        not null references public.invoices(id),
  refund_id          uuid        not null references public.refunds(id),
  booking_id         uuid        not null references public.bookings(id),
  customer_id        uuid        not null references public.customers(id),
  issued_at          timestamptz not null default clock_timestamp(),
  issued_by          uuid        references public.staff(id) on delete set null,
  invoice_number     text        not null,
  invoice_issued_at  timestamptz not null,
  supply_date        date        not null,
  issuer             jsonb       not null,
  bill_to            jsonb       not null,
  tax                jsonb       not null,
  lines              jsonb       not null,
  refund             jsonb       not null,
  reason             text        not null,
  amount_fils        integer     not null,
  tax_fils           integer     not null,
  taxable_fils       integer     not null,
  currency           text        not null,
  is_test            boolean     not null,
  voided_at          timestamptz,
  voided_by          uuid        references public.staff(id) on delete set null,
  void_reason        text,
  constraint credit_notes_amount_positive check (amount_fils > 0),
  constraint credit_notes_tax_within_amount check (tax_fils >= 0 and tax_fils <= amount_fils),
  constraint credit_notes_taxable_within_amount check (taxable_fils >= 0 and taxable_fils <= amount_fils),
  constraint credit_notes_sequence_positive check (sequence_no > 0),
  constraint credit_notes_number_shaped check (credit_note_number ~ '^CN-[0-9]{4}-[0-9]{6,}$'),
  constraint credit_notes_currency_shaped check (currency ~ '^[A-Z]{3}$'),
  constraint credit_notes_issuer_shaped check (
    jsonb_typeof(issuer) = 'object' and issuer ?& array['legal_name', 'trn', 'address']
  ),
  constraint credit_notes_bill_to_shaped check (jsonb_typeof(bill_to) = 'object'),
  constraint credit_notes_tax_shaped check (jsonb_typeof(tax) = 'object'),
  constraint credit_notes_lines_shaped check (jsonb_typeof(lines) = 'array'),
  constraint credit_notes_refund_shaped check (jsonb_typeof(refund) = 'object'),
  constraint credit_notes_void_recorded check ((voided_at is null) = (void_reason is null)),
  constraint credit_notes_void_reason_length check (
    void_reason is null or length(btrim(void_reason)) between 1 and 500
  )
);

create unique index credit_notes_one_valid_per_refund_idx on public.credit_notes (refund_id) where voided_at is null;
create index credit_notes_refund_idx on public.credit_notes (refund_id);
create index credit_notes_invoice_idx on public.credit_notes (invoice_id);
create index credit_notes_booking_idx on public.credit_notes (booking_id);
create index credit_notes_customer_idx on public.credit_notes (customer_id);
create index credit_notes_issued_by_idx on public.credit_notes (issued_by);
create index credit_notes_voided_by_idx on public.credit_notes (voided_by);
create index credit_notes_issued_order_idx on public.credit_notes (issued_at desc, sequence_no desc);

alter table public.credit_notes enable row level security;

revoke all on public.credit_notes from public, anon, authenticated, service_role;
grant select on public.credit_notes to authenticated;

create policy credit_notes_select_confidential on public.credit_notes
  for select to authenticated
  using ((select internal.has_permission('view_confidential_figures'::public.named_permission)));

create trigger credit_notes_guard_record
  before update or delete on public.credit_notes
  for each row
  execute function internal.guard_invoice_record();

comment on table public.credit_notes is
  '[OUR CHOICE — project owner''s direction, 13–14 September 2026: refunds answered "Credit note (Recommended)"; §8, §11.2, INV-21] Tax credit notes, the conventional UAE record of a refund on invoiced money, to be confirmed with the client''s accountant. Every settled refund on a payment covered by a valid invoice is on exactly one valid credit note (credit_notes_one_valid_per_refund_idx), linked to that refund and to the invoice covering the refunded payment. amount_fils is the refund amount and tax_fils the refund''s stored VAT share (internal.refund_tax_share of the refunded payment); taxable_fils is the difference. The number is CN-{Dubai year of issue}-{sequence of at least six digits} from internal.credit_note_numbering, gapless. issuer, bill_to, tax, currency and supply_date are copied from the invoice, so a credit note never depends on Settings; invoice_number and invoice_issued_at name the original invoice; refund freezes the WP-R number, provider reference, request and settlement times and the refunded payment''s WP-P number and method; reason is the refund reason; is_test marks a test document. A withdrawn refund, a pending one and a refund on a payment the settlement refunded itself have none. A credit note is voided only by public.regenerate_invoice, together with its invoice. Readable with view_confidential_figures, which Management holds implicitly; no role writes it directly, internal.issue_missing_credit_notes and public.regenerate_invoice are the only writers, and internal.guard_invoice_record refuses every other change and every delete.';


create function internal.invoice_bill_to(p_base jsonb, p_override jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_result jsonb := jsonb_build_object('company', null, 'trn', null, 'address', null) || coalesce(p_base, '{}'::jsonb);
  v_key    text;
  v_value  text;
begin
  if p_override is null or jsonb_typeof(p_override) = 'null' then
    return v_result;
  end if;

  if jsonb_typeof(p_override) <> 'object' then
    raise exception 'Enter the bill-to details as a name, company, tax registration number and address.'
      using errcode = '22023';
  end if;

  for v_key in select jsonb_object_keys(p_override) loop
    if v_key not in ('name', 'company', 'trn', 'address') then
      raise exception 'Only the name, company, tax registration number and address can be changed on an invoice.'
        using errcode = '22023';
    end if;

    if jsonb_typeof(p_override -> v_key) not in ('string', 'null') then
      raise exception 'Enter the bill-to name, company, tax registration number and address as text.'
        using errcode = '22023';
    end if;

    v_value := nullif(btrim(p_override ->> v_key), '');

    if v_key = 'name' and (v_value is null or length(v_value) > 200) then
      raise exception 'Enter the name to bill, up to 200 characters.'
        using errcode = '22023';
    end if;

    if v_key = 'company' and length(v_value) > 200 then
      raise exception 'Enter a company name of up to 200 characters.'
        using errcode = '22023';
    end if;

    if v_key = 'trn' and v_value !~ '^[0-9]{15}$' then
      raise exception 'Enter the customer''s tax registration number as 15 digits, or leave it empty.'
        using errcode = '22023';
    end if;

    if v_key = 'address' and length(v_value) > 500 then
      raise exception 'Enter an address of up to 500 characters.'
        using errcode = '22023';
    end if;

    v_result := v_result || jsonb_build_object(v_key, v_value);
  end loop;

  return v_result;
end
$$;

revoke all on function internal.invoice_bill_to(jsonb, jsonb) from public, anon, authenticated, service_role;

comment on function internal.invoice_bill_to(jsonb, jsonb) is
  '[OUR CHOICE — project owner''s direction, 14 September 2026: "market standard"] Applies Management''s bill-to corrections to a base bill-to. Only name (required when given, up to 200 characters), company (up to 200), trn (exactly 15 digits) and address (up to 500) may be supplied; text is trimmed, and an empty company, trn or address clears it. Any other key, a non-text value or an invalid value refuses with 22023. The result always carries company, trn and address keys.';


create function internal.issue_missing_credit_notes(p_booking_id uuid, p_issued_by uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund   record;
  v_note     public.credit_notes%rowtype;
  v_sequence bigint;
  v_now      timestamptz := clock_timestamp();
  v_count    integer := 0;
begin
  for v_refund in
    select rf.id, rf.reference, rf.amount_fils, rf.tax_fils, rf.reason, rf.requested_at, rf.settled_at,
           rf.provider_reference,
           p.id as payment_id, p.reference as payment_number, p.method as payment_method, p.is_simulated,
           i.id as invoice_id, i.invoice_number, i.issued_at as invoice_issued_at, i.supply_date,
           i.issuer, i.bill_to, i.tax, i.currency, i.is_test, i.customer_id, i.booking_id
      from public.refunds rf
      join public.payments p on p.id = rf.payment_id
      join public.invoice_payments c on c.payment_id = p.id and c.voided_at is null
      join public.invoices i on i.id = c.invoice_id
     where rf.booking_id = p_booking_id
       and rf.settled_at is not null
       and rf.withdrawn_at is null
       and not exists (
         select 1 from public.credit_notes cn where cn.refund_id = rf.id and cn.voided_at is null)
     order by rf.settled_at, rf.id
  loop
    perform internal.lock_rows_for_document(pg_catalog.format(
      'select 1 from public.bookings b where b.id = %L for key share', v_refund.booking_id));
    perform internal.lock_rows_for_document(pg_catalog.format(
      'select 1 from public.customers c where c.id = %L for key share', v_refund.customer_id));
    perform internal.lock_rows_for_document(pg_catalog.format(
      'select 1 from public.refunds r where r.id = %L for key share', v_refund.id));
    perform internal.lock_rows_for_document(pg_catalog.format(
      'select 1 from public.invoices i where i.id = %L for key share', v_refund.invoice_id));
    perform internal.take_document_lock('credit_note_numbering');
    perform internal.lock_rows_for_document('select 1 from internal.credit_note_numbering n where n.id for update');

    update internal.credit_note_numbering n
       set last_sequence_no = n.last_sequence_no + 1
     where n.id
    returning n.last_sequence_no into v_sequence;

    insert into public.credit_notes (
      credit_note_number, sequence_no, invoice_id, refund_id, booking_id, customer_id, issued_at, issued_by,
      invoice_number, invoice_issued_at, supply_date, issuer, bill_to, tax, lines, refund, reason,
      amount_fils, tax_fils, taxable_fils, currency, is_test
    )
    values (
      'CN-' || to_char(v_now at time zone 'Asia/Dubai', 'YYYY') || '-'
        || lpad(v_sequence::text, greatest(6, length(v_sequence::text)), '0'),
      v_sequence,
      v_refund.invoice_id,
      v_refund.id,
      v_refund.booking_id,
      v_refund.customer_id,
      v_now,
      p_issued_by,
      v_refund.invoice_number,
      v_refund.invoice_issued_at,
      v_refund.supply_date,
      v_refund.issuer,
      v_refund.bill_to,
      v_refund.tax,
      jsonb_build_array(jsonb_build_object(
        'kind',             'refund',
        'label',            'Refund',
        'quantity',         1,
        'unit_price_fils',  v_refund.amount_fils,
        'amount_fils',      v_refund.amount_fils,
        'is_included',      false,
        'is_taxable',       v_refund.tax_fils > 0,
        'vat_rate_percent', case when v_refund.tax_fils > 0 then v_refund.tax -> 'rate_percent' else to_jsonb(0) end,
        'tax_fils',         v_refund.tax_fils
      )),
      jsonb_build_object(
        'refund_id',          v_refund.id,
        'number',             v_refund.reference,
        'provider_reference', v_refund.provider_reference,
        'requested_at',       v_refund.requested_at,
        'settled_at',         v_refund.settled_at,
        'payment_id',         v_refund.payment_id,
        'payment_number',     v_refund.payment_number,
        'payment_method',     v_refund.payment_method
      ),
      v_refund.reason,
      v_refund.amount_fils,
      v_refund.tax_fils,
      v_refund.amount_fils - v_refund.tax_fils,
      v_refund.currency,
      v_refund.is_test or v_refund.is_simulated
    )
    returning * into v_note;

    perform internal.write_audit(
      'issue_credit_note',
      'public.credit_notes',
      v_note.id::text,
      null::jsonb,
      jsonb_build_object(
        'credit_note_number', v_note.credit_note_number,
        'sequence_no',        v_note.sequence_no,
        'invoice_id',         v_note.invoice_id,
        'invoice_number',     v_note.invoice_number,
        'refund_id',          v_note.refund_id,
        'refund_reference',   v_refund.reference,
        'booking_id',         v_note.booking_id,
        'amount_fils',        v_note.amount_fils,
        'tax_fils',           v_note.tax_fils,
        'is_automatic',       p_issued_by is null,
        'is_test',            v_note.is_test
      ),
      'Credit note issued for refund ' || v_refund.reference || ' against invoice ' || v_note.invoice_number
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end
$$;

revoke all on function internal.issue_missing_credit_notes(uuid, uuid) from public, anon, authenticated, service_role;

comment on function internal.issue_missing_credit_notes(uuid, uuid) is
  '[OUR CHOICE — project owner''s direction, 14 September 2026; §8, §11.2] Issues a credit note for every settled, not withdrawn refund of the booking whose payment is covered by a valid invoice and which has no valid credit note yet, in settlement order, and returns how many it issued. Each is attached to the invoice covering the refunded payment and carries the refund amount and the refund''s stored VAT share. It never reads Settings, so a credit note cannot fail on incomplete invoice details. Called at the end of every invoice issue, which gives refunds settled before the invoice existed their credit notes in the same transaction (rule 3), and by internal.issue_credit_notes_when_refunded when a refund settles. The caller holds the booking row lock. p_issued_by is the manager, or null for an automatic issue. Writes one audit entry per credit note.';


create function internal.has_uncovered_payment(p_booking_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.payments p
     where p.booking_id = p_booking_id
       and p.status in ('paid'::public.payment_status, 'partially_refunded'::public.payment_status,
                        'fully_refunded'::public.payment_status)
       and p.amount_fils > 0
       and not exists (
         select 1 from public.refunds r
          where r.payment_id = p.id and r.requested_by is null and r.withdrawn_at is null)
       and not exists (
         select 1 from public.invoice_payments c
          where c.payment_id = p.id and c.voided_at is null))
$$;

revoke all on function internal.has_uncovered_payment(uuid) from public, anon, authenticated, service_role;

comment on function internal.has_uncovered_payment(uuid) is
  '[OUR CHOICE — project owner''s direction, 14 September 2026] Whether the booking holds a paid, partially refunded or fully refunded payment with a positive amount that no valid invoice covers, leaving out payments the settlement refunded itself (a refund with no requesting staff member). The same rule internal.issue_booking_invoice uses to choose what an invoice covers.';


create function internal.absorb_invoice_gaps(p_booking_id uuid, p_issued_by uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice record;
  v_payment record;
  v_gap     bigint;
  v_count   integer := 0;
begin
  for v_invoice in
    select i.id,
           i.invoice_number,
           i.total_fils - coalesce((
             select sum(c.amount_fils) from public.invoice_payments c
              where c.invoice_id = i.id and c.voided_at is null), 0) as gap_fils
      from public.invoices i
     where i.booking_id = p_booking_id and i.voided_at is null
     order by i.sequence_no
  loop
    v_gap := v_invoice.gap_fils;
    continue when v_gap <= 0;

    for v_payment in
      select p.id, p.reference, p.amount_fils, p.tax_fils
        from public.payments p
       where p.booking_id = p_booking_id
         and p.status in ('paid'::public.payment_status, 'partially_refunded'::public.payment_status,
                          'fully_refunded'::public.payment_status)
         and p.amount_fils > 0
         and not exists (
           select 1 from public.refunds r
            where r.payment_id = p.id and r.requested_by is null and r.withdrawn_at is null)
         and not exists (
           select 1 from public.invoice_payments c
            where c.payment_id = p.id and c.voided_at is null)
       order by p.recorded_at, p.id
    loop
      exit when v_payment.amount_fils > v_gap;

      perform internal.lock_rows_for_document(pg_catalog.format(
        'select 1 from public.payments p where p.id = %L for key share', v_payment.id));

      insert into public.invoice_payments (invoice_id, payment_id, amount_fils, tax_fils)
      values (v_invoice.id, v_payment.id, v_payment.amount_fils, v_payment.tax_fils);

      perform internal.write_audit(
        'cover_invoice_payment',
        'public.invoices',
        v_invoice.id::text,
        jsonb_build_object('invoice_number', v_invoice.invoice_number, 'gap_fils', v_gap),
        jsonb_build_object(
          'invoice_number', v_invoice.invoice_number,
          'payment_id',     v_payment.id,
          'payment_number', v_payment.reference,
          'amount_fils',    v_payment.amount_fils,
          'gap_fils',       v_gap - v_payment.amount_fils,
          'is_automatic',   p_issued_by is null
        ),
        'Payment ' || v_payment.reference || ' linked to invoice ' || v_invoice.invoice_number
          || ', which was issued for the booking''s whole value before the payment arrived'
      );

      v_gap := v_gap - v_payment.amount_fils;
      v_count := v_count + 1;
    end loop;
  end loop;

  return v_count;
end
$$;

revoke all on function internal.absorb_invoice_gaps(uuid, uuid) from public, anon, authenticated, service_role;

comment on function internal.absorb_invoice_gaps(uuid, uuid) is
  '[OUR CHOICE — project owner''s direction, 14 September 2026; adversary finding P2-B] An invoice issued before 20260914091000 carries the booking''s whole value even when only a deposit had been paid, so its total can exceed the payments public.invoice_payments links to it. Before any new invoice is issued, this links the booking''s uncovered payments to such an invoice, whole and in the order recorded, while they fit the remaining gap, and stops at the first payment that does not fit, so a balance paid later is documented by the invoice that already carries its value instead of a second one. A payment is never split between invoices; one that does not fit makes internal.issue_booking_invoice refuse with WP086 until Management regenerates the earlier invoice. Invoices issued since 20260914091000 have no gap, so this changes nothing for them. The caller holds the booking row lock. Writes an audit entry per payment linked and returns how many.';


create function internal.issue_booking_invoice(
  p_booking_id          uuid,
  p_issued_by           uuid,
  p_bill_to             jsonb,
  p_replaces_invoice_id uuid
)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking           public.bookings%rowtype;
  v_customer          public.customers%rowtype;
  v_invoice           public.invoices%rowtype;
  v_name              text;
  v_trn               text;
  v_address           text;
  v_prefix            text;
  v_currency          text;
  v_fee_label         text;
  v_rate              jsonb;
  v_line_rate         jsonb;
  v_tax               jsonb;
  v_on_top            boolean;
  v_bill_to           jsonb;
  v_payment_ids       uuid[];
  v_covered           integer;
  v_covered_tax       integer;
  v_paid_by_test      boolean;
  v_invoiced_visit    bigint;
  v_invoiced_overrun  bigint;
  v_open_overrun      integer;
  v_overrun           integer;
  v_overrun_tax       integer;
  v_on_account        integer;
  v_on_account_tax    integer;
  v_visit_extra       integer;
  v_balance           integer;
  v_balance_tax       integer;
  v_adults            integer;
  v_children          integer;
  v_addons_consistent boolean;
  v_taxable_base      bigint;
  v_addon_tax         integer;
  v_discount_tax      integer;
  v_lines             jsonb;
  v_subtotal          integer;
  v_discount          integer;
  v_addons            integer;
  v_service_fee       integer;
  v_tax_fils          integer;
  v_taxable           integer;
  v_sequence          bigint;
  v_now               timestamptz := clock_timestamp();
begin
  select * into v_booking from public.bookings b where b.id = p_booking_id;

  if not found then
    raise exception 'This booking could not be found. Refresh the list and open it again.'
      using errcode = 'P0002';
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

  select array_agg(p.id order by p.recorded_at, p.id),
         coalesce(sum(p.amount_fils), 0)::integer,
         coalesce(sum(p.tax_fils), 0)::integer,
         coalesce(bool_or(p.is_simulated), false)
    into v_payment_ids, v_covered, v_covered_tax, v_paid_by_test
    from public.payments p
   where p.booking_id = p_booking_id
     and p.status in ('paid'::public.payment_status, 'partially_refunded'::public.payment_status,
                      'fully_refunded'::public.payment_status)
     and p.amount_fils > 0
     and not exists (
       select 1 from public.refunds r
        where r.payment_id = p.id and r.requested_by is null and r.withdrawn_at is null)
     and not exists (
       select 1 from public.invoice_payments c
        where c.payment_id = p.id and c.voided_at is null)
     and (p_replaces_invoice_id is null or exists (
       select 1 from public.invoice_payments c
        where c.payment_id = p.id and c.invoice_id = p_replaces_invoice_id));

  if v_covered <= 0 then
    raise exception 'There is no payment on this booking that still needs an invoice. Issue the invoice once a payment has been received.'
      using errcode = 'WP078';
  end if;

  if p_replaces_invoice_id is null and exists (
    select 1 from public.invoices i
     where i.booking_id = p_booking_id
       and i.voided_at is null
       and i.total_fils > coalesce((
         select sum(c.amount_fils) from public.invoice_payments c
          where c.invoice_id = i.id and c.voided_at is null), 0)
  ) then
    raise exception 'An earlier invoice for this booking was issued for more than the payments linked to it, and this payment does not fit what it still covers. Regenerate that invoice, then issue the invoice again.'
      using errcode = 'WP086';
  end if;

  select * into v_customer from public.customers c where c.id = v_booking.customer_id;

  v_bill_to := internal.invoice_bill_to(
    coalesce(
      (select i.bill_to from public.invoices i where i.id = p_replaces_invoice_id),
      jsonb_build_object(
        'salutation', v_customer.salutation,
        'first_name', v_customer.first_name,
        'last_name',  v_customer.last_name,
        'name',       btrim(v_customer.first_name || ' ' || v_customer.last_name),
        'email',      v_customer.email,
        'phone_e164', v_customer.phone_e164
      )
    ),
    p_bill_to
  );

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

  v_rate := (
    select s.value from public.settings s
     where s.key = 'tax.vat_percent' and jsonb_typeof(s.value) = 'number'
  );

  v_on_top := internal.vat_added_on_top(
    v_booking.subtotal_fils, v_booking.discount_fils, v_booking.addons_fils,
    v_booking.service_fee_fils, v_booking.tax_fils, v_booking.total_fils
  );

  v_tax := jsonb_build_object(
    'label', coalesce(
      (select nullif(btrim(s.value #>> '{}'), '') from public.settings s where s.key = 'tax.label'),
      'VAT'
    ),
    'rate_percent', v_rate,
    'is_included', not v_on_top
  );

  select coalesce(sum(i.total_fils - i.overrun_fils - coalesce((
           select sum((l ->> 'amount_fils')::integer) from jsonb_array_elements(i.lines) l
            where l ->> 'kind' = 'payment_on_account'), 0)), 0),
         coalesce(sum(i.overrun_fils), 0)
    into v_invoiced_visit, v_invoiced_overrun
    from public.invoices i
   where i.booking_id = p_booking_id and i.voided_at is null;

  v_open_overrun := greatest(0, coalesce(v_booking.overrun_fils, 0) - v_invoiced_overrun)::integer;

  if v_invoiced_visit <= 0 and v_covered >= v_booking.total_fils + v_open_overrun then
    v_overrun     := v_open_overrun;
    v_overrun_tax := internal.inclusive_vat_fils(v_overrun);
    v_on_account  := v_covered - v_booking.total_fils - v_overrun;
    v_line_rate   := case when v_booking.tax_fils > 0 then v_rate else to_jsonb(0) end;
    v_on_account_tax := least(v_on_account, greatest(0, v_covered_tax - v_booking.tax_fils - v_overrun_tax));
    v_visit_extra    := v_covered_tax - v_booking.tax_fils - v_overrun_tax - v_on_account_tax;

    v_addons_consistent := coalesce(
      (select sum(a.line_total_fils) from public.booking_addons a where a.booking_id = p_booking_id),
      0
    ) = v_booking.addons_fils;

    v_taxable_base := v_booking.subtotal_fils - v_booking.discount_fils
      + case when v_addons_consistent then coalesce(
          (select sum(a.line_total_fils) from public.booking_addons a
            where a.booking_id = p_booking_id and a.is_taxable), 0)
        else 0 end;

    v_addon_tax := case when v_addons_consistent and v_taxable_base <> 0 then coalesce((
      select sum(round(v_booking.tax_fils::numeric * a.line_total_fils / v_taxable_base)::integer)
        from public.booking_addons a
       where a.booking_id = p_booking_id and a.is_taxable
    ), 0)::integer else 0 end;

    v_discount_tax := case when v_taxable_base <> 0
      then round(v_booking.tax_fils::numeric * v_booking.discount_fils / v_taxable_base)::integer
      else 0 end;

    v_lines :=
      jsonb_build_array(jsonb_build_object(
        'kind',             'visit',
        'label',            'Visit',
        'adults',           v_adults,
        'children',         v_children,
        'starts_at',        lower(v_booking.experience_period),
        'ends_at',          upper(v_booking.experience_period),
        'quantity',         1,
        'unit_price_fils',  v_booking.subtotal_fils,
        'amount_fils',      v_booking.subtotal_fils,
        'is_included',      false,
        'is_taxable',       v_booking.tax_fils + v_visit_extra > 0,
        'vat_rate_percent', case when v_booking.tax_fils + v_visit_extra > 0 then v_rate else to_jsonb(0) end,
        'tax_fils',         v_booking.tax_fils - v_addon_tax + v_discount_tax + v_visit_extra
      ))
      || coalesce((
        select jsonb_agg(jsonb_build_object(
                 'kind',             'addon',
                 'label',            a.name_snapshot,
                 'quantity',         a.quantity,
                 'unit_price_fils',  case when v_addons_consistent then a.unit_price_fils else 0 end,
                 'amount_fils',      case when v_addons_consistent then a.line_total_fils else 0 end,
                 'is_included',      case when v_addons_consistent then a.is_included else true end,
                 'is_taxable',       a.is_taxable,
                 'vat_rate_percent', case when a.is_taxable and v_addons_consistent then v_line_rate else to_jsonb(0) end,
                 'tax_fils',         case when a.is_taxable and v_addons_consistent and v_taxable_base <> 0
                                       then round(v_booking.tax_fils::numeric * a.line_total_fils / v_taxable_base)::integer
                                       else 0 end
               ) order by a.created_at, a.id)
          from public.booking_addons a
         where a.booking_id = p_booking_id
      ), '[]'::jsonb)
      || case when v_overrun > 0 then jsonb_build_array(jsonb_build_object(
           'kind',             'overrun',
           'label',            'Overstay',
           'minutes',          v_booking.overrun_minutes,
           'quantity',         1,
           'unit_price_fils',  v_overrun,
           'amount_fils',      v_overrun,
           'is_included',      false,
           'is_taxable',       true,
           'vat_rate_percent', case when v_overrun_tax > 0 then v_rate else to_jsonb(0) end,
           'tax_fils',         v_overrun_tax
         )) else '[]'::jsonb end
      || case when v_booking.discount_fils > 0 then jsonb_build_array(jsonb_build_object(
           'kind',             'discount',
           'label',            'Discount',
           'quantity',         1,
           'unit_price_fils',  -v_booking.discount_fils,
           'amount_fils',      -v_booking.discount_fils,
           'is_included',      false,
           'is_taxable',       v_booking.tax_fils > 0,
           'vat_rate_percent', v_line_rate,
           'tax_fils',         -v_discount_tax
         )) else '[]'::jsonb end
      || case when v_booking.service_fee_fils > 0 then jsonb_build_array(jsonb_build_object(
           'kind',             'service_fee',
           'label',            v_fee_label,
           'quantity',         1,
           'unit_price_fils',  v_booking.service_fee_fils,
           'amount_fils',      v_booking.service_fee_fils,
           'is_included',      false,
           'is_taxable',       false,
           'vat_rate_percent', to_jsonb(0),
           'tax_fils',         0
         )) else '[]'::jsonb end
      || case when v_on_account > 0 then jsonb_build_array(jsonb_build_object(
           'kind',             'payment_on_account',
           'label',            'Payment on account',
           'quantity',         1,
           'unit_price_fils',  v_on_account,
           'amount_fils',      v_on_account,
           'is_included',      false,
           'is_taxable',       v_on_account_tax > 0,
           'vat_rate_percent', case when v_on_account_tax > 0 then v_rate else to_jsonb(0) end,
           'tax_fils',         v_on_account_tax
         )) else '[]'::jsonb end;

    v_subtotal    := v_booking.subtotal_fils;
    v_discount    := v_booking.discount_fils;
    v_addons      := v_booking.addons_fils;
    v_service_fee := v_booking.service_fee_fils;
    v_tax_fils    := v_covered_tax;
    v_taxable     := greatest(0, least(v_covered,
                       internal.invoice_taxable_fils(
                         p_booking_id, v_booking.subtotal_fils, v_booking.discount_fils, v_booking.addons_fils,
                         v_booking.service_fee_fils, v_booking.tax_fils, v_booking.total_fils
                       )
                       + (v_overrun - v_overrun_tax)
                       + case when v_on_account_tax > 0 then v_on_account - v_on_account_tax else 0 end
                       - case when v_on_top then 0 else v_visit_extra end
                     ));
  else
    v_balance     := least(v_covered, greatest(0, v_booking.total_fils - greatest(v_invoiced_visit, 0)))::integer;
    v_overrun     := least(v_covered - v_balance, v_open_overrun);
    v_on_account  := v_covered - v_balance - v_overrun;
    v_overrun_tax := least(internal.inclusive_vat_fils(v_overrun), v_covered_tax);
    v_balance_tax := least(
                       v_balance,
                       v_covered_tax - v_overrun_tax,
                       case when v_on_account > 0 and v_booking.total_fils > 0
                         then round(v_booking.tax_fils::numeric * v_balance / v_booking.total_fils)::integer
                         else v_balance end
                     );
    v_on_account_tax := least(v_on_account, v_covered_tax - v_overrun_tax - v_balance_tax);
    v_visit_extra    := v_covered_tax - v_overrun_tax - v_balance_tax - v_on_account_tax;
    v_overrun_tax    := v_overrun_tax + least(v_overrun - v_overrun_tax, v_visit_extra);
    v_balance_tax    := v_covered_tax - v_overrun_tax - v_on_account_tax;

    v_lines :=
      case when v_overrun > 0 then jsonb_build_array(jsonb_build_object(
        'kind',             'overrun',
        'label',            'Overstay',
        'minutes',          v_booking.overrun_minutes,
        'quantity',         1,
        'unit_price_fils',  v_overrun,
        'amount_fils',      v_overrun,
        'is_included',      false,
        'is_taxable',       true,
        'vat_rate_percent', case when v_overrun_tax > 0 then v_rate else to_jsonb(0) end,
        'tax_fils',         v_overrun_tax
      )) else '[]'::jsonb end
      || case when v_balance > 0 then jsonb_build_array(jsonb_build_object(
        'kind',             'visit',
        'label',            case when v_invoiced_visit > 0 then 'Visit balance' else 'Visit part payment' end,
        'adults',           v_adults,
        'children',         v_children,
        'starts_at',        lower(v_booking.experience_period),
        'ends_at',          upper(v_booking.experience_period),
        'quantity',         1,
        'unit_price_fils',  v_balance,
        'amount_fils',      v_balance,
        'is_included',      false,
        'is_taxable',       v_balance_tax > 0,
        'vat_rate_percent', case when v_balance_tax > 0 then v_rate else to_jsonb(0) end,
        'tax_fils',         v_balance_tax
      )) else '[]'::jsonb end
      || case when v_on_account > 0 then jsonb_build_array(jsonb_build_object(
        'kind',             'payment_on_account',
        'label',            'Payment on account',
        'quantity',         1,
        'unit_price_fils',  v_on_account,
        'amount_fils',      v_on_account,
        'is_included',      false,
        'is_taxable',       v_on_account_tax > 0,
        'vat_rate_percent', case when v_on_account_tax > 0 then v_rate else to_jsonb(0) end,
        'tax_fils',         v_on_account_tax
      )) else '[]'::jsonb end;

    v_subtotal    := v_balance;
    v_discount    := 0;
    v_addons      := 0;
    v_service_fee := 0;
    v_tax_fils    := v_covered_tax;
    v_taxable     := (v_overrun - v_overrun_tax) + (v_balance - v_balance_tax)
                     + case when v_on_account_tax > 0 then v_on_account - v_on_account_tax else 0 end;
  end if;

  perform internal.lock_rows_for_document(pg_catalog.format(
    'select 1 from public.customers c where c.id = %L for key share', v_booking.customer_id));
  perform internal.lock_rows_for_document(pg_catalog.format(
    'select 1 from public.payments p where p.id = any (%L::uuid[]) order by p.id for key share', v_payment_ids));
  perform internal.take_document_lock('invoice_numbering');
  perform internal.lock_rows_for_document('select 1 from internal.invoice_numbering n where n.id for update');

  update internal.invoice_numbering n
     set last_sequence_no = n.last_sequence_no + 1
   where n.id
  returning n.last_sequence_no into v_sequence;

  insert into public.invoices (
    invoice_number, sequence_no, booking_id, customer_id, issued_at, issued_by,
    issuer, bill_to, lines, tax,
    subtotal_fils, discount_fils, addons_fils, service_fee_fils, tax_fils, total_fils,
    paid_fils, currency, taxable_fils, overrun_fils,
    is_test, supply_date, payments, replaces_invoice_id
  )
  values (
    v_prefix || '-' || to_char(v_now at time zone 'Asia/Dubai', 'YYYY') || '-'
      || lpad(v_sequence::text, greatest(6, length(v_sequence::text)), '0'),
    v_sequence,
    p_booking_id,
    v_booking.customer_id,
    v_now,
    p_issued_by,
    jsonb_build_object('legal_name', v_name, 'trn', v_trn, 'address', v_address),
    v_bill_to,
    v_lines,
    v_tax,
    v_subtotal,
    v_discount,
    v_addons,
    v_service_fee,
    v_tax_fils,
    v_covered,
    v_covered,
    v_currency,
    v_taxable,
    v_overrun,
    v_booking.is_simulated or v_paid_by_test,
    (lower(v_booking.experience_period) at time zone 'Asia/Dubai')::date,
    (select jsonb_agg(internal.invoice_payment_snapshot(x.id) order by x.position)
       from unnest(v_payment_ids) with ordinality as x(id, position)),
    p_replaces_invoice_id
  )
  returning * into v_invoice;

  insert into public.invoice_payments (invoice_id, payment_id, amount_fils, tax_fils)
  select v_invoice.id, p.id, p.amount_fils, p.tax_fils
    from public.payments p
   where p.id = any (v_payment_ids);

  perform internal.write_audit(
    'issue_invoice',
    'public.invoices',
    v_invoice.id::text,
    null::jsonb,
    jsonb_build_object(
      'invoice_number',      v_invoice.invoice_number,
      'sequence_no',         v_invoice.sequence_no,
      'booking_id',          p_booking_id,
      'booking_reference',   v_booking.reference,
      'payment_ids',         to_jsonb(v_payment_ids),
      'total_fils',          v_invoice.total_fils,
      'tax_fils',            v_invoice.tax_fils,
      'taxable_fils',        v_invoice.taxable_fils,
      'overrun_fils',        v_invoice.overrun_fils,
      'paid_fils',           v_invoice.paid_fils,
      'currency',            v_invoice.currency,
      'is_automatic',        p_issued_by is null,
      'is_test',             v_invoice.is_test,
      'bill_to_corrected',   p_bill_to is not null,
      'replaces_invoice_id', p_replaces_invoice_id
    ),
    case
      when p_issued_by is null then 'Tax invoice issued automatically when booking ' || v_booking.reference || ' was paid'
      when p_replaces_invoice_id is not null then 'Tax invoice issued to replace a regenerated invoice for booking ' || v_booking.reference
      else 'Tax invoice issued for booking ' || v_booking.reference
    end
  );

  perform internal.issue_missing_credit_notes(p_booking_id, p_issued_by);

  return v_invoice;
end
$$;

revoke all on function internal.issue_booking_invoice(uuid, uuid, jsonb, uuid) from public, anon, authenticated, service_role;

comment on function internal.issue_booking_invoice(uuid, uuid, jsonb, uuid) is
  '[OUR CHOICE — project owner''s direction, 13–14 September 2026; CLIENT console redesign brief 2026-09-11; §8, INV-21] The one place a tax invoice is built and written, shared by the automatic issue on payment (internal.issue_invoice_when_paid), Management''s Issue now (public.issue_invoice) and public.regenerate_invoice. The caller holds the booking row lock. p_issued_by is the manager, or null for an automatic issue.

Refusals, in order: WP076 until the legal name, a 15-digit tax registration number and the address are in Settings and the number prefix is letters and digits; WP077 for a complimentary booking; WP078 when there is no payment to cover; WP086, outside a regenerate, while a valid earlier invoice still has a gap that internal.absorb_invoice_gaps could not fill with the payment to cover; 22023 for invalid bill-to corrections (internal.invoice_bill_to). The number comes from internal.invoice_numbering after every refusal, so a refused or rolled-back issue consumes no number.

WHAT IT COVERS. Every paid, partially refunded or fully refunded payment of the booking with a positive amount that no valid invoice covers, whole, except payments the settlement refunded itself (a refund with no requesting staff member: the §8.2 recovery, stale and duplicate payments), which get neither an invoice nor a credit note. With p_replaces_invoice_id only the payments the replaced invoice covered. total_fils and paid_fils are the covered amount, so valid invoice totals less valid credit note totals always equal payments received less refunds settled once nothing is missing.

WHAT IT PRINTS. When nothing is invoiced for the visit yet (the totals of earlier valid invoices, less their overstay and payment on account lines, at or below zero; credit notes are not subtracted, because a refund never reopens a visit balance — adversary round 2, P3-1) and the covered money reaches the booking total plus the overstay no valid invoice carries, the invoice snapshots the whole stored breakdown as issue_invoice did before: visit, add-ons with their VAT snapshot, the open overstay with VAT at the inclusive rate, discount, service fee, taxable_fils from internal.invoice_taxable_fils, VAT shown as included unless internal.vat_added_on_top reads it as added on top; money above that is a payment_on_account line. Otherwise (a later payment, a balance after a reprice, or money kept on a booking that was never fully paid) it prints, in order, a Visit balance or Visit part payment line up to the visit value no valid invoice carries yet, the open overstay, and a payment_on_account line for any rest. Each line stores quantity, unit price, VAT rate and VAT.

VAT, SINCE ADVERSARY FINDING P2-A. [OUR CHOICE — project owner''s direction, 14 September 2026] An invoice''s tax_fils is always the frozen VAT of the payments it covers (payments.tax_fils), so valid invoice VAT less valid credit note VAT equals payment VAT less settled refund VAT, and the lines'' VAT always adds up to it. A payment on account is VAT-bearing like any advance payment and carries the VAT its payment froze. On a full breakdown the booking''s stored VAT is shared across its lines, the payment on account takes the covered VAT above that up to its amount, and any remainder goes to the visit line; on a part invoice the overstay takes the VAT inside its charge, the visit line up to the rest, the payment on account the remainder, with any overflow back on the overstay and then the visit line, never above a line''s amount.

It snapshots the bill-to (from the replaced invoice when regenerating, otherwise from the customer, then Management''s corrections), the date of supply (the visit''s Dubai date), the covered payments and is_test, writes public.invoice_payments and its own audit entry, and finally issues the credit notes for refunds that already settled on the booking''s covered payments through internal.issue_missing_credit_notes.';


create function internal.issue_invoice_when_paid(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lock_timeout text := pg_catalog.current_setting('lock_timeout');
  v_deadline     text := pg_catalog.current_setting('wellplace.document_step_deadline', true);
  v_state        text;
begin
  if not exists (
    select 1
      from public.bookings b
      cross join lateral (
        select coalesce(sum(p.amount_fils), 0) as gross_fils,
               coalesce(bool_or(not exists (
                 select 1 from public.invoice_payments c
                  where c.payment_id = p.id and c.voided_at is null)), false) as has_uncovered
          from public.payments p
         where p.booking_id = b.id
           and p.status in ('paid'::public.payment_status, 'partially_refunded'::public.payment_status,
                            'fully_refunded'::public.payment_status)
           and p.amount_fils > 0
           and not exists (
             select 1 from public.refunds r
              where r.payment_id = p.id and r.requested_by is null and r.withdrawn_at is null)
      ) m
     where b.id = p_booking_id
       and b.status in ('confirmed'::public.booking_status, 'checked_in'::public.booking_status,
                        'completed'::public.booking_status)
       and not b.is_complimentary
       and m.has_uncovered
       and m.gross_fils >= b.total_fils
  ) then
    return;
  end if;

  perform pg_catalog.set_config('wellplace.document_step_deadline',
    (pg_catalog.clock_timestamp() + internal.document_step_lock_timeout()::interval)::text, true);
  perform pg_catalog.set_config('lock_timeout', internal.document_step_lock_timeout(), true);

  begin
    perform internal.take_document_lock(p_booking_id::text);
    perform internal.absorb_invoice_gaps(p_booking_id, null);

    if internal.has_uncovered_payment(p_booking_id) then
      perform internal.issue_booking_invoice(p_booking_id, null, null, null);
    else
      perform internal.issue_missing_credit_notes(p_booking_id, null);
    end if;
  exception
    when lock_not_available then
      get stacked diagnostics v_state = returned_sqlstate;
    when query_canceled then
      get stacked diagnostics v_state = returned_sqlstate;
    when others then
      get stacked diagnostics v_state = returned_sqlstate;
  end;

  perform pg_catalog.set_config('lock_timeout', v_lock_timeout, true);
  perform pg_catalog.set_config('wellplace.document_step_deadline', coalesce(v_deadline, ''), true);

  if v_state is not null then
    raise log 'WellPlace did not issue the tax invoice for booking % automatically (%). The payment is kept and the booking is listed in public.management_missing_invoices.', p_booking_id, v_state;
  end if;
end
$$;

revoke all on function internal.issue_invoice_when_paid(uuid) from public, anon, authenticated, service_role;

comment on function internal.issue_invoice_when_paid(uuid) is
  '[OUR CHOICE — project owner''s direction, 13–14 September 2026; §8] Rule 1: issues the tax invoice in the same transaction that makes a booking fully paid. Called at the end of public.settle_payment_event when an online payment confirms a booking and of public.record_booking_payment, both of which already hold the booking row lock. It issues only for a confirmed, checked-in or completed booking that is not complimentary, whose gross paid payments (leaving out payments the settlement refunded itself) have reached the booking total, and which has a payment no valid invoice covers. That is the same rule public.management_missing_invoices uses for a booking no longer waiting for its balance (adversary finding P3-C): a later refund or a later overstay charge does not make a fully paid booking part-paid again, so an overstay paid in parts is invoiced payment by payment. First, internal.absorb_invoice_gaps links the payment to an earlier invoice that already carries its value, and nothing new is issued if that covers everything. A part payment, a booking in any other status and a complimentary booking issue nothing; money kept on a booking that is never fully paid is listed in public.management_missing_invoices for Issue now.

INVOICES NEVER BLOCK MONEY. The issue runs in its own exception block with a deadline of internal.document_step_lock_timeout() from the moment the step starts, kept in the transaction-local setting wellplace.document_step_deadline; that setting and lock_timeout are restored to the caller''s values afterwards on every path. Every wait in the step is capped by the deadline, not by a fresh timeout per lock: the booking''s document lock and the invoice and credit note counter locks are advisory locks taken with lock_timeout set to the time remaining (internal.take_document_lock), and the counter rows and every row its foreign keys would lock are taken first through internal.lock_rows_for_document, which waits in the lock queue for at most half the time left and then retries with NOWAIT every 10 ms until the deadline. WORST CASE: the payment is delayed by the step''s lock waits for at most internal.document_step_lock_timeout() plus one 10 ms retry interval, whatever queue of payments or other transactions is waiting on the same locks, plus the step''s own execution time, which takes no locks beyond those. lock_not_available, query_canceled (which OTHERS does not catch, so a statement timeout cannot escape) and every other error roll back only the invoice attempt and its number; the payment still commits, the failure is written to the server log with its SQLSTATE, and the booking appears in public.management_missing_invoices. The most likely failure is WP076 while the invoice details are missing from Settings.';


create function internal.issue_credit_notes_when_refunded(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lock_timeout text := pg_catalog.current_setting('lock_timeout');
  v_deadline     text := pg_catalog.current_setting('wellplace.document_step_deadline', true);
  v_state        text;
begin
  if not exists (
    select 1
      from public.refunds rf
      join public.invoice_payments c on c.payment_id = rf.payment_id and c.voided_at is null
     where rf.booking_id = p_booking_id
       and rf.settled_at is not null
       and rf.withdrawn_at is null
       and not exists (
         select 1 from public.credit_notes cn where cn.refund_id = rf.id and cn.voided_at is null)
  ) then
    return;
  end if;

  perform pg_catalog.set_config('wellplace.document_step_deadline',
    (pg_catalog.clock_timestamp() + internal.document_step_lock_timeout()::interval)::text, true);
  perform pg_catalog.set_config('lock_timeout', internal.document_step_lock_timeout(), true);

  begin
    perform internal.lock_rows_for_document(pg_catalog.format(
      'select 1 from public.bookings b where b.id = %L for no key update', p_booking_id));
    perform internal.take_document_lock(p_booking_id::text);
    perform internal.issue_missing_credit_notes(p_booking_id, null);
  exception
    when lock_not_available then
      get stacked diagnostics v_state = returned_sqlstate;
    when query_canceled then
      get stacked diagnostics v_state = returned_sqlstate;
    when others then
      get stacked diagnostics v_state = returned_sqlstate;
  end;

  perform pg_catalog.set_config('lock_timeout', v_lock_timeout, true);
  perform pg_catalog.set_config('wellplace.document_step_deadline', coalesce(v_deadline, ''), true);

  if v_state is not null then
    raise log 'WellPlace did not issue the credit note for a refund on booking % automatically (%). The refund is kept and the booking is listed in public.management_missing_invoices.', p_booking_id, v_state;
  end if;
end
$$;

revoke all on function internal.issue_credit_notes_when_refunded(uuid) from public, anon, authenticated, service_role;

comment on function internal.issue_credit_notes_when_refunded(uuid) is
  '[OUR CHOICE — project owner''s direction, 14 September 2026: refunds answered "Credit note (Recommended)"; §8] Rule 5: issues the credit note when a refund settles on a payment covered by a valid invoice. Called by public.confirm_refund_return when it settles a refund, and by public.request_payment_refund when a refund of a simulated payment is recorded as returned at once. A pending or withdrawn refund, and a refund on a payment no valid invoice covers, create nothing here; the invoice issued later gives the latter its credit note. It locks the booking row FOR NO KEY UPDATE and then takes the booking''s document lock (internal.take_document_lock), after the payment and refund rows its caller already holds, which is the order every invoice writer uses, so it cannot interleave or deadlock with an issue, regenerate or void of the same booking.

REFUNDS NEVER BLOCK ON DOCUMENTS. The same guard as internal.issue_invoice_when_paid: its own exception block under a deadline of internal.document_step_lock_timeout() for the whole step, restored afterwards, with the same worst case — the refund is delayed by the step''s lock waits for at most internal.document_step_lock_timeout() plus one 10 ms retry interval, whatever the queue — with lock_not_available, query_canceled and every other error handled; the refund still settles, the failure is logged, and the booking appears in public.management_missing_invoices until Issue now or a regenerate issues the credit note.';


drop function public.issue_invoice(uuid);

create function public.issue_invoice(p_booking_id uuid, p_bill_to jsonb default null)
returns setof public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_complimentary boolean;
  v_latest           public.invoices%rowtype;
begin
  perform internal.require_management();

  perform 1 from public.payments p where p.booking_id = p_booking_id order by p.id for key share;

  select b.is_complimentary into v_is_complimentary
    from public.bookings b
   where b.id = p_booking_id
     for no key update;

  if not found then
    raise exception 'This booking could not be found. Refresh the list and open it again.'
      using errcode = 'P0002';
  end if;

  perform internal.take_document_lock(p_booking_id::text);
  perform internal.invoice_bill_to('{}'::jsonb, p_bill_to);

  if v_is_complimentary then
    raise exception 'This booking is complimentary, so there is nothing to invoice.'
      using errcode = 'WP077';
  end if;

  perform internal.absorb_invoice_gaps(p_booking_id, internal.current_staff_id());

  if internal.has_uncovered_payment(p_booking_id) then
    return next internal.issue_booking_invoice(p_booking_id, internal.current_staff_id(), p_bill_to, null);
    return;
  end if;

  perform internal.issue_missing_credit_notes(p_booking_id, internal.current_staff_id());

  select * into v_latest
    from public.invoices i
   where i.booking_id = p_booking_id and i.voided_at is null
   order by i.sequence_no desc
   limit 1;

  if not found then
    raise exception 'There is no payment on this booking that still needs an invoice. Issue the invoice once a payment has been received.'
      using errcode = 'WP078';
  end if;

  return next v_latest;
end
$$;

revoke all on function public.issue_invoice(uuid, jsonb) from public, anon;
grant execute on function public.issue_invoice(uuid, jsonb) to authenticated;

comment on function public.issue_invoice(uuid, jsonb) is
  '[OUR CHOICE — project owner''s direction, 13–14 September 2026; CLIENT console redesign brief 2026-09-11; §8, INV-21] Management''s Issue now, for a booking listed in public.management_missing_invoices; invoices are otherwise issued automatically when a booking becomes fully paid. Locks the booking. When a payment is not on a valid invoice it issues one covering every such payment through internal.issue_booking_invoice, with p_bill_to corrections (name, company, 15-digit trn, address) applied, and returns it; that issue also gives already settled refunds their credit notes. Otherwise it issues any missing credit notes and returns the booking''s latest valid invoice unchanged, ignoring p_bill_to, so pressing it twice is harmless; Regenerate corrects the bill-to of an issued invoice. Unlike the automatic issue it does not require the booking to be confirmed or fully paid, so money kept on, for example, a cancelled booking can be documented. Refuses with 22023 for invalid bill-to corrections, WP077 for a complimentary booking, WP076 until the invoice details are complete in Settings and WP078 when there is nothing to invoice. The registered legal name lives only in Settings, typed by WellPlace, never in the code [R-44]. Replaces public.issue_invoice(uuid) since 20260914091000.';


create or replace function public.void_invoice(p_invoice_id uuid, p_reason text)
returns setof public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason     text := nullif(btrim(coalesce(p_reason, '')), '');
  v_booking_id uuid;
  v_before     public.invoices%rowtype;
  v_after      public.invoices%rowtype;
  v_now        timestamptz := clock_timestamp();
begin
  perform internal.require_management();

  if v_reason is null or length(v_reason) > 500 then
    raise exception 'Enter a reason of up to 500 characters for voiding this invoice.'
      using errcode = '22023';
  end if;

  select i.booking_id into v_booking_id from public.invoices i where i.id = p_invoice_id;

  if not found then
    raise exception 'This invoice could not be found. Refresh the list and open it again.'
      using errcode = 'P0002';
  end if;

  perform 1 from public.payments p where p.booking_id = v_booking_id order by p.id for key share;
  perform 1 from public.bookings b where b.id = v_booking_id for no key update;
  perform internal.take_document_lock(v_booking_id::text);

  select * into v_before from public.invoices i where i.id = p_invoice_id for update;

  if v_before.voided_at is not null then
    raise exception 'This invoice has already been voided.'
      using errcode = 'WP079';
  end if;

  if exists (select 1 from public.credit_notes cn where cn.invoice_id = p_invoice_id and cn.voided_at is null) then
    raise exception 'This invoice has credit notes for its refunds, so it cannot be voided on its own. Regenerate it instead.'
      using errcode = 'WP085';
  end if;

  update public.invoices i
     set voided_at   = v_now,
         voided_by   = internal.current_staff_id(),
         void_reason = v_reason
   where i.id = p_invoice_id
  returning * into v_after;

  update public.invoice_payments c
     set voided_at = v_now
   where c.invoice_id = p_invoice_id and c.voided_at is null;

  perform internal.write_audit(
    'void_invoice',
    'public.invoices',
    p_invoice_id::text,
    jsonb_build_object('invoice_number', v_before.invoice_number, 'voided_at', null),
    jsonb_build_object(
      'invoice_number', v_after.invoice_number,
      'booking_id',     v_after.booking_id,
      'voided_at',      v_after.voided_at,
      'payment_ids',    coalesce((select jsonb_agg(c.payment_id) from public.invoice_payments c where c.invoice_id = p_invoice_id), '[]'::jsonb)
    ),
    v_reason
  );

  return next v_after;
end
$$;

comment on function public.void_invoice(uuid, text) is
  '[CLIENT console redesign brief 2026-09-11; OUR CHOICE — project owner''s direction, 13–14 September 2026] Rule 7: Management voids an issued invoice made in genuine error, with a reason, and gets the voided row back. The invoice and its number are kept; its payments are released in public.invoice_payments in the same transaction, so the booking returns to public.management_missing_invoices and Issue now issues a fresh invoice with the next number. Locks the booking before the invoice, the order every invoice writer uses. Refuses with 22023 without a reason, P0002 for an unknown invoice, WP079 when it is already void and, since 20260914091000, WP085 when it has valid credit notes, which only public.regenerate_invoice may void together with it. Writes its own audit entry.';


create function public.regenerate_invoice(p_invoice_id uuid, p_reason text, p_bill_to jsonb default null)
returns setof public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason     text := nullif(btrim(coalesce(p_reason, '')), '');
  v_booking_id uuid;
  v_before     public.invoices%rowtype;
  v_note       public.credit_notes%rowtype;
  v_new        public.invoices%rowtype;
  v_actor      uuid := internal.current_staff_id();
  v_now        timestamptz := clock_timestamp();
begin
  perform internal.require_management();

  if v_reason is null or length(v_reason) > 500 then
    raise exception 'Enter a reason of up to 500 characters for regenerating this invoice.'
      using errcode = '22023';
  end if;

  select i.booking_id into v_booking_id from public.invoices i where i.id = p_invoice_id;

  if not found then
    raise exception 'This invoice could not be found. Refresh the list and open it again.'
      using errcode = 'P0002';
  end if;

  perform 1 from public.payments p where p.booking_id = v_booking_id order by p.id for key share;
  perform 1 from public.bookings b where b.id = v_booking_id for no key update;
  perform internal.take_document_lock(v_booking_id::text);

  select * into v_before from public.invoices i where i.id = p_invoice_id for update;

  if v_before.voided_at is not null then
    raise exception 'This invoice has already been voided.'
      using errcode = 'WP079';
  end if;

  perform internal.invoice_bill_to(v_before.bill_to, p_bill_to);

  for v_note in
    update public.credit_notes cn
       set voided_at   = v_now,
           voided_by   = v_actor,
           void_reason = v_reason
     where cn.invoice_id = p_invoice_id and cn.voided_at is null
    returning cn.*
  loop
    perform internal.write_audit(
      'void_credit_note',
      'public.credit_notes',
      v_note.id::text,
      jsonb_build_object('credit_note_number', v_note.credit_note_number, 'voided_at', null),
      jsonb_build_object(
        'credit_note_number', v_note.credit_note_number,
        'invoice_id',         p_invoice_id,
        'refund_id',          v_note.refund_id,
        'voided_at',          v_now
      ),
      v_reason
    );
  end loop;

  update public.invoice_payments c
     set voided_at = v_now
   where c.invoice_id = p_invoice_id and c.voided_at is null;

  update public.invoices i
     set voided_at   = v_now,
         voided_by   = v_actor,
         void_reason = v_reason
   where i.id = p_invoice_id;

  perform internal.write_audit(
    'void_invoice',
    'public.invoices',
    p_invoice_id::text,
    jsonb_build_object('invoice_number', v_before.invoice_number, 'voided_at', null),
    jsonb_build_object(
      'invoice_number', v_before.invoice_number,
      'booking_id',     v_booking_id,
      'voided_at',      v_now,
      'regenerated',    true
    ),
    v_reason
  );

  v_new := internal.issue_booking_invoice(v_booking_id, v_actor, p_bill_to, p_invoice_id);

  perform internal.write_audit(
    'regenerate_invoice',
    'public.invoices',
    p_invoice_id::text,
    jsonb_build_object('invoice_id', p_invoice_id, 'invoice_number', v_before.invoice_number),
    jsonb_build_object(
      'invoice_id',        v_new.id,
      'invoice_number',    v_new.invoice_number,
      'booking_id',        v_booking_id,
      'bill_to_corrected', p_bill_to is not null
    ),
    v_reason
  );

  return next v_new;
end
$$;

revoke all on function public.regenerate_invoice(uuid, text, jsonb) from public, anon;
grant execute on function public.regenerate_invoice(uuid, text, jsonb) to authenticated;

comment on function public.regenerate_invoice(uuid, text, jsonb) is
  '[OUR CHOICE — project owner''s direction, 14 September 2026: "regenerate any invoice … if the refund happen then invoice can be recreate"] Rule 6: Management replaces an issued invoice in one transaction and gets the replacement back. It locks the booking and the invoice, voids the invoice''s valid credit notes and the invoice itself with the reason, releases its payments, and issues a replacement through internal.issue_booking_invoice covering exactly the same payments, with the next number, replaces_invoice_id pointing at the old invoice, the old bill-to with p_bill_to corrections applied (name, company, 15-digit trn, address), and fresh credit notes for the refunds settled on those payments. The voided documents keep their numbers. Refuses with 22023 without a reason or with invalid bill-to corrections, P0002 for an unknown invoice, WP079 for a voided invoice, and WP076 while the invoice details in Settings are incomplete, in which case nothing is voided. Writes an audit entry for every voided credit note, the voided invoice, the new invoice and its credit notes, and the regeneration itself.';


create or replace function public.settle_payment_event(p_provider text, p_event_id text, p_payment_id uuid, p_outcome text, p_amount_fils integer, p_currency text, p_signature_verified boolean, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
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
  select * into p from public.payments where id = p_payment_id for no key update;
  select * into b from public.bookings where id = a.booking_id for no key update;

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

  if v_result = 'confirmed' then
    perform internal.issue_invoice_when_paid(b.id);
  end if;

  return jsonb_build_object(
    'status', v_result, 'duplicate', false,
    'receiptToken', case when v_result in ('confirmed', 'refunded') then a.receipt_token end,
    'reference', b.reference, 'bookingId', b.id, 'paymentId', p.id);
end
$function$;


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
  v_taken          bigint;
  v_actor          uuid    := internal.current_staff_id();
  v_provider_ref   text    := nullif(btrim(coalesce(p_provider_reference, '')), '');
  v_note           text    := nullif(btrim(coalesce(p_note, '')), '');
  v_payment_id     uuid;
  v_at             timestamptz;
begin
  perform internal.require_desk_operator();
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
   for no key update;

  if v_booking_status is null then
    raise exception 'record_booking_payment: no booking with id %', p_booking_id
      using errcode = 'P0002';
  end if;

  if v_was_comped and p_amount_fils <> 0 then
    raise exception 'record_booking_payment: booking % is complimentary and a complimentary booking holds no money, so % fils cannot be recorded against it [§11.2, INV-20]',
      v_reference, p_amount_fils
      using errcode = 'WP033';
  end if;

  if p_method = 'complimentary'::public.payment_method and not v_was_comped then
    select coalesce(sum(p.amount_fils), 0)
      into v_taken
      from public.payments p
     where p.booking_id = p_booking_id
       and p.status in (
         'paid'::public.payment_status,
         'partially_refunded'::public.payment_status
       );

    if v_taken > 0 then
      raise exception 'record_booking_payment: booking % has taken % fils that has not been given back, so it cannot become complimentary — refund it first [§11.2, INV-20]',
        v_reference, v_taken
        using errcode = 'WP034';
    end if;
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
       into v_payment_id, v_at;

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
      'recorded_at',        v_at
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

  perform internal.issue_invoice_when_paid(p_booking_id);

  payment_id     := v_payment_id;
  booking_id     := p_booking_id;
  payment_status := 'paid'::public.payment_status;
  payment_method := p_method;
  amount_fils    := p_amount_fils;
  recorded_by    := v_actor;
  recorded_at    := v_at;
  booking_comped := v_is_comped;
  return next;
end
$$;


create or replace function public.request_payment_refund(p_payment_id uuid, p_amount_fils integer, p_reason text, p_request_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
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

  select * into p from public.payments where id = p_payment_id for no key update;

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

  if p.is_simulated then
    perform internal.issue_credit_notes_when_refunded(p.booking_id);
  end if;

  return v_id;
end
$function$;


create or replace function public.confirm_refund_return(p_refund_id uuid, p_reference text, p_reason text)
returns table(refund_id uuid, booking_id uuid)
language plpgsql
security definer
set search_path = ''
as $function$
declare v_refund public.refunds%rowtype; v_payment_id uuid;
begin
  perform internal.require_management();
  if nullif(btrim(p_reference), '') is null or length(btrim(p_reference)) > 64
    or nullif(btrim(p_reason), '') is null or length(btrim(p_reason)) > 500 then
    raise exception 'Enter a payment reference and a short reason for confirming the return.' using errcode = '22023';
  end if;
  select r.payment_id into v_payment_id from public.refunds r where r.id = p_refund_id;
  if not found then raise exception 'The refund could not be found.' using errcode = 'P0002'; end if;
  perform 1 from public.payments p where p.id = v_payment_id for no key update;
  select * into v_refund from public.refunds r where r.id = p_refund_id for no key update;
  if v_refund.withdrawn_at is not null then
    raise exception 'This refund request was withdrawn, so there is nothing to confirm.' using errcode = 'WP071';
  end if;
  if v_refund.settled_at is null then
    update public.refunds r set is_pending = false, settled_at = now(), provider_reference = btrim(p_reference) where r.id = p_refund_id;
    perform internal.write_audit('confirm_refund_return', 'public.refunds', p_refund_id::text,
      jsonb_build_object('is_pending', v_refund.is_pending, 'settled_at', v_refund.settled_at),
      jsonb_build_object('is_pending', false, 'settled_at', now(), 'provider_reference', btrim(p_reference)), p_reason);
    perform internal.issue_credit_notes_when_refunded(v_refund.booking_id);
  end if;
  return query select v_refund.id, v_refund.booking_id;
end
$function$;


do $$
begin
  execute format(
    'comment on function public.settle_payment_event(text, text, uuid, text, integer, text, boolean, jsonb) is %L',
    obj_description('public.settle_payment_event(text, text, uuid, text, integer, text, boolean, jsonb)'::regprocedure, 'pg_proc')
      || E'\n\n'
      || 'TAX INVOICE, SINCE 20260914091000. [OUR CHOICE — project owner''s direction, 13–14 September 2026] When the result is confirmed it calls internal.issue_invoice_when_paid as its last step, which issues the invoice when the booking is now fully paid. That step cannot abort or delay the settlement beyond its short lock_timeout: any failure leaves the payment settled and the booking listed in public.management_missing_invoices. A payment this function refunds itself is never invoiced. It locks the payment and the booking FOR NO KEY UPDATE rather than FOR UPDATE, in the order described on internal.take_document_lock, so refunds and invoice writers taking foreign-key share locks on them never queue behind it.'
  );
  execute format(
    'comment on function public.record_booking_payment(uuid, public.payment_method, integer, text, text, text) is %L',
    coalesce(obj_description('public.record_booking_payment(uuid, public.payment_method, integer, text, text, text)'::regprocedure, 'pg_proc') || E'\n\n', '')
      || 'TAX INVOICE, SINCE 20260914091000. [OUR CHOICE — project owner''s direction, 13–14 September 2026] As its last step it calls internal.issue_invoice_when_paid, which issues the invoice automatically when this payment makes a confirmed, checked-in or completed booking fully paid, including a later overstay payment, which gets its own additional invoice. A failure there never refuses the payment; the booking is listed in public.management_missing_invoices instead. It locks the booking FOR NO KEY UPDATE rather than FOR UPDATE, in the order described on internal.take_document_lock.'
  );
  execute format(
    'comment on function public.request_payment_refund(uuid, integer, text, uuid) is %L',
    coalesce(obj_description('public.request_payment_refund(uuid, integer, text, uuid)'::regprocedure, 'pg_proc') || E'\n\n', '')
      || 'CREDIT NOTE, SINCE 20260914091000. [OUR CHOICE — project owner''s direction, 14 September 2026] A refund of a simulated payment is recorded as returned at once, so it then calls internal.issue_credit_notes_when_refunded, which issues the credit note when a valid invoice covers the payment. A live refund stays pending and gets its credit note when public.confirm_refund_return settles it. A failure never refuses the refund. It locks the payment FOR NO KEY UPDATE rather than FOR UPDATE, in the order described on internal.take_document_lock.'
  );
  execute format(
    'comment on function public.confirm_refund_return(uuid, text, text) is %L',
    obj_description('public.confirm_refund_return(uuid, text, text)'::regprocedure, 'pg_proc')
      || E'\n\n'
      || 'CREDIT NOTE, SINCE 20260914091000. [OUR CHOICE — project owner''s direction, 14 September 2026] When it settles the refund it calls internal.issue_credit_notes_when_refunded, which issues the credit note when a valid invoice covers the refunded payment. A failure there never refuses the confirmation; the booking is listed in public.management_missing_invoices instead. Confirming a refund that already settled writes nothing. It locks the payment and the refund FOR NO KEY UPDATE rather than FOR UPDATE, in the order described on internal.take_document_lock, so a Regenerate holding the booking''s document lock can take its foreign-key share locks on them and finish instead of deadlocking.'
  );
end
$$;


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
  i.overrun_fils,
  i.is_test,
  i.supply_date,
  i.payments,
  i.replaces_invoice_id,
  c.reference                                        as customer_reference,
  coalesce((
    select sum(cn.amount_fils) from public.credit_notes cn
     where cn.invoice_id = i.id and cn.voided_at is null
  ), 0)::integer                                     as credited_fils
from public.invoices i
join public.bookings b on b.id = i.booking_id
join public.customers c on c.id = i.customer_id
left join public.suites s on s.id = b.suite_id
where (select internal.has_permission('view_confidential_figures'::public.named_permission));

comment on view public.management_invoices is
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] Invoices for the Management Finance section, with the booking reference and the booking''s current suite number for the console list. The suite number is for staff only and must never be printed on the invoice a guest receives [§3, INV-01]. Security invoker over public.invoices, so its confidential-figures policy applies. Since 20260914091000 it also carries is_test, supply_date, the payments snapshot, replaces_invoice_id, the customer''s WP-C reference and credited_fils, the total of the invoice''s valid credit notes [OUR CHOICE — project owner''s direction, 14 September 2026].';


create view public.management_credit_notes with (security_invoker = true) as
select
  cn.id,
  cn.credit_note_number,
  cn.sequence_no,
  cn.invoice_id,
  cn.invoice_number,
  cn.invoice_issued_at,
  cn.refund_id,
  cn.booking_id,
  b.reference                                        as booking_reference,
  cn.customer_id,
  c.reference                                        as customer_reference,
  cn.bill_to ->> 'name'                              as customer_name,
  cn.bill_to ->> 'email'                             as customer_email,
  cn.issued_at,
  cn.issued_by,
  internal.staff_display_name(cn.issued_by)          as issued_by_name,
  cn.supply_date,
  cn.issuer,
  cn.bill_to,
  cn.tax,
  cn.lines,
  cn.refund,
  cn.reason,
  cn.amount_fils,
  cn.tax_fils,
  cn.taxable_fils,
  cn.currency,
  cn.is_test,
  cn.voided_at,
  cn.voided_by,
  internal.staff_display_name(cn.voided_by)          as voided_by_name,
  cn.void_reason,
  case when cn.voided_at is null then 'issued' else 'voided' end as state
from public.credit_notes cn
join public.bookings b on b.id = cn.booking_id
join public.customers c on c.id = cn.customer_id
where (select internal.has_permission('view_confidential_figures'::public.named_permission));

revoke all on public.management_credit_notes from public, anon;
grant select on public.management_credit_notes to authenticated;

comment on view public.management_credit_notes is
  '[OUR CHOICE — project owner''s direction, 14 September 2026] Credit notes for the Management Finance section, each with its original invoice number, booking and customer references and state. Security invoker over public.credit_notes, so its confidential-figures policy applies; no suite number, since the document is the guest''s [§3, INV-01].';


create view public.management_documents with (security_invoker = true) as
select
  'invoice'::text                                    as document_type,
  i.id,
  i.invoice_number                                   as number,
  i.sequence_no,
  i.booking_id,
  b.reference                                        as booking_reference,
  s.suite_number,
  i.customer_id,
  c.reference                                        as customer_reference,
  i.bill_to ->> 'name'                               as customer_name,
  i.bill_to ->> 'email'                              as customer_email,
  i.bill_to ->> 'company'                            as bill_to_company,
  i.bill_to ->> 'trn'                                as bill_to_trn,
  i.issued_at,
  internal.staff_display_name(i.issued_by)           as issued_by_name,
  i.supply_date,
  i.taxable_fils,
  i.tax_fils,
  i.total_fils,
  i.paid_fils,
  i.currency,
  case when i.voided_at is null then 'issued' else 'voided' end as state,
  i.is_test,
  i.voided_at,
  i.void_reason,
  null::uuid                                         as original_invoice_id,
  null::text                                         as original_invoice_number,
  null::uuid                                         as refund_id,
  i.replaces_invoice_id
from public.invoices i
join public.bookings b on b.id = i.booking_id
join public.customers c on c.id = i.customer_id
left join public.suites s on s.id = b.suite_id
where (select internal.has_permission('view_confidential_figures'::public.named_permission))
union all
select
  'credit_note'::text,
  cn.id,
  cn.credit_note_number,
  cn.sequence_no,
  cn.booking_id,
  b.reference,
  s.suite_number,
  cn.customer_id,
  c.reference,
  cn.bill_to ->> 'name',
  cn.bill_to ->> 'email',
  cn.bill_to ->> 'company',
  cn.bill_to ->> 'trn',
  cn.issued_at,
  internal.staff_display_name(cn.issued_by),
  cn.supply_date,
  cn.taxable_fils,
  cn.tax_fils,
  cn.amount_fils,
  cn.amount_fils,
  cn.currency,
  case when cn.voided_at is null then 'issued' else 'voided' end,
  cn.is_test,
  cn.voided_at,
  cn.void_reason,
  cn.invoice_id,
  cn.invoice_number,
  cn.refund_id,
  null::uuid
from public.credit_notes cn
join public.bookings b on b.id = cn.booking_id
join public.customers c on c.id = cn.customer_id
left join public.suites s on s.id = b.suite_id
where (select internal.has_permission('view_confidential_figures'::public.named_permission));

revoke all on public.management_documents from public, anon;
grant select on public.management_documents to authenticated;

comment on view public.management_documents is
  '[OUR CHOICE — project owner''s direction, 14 September 2026: "One list of invoices and credit notes"] Tax invoices and credit notes in one list for Management → Invoices and its CSV export: document_type, number, booking and customer references, bill-to company and TRN, date of issue and supply, taxable amount, VAT, total, state and is_test. For a credit note total_fils and paid_fils are the refunded amount, and original_invoice_id, original_invoice_number and refund_id name what it credits; for an invoice replaces_invoice_id names a regenerated predecessor. The suite number is for staff only [§3, INV-01]. Security invoker over both tables, so their confidential-figures policies apply.';


create view public.management_missing_invoices with (security_invoker = true) as
with eligible as (
  select p.id,
         p.booking_id,
         p.amount_fils,
         p.recorded_at,
         exists (
           select 1 from public.invoice_payments c
            where c.payment_id = p.id and c.voided_at is null
         ) as is_covered
    from public.payments p
   where p.status in ('paid'::public.payment_status, 'partially_refunded'::public.payment_status,
                      'fully_refunded'::public.payment_status)
     and p.amount_fils > 0
     and not exists (
       select 1 from public.refunds r
        where r.payment_id = p.id and r.requested_by is null and r.withdrawn_at is null)
), received as (
  select e.booking_id,
         sum(e.amount_fils)::integer                                    as received_fils,
         coalesce(sum(e.amount_fils) filter (where not e.is_covered), 0)::integer as uncovered_fils,
         count(*) filter (where not e.is_covered)::integer              as uncovered_payment_count,
         max(e.recorded_at)                                             as last_payment_at
    from eligible e
   group by e.booking_id
), settled as (
  select e.booking_id,
         sum(r.amount_fils)::integer as refunded_fils,
         coalesce(sum(r.amount_fils) filter (
           where e.is_covered
             and not exists (select 1 from public.credit_notes cn where cn.refund_id = r.id and cn.voided_at is null)
         ), 0)::integer              as uncredited_fils
    from public.refunds r
    join eligible e on e.id = r.payment_id
   where r.settled_at is not null and r.withdrawn_at is null
   group by e.booking_id
), gaps as (
  select i.booking_id,
         sum(i.total_fils - coalesce(g.covered_fils, 0))::integer as excess_fils,
         max(i.issued_at)                                         as issued_at
    from public.invoices i
    cross join lateral (
      select sum(c.amount_fils) as covered_fils
        from public.invoice_payments c
       where c.invoice_id = i.id and c.voided_at is null
    ) g
   where i.voided_at is null
     and i.total_fils > coalesce(g.covered_fils, 0)
   group by i.booking_id
)
select
  b.id                                                  as booking_id,
  b.reference                                           as booking_reference,
  b.status                                              as booking_status,
  b.customer_id,
  c.reference                                           as customer_reference,
  btrim(c.first_name || ' ' || c.last_name)             as customer_name,
  c.email                                               as customer_email,
  (b.total_fils + coalesce(b.overrun_fils, 0))::integer as due_fils,
  coalesce(m.received_fils, 0)                          as received_fils,
  coalesce(s.refunded_fils, 0)                          as refunded_fils,
  coalesce((
    select sum(i.total_fils) from public.invoices i
     where i.booking_id = b.id and i.voided_at is null
  ), 0)::integer                                        as invoiced_fils,
  coalesce((
    select sum(cn.amount_fils) from public.credit_notes cn
     where cn.booking_id = b.id and cn.voided_at is null
  ), 0)::integer                                        as credited_fils,
  coalesce(m.uncovered_fils, 0)                         as uncovered_fils,
  coalesce(m.uncovered_payment_count, 0)                as uncovered_payment_count,
  coalesce(s.uncredited_fils, 0)                        as uncredited_refund_fils,
  case
    when coalesce(m.uncovered_fils, 0) > 0 then 'payment_not_invoiced'
    when coalesce(s.uncredited_fils, 0) > 0 then 'refund_not_credited'
    else 'invoice_exceeds_payments'
  end                                                   as reason,
  coalesce(m.last_payment_at, g.issued_at)              as last_payment_at,
  coalesce(g.excess_fils, 0)                            as invoice_excess_fils
from public.bookings b
join public.customers c on c.id = b.customer_id
left join received m on m.booking_id = b.id
left join settled s on s.booking_id = b.id
left join gaps g on g.booking_id = b.id
where (select internal.has_permission('view_confidential_figures'::public.named_permission))
  and not b.is_complimentary
  and (
    coalesce(s.uncredited_fils, 0) > 0
    or (
      (coalesce(m.uncovered_fils, 0) > 0 or coalesce(g.excess_fils, 0) > 0)
      and not (
        b.status in ('draft'::public.booking_status, 'held'::public.booking_status,
                     'awaiting_payment'::public.booking_status, 'payment_failed'::public.booking_status,
                     'hold_expired'::public.booking_status, 'awaiting_recovery'::public.booking_status,
                     'confirmed'::public.booking_status, 'checked_in'::public.booking_status)
        and coalesce(m.received_fils, 0) < b.total_fils
      )
    )
  );

revoke all on public.management_missing_invoices from public, anon;
grant select on public.management_missing_invoices to authenticated;

comment on view public.management_missing_invoices is
  '[OUR CHOICE — project owner''s direction, 13–14 September 2026: rule 3, rule 4, adversary findings 2 and 6] The Missing invoices section of Management → Invoices, one row per booking, which Issue now (public.issue_invoice) clears. A booking is listed when it is not complimentary and either a settled refund on a payment covered by a valid invoice has no valid credit note (reason refund_not_credited), or it holds a paid payment no valid invoice covers (reason payment_not_invoiced) and it is not a live booking still waiting for its balance. Payments the settlement refunded itself (refunds with no requesting staff member: §8.2 recovery, stale and duplicate payments) never count, so the §8.2 branch lists nothing. A live booking is draft, held, awaiting payment, payment failed, hold expired, awaiting recovery, confirmed or checked in, whose gross paid payments (before refunds, leaving out payments the settlement refunded itself) have not yet reached its total, overstay not counted (adversary finding P3-C: a goodwill refund or an unpaid overstay recorded later never makes a fully paid booking wait again, and internal.issue_invoice_when_paid applies the same rule); once it is fully paid, or it is completed, cancelled, a no-show, rescheduled or abandoned with money kept, an uncovered payment is listed, which is how a failed automatic issue (for example with the invoice details missing from Settings) and money kept on a booking that never became fully paid appear. A booking is also listed with reason invoice_exceeds_payments (adversary round 2, P3-2) when a valid invoice''s total exceeds the payments public.invoice_payments links to it, which only an invoice issued before 20260914091000 for the booking''s whole value can do, and the booking is not waiting for its balance under the same rule: a cancelled booking that kept only its deposit, for example. Issue now cannot fix that; Management uses Regenerate, which replaces the invoice with one for the payments it covers. When more than one reason applies the row shows the first of payment_not_invoiced, refund_not_credited and invoice_exceeds_payments. Amounts: due (total plus overstay), received, refunded, invoiced and credited (valid documents), uncovered payments, uncredited refunds, and invoice_excess_fils, the amount by which valid invoices exceed the payments linked to them. last_payment_at falls back to the latest such invoice''s issue time for a booking with no paid payment. There is deliberately no invoice_missing alert: Management has no alert reader, so this view and its count are the signal. Security invoker; rows only with view_confidential_figures.';


comment on table public.invoices is
  '[CLIENT console redesign brief 2026-09-11; OUR CHOICE — project owner''s direction, 13–14 September 2026; §8, §11.2, INV-21] UAE tax invoices. Since 20260914091000 they are issued automatically in the transaction that makes a confirmed, checked-in or completed booking fully paid (internal.issue_invoice_when_paid), by Management''s Issue now for bookings listed in public.management_missing_invoices, and by public.regenerate_invoice. An invoice covers whole payments, recorded in public.invoice_payments, and a payment is on at most one valid invoice, so a booking may carry several valid invoices, for example one for its visit and an additional one for an overstay paid later; every refund settled on a covered payment is on a credit note (public.credit_notes). Every figure is copied from stored values at issue and never recomputed: the booking''s priced breakdown, add-on snapshots and stored overstay charge, and the invoice VAT is always the covered payments'' frozen VAT. issuer holds the legal name, tax registration number and address from Settings at issue; bill_to the customer, with company, trn and address when Management supplied them; tax the label and rate from Settings at issue and whether VAT is included as read from the booking''s own figures. The suite number is not part of the document, because a guest never sees one [§3, INV-01]. Readable only with view_confidential_figures, which Management holds implicitly. No role, the service role included, holds a write grant: internal.issue_booking_invoice, public.void_invoice and public.regenerate_invoice are the only writers, and internal.guard_invoice_record refuses any other change and every delete. An invoice with valid credit notes cannot be voided on its own.';


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

  select amount_fils into v_paid from public.payments where id = new.payment_id for no key update;
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


create or replace function public.withdraw_refund_request(p_refund_id uuid, p_reason text)
returns table (refund_id uuid, payment_id uuid, booking_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment  uuid;
  v_paid     integer;
  v_returned bigint;
  r          public.refunds%rowtype;
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

  select pm.amount_fils into v_paid from public.payments pm where pm.id = v_payment for no key update;
  select * into r from public.refunds rf where rf.id = p_refund_id for no key update;

  if not r.is_pending or r.settled_at is not null or r.withdrawn_at is not null then
    raise exception 'Only a refund that is still pending can be withdrawn.' using errcode = 'WP066';
  end if;
  if r.requested_by is null then
    raise exception 'This refund was started automatically because the payment could not be used for the booking. It can be confirmed as returned, but not withdrawn.' using errcode = 'WP066';
  end if;

  update public.refunds rf
     set is_pending = false,
         withdrawn_at = now(),
         withdrawn_by = internal.current_staff_id(),
         withdrawal_reason = btrim(p_reason)
   where rf.id = r.id;

  select coalesce(sum(rf.amount_fils), 0) into v_returned
    from public.refunds rf
   where rf.payment_id = v_payment and rf.settled_at is not null;

  update public.payments pm
     set status = case
       when v_returned = 0 then 'paid'::public.payment_status
       when v_returned >= v_paid then 'fully_refunded'::public.payment_status
       else 'partially_refunded'::public.payment_status end
   where pm.id = v_payment
     and pm.status in ('paid', 'partially_refunded', 'fully_refunded');

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


create or replace function public.record_refund(p_payment_id uuid, p_amount_fils integer, p_reason text)
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
   for no key update;

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
   where r.payment_id = p_payment_id
     and r.withdrawn_at is null;

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
    tax_fils,
    reason,
    requested_by
  )
  values (
    p_payment_id,
    v_booking_id,
    p_amount_fils,
    internal.refund_tax_share(p_payment_id, p_amount_fils),
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


create or replace function public.void_booking_payment(p_payment_id uuid, p_reason text)
returns table (
  payment_id      uuid,
  booking_id      uuid,
  payment_status  public.payment_status,
  previous_status public.payment_status,
  amount_fils     integer
)
language plpgsql
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
   for no key update;

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

do $$
declare
  v_note constant text := 'ROW LOCKS, SINCE 20260914091000. [OUR CHOICE — project owner''s direction, 14 September 2026; concurrency finding: a simulated refund waited for an invoice writer''s FOR KEY SHARE on its payment] The payment row, and in withdraw_refund_request the refund row too, is locked FOR NO KEY UPDATE instead of FOR UPDATE. No key column changes, and FOR NO KEY UPDATE does not conflict with the FOR KEY SHARE that public.issue_invoice, public.void_invoice and public.regenerate_invoice take on a booking''s payments, nor with the foreign-key share locks of refunds and invoice links, so a refund, its settlement, a withdrawal or a void never queues behind an invoice writer. It still conflicts with itself, so writers of the same payment stay serialised. Behaviour is otherwise unchanged. See the lock order on internal.take_document_lock.';
begin
  execute format('comment on function internal.update_settled_refund_status() is %L',
    coalesce(obj_description('internal.update_settled_refund_status()'::regprocedure, 'pg_proc') || E'\n\n', '') || v_note);
  execute format('comment on function public.withdraw_refund_request(uuid, text) is %L',
    coalesce(obj_description('public.withdraw_refund_request(uuid, text)'::regprocedure, 'pg_proc') || E'\n\n', '') || v_note);
  execute format('comment on function public.record_refund(uuid, integer, text) is %L',
    coalesce(obj_description('public.record_refund(uuid, integer, text)'::regprocedure, 'pg_proc') || E'\n\n', '') || v_note);
  execute format('comment on function public.void_booking_payment(uuid, text) is %L',
    coalesce(obj_description('public.void_booking_payment(uuid, text)'::regprocedure, 'pg_proc') || E'\n\n', '') || v_note);
end
$$;
