create sequence internal.booking_number_seq as bigint start with 1001 minvalue 1001;
create sequence internal.customer_number_seq as bigint start with 1001 minvalue 1001;
create sequence internal.payment_number_seq as bigint start with 1001 minvalue 1001;
create sequence internal.refund_number_seq as bigint start with 1001 minvalue 1001;

comment on sequence internal.booking_number_seq is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] The counter behind WP-B booking references. Starts at 1001, no zero padding. Gaps after a rolled-back attempt are accepted. internal.booking_reference_seq stays in place because references it produced have been sent to guests and are never rewritten.';
comment on sequence internal.customer_number_seq is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] The counter behind WP-C customer references. Starts at 1001; customers that existed when it was introduced were numbered in created_at, id order.';
comment on sequence internal.payment_number_seq is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] The counter behind WP-P payment references. Starts at 1001; payments that existed when it was introduced were numbered in created_at, id order.';
comment on sequence internal.refund_number_seq is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] The counter behind WP-R refund references. Starts at 1001; refunds that existed when it was introduced were numbered in requested_at, id order, because public.refunds has no created_at.';

create function internal.next_record_reference(p_record text)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select case p_record
    when 'booking' then 'WP-B' || nextval('internal.booking_number_seq')::text
    when 'customer' then 'WP-C' || nextval('internal.customer_number_seq')::text
    when 'payment' then 'WP-P' || nextval('internal.payment_number_seq')::text
    when 'refund' then 'WP-R' || nextval('internal.refund_number_seq')::text
  end
$$;

revoke all on function internal.next_record_reference(text) from public;
grant execute on function internal.next_record_reference(text) to service_role;

comment on function internal.next_record_reference(text) is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] Issues the next short reference for a booking, customer, payment or refund. SECURITY DEFINER so a column default can advance an internal sequence without granting USAGE on it: the sequences stay unreadable to every API role, and only service_role (direct seed and test inserts) and the owner (every SECURITY DEFINER writer) may call it. authenticated has no INSERT on these tables, so it needs no execute grant. An unknown record kind returns null, which the not-null reference columns reject.';

create or replace function internal.next_booking_reference()
returns text
language sql
security definer
set search_path = ''
as $$
  select internal.next_record_reference('booking')
$$;

comment on function internal.next_booking_reference() is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] Returns WP-B followed by the next number from internal.booking_number_seq, for example WP-B1001. Same signature as before, so Reception, guest checkout and every other caller issues the short form without being edited. The result satisfies bookings_reference_shaped and bookings_reference_length. References already issued in the WP-000000-XXXX form are never rewritten: they have been sent to guests.';


alter table public.customers add column reference text;
alter table public.customers disable trigger customers_set_updated_at;
update public.customers c
   set reference = 'WP-C' || (1000 + numbered.position)::text
  from (select id, row_number() over (order by created_at, id) as position from public.customers) numbered
 where numbered.id = c.id;
alter table public.customers enable trigger customers_set_updated_at;
select setval('internal.customer_number_seq', greatest(1000 + count(*), 1001), count(*) > 0) from public.customers;
alter table public.customers
  alter column reference set default internal.next_record_reference('customer'),
  alter column reference set not null,
  add constraint customers_reference_key unique (reference),
  add constraint customers_reference_shaped check (reference ~ '^WP-C[1-9][0-9]{3,}$');

comment on column public.customers.reference is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] Short staff-facing customer number, WP-C1001 onwards, assigned by the column default when the row is created. Searchable in Management and at Reception. Not an access token: no public route resolves a customer by it.';


alter table public.payments add column reference text;
alter table public.payments disable trigger payments_set_updated_at;
update public.payments p
   set reference = 'WP-P' || (1000 + numbered.position)::text
  from (select id, row_number() over (order by created_at, id) as position from public.payments) numbered
 where numbered.id = p.id;
