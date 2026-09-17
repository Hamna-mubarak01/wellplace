

create or replace function internal.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger suites_set_updated_at
  before update on public.suites
  for each row execute function internal.set_updated_at();

create trigger suite_occupancy_set_updated_at
  before update on public.suite_occupancy
  for each row execute function internal.set_updated_at();

create trigger staff_set_updated_at
  before update on public.staff
  for each row execute function internal.set_updated_at();

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function internal.set_updated_at();
