create or replace view public.booking_search
  with (security_invoker = true)
as
  select
    b.id                       as booking_id,
    b.reference,
    b.status                   as booking_status,
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
    c.id                       as customer_id,
    c.first_name,
    c.last_name,
    btrim(c.first_name || ' ' || c.last_name) as guest_name,
    c.email,
    c.phone_e164,
    coalesce(g.adults, 0)      as adults,
    coalesce(g.children, 0)    as children,
    coalesce(ps.status, 'open'::public.payment_status) as payment_status,
    pr.payment_reference,
    coalesce(pr.payment_references, array[]::text[]) as payment_references,
    b.total_fils
  from public.bookings b
  join public.customers c
    on c.id = b.customer_id
  left join public.suites s
    on s.id = b.suite_id
  left join lateral (
    select
      (count(*) filter (where bg.kind = 'adult'))::integer as adults,
      (count(*) filter (where bg.kind = 'child'))::integer as children
      from public.booking_guests bg
     where bg.booking_id = b.id
  ) g on true
  left join lateral (
    select
      string_agg(distinct p.provider_reference, ' ')                as payment_reference,
      array_remove(array_agg(distinct p.provider_reference), null)  as payment_references
      from public.payments p
     where p.booking_id = b.id
  ) pr on true
  left join lateral (
    select p.status
      from public.payments p
     where p.booking_id = b.id
     order by case p.status
       when 'fully_refunded'     then 1
       when 'partially_refunded' then 2
       when 'paid'               then 3
       when 'manual_review'      then 4
       when 'pending'            then 5
       when 'failed'             then 6
       when 'cancelled'          then 7
       when 'open'               then 8
     end
     limit 1
  ) ps on true;

comment on view public.booking_search is
  'One row per booking, carrying every key §9.1 requires Reception to search on:
"by name, mobile, email, booking reference and payment reference". All five are
plain columns here, so a search is one ilike across this view rather than a join
the caller has to assemble, and so no surface has to reach a base table to find
a guest [R-03]. No per-creator filter, matching docs/5 §1: Reception sees every
booking, not only the ones it made.
security_invoker, so the caller''s policies still decide which rows come back.';

comment on column public.booking_search.total_fils is
  'THE Q-10 ANSWER, AND THIS VIEW IS NO LONGER A GATE ON IT. Ungated from
20260908210000: every staff member reads the total of the booking in front of
them, with no named permission.
§10.6 makes "confidential Management FIGURES" the permission, and §10.1
enumerates what a Management figure is — "gross sales, refunds, net revenue,
open payments and payment links". Every item on that line is an aggregate across
bookings or a payment instrument. A single booking''s own total is neither.
§9.2 is what settles it. Reception creates walk-in, telephone, manual and
complimentary bookings and records "cash, card terminal, payment link, online
payment and complimentary" against them. Nobody can take AED 660 in cash against
a total they are not allowed to read, and the previous rule let a receptionist
quote that number while creating the booking and then hid it an hour later —
which is not a boundary, it is a boundary defeated by a sticky note.
WHAT DID NOT MOVE: refund amounts (public.refunds and
refunds_select_confidential), a customer''s total value across visits, payment
links inside a message body (public.booking_messages), the audit log, and every
aggregate. Those are the §10.1 list and they stay behind
perm:view_confidential_figures [§10.6, INV-15].
Recorded as [ASSUMED]. It is this build''s
reading of §10.6, not a client instruction, and if the client enumerates the
confidential figures differently this expression and
public.booking_detail''s are the two places that change.';

create or replace view public.booking_detail
  with (security_invoker = true)
as
  select
    b.id                       as booking_id,
    b.reference,
    b.status                   as booking_status,
    b.source,
    b.suite_id,
    s.suite_number,
    b.occupancy_id,
    lower(b.experience_period) as experience_from,
    upper(b.experience_period) as experience_to,
    upper(o.blocked_period)    as blocked_to,
    b.cleaning_buffer_minutes,
    b.arrived_at,
    b.checked_in_at,
    b.checked_out_at,
    b.late_arrival_minutes,
    b.overrun_minutes,
    b.personal_request,
    b.internal_note,
    b.is_complimentary,
    b.created_at,
    b.updated_at,
    b.created_by,
    internal.staff_display_name(b.created_by) as created_by_name,
    coalesce(g.adults, 0)      as adults,
    coalesce(g.children, 0)    as children,
    coalesce(g.child_ages, array[]::integer[]) as child_ages,
    c.id                       as customer_id,
    c.salutation,
    c.first_name,
    c.last_name,
    btrim(c.first_name || ' ' || c.last_name) as guest_name,
    c.email,
    c.phone_e164,
    c.phone_country,
    c.date_of_birth,
    c.is_blocked,
    c.warning_note,
    coalesce(ps.status, 'open'::public.payment_status) as payment_status,
    b.subtotal_fils,
    b.discount_fils,
    b.addons_fils,
    b.service_fee_fils,
    b.tax_fils,
    b.total_fils,
    coalesce(pd.paid_fils, 0) as paid_fils,
    case when internal.has_permission('view_confidential_figures') then coalesce(rf.settled_fils, 0)   end as refunded_fils,
    case when internal.has_permission('view_confidential_figures') then coalesce(rf.pending_fils, 0)   end as refunds_pending_fils
  from public.bookings b
  join public.customers c
    on c.id = b.customer_id
  left join public.suites s
    on s.id = b.suite_id
  left join public.suite_occupancy o
    on o.id = b.occupancy_id
  left join lateral (
    select
      (count(*) filter (where bg.kind = 'adult'))::integer as adults,
      (count(*) filter (where bg.kind = 'child'))::integer as children,
      array_agg(bg.age order by bg.age) filter (where bg.kind = 'child') as child_ages
      from public.booking_guests bg
     where bg.booking_id = b.id
  ) g on true
  left join lateral (
    select sum(p.amount_fils)::integer as paid_fils
      from public.payments p
     where p.booking_id = b.id
       and p.status in ('paid', 'partially_refunded', 'fully_refunded')
  ) pd on true
  left join lateral (
    select
      (sum(r.amount_fils) filter (where r.settled_at is not null))::integer as settled_fils,
      (sum(r.amount_fils) filter (where r.is_pending))::integer             as pending_fils
      from public.refunds r
     where r.booking_id = b.id
  ) rf on true
  left join lateral (
    select p.status
      from public.payments p
     where p.booking_id = b.id
     order by case p.status
       when 'fully_refunded'     then 1
       when 'partially_refunded' then 2
       when 'paid'               then 3
       when 'manual_review'      then 4
       when 'pending'            then 5
       when 'failed'             then 6
       when 'cancelled'          then 7
       when 'open'               then 8
     end
     limit 1
  ) ps on true;

