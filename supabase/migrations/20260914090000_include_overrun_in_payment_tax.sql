create function internal.inclusive_vat_fils(p_gross_fils integer)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select case
             when (s.value #>> '{}')::numeric > 0 and p_gross_fils > 0
               then p_gross_fils - round(p_gross_fils::numeric / (1 + (s.value #>> '{}')::numeric / 100))::integer
             else 0
           end
      from public.settings s
     where s.key = 'tax.vat_percent' and jsonb_typeof(s.value) = 'number'
  ), 0)
$$;

revoke all on function internal.inclusive_vat_fils(integer) from public, anon, authenticated, service_role;

comment on function internal.inclusive_vat_fils(integer) is
  '[CLIENT pricing specification: 5% VAT included; OUR CHOICE — project owner''s direction, 14 September 2026] The VAT inside a VAT-inclusive gross amount at the current tax.vat_percent: gross less round(gross / (1 + rate / 100)), the pricing engine''s taxWithin. Zero while the rate is unset, zero or the amount is not positive. Used for the overstay charge, which record_overrun prices at VAT-inclusive rates [Q-21] and keeps outside the booking total.';

create or replace function internal.assign_payment_tax()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tax     integer;
  v_gross   integer;
  v_kept    bigint;
  v_through bigint;
begin
  if new.status not in ('paid', 'partially_refunded', 'fully_refunded') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status in ('paid', 'partially_refunded', 'fully_refunded') then
    return new;
  end if;

  select coalesce((a.snapshot -> 'breakdown' ->> 'taxFils')::integer,
                  b.tax_fils + internal.inclusive_vat_fils(coalesce(b.overrun_fils, 0))),
         coalesce((a.snapshot -> 'breakdown' ->> 'totalFils')::integer,
                  b.total_fils + coalesce(b.overrun_fils, 0))
    into v_tax, v_gross
    from public.bookings b
    left join internal.checkout_attempts a on a.payment_id = new.id
   where b.id = new.booking_id;

  select greatest(0, coalesce(sum(p.amount_fils - coalesce((
           select sum(r.amount_fils) from public.refunds r
            where r.payment_id = p.id and r.withdrawn_at is null), 0)), 0))
    into v_kept
    from public.payments p
   where p.booking_id = new.booking_id
     and p.id <> new.id
     and p.status in ('paid', 'partially_refunded', 'fully_refunded');

  if coalesce(v_gross, 0) > 0 then
    v_through := least(v_kept + new.amount_fils, v_gross);
    new.taxable_fils := greatest(0, v_through - least(v_kept, v_gross));
    new.tax_fils := least(new.amount_fils, greatest(0,
        round(v_tax::numeric * v_through / v_gross)::integer
      - round(v_tax::numeric * least(v_kept, v_gross) / v_gross)::integer));
  else
    new.taxable_fils := 0;
    new.tax_fils := 0;
  end if;
  return new;
end
$$;

comment on function internal.assign_payment_tax() is
  '[OUR CHOICE] Freezes a payment''s VAT and VAT-bearing part the first time it takes money. It apportions against the money the booking already KEEPS — earlier payments less their refunds that were not withdrawn — rather than against their gross, so a new payment after a full refund carries the booking''s VAT again instead of none.

OVERSTAY, SINCE 20260914090000. [OUR CHOICE — project owner''s direction, 14 September 2026] A payment that is not an online checkout apportions against the booking total plus its stored overstay charge (bookings.overrun_fils, which record_overrun keeps outside the total), and against the booking VAT plus the VAT inside that charge from internal.inclusive_vat_fils. Before this, an overstay payment found the booking already fully paid and froze VAT 0. An online checkout payment keeps its checkout snapshot, which cannot carry an overstay. Payments frozen before this migration were not recomputed: their VAT is part of the refund and invoice history built on it, so rewriting it would change figures already reported.';
