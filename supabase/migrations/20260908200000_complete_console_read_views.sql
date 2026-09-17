create or replace function internal.alert_booking_id(
  p_entity    text,
  p_entity_id text
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not internal.is_staff() then null
    when p_entity = 'public.bookings' then
      (select b.id from public.bookings b where b.id::text = p_entity_id)
    when p_entity = 'public.refunds' then
      (select r.booking_id from public.refunds r where r.id::text = p_entity_id)
    when p_entity = 'public.messages' then
      (select m.booking_id from public.messages m where m.id::text = p_entity_id)
    when p_entity = 'public.suite_occupancy' then
      (select o.booking_id from public.suite_occupancy o where o.id::text = p_entity_id)
    when p_entity = 'public.cleaning_tasks' then
      (select c.booking_id from public.cleaning_tasks c where c.id::text = p_entity_id)
    else null
  end
$$;

comment on function internal.alert_booking_id(text, text) is
  'The booking an open alert concerns, or null when it concerns none [§9.3].

WHY IT EXISTS AT ALL. public.open_alerts already resolved a booking reference for entity = ''public.bookings'', and every other kind fell through to null. Two kinds carry an id that is one hop from a booking rather than a booking id: refund_pending carries a public.refunds id and message_failed carries a public.messages id, both raised that way by src/lib/domain/alerts. The Reception alert centre therefore showed those two a sentence of guidance where every other kind got a link, which is the alert list working for eight kinds out of ten. Two more hops are resolved here for the same reason — upcoming_conflict carries a public.suite_occupancy id and cleaning_unconfirmed a public.cleaning_tasks id, and both rows name their booking.

WHY IT IS SECURITY DEFINER, WHICH IS THE ONLY INTERESTING DECISION. public.refunds is readable only with perm:view_confidential_figures (refunds_select_confidential, transcribed from docs/5 §3), so a security_invoker view joining public.refunds resolves nothing for a Reception user without the named grant — exactly the user the alert centre is built for. Reading the join under the definer''s privileges returns a booking id and nothing else: no amount, no reason, no settlement state. That is the line §10.6 and INV-15 already draw and this function does not move it. public.open_alerts''s own comment states it: refund_pending appears for any staff member while the amount stays behind the permission. Knowing WHICH booking a pending refund belongs to is the alert being actionable; knowing HOW MUCH is the confidential figure, and it is still only on public.refunds and public.booking_detail.

IT IS STILL GATED. internal.is_staff() first, so a non-staff session that reaches the function directly gets null rather than a probe of "does this refund id belong to this booking". The view above it is separately gated by alerts_select_staff.

THE ENTITY PAIR IS MATCHED AS TEXT, never by casting p_entity_id to uuid, because public.alerts.entity_id is deliberately text and may one day point at something whose key is not a uuid. A cast would turn that future row into a runtime error for the whole view.

public.refunds.booking_id is read directly rather than through public.payments. Both exist and public.issue_refund writes the refund''s booking_id from the payment it locked, so the two-hop path returns the same value with one more join to keep in step.';

revoke all on function internal.alert_booking_id(text, text) from public;
grant execute on function internal.alert_booking_id(text, text) to authenticated, service_role;


create or replace view public.open_alerts
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
    b.reference as booking_reference,
    s.suite_number,
    b.id        as booking_id
  from public.alerts a
  left join public.bookings b
    on b.id = internal.alert_booking_id(a.entity, a.entity_id)
  left join public.suites s
    on a.entity = 'public.suites'
   and s.id::text = a.entity_id
  where a.resolved_at is null;

comment on view public.open_alerts is
  'Every unresolved operational alert [§9.3], with the booking and the suite already resolved from the entity pair so the console renders a sentence and a link instead of a uuid.

booking_reference and booking_id now cover every kind whose entity names or reaches a booking, through internal.alert_booking_id: a booking directly, a refund, a message, an occupancy row and a cleaning task. Both columns ship because they answer different questions — the reference is what a receptionist says out loud and reads on the guest''s email, the id is what /reception/bookings/[id] needs. Neither is derivable from the other on the client.

An alert row states that something needs attention. The FIGURE behind it stays where it was: refund_pending appears here for any staff member, while the amount sits behind perm:view_confidential_figures on public.refunds and public.booking_detail [§10.6, INV-15].

Resolved alerts are not here by design. §11.5 reports on them and reads public.alerts, which keeps every row.

security_invoker, so the caller''s policies apply. The one exception is the booking lookup, which is a SECURITY DEFINER function for the reason its own comment gives.';

comment on column public.open_alerts.booking_id is
  'The booking this alert concerns, or null. Present so the alert centre can link to /reception/bookings/[id] for a refund or a failed message, which previously had no destination and fell back to a paragraph of guidance.';

comment on column public.open_alerts.booking_reference is
  'The guest-facing reference of the booking this alert concerns, or null. Resolved for five entity kinds, not one.';


create view public.staff_addons
  with (security_invoker = true) as
  select
    p.id,
    p.name,
    p.description,
    p.image_path,
    p.regular_price_fils,
    p.offer_price_fils,
    p.saving_label,
    p.kind,
    p.default_quantity,
    p.min_quantity,
    p.max_quantity,
    p.is_locked,
    p.is_sold_out,
    a.sort_order,
    a.reception_note
  from public.public_addons p
  join public.addons a on a.id = p.id;

comment on view public.staff_addons is
  'The add-on catalogue Reception can sell today [§9.2, §10.4].

IT IS BUILT ON public.public_addons ON PURPOSE, AND THAT IS THE WHOLE POINT. Reception previously read public.addons directly, which carries neither is_sold_out nor the sales window: every add-on arrived at the desk with is_sold_out defaulting to false in the query wrapper, so the §4.1 sold-out state on the Reception card was unreachable code, and an add-on outside its sales dates was offered for sale. public.create_reception_booking then refuses that same add-on with WP038 — "switched off or outside its sales dates and cannot be sold today" — so the desk could reach a dead end the guest widget could not.

Deriving from the guest view rather than repeating its expressions means (a.inventory is not null and a.inventory <= 0) and the available_from/available_to window each exist ONCE. A second copy would be a second definition of "sold out" and the two would drift on the first change; the whole reason §6.6 puts Reception on the same engine as the website is that a walk-in and an online booking must see the same thing.

THE THREE COLUMNS THE GUEST VIEW WITHHOLDS ARE ADDED BACK HERE, under RLS. reception_note is the §8 preparation or return note, written for staff and never for a guest. sort_order is Management''s display order, which the guest view honours without publishing so that a caller cannot order by it. Both come from public.addons through a join, so security_invoker means addons_select_staff decides: a session that is not staff sees no rows at all, because the join finds nothing.

inventory is STILL NOT PUBLISHED, to anyone. It is a commercial figure and is_sold_out is the operational answer, exactly as the guest view already argues. A Management stock screen that genuinely needs the number reads public.addons, which is where it lives.';

comment on column public.staff_addons.is_sold_out is
  'Derived once, in public.public_addons, from inventory. Null inventory is unlimited and is therefore not sold out.';

comment on column public.staff_addons.reception_note is
  'The §8 preparation or return note. Staff only — it is the reason this view exists separately from the guest one rather than being an alias for it.';

revoke all on public.staff_addons from anon, authenticated;
grant select on public.staff_addons to authenticated;
