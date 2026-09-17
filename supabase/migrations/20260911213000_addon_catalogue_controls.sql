alter table public.addons
  add column eligible_min_guests integer,
  add column eligible_max_guests integer,
  add column eligible_min_hours integer,
  add column eligible_max_hours integer,
  add constraint addons_eligible_guests check (
    (eligible_min_guests is null or eligible_min_guests between 1 and 64) and
    (eligible_max_guests is null or eligible_max_guests between 1 and 64) and
    (eligible_min_guests is null or eligible_max_guests is null or eligible_min_guests <= eligible_max_guests)),
  add constraint addons_eligible_hours check (
    (eligible_min_hours is null or eligible_min_hours between 1 and 24) and
    (eligible_max_hours is null or eligible_max_hours between 1 and 24) and
    (eligible_min_hours is null or eligible_max_hours is null or eligible_min_hours <= eligible_max_hours));

create or replace view public.management_addons with (security_invoker = true) as
select id,name,description,image_path,kind,regular_price_fils,offer_price_fils,saving_label,
  default_quantity,min_quantity,max_quantity,is_locked,inventory,available_from,available_to,
  reception_note,is_taxable,is_active,sort_order,
  eligible_min_guests,eligible_max_guests,eligible_min_hours,eligible_max_hours
from public.addons where internal.is_management();

create or replace view public.public_addons with (security_invoker = false) as
select a.id,a.name,a.description,a.image_path,a.regular_price_fils,a.offer_price_fils,a.saving_label,a.kind,
  least(a.default_quantity,coalesce(a.inventory,a.default_quantity)) as default_quantity,
  a.min_quantity,least(a.max_quantity,coalesce(a.inventory,a.max_quantity)) as max_quantity,a.is_locked,
  (a.inventory is not null and a.inventory < a.min_quantity) as is_sold_out,a.is_taxable,
  a.eligible_min_guests,a.eligible_max_guests,a.eligible_min_hours,a.eligible_max_hours
from public.addons a where a.is_active
  and (a.available_from is null or a.available_from <= (now() at time zone 'Asia/Dubai')::date)
  and (a.available_to is null or a.available_to >= (now() at time zone 'Asia/Dubai')::date)
order by a.sort_order,a.name,a.id;

create or replace view public.staff_addons with (security_invoker = true) as
select p.id,p.name,p.description,p.image_path,p.regular_price_fils,p.offer_price_fils,p.saving_label,p.kind,
  p.default_quantity,p.min_quantity,p.max_quantity,p.is_locked,p.is_sold_out,a.sort_order,a.reception_note,p.is_taxable,
  p.eligible_min_guests,p.eligible_max_guests,p.eligible_min_hours,p.eligible_max_hours
from public.public_addons p join public.addons a on a.id=p.id;

create or replace function public.save_catalogue_item(p_kind text, p_values jsonb, p_expected jsonb)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_price public.price_rules%rowtype;
  v_addon public.addons%rowtype;
  v_current jsonb;
  v_id uuid;
