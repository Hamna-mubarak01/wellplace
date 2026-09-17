create or replace view public.management_price_rules with (security_invoker = true) as
select id, code, guest_kind, from_hour, to_hour, regular_fils_per_hour, offer_fils_per_hour,
  offer_percent, weekdays, season_from, season_to, start_from_minutes, start_to_minutes, priority, is_active
from public.price_rules where internal.is_management();

create or replace view public.management_addons with (security_invoker = true) as
select id, name, description, image_path, kind, regular_price_fils, offer_price_fils, saving_label,
  default_quantity, min_quantity, max_quantity, is_locked, inventory, available_from, available_to,
  reception_note, is_taxable, is_active, sort_order
from public.addons where internal.is_management();

create or replace view public.public_price_rules with (security_invoker = false) as
select r.id, r.guest_kind, r.from_hour, r.to_hour, r.regular_fils_per_hour, r.offer_fils_per_hour,
  r.offer_percent, r.weekdays, r.season_from, r.season_to, r.start_from_minutes, r.start_to_minutes, r.priority
from public.price_rules r
where r.is_active and (r.season_to is null or r.season_to >= (now() at time zone 'Asia/Dubai')::date)
order by r.priority desc, r.from_hour, r.id;

comment on view public.management_addons is '[§10.4, §13; OUR CHOICE] Management-only editable catalogue, including inactive items and inventory. Reception uses staff_addons; guests use public_addons.';
comment on view public.management_price_rules is '[§10.4, §13; OUR CHOICE] Management-only editable rates, including inactive entries. Public rates stay limited to active entries.';
comment on view public.public_price_rules is '[§10.4, §13] Active rates use Dubai dates for expiry, matching the guest and Reception price engine.';