alter table public.payments enable trigger payments_set_updated_at;
select setval('internal.payment_number_seq', greatest(1000 + count(*), 1001), count(*) > 0) from public.payments;
alter table public.payments
  alter column reference set default internal.next_record_reference('payment'),
  alter column reference set not null,
  add constraint payments_reference_key unique (reference),
  add constraint payments_reference_shaped check (reference ~ '^WP-P[1-9][0-9]{3,}$');

comment on column public.payments.reference is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] Short staff-facing payment number, WP-P1001 onwards, assigned by the column default when the row is created. provider_reference is unchanged and remains the provider, terminal or simulation reference shown beneath it; the card-number tripwire applies only to provider_reference.';


alter table public.refunds add column reference text;
update public.refunds r
   set reference = 'WP-R' || (1000 + numbered.position)::text
  from (select id, row_number() over (order by requested_at, id) as position from public.refunds) numbered
 where numbered.id = r.id;
select setval('internal.refund_number_seq', greatest(1000 + count(*), 1001), count(*) > 0) from public.refunds;
alter table public.refunds
  alter column reference set default internal.next_record_reference('refund'),
  alter column reference set not null,
  add constraint refunds_reference_key unique (reference),
  add constraint refunds_reference_shaped check (reference ~ '^WP-R[1-9][0-9]{3,}$');

comment on column public.refunds.reference is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] Short staff-facing refund number, WP-R1001 onwards, assigned by the column default when the row is created. provider_reference is unchanged and keeps its card-number tripwire.';


create or replace view public.booking_search
  with (security_invoker = true) as
  select
    b.id as booking_id,
    b.reference,
    b.status as booking_status,
    b.source,
    b.suite_id,
    s.suite_number,
    lower(b.experience_period) as experience_from,
    upper(b.experience_period) as experience_to,
    b.arrived_at,
    b.checked_in_at,
    b.checked_out_at,
    b.is_complimentary,
    b.created_at,
    c.id as customer_id,
    c.first_name,
    c.last_name,
    btrim(c.first_name || ' ' || c.last_name) as guest_name,
    c.email,
    c.phone_e164,
    coalesce(g.adults, 0) as adults,
    coalesce(g.children, 0) as children,
    coalesce(ps.status, 'open'::public.payment_status) as payment_status,
    pr.payment_reference,
    coalesce(pr.payment_references, array[]::text[]) as payment_references,
    b.total_fils
  from public.bookings b
  join public.customers c on c.id = b.customer_id
  left join public.suites s on s.id = b.suite_id
  left join lateral (
    select count(*) filter (where bg.kind = 'adult'::public.guest_kind)::integer as adults,
           count(*) filter (where bg.kind = 'child'::public.guest_kind)::integer as children
      from public.booking_guests bg
     where bg.booking_id = b.id
  ) g on true
  left join lateral (
    select nullif(concat_ws(' ', string_agg(distinct p.reference, ' '), string_agg(distinct p.provider_reference, ' ')), '') as payment_reference,
           array_remove(array_agg(distinct p.reference), null) || array_remove(array_agg(distinct p.provider_reference), null) as payment_references
      from public.payments p
     where p.booking_id = b.id
  ) pr on true
  left join lateral (
    select p.status
      from public.payments p
     where p.booking_id = b.id
     order by case p.status
       when 'fully_refunded'::public.payment_status then 1
       when 'partially_refunded'::public.payment_status then 2
       when 'paid'::public.payment_status then 3
       when 'manual_review'::public.payment_status then 4
       when 'pending'::public.payment_status then 5
       when 'failed'::public.payment_status then 6
       when 'cancelled'::public.payment_status then 7
       when 'open'::public.payment_status then 8
       else null::integer
     end
     limit 1
  ) ps on true;

comment on column public.booking_search.payment_reference is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] Every payment reference of the booking, space-separated, for staff search: the WP-P numbers first, then the provider references. Folded into this existing column so every search that already matches payment_reference — Reception, Management and the console search-key classifier — finds a booking by WP-P without a second column to keep in step.';
comment on column public.booking_search.payment_references is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] The same references as payment_reference, as an array: WP-P numbers, then provider references.';


