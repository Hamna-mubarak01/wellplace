create view public.management_price_rules with (security_invoker = true) as
select id, code, guest_kind, from_hour, to_hour, regular_fils_per_hour, offer_fils_per_hour,
  offer_percent, weekdays, season_from, season_to, start_from_minutes, start_to_minutes, priority, is_active
from public.price_rules;
create view public.management_addons with (security_invoker = true) as
select id, name, description, image_path, kind, regular_price_fils, offer_price_fils, saving_label,
  default_quantity, min_quantity, max_quantity, is_locked, inventory, available_from, available_to,
  reception_note, is_taxable, is_active, sort_order
from public.addons;
revoke all on public.management_price_rules, public.management_addons from public, anon;
grant select on public.management_price_rules, public.management_addons to authenticated;

create function public.save_catalogue_item(p_kind text, p_values jsonb, p_expected jsonb)
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
  end if;
  return v_id;
end $$;
revoke all on function public.save_catalogue_item(text,jsonb,jsonb) from public,anon;
grant execute on function public.save_catalogue_item(text,jsonb,jsonb) to authenticated;
comment on function public.save_catalogue_item(text,jsonb,jsonb) is '[CLIENT pricing specification §7–8; §10.4; OUR CHOICE] Management catalogue editor. Locks and compares the existing row before calling the original validated, audited pricing RPC. Disabling preserves historical booking prices. No public guest writes.';
comment on view public.management_price_rules is '[§10.4; CLIENT pricing specification §7] Editable rate catalogue, including inactive rates; underlying staff RLS remains enforced.';
comment on view public.management_addons is '[§10.4; CLIENT pricing specification §8] Editable add-on catalogue including inactive entries and preparation notes; underlying staff RLS remains enforced.';

do $$
declare v_row public.price_rules%rowtype;
begin
  if not exists(select 1 from public.price_rules) then
    for v_row in
      insert into public.price_rules(code,guest_kind,from_hour,to_hour,regular_fils_per_hour,offer_fils_per_hour,priority)
      values ('adult-first-two','adult',1,2,22000,16500,0),('adult-additional','adult',3,null,22000,14000,0),
        ('child-first-two','child',1,2,17000,12750,0),('child-additional','child',3,null,17000,11000,0)
      returning *
    loop
      perform internal.write_audit('initialize_launch_prices','public.price_rules',v_row.id::text,null,to_jsonb(v_row),
        '[CLIENT] Approved launch pricing, 1 September 2026. Only an empty catalogue is initialized; existing rates are preserved.');
    end loop;
  end if;
end $$;
