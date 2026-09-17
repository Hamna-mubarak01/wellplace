create sequence internal.booking_reference_seq as bigint start with 1000 increment by 1;

comment on sequence internal.booking_reference_seq is
  'The collision-free half of a booking reference [§6.1, §9.1]. nextval is non-transactional, so two Reception terminals creating a booking in the same millisecond can never draw the same number and a rolled-back attempt burns one rather than reusing it. Gaps in the series are expected and carry no meaning.

A random suffix is appended by internal.next_booking_reference so the printed reference is not a running count of the venue''s trade. The sequence alone would tell any guest how many bookings WellPlace has ever taken, which is the same class of disclosure INV-01 refuses for suite numbers and capacity. The sequence supplies uniqueness; the suffix supplies opacity. Neither is an access control - a guest reaches their booking through the opaque expiring token of INV-25, never through the reference.';


create or replace function internal.setting_integer(p_key text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when s.value is null then null
    when jsonb_typeof(s.value) = 'number' then (s.value #>> '{}')::integer
    when jsonb_typeof(s.value) = 'string' then nullif(btrim(s.value #>> '{}'), '')::integer
    else null
  end
  from public.settings s
  where s.key = p_key
$$;

comment on function internal.setting_integer(text) is
  'Read one §10.2 integer setting [R-05]. Every business number the booking RPCs enforce - the guest range, the child age window, the 18+ gate - is read through here and never written as a literal in SQL.

NULL means "the client has not supplied this value yet", which SYSTEM.md Part 8 requires to be a working state rather than a blocked screen. A caller therefore treats NULL as "this rule is not configured" and does not enforce it. That is deliberate and it is the honest reading: refusing every booking because booking.booker_min_age has no row would take the venue offline over a configuration gap, and substituting a hardcoded 18 would be exactly the R-05 breach the setting exists to prevent. src/lib/config/registry.ts carries the default that the boundary layer applies before the call ever reaches Postgres.';


create or replace function internal.next_booking_reference()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select 'WP-'
      || lpad(nextval('internal.booking_reference_seq'::regclass)::text, 6, '0')
      || '-'
      || upper(substr(md5(gen_random_uuid()::text), 1, 4))
$$;

comment on function internal.next_booking_reference() is
  'Generate a booking reference that cannot collide [§6.1, §9.1]. The shape is WP-NNNNNN-XXXX: fourteen characters, upper-case alphanumeric groups, which satisfies bookings_reference_shaped and bookings_reference_length and leaves room inside the 32-character ceiling for a longer sequence.

Uniqueness comes from the sequence, not from luck. A random string plus a unique index is a retry loop waiting to be needed at twenty parallel Reception attempts; a sequence draw is unique by construction and needs no retry at all.

The four-character suffix is hexadecimal, whose alphabet contains no character pair a guest can confuse over the telephone - there is no O beside the 0 and no I beside the 1. Stored upper case so the bookings_reference_lookup_idx index on lower(reference) answers a guest who types it in any case [§9.1].';


create or replace function internal.release_expired_occupancy()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_released integer;
begin
  update public.suite_occupancy o
     set is_active = false,
         status    = 'expired'::public.occupancy_status
   where o.id in (
     select e.id
       from public.suite_occupancy e
      where e.is_active
        and e.expires_at is not null
        and e.expires_at <= clock_timestamp()
      order by e.id
      for update
   );

  get diagnostics v_released = row_count;
  return v_released;
end
$$;

comment on function internal.release_expired_occupancy() is
  'The lazy expiry sweep, INV-05, for the callers that change an existing claim in place rather than allocating a new one - public.extend_booking and public.override_booking_buffer.

The exclusion constraint suite_occupancy_no_overlap knows nothing about expires_at, because its predicate cannot call now(). An expired hold is therefore still inside the constraint until something marks it inactive, and an extension that overlaps one would be refused with WP015 for a slot that is genuinely free. Availability reads already filter expires_at > now(); an in-place UPDATE cannot, so it sweeps first.

The three properties inherited from internal.allocate_suite hold here and must survive any edit: the sweep is GLOBAL, it takes its row locks through one ordered sub-select, and it runs while the caller holds no suite lock. Callers take the venue-wide advisory lock before calling this, so a sweep never interleaves with an allocation. clock_timestamp(), never now(), for the same reason internal.allocate_suite gives: a caller that queued on the advisory lock would otherwise judge expiry against a clock stopped at BEGIN.

This statement is a second copy of the sweep that internal.allocate_suite runs inline. The two must move together, and a later migration should collapse them by having the allocator call this. It is duplicated today rather than refactored because the allocator is the §7.5 proof and the concurrency harness measures it; changing its body and adding these RPCs in one migration would leave a failure with two possible causes.';


revoke all on function internal.setting_integer(text)
  from public, anon, authenticated;
revoke all on function internal.next_booking_reference()
  from public, anon, authenticated;
revoke all on function internal.release_expired_occupancy()
  from public, anon, authenticated;


create or replace function internal.reclaim_booking_window(
  p_booking_id        uuid,
  p_experience        tstzrange,
  p_buffer_minutes    integer,
  p_suite_id          uuid,
  p_allow_unavailable boolean,
  p_reason            text
)
returns table (
  claimed_occupancy_id  uuid,
  claimed_suite_id      uuid,
  released_occupancy_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_blocked   tstzrange;
  v_old_id    uuid;
  v_new_id    uuid;
  v_new_suite uuid;
begin
  v_blocked := tstzrange(
    lower(p_experience),
    upper(p_experience) + (p_buffer_minutes * interval '1 minute'),
    '[)'
  );

  select b.occupancy_id
    into v_old_id
    from public.bookings b
   where b.id = p_booking_id;

  select a.allocated_occupancy_id, a.allocated_suite_id
    into v_new_id, v_new_suite
    from internal.allocate_suite(
      p_experience,
      v_blocked,
      p_buffer_minutes,
      'booking'::public.occupancy_kind,
      null,
      p_booking_id,
      p_reason,
      coalesce(p_allow_unavailable, false),
      p_suite_id
    ) a;

  if v_new_id is null and v_old_id is not null then
    begin
      update public.suite_occupancy o
         set is_active = false,
             status    = 'released'::public.occupancy_status
       where o.id = v_old_id
         and o.is_active;

      select a.allocated_occupancy_id, a.allocated_suite_id
        into v_new_id, v_new_suite
        from internal.allocate_suite(
          p_experience,
          v_blocked,
          p_buffer_minutes,
          'booking'::public.occupancy_kind,
          null,
          p_booking_id,
          p_reason,
          coalesce(p_allow_unavailable, false),
          p_suite_id
        ) a;

      if v_new_id is null then
        raise exception 'reclaim_booking_window: nothing free once the current claim was released'
          using errcode = 'WP017';
      end if;
    exception
      when sqlstate 'WP017' then
        v_new_id    := null;
        v_new_suite := null;
    end;
  end if;

  if v_new_id is null then
    return;
  end if;

  update public.suite_occupancy o
     set is_active = false,
         status    = 'released'::public.occupancy_status
   where o.id = v_old_id
     and o.is_active;

  claimed_occupancy_id  := v_new_id;
  claimed_suite_id      := v_new_suite;
  released_occupancy_id := v_old_id;
  return next;
end
$$;

comment on function internal.reclaim_booking_window(uuid, tstzrange, integer, uuid, boolean, text) is
  'Move an existing booking onto a new claim without ever leaving it without one [§7.6, §9.2, INV-12]. public.reschedule_booking and public.move_booking are both this, and neither reimplements it.

The order is the one §7.6 requires and it is the whole point: the new claim is secured through internal.allocate_suite FIRST, and only a successful allocation releases the old row. On that path the booking holds two claims for the width of one statement and never zero.

There is a second attempt, and it exists because the first one cannot succeed in the most ordinary case at the desk. Dragging a booking thirty minutes later on the same suite, or shortening it by an hour, asks for a window that overlaps the booking''s OWN claim - so the exclusion constraint refuses it and the first attempt reports nothing free while the suite is in truth free. So when the first attempt finds nothing, the old row is released and the allocation is retried.

That second attempt runs inside a plpgsql block with an exception handler, which is a subtransaction. If it also finds nothing free, WP017 is raised and immediately caught, the subtransaction rolls back, the release is undone and this function returns zero rows with the old claim provably exactly as it was. WP017 never leaves this function and no caller should ever see it. That is what makes "a failed reschedule does not lose the old booking" structurally true rather than dependent on every caller remembering to raise - though both callers do raise as well, so a rollback of the whole statement is the second backstop.

The venue-wide advisory lock is already held by the caller before this is entered, at the main transaction level, so the re-entrant acquisition inside the rolled-back subtransaction cannot take the serialisation away. Callers must keep taking it first.

A booking with no current claim - the §8.2 recovery gap, where suite_id and occupancy_id are both null - passes straight through the first attempt and needs no release. Returns zero rows when nothing is free (R-32); the caller chooses between WP016 and WP010 because only the caller knows whether a reschedule or a calendar move asked.';


revoke all on function internal.reclaim_booking_window(uuid, tstzrange, integer, uuid, boolean, text)
  from public, anon, authenticated;


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
  v_addons        jsonb := coalesce(p_addons, '[]'::jsonb);
  v_acceptance    jsonb := coalesce(p_acceptance, '[]'::jsonb);
  v_price         jsonb := coalesce(p_price, '{}'::jsonb);
  v_child_ages    integer[] := coalesce(p_child_ages, array[]::integer[]);
  v_children      integer;
  v_total_guests  integer;
  v_guests_min    integer;
  v_guests_max    integer;
  v_child_min     integer;
  v_child_max     integer;
  v_booker_min    integer;
  v_booker_age    integer;
  v_identity      text;
  v_customer_id   uuid;
  v_customer_new  boolean := false;
  v_customer_dob  date;
  v_dob_filled    boolean := false;
  v_is_blocked    boolean;
  v_experience    tstzrange;
  v_blocked       tstzrange;
  v_reference     text;
  v_booking_id    uuid;
  v_occupancy_id  uuid;
  v_suite_id      uuid;
  v_suite_number  integer;
  v_lines         integer;
  v_matched       integer;
  v_complimentary boolean;
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

  if p_buffer_minutes is null or p_buffer_minutes < 0 or p_buffer_minutes > 24 * 60 then
    raise exception 'create_reception_booking: p_buffer_minutes must be between 0 and one day, got %',
      coalesce(p_buffer_minutes::text, 'null')
      using errcode = 'WP006';
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

  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);

  v_experience := tstzrange(
    p_starts_at,
    p_starts_at + (p_duration_hours * interval '1 hour'),
    '[)'
  );

  v_blocked := tstzrange(
    lower(v_experience),
    upper(v_experience) + (p_buffer_minutes * interval '1 minute'),
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
    p_buffer_minutes,
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
      p_buffer_minutes,
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
    booking_id, addon_id, name_snapshot, unit_price_fils, quantity
  )
  select v_booking_id,
         a.id,
         a.name,
         a.price_fils,
         coalesce((l ->> 'quantity')::integer, 1)
    from jsonb_array_elements(v_addons) l
    join public.addons a on a.id = (l ->> 'addon_id')::uuid;

  insert into public.acceptance_records (
    booking_id, source, document_slug, document_version, checkbox_text
  )
  select v_booking_id,
         p_source,
         btrim(d ->> 'document_slug'),
         btrim(d ->> 'document_version'),
         btrim(d ->> 'checkbox_text')
    from jsonb_array_elements(v_acceptance) d;

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
      'cleaning_buffer_minutes', p_buffer_minutes,
      'adults',                  p_adults,
      'child_ages',              to_jsonb(v_child_ages),
      'addons',                  v_addons,
      'acceptance',              v_acceptance,
      'price',                   v_price,
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


create or replace function public.cancel_booking(
  p_booking_id uuid,
  p_reason     text
)
returns table (
  booking_id            uuid,
  status                public.booking_status,
  released_occupancy_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status       public.booking_status;
  v_occupancy_id uuid;
  v_suite_id     uuid;
  v_reference    text;
  v_released     uuid;
begin
  if not internal.is_staff() then
    raise exception 'cancel_booking: an active staff session is required [§9.2]'
      using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'cancel_booking: a reason is required — every manual change is audited with one [§3, INV-13]'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);

  select b.status, b.occupancy_id, b.suite_id, b.reference
    into v_status, v_occupancy_id, v_suite_id, v_reference
    from public.bookings b
   where b.id = p_booking_id
   for update;

  if v_status is null then
    raise exception 'cancel_booking: no booking with id %', p_booking_id
      using errcode = 'P0002';
  end if;

  if v_status not in (
    'held'::public.booking_status,
    'awaiting_payment'::public.booking_status,
    'payment_failed'::public.booking_status,
    'awaiting_recovery'::public.booking_status,
    'confirmed'::public.booking_status
  ) then
    raise exception 'cancel_booking: a booking in % cannot be cancelled [§4.4]',
      v_status
      using errcode = 'WP014';
  end if;

  update public.suite_occupancy o
     set is_active = false,
         status    = 'released'::public.occupancy_status
   where o.id = v_occupancy_id
     and o.is_active
  returning o.id into v_released;

  update public.bookings b
     set status = 'cancelled'::public.booking_status
   where b.id = p_booking_id;

  perform internal.write_audit(
    'cancel_booking',
    'public.bookings',
    p_booking_id::text,
    jsonb_build_object(
      'status',       v_status,
      'suite_id',     v_suite_id,
      'occupancy_id', v_occupancy_id
    ),
    jsonb_build_object(
      'status',                'cancelled',
      'reference',             v_reference,
      'released_occupancy_id', v_released
    ),
    p_reason
  );

  booking_id            := p_booking_id;
  status                := 'cancelled'::public.booking_status;
  released_occupancy_id := v_released;
  return next;
end
$$;


create or replace function public.reschedule_booking(
  p_booking_id     uuid,
  p_starts_at      timestamptz,
  p_duration_hours integer,
  p_reason         text
)
returns table (
  booking_id      uuid,
  status          public.booking_status,
  suite_id        uuid,
  suite_number    integer,
  occupancy_id    uuid,
  experience_from timestamptz,
  experience_to   timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status        public.booking_status;
  v_buffer        integer;
  v_old_period    tstzrange;
  v_old_suite     uuid;
  v_old_occupancy uuid;
  v_reference     text;
  v_experience    tstzrange;
  v_new_occupancy uuid;
  v_new_suite     uuid;
  v_released      uuid;
  v_suite_number  integer;
begin
  if not internal.is_staff() then
    raise exception 'reschedule_booking: an active staff session is required [§9.2]'
      using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reschedule_booking: a reason is required — every manual change is audited with one [§3, INV-13]'
      using errcode = '22023';
  end if;

  if p_starts_at is null or not isfinite(p_starts_at) then
    raise exception 'reschedule_booking: p_starts_at must be a finite instant, got %',
      coalesce(p_starts_at::text, 'null')
      using errcode = '22004';
  end if;

  if p_duration_hours is null or p_duration_hours <= 0 or p_duration_hours > 24 * 366 then
    raise exception 'reschedule_booking: p_duration_hours must be between 1 and one year, got %',
      coalesce(p_duration_hours::text, 'null')
      using errcode = 'WP005';
  end if;

  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);

  select b.status, b.cleaning_buffer_minutes, b.experience_period,
         b.suite_id, b.occupancy_id, b.reference
    into v_status, v_buffer, v_old_period,
         v_old_suite, v_old_occupancy, v_reference
    from public.bookings b
   where b.id = p_booking_id
   for update;

  if v_status is null then
    raise exception 'reschedule_booking: no booking with id %', p_booking_id
      using errcode = 'P0002';
  end if;

  if v_status <> 'confirmed'::public.booking_status then
    raise exception 'reschedule_booking: a booking in % cannot be rescheduled [§4.4]',
      v_status
      using errcode = 'WP014';
  end if;

  v_experience := tstzrange(
    p_starts_at,
    p_starts_at + (p_duration_hours * interval '1 hour'),
    '[)'
  );

  select r.claimed_occupancy_id, r.claimed_suite_id, r.released_occupancy_id
    into v_new_occupancy, v_new_suite, v_released
    from internal.reclaim_booking_window(
      p_booking_id,
      v_experience,
      v_buffer,
      null,
      false,
      p_reason
    ) r;

  if v_new_occupancy is null then
    raise exception 'reschedule_booking: no suite is free for the new window, the booking is unchanged [§7.6, INV-12]'
      using errcode = 'WP016';
  end if;

  update public.bookings b
     set experience_period = v_experience,
         suite_id          = v_new_suite,
         occupancy_id      = v_new_occupancy
   where b.id = p_booking_id;

  select s.suite_number
    into v_suite_number
    from public.suites s
   where s.id = v_new_suite;

  perform internal.write_audit(
    'reschedule_booking',
    'public.bookings',
    p_booking_id::text,
    jsonb_build_object(
      'experience_from', lower(v_old_period),
      'experience_to',   upper(v_old_period),
      'suite_id',        v_old_suite,
      'occupancy_id',    v_old_occupancy
    ),
    jsonb_build_object(
      'reference',             v_reference,
      'experience_from',       lower(v_experience),
      'experience_to',         upper(v_experience),
      'suite_id',              v_new_suite,
      'occupancy_id',          v_new_occupancy,
      'released_occupancy_id', v_released
    ),
    p_reason
  );

  booking_id      := p_booking_id;
  status          := v_status;
  suite_id        := v_new_suite;
  suite_number    := v_suite_number;
  occupancy_id    := v_new_occupancy;
  experience_from := lower(v_experience);
  experience_to   := upper(v_experience);
  return next;
end
$$;


create or replace function public.extend_booking(
  p_booking_id    uuid,
  p_extra_minutes integer,
  p_reason        text
)
returns table (
  booking_id      uuid,
  occupancy_id    uuid,
  experience_from timestamptz,
  experience_to   timestamptz,
  blocked_to      timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status        public.booking_status;
  v_occupancy_id  uuid;
  v_reference     text;
  v_suite_id      uuid;
  v_buffer        integer;
  v_old_exp       tstzrange;
  v_old_blocked   tstzrange;
  v_new_exp       tstzrange;
  v_new_blocked   tstzrange;
begin
  if not internal.is_staff() then
    raise exception 'extend_booking: an active staff session is required [§9.2]'
      using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'extend_booking: a reason is required — every manual change is audited with one [§3, INV-13]'
      using errcode = '22023';
  end if;

  if p_extra_minutes is null or p_extra_minutes <= 0 or p_extra_minutes > 24 * 60 then
    raise exception 'extend_booking: p_extra_minutes must be between 1 and one day, got %',
      coalesce(p_extra_minutes::text, 'null')
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);
  perform internal.release_expired_occupancy();

  select b.status, b.occupancy_id, b.reference
    into v_status, v_occupancy_id, v_reference
    from public.bookings b
   where b.id = p_booking_id
   for update;

  if v_status is null then
    raise exception 'extend_booking: no booking with id %', p_booking_id
      using errcode = 'P0002';
  end if;

  if v_status not in (
    'confirmed'::public.booking_status,
    'checked_in'::public.booking_status
  ) then
    raise exception 'extend_booking: a booking in % cannot be extended [§4.4]',
      v_status
      using errcode = 'WP014';
  end if;

  select o.suite_id, o.cleaning_buffer_minutes, o.experience_period, o.blocked_period
    into v_suite_id, v_buffer, v_old_exp, v_old_blocked
    from public.suite_occupancy o
   where o.id = v_occupancy_id
     and o.is_active
   for update;

  if v_suite_id is null then
    raise exception 'extend_booking: booking % holds no live claim to extend [§8.2]',
      p_booking_id
      using errcode = 'P0002';
  end if;

  v_new_exp := tstzrange(
    lower(v_old_exp),
    upper(v_old_exp) + (p_extra_minutes * interval '1 minute'),
    '[)'
  );

  v_new_blocked := tstzrange(
    lower(v_new_exp),
    upper(v_new_exp) + (v_buffer * interval '1 minute'),
    '[)'
  );

  if exists (
    select 1
      from public.suite_occupancy o
     where o.suite_id = v_suite_id
       and o.id <> v_occupancy_id
       and o.is_active
       and o.blocked_period && v_new_blocked
  ) then
    raise exception 'extend_booking: extending to % would reach a later claim or its cleaning buffer [§7.6, §7.1]',
      upper(v_new_blocked)
      using errcode = 'WP015';
  end if;

  begin
    update public.suite_occupancy o
       set experience_period = v_new_exp,
           blocked_period    = v_new_blocked
     where o.id = v_occupancy_id;
  exception
    when exclusion_violation then
      raise exception 'extend_booking: extending to % would reach a later claim or its cleaning buffer [§7.6, INV-02]',
        upper(v_new_blocked)
        using errcode = 'WP015';
  end;

  update public.bookings b
     set experience_period = v_new_exp
   where b.id = p_booking_id;

  perform internal.write_audit(
    'extend_booking',
    'public.suite_occupancy',
    v_occupancy_id::text,
    jsonb_build_object(
      'experience_to', upper(v_old_exp),
      'blocked_to',    upper(v_old_blocked)
    ),
    jsonb_build_object(
      'booking_id',    p_booking_id,
      'reference',     v_reference,
      'suite_id',      v_suite_id,
      'extra_minutes', p_extra_minutes,
      'experience_to', upper(v_new_exp),
      'blocked_to',    upper(v_new_blocked)
    ),
    p_reason
  );

  booking_id      := p_booking_id;
  occupancy_id    := v_occupancy_id;
  experience_from := lower(v_new_exp);
  experience_to   := upper(v_new_exp);
  blocked_to      := upper(v_new_blocked);
  return next;
end
$$;


create or replace function public.move_booking(
  p_booking_id        uuid,
  p_suite_id          uuid,
  p_starts_at         timestamptz,
  p_allow_unavailable boolean,
  p_reason            text
)
returns table (
  booking_id      uuid,
  status          public.booking_status,
  suite_id        uuid,
  suite_number    integer,
  occupancy_id    uuid,
  experience_from timestamptz,
  experience_to   timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status        public.booking_status;
  v_buffer        integer;
  v_old_period    tstzrange;
  v_old_suite     uuid;
  v_old_occupancy uuid;
  v_reference     text;
  v_duration      interval;
  v_experience    tstzrange;
  v_new_occupancy uuid;
  v_new_suite     uuid;
  v_released      uuid;
  v_suite_number  integer;
  v_override      boolean := coalesce(p_allow_unavailable, false);
begin
  if not internal.is_staff() then
    raise exception 'move_booking: an active staff session is required [§9.2]'
      using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'move_booking: a reason is required — every manual change is audited with one [§3, INV-13]'
      using errcode = '22023';
  end if;

  if p_suite_id is null then
    raise exception 'move_booking: p_suite_id names the destination suite and must not be null [§9.2]'
      using errcode = '22004';
  end if;

  if p_starts_at is null or not isfinite(p_starts_at) then
    raise exception 'move_booking: p_starts_at must be a finite instant, got %',
      coalesce(p_starts_at::text, 'null')
      using errcode = '22004';
  end if;

  if v_override
     and not internal.has_permission('override_suite_allocation'::public.named_permission) then
    raise exception 'move_booking: placing a booking on a blocked, maintenance, not-ready or out-of-service suite needs perm:override_suite_allocation, which §7.2 requires of Management as well as Reception'
      using errcode = 'WP013';
  end if;

  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);

  select b.status, b.cleaning_buffer_minutes, b.experience_period,
         b.suite_id, b.occupancy_id, b.reference
    into v_status, v_buffer, v_old_period,
         v_old_suite, v_old_occupancy, v_reference
    from public.bookings b
   where b.id = p_booking_id
   for update;

  if v_status is null then
    raise exception 'move_booking: no booking with id %', p_booking_id
      using errcode = 'P0002';
  end if;

  if v_status not in (
    'confirmed'::public.booking_status,
    'checked_in'::public.booking_status
  ) then
    raise exception 'move_booking: a booking in % cannot be moved [§4.4]',
      v_status
      using errcode = 'WP014';
  end if;

  v_duration   := upper(v_old_period) - lower(v_old_period);
  v_experience := tstzrange(p_starts_at, p_starts_at + v_duration, '[)');

  select r.claimed_occupancy_id, r.claimed_suite_id, r.released_occupancy_id
    into v_new_occupancy, v_new_suite, v_released
    from internal.reclaim_booking_window(
      p_booking_id,
      v_experience,
      v_buffer,
      p_suite_id,
      v_override,
      p_reason
    ) r;

  if v_new_occupancy is null then
    raise exception 'move_booking: that suite is not free from % to %, the booking is unchanged [§9.2, §7.5]',
      lower(v_experience),
      upper(v_experience) + (v_buffer * interval '1 minute')
      using errcode = 'WP010';
  end if;

  update public.bookings b
     set experience_period = v_experience,
         suite_id          = v_new_suite,
         occupancy_id      = v_new_occupancy
   where b.id = p_booking_id;

  select s.suite_number
    into v_suite_number
    from public.suites s
   where s.id = v_new_suite;

  perform internal.write_audit(
    'move_booking',
    'public.bookings',
    p_booking_id::text,
    jsonb_build_object(
      'experience_from', lower(v_old_period),
      'experience_to',   upper(v_old_period),
      'suite_id',        v_old_suite,
      'occupancy_id',    v_old_occupancy
    ),
    jsonb_build_object(
      'reference',             v_reference,
      'experience_from',       lower(v_experience),
      'experience_to',         upper(v_experience),
      'suite_id',              v_new_suite,
      'occupancy_id',          v_new_occupancy,
      'released_occupancy_id', v_released,
      'allow_unavailable',     v_override
    ),
    p_reason
  );

  booking_id      := p_booking_id;
  status          := v_status;
  suite_id        := v_new_suite;
  suite_number    := v_suite_number;
  occupancy_id    := v_new_occupancy;
  experience_from := lower(v_experience);
  experience_to   := upper(v_experience);
  return next;
end
$$;


create or replace function public.override_booking_buffer(
  p_booking_id     uuid,
  p_buffer_minutes integer,
  p_reason         text
)
returns table (
  booking_id              uuid,
  occupancy_id            uuid,
  cleaning_buffer_minutes integer,
  blocked_to              timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status       public.booking_status;
  v_occupancy_id uuid;
  v_reference    text;
  v_suite_id     uuid;
  v_old_buffer   integer;
  v_old_exp      tstzrange;
  v_old_blocked  tstzrange;
  v_new_blocked  tstzrange;
begin
  perform internal.require_management();

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'override_booking_buffer: a reason is required — §7.1 makes the override an audited change [§3, INV-13]'
      using errcode = '22023';
  end if;

  if p_buffer_minutes is null or p_buffer_minutes < 0 or p_buffer_minutes > 24 * 60 then
    raise exception 'override_booking_buffer: p_buffer_minutes must be between 0 and one day, got %',
      coalesce(p_buffer_minutes::text, 'null')
      using errcode = 'WP006';
  end if;

  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);
  perform internal.release_expired_occupancy();

  select b.status, b.occupancy_id, b.reference, b.cleaning_buffer_minutes
    into v_status, v_occupancy_id, v_reference, v_old_buffer
    from public.bookings b
   where b.id = p_booking_id
   for update;

  if v_status is null then
    raise exception 'override_booking_buffer: no booking with id %', p_booking_id
      using errcode = 'P0002';
  end if;

  if v_status not in (
    'held'::public.booking_status,
    'awaiting_payment'::public.booking_status,
    'payment_failed'::public.booking_status,
    'confirmed'::public.booking_status,
    'checked_in'::public.booking_status
  ) then
    raise exception 'override_booking_buffer: a booking in % holds no live claim whose buffer could matter [§4.4]',
      v_status
      using errcode = 'WP014';
  end if;

  select o.suite_id, o.experience_period, o.blocked_period
    into v_suite_id, v_old_exp, v_old_blocked
    from public.suite_occupancy o
   where o.id = v_occupancy_id
     and o.is_active
   for update;

  if v_suite_id is null then
    raise exception 'override_booking_buffer: booking % holds no live claim [§8.2]',
      p_booking_id
      using errcode = 'P0002';
  end if;

  v_new_blocked := tstzrange(
    lower(v_old_exp),
    upper(v_old_exp) + (p_buffer_minutes * interval '1 minute'),
    '[)'
  );

  if exists (
    select 1
      from public.suite_occupancy o
     where o.suite_id = v_suite_id
       and o.id <> v_occupancy_id
       and o.is_active
       and o.blocked_period && v_new_blocked
  ) then
    raise exception 'override_booking_buffer: a % minute buffer would reach a later claim on this suite [§7.1]',
      p_buffer_minutes
      using errcode = 'WP015';
  end if;

  begin
    update public.suite_occupancy o
       set blocked_period          = v_new_blocked,
           cleaning_buffer_minutes = p_buffer_minutes
     where o.id = v_occupancy_id;
  exception
    when exclusion_violation then
      raise exception 'override_booking_buffer: a % minute buffer would reach a later claim on this suite [§7.1, INV-02]',
        p_buffer_minutes
        using errcode = 'WP015';
  end;

  update public.bookings b
     set cleaning_buffer_minutes = p_buffer_minutes
   where b.id = p_booking_id;

  perform internal.write_audit(
    'override_booking_buffer',
    'public.suite_occupancy',
    v_occupancy_id::text,
    jsonb_build_object(
      'cleaning_buffer_minutes', v_old_buffer,
      'blocked_to',              upper(v_old_blocked)
    ),
    jsonb_build_object(
      'booking_id',              p_booking_id,
      'reference',               v_reference,
      'suite_id',                v_suite_id,
      'cleaning_buffer_minutes', p_buffer_minutes,
      'blocked_to',              upper(v_new_blocked)
    ),
    p_reason
  );

  booking_id              := p_booking_id;
  occupancy_id            := v_occupancy_id;
  cleaning_buffer_minutes := p_buffer_minutes;
  blocked_to              := upper(v_new_blocked);
  return next;
end
$$;


create or replace function public.update_booking_details(
  p_booking_id       uuid,
  p_personal_request text,
  p_internal_note    text,
  p_reason           text
)
returns table (
  booking_id       uuid,
  personal_request text,
  internal_note    text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reference   text;
  v_old_request text;
  v_old_note    text;
  v_new_request text := nullif(btrim(coalesce(p_personal_request, '')), '');
  v_new_note    text := nullif(btrim(coalesce(p_internal_note, '')), '');
  v_found       boolean;
begin
  if not internal.is_staff() then
    raise exception 'update_booking_details: an active staff session is required [§9.2]'
      using errcode = '42501';
  end if;

  select true, b.reference, b.personal_request, b.internal_note
    into v_found, v_reference, v_old_request, v_old_note
    from public.bookings b
   where b.id = p_booking_id
   for update;

  if v_found is null then
    raise exception 'update_booking_details: no booking with id %', p_booking_id
      using errcode = 'P0002';
  end if;

  update public.bookings b
     set personal_request = v_new_request,
         internal_note    = v_new_note
   where b.id = p_booking_id;

  perform internal.write_audit(
    'update_booking_details',
    'public.bookings',
    p_booking_id::text,
    jsonb_build_object(
      'personal_request', v_old_request,
      'internal_note',    v_old_note
    ),
    jsonb_build_object(
      'reference',        v_reference,
      'personal_request', v_new_request,
      'internal_note',    v_new_note
    ),
    coalesce(p_reason, 'Booking notes edited at Reception [§9.2]')
  );

  booking_id       := p_booking_id;
  personal_request := v_new_request;
  internal_note    := v_new_note;
  return next;
end
$$;


comment on function public.create_reception_booking(
  public.booking_source, public.salutation, text, text, text, date, text, text,
  timestamptz, integer, integer, integer, integer[], jsonb, text, text, jsonb,
  boolean, jsonb, text
) is
  'The §9.2 desk booking: walk-in, telephone, manual and complimentary. One transaction, one typed row, one audit entry [R-14, INV-13]. p_source refuses online, because §6.1''s guest flow holds a suite first and pays before it has a booking - a different sequence, not a variant of this one.

The status starts at confirmed, not held or awaiting_payment. The guest is standing at the desk, and §9.2 treats the four creation types as bookings that already exist rather than as offers awaiting acceptance; §8''s payment states then run beside the booking rather than gating it, which is what lets Reception take payment after the visit or comp it entirely. src/lib/domain/booking''s statusAfter agrees: confirmed is where check_in, reschedule, cancel and no_show all become legal, and every one of those is a §9.2 desk action.

Allocation goes through internal.allocate_suite and nothing here inserts into public.suite_occupancy. Read that function''s own documentation before changing anything about locking or ordering. The venue-wide advisory lock is taken here as well, before the customer row is locked, so that this function and public.extend_booking - which must sweep expired holds before it can safely lock anything - can never take their locks in opposite orders.

The customer is found or created on internal.normalise_email, the identity key of public.customers [Q-1, ASSUMED]. A concurrent first booking for the same person is caught as a unique violation and re-read rather than duplicated. Existing details are NOT overwritten: correcting a customer record is perm:correct_customer_record and belongs to its own audited function. The one exception is a null date of birth, which is completed rather than corrected - A1 left the column nullable because Reception can hold a contact before any booking exists, and stated that presence would be enforced by the function that creates a booking. That is here: WP011 with no date of birth at all, and WP011 again if the booker is under booking.booker_min_age.

Every business number is read from public.settings through internal.setting_integer and none is written as a literal [R-05, INV-16]. booking.guests_min, booking.guests_max, booking.child_min_age, booking.child_max_age and booking.booker_min_age all raise WP011 naming the setting that refused. An unset setting is not enforced, which SYSTEM.md Part 8 requires; the registry default is applied above the database. booking.durations_hours is deliberately NOT enforced - the selectable durations are the §6.1 guest grid, and forcing them onto a telephone booking would make Reception unable to sell what a guest asked for.

p_price is stored verbatim, six integer fils columns, and no arithmetic is performed on it here. §11 sums stored values and never recomputes a price [INV-21], and the single pricing implementation lives in src/lib/domain/pricing. A complimentary source forces is_complimentary so §11.2 can keep those bookings out of revenue [INV-20].

p_addons is a JSON array of {"addon_id","quantity"} and each line snapshots the name and unit price standing in public.addons at this moment. p_acceptance is a JSON array of {"document_slug","document_version","checkbox_text"}, one row per document the single required tick box names [§6.3, Q-14], carrying the literal sentence rather than a key to it. Acceptance is not made mandatory here [OUR CHOICE]: a telephone booking can record it separately, and refusing the booking would put an evidence rule in the way of taking the money. The boundary layer requires it for every surface that shows a tick box.

A booker date of birth is compared against current_date, the same basis public.waitlist_leads uses for its calculated age. Storage is UTC [INV-24], so for the four hours after Dubai midnight the gate is one day conservative - it can refuse someone on the morning of their eighteenth birthday and never admits someone a day early. The venue is closed in that window under every set of hours supplied so far.

Returns suite_number, which INV-01 forbids reaching a guest. That is safe only because this function is granted to authenticated and service_role and never to anon, and because §1.1 puts suite numbers on the Reception surface by design. Nothing in src/app/(site) may call it.';


comment on function public.cancel_booking(uuid, text) is
  'Cancel a booking and give the suite back [§9.2]. The claim in public.suite_occupancy is expired by status - is_active false, status released - and never deleted [R-17]: §11.3 reports on abandonment and cancellation, and a delete destroys the only record.

The legal starting states are transcribed from ACTION_RESULT.cancel in src/lib/domain/booking: held, awaiting_payment, payment_failed, awaiting_recovery and confirmed. Anything else raises WP014. checked_in is deliberately absent - a guest already in a suite is checked out, not cancelled - and the terminal states cannot be reopened. The database agrees with the transition table because the console disables its buttons from that same table, and two disagreeing copies of a state machine is how a guard silently stops guarding.

bookings.occupancy_id keeps pointing at the released row rather than being nulled. is_active already says the claim is not live, and the pointer is what lets §9.1''s suite timeline explain the gap it left. That is the same convention public.reschedule_booking follows, where the column moves to the new row and the released one keeps its own booking_id.

A reason is required. §3 and INV-13 want an audit entry carrying user, timestamp, old value, new value AND reason, and a cancellation with no stated reason is the entry a dispute turns on.';


comment on function public.reschedule_booking(uuid, timestamptz, integer, text) is
  'Move a booking to a new time, atomically [§7.6, §3, INV-12]. The §16.1 acceptance test is "failed atomic rescheduling does not lose the old booking", and the property is structural rather than careful: the work is done by internal.reclaim_booking_window, which secures the new claim before releasing the old one and, on the retry path, undoes its own release inside a subtransaction before returning nothing. Read that function before changing this one.

WP016 means no suite was free for the new window. The old booking, its suite and its occupancy row are then exactly as they were - guaranteed twice over, once by the helper''s internal rollback and once because this raise aborts the statement.

Only a confirmed booking may be rescheduled, transcribed from ACTION_RESULT.reschedule, and the status stays confirmed afterwards. It does NOT become the booking_status value rescheduled. statusAfter(''reschedule'', ''confirmed'') returns confirmed in src/lib/domain/booking, so that is what the database does; the rescheduled label in the enum is reserved for a booking superseded by a different one and nothing writes it yet.

The cleaning buffer is taken from the booking, not from settings [§7.1]. A booking keeps the buffer it was sold with even after Management retunes the default, so a reschedule re-applies the stored value and the §7.1 worked example keeps reproducing for old bookings.

The suite can change. Availability is computed across all seven suites and a guest never sees a suite number [§3, INV-01], so being moved is invisible to them; where the same suite is still free for the new window it is normally the one re-taken, because the helper releases the old claim before its second attempt and the fixed priority order then finds it first.';


comment on function public.extend_booking(uuid, integer, text) is
  'Extend a booking in place [§7.6]. "A planned extension may be confirmed only if later bookings and the cleaning buffer remain protected" - so the same occupancy row grows, and WP015 says it cannot.

Extending is not allocating: there is no new claim, so this is the one path in the booking RPCs that does not call internal.allocate_suite. It still takes the venue-wide advisory lock FIRST, before any row is touched, for exactly the reason that function documents - without it two extensions, or an extension and an allocation, could interleave between the conflict check and the UPDATE and both believe the space was free.

The explicit conflict check exists to produce a message a receptionist can act on. The exclusion constraint behind it is the backstop and is caught as well, because a concurrent transaction can still lose the race and INV-02 must hold whatever the check believed.

internal.release_expired_occupancy runs first. The exclusion constraint cannot read expires_at, so an expired but still active hold on the same suite would refuse an extension into a slot that is genuinely free. An allocation would have swept it; an in-place update has to sweep it itself. That sweep is global and ordered and runs while no suite is locked, which is what keeps it out of the deadlock the concurrency harness reproduces at twenty parallel attempts.

Legal from confirmed and checked_in, transcribed from ACTION_RESULT.extend, and the status does not change. Only the actual overrun of a visit is charged, in commenced increments of overrun.increment_minutes [§7.6] - that is a measurement recorded on bookings.overrun_minutes by a different action, and this function is the planned extension, which is sold in advance.';


comment on function public.move_booking(uuid, uuid, timestamptz, boolean, text) is
  'The §9.2 calendar move: put this booking on that suite at that time. "Complete validation of every move" means it re-runs the real allocation rather than a cheaper check, so a move is subject to the same exclusion constraint, the same suite status rules and the same lock as every other claim [INV-02, §7.5]. internal.reclaim_booking_window does the work and internal.allocate_suite does the allocating, with the destination named through p_suite_id.

The duration is preserved. A move changes when and where, never how long, because §9.2 lists extending as its own action and a drag that silently resized a booking would change what the guest bought.

p_allow_unavailable is §7.2''s override: blocked, maintenance, not-ready and out-of-service suites are never allocated automatically, and placing a booking on one anyway needs perm:override_suite_allocation. docs/5 §2 is explicit that this permission is granted by NEITHER role implicitly - a management account without the grant is refused exactly as a reception account is. WP013 says so.

WP010 means the named suite could not take the booking. Because the helper releases the old claim before its second attempt, nudging a booking on its own suite - the ordinary drag of fifteen or thirty minutes - is allocated back onto that suite rather than refused for overlapping itself.';


comment on function public.override_booking_buffer(uuid, integer, text) is
  'Change the cleaning buffer of one booking [§7.1]. "An authorised single-booking override requires a conflict check and audit entry", and this is both: blocked_period is recomputed from the stored experience_period, the later claims on that suite are checked, the exclusion constraint stays the backstop, and the change is audited with the old and new buffer.

The value is written to the occupancy row AND to bookings.cleaning_buffer_minutes, which must not be allowed to disagree. The booking column is what a reschedule re-applies and what a receipt explains; the occupancy column is what the constraint enforces.

Restricted to Management [OUR CHOICE, needs a client decision]. §7.1 says "authorised" and names no permission, and none of the four named permissions in docs/5 §2 covers a buffer. The nearest row of the matrix - configure opening hours, booking rules, buffer, hold - reads reception no, management yes, so this transcribes that rather than inventing a fifth permission. Widening it to Reception, or attaching a new named permission, is a decision for the client; widening later costs nothing and narrowing after the fact does not undo the exposure.

Only a booking holding a live claim can have its buffer overridden; anything else raises WP014. WP015 means the new buffer would reach a later claim on the same suite.';


comment on function public.update_booking_details(uuid, text, text, text) is
  'Edit the two free-text fields of a booking [§9.2]: the guest''s personal request and the operational internal note. Nothing else - not a time, not a price, not a suite - so it takes no allocation lock and is the only mutating booking function that does not, which is also why it cannot take part in a lock cycle: it acquires exactly one row lock and then commits.

A null clears the field and a blank string is stored as null, because bookings_personal_request_length and bookings_internal_note_length refuse the empty string. Both fields are always written, so the caller sends the state it wants rather than a patch.

booking.personal_request_max_length is deliberately not enforced here. It is a §10.2 setting applied by the Zod schema at the boundary; a check constraint or a guard holding the business number would make a Management change a migration [R-05]. The column constraint at 2000 characters is storage sanity, not the rule.

internal_note is never rendered on a guest-facing surface [§3]. Any status may be edited, including a completed or cancelled booking, because a note about what happened is most often written afterwards. A reason is optional here, unlike the functions that move time, money or a suite; the audit entry still carries one.';


revoke all on function public.create_reception_booking(
  public.booking_source, public.salutation, text, text, text, date, text, text,
  timestamptz, integer, integer, integer, integer[], jsonb, text, text, jsonb,
  boolean, jsonb, text
) from public;

revoke all on function public.cancel_booking(uuid, text) from public;
revoke all on function public.reschedule_booking(uuid, timestamptz, integer, text) from public;
revoke all on function public.extend_booking(uuid, integer, text) from public;
revoke all on function public.move_booking(uuid, uuid, timestamptz, boolean, text) from public;
revoke all on function public.override_booking_buffer(uuid, integer, text) from public;
revoke all on function public.update_booking_details(uuid, text, text, text) from public;

grant execute on function public.create_reception_booking(
  public.booking_source, public.salutation, text, text, text, date, text, text,
  timestamptz, integer, integer, integer, integer[], jsonb, text, text, jsonb,
  boolean, jsonb, text
) to authenticated, service_role;

grant execute on function public.cancel_booking(uuid, text)
  to authenticated, service_role;
grant execute on function public.reschedule_booking(uuid, timestamptz, integer, text)
  to authenticated, service_role;
grant execute on function public.extend_booking(uuid, integer, text)
  to authenticated, service_role;
grant execute on function public.move_booking(uuid, uuid, timestamptz, boolean, text)
  to authenticated, service_role;
grant execute on function public.override_booking_buffer(uuid, integer, text)
  to authenticated, service_role;
grant execute on function public.update_booking_details(uuid, text, text, text)
  to authenticated, service_role;