create or replace view public.management_customers
  with (security_invoker = true) as
  select
    c.id,
    c.salutation,
    c.first_name,
    c.last_name,
    c.email,
    c.phone_e164,
    c.phone_country,
    c.date_of_birth,
    c.created_at,
    c.last_interaction_at,
    c.is_blocked,
    c.warning_note,
    c.internal_note,
    coalesce(v.bookings_count, 0) as bookings_count,
    coalesce(v.upcoming_count, 0) as upcoming_count,
    coalesce(v.completed_count, 0) as completed_count,
    coalesce(v.cancelled_count, 0) as cancelled_count,
    v.first_visit_at,
    v.last_visit_at,
    coalesce(m.paid_fils, 0) as paid_fils,
    v.next_visit_at,
    btrim(c.first_name || ' ' || c.last_name) as full_name,
    c.reference
  from public.customers c
  left join lateral (
    select count(*)::integer as bookings_count,
           count(*) filter (where b.status in ('confirmed', 'checked_in') and upper(b.experience_period) > now())::integer as upcoming_count,
           count(*) filter (where b.status = 'completed')::integer as completed_count,
           count(*) filter (where b.status = 'cancelled')::integer as cancelled_count,
           min(lower(b.experience_period)) filter (where b.status in ('confirmed', 'checked_in', 'completed') and lower(b.experience_period) <= now()) as first_visit_at,
           max(lower(b.experience_period)) filter (where b.status in ('confirmed', 'checked_in', 'completed') and lower(b.experience_period) <= now()) as last_visit_at,
           min(lower(b.experience_period)) filter (where b.status = 'confirmed' and lower(b.experience_period) > now()) as next_visit_at
      from public.bookings b
     where b.customer_id = c.id
  ) v on true
  left join lateral (
    select (coalesce((select sum(p.amount_fils)
                        from public.payments p
                        join public.bookings pb on pb.id = p.booking_id
                       where pb.customer_id = c.id
                         and p.status in ('paid', 'partially_refunded', 'fully_refunded')), 0)
          - coalesce((select sum(r.amount_fils)
                        from public.refunds r
                        join public.bookings rb on rb.id = r.booking_id
                       where rb.customer_id = c.id
                         and r.settled_at is not null), 0))::integer as paid_fils
  ) m on true
  where (select internal.is_management());

comment on column public.management_customers.reference is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] The customer''s WP-C number, for display and search.';


create or replace view public.management_payment_ledger
  with (security_invoker = true) as
  select
    p.id as payment_id,
    p.booking_id,
    b.reference as booking_reference,
    b.suite_id,
    s.suite_number,
    b.customer_id,
    btrim(c.first_name || ' ' || c.last_name) as customer_name,
    c.email as customer_email,
    p.method,
    p.status,
    p.amount_fils,
    p.service_fee_fils,
    p.tax_fils,
    p.is_simulated,
    p.provider_reference,
    p.note,
    p.recorded_at,
    internal.staff_display_name(p.recorded_by) as recorded_by_name,
    coalesce(r.requested_fils, 0) as refund_requested_fils,
    coalesce(r.pending_fils, 0) as refund_pending_fils,
    coalesce(r.returned_fils, 0) as refunded_fils,
    greatest(0, p.amount_fils - coalesce(r.requested_fils, 0)) as refundable_fils,
    p.reference
  from public.payments p
  join public.bookings b on b.id = p.booking_id
  join public.customers c on c.id = b.customer_id
  left join public.suites s on s.id = b.suite_id
  left join lateral (
    select sum(x.amount_fils) filter (where x.withdrawn_at is null)::integer as requested_fils,
           sum(x.amount_fils) filter (where x.is_pending)::integer as pending_fils,
           sum(x.amount_fils) filter (where x.settled_at is not null)::integer as returned_fils
      from public.refunds x
     where x.payment_id = p.id
  ) r on true
  where (select internal.has_permission('view_confidential_figures'::public.named_permission));

comment on column public.management_payment_ledger.reference is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] The payment''s WP-P number, shown above provider_reference.';


