alter table public.promo_codes
  add column batch_id   uuid,
  add column batch_name text;

alter table public.promo_codes
  add constraint promo_codes_batch_name_shaped
    check (
      batch_name is null
      or (
        batch_id is not null
        and batch_name = btrim(batch_name)
        and char_length(batch_name) between 1 and 80
      )
    );

create index promo_codes_batch_idx
  on public.promo_codes (batch_id)
  where batch_id is not null;

comment on column public.promo_codes.batch_id is
  '[CLIENT coupon request 2026-09-12] The generation run this coupon was created in. Every coupon created by one call to public.generate_checkout_coupons shares one value; a coupon created on its own carries null. Grouping only: it never affects whether a code is accepted or what it discounts, so it is not part of Voucher in src/lib/domain/vouchers and public.save_checkout_coupon never changes it.';

comment on column public.promo_codes.batch_name is
  '[CLIENT coupon request 2026-09-12] The label the manager gave the generation run, such as a brand or campaign. Optional, trimmed, 1 to 80 characters, matching COUPON_GENERATION.batchNameMax in src/lib/config/coupons.ts, and only present on a coupon that belongs to a batch.';

comment on constraint promo_codes_batch_name_shaped on public.promo_codes is
  '[CLIENT coupon request 2026-09-12] A batch name labels a batch, so it cannot exist without batch_id. It is stored trimmed so two runs named alike do not differ by a stray space.';


alter table public.promo_code_redemptions
  add column code_snapshot text;

update public.promo_code_redemptions r
   set code_snapshot = p.code
  from public.promo_codes p
 where p.id = r.promo_code_id
   and r.code_snapshot is null;

alter table public.promo_code_redemptions
  alter column code_snapshot set not null;

alter table public.promo_code_redemptions
  add constraint promo_code_redemptions_code_snapshot_shaped
    check (code_snapshot = upper(code_snapshot) and char_length(code_snapshot) between 3 and 40);

comment on column public.promo_code_redemptions.code_snapshot is
  '[CLIENT coupon request 2026-09-12] The code the guest used, copied when the redemption is recorded. The manager may now rename any coupon, including one already used, so promo_code_id says which coupon was spent and this column keeps the code as it read at the time. Rows written before this column existed were backfilled from the code they carried then. Filled by internal.snapshot_redeemed_coupon_code when the writer leaves it null, which every existing redemption writer does.';

comment on constraint promo_code_redemptions_code_snapshot_shaped on public.promo_code_redemptions is
  '[CLIENT coupon request 2026-09-12] The snapshot has the shape public.promo_codes enforces on a code: upper case, 3 to 40 characters. The same rule as public.booking_addons.voucher_code, the other literal copy of a redeemed code.';


create function internal.snapshot_redeemed_coupon_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.code_snapshot is null then
    new.code_snapshot := (
      select p.code
        from public.promo_codes p
       where p.id = new.promo_code_id
    );
  end if;
  return new;
end
$$;

revoke all on function internal.snapshot_redeemed_coupon_code() from public, anon, authenticated;

comment on function internal.snapshot_redeemed_coupon_code() is
  '[CLIENT coupon request 2026-09-12] Copies the coupon''s code onto a redemption when the writer does not supply one. The redemption writers in public.create_reception_booking_selected and public.settle_payment_event insert only the coupon, booking and customer, and they keep working unchanged because of this trigger.';

create trigger promo_redemption_snapshot_code
  before insert on public.promo_code_redemptions
  for each row execute function internal.snapshot_redeemed_coupon_code();

comment on trigger promo_redemption_snapshot_code on public.promo_code_redemptions is
  '[CLIENT coupon request 2026-09-12] Triggers on one table and event fire in name order, so this runs after promo_redemption_reservation. That trigger locks the coupon row, which means the code is read under that lock and a concurrent rename cannot change it while the redemption is being counted.';


