create or replace function public.set_price_tier(
  p_id                    uuid,
  p_code                  text,
  p_guest_kind            public.guest_price_kind,
  p_from_hour             integer,
  p_to_hour               integer,
  p_regular_fils_per_hour integer,
  p_offer_fils_per_hour   integer,
  p_offer_percent         numeric,
  p_weekdays              integer[],
  p_season_from           date,
  p_season_to             date,
  p_start_from_minutes    integer,
  p_start_to_minutes      integer,
  p_priority              integer,
  p_is_active             boolean,
  p_reason                text
)
returns table (
  price_rule_id         uuid,
  code                  text,
  guest_kind            public.guest_price_kind,
  from_hour             integer,
  to_hour               integer,
  regular_fils_per_hour integer,
  offer_fils_per_hour   integer,
  offer_percent         numeric,
  priority              integer,
  is_active             boolean,
  was_created           boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reason   text    := nullif(btrim(coalesce(p_reason, '')), '');
  v_code     text    := nullif(btrim(coalesce(p_code, '')), '');
  v_priority integer := coalesce(p_priority, 0);
  v_active   boolean := coalesce(p_is_active, true);
  v_id       uuid;
  v_created  boolean := false;
  v_old      jsonb;
  v_new      jsonb;
begin
  perform internal.require_management();

  if v_reason is null then
    raise exception 'set_price_tier: a reason is required — §7 requires every pricing control to be recorded in the audit log [§3, INV-13]'
      using errcode = '22023';
  end if;

  if p_guest_kind is null then
    raise exception 'set_price_tier: p_guest_kind is required — a tier belongs to the adult rate card or the child one [CLIENT §2]'
      using errcode = '22004';
  end if;

  if p_from_hour is null or p_from_hour < 1 then
    raise exception 'set_price_tier: p_from_hour counts from one, got %',
      coalesce(p_from_hour::text, 'null')
      using errcode = '22023';
  end if;

  if p_to_hour is not null and p_to_hour < p_from_hour then
    raise exception 'set_price_tier: p_to_hour % is before p_from_hour %',
      p_to_hour, p_from_hour
      using errcode = '22023';
  end if;

  if p_regular_fils_per_hour is null or p_regular_fils_per_hour < 0 then
    raise exception 'set_price_tier: p_regular_fils_per_hour is required, in integer fils [R-16], got %',
      coalesce(p_regular_fils_per_hour::text, 'null')
      using errcode = '22023';
  end if;

  if num_nonnulls(p_offer_fils_per_hour, p_offer_percent) <> 1 then
    raise exception 'set_price_tier: exactly one of p_offer_fils_per_hour and p_offer_percent carries a value and % were supplied [CLIENT §2, price_rules_offer_is_exactly_one]',
      num_nonnulls(p_offer_fils_per_hour, p_offer_percent)
      using errcode = 'WP043';
  end if;

  if p_offer_fils_per_hour is not null and p_offer_fils_per_hour < 0 then
    raise exception 'set_price_tier: p_offer_fils_per_hour must be zero or more, got %',
      p_offer_fils_per_hour
      using errcode = '22023';
  end if;

  if p_offer_percent is not null and (p_offer_percent < 0 or p_offer_percent > 100) then
    raise exception 'set_price_tier: p_offer_percent must be between 0 and 100, got %',
      p_offer_percent
      using errcode = '22023';
  end if;

  if p_season_from is not null and p_season_to is not null and p_season_to < p_season_from then
    raise exception 'set_price_tier: the season ends % before it starts %',
      p_season_to, p_season_from
      using errcode = '22023';
  end if;

  if num_nonnulls(p_start_from_minutes, p_start_to_minutes) = 1 then
    raise exception 'set_price_tier: a start window needs both bounds or neither [CLIENT §2]'
      using errcode = '22023';
  end if;

  if p_id is not null then
    select to_jsonb(r) into v_old
      from public.price_rules r
     where r.id = p_id
     for update;

    if v_old is null then
      raise exception 'set_price_tier: no price tier with id %', p_id
        using errcode = 'P0002';
    end if;

    update public.price_rules r
       set code                  = v_code,
           guest_kind            = p_guest_kind,
           from_hour             = p_from_hour,
           to_hour               = p_to_hour,
           regular_fils_per_hour = p_regular_fils_per_hour,
           offer_fils_per_hour   = p_offer_fils_per_hour,
           offer_percent         = p_offer_percent,
           weekdays              = p_weekdays,
           season_from           = p_season_from,
           season_to             = p_season_to,
           start_from_minutes    = p_start_from_minutes,
           start_to_minutes      = p_start_to_minutes,
           priority              = v_priority,
           is_active             = v_active
     where r.id = p_id;

    v_id := p_id;
  else
    if v_code is not null
       and exists (select 1 from public.price_rules r where r.code = v_code) then
      raise exception 'set_price_tier: a price tier already carries the code % — send its id to change it [R-11]',
        v_code
        using errcode = '23505';
    end if;

    insert into public.price_rules (
      code, guest_kind, from_hour, to_hour,
      regular_fils_per_hour, offer_fils_per_hour, offer_percent,
      weekdays, season_from, season_to,
      start_from_minutes, start_to_minutes, priority, is_active
    )
    values (
      v_code, p_guest_kind, p_from_hour, p_to_hour,
      p_regular_fils_per_hour, p_offer_fils_per_hour, p_offer_percent,
      p_weekdays, p_season_from, p_season_to,
      p_start_from_minutes, p_start_to_minutes, v_priority, v_active
    )
    returning id into v_id;

    v_created := true;
  end if;

  select to_jsonb(r) into v_new
    from public.price_rules r
   where r.id = v_id;

  perform internal.write_audit(
    'set_price_tier',
    'public.price_rules',
    v_id::text,
    v_old,
    v_new,
    v_reason
  );

  select r.id, r.code, r.guest_kind, r.from_hour, r.to_hour,
         r.regular_fils_per_hour, r.offer_fils_per_hour, r.offer_percent,
         r.priority, r.is_active
    into price_rule_id, code, guest_kind, from_hour, to_hour,
         regular_fils_per_hour, offer_fils_per_hour, offer_percent,
         priority, is_active
    from public.price_rules r
   where r.id = v_id;

  was_created := v_created;
  return next;
end
$$;


create or replace function public.set_addon(
  p_id                 uuid,
  p_name               text,
  p_description        text,
  p_image_path         text,
  p_kind               public.addon_kind,
  p_regular_price_fils integer,
  p_offer_price_fils   integer,
  p_saving_label       text,
  p_default_quantity   integer,
  p_min_quantity       integer,
  p_max_quantity       integer,
  p_is_locked          boolean,
  p_inventory          integer,
  p_available_from     date,
  p_available_to       date,
  p_reception_note     text,
  p_is_taxable         boolean,
  p_is_active          boolean,
  p_sort_order         integer,
  p_reason             text
)
returns table (
  addon_id           uuid,
  name               text,
  kind               public.addon_kind,
  regular_price_fils integer,
  offer_price_fils   integer,
  saving_label       text,
  default_quantity   integer,
  min_quantity       integer,
  max_quantity       integer,
  is_locked          boolean,
  inventory          integer,
  is_active          boolean,
  sort_order         integer,
  was_created        boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reason   text    := nullif(btrim(coalesce(p_reason, '')), '');
  v_name     text    := nullif(btrim(coalesce(p_name, '')), '');
  v_label    text    := nullif(btrim(coalesce(p_saving_label, '')), '');
  v_note     text    := nullif(btrim(coalesce(p_reception_note, '')), '');
  v_kind     public.addon_kind := coalesce(p_kind, 'per_booking'::public.addon_kind);
  v_default  integer := coalesce(p_default_quantity, 1);
  v_min      integer := coalesce(p_min_quantity, 1);
  v_max      integer := coalesce(p_max_quantity, 1);
  v_locked   boolean := coalesce(p_is_locked, false);
  v_taxable  boolean := coalesce(p_is_taxable, true);
  v_active   boolean := coalesce(p_is_active, true);
  v_sort     integer := coalesce(p_sort_order, 100);
  v_id       uuid;
  v_created  boolean := false;
  v_old      jsonb;
  v_new      jsonb;
begin
  perform internal.require_management();

  if v_reason is null then
    raise exception 'set_addon: a reason is required — §7 requires every add-on control to be recorded in the audit log [§3, INV-13]'
      using errcode = '22023';
  end if;

  if v_name is null or length(v_name) > 120 then
    raise exception 'set_addon: p_name is required and is at most 120 characters [§8]'
      using errcode = '22023';
  end if;

  if p_regular_price_fils is null or p_regular_price_fils < 0 then
    raise exception 'set_addon: p_regular_price_fils is required, in integer fils [R-16], got %',
      coalesce(p_regular_price_fils::text, 'null')
      using errcode = '22023';
  end if;

  if p_offer_price_fils is null or p_offer_price_fils < 0 then
    raise exception 'set_addon: p_offer_price_fils is required, in integer fils, and AED 0 is the §8 automatic inclusion trigger rather than a missing value, got %',
      coalesce(p_offer_price_fils::text, 'null')
      using errcode = '22023';
  end if;

  if v_min < 1 or v_default < 1 or v_max < 1 then
    raise exception 'set_addon: every quantity bound is one or more, got minimum %, default % and maximum % [§8]',
      v_min, v_default, v_max
      using errcode = 'WP044';
  end if;

  if not (v_min <= v_default and v_default <= v_max) then
    raise exception 'set_addon: the quantity bounds must read minimum % <= default % <= maximum % [§8, addons_quantities_ordered]',
      v_min, v_default, v_max
      using errcode = 'WP044';
  end if;

  if p_regular_price_fils < p_offer_price_fils then
    raise exception 'set_addon: the comparison price of % fils is below the offer price of % fils, which would show a saving that runs backwards [§8, addons_regular_price_not_below_offer]',
      p_regular_price_fils, p_offer_price_fils
      using errcode = 'WP045';
  end if;

  if p_inventory is not null and p_inventory < 0 then
    raise exception 'set_addon: p_inventory is null for unlimited or zero and above for a stock level, got %',
      p_inventory
      using errcode = '22023';
  end if;

  if p_available_from is not null and p_available_to is not null
     and p_available_to < p_available_from then
    raise exception 'set_addon: the sales window ends % before it starts %',
      p_available_to, p_available_from
      using errcode = '22023';
  end if;

  if p_id is not null then
    select to_jsonb(a) into v_old
      from public.addons a
     where a.id = p_id
     for update;

    if v_old is null then
      raise exception 'set_addon: no add-on with id %', p_id
        using errcode = 'P0002';
    end if;

    update public.addons a
       set name               = v_name,
           description        = nullif(btrim(coalesce(p_description, '')), ''),
           image_path         = nullif(btrim(coalesce(p_image_path, '')), ''),
           kind               = v_kind,
           regular_price_fils = p_regular_price_fils,
           offer_price_fils   = p_offer_price_fils,
           saving_label       = v_label,
           default_quantity   = v_default,
           min_quantity       = v_min,
           max_quantity       = v_max,
           is_locked          = v_locked,
           inventory          = p_inventory,
           available_from     = p_available_from,
           available_to       = p_available_to,
           reception_note     = v_note,
           is_taxable         = v_taxable,
           is_active          = v_active,
           sort_order         = v_sort
     where a.id = p_id;

    v_id := p_id;
  else
    insert into public.addons (
      name, description, image_path, kind,
      regular_price_fils, offer_price_fils, saving_label,
      default_quantity, min_quantity, max_quantity, is_locked,
      inventory, available_from, available_to, reception_note,
      is_taxable, is_active, sort_order
    )
    values (
      v_name,
      nullif(btrim(coalesce(p_description, '')), ''),
      nullif(btrim(coalesce(p_image_path, '')), ''),
      v_kind,
      p_regular_price_fils, p_offer_price_fils, v_label,
      v_default, v_min, v_max, v_locked,
      p_inventory, p_available_from, p_available_to, v_note,
      v_taxable, v_active, v_sort
    )
    returning id into v_id;

    v_created := true;
  end if;

  select to_jsonb(a) into v_new
    from public.addons a
   where a.id = v_id;

  perform internal.write_audit(
    'set_addon',
    'public.addons',
    v_id::text,
    v_old,
    v_new,
    v_reason
  );

  select a.id, a.name, a.kind, a.regular_price_fils, a.offer_price_fils,
         a.saving_label, a.default_quantity, a.min_quantity, a.max_quantity,
         a.is_locked, a.inventory, a.is_active, a.sort_order
    into addon_id, name, kind, regular_price_fils, offer_price_fils,
         saving_label, default_quantity, min_quantity, max_quantity,
         is_locked, inventory, is_active, sort_order
    from public.addons a
   where a.id = v_id;

  was_created := v_created;
  return next;
end
$$;


create or replace function public.set_promo_code(
  p_id                 uuid,
  p_code               text,
  p_kind               public.promo_kind,
  p_amount_fils        integer,
  p_percent            numeric,
  p_addon_ids          uuid[],
  p_valid_from         date,
  p_valid_to           date,
  p_max_uses           integer,
  p_per_customer_limit integer,
  p_is_combinable      boolean,
  p_is_active          boolean,
  p_reason             text
)
returns table (
  promo_code_id      uuid,
  code               text,
  kind               public.promo_kind,
  amount_fils        integer,
  percent            numeric,
  target_addon_ids   uuid[],
  valid_from         date,
  valid_to           date,
  max_uses           integer,
  used_count         integer,
  per_customer_limit integer,
  is_combinable      boolean,
  is_active          boolean,
  was_created        boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reason     text    := nullif(btrim(coalesce(p_reason, '')), '');
  v_code       text    := upper(nullif(btrim(coalesce(p_code, '')), ''));
  v_targets    uuid[]  := coalesce(p_addon_ids, array[]::uuid[]);
  v_combinable boolean := coalesce(p_is_combinable, true);
  v_active     boolean := coalesce(p_is_active, true);
  v_id         uuid;
  v_created    boolean := false;
  v_missing    uuid;
  v_old        jsonb;
  v_new        jsonb;
begin
  perform internal.require_management();

  if v_reason is null then
    raise exception 'set_promo_code: a reason is required — §7 requires every voucher control to be recorded in the audit log [§3, INV-13]'
      using errcode = '22023';
  end if;

  if v_code is null then
    raise exception 'set_promo_code: p_code is required [§8]'
      using errcode = '22004';
  end if;

  if length(v_code) < 3 or length(v_code) > 40 or v_code !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' then
    raise exception 'set_promo_code: % is not a usable code — three to forty upper-case alphanumerics in hyphen groups, so it survives being read aloud [§8]',
      v_code
      using errcode = '22023';
  end if;

  if p_kind is null then
    raise exception 'set_promo_code: p_kind is required and is one of fixed, percent or addon_free [§8]'
      using errcode = '22004';
  end if;

  if not (
    (p_kind = 'fixed'::public.promo_kind      and p_amount_fils is not null and p_percent is null)
    or (p_kind = 'percent'::public.promo_kind    and p_percent is not null and p_amount_fils is null)
    or (p_kind = 'addon_free'::public.promo_kind and p_percent is null and p_amount_fils is null)
  ) then
    raise exception 'set_promo_code: a % code does not agree with the value it carries — fixed needs an amount, percent needs a percentage and addon_free needs neither [§8, promo_codes_kind_matches_value]',
      p_kind
      using errcode = 'WP046';
  end if;

  if p_amount_fils is not null and p_amount_fils < 0 then
    raise exception 'set_promo_code: p_amount_fils must be zero or more, in integer fils [R-16], got %',
      p_amount_fils
      using errcode = '22023';
  end if;

  if p_percent is not null and (p_percent < 0 or p_percent > 100) then
    raise exception 'set_promo_code: p_percent must be between 0 and 100, got %',
      p_percent
      using errcode = '22023';
  end if;

  if p_valid_from is not null and p_valid_to is not null and p_valid_to < p_valid_from then
    raise exception 'set_promo_code: the validity window ends % before it starts %',
      p_valid_to, p_valid_from
      using errcode = '22023';
  end if;

  if p_max_uses is not null and p_max_uses < 1 then
    raise exception 'set_promo_code: p_max_uses is null for unlimited or one and above, got %',
      p_max_uses
      using errcode = '22023';
  end if;

  if p_per_customer_limit is not null and p_per_customer_limit < 1 then
    raise exception 'set_promo_code: p_per_customer_limit is null for unlimited or one and above, got %',
      p_per_customer_limit
      using errcode = '22023';
  end if;

  if p_kind = 'addon_free'::public.promo_kind and cardinality(v_targets) = 0 then
    raise exception 'set_promo_code: an addon_free code names the add-ons it frees, and % names none [§8]',
      v_code
      using errcode = 'WP047';
  end if;

  select t.id into v_missing
    from unnest(v_targets) as t(id)
   where not exists (select 1 from public.addons a where a.id = t.id)
   limit 1;

  if v_missing is not null then
    raise exception 'set_promo_code: % targets add-on %, which does not exist [§8]',
      v_code, v_missing
      using errcode = 'WP047';
  end if;

  if p_id is not null then
    select to_jsonb(p) into v_old
      from public.promo_codes p
     where p.id = p_id
     for update;

    if v_old is null then
      raise exception 'set_promo_code: no voucher code with id %', p_id
        using errcode = 'P0002';
    end if;

    v_old := v_old || jsonb_build_object(
      'target_addon_ids',
      (select coalesce(jsonb_agg(pa.addon_id order by pa.addon_id), '[]'::jsonb)
         from public.promo_code_addons pa
        where pa.promo_code_id = p_id)
    );

    update public.promo_codes p
       set code               = v_code,
           kind               = p_kind,
           amount_fils        = p_amount_fils,
           percent            = p_percent,
           valid_from         = p_valid_from,
           valid_to           = p_valid_to,
           max_uses           = p_max_uses,
           per_customer_limit = p_per_customer_limit,
           is_combinable      = v_combinable,
           is_active          = v_active
     where p.id = p_id;

    v_id := p_id;
  else
    if exists (select 1 from public.promo_codes p where p.code = v_code) then
      raise exception 'set_promo_code: the code % already exists — send its id to change it [R-11]',
        v_code
        using errcode = '23505';
    end if;

    insert into public.promo_codes (
      code, kind, amount_fils, percent,
      valid_from, valid_to, max_uses, per_customer_limit,
      is_combinable, is_active
    )
    values (
      v_code, p_kind, p_amount_fils, p_percent,
      p_valid_from, p_valid_to, p_max_uses, p_per_customer_limit,
      v_combinable, v_active
    )
    returning id into v_id;

    v_created := true;
  end if;

  delete from public.promo_code_addons pa
   where pa.promo_code_id = v_id
     and not (pa.addon_id = any (v_targets));

  insert into public.promo_code_addons (promo_code_id, addon_id)
  select distinct v_id, t.id
    from unnest(v_targets) as t(id)
   where not exists (
     select 1
       from public.promo_code_addons pa
      where pa.promo_code_id = v_id
        and pa.addon_id = t.id
   );

  select to_jsonb(p) || jsonb_build_object(
           'target_addon_ids',
           (select coalesce(jsonb_agg(pa.addon_id order by pa.addon_id), '[]'::jsonb)
              from public.promo_code_addons pa
             where pa.promo_code_id = v_id)
         )
    into v_new
    from public.promo_codes p
   where p.id = v_id;

  perform internal.write_audit(
    'set_promo_code',
    'public.promo_codes',
    v_id::text,
    v_old,
    v_new,
    v_reason
  );

  select p.id, p.code, p.kind, p.amount_fils, p.percent,
         (select coalesce(array_agg(pa.addon_id order by pa.addon_id), array[]::uuid[])
            from public.promo_code_addons pa
           where pa.promo_code_id = p.id),
         p.valid_from, p.valid_to, p.max_uses, p.used_count,
         p.per_customer_limit, p.is_combinable, p.is_active
    into promo_code_id, code, kind, amount_fils, percent,
         target_addon_ids,
         valid_from, valid_to, max_uses, used_count,
         per_customer_limit, is_combinable, is_active
    from public.promo_codes p
   where p.id = v_id;

  was_created := v_created;
  return next;
end
$$;


create or replace function public.create_reception_booking(
  p_source           public.booking_source,
  p_salutation       public.salutation,
  p_first_name       text,
  p_last_name        text,
  p_email            text,
  p_date_of_birth    date,
  p_phone_e164       text,
  p_phone_country    text,
  p_starts_at        timestamptz,
  p_duration_hours   integer,
  p_buffer_minutes   integer,
  p_adults           integer,
  p_child_ages       integer[],
  p_addons           jsonb,
  p_personal_request text,
  p_internal_note    text,
  p_price            jsonb,
  p_is_complimentary boolean,
  p_acceptance       jsonb,
  p_reason           text
)
returns table (booking_id uuid, reference text, suite_id uuid, suite_number integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_addons         jsonb := coalesce(p_addons, '[]'::jsonb);
  v_acceptance     jsonb := coalesce(p_acceptance, '[]'::jsonb);
  v_price          jsonb := coalesce(p_price, '{}'::jsonb);
  v_child_ages     integer[] := coalesce(p_child_ages, array[]::integer[]);
  v_children       integer;
  v_total_guests   integer;
  v_guests_min     integer;
  v_guests_max     integer;
  v_child_min      integer;
  v_child_max      integer;
  v_booker_min     integer;
  v_booker_age     integer;
  v_buffer         integer;
  v_default_buffer integer;
  v_identity       text;
  v_customer_id    uuid;
  v_customer_new   boolean := false;
  v_customer_dob   date;
  v_dob_filled     boolean := false;
  v_is_blocked     boolean;
  v_experience     tstzrange;
  v_blocked        tstzrange;
  v_reference      text;
  v_booking_id     uuid;
  v_occupancy_id   uuid;
  v_suite_id       uuid;
  v_suite_number   integer;
  v_lines          integer;
  v_matched        integer;
  v_complimentary  boolean;
  v_voucher_code   text;
  v_promo_id       uuid;
  v_promo_kind     public.promo_kind;
  v_promo_active   boolean;
  v_promo_from     date;
  v_promo_to       date;
  v_promo_max      integer;
  v_promo_used     integer;
  v_promo_limit    integer;
  v_customer_uses  integer;
  v_eligible       integer;
  v_bad_addon      text;
  v_bad_quantity   integer;
  v_bad_min        integer;
  v_bad_max        integer;
begin
  if not internal.is_staff() then
    raise exception 'create_reception_booking: an active staff session is required — §9.2 creation types are desk actions with a named actor [INV-13]'
      using errcode = '42501';
  end if;

  if p_source is null or p_source = 'online'::public.booking_source then
    raise exception 'create_reception_booking: p_source must be walk_in, telephone, manual or complimentary — online is the §6.1 guest flow and does not pass through here, got %',
      coalesce(p_source::text, 'null')
      using errcode = '22023';
  end if;

  if p_starts_at is null or not isfinite(p_starts_at) then
    raise exception 'create_reception_booking: p_starts_at must be a finite instant, got %',
      coalesce(p_starts_at::text, 'null')
      using errcode = '22004';
  end if;

  if p_duration_hours is null or p_duration_hours <= 0 or p_duration_hours > 24 * 366 then
    raise exception 'create_reception_booking: p_duration_hours must be between 1 and one year, got %',
      coalesce(p_duration_hours::text, 'null')
      using errcode = 'WP005';
  end if;

  v_default_buffer := internal.setting_integer('cleaning.buffer_minutes');
  v_buffer         := coalesce(p_buffer_minutes, v_default_buffer);

  if v_buffer is null then
    raise exception 'create_reception_booking: no cleaning buffer was supplied and cleaning.buffer_minutes carries no value, so there is nothing to store on the row [§7.1]'
      using errcode = 'WP006';
  end if;

  if v_buffer < 0 or v_buffer > 24 * 60 then
    raise exception 'create_reception_booking: the cleaning buffer must be between 0 and one day, got %',
      v_buffer
      using errcode = 'WP006';
  end if;

  if v_default_buffer is not null
     and v_buffer <> v_default_buffer
     and not internal.has_permission('override_suite_allocation'::public.named_permission) then
    raise exception 'create_reception_booking: a % minute cleaning buffer differs from the configured cleaning.buffer_minutes of % and needs perm:override_suite_allocation [§7.1, §7.2]',
      v_buffer, v_default_buffer
      using errcode = 'WP035';
  end if;

  if p_date_of_birth is null then
    raise exception 'create_reception_booking: the booker date of birth is required for a booking [§10.5, §6.2]'
      using errcode = 'WP011';
  end if;

  v_children     := coalesce(array_length(v_child_ages, 1), 0);
  v_total_guests := coalesce(p_adults, 0) + v_children;

  if p_adults is null or p_adults < 0 then
    raise exception 'create_reception_booking: p_adults must be zero or more, got %',
      coalesce(p_adults::text, 'null')
      using errcode = 'WP011';
  end if;

  if v_total_guests < 1 then
    raise exception 'create_reception_booking: a booking must carry at least one guest [§6.2]'
      using errcode = 'WP011';
  end if;

  if exists (select 1 from unnest(v_child_ages) as c where c is null) then
    raise exception 'create_reception_booking: every child needs an age [§6.2]'
      using errcode = 'WP011';
  end if;

  v_guests_min := internal.setting_integer('booking.guests_min');
  v_guests_max := internal.setting_integer('booking.guests_max');
  v_child_min  := internal.setting_integer('booking.child_min_age');
  v_child_max  := internal.setting_integer('booking.child_max_age');
  v_booker_min := internal.setting_integer('booking.booker_min_age');

  if v_guests_min is not null and v_total_guests < v_guests_min then
    raise exception 'create_reception_booking: % guests is below booking.guests_min of % [§6.1]',
      v_total_guests, v_guests_min
      using errcode = 'WP011';
  end if;

  if v_guests_max is not null and v_total_guests > v_guests_max then
    raise exception 'create_reception_booking: % guests is above booking.guests_max of % [§6.1]',
      v_total_guests, v_guests_max
      using errcode = 'WP011';
  end if;

  if v_child_min is not null
     and exists (select 1 from unnest(v_child_ages) as c where c < v_child_min) then
    raise exception 'create_reception_booking: a child is younger than booking.child_min_age of % [§6.2]',
      v_child_min
      using errcode = 'WP011';
  end if;

  if v_child_max is not null
     and exists (select 1 from unnest(v_child_ages) as c where c > v_child_max) then
    raise exception 'create_reception_booking: a child is older than booking.child_max_age of % [§6.2]',
      v_child_max
      using errcode = 'WP011';
  end if;

  v_booker_age := extract(year from age(current_date, p_date_of_birth))::integer;

  if v_booker_min is not null and v_booker_age < v_booker_min then
    raise exception 'create_reception_booking: the booker is % and booking.booker_min_age is % [§6.2]',
      v_booker_age, v_booker_min
      using errcode = 'WP011';
  end if;

  if jsonb_typeof(v_addons) <> 'array' then
    raise exception 'create_reception_booking: p_addons must be a JSON array of {"addon_id","quantity"} objects, got %',
      jsonb_typeof(v_addons)
      using errcode = '22023';
  end if;

  if jsonb_typeof(v_acceptance) <> 'array' then
    raise exception 'create_reception_booking: p_acceptance must be a JSON array of {"document_slug","document_version","checkbox_text"} objects, got %',
      jsonb_typeof(v_acceptance)
      using errcode = '22023';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(v_acceptance) d
     where nullif(btrim(coalesce(d ->> 'document_slug', '')), '') is null
        or nullif(btrim(coalesce(d ->> 'document_version', '')), '') is null
        or nullif(btrim(coalesce(d ->> 'checkbox_text', '')), '') is null
  ) then
    raise exception 'create_reception_booking: every acceptance record needs a document_slug, a document_version and the literal checkbox_text [§6.3]'
      using errcode = '22023';
  end if;

  select count(*)::integer,
         count(distinct (l ->> 'addon_id'))::integer
    into v_lines, v_matched
    from jsonb_array_elements(v_addons) l;

  if v_lines <> v_matched then
    raise exception 'create_reception_booking: p_addons names the same add-on twice — send one line per add-on with its quantity [§10.4]'
      using errcode = '22023';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(v_addons) l
     where coalesce((l ->> 'quantity')::integer, 1) <= 0
  ) then
    raise exception 'create_reception_booking: an add-on quantity must be one or more [§10.4]'
      using errcode = '22023';
  end if;

  select count(*)::integer
    into v_matched
    from jsonb_array_elements(v_addons) l
    join public.addons a on a.id = (l ->> 'addon_id')::uuid;

  if v_lines <> v_matched then
    raise exception 'create_reception_booking: p_addons names an add-on that does not exist [§10.4]'
      using errcode = '22023';
  end if;

  select a.name
    into v_bad_addon
    from jsonb_array_elements(v_addons) l
    join public.addons a on a.id = (l ->> 'addon_id')::uuid
   where not a.is_active
      or (a.available_from is not null and a.available_from > current_date)
      or (a.available_to   is not null and a.available_to   < current_date)
   limit 1;

  if v_bad_addon is not null then
    raise exception 'create_reception_booking: the add-on "%" is switched off or outside its sales dates and cannot be sold today [§8]',
      v_bad_addon
      using errcode = 'WP038';
  end if;

  select a.name, coalesce((l ->> 'quantity')::integer, 1), a.min_quantity, a.max_quantity
    into v_bad_addon, v_bad_quantity, v_bad_min, v_bad_max
    from jsonb_array_elements(v_addons) l
    join public.addons a on a.id = (l ->> 'addon_id')::uuid
   where coalesce((l ->> 'quantity')::integer, 1) < a.min_quantity
      or coalesce((l ->> 'quantity')::integer, 1) > a.max_quantity
   limit 1;

  if v_bad_addon is not null then
    raise exception 'create_reception_booking: % of the add-on "%" is outside its configured range of % to % [§8]',
      v_bad_quantity, v_bad_addon, v_bad_min, v_bad_max
      using errcode = 'WP037';
  end if;

  v_voucher_code := upper(nullif(btrim(coalesce(v_price ->> 'voucher_code', '')), ''));

  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);

  v_experience := tstzrange(
    p_starts_at,
    p_starts_at + (p_duration_hours * interval '1 hour'),
    '[)'
  );

  v_blocked := tstzrange(
    lower(v_experience),
    upper(v_experience) + (v_buffer * interval '1 minute'),
    '[)'
  );

  v_identity := internal.normalise_email(coalesce(p_email, ''));

  select c.id, c.is_blocked, c.date_of_birth
    into v_customer_id, v_is_blocked, v_customer_dob
    from public.customers c
   where c.identity_key = v_identity
   for update;

  if v_customer_id is null then
    begin
      insert into public.customers (
        salutation, first_name, last_name, email, date_of_birth,
        phone_e164, phone_country, last_interaction_at
      )
      values (
        p_salutation,
        btrim(p_first_name),
        btrim(p_last_name),
        lower(btrim(coalesce(p_email, ''))),
        p_date_of_birth,
        p_phone_e164,
        p_phone_country,
        clock_timestamp()
      )
      returning id, is_blocked, date_of_birth
        into v_customer_id, v_is_blocked, v_customer_dob;

      v_customer_new := true;
    exception
      when unique_violation then
        select c.id, c.is_blocked, c.date_of_birth
          into v_customer_id, v_is_blocked, v_customer_dob
          from public.customers c
         where c.identity_key = v_identity
         for update;
    end;
  end if;

  if v_is_blocked then
    raise exception 'create_reception_booking: this customer is blocked [§10.5]'
      using errcode = 'WP012';
  end if;

  if not v_customer_new then
    v_dob_filled := v_customer_dob is null;

    update public.customers c
       set last_interaction_at = clock_timestamp(),
           date_of_birth       = coalesce(c.date_of_birth, p_date_of_birth)
     where c.id = v_customer_id;
  end if;

  if v_customer_new or v_dob_filled then
    perform internal.write_audit(
      case when v_customer_new then 'create_customer' else 'complete_customer' end,
      'public.customers',
      v_customer_id::text,
      case when v_customer_new then null::jsonb
           else jsonb_build_object('date_of_birth', null) end,
      jsonb_build_object(
        'identity_key',  v_identity,
        'first_name',    btrim(p_first_name),
        'last_name',     btrim(p_last_name),
        'date_of_birth', p_date_of_birth,
        'phone_country', p_phone_country
      ),
      coalesce(
        p_reason,
        'Customer record created by a §9.2 Reception booking'
      )
    );
  end if;

  if v_voucher_code is not null then
    select p.id, p.kind, p.is_active, p.valid_from, p.valid_to,
           p.max_uses, p.used_count, p.per_customer_limit
      into v_promo_id, v_promo_kind, v_promo_active, v_promo_from, v_promo_to,
           v_promo_max, v_promo_used, v_promo_limit
      from public.promo_codes p
     where p.code = v_voucher_code
     for update;

    if v_promo_id is null or not v_promo_active then
      raise exception 'create_reception_booking: the voucher code % is not one this venue accepts [§8]',
        v_voucher_code
        using errcode = 'WP039';
    end if;

    if (v_promo_from is not null and current_date < v_promo_from)
       or (v_promo_to is not null and current_date > v_promo_to) then
      raise exception 'create_reception_booking: the voucher code % is outside its validity window of % to % [§8]',
        v_voucher_code,
        coalesce(v_promo_from::text, 'any date'),
        coalesce(v_promo_to::text, 'any date')
        using errcode = 'WP039';
    end if;

    if v_promo_max is not null and v_promo_used >= v_promo_max then
      raise exception 'create_reception_booking: the voucher code % has been used % times and its limit is % [§8]',
        v_voucher_code, v_promo_used, v_promo_max
        using errcode = 'WP040';
    end if;

    if v_promo_limit is not null then
      select count(*)::integer
        into v_customer_uses
        from public.promo_code_redemptions x
       where x.promo_code_id = v_promo_id
         and x.customer_id = v_customer_id;

      if v_customer_uses >= v_promo_limit then
        raise exception 'create_reception_booking: this customer has used the voucher code % % times and the per-customer limit is % [§8]',
          v_voucher_code, v_customer_uses, v_promo_limit
          using errcode = 'WP041';
      end if;
    end if;

    if v_promo_kind = 'addon_free'::public.promo_kind then
      select count(*)::integer
        into v_eligible
        from public.promo_code_addons pa
        join public.addons a on a.id = pa.addon_id
       where pa.promo_code_id = v_promo_id
         and a.is_active
         and (a.available_from is null or a.available_from <= current_date)
         and (a.available_to   is null or a.available_to   >= current_date);

      if v_eligible = 0 then
        raise exception 'create_reception_booking: the voucher code % frees no add-on that is on sale today, so it applies to nothing in this booking [§8]',
          v_voucher_code
          using errcode = 'WP042';
      end if;
    end if;
  end if;

  v_reference := internal.next_booking_reference();

  v_complimentary := coalesce(p_is_complimentary, false)
                     or p_source = 'complimentary'::public.booking_source;

  insert into public.bookings (
    reference,
    customer_id,
    source,
    status,
    experience_period,
    cleaning_buffer_minutes,
    personal_request,
    internal_note,
    subtotal_fils,
    discount_fils,
    addons_fils,
    service_fee_fils,
    tax_fils,
    total_fils,
    is_complimentary,
    created_by
  )
  values (
    v_reference,
    v_customer_id,
    p_source,
    'confirmed'::public.booking_status,
    v_experience,
    v_buffer,
    nullif(btrim(coalesce(p_personal_request, '')), ''),
    nullif(btrim(coalesce(p_internal_note, '')), ''),
    coalesce((v_price ->> 'subtotal_fils')::integer, 0),
    coalesce((v_price ->> 'discount_fils')::integer, 0),
    coalesce((v_price ->> 'addons_fils')::integer, 0),
    coalesce((v_price ->> 'service_fee_fils')::integer, 0),
    coalesce((v_price ->> 'tax_fils')::integer, 0),
    coalesce((v_price ->> 'total_fils')::integer, 0),
    v_complimentary,
    internal.current_staff_id()
  )
  returning id into v_booking_id;

  select a.allocated_occupancy_id, a.allocated_suite_id
    into v_occupancy_id, v_suite_id
    from internal.allocate_suite(
      v_experience,
      v_blocked,
      v_buffer,
      'booking'::public.occupancy_kind,
      null,
      v_booking_id,
      coalesce(p_reason, 'Reception booking ' || v_reference || ' [§9.2]'),
      false,
      null
    ) a;

  if v_occupancy_id is null then
    raise exception 'create_reception_booking: no suite is free from % to % [§7.2, §7.5]',
      lower(v_blocked), upper(v_blocked)
      using errcode = 'WP010';
  end if;

  update public.bookings b
     set suite_id     = v_suite_id,
         occupancy_id = v_occupancy_id
   where b.id = v_booking_id;

  select s.suite_number
    into v_suite_number
    from public.suites s
   where s.id = v_suite_id;

  insert into public.booking_guests (booking_id, kind)
  select v_booking_id, 'adult'::public.guest_kind
    from generate_series(1, p_adults);

  insert into public.booking_guests (booking_id, kind, age)
  select v_booking_id, 'child'::public.guest_kind, c
    from unnest(v_child_ages) as c;

  insert into public.booking_addons (
    booking_id, addon_id, name_snapshot, unit_price_fils, quantity,
    regular_price_fils, is_included, is_locked, voucher_code
  )
  select v_booking_id,
         a.id,
         a.name,
         case when t.addon_id is not null then 0 else a.offer_price_fils end,
         coalesce(r.quantity, a.default_quantity),
         a.regular_price_fils,
         case when t.addon_id is not null then true
              else a.offer_price_fils = 0 end,
         a.is_locked,
         case when t.addon_id is not null and a.offer_price_fils > 0
              then v_voucher_code end
    from public.addons a
    left join (
      select (l ->> 'addon_id')::uuid                as addon_id,
             coalesce((l ->> 'quantity')::integer, 1) as quantity
        from jsonb_array_elements(v_addons) l
    ) r on r.addon_id = a.id
    left join (
      select pa.addon_id
        from public.promo_code_addons pa
        join public.addons ta on ta.id = pa.addon_id
       where v_promo_id is not null
         and v_promo_kind = 'addon_free'::public.promo_kind
         and pa.promo_code_id = v_promo_id
         and ta.is_active
         and (ta.available_from is null or ta.available_from <= current_date)
         and (ta.available_to   is null or ta.available_to   >= current_date)
    ) t on t.addon_id = a.id
   where r.addon_id is not null
      or t.addon_id is not null;

  insert into public.acceptance_records (
    booking_id, source, document_slug, document_version, checkbox_text
  )
  select v_booking_id,
         p_source,
         btrim(d ->> 'document_slug'),
         btrim(d ->> 'document_version'),
         btrim(d ->> 'checkbox_text')
    from jsonb_array_elements(v_acceptance) d;

  if v_promo_id is not null then
    insert into public.promo_code_redemptions (promo_code_id, booking_id, customer_id)
    values (v_promo_id, v_booking_id, v_customer_id);

    update public.promo_codes p
       set used_count = p.used_count + 1
     where p.id = v_promo_id;

    perform internal.write_audit(
      'redeem_promo_code',
      'public.promo_codes',
      v_promo_id::text,
      jsonb_build_object('used_count', v_promo_used),
      jsonb_build_object(
        'used_count',        v_promo_used + 1,
        'code',              v_voucher_code,
        'kind',              v_promo_kind,
        'booking_id',        v_booking_id,
        'booking_reference', v_reference,
        'customer_id',       v_customer_id
      ),
      coalesce(
        p_reason,
        'Voucher ' || v_voucher_code || ' redeemed on booking ' || v_reference || ' [§8]'
      )
    );
  end if;

  perform internal.write_audit(
    'create_reception_booking',
    'public.bookings',
    v_booking_id::text,
    null::jsonb,
    jsonb_build_object(
      'reference',               v_reference,
      'source',                  p_source,
      'status',                  'confirmed',
      'customer_id',             v_customer_id,
      'suite_id',                v_suite_id,
      'occupancy_id',            v_occupancy_id,
      'experience_from',         lower(v_experience),
      'experience_to',           upper(v_experience),
      'blocked_to',              upper(v_blocked),
      'cleaning_buffer_minutes', v_buffer,
      'buffer_is_configured',    v_default_buffer is null or v_buffer = v_default_buffer,
      'adults',                  p_adults,
      'child_ages',              to_jsonb(v_child_ages),
      'addons',                  v_addons,
      'acceptance',              v_acceptance,
      'price',                   v_price,
      'voucher_code',            v_voucher_code,
      'is_complimentary',        v_complimentary
    ),
    coalesce(
      p_reason,
      'Booking taken at Reception as ' || p_source::text || ' [§9.2]'
    )
  );

  booking_id   := v_booking_id;
  reference    := v_reference;
  suite_id     := v_suite_id;
  suite_number := v_suite_number;
  return next;
end
$$;


alter table public.addons drop column price_fils;


create view public.public_price_rules
  with (security_invoker = false) as
  select
    r.id,
    r.guest_kind,
    r.from_hour,
    r.to_hour,
    r.regular_fils_per_hour,
    r.offer_fils_per_hour,
    r.offer_percent,
    r.weekdays,
    r.season_from,
    r.season_to,
    r.start_from_minutes,
    r.start_to_minutes,
    r.priority
  from public.price_rules r
  where r.is_active
    and (r.season_to is null or r.season_to >= current_date)
  order by r.priority desc, r.from_hour, r.id;


create view public.public_addons
  with (security_invoker = false) as
  select
    a.id,
    a.name,
    a.description,
    a.image_path,
    a.regular_price_fils,
    a.offer_price_fils,
    a.saving_label,
    a.kind,
    a.default_quantity,
    a.min_quantity,
    a.max_quantity,
    a.is_locked,
    (a.inventory is not null and a.inventory <= 0) as is_sold_out
  from public.addons a
  where a.is_active
    and (a.available_from is null or a.available_from <= current_date)
    and (a.available_to is null or a.available_to >= current_date)
  order by a.sort_order, a.name, a.id;


create or replace view public.public_booking_settings
  with (security_invoker = false) as
  select
    s.key,
    s.value
  from public.settings s
  where s.key in (
    'booking.start_interval_minutes',
    'booking.durations_hours',
    'booking.guests_min',
    'booking.guests_max',
    'booking.child_min_age',
    'booking.child_max_age',
    'booking.booker_min_age',
    'booking.min_notice_minutes',
    'booking.max_horizon_days',
    'booking.same_day_cutoff',
    'cleaning.buffer_minutes',
    'hold.minutes',
    'urgency.enabled',
    'urgency.threshold_few',
    'urgency.threshold_last',
    'urgency.text_few',
    'urgency.text_last',
    'urgency.text_none',
    'urgency.text_filling',
    'hours.regular',
    'contact.whatsapp_e164',
    'contact.email',
    'tax.vat_percent',
    'tax.inclusive',
    'tax.label',
    'pricing.currency',
    'pricing.rounding_fils',
    'pricing.offer_headline',
    'pricing.offer_subline',
    'pricing.offer_label'
  );


revoke all on public.public_price_rules from anon, authenticated;
revoke all on public.public_addons      from anon, authenticated;

grant select on public.public_price_rules to anon, authenticated;
grant select on public.public_addons to anon, authenticated;
grant select on public.public_booking_settings to anon, authenticated;


revoke all on function public.set_price_tier(
  uuid, text, public.guest_price_kind, integer, integer, integer, integer,
  numeric, integer[], date, date, integer, integer, integer, boolean, text
) from public;

revoke all on function public.set_addon(
  uuid, text, text, text, public.addon_kind, integer, integer, text,
  integer, integer, integer, boolean, integer, date, date, text,
  boolean, boolean, integer, text
) from public;

revoke all on function public.set_promo_code(
  uuid, text, public.promo_kind, integer, numeric, uuid[], date, date,
  integer, integer, boolean, boolean, text
) from public;

revoke all on function public.create_reception_booking(
  public.booking_source, public.salutation, text, text, text, date, text, text,
  timestamptz, integer, integer, integer, integer[], jsonb, text, text, jsonb,
  boolean, jsonb, text
) from public;

grant execute on function public.set_price_tier(
  uuid, text, public.guest_price_kind, integer, integer, integer, integer,
  numeric, integer[], date, date, integer, integer, integer, boolean, text
) to authenticated, service_role;

grant execute on function public.set_addon(
  uuid, text, text, text, public.addon_kind, integer, integer, text,
  integer, integer, integer, boolean, integer, date, date, text,
  boolean, boolean, integer, text
) to authenticated, service_role;

grant execute on function public.set_promo_code(
  uuid, text, public.promo_kind, integer, numeric, uuid[], date, date,
  integer, integer, boolean, boolean, text
) to authenticated, service_role;

grant execute on function public.create_reception_booking(
  public.booking_source, public.salutation, text, text, text, date, text, text,
  timestamptz, integer, integer, integer, integer[], jsonb, text, text, jsonb,
  boolean, jsonb, text
) to authenticated, service_role;


comment on function public.set_price_tier(
  uuid, text, public.guest_price_kind, integer, integer, integer, integer,
  numeric, integer[], date, date, integer, integer, integer, boolean, text
) is
  'Create or change one hourly rate tier [CLIENT §2, §7; §6.4, §10.2]. Management only, a mandatory reason, one audit entry carrying the whole row before and after, one transaction, one typed row back [R-14, INV-13].

§7 requires that every rate, every tier, every applicable-hours band and every future weekday, time-of-day or seasonal variation is editable WITHOUT A CODE CHANGE and is RECORDED IN THE AUDIT LOG. That sentence is the whole reason this function exists: public.price_rules holds no write policy for any role, so an UPDATE through here is the only way a rate moves, and the audit entry is written by the function rather than left to a caller who might forget [R-02, R-14].

A NULL p_id creates a tier and a supplied one changes it. That shape is deliberate: the Management screen edits a row it already has, and a create is the same form with nothing in it, so one function serves both and there is one place where the validation lives.

WP043 refuses a tier carrying both offer forms or neither. The check constraint price_rules_offer_is_exactly_one would refuse the same row with a bare 23514 naming a constraint the console cannot translate. Both is a tier with two answers to one question, and resolveOfferRate in src/lib/domain/pricing prefers the configured rate silently, which is the kind of quiet precedence that gets discovered in a receipt. Neither is a tier with no offer at all, which §2 does not describe.

The remaining validations mirror the table constraints for the same reason: an hour band that runs backwards, a rate below zero, a percentage outside nought to a hundred, a season that ends before it starts, and a start window with one bound instead of two or none. Every one of them is also a constraint, so the database is still the boundary and this function is the readable error message in front of it.

The code column is left alone once set and a create refuses a code that exists, because supabase/tests/pricing-schema.sql names the four launch tiers by code and scripts/generate-seed.mjs re-inserts them on conflict.

Nothing here touches money arithmetic. §6.4 has exactly one pricing implementation, in src/lib/domain/pricing, and a tier is the configuration it reads.';


comment on function public.set_addon(
  uuid, text, text, text, public.addon_kind, integer, integer, text,
  integer, integer, integer, boolean, integer, date, date, text,
  boolean, boolean, integer, text
) is
  'Create or change one add-on [§8, §10.4]. Management only, a mandatory reason, one audit entry with the whole row before and after, one transaction, one typed row back [R-14, INV-13].

It carries every Management control §8 lists for an add-on: name, image and customer-facing description, comparison price, offer price, VAT status and displayed saving label, active status, sales dates, inventory, display order, default, minimum and maximum quantity, locked or removable status, and the Reception preparation or return note.

WP044 refuses quantity bounds that do not read minimum <= default <= maximum, or any of the three below one. WP045 refuses a comparison price below the offer price, which would print a saving that runs backwards. Both are also table constraints, and both are given a named code here so the console shows a sentence rather than a constraint name.

AED 0 IS NOT VALIDATED AWAY, ON PURPOSE. §8 makes a zero offer price the automatic inclusion trigger with no separate switch, so zero is a decision Management makes here and the rule lives in that value alone. An item whose commercial terms are unknown is set inactive instead.

QUANTITIES ARE NEVER DERIVED FROM THE GUEST COUNT. §8 says so twice. Nothing in this function reads public.booking_guests and nothing may be added that does.

Repricing an add-on never moves a booking that has been sold: public.booking_addons snapshots the name, the charged price and the comparison price at the moment of sale [INV-21].';


comment on function public.set_promo_code(
  uuid, text, public.promo_kind, integer, numeric, uuid[], date, date,
  integer, integer, boolean, boolean, text
) is
  'Create or change one voucher code and the add-ons it targets [§8, §10.4]. Management only, a mandatory reason, one audit entry, one transaction, one typed row back [R-14, INV-13].

The targeted add-ons are written in the SAME TRANSACTION as the code. §8 treats the eligible add-ons as part of the rule rather than as a separate list, and a code that exists for a moment with no targets is a code that can be redeemed in that moment against nothing.

WP046 refuses a kind that disagrees with the value it carries. fixed needs an amount, percent needs a percentage, addon_free needs neither because it sets a price to nought rather than reducing one. A row where the two disagree has a meaning that depends on which field the reader consults, and discountFor in src/lib/domain/pricing consults exactly one of them.

WP047 refuses an addon_free code that names no add-on, and any code naming an add-on that does not exist. checkVoucher would otherwise refuse it at the till with no_eligible_addon, which is a refusal the guest sees for a mistake Management made.

used_count IS NOT AN ARGUMENT AND CANNOT BE SET HERE. It is moved only by the transaction that sells a booking, beside the public.promo_code_redemptions row that is the countable authority. A settable counter is how a usage limit becomes decorative, which is precisely what §8 asks for and what this refuses to allow.

The code is upper-cased and shape-checked on the way in, matching the table constraints, so the unique index is the whole of the duplicate rule and no lookup has to remember to fold case.

is_combinable says whether the code may be applied alongside another promotion, and checkVoucher owns that decision. It says nothing about the Special Offer rates in public.price_rules, which are the standing price and not a promotion.';


comment on function public.create_reception_booking(
  public.booking_source, public.salutation, text, text, text, date, text, text,
  timestamptz, integer, integer, integer, integer[], jsonb, text, text, jsonb,
  boolean, jsonb, text
) is
  'The §9.2 desk booking: walk-in, telephone, manual and complimentary. One transaction, one typed row, one audit entry [R-14, INV-13]. p_source refuses online, because §6.1''s guest flow holds a suite first and pays before it has a booking, which is a different sequence and not a variant of this one.

THE TWENTY ARGUMENTS AND THEIR NAMES ARE UNCHANGED by 20260908110000, deliberately. src/lib/db/rpc.ts sends them by name and supabase/tests/booking-rpcs.sql asserts the identity arguments string, so the signature is a contract and the voucher had to be carried inside an argument that already exists.

WHERE THE VOUCHER CODE TRAVELS. It is read from p_price as the optional string key "voucher_code", beside the six integer fils keys of the priced breakdown. THE TYPESCRIPT WRAPPER MUST MATCH THIS EXACTLY. p_addons was the alternative and was rejected: that argument is validated as a JSON ARRAY of add-on lines and the whole function refuses a non-array, so a sibling key has nowhere to sit without either wrapping the array in an object or hanging a booking-wide value off the first element. p_price is already an object, it is already stored verbatim into the audit entry so the code is recorded with no extra work, and a voucher is a fact about the price rather than a fact about one add-on line. An absent key is no voucher and an empty string is no voucher.

WHAT THE VOUCHER DOES HERE, AND WHAT IT DOES NOT. It writes public.promo_code_redemptions and increments public.promo_codes.used_count in this same transaction, which is what makes max_uses and per_customer_limit genuine rules rather than decoration [§8]. It does NOT reduce any figure: the booking total arrives already priced in p_price, because §6.4 has exactly one pricing implementation and it lives in src/lib/domain/pricing. A fixed or percent code therefore leaves nothing behind here except the redemption row and its audit entry.

An addon_free code sets each targeted line to nought and adds a targeted add-on that was not sent, at its configured default quantity, matching §8 and buildCart in src/lib/domain/vouchers.

FOUR NEW REFUSALS ON THE VOUCHER. WP039 is unknown, switched off, or outside its validity window. WP040 is the usage limit. WP041 is the per-customer limit. WP042 is an addon_free code whose targets are all switched off or out of their sales dates, which checkVoucher calls no_eligible_addon. The promo row is taken FOR UPDATE before the limit is read and the counter is moved under that lock, so two terminals cannot both spend the last use of a code. max_uses is tested against used_count and the per-customer limit is counted from the redemption rows, which is the split the schema documents and the index promo_code_redemptions_customer_idx exists for.

not_combinable IS NOT ENFORCED HERE and that is a stated gap. A second promotion is not something the database can see, since the discount arrives already applied inside p_price. checkVoucher owns that refusal above the database and the console is where it is shown.

TWO NEW REFUSALS ON ADD-ONS. WP037 refuses a quantity outside the add-on''s own minimum or maximum, and WP038 refuses an add-on that is switched off or outside its sales dates. §8 gives each item its own bounds and its own sales window, and until now this function accepted any positive quantity for any row in the catalogue.

THE ADD-ON LINES NOW CARRY THEIR §11.2 SNAPSHOT. Each line stores the comparison price standing in the catalogue at this moment, whether it was given rather than bought, whether the guest could have removed it, and the code that reduced it where one did. §11.2 needs to tell three cases apart that INV-21 will not let it recompute: an item at nought because the catalogue price is nought, an item at nought because a voucher targeted it, and an item that was paid for.

voucher_code is written ONLY where the voucher actually reduced a positive price to nought. buildCart in src/lib/domain/vouchers currently stamps the code on every targeted line including one that was already free, and the two should be made to agree in one direction or the other. The column''s own documentation says the code that reduced this line to nought, where one did, so that reading is what is stored here and the divergence is recorded rather than hidden.

THE CATALOGUE-WIDE AUTOMATIC INCLUSION OF EVERY NOUGHT-PRICED ADD-ON IS NOT DONE HERE, ON PURPOSE. §8 makes an offer price of nought the inclusion trigger, and buildCart implements it above the database from the same column. Implementing it a second time in SQL would be two implementations of one rule, which is the drift this codebase refuses everywhere else. What this function does instead is record faithfully what it is told, and refuse what §8 says cannot be sold. If that call is ever reversed, it belongs in one place and the domain function is the one that already has it.

Inventory is NOT claimed or decremented. §8 asks for a sold-out state and the column comment is explicit that a claim on stock belongs to the transaction that sells it, exactly as a claim on a suite does. That transaction is this one and the claim is not built yet, so a sold-out add-on is still sellable at the desk today. It is named here so it is a known gap rather than a discovery.

ADD-ON PRICES ARE READ FROM offer_price_fils. They used to be read from the deprecated generated mirror addons.price_fils, which 20260908110000 drops.

EVERYTHING THE HARDENING OF 20260908090000 PUT HERE IS PRESERVED. The cleaning buffer is not whatever the caller says: a null p_buffer_minutes reads cleaning.buffer_minutes through internal.setting_integer, a value equal to the configured default is accepted from anyone, and a value that DIFFERS from it needs perm:override_suite_allocation and raises WP035 without it. §7.1 applies the buffer to online, Reception, walk-in, manual and complimentary bookings alike, and this was the one creation path where it did not. When cleaning.buffer_minutes is unset there is no default to differ from, so any supplied value is accepted and a null raises WP006 naming the gap. The audit entry carries buffer_is_configured so §11 can tell a default-buffer booking from an overridden one. The staff gate is unchanged and a complimentary source still forces is_complimentary so §11.2 keeps those bookings out of revenue [INV-20].

The status starts at confirmed, not held or awaiting_payment. The guest is standing at the desk, and §9.2 treats the four creation types as bookings that already exist rather than as offers awaiting acceptance.

Allocation goes through internal.allocate_suite and nothing here inserts into public.suite_occupancy. Read that function''s own documentation before changing anything about locking or ordering. The venue-wide advisory lock is taken before the customer row is locked, and the promo row is locked after both, so this function and public.extend_booking can never take their locks in opposite orders.

The customer is found or created on internal.normalise_email, the identity key of public.customers [Q-1, ASSUMED]. A concurrent first booking for the same person is caught as a unique violation and re-read rather than duplicated. Existing details are NOT overwritten, except a null date of birth, which is completed rather than corrected.

Every business number is read from public.settings through internal.setting_integer and none is written as a literal [R-05, INV-16]. An unset setting is not enforced, which SYSTEM.md Part 8 requires. Add-on bounds are the exception that proves it: they are not settings, they are columns on the add-on itself, which is where §8 puts them.

Voucher validity and add-on sales dates are compared against current_date, the same basis the booker age gate already uses. Storage is UTC [INV-24], so for the four hours after Dubai midnight the comparison is one day conservative. The venue is closed in that window under every set of hours supplied so far.

p_price is otherwise stored verbatim, six integer fils columns, and no arithmetic is performed on it [INV-21]. p_acceptance is a JSON array of {"document_slug","document_version","checkbox_text"}, one row per document the single required tick box names [§6.3, Q-14], carrying the literal sentence rather than a key to it.

Returns suite_number, which INV-01 forbids reaching a guest. That is safe only because this function is granted to authenticated and service_role and never to the unauthenticated role, and because §1.1 puts suite numbers on the Reception surface by design. Nothing in src/app/(site) may call it.';


comment on table public.addons is
  'Bookable extras [§8, §10.4]. Configuration, not code — Management creates and prices them through public.set_addon, which is audited, and no role holds a write grant on this table [R-02, R-14]. SHIPS EMPTY on purpose: no commercial catalogue has been supplied (Q-15) and a seeded placeholder reads as confirmed within a week. An empty add-on step is a correct empty state [§4.1], not a blocked screen. Names are deliberately not unique, so a retired add-on can be superseded by a new one carrying the same name, and public.booking_addons snapshots the name it sold anyway.

THE COLUMN price_fils IS GONE, REMOVED BY 20260908110000. It existed for eight days and for one reason. 20260908100000 renamed the original price_fils to offer_price_fils, because §8 needs a comparison price beside a charged price and one unqualified name could not carry both. Dropping the old name in that migration would have left two live callers broken by a schema-only change: public.create_reception_booking snapshotted it onto a booking line, and listAddonPrices in src/lib/db/queries/bookings.ts selected it by name. So a generated mirror was kept for exactly as long as it took to move both, which this migration finishes. What a guest is charged is offer_price_fils and nothing else mirrors it.';


comment on view public.public_price_rules is
  'The rate card the guest booking widget prices against, readable with no session [§6.1, CLIENT §2].

WHY A VIEW AND NOT A GRANT. public.price_rules carries a staff-only read policy and that stays. Widening it would hand an unauthenticated caller the whole tier structure including is_active, the internal code slug, and the seasonal and weekday bands the venue has not launched yet. This view publishes what a PRICE IS and says nothing about how the venue is configured. It runs with the definer''s privileges and IS the permission boundary, exactly as public.public_booking_settings does [R-03].

THE COLUMNS ARE A TRANSCRIPTION of PriceTier in src/lib/domain/pricing, which is the single §6.4 implementation the booking flow, Reception, the §10.4 test-price preview, receipts and every §11.2 figure all walk. id is published because PriceTier requires it and selectTier breaks a final tie on it, so a view without it cannot produce the shape the engine consumes. It is the identifier of a configuration row and discloses nothing about a suite or a capacity [INV-01].

is_active is filtered rather than exposed, and a tier whose season has already ended is dropped. A season that has not started yet is KEPT, because booking.max_horizon_days lets a guest price a date inside a future season and filtering on today would quietly misprice it.

No suite id, no suite number, no capacity, no count of anything the venue holds [§3, INV-01].';


comment on view public.public_addons is
  'The add-on catalogue the guest booking widget renders, readable with no session [§8, §6.1].

WHY A VIEW AND NOT A GRANT. Two columns on public.addons must never leave the building. inventory is a commercial figure: a stock level tells a competitor how much the venue bought and tells a guest how the venue is doing. reception_note is the §8 preparation or return note, which is operational and addressed to staff [§3]. So the raw table keeps its staff-only policy and this view publishes the card instead, with is_sold_out derived from inventory rather than inventory itself. Null inventory is unlimited and is therefore not sold out. It runs with the definer''s privileges and IS the permission boundary [R-03].

THE COLUMNS ARE A TRANSCRIPTION of CartAddon in src/lib/domain/vouchers plus the four display fields the card needs, so buildCart consumes a row from here unchanged. regular_price_fils and offer_price_fils travel together because §8 requires the comparison price to stay visible and struck through even on an item given at AED 0, and because an offer price of nought is the automatic inclusion trigger the whole cart rule turns on.

THE SALES WINDOW IS FILTERED AND THE SOLD-OUT STATE IS NOT. §8 asks for both an unavailable state and a sold-out state, and they are not the same thing. A sold-out item is still on sale and its card is still worth showing, so it appears with is_sold_out true and the §4.1 unavailable state has something to render. An item outside its sales dates cannot be bought for weeks and is dropped instead, which is a judgement rather than a transcription of a sentence in §8. Reception reads the raw table and continues to see everything, including a seasonal item mid-configuration.

sort_order is NOT published and IS honoured: the view carries Management''s display order without disclosing the number it is expressed in.

No suite id, no suite number, no capacity [§3, INV-01].';


comment on view public.public_booking_settings is
  'The thirty §10.2 settings the unauthenticated booking flow needs [§6.1]. Same (key, value) shape as public.settings_snapshot so snapshotFromRows in src/lib/config/index.ts consumes it unchanged. The key list is an explicit literal, never a prefix pattern: a pattern would publish the next key added under that prefix silently, an explicit list makes it a reviewable edit. It runs with the definer''s privileges and IS the permission boundary, so public.settings stays unreadable without a session [R-03].

contact.whatsapp_e164 and contact.email are published deliberately [§4.3] — they are printed on a public page as a contact channel and are not secrets, and whatever Management sets becomes internet-visible on save.

THE tax.* AND pricing.* KEYS WERE ADDED BY 20260908110000 AND THE EXCLUSION OF tax.* WAS DELIBERATE BEFORE THAT. It was written while Q-4 was open and the VAT treatment was unknown, and supabase/tests/public-booking-settings.sql asserted the absence. Q-4 is now answered by the launch pricing specification: §1 fixes that all displayed and calculated prices include 5 per cent VAT, and §6 requires the words prices include 5% VAT to appear in the promotional message and again in the booking summary. A tax rate a guest is told about on the page cannot be a value the page may not read, so tax.vat_percent, tax.inclusive and tax.label are published, and the pgTAP assertion was rewritten to say that rather than deleted.

pricing.currency, pricing.rounding_fils, pricing.offer_headline, pricing.offer_subline and pricing.offer_label join them because §6 makes all five customer-facing. The rounding step is the one that looks internal and is not: where a tier is configured as a percentage off, resolveOfferRate rounds the resulting rate, and a widget that rounded differently from the server would display a rate the guest was not charged.

STILL DELIBERATELY EXCLUDED: fees.*, rules.*, allocation.*, privacy.*, security.* and hours.seasonal, hours.exceptions and hours.closures. The guest is shown the resulting service fee line, never the rule that produced it [§8.1]. allocation.strategy tells an attacker how suites are picked, which turns a count into a per-suite occupancy report [INV-01]. A published rate limit is the number to stay under [§13]. The forward operational calendar says when the venue shuts before it is announced.';