create or replace view public.management_refund_ledger
  with (security_invoker = true) as
  select
    r.id as refund_id,
    r.payment_id,
    r.booking_id,
    b.reference as booking_reference,
    b.suite_id,
    s.suite_number,
    b.customer_id,
    btrim(c.first_name || ' ' || c.last_name) as customer_name,
    c.email as customer_email,
    p.method as payment_method,
    p.is_simulated,
    r.amount_fils,
    r.tax_fils,
    case
      when r.withdrawn_at is not null then 'withdrawn'
      when r.settled_at is not null then 'returned'
      else 'pending'
    end as state,
    r.requested_by is null as is_automatic,
    r.reason,
    r.requested_at,
    internal.staff_display_name(r.requested_by) as requested_by_name,
    r.settled_at,
    r.provider_reference,
    r.withdrawn_at,
    internal.staff_display_name(r.withdrawn_by) as withdrawn_by_name,
    r.withdrawal_reason,
    r.reference
  from public.refunds r
  join public.payments p on p.id = r.payment_id
  join public.bookings b on b.id = r.booking_id
  join public.customers c on c.id = b.customer_id
  left join public.suites s on s.id = b.suite_id
  where (select internal.has_permission('view_confidential_figures'::public.named_permission));

comment on column public.management_refund_ledger.reference is
  '[OUR CHOICE — project owner''s direction, 13 September 2026] The refund''s WP-R number, shown above provider_reference.';


drop function public.booking_refunds(uuid);

create function public.booking_refunds(p_booking_id uuid)
returns table (
  refund_id uuid,
  payment_id uuid,
  amount_fils integer,
  tax_fils integer,
  is_pending boolean,
  is_automatic boolean,
  requested_at timestamptz,
  settled_at timestamptz,
  withdrawn_at timestamptz,
  reason text,
  reference text
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
    select r.id, r.payment_id, r.amount_fils, r.tax_fils, r.is_pending, r.requested_by is null,
           r.requested_at, r.settled_at, r.withdrawn_at, r.reason, r.reference
      from public.refunds r
     where r.booking_id = p_booking_id
     order by r.requested_at, r.id;
end
$$;

revoke all on function public.booking_refunds(uuid) from public;
grant execute on function public.booking_refunds(uuid) to authenticated, service_role;

comment on function public.booking_refunds(uuid) is
  '[Contract: "Reception cannot see confidential Management figures without explicit permission"; OUR CHOICE, Q-10] The refunds of ONE booking, for the staff member handling that booking — the same operational view of a booking''s own payment state that Reception already has of its total. What stays behind view_confidential_figures, through refunds_select_confidential, is the refund ledger as a list: totals, filters and every refund at once. This function does not stop a receptionist from opening many bookings one after another and reading each one''s refunds; closing that would mean hiding refunds from the booking page itself. Withdrawn requests are returned with withdrawn_at set so the booking''s history stays complete. is_automatic marks a refund the payment settlement started itself, which staff can confirm as returned but cannot withdraw. reference is the refund''s WP-R number [OUR CHOICE — project owner''s direction, 13 September 2026]; it was appended, so the function was dropped and recreated with its grants restated.';


create or replace function public.reception_customers(p_search text default '', p_id uuid default null)
returns table (
  id uuid,
  salutation public.salutation,
  first_name text,
  last_name text,
  email text,
  date_of_birth date,
  phone_e164 text,
  phone_country text,
  is_blocked boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not internal.is_staff() then
    raise exception 'An active Reception session is required' using errcode = '42501';
  end if;
  perform internal.require_desk_operator();
  return query select c.id, c.salutation, c.first_name, c.last_name, c.email, c.date_of_birth,
    c.phone_e164, c.phone_country, c.is_blocked
  from public.customers c
  where (p_id is null or c.id = p_id)
    and (p_id is not null or nullif(btrim(p_search), '') is null
      or strpos(lower(c.first_name || ' ' || c.last_name || ' ' || c.email || ' ' || c.phone_e164 || ' ' || c.reference), lower(btrim(p_search))) > 0)
  order by c.last_interaction_at desc nulls last, c.id
  limit 25;
end
$$;