create or replace function public.save_checkout_coupon(
  p_input               jsonb,
  p_expected_updated_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.promo_codes%rowtype;
  result   uuid;
  targets  uuid[];
begin
  perform internal.require_management();

  if nullif(p_input ->> 'id', '') is not null then
    select * into existing
      from public.promo_codes
     where id = (p_input ->> 'id')::uuid
       for update;

    if existing.id is null or existing.updated_at is distinct from p_expected_updated_at then
      raise exception 'This coupon changed in another window. Reload before editing it.'
        using errcode = 'WP067';
    end if;

    if (p_input ->> 'maxUses')::integer < existing.used_count + (
         select count(*)
           from internal.checkout_attempts a
          where a.promo_id = existing.id
            and a.result is null
            and a.reservation_expires_at > now()
       ) then
      raise exception 'The usage limit cannot be lower than the uses already redeemed or held by checkouts.'
        using errcode = 'WP067';
    end if;
  end if;

  select array_agg(value::uuid) into targets
    from jsonb_array_elements_text(p_input -> 'addonIds');

  select c.promo_code_id into result
    from public.set_promo_code(
      (p_input ->> 'id')::uuid,
      p_input ->> 'code',
      (p_input ->> 'kind')::public.promo_kind,
      (p_input ->> 'amountFils')::integer,
      (p_input ->> 'percent')::numeric,
      targets,
      (p_input ->> 'validFrom')::date,
      (p_input ->> 'validTo')::date,
      (p_input ->> 'maxUses')::integer,
      (p_input ->> 'perCustomerLimit')::integer,
      (p_input ->> 'isCombinable')::boolean,
      (p_input ->> 'isActive')::boolean,
      p_input ->> 'reason'
    ) c;

  return result;
end
$$;

revoke all on function public.save_checkout_coupon(jsonb, timestamptz) from public, anon;
grant execute on function public.save_checkout_coupon(jsonb, timestamptz) to authenticated, service_role;

comment on function public.save_checkout_coupon(jsonb, timestamptz) is
  '[CLIENT pricing specification §8: voucher codes and their Management controls; CLIENT coupon request 2026-09-12] Audited Management coupon controls with inclusive Dubai dates and optimistic concurrency. The manager can edit any coupon, including one already used: its code, discount type, discount and expiry can all change. Each earlier redemption keeps the code the guest used in public.promo_code_redemptions.code_snapshot. The usage limit still cannot fall below the uses already redeemed or held by live checkouts. Batch membership is never changed here.';


create function public.generate_checkout_coupons(
  p_template   jsonb,
  p_codes      text[],
  p_batch_name text default null,
  p_reason     text default null
)
returns table (
  promo_code_id uuid,
  code          text,
  batch_id      uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_batch_max      constant integer := 500;
  v_batch_name_max constant integer := 80;
  v_codes          text[];
  v_duplicates     text;
  v_conflicts      text;
  v_batch_id       uuid := gen_random_uuid();
  v_batch_name     text := nullif(btrim(coalesce(p_batch_name, '')), '');
  v_reason         text := coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Coupons generated from the console');
  v_targets        uuid[];
  v_created        uuid[] := array[]::uuid[];
  v_code           text;
  v_id             uuid;
begin
  perform internal.require_management();

  if p_codes is null or cardinality(p_codes) = 0 then
    raise exception 'Add at least one coupon code to generate.'
      using errcode = 'WP080';
  end if;

  if cardinality(p_codes) > v_batch_max then
    raise exception 'Generate no more than % coupons at a time.', v_batch_max
      using errcode = 'WP080';
  end if;

  if v_batch_name is not null and char_length(v_batch_name) > v_batch_name_max then
    raise exception 'Keep the batch name within % characters.', v_batch_name_max
      using errcode = 'WP080';
  end if;

  select array_agg(upper(btrim(t.raw)) order by t.ordinal)
    into v_codes
    from unnest(p_codes) with ordinality as t(raw, ordinal);

  select string_agg(d.normalised, ',' order by d.normalised)
    into v_duplicates
    from (
      select c.normalised
        from unnest(v_codes) as c(normalised)
       where c.normalised is not null
       group by c.normalised
      having count(*) > 1
    ) d;

  if v_duplicates is not null then
    raise exception 'Each code can appear only once. Remove the repeated codes and generate again.'
      using errcode = 'WP080', detail = v_duplicates;
  end if;

  select string_agg(p.code, ',' order by p.code)
    into v_conflicts
    from public.promo_codes p
   where p.code = any (v_codes);

  if v_conflicts is not null then
    raise exception 'Some of these codes already exist. Change or remove them and generate again.'
      using errcode = 'WP081', detail = v_conflicts;
  end if;

  select array_agg(a.value::uuid)
    into v_targets
    from jsonb_array_elements_text(
      case when jsonb_typeof(p_template -> 'addonIds') = 'array' then p_template -> 'addonIds' end
    ) a;

  foreach v_code in array v_codes loop
    select c.promo_code_id into v_id
      from public.set_promo_code(
        null,
        v_code,
        (p_template ->> 'kind')::public.promo_kind,
        (p_template ->> 'amountFils')::integer,
        (p_template ->> 'percent')::numeric,
        v_targets,
        (p_template ->> 'validFrom')::date,
        (p_template ->> 'validTo')::date,
        (p_template ->> 'maxUses')::integer,
        (p_template ->> 'perCustomerLimit')::integer,
        (p_template ->> 'isCombinable')::boolean,
        (p_template ->> 'isActive')::boolean,
        v_reason
      ) c;

    v_created := v_created || v_id;
  end loop;

  update public.promo_codes p
     set batch_id   = v_batch_id,
         batch_name = v_batch_name
   where p.id = any (v_created);

  perform internal.write_audit(
    'generate_checkout_coupons',
    'public.promo_codes',
    v_batch_id::text,
    null,
    jsonb_build_object(
      'batch_id',   v_batch_id,
      'batch_name', v_batch_name,
      'count',      cardinality(v_created),
      'coupon_ids', to_jsonb(v_created),
      'codes',      to_jsonb(v_codes),
      'template',   p_template
    ),
    v_reason
  );

  return query
    select p.id, p.code, p.batch_id
      from unnest(v_created) with ordinality as n(created_id, ordinal)
      join public.promo_codes p on p.id = n.created_id
     order by n.ordinal;
end
$$;

revoke all on function public.generate_checkout_coupons(jsonb, text[], text, text) from public, anon;
grant execute on function public.generate_checkout_coupons(jsonb, text[], text, text) to authenticated, service_role;

comment on function public.generate_checkout_coupons(jsonb, text[], text, text) is
  '[CLIENT coupon request 2026-09-12] Creates coupons in bulk. The manager chooses how many, and whether the codes are random or typed in. The random codes are built in TypeScript (src/lib/domain/vouchers/coupon-codes.ts), so this function receives the final list and creates all of it or none of it. Management only. Every code is upper-cased and trimmed, then refused with WP080 if the list is empty, has more than 500 entries (COUPON_GENERATION.batchMax) or repeats a code; the repeated codes are in DETAIL. A code that already exists is refused with WP081, and the conflicting codes are in DETAIL so the caller can regenerate only those. Each coupon is created through public.set_promo_code with the shared terms in p_template (the same camelCase keys public.save_checkout_coupon reads), so validation and the per-coupon audit entry are identical to creating one coupon by hand. One batch-level audit entry records the batch id, name, template and codes. Returns one row per coupon, in the order the codes were given, with the batch id they share.';