begin
  perform internal.require_management();
  if jsonb_typeof(p_values) is distinct from 'object' or jsonb_typeof(p_expected) not in ('object','null') then
    raise exception 'Check your entries and try again.' using errcode = '22023';
  end if;
  v_id := (p_values ->> 'id')::uuid;
  if p_kind = 'price' then
    select to_jsonb(r) into v_current from public.price_rules r where r.id = v_id for update;
  elsif p_kind = 'addon' then
    select to_jsonb(a) into v_current from public.addons a where a.id = v_id for update;
  else
    raise exception 'Choose a rate or an add-on.' using errcode = '22023';
  end if;
  if v_id is not null and (v_current is null or p_expected is null or not v_current @> p_expected) then
    raise exception 'This item changed while you were editing. Close it and open the latest version.' using errcode = 'WP060';
  end if;
  if p_kind = 'price' then
    v_price := jsonb_populate_record(null::public.price_rules, p_values);
    select r.price_rule_id into v_id from public.set_price_tier(v_price.id,
      coalesce(v_price.code,'rate-' || gen_random_uuid()::text),v_price.guest_kind,v_price.from_hour,v_price.to_hour,
      v_price.regular_fils_per_hour,v_price.offer_fils_per_hour,v_price.offer_percent,v_price.weekdays,
      v_price.season_from,v_price.season_to,v_price.start_from_minutes,v_price.start_to_minutes,
      v_price.priority,v_price.is_active,'Price edited from Management.') r;
  else
    v_addon := jsonb_populate_record(null::public.addons, p_values);
    select a.addon_id into v_id from public.set_addon(v_addon.id,v_addon.name,v_addon.description,v_addon.image_path,
      v_addon.kind,v_addon.regular_price_fils,v_addon.offer_price_fils,v_addon.saving_label,v_addon.default_quantity,
      v_addon.min_quantity,v_addon.max_quantity,v_addon.is_locked,v_addon.inventory,v_addon.available_from,
      v_addon.available_to,v_addon.reception_note,v_addon.is_taxable,v_addon.is_active,v_addon.sort_order,
      'Add-on edited from Management.') a;
    update public.addons set eligible_min_guests=v_addon.eligible_min_guests, eligible_max_guests=v_addon.eligible_max_guests,
      eligible_min_hours=v_addon.eligible_min_hours, eligible_max_hours=v_addon.eligible_max_hours where id=v_id;
    perform internal.write_audit('set_addon_eligibility','public.addons',v_id::text,v_current,
      (select to_jsonb(a) from public.addons a where a.id=v_id),'Eligibility edited from Management.');
  end if;
  return v_id;
end $$;

create function internal.validate_booking_addon_selection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item public.addons%rowtype;
  guest_count integer;
  hours numeric;
  today date := (clock_timestamp() at time zone 'Asia/Dubai')::date;
begin
  if new.addon_id is null then return new; end if;
  select * into item from public.addons where id=new.addon_id for share;
  if not found then return new; end if;
  if not item.is_active or (item.available_from is not null and item.available_from>today)
    or (item.available_to is not null and item.available_to<today)
    or (item.inventory is not null and item.inventory<item.min_quantity) then
    raise exception '% is no longer available. Review your extras before continuing.',item.name using errcode='WP038';
  end if;
  if new.quantity < item.min_quantity or new.quantity > least(item.max_quantity,coalesce(item.inventory,item.max_quantity)) then
    raise exception 'The available quantity for % has changed. Review your extras before continuing.',item.name using errcode='WP037';
  end if;
  select count(*) into guest_count from public.booking_guests where booking_id=new.booking_id;
  select extract(epoch from upper(experience_period)-lower(experience_period))/3600 into hours from public.bookings where id=new.booking_id;
  if (item.eligible_min_guests is not null and guest_count<item.eligible_min_guests)
    or (item.eligible_max_guests is not null and guest_count>item.eligible_max_guests)
    or (item.eligible_min_hours is not null and hours<item.eligible_min_hours)
    or (item.eligible_max_hours is not null and hours>item.eligible_max_hours) then
    raise exception '% is not available for this visit. Review your extras before continuing.',item.name using errcode='WP038';
  end if;
  return new;
end
$$;
revoke all on function internal.validate_booking_addon_selection() from public,anon,authenticated;
create trigger booking_addons_validate_selection before insert on public.booking_addons
for each row execute function internal.validate_booking_addon_selection();
comment on function internal.validate_booking_addon_selection() is
  '[CLIENT pricing specification §8; OUR CHOICE] Rechecks availability, per-booking available quantity and guest/duration eligibility at the database write. Does not alter historical add-on snapshots. Inventory is the configured availability ceiling, not a warehouse stock ledger.';
comment on column public.addons.eligible_min_guests is '[CLIENT pricing specification §8] Optional booking eligibility, independent of the quantity selected by the guest.';
