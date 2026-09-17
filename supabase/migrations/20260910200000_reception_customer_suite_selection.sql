CREATE OR REPLACE FUNCTION public.create_reception_booking_selected(p_source public.booking_source, p_salutation public.salutation, p_first_name text, p_last_name text, p_email text, p_date_of_birth date, p_phone_e164 text, p_phone_country text, p_starts_at timestamptz, p_duration_hours integer, p_buffer_minutes integer, p_adults integer, p_child_ages integer[], p_addons jsonb, p_personal_request text, p_internal_note text, p_price jsonb, p_is_complimentary boolean, p_acceptance jsonb, p_reason text, p_customer_id uuid default null, p_suite_id uuid default null)
 RETURNS TABLE(booking_id uuid, reference text, suite_id uuid, suite_number integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  perform internal.require_desk_operator();
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

  if not exists (select 1 from public.settings s where s.key = 'booking.durations_hours' and s.value @> jsonb_build_array(p_duration_hours)) then
    raise exception 'That duration is no longer offered. Choose an available duration.' using errcode = 'WP005';
  end if;
  if p_salutation is null or nullif(btrim(p_first_name), '') is null or nullif(btrim(p_last_name), '') is null
    or nullif(btrim(p_email), '') is null or p_email not like '%@%'
    or p_phone_e164 is null or p_phone_e164 !~ '^\+[1-9][0-9]{6,14}$'
    or p_phone_country is null or p_phone_country !~ '^[A-Z]{2}$' then
    raise exception 'Complete the customer name, email and phone details.' using errcode = 'WP011';
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

  v_booker_age := extract(year from age((clock_timestamp() at time zone 'Asia/Dubai')::date, p_date_of_birth))::integer;

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
    select 1 from unnest(array['legal-terms', 'privacy-policy', 'marketing-terms']) required(slug)
    where not exists (select 1 from jsonb_array_elements(v_acceptance) d where d ->> 'document_slug' = required.slug)
  ) then
    raise exception 'The guest must accept the current terms before booking.' using errcode = 'WP063';
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
   where not a.is_active or a.inventory = 0
      or (a.available_from is not null and a.available_from > (clock_timestamp() at time zone 'Asia/Dubai')::date)
      or (a.available_to   is not null and a.available_to   < (clock_timestamp() at time zone 'Asia/Dubai')::date)
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

  if p_customer_id is not null and v_customer_id is distinct from p_customer_id then
    raise exception 'The selected customer has changed. Select the customer again.' using errcode = 'WP062';
  end if;
  if v_customer_id is not null and not exists (
    select 1 from public.customers c where c.id = v_customer_id
      and c.salutation = p_salutation and c.first_name = btrim(p_first_name)
      and c.last_name = btrim(p_last_name) and c.phone_e164 = p_phone_e164
      and c.phone_country = p_phone_country
      and (c.date_of_birth is null or c.date_of_birth = p_date_of_birth)
  ) then
    raise exception 'These details differ from the existing customer. Select their saved profile, or ask an authorised colleague to correct it.' using errcode = 'WP062';
  end if;

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

    if (v_promo_from is not null and (clock_timestamp() at time zone 'Asia/Dubai')::date < v_promo_from)
       or (v_promo_to is not null and (clock_timestamp() at time zone 'Asia/Dubai')::date > v_promo_to) then
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
         and (a.available_from is null or a.available_from <= (clock_timestamp() at time zone 'Asia/Dubai')::date)
         and (a.available_to   is null or a.available_to   >= (clock_timestamp() at time zone 'Asia/Dubai')::date);

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
      p_suite_id
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
         and (ta.available_from is null or ta.available_from <= (clock_timestamp() at time zone 'Asia/Dubai')::date)
         and (ta.available_to   is null or ta.available_to   >= (clock_timestamp() at time zone 'Asia/Dubai')::date)
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
$function$;
revoke all on function public.create_reception_booking_selected(public.booking_source, public.salutation, text, text, text, date, text, text, timestamptz, integer, integer, integer, integer[], jsonb, text, text, jsonb, boolean, jsonb, text, uuid, uuid) from public, anon;
grant execute on function public.create_reception_booking_selected(public.booking_source, public.salutation, text, text, text, date, text, text, timestamptz, integer, integer, integer, integer[], jsonb, text, text, jsonb, boolean, jsonb, text, uuid, uuid) to authenticated;
comment on function public.create_reception_booking_selected(public.booking_source, public.salutation, text, text, text, date, text, text, timestamptz, integer, integer, integer, integer[], jsonb, text, text, jsonb, boolean, jsonb, text, uuid, uuid) is '[CLIENT, §6, §7.2, §9.2] Creates a booking for an existing or new customer and an optional exact available suite, with atomic allocation, identity validation, pricing, acceptance and audit.';
