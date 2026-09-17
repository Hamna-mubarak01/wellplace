-- [CLIENT, §9.1, §10.6] Reduce console read latency without caching live records.
-- These role checks do not depend on a row. InitPlans evaluate them once per statement.
alter policy alerts_select_staff on public.alerts using ((select internal.is_staff()));
alter policy booking_guests_select_staff on public.booking_guests using ((select internal.is_staff()));
alter policy bookings_select_staff on public.bookings using ((select internal.is_staff()));
alter policy cleaning_tasks_select_staff on public.cleaning_tasks using ((select internal.is_staff()));
alter policy customers_select_staff on public.customers using ((select internal.is_staff()));
alter policy payments_select_staff on public.payments using ((select internal.is_staff()));
alter policy settings_select_staff on public.settings using ((select internal.is_staff()));
alter policy shift_notes_select_staff on public.shift_notes using ((select internal.is_staff()));
alter policy suite_occupancy_select_staff on public.suite_occupancy using ((select internal.is_staff()));
alter policy suites_select_staff on public.suites using ((select internal.is_staff()));
alter policy tasks_select_staff on public.tasks using ((select internal.is_staff()));
alter policy staff_select_self_or_management on public.staff
  using (id = (select internal.current_staff_id()) or (select internal.is_management()));
alter policy staff_permissions_select_self_or_management on public.staff_permissions
  using (staff_id = (select internal.current_staff_id()) or (select internal.is_management()));

-- [OUR CHOICE] Compose the existing authorized views into one network response.
-- Left join preserves holds/blocks and a booking whose contact cannot be read.
create view public.reception_schedule with (security_invoker = true) as
  select board.*, booking.email as guest_email, booking.phone_e164 as guest_phone,
    booking.adults, booking.children, booking.payment_status,
    (board.booking_id is not null and booking.booking_id is null) as details_unavailable
  from public.reception_board board
  left join public.booking_search booking on booking.booking_id = board.booking_id;
revoke all on public.reception_schedule from public, anon;
grant select on public.reception_schedule to authenticated;
comment on view public.reception_schedule is
  'Live calendar and guest summaries in one read [§9.1, §9.2]. Security invoker preserves the underlying views and RLS. No stored cache or change to availability.';

-- [OUR CHOICE] Match the scalar date predicates and stable ordering used by console views.
create index bookings_start_id_idx on public.bookings (lower(experience_period), id);
create index bookings_end_idx on public.bookings (upper(experience_period));
create index suite_occupancy_board_start_idx on public.suite_occupancy (lower(experience_period), id) where is_active;
create index suite_occupancy_board_end_idx on public.suite_occupancy (upper(blocked_period)) where is_active;

notify pgrst, 'reload schema';
