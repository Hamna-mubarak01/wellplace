

grant usage on schema internal to authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from public, anon, authenticated;

revoke all on public.suites             from anon, authenticated;
revoke all on public.suite_occupancy    from anon, authenticated;
revoke all on public.settings           from anon, authenticated;
revoke all on public.staff              from anon, authenticated;
revoke all on public.staff_permissions  from anon, authenticated;

grant select on public.suites            to authenticated;
grant select on public.suite_occupancy   to authenticated;
grant select on public.settings          to authenticated;
grant select on public.staff             to authenticated;
grant select on public.staff_permissions to authenticated;

create policy staff_select_self_or_management on public.staff
  for select to authenticated
  using (id = internal.current_staff_id() or internal.is_management());

create policy staff_insert_management on public.staff
  for insert to authenticated
  with check (internal.is_management());

create policy staff_update_management on public.staff
  for update to authenticated
  using (internal.is_management())
  with check (internal.is_management());

create policy staff_permissions_select_self_or_management on public.staff_permissions
  for select to authenticated
  using (staff_id = internal.current_staff_id() or internal.is_management());

create policy staff_permissions_insert_management on public.staff_permissions
  for insert to authenticated
  with check (internal.is_management());

create policy staff_permissions_delete_management on public.staff_permissions
  for delete to authenticated
  using (internal.is_management());

create policy suites_select_staff on public.suites
  for select to authenticated
  using (internal.is_staff());

create policy suites_insert_management on public.suites
  for insert to authenticated
  with check (internal.is_management());

create policy suites_update_management on public.suites
  for update to authenticated
  using (internal.is_management())
  with check (internal.is_management());

create policy suite_occupancy_select_staff on public.suite_occupancy
  for select to authenticated
  using (internal.is_staff());

create policy settings_select_staff on public.settings
  for select to authenticated
  using (internal.is_staff());

create policy settings_insert_management on public.settings
  for insert to authenticated
  with check (internal.is_management());

create policy settings_update_management on public.settings
  for update to authenticated
  using (internal.is_management())
  with check (internal.is_management());
