create or replace view public.public_addons with (security_invoker = false) as
select a.id,a.name,a.description,a.image_path,a.regular_price_fils,a.offer_price_fils,a.saving_label,a.kind,
  a.default_quantity,a.min_quantity,a.max_quantity,a.is_locked,
  (a.inventory is not null and a.inventory <= 0) as is_sold_out,a.is_taxable
from public.addons a where a.is_active
  and (a.available_from is null or a.available_from <= (now() at time zone 'Asia/Dubai')::date)
  and (a.available_to is null or a.available_to >= (now() at time zone 'Asia/Dubai')::date)
order by a.sort_order,a.name,a.id;
create or replace view public.staff_addons with (security_invoker = true) as
select p.id,p.name,p.description,p.image_path,p.regular_price_fils,p.offer_price_fils,p.saving_label,p.kind,
  p.default_quantity,p.min_quantity,p.max_quantity,p.is_locked,p.is_sold_out,a.sort_order,a.reception_note,p.is_taxable
from public.public_addons p join public.addons a on a.id = p.id;
comment on column public.public_addons.is_taxable is '[CLIENT pricing specification §8] Add-on VAT setting reaches the common guest and Reception pricing engine. No stock counts or preparation notes are exposed to guests.';