comment on view public.booking_detail is
  'One booking, whole: the stored priced breakdown, the guest counts and the
children''s ages, the buffer it was sold with, the three stay instants, late
arrival and overrun, both notes, and the customer''s blocked status and warning
[§6, §7, §9.2, §10.5]. What Reception opens from the board and what a receipt
and a §11.1 drill-down read.
Every figure is the value STORED on the booking. Nothing here recomputes a price
from today''s configuration [INV-21], which is why a retuned service fee or a new
promo code cannot rewrite what a guest was charged last month.
THE MONEY BOUNDARY, RESTATED FROM 20260908210000 [Q-10, ASSUMED]. This booking''s
own figures are operational and every staff member reads them without a grant:
subtotal, discount, add-ons, service fee, tax, total, and how much has been paid
against it. §10.6 gates confidential Management FIGURES and §10.1 enumerates
them — "gross sales, refunds, net revenue, open payments and payment links" —
which are aggregates and payment instruments, not the price of the booking on
the desk in front of you. §9.2 gives Reception walk-in creation and cash
recording, and neither works against a hidden total.
STILL GATED HERE: refunded_fils and refunds_pending_fils, on
perm:view_confidential_figures, because "refunds" is on the §10.1 list by name
and public.refunds carries the same rule at row level. §9.3''s refund_pending
alert already tells the desk WHICH booking needs attention; HOW MUCH is the
confidential figure.
security_invoker, so the caller''s policies apply.';

comment on column public.booking_detail.total_fils is
  'Ungated, exactly as public.booking_search.total_fils is, and for the same Q-10
reasoning — see the comment there. Every column of the stored priced breakdown
on this view carries the identical treatment, so there is one answer to "may
this person see this booking''s price" and not one per column.';

comment on column public.booking_detail.paid_fils is
  'How much has been settled against THIS booking, summed from public.payments
rows in a paid, partially refunded or fully refunded state. Ungated with the
rest of the breakdown [Q-10].
It is the second half of the §9.2 desk action: a receptionist recording a
payment has to know the total and the balance already taken, and the rows it
sums are readable to any staff session anyway under payments_select_staff, so
gating the sum here only hid arithmetic the caller could redo.
"Open payments" on the §10.1 list is the Management dashboard''s aggregate of
outstanding money across bookings. It is not one booking''s paid figure, and the
aggregate is not projected by this view.';

comment on column public.booking_detail.refunded_fils is
  'Settled refunds only, and STILL GATED after the Q-10 widening of 20260908210000
— "refunds" is named on §10.1''s own list of Management figures, so it stays
behind perm:view_confidential_figures while the booking''s price moves out.
The gate is not redundant with the policy on public.refunds.
refunds_select_confidential already hides the ROWS from a Reception user without
the named grant, so an ungated sum over them would return 0 — a figure, and a
wrong one. Null says "not yours to see"; zero says "no money was returned", and
those are different sentences [§10.6, INV-15].
public.booking_detail.refunds_pending_fils carries the amounts §11.2 shows as
pending, which is money owed and not yet gone, and is gated the same way.';

comment on column public.bookings.total_fils is
  'The amount the guest owes, before any refund. Not gated on this table, and as
of 20260908210000 not gated in the views that project it either: Q-10 is
answered [ASSUMED, docs/9 §3]. §10.6''s confidential figures are §10.1''s
enumerated ones — gross sales, refunds, net revenue, open payments and payment
links — every one an aggregate or a payment instrument. A single booking''s own
total is an operational fact §9.2 requires at the desk.
public.booking_detail and public.booking_search project it to every staff
session. What remains behind perm:view_confidential_figures is refunds, a
customer''s total value, payment links and the audit log. Base-table RLS here is
staff read, matching docs/5 §3.';
