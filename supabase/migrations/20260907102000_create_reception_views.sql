create or replace function internal.staff_display_name(p_staff_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.full_name
    from public.staff s
   where s.id = p_staff_id
     and internal.is_staff()
$$;

revoke all on function internal.staff_display_name(uuid) from public;
grant execute on function internal.staff_display_name(uuid) to authenticated, service_role;

comment on function internal.staff_display_name(uuid) is
  'Resolves one staff display name, and nothing else about that person.
public.staff is readable only by its owner or by Management
(staff_select_self_or_management, 20260828093500), which is the correct rule for
a roster: §10.6 gives account administration to Management alone. It is the
wrong rule for an operational row that NAMES a colleague. A Reception user
reading a task assigned to someone else, a shift note somebody left, or the
cleaner who confirmed suite 3 currently joins public.staff and gets a null,
which is why src/lib/db/queries/operations.ts embeds staff ( full_name ) today
and silently renders nothing for the whole Reception role.
This function is the narrow fix, chosen over widening the select policy on
public.staff. It returns the display name for an id the caller already holds on
an operational row, to a caller who is staff, and never the roster, the email,
the role or the active flag. Widening the policy instead would have made every
staff row and column visible to every session and would have contradicted
supabase/tests/roles.sql, which proves that Reception sees its own staff row and
no other [§10.6].';


create view public.reception_board
  with (security_invoker = true)
as
  select
    o.id                       as occupancy_id,
    o.suite_id,
    s.suite_number,
    o.kind,
    lower(o.experience_period) as experience_from,
    upper(o.experience_period) as experience_to,
    upper(o.blocked_period)    as blocked_to,
    o.cleaning_buffer_minutes,
    o.expires_at,
    o.reason,
    o.booking_id,
    b.reference                as booking_reference,
    b.status                   as booking_status,
    btrim(c.first_name || ' ' || c.last_name) as guest_name,
    case
      when o.kind = 'hold'         then 'hold'
      when o.kind = 'block'        then 'block'
      when o.kind = 'maintenance'  then 'maintenance'
      when ct.id is not null       then 'cleaning'
      when b.status = 'checked_in' then 'checked_in'
      when b.status = 'completed'  then 'completed'
      when b.status = 'no_show'    then 'no_show'
      else 'booked'
    end::text                  as board_state
  from public.suite_occupancy o
  join public.suites s
    on s.id = o.suite_id
  left join public.bookings b
    on b.id = o.booking_id
  left join public.customers c
    on c.id = b.customer_id
  left join lateral (
    select t.id
      from public.cleaning_tasks t
     where o.kind = 'booking'
       and o.booking_id is not null
       and t.booking_id = o.booking_id
       and t.status <> 'confirmed'
       and now() >= t.due_from
       and now() < upper(o.blocked_period)
     limit 1
  ) ct on true
  where o.is_active
    and (o.expires_at is null or o.expires_at > now());

comment on view public.reception_board is
  'One row per live claim on a suite, over any window [§9.1]. The board the
Reception console draws: "all seven suites showing holds, bookings, check-in,
cleaning, blocks, maintenance, no-show and completion". Reads
public.suite_occupancy, which is the one table the exclusion constraint governs,
so what the board shows and what the allocator enforces cannot disagree
[§3, §7.5, INV-02].
Q-16 GUARD, AND IT IS THE POINT OF THIS COMMENT. This view DISPLAYS cleaning.
Nothing in the allocation path may read it. internal.allocate_suite does not,
public.hold_suite does not, and neither may any successor: availability is
decided by the buffered blocked_period and the exclusion constraint alone, never
by whether a human has pressed confirm on a cleaning task. Wiring
public.cleaning_tasks into allocation would put a second source of truth beside
the constraint and would answer Q-16 by accident, in code, instead of by asking
the client. The table comment on public.cleaning_tasks records the same rule
from the other side.
security_invoker, so every base-table policy still applies to the caller. It is
a permission boundary and a stable contract, which a base-table select is
neither [R-03].';

comment on column public.reception_board.board_state is
  'One of exactly eight values, character-identical to BOARD_STATES in
src/components/console/reception/board-types.ts: hold, booked, checked_in,
cleaning, block, maintenance, no_show, completed. §9.1 names all eight, and a
ninth spelling here is a chip the console cannot colour. It replaces stateFor()
in src/lib/services/board-service.ts, which derived seven of them and could not
derive the eighth.
CLEANING IS THE ONE THAT NEEDED A DECISION, AND THIS IS IT. A booking claim
reads cleaning while an unconfirmed public.cleaning_tasks row belonging to that
same booking covers now(): from the task''s due_from, which is the check-out
instant and not the end of the stored buffer, until the end of blocked_period.
Three consequences, all deliberate. An early check-out shows cleaning early,
because that is when the suite is physically free to clean. A confirmed clean
stops showing it, whatever the buffer still says. And once the buffer has
elapsed the chip returns to completed, because at that instant the suite is
sellable again and a clean nobody confirmed is owned by the §9.3
cleaning_unconfirmed alert and by public.cleaning_board, not by a chip that
would otherwise say cleaning forever and rewrite every historical board.
Matching is on booking_id, never on suite plus a time window, so one booking''s
clean can never colour the claim next to it. A clean raised by a block or a
maintenance window has no booking to attach to, so those claims keep their own
state and their unconfirmed task surfaces in public.cleaning_board [§9.2].
Cleaning outranks the booking status for a booking claim, because it describes
the suite now and completed describes the visit.';

comment on column public.reception_board.blocked_to is
  'The end of the buffered claim [§7.1, INV-06]. The console draws the segment
between experience_to and this instant as the cleaning buffer. Taken from the
occupancy row, so the §7.1 worked example is read back from the same value the
exclusion constraint enforced.';

comment on column public.reception_board.expires_at is
  'The hold countdown [§7.3]. This view filters expired holds out entirely, so a
row reaching the board with a non-null value here always has time left on it.
Expiry is lazy and nothing waits for the sweep: the filter is the same
expires_at > now() every availability read applies [INV-05]. The previous
listOccupancy in src/lib/db/queries/board.ts filtered on is_active alone and
therefore drew a hold that had already expired as if it still held the suite.';

revoke all on public.reception_board from anon, authenticated;
grant select on public.reception_board to authenticated;


create view public.booking_search
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
    case
      when internal.has_permission('view_confidential_figures')
      then b.total_fils
    end                        as total_fils
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
  'THE Q-10 GATE, AND THIS IS ITS ONLY IMPLEMENTATION. docs/5 §3 puts revenue,
net figures, customer total value and payment links behind
perm:view_confidential_figures, and marks that reading of §10.6 as [OUR CHOICE]
because the contract states the rule and enumerates nothing. Null for a
Reception user without the named grant, the stored integer with it, and never a
zero, because a zero is a figure and would be a lie [§10.6, INV-15].
It is one expression per money column, in a view, on purpose. Reception still
holds a select grant on public.bookings, because §9.2 needs the operational row;
locking the base table would remove the desk''s ability to work. So the gate has
to live above it, and it has to live in ONE place or the answer to Q-10 becomes
whatever each caller remembered. If the client enumerates the confidential
figures differently, this expression is what changes.';

comment on column public.booking_search.payment_status is
  'The booking''s payment position in one column [OUR CHOICE]. A booking has many
public.payments rows — a retry after a failure, a link reissued at the desk, a
part payment — and §9.1''s payment filter needs a single value to match. This is
the most advanced state any of them reached, ranked fully_refunded,
partially_refunded, paid, manual_review, pending, failed, cancelled, open, and
open when the booking has no payment row at all.
IT IS A FILTER AID AND NOT THE RECONCILIATION RECORD. §8 requires gateway
transaction, booking, receipt and refund to be uniquely linked, and INV-21
requires reporting to sum stored values; both read public.payments row by row,
never this column. One consequence is worth knowing at the desk: a booking that
is paid and also carries a payment under manual_review reads paid, because paid
outranks it. The rows are all in public.payments and the detail view lists
them.';

comment on column public.booking_search.payment_reference is
  'Every provider reference on the booking, joined by a space, so one ilike
matches any of them — that is the fifth of §9.1''s five search keys.
DELIBERATELY NOT BEHIND perm:view_confidential_figures. docs/5 §3 gates payment
LINKS, which are the addressable URLs inside a message body and are handled in
public.booking_messages. A provider transaction reference is not a link and not a
figure, and the same docs/5 §3 row grants the payment-reference search to both
roles with a plain yes. public.booking_search.payment_references carries the
same values as an array, for a console that wants to render them one per line
instead of matching across them.';

revoke all on public.booking_search from anon, authenticated;
grant select on public.booking_search to authenticated;


create view public.booking_detail
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
    case when internal.has_permission('view_confidential_figures') then b.subtotal_fils    end as subtotal_fils,
    case when internal.has_permission('view_confidential_figures') then b.discount_fils    end as discount_fils,
    case when internal.has_permission('view_confidential_figures') then b.addons_fils      end as addons_fils,
    case when internal.has_permission('view_confidential_figures') then b.service_fee_fils end as service_fee_fils,
    case when internal.has_permission('view_confidential_figures') then b.tax_fils         end as tax_fils,
    case when internal.has_permission('view_confidential_figures') then b.total_fils       end as total_fils,
    case when internal.has_permission('view_confidential_figures') then coalesce(pd.paid_fils, 0)      end as paid_fils,
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
security_invoker, so the caller''s policies apply.';

comment on column public.booking_detail.total_fils is
  'Gated exactly as public.booking_search.total_fils is, and for the same Q-10
reasoning — see the comment there. Every money column on this view carries the
identical expression, so there is one answer to "may this person see a figure"
and not one per column.';

comment on column public.booking_detail.refunded_fils is
  'Settled refunds only, and gated. The gate is not redundant with the policy on
public.refunds. refunds_select_confidential already hides the ROWS from a
Reception user without the named grant, so an ungated sum over them would return
0 — a figure, and a wrong one. Null says "not yours to see"; zero says "no money
was returned", and those are different sentences [§10.6, INV-15].
public.booking_detail.refunds_pending_fils carries the amounts §11.2 shows as
pending, which is money owed and not yet gone.';

comment on column public.booking_detail.warning_note is
  'Ungated on purpose [§10.5]. §10.6 makes confidential FIGURES the permission,
not operational text, and a warning the front desk cannot read is a warning that
does not do its job. Same reasoning as customer_notes_select_staff.';

comment on column public.booking_detail.blocked_to is
  'The end of the buffered claim, read from the live occupancy row and therefore
null once the claim has been released — after a cancellation, after an atomic
reschedule, or in the §8.2 gap where a paid booking holds no suite. The
experience the guest bought is on the booking itself and survives all three
[§7.1, §8.2].';

revoke all on public.booking_detail from anon, authenticated;
grant select on public.booking_detail to authenticated;


create view public.reception_day_summary
  with (security_invoker = true)
as
  with operating_day as (
    select
      date_trunc('day', now() at time zone 'Asia/Dubai')
        at time zone 'Asia/Dubai' as day_from,
      (date_trunc('day', now() at time zone 'Asia/Dubai') + interval '1 day')
        at time zone 'Asia/Dubai' as day_to
  )
  select
    d.day_from,
    d.day_to,
    (
      select count(*)::integer
        from public.bookings b
       where b.experience_period && tstzrange(d.day_from, d.day_to, '[)')
         and b.status not in ('draft', 'abandoned', 'hold_expired', 'cancelled')
    ) as bookings_today,
    (
      select count(*)::integer
        from public.booking_guests bg
        join public.bookings b on b.id = bg.booking_id
       where b.experience_period && tstzrange(d.day_from, d.day_to, '[)')
         and b.status not in ('draft', 'abandoned', 'hold_expired', 'cancelled', 'no_show')
    ) as guests_expected,
    (
      select count(*)::integer
        from public.bookings b
       where b.experience_period && tstzrange(d.day_from, d.day_to, '[)')
         and b.status = 'confirmed'
         and b.checked_in_at is null
         and upper(b.experience_period) > now()
    ) as arrivals_remaining,
    (
      select count(distinct o.suite_id)::integer
        from public.suite_occupancy o
       where o.is_active
         and o.blocked_period && tstzrange(d.day_from, d.day_to, '[)')
         and (o.expires_at is null or o.expires_at > now())
    ) as suites_claimed,
    (
      select count(*)::integer
        from public.suite_occupancy o
       where o.is_active
         and o.kind = 'hold'
         and o.expires_at > now()
    ) as active_holds,
    (
      select count(*)::integer
        from public.suites s
       where s.is_active
         and s.status in ('blocked', 'maintenance', 'not_ready', 'out_of_service')
    ) as suites_unavailable
  from operating_day d;

comment on view public.reception_day_summary is
  'The counts on §9.1''s live daily overview: bookings today, guests expected,
arrivals still to come, suites claimed, live holds and suites unavailable. One
row, always.
NO MONEY COLUMN, and that is a decision rather than an omission. §10.6 puts
confidential figures behind a named permission and Q-10 has not been answered,
so a revenue figure on the one screen every Reception session opens would be the
worst possible place to guess. Money is in public.booking_detail and
public.booking_search, gated per column.
security_invoker, so the caller''s policies apply.';

comment on column public.reception_day_summary.day_from is
  'Today in DUBAI, resolved here rather than by the caller. This view names
Asia/Dubai and it is the only one that does, because an operating day is a
wall-clock day at the venue [§11.1, §13, INV-24]: a shift that runs past
midnight UTC still belongs to the day Reception calls it. Every instant stored
anywhere remains UTC in a timestamptz, and the zone is not a setting because
the venue does not move.
The window is half open, day_from inclusive to day_to exclusive, so the same
booking is never counted on two days.';

comment on column public.reception_day_summary.bookings_today is
  'Bookings whose experience overlaps today, excluding the four statuses that
never became a visit: draft, abandoned, hold_expired and cancelled. A no_show IS
counted, because a guest who did not arrive still occupied the slot and §11.3
reports on exactly that. public.reception_day_summary.guests_expected excludes
it instead, since nobody is expected any more.';

comment on column public.reception_day_summary.active_holds is
  'Live holds across the whole venue, NOT only the ones for today. A hold is a
ten-minute countdown a guest is inside right now [§7.3]; one taken for next
Tuesday is still a live claim Reception may have to explain this minute, and
hiding it because of the date it points at would make the overview disagree with
the board. Expired holds are excluded by expires_at > now() and never wait for
the sweep [INV-05].';

comment on column public.reception_day_summary.suites_unavailable is
  'Suites in the four statuses §7.2 says are never auto-allocated: blocked,
maintenance, not_ready and out_of_service [INV-07]. A count, never a list of
numbers, because this figure is also the closest thing on the overview to a
capacity total, and suite numbers and capacity never leave the console
[§3, INV-01].';

revoke all on public.reception_day_summary from anon, authenticated;
grant select on public.reception_day_summary to authenticated;


create view public.open_alerts
  with (security_invoker = true)
as
  select
    a.id        as alert_id,
    a.kind,
    a.severity,
    a.entity,
    a.entity_id,
    a.opened_at,
    a.detail,
    b.reference    as booking_reference,
    s.suite_number
  from public.alerts a
  left join public.bookings b
    on a.entity = 'public.bookings'
   and b.id::text = a.entity_id
  left join public.suites s
    on a.entity = 'public.suites'
   and s.id::text = a.entity_id
  where a.resolved_at is null;

comment on view public.open_alerts is
  'Every unresolved operational alert [§9.3], with the booking reference or the
suite number already resolved from the entity pair so the console renders a
sentence instead of a uuid. The join is on entity plus entity_id as text and
never a cast of entity_id, because public.alerts.entity_id is deliberately text
and may one day point at something whose key is not a uuid.
An alert row states that something needs attention. The FIGURE behind it stays
where it was: refund_pending appears here for any staff member, while the amount
sits behind perm:view_confidential_figures on public.refunds and
public.booking_detail [§10.6, INV-15].
Resolved alerts are not here by design. §11.5 reports on them and reads
public.alerts, which keeps every row.
security_invoker, so the caller''s policies apply.';

revoke all on public.open_alerts from anon, authenticated;
grant select on public.open_alerts to authenticated;


create view public.staff_tasks
  with (security_invoker = true)
as
  select
    t.id      as task_id,
    t.title,
    t.note,
    t.due_on,
    t.priority,
    t.status,
    t.assigned_to,
    internal.staff_display_name(t.assigned_to)  as assigned_to_name,
    t.assigned_by,
    internal.staff_display_name(t.assigned_by)  as assigned_by_name,
    t.completed_at,
    t.completed_by,
    internal.staff_display_name(t.completed_by) as completed_by_name,
    t.created_at,
    t.updated_at
  from public.tasks t;

comment on view public.staff_tasks is
  'The §10.6 task list, with the three staff references already named. Every
task, open and closed, assigned and unassigned: docs/5 §3 gives both roles the
whole list, and §9.2 has Reception completing tasks Management raised, which a
list filtered to the assignee would hide. An unassigned task is the one a task
list should show first, so assignment is a routing hint here and never a
visibility boundary.
The names come through internal.staff_display_name because public.staff is
readable only by its owner or by Management. See the comment on that function.
security_invoker, so the caller''s policies apply.';

revoke all on public.staff_tasks from anon, authenticated;
grant select on public.staff_tasks to authenticated;


create view public.cleaning_board
  with (security_invoker = true)
as
  select
    t.id       as cleaning_task_id,
    t.suite_id,
    s.suite_number,
    t.booking_id,
    b.reference as booking_reference,
    t.status,
    t.due_from,
    t.started_at,
    t.assigned_to,
    internal.staff_display_name(t.assigned_to)  as assigned_to_name,
    t.confirmed_at,
    t.confirmed_by,
    internal.staff_display_name(t.confirmed_by) as confirmed_by_name,
    t.note,
    t.created_at,
    t.updated_at
  from public.cleaning_tasks t
  join public.suites s
    on s.id = t.suite_id
  left join public.bookings b
    on b.id = t.booking_id;

comment on view public.cleaning_board is
  'Cleaning tasks with the suite, the booking and the staff already resolved
[§9.2]: start, assign and confirm are the three actions, and this is what the
console lists them from.
A row here NEVER gates availability [Q-16]. §7.1 gives the cleaning buffer that
job and public.suite_occupancy enforces it, so a suite becomes sellable when its
buffer elapses whether or not anybody pressed confirm; an unconfirmed task
raises the §9.3 cleaning_unconfirmed alert and does nothing else. This view is
also where an OVERDUE clean stays visible once
public.reception_board.board_state has stopped showing cleaning for it.
security_invoker, so the caller''s policies apply.';

revoke all on public.cleaning_board from anon, authenticated;
grant select on public.cleaning_board to authenticated;


create view public.shift_handover
  with (security_invoker = true)
as
  select
    n.id        as shift_note_id,
    n.shift_on,
    n.body,
    n.author_id,
    internal.staff_display_name(n.author_id) as author_name,
    n.handed_over_at,
    n.created_at,
    n.updated_at
  from public.shift_notes n;

comment on view public.shift_handover is
  'The §9.2 handover, with the author named. A note whose handed_over_at is null
has been written and not yet passed on, which is an unfinished handover and
reads differently from a completed one — doc 3''s "real Reception use" defect
class names a shift handover mid-day as its own scenario, so the two states stay
distinguishable here.
security_invoker, so the caller''s policies apply.';

revoke all on public.shift_handover from anon, authenticated;
grant select on public.shift_handover to authenticated;


create view public.booking_messages
  with (security_invoker = true)
as
  select
    m.id          as message_id,
    m.booking_id,
    b.reference   as booking_reference,
    m.customer_id,
    m.template_key,
    m.channel,
    m.status,
    m.to_address,
    m.is_marketing,
    m.attempt_count,
    m.last_attempt_at,
    m.sent_at,
    m.failed_at,
    m.error,
    m.provider_message_id,
    m.created_at,
    (m.body is not null) as has_body,
    case
      when internal.has_permission('view_confidential_figures')
      then m.subject
    end as subject,
    case
      when internal.has_permission('view_confidential_figures')
      then m.body
    end as body
  from public.messages m
  left join public.bookings b
    on b.id = m.booking_id;

comment on view public.booking_messages is
  'The §11.5 message log: delivery, errors and retry attempts for email and
WhatsApp, per booking. Also what §9.2''s resend reads before it resends, and what
§9.3''s message_failed alert is raised from.
security_invoker, so the caller''s policies apply.';

comment on column public.booking_messages.body is
  'GATED, AND THE DECISION WAS BETWEEN GATING AND REDACTING. docs/5 §3 puts
payment links behind perm:view_confidential_figures, and a rendered body is
where a payment link actually lives — the A4 comment on messages_select_staff
flagged this view as the place to handle it.
Redaction was rejected: a pattern that strips a URL has to be right about every
template forever, and the first template that formats a link differently leaks
it silently. So the whole body is returned or none of it is, which fails closed.
Gating only the payment_link and secure_link templates was rejected for the same
family of reasons: a confirmation body carries the opaque guest link too
[§6.5, INV-25], and a rule that enumerates template keys rots the moment a
template changes.
NOTHING §9.2 OR §9.3 NEEDS IS BEHIND THE GATE. template_key, channel, status,
attempt_count, last_attempt_at, failed_at, error, sent_at and to_address are all
readable by any staff member, so a resend and a failure alert work without the
named permission. public.booking_messages.has_body is true whenever a body
exists, so a Reception user can tell a message that was rendered and hidden from
one that was never rendered at all — an absent body is a fact §11.5 reports on,
not a blank message.';

comment on column public.booking_messages.subject is
  'Gated with the body, because an email subject is rendered from the same
template and carries the same risk of quoting what the body says.';

revoke all on public.booking_messages from anon, authenticated;
grant select on public.booking_messages to authenticated;
