revoke all on function internal.write_audit(text, text, text, jsonb, jsonb, text)
  from public, anon, authenticated;

revoke all on function internal.current_staff_email()
  from public, anon, authenticated;

revoke all on function internal.require_management()
  from public, anon, authenticated;

revoke all on function internal.set_updated_at()
  from public, anon, authenticated;

revoke all on function internal.assert_management_remains()
  from public, anon, authenticated;


comment on function internal.write_audit(text, text, text, jsonb, jsonb, text) is
  'The only way an audit row is written. INV-14, and until 20260908090000 it was not.

This function kept PostgreSQL''s default EXECUTE grant to PUBLIC while the authenticated role holds USAGE on the internal schema, and it runs with the definer''s privileges. Any signed-in session could therefore call it directly and write an audit entry naming any action, any entity, any old value, any new value and any reason. The forged row was indistinguishable in every readable column from one written by a genuine public.cancel_booking call, because both take the actor from the same JWT claim. It also succeeded for a session whose staff row has is_active false, an account every RPC otherwise refuses.

The audit log is the evidence a dispute is assessed from. A log that any session can write to is not evidence of anything, so the exposure was of the same class as the log being deletable, which §10.6 and INV-14 already forbid at database level.

Only the owner may execute it now, which is every mutating RPC in the schema, since each of those runs with the definer''s privileges as well. No caller changes. Nothing above the database ever called it, and nothing should: R-14 makes writing the audit entry the job of the function performing the change, never of the caller.';


comment on function internal.current_staff_email() is
  'Read the email claim of the current session. Revoked from every client role by 20260908090000 alongside internal.write_audit, because it was carrying the same default PUBLIC grant.

Nothing breaks. Its two callers, internal.write_audit and public.claim_staff_invitation, both run with the definer''s privileges as the owner, and the owner keeps EXECUTE. It is a read-only predicate over a GUC and leaks nothing a session did not already present, so this is tidiness rather than a hole being closed. It is revoked anyway because a helper reachable by a client role is a helper somebody will one day compose into something that does matter.';


comment on function internal.require_management() is
  'Raise 42501 unless the session is an active management staff member. Revoked from every client role by 20260908090000.

It was carrying a default PUBLIC grant. Calling it directly achieves nothing: it returns void and raises, so it is an oracle that answers a question internal.is_management already answers for any caller holding EXECUTE on that. Its callers all run with the definer''s privileges as the owner and are unaffected.';


comment on function internal.set_updated_at() is
  'The updated_at trigger function. Revoked from every client role by 20260908090000.

Trigger functions are permission-checked when the trigger is created, not when it fires, so every trigger built on this keeps working with no grant at all. That was verified against this database before the revoke was written: an update by a role with no EXECUTE still moved updated_at. The grant was therefore doing nothing except letting a client role call a definer-privileged function by hand.';


comment on function internal.assert_management_remains() is
  'The constraint trigger that refuses to leave the venue with no active management account. Revoked from every client role by 20260908090000, for the same reason and with the same evidence as internal.set_updated_at: a trigger function needs no EXECUTE grant to fire.';


comment on function internal.normalise_email(text) is
  'Lower-case and trim an email into the value public.customers.identity_key and public.waitlist_entries.dedupe_key are generated from.

DELIBERATELY LEFT EXECUTABLE BY THE CLIENT ROLES when 20260908090000 revoked the rest of this schema''s default PUBLIC grants, and the reason is load-bearing rather than an oversight. Both of those columns are GENERATED ALWAYS AS ... STORED over this function, and PostgreSQL evaluates a generated column expression with the privileges of the role running the statement. Revoking it was tried against this database first and every insert into either table failed with "permission denied for function normalise_email". That is a stored generated column, not a trigger, and the two are checked differently.

It is also the one function here that is not privileged: it does not read a table, it does not run with the definer''s privileges, and it returns lower(btrim(x)). There is nothing to escalate. If it ever needs to be locked down, the generated columns have to stop calling it first.';


create or replace function internal.is_worker_session()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.current_setting('role', true), 'none')
         in ('none', '', 'service_role')
$$;

comment on function internal.is_worker_session() is
  'True when the session is one of the machine call sites SYSTEM.md Part 11 permits to act with no user identity, and false for every end-user request.

WHY THE ROLE GUC AND NOT current_user. PostgREST authenticates the request, then issues SET LOCAL ROLE for the role named in the verified JWT. Inside a function running with the definer''s privileges, current_user is the function owner and reports postgres for every caller, so it cannot distinguish anything. session_user is worse than useless here: on a hosted project it reports authenticator, and authenticator is a member of service_role, authenticated and the unauthenticated role alike, so pg_has_role(session_user, ''service_role'', ''MEMBER'') is true for every request that ever arrives. That would have looked like a fix and admitted everything.

current_setting(''role'') is the one identity that survives. It was measured, not assumed: a probe was called through a live PostgREST v16.1 with a signed service_role token, a signed authenticated token and no token at all, and it reported service_role, authenticated and the unauthenticated role respectively, while current_user reported postgres in all three.

THE none BRANCH IS THE MIGRATION AND SEED CALL SITE. A direct database connection that never issued SET ROLE reads the GUC as none. PostgREST always sets it, so none cannot be reached from an HTTP request; reaching it at all means holding the database password, which is a different and much larger compromise than holding an API key. That is the third permitted service-role call site, so admitting it transcribes the existing policy rather than widening it.';

revoke all on function internal.is_worker_session()
  from public, anon, authenticated;


create or replace function public.set_manual_booking_price(
  p_booking_id uuid,
  p_total_fils integer,
  p_reason     text
)
returns table (
  booking_id          uuid,
  reference           text,
  total_fils          integer,
  previous_total_fils integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reference  text;
  v_old_total  integer;
  v_status     public.booking_status;
  v_subtotal   integer;
  v_discount   integer;
  v_addons     integer;
  v_service    integer;
  v_tax        integer;
begin
  if not internal.has_permission('manual_price_change'::public.named_permission) then
    raise exception 'set_manual_booking_price: a manual price change needs perm:manual_price_change, and §6.4 requires it of Management too [docs/5 §2]'
      using errcode = 'WP031';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'set_manual_booking_price: a reason is required — §6.4 names permission, a reason and an audit entry together'
      using errcode = '22023';
  end if;

  if p_total_fils is null then
    raise exception 'set_manual_booking_price: p_total_fils is required, in integer fils [R-16]'
      using errcode = '22004';
  end if;

  if p_total_fils < 0 then
    raise exception 'set_manual_booking_price: p_total_fils must be zero or more, got %',
      p_total_fils
      using errcode = 'WP026';
  end if;

  select b.reference, b.status, b.total_fils,
         b.subtotal_fils, b.discount_fils, b.addons_fils,
         b.service_fee_fils, b.tax_fils
    into v_reference, v_status, v_old_total,
         v_subtotal, v_discount, v_addons,
         v_service, v_tax
    from public.bookings b
   where b.id = p_booking_id
   for update;

  if v_reference is null then
    raise exception 'set_manual_booking_price: no booking with id %', p_booking_id
      using errcode = 'P0002';
  end if;

  if v_status not in (
    'draft'::public.booking_status,
    'held'::public.booking_status,
    'awaiting_payment'::public.booking_status,
    'payment_failed'::public.booking_status,
    'awaiting_recovery'::public.booking_status,
    'confirmed'::public.booking_status,
    'checked_in'::public.booking_status,
    'completed'::public.booking_status,
    'no_show'::public.booking_status
  ) then
    raise exception 'set_manual_booking_price: a booking in % cannot be repriced [§4.4, §11.2]',
      v_status
      using errcode = 'WP014';
  end if;

  update public.bookings b
     set subtotal_fils    = p_total_fils,
         discount_fils    = 0,
         addons_fils      = 0,
         service_fee_fils = 0,
         tax_fils         = 0,
         total_fils       = p_total_fils
   where b.id = p_booking_id;

  perform internal.write_audit(
    'set_manual_booking_price',
    'public.bookings',
    p_booking_id::text,
    jsonb_build_object(
      'reference',        v_reference,
      'status',           v_status,
      'subtotal_fils',    v_subtotal,
      'discount_fils',    v_discount,
      'addons_fils',      v_addons,
      'service_fee_fils', v_service,
      'tax_fils',         v_tax,
      'total_fils',       v_old_total
    ),
    jsonb_build_object(
      'reference',        v_reference,
      'status',           v_status,
      'subtotal_fils',    p_total_fils,
      'discount_fils',    0,
      'addons_fils',      0,
      'service_fee_fils', 0,
      'tax_fils',         0,
      'total_fils',       p_total_fils
    ),
    p_reason
  );

  booking_id          := p_booking_id;
  reference           := v_reference;
  total_fils          := p_total_fils;
  previous_total_fils := v_old_total;
  return next;
end
$$;


create or replace function public.record_booking_payment(
  p_booking_id         uuid,
  p_method             public.payment_method,
  p_amount_fils        integer,
  p_provider_reference text,
  p_note               text,
  p_reason             text
)
returns table (
  payment_id       uuid,
  booking_id       uuid,
  payment_status   public.payment_status,
  payment_method   public.payment_method,
  amount_fils      integer,
  recorded_by      uuid,
  recorded_at      timestamptz,
  booking_comped   boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking_status public.booking_status;
  v_reference      text;
  v_was_comped     boolean;
  v_is_comped      boolean;
  v_taken          bigint;
  v_actor          uuid    := internal.current_staff_id();
  v_provider_ref   text    := nullif(btrim(coalesce(p_provider_reference, '')), '');
  v_note           text    := nullif(btrim(coalesce(p_note, '')), '');
  v_payment_id     uuid;
  v_at             timestamptz;
begin
  if not internal.is_staff() then
    raise exception 'record_booking_payment: an active staff session is required — §9.2 recording is a desk action with a named actor [INV-13]'
      using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'record_booking_payment: a reason is required — every manual change is audited with one [§3, INV-13]'
      using errcode = '22023';
  end if;

  if p_method is null then
    raise exception 'record_booking_payment: p_method is required — §8 reconciles on how the money was taken'
      using errcode = '22004';
  end if;

  if p_method = 'online'::public.payment_method then
    raise exception 'record_booking_payment: an online payment becomes paid on the signature-verified provider webhook and never by hand [§3, §8, INV-08]'
      using errcode = 'WP025';
  end if;

  if p_amount_fils is null then
    raise exception 'record_booking_payment: p_amount_fils is required, in integer fils [R-16]'
      using errcode = '22004';
  end if;

  if p_method = 'complimentary'::public.payment_method and p_amount_fils <> 0 then
    raise exception 'record_booking_payment: a complimentary payment is exactly zero and never counts as revenue, got % [§11.2, INV-20]',
      p_amount_fils
      using errcode = 'WP027';
  end if;

  if p_method <> 'complimentary'::public.payment_method and p_amount_fils <= 0 then
    raise exception 'record_booking_payment: p_amount_fils must be greater than zero for %, got %',
      p_method, p_amount_fils
      using errcode = 'WP026';
  end if;

  select b.status, b.reference, b.is_complimentary
    into v_booking_status, v_reference, v_was_comped
    from public.bookings b
   where b.id = p_booking_id
   for update;

  if v_booking_status is null then
    raise exception 'record_booking_payment: no booking with id %', p_booking_id
      using errcode = 'P0002';
  end if;

  if v_was_comped and p_amount_fils <> 0 then
    raise exception 'record_booking_payment: booking % is complimentary and a complimentary booking holds no money, so % fils cannot be recorded against it [§11.2, INV-20]',
      v_reference, p_amount_fils
      using errcode = 'WP033';
  end if;

  if p_method = 'complimentary'::public.payment_method and not v_was_comped then
    select coalesce(sum(p.amount_fils), 0)
      into v_taken
      from public.payments p
     where p.booking_id = p_booking_id
       and p.status in (
         'paid'::public.payment_status,
         'partially_refunded'::public.payment_status
       );

    if v_taken > 0 then
      raise exception 'record_booking_payment: booking % has taken % fils that has not been given back, so it cannot become complimentary — refund it first [§11.2, INV-20]',
        v_reference, v_taken
        using errcode = 'WP034';
    end if;
  end if;

  v_is_comped := v_was_comped
                 or p_method = 'complimentary'::public.payment_method;

  insert into public.payments as p (
    booking_id,
    status,
    method,
    amount_fils,
    provider_reference,
    note,
    recorded_by
  )
  values (
    p_booking_id,
    'paid'::public.payment_status,
    p_method,
    p_amount_fils,
    v_provider_ref,
    v_note,
    v_actor
  )
  returning p.id, p.recorded_at
       into v_payment_id, v_at;

  if v_is_comped and not v_was_comped then
    update public.bookings b
       set is_complimentary = true
     where b.id = p_booking_id;
  end if;

  perform internal.write_audit(
    'record_booking_payment',
    'public.payments',
    v_payment_id::text,
    null::jsonb,
    jsonb_build_object(
      'booking_id',         p_booking_id,
      'booking_reference',  v_reference,
      'booking_status',     v_booking_status,
      'status',             'paid',
      'method',             p_method,
      'amount_fils',        p_amount_fils,
      'provider_reference', v_provider_ref,
      'note',               v_note,
      'recorded_by',        v_actor,
      'recorded_at',        v_at
    ),
    p_reason
  );

  if v_is_comped and not v_was_comped then
    perform internal.write_audit(
      'record_booking_payment',
      'public.bookings',
      p_booking_id::text,
      jsonb_build_object('is_complimentary', v_was_comped),
      jsonb_build_object(
        'is_complimentary', true,
        'reference',        v_reference,
        'payment_id',       v_payment_id
      ),
      p_reason
    );
  end if;

  payment_id     := v_payment_id;
  booking_id     := p_booking_id;
  payment_status := 'paid'::public.payment_status;
  payment_method := p_method;
  amount_fils    := p_amount_fils;
  recorded_by    := v_actor;
  recorded_at    := v_at;
  booking_comped := v_is_comped;
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
      'cleaning_buffer_minutes', v_buffer,
      'buffer_is_configured',    v_default_buffer is null or v_buffer = v_default_buffer,
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


create or replace function public.open_alert(
  p_kind      public.alert_kind,
  p_severity  public.alert_severity,
  p_entity    text,
  p_entity_id text,
  p_detail    jsonb
)
returns table (
  alert_id  uuid,
  kind      public.alert_kind,
  severity  public.alert_severity,
  entity    text,
  entity_id text,
  opened_at timestamptz,
  is_new    boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_entity    text := nullif(btrim(coalesce(p_entity, '')), '');
  v_entity_id text := nullif(btrim(coalesce(p_entity_id, '')), '');
  v_alert_id  uuid;
  v_opened    timestamptz;
  v_new       boolean := false;
begin
  if not internal.is_staff() and not internal.is_worker_session() then
    if internal.current_staff_id() is not null then
      raise exception 'open_alert: this account is not an active staff member'
        using errcode = 'WP008';
    end if;
    raise exception 'open_alert: this session carries no staff identity and is not the worker session §9.3 alert scans run as'
      using errcode = 'WP036';
  end if;

  if p_kind is null or p_severity is null then
    raise exception 'open_alert: p_kind and p_severity are both required — the grading lives in src/lib/domain/alerts and is stated by the caller'
      using errcode = '22004';
  end if;

  if v_entity is null or v_entity_id is null then
    raise exception 'open_alert: p_entity and p_entity_id are both required — they are two thirds of the key reconcileAlerts opens and resolves on'
      using errcode = '22004';
  end if;

  if v_entity !~ '^[a-z_.]+$' then
    raise exception 'open_alert: p_entity must be a schema-qualified lower-case table name, got %',
      v_entity
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('wellplace.alert:' || p_kind::text || ':' || v_entity || ':' || v_entity_id)::bigint
  );

  select a.id, a.opened_at
    into v_alert_id, v_opened
    from public.alerts a
   where a.kind = p_kind
     and a.entity = v_entity
     and a.entity_id = v_entity_id
     and a.resolved_at is null
   limit 1;

  if v_alert_id is null then
    insert into public.alerts as a (kind, severity, entity, entity_id, detail)
    values (p_kind, p_severity, v_entity, v_entity_id, p_detail)
    returning a.id, a.opened_at into v_alert_id, v_opened;

    v_new := true;

    perform internal.write_audit(
      'open_alert',
      'public.alerts',
      v_alert_id::text,
      null::jsonb,
      jsonb_build_object(
        'kind',      p_kind,
        'severity',  p_severity,
        'entity',    v_entity,
        'entity_id', v_entity_id,
        'detail',    p_detail
      ),
      'Operational alert raised [§9.3]'
    );
  end if;

  alert_id  := v_alert_id;
  kind      := p_kind;
  severity  := p_severity;
  entity    := v_entity;
  entity_id := v_entity_id;
  opened_at := v_opened;
  is_new    := v_new;
  return next;
end
$$;


create or replace function public.resolve_alert(
  p_alert_id uuid,
  p_note     text
)
returns table (
  alert_id    uuid,
  kind        public.alert_kind,
  resolved_at timestamptz,
  resolved_by uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_kind      public.alert_kind;
  v_resolved  timestamptz;
  v_entity    text;
  v_entity_id text;
  v_note      text := nullif(btrim(coalesce(p_note, '')), '');
  v_actor     uuid := internal.current_staff_id();
  v_at        timestamptz := clock_timestamp();
begin
  if not internal.is_staff() and not internal.is_worker_session() then
    if v_actor is not null then
      raise exception 'resolve_alert: this account is not an active staff member'
        using errcode = 'WP008';
    end if;
    raise exception 'resolve_alert: this session carries no staff identity and is not the worker session §9.3 alert scans run as'
      using errcode = 'WP036';
  end if;

  select a.kind, a.resolved_at, a.entity, a.entity_id
    into v_kind, v_resolved, v_entity, v_entity_id
    from public.alerts a
   where a.id = p_alert_id
   for update;

  if v_kind is null then
    raise exception 'resolve_alert: no alert with id %', p_alert_id
      using errcode = 'P0002';
  end if;

  if v_resolved is not null then
    raise exception 'resolve_alert: alert % was already resolved at % [§9.3]',
      p_alert_id, v_resolved
      using errcode = 'WP023';
  end if;

  update public.alerts a
     set resolved_at     = v_at,
         resolved_by     = v_actor,
         resolution_note = v_note
   where a.id = p_alert_id;

  perform internal.write_audit(
    'resolve_alert',
    'public.alerts',
    p_alert_id::text,
    jsonb_build_object('resolved_at', null),
    jsonb_build_object(
      'kind',            v_kind,
      'entity',          v_entity,
      'entity_id',       v_entity_id,
      'resolved_at',     v_at,
      'resolved_by',     v_actor,
      'resolution_note', v_note
    ),
    coalesce(v_note, 'Operational alert resolved [§9.3]')
  );

  alert_id    := p_alert_id;
  kind        := v_kind;
  resolved_at := v_at;
  resolved_by := v_actor;
  return next;
end
$$;


create or replace function public.queue_message(
  p_template_key text,
  p_channel      public.message_channel,
  p_booking_id   uuid,
  p_customer_id  uuid,
  p_to_address   text,
  p_subject      text,
  p_body         text
)
returns table (
  message_id   uuid,
  template_key text,
  channel      public.message_channel,
  status       public.message_status,
  is_marketing boolean,
  to_address   text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key        text := nullif(btrim(coalesce(p_template_key, '')), '');
  v_address    text := nullif(btrim(coalesce(p_to_address, '')), '');
  v_subject    text := nullif(btrim(coalesce(p_subject, '')), '');
  v_body       text := nullif(p_body, '');
  v_active     boolean;
  v_marketing  boolean;
  v_message_id uuid;
begin
  if not internal.is_staff() and not internal.is_worker_session() then
    if internal.current_staff_id() is not null then
      raise exception 'queue_message: this account is not an active staff member'
        using errcode = 'WP008';
    end if;
    raise exception 'queue_message: this session carries no staff identity and is not the worker session §12 dispatch runs as'
      using errcode = 'WP036';
  end if;

  if v_key is null or p_channel is null then
    raise exception 'queue_message: p_template_key and p_channel are both required [§12]'
      using errcode = '22004';
  end if;

  if v_address is null then
    raise exception 'queue_message: p_to_address is required — a message with no destination is not a queued message [§12]'
      using errcode = '22004';
  end if;

  select t.is_active
    into v_active
    from public.message_templates t
   where t.key = v_key;

  if v_active is not null and not v_active then
    raise exception 'queue_message: template % is switched off and Management owns that switch [§12, §10.7]',
      v_key
      using errcode = 'WP021';
  end if;

  if p_channel = 'email'::public.message_channel
     and v_address not like '%_@_%._%' then
    raise exception 'queue_message: % is not an email address and the channel is email [§12]',
      v_address
      using errcode = '22023';
  end if;

  if p_channel = 'whatsapp'::public.message_channel
     and v_address !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'queue_message: % is not an E.164 mobile number and the channel is whatsapp [§12]',
      v_address
      using errcode = '22023';
  end if;

  if p_channel = 'whatsapp'::public.message_channel and v_subject is not null then
    raise exception 'queue_message: a WhatsApp message has no subject line — send it in the body or use the email channel [§12]'
      using errcode = '22023';
  end if;

  v_marketing := v_key = 'review_request';

  insert into public.messages (
    template_key, channel, status, booking_id, customer_id,
    to_address, subject, body, is_marketing
  )
  values (
    v_key,
    p_channel,
    'queued'::public.message_status,
    p_booking_id,
    p_customer_id,
    v_address,
    v_subject,
    v_body,
    v_marketing
  )
  returning id into v_message_id;

  perform internal.write_audit(
    'queue_message',
    'public.messages',
    v_message_id::text,
    null::jsonb,
    jsonb_build_object(
      'template_key', v_key,
      'channel',      p_channel,
      'status',       'queued',
      'booking_id',   p_booking_id,
      'customer_id',  p_customer_id,
      'to_address',   v_address,
      'is_marketing', v_marketing
    ),
    'Message queued [§12, §9.2]'
  );

  message_id   := v_message_id;
  template_key := v_key;
  channel      := p_channel;
  status       := 'queued'::public.message_status;
  is_marketing := v_marketing;
  to_address   := v_address;
  return next;
end
$$;


create or replace function public.record_message_attempt(
  p_message_id          uuid,
  p_status              public.message_status,
  p_provider_message_id text,
  p_error               text
)
returns table (
  message_id      uuid,
  status          public.message_status,
  attempt_count   integer,
  last_attempt_at timestamptz,
  sent_at         timestamptz,
  failed_at       timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old_status   public.message_status;
  v_old_count    integer;
  v_old_provider text;
  v_provider     text := nullif(btrim(coalesce(p_provider_message_id, '')), '');
  v_error        text := nullif(btrim(coalesce(p_error, '')), '');
  v_at           timestamptz := clock_timestamp();
  v_is_attempt   boolean;
  v_count        integer;
  v_last         timestamptz;
  v_sent         timestamptz;
  v_failed       timestamptz;
begin
  if not internal.is_staff() and not internal.is_worker_session() then
    if internal.current_staff_id() is not null then
      raise exception 'record_message_attempt: this account is not an active staff member'
        using errcode = 'WP008';
    end if;
    raise exception 'record_message_attempt: this session carries no staff identity and is not the worker session §12 dispatch runs as'
      using errcode = 'WP036';
  end if;

  if p_status is null then
    raise exception 'record_message_attempt: p_status must not be null'
      using errcode = '22004';
  end if;

  select m.status, m.attempt_count, m.last_attempt_at, m.provider_message_id
    into v_old_status, v_old_count, v_last, v_old_provider
    from public.messages m
   where m.id = p_message_id
   for update;

  if v_old_status is null then
    raise exception 'record_message_attempt: no message with id %', p_message_id
      using errcode = 'P0002';
  end if;

  if v_old_status = 'cancelled'::public.message_status then
    raise exception 'record_message_attempt: message % was cancelled and is not sent again [§12, §11.5]',
      p_message_id
      using errcode = 'WP022';
  end if;

  v_is_attempt := p_status in (
    'sent'::public.message_status,
    'failed'::public.message_status
  );

  v_count := v_old_count + case when v_is_attempt then 1 else 0 end;
  v_last  := case when v_is_attempt then v_at else v_last end;

  v_sent   := case when p_status = 'sent'::public.message_status   then v_at end;
  v_failed := case when p_status = 'failed'::public.message_status then v_at end;

  update public.messages m
     set status              = p_status,
         attempt_count       = v_count,
         last_attempt_at     = v_last,
         sent_at             = v_sent,
         failed_at           = v_failed,
         error               = v_error,
         provider_message_id = coalesce(v_provider, v_old_provider)
   where m.id = p_message_id;

  perform internal.write_audit(
    'record_message_attempt',
    'public.messages',
    p_message_id::text,
    jsonb_build_object('status', v_old_status, 'attempt_count', v_old_count),
    jsonb_build_object(
      'status',              p_status,
      'attempt_count',       v_count,
      'last_attempt_at',     v_last,
      'sent_at',             v_sent,
      'failed_at',           v_failed,
      'error',               v_error,
      'provider_message_id', v_provider
    ),
    coalesce(v_error, 'Delivery attempt recorded [§12, §11.5]')
  );

  message_id      := p_message_id;
  status          := p_status;
  attempt_count   := v_count;
  last_attempt_at := v_last;
  sent_at         := v_sent;
  failed_at       := v_failed;
  return next;
end
$$;


comment on function public.set_manual_booking_price(uuid, integer, text) is
  'Set the price of one booking by hand [§6.4]. Permission, a reason and an audit entry, all three, and from 20260908090000 a status gate and an honest breakdown as well.

WHAT WAS WRONG. It updated total_fils alone. The five component columns kept the figures the booking was sold at, so a booking could read subtotal 100000, add-ons 5000, service fee 6300, tax 5300 while total_fils said 50000. INV-21 says reporting sums stored values and never recomputes a price; two contradictory stored answers make that guarantee meaningless, because which one is right depends on which column a report happens to read. It also had no status gate at all, so a cancelled booking could be repriced.

THE BREAKDOWN RULE, AND WHY THIS ONE. The whole new figure is written to subtotal_fils and the other four are set to zero, so the components sum to total_fils exactly. The alternative considered was rescaling the old components proportionally, and it was rejected for two reasons. Integer fils do not divide evenly, so a rescale needs a remainder rule and would still land a fils or two out. More seriously, a rescale would invent a tax_fils and a service_fee_fils that nobody agreed: tax.vat_percent is unset and the VAT treatment is Q-4, so a fabricated tax line on a receipt is not a rounding question. A hand-set figure is not a computed breakdown and the honest way to store it is as one line. The complete prior breakdown is written to the audit entry''s old value, so nothing is lost, and INV-19''s service-fee rule is unaffected because a manual price is not a fee calculation.

THE STATUSES THAT MAY BE REPRICED are draft, held, awaiting_payment, payment_failed, awaiting_recovery, confirmed, checked_in, completed and no_show. All nine are bookings where money can still move: the early ones have not been charged, the live ones are at the desk, a completed visit is invoiced and adjusted afterwards which is exactly when an overrun or a goodwill reduction gets agreed, and a no_show carries whatever rules.no_show turns out to be, which has nowhere else to live today.

REFUSED WITH WP014: hold_expired, rescheduled, cancelled and abandoned. Those four are bookings nobody will ever charge, and §11.2 and §11.3 have already counted them as such. Repricing one rewrites a reported figure against a row whose whole meaning is that no sale happened. Cancelled is the case the adversary pass reproduced.

The check constraint bookings_money_non_negative is the only thing the database asserts about these six columns; A2 deliberately added none asserting the sum, because a booking can legitimately be written before every line is known. This function is therefore the thing responsible for leaving them consistent, and that responsibility does not transfer to the caller.';


comment on function public.record_booking_payment(uuid, public.payment_method, integer, text, text, text) is
  'Record a payment taken at the desk [§9.2, §8]. From 20260908090000 it also refuses the two ways a complimentary booking could come to hold money, which INV-20 forbids.

WHAT WAS WRONG. The zero-amount rule was checked against the payment METHOD and never against the BOOKING. Both directions were reproduced. A booking created with source complimentary, so is_complimentary true and total_fils zero, accepted a cash payment of 95000 fils. And a paid walk-in holding 80000 fils in cash accepted a complimentary payment of zero, which flipped is_complimentary true while the 80000 stayed paid. Either way one number is wrong: INV-20 requires complimentary bookings to appear separately and never count as revenue, so whichever way §11.2 is written, a comped booking holding money is either revenue that is not counted or a comp that is.

WP033 refuses a non-zero payment against a booking already flagged complimentary. A zero complimentary payment against one is still allowed, because that is the ordinary way a comp is recorded.

WP034 refuses flipping a booking to complimentary while it holds money that has not been given back. The test sums amount_fils over payments in paid and partially_refunded, the two states that still hold something; a fully_refunded payment has given everything back and comping afterwards is coherent. The remedy the message names is the correct one: refund it through public.record_refund, which is Management-only and audited, and then comp it.

Neither check invents a rule about what a comp is. bookings_complimentary_source_is_flagged already forces the flag on a complimentary source; these two keep the money side of the same statement true.';


comment on function public.create_reception_booking(
  public.booking_source, public.salutation, text, text, text, date, text, text,
  timestamptz, integer, integer, integer, integer[], jsonb, text, text, jsonb,
  boolean, jsonb, text
) is
  'The §9.2 desk booking: walk-in, telephone, manual and complimentary. One transaction, one typed row, one audit entry [R-14, INV-13]. p_source refuses online, because §6.1''s guest flow holds a suite first and pays before it has a booking - a different sequence, not a variant of this one.

THE CLEANING BUFFER IS NO LONGER WHATEVER THE CALLER SAYS. Changed by 20260908090000. p_buffer_minutes used to be taken at face value and checked only for being between 0 and one day, so a plain reception session could create a booking with a zero buffer while cleaning.buffer_minutes was 20. It was reproduced: two bookings on the same suite at 10:00 to 12:00 and 12:00 to 14:00, back to back, no gap to clean in. §7.1 says the buffer applies to online, Reception, walk-in, manual and complimentary bookings alike, and that was the one creation path where it did not.

Three rules now. A null p_buffer_minutes reads cleaning.buffer_minutes through internal.setting_integer, so the ordinary call needs to know nothing [R-05]. A value equal to the configured default is accepted from anyone. A value that DIFFERS from the configured default needs perm:override_suite_allocation and raises WP035 without it. The range check survives underneath all three.

The signature is unchanged, deliberately. src/lib/db/rpc.ts sends twenty named arguments and src/lib/services/reception-booking-service.ts already fills p_buffer_minutes from the same setting, so the console path sends a value equal to the default and is unaffected.

WHEN cleaning.buffer_minutes IS UNSET there is no default to differ from, so any supplied value is accepted and a null raises WP006 naming the gap. That follows internal.setting_integer''s documented contract - an unset setting is not enforced - and it keeps SYSTEM.md Part 8''s rule that a missing configuration value must not take a screen offline. The audit entry carries buffer_is_configured so §11 can tell a default-buffer booking from an overridden one without re-deriving it.

WHICH PERMISSION, AND AN INCONSISTENCY WORTH SETTLING. perm:override_suite_allocation is the gate here. public.override_booking_buffer, which changes the very same value on an existing booking, requires the management ROLE instead and carries its own note saying that choice needs a client decision. So the same number is guarded two different ways depending on whether the booking exists yet. Both are defensible readings of §7.1''s bare word "authorised" and neither is a transcription of docs/5, which names no permission for a buffer. They should be made one thing once the client answers.

The status starts at confirmed, not held or awaiting_payment. The guest is standing at the desk, and §9.2 treats the four creation types as bookings that already exist rather than as offers awaiting acceptance; §8''s payment states then run beside the booking rather than gating it, which is what lets Reception take payment after the visit or comp it entirely. src/lib/domain/booking''s statusAfter agrees: confirmed is where check_in, reschedule, cancel and no_show all become legal, and every one of those is a §9.2 desk action.

Allocation goes through internal.allocate_suite and nothing here inserts into public.suite_occupancy. Read that function''s own documentation before changing anything about locking or ordering. The venue-wide advisory lock is taken here as well, before the customer row is locked, so that this function and public.extend_booking - which must sweep expired holds before it can safely lock anything - can never take their locks in opposite orders.

The customer is found or created on internal.normalise_email, the identity key of public.customers [Q-1, ASSUMED]. A concurrent first booking for the same person is caught as a unique violation and re-read rather than duplicated. Existing details are NOT overwritten: correcting a customer record is perm:correct_customer_record and belongs to its own audited function. The one exception is a null date of birth, which is completed rather than corrected - A1 left the column nullable because Reception can hold a contact before any booking exists, and stated that presence would be enforced by the function that creates a booking. That is here: WP011 with no date of birth at all, and WP011 again if the booker is under booking.booker_min_age.

Every business number is read from public.settings through internal.setting_integer and none is written as a literal [R-05, INV-16]. booking.guests_min, booking.guests_max, booking.child_min_age, booking.child_max_age and booking.booker_min_age all raise WP011 naming the setting that refused. An unset setting is not enforced, which SYSTEM.md Part 8 requires; the registry default is applied above the database. booking.durations_hours is deliberately NOT enforced - the selectable durations are the §6.1 guest grid, and forcing them onto a telephone booking would make Reception unable to sell what a guest asked for.

p_price is stored verbatim, six integer fils columns, and no arithmetic is performed on it here. §11 sums stored values and never recomputes a price [INV-21], and the single pricing implementation lives in src/lib/domain/pricing. A complimentary source forces is_complimentary so §11.2 can keep those bookings out of revenue [INV-20].

p_addons is a JSON array of {"addon_id","quantity"} and each line snapshots the name and unit price standing in public.addons at this moment. p_acceptance is a JSON array of {"document_slug","document_version","checkbox_text"}, one row per document the single required tick box names [§6.3, Q-14], carrying the literal sentence rather than a key to it. Acceptance is not made mandatory here [OUR CHOICE]: a telephone booking can record it separately, and refusing the booking would put an evidence rule in the way of taking the money. The boundary layer requires it for every surface that shows a tick box.

A booker date of birth is compared against current_date, the same basis public.waitlist_leads uses for its calculated age. Storage is UTC [INV-24], so for the four hours after Dubai midnight the gate is one day conservative - it can refuse someone on the morning of their eighteenth birthday and never admits someone a day early. The venue is closed in that window under every set of hours supplied so far.

Returns suite_number, which INV-01 forbids reaching a guest. That is safe only because this function is granted to authenticated and service_role and never to the unauthenticated role, and because §1.1 puts suite numbers on the Reception surface by design. Nothing in src/app/(site) may call it.';


comment on function public.open_alert(public.alert_kind, public.alert_severity, text, text, jsonb) is
  'Raise an operational alert, idempotently on kind plus entity plus entity_id [§9.3].

THE SESSION GATE WAS WIDENED THE WRONG WAY AND WAS NARROWED BY 20260908090000. A7 wrote it as "if current_staff_id() is not null and current_staff_role() is null then refuse", which refuses a forged staff identity but admits a session presenting NO identity at all. A caller holding a valid token for the authenticated role with no sub claim passed straight through, because current_staff_id() was null and the guard never fired.

A7''s reason for not simply requiring internal.is_staff() was sound and is preserved: §9.3 alerts are raised by a scan running with no user session, one of the permitted service-role call sites, so a staff-only gate would mean no alert is ever raised in production. That failure mode is worse than the gap, so the fix admits the worker EXPLICITLY instead of admitting the absence of an identity. internal.is_worker_session() is the test, and its own documentation explains why current_setting(''role'') is the only identity that survives into a function running with the definer''s privileges, and why session_user and pg_has_role would have admitted every request.

WP008 keeps its exact meaning - a session presenting a staff id that is not an active staff member - so nothing reading that code changes. WP036 is the new refusal: no staff identity, and not the worker either.

Idempotence is unchanged. Opening an alert that is already open is a no-op returning is_new false, never a unique violation, because reconcileAlerts re-runs every minute and an error would abandon every other alert in the same pass. alerts_open_unique_idx is partial on resolved_at being null, so a recurrence after a resolution is a new row with its own opened_at, which is what §11.5 counts.';


comment on function public.resolve_alert(uuid, text) is
  'Close an open operational alert and record who closed it [§9.3]. WP023 refuses a second close, because §11.5 reports how long an alert stayed open and a second close would overwrite the answer.

The session gate was narrowed by 20260908090000 in the same way and for the same reasons as public.open_alert - read that one. A session with no staff identity now raises WP036 rather than being admitted; the worker that runs the scan is admitted explicitly through internal.is_worker_session(); WP008 still means a presented identity that is not an active staff member.

resolved_by is internal.current_staff_id() and is legitimately null when the scan resolves an alert whose condition simply cleared. That is the difference between "a person closed this" and "it stopped being true", and §11.5 needs both.';


comment on function public.queue_message(text, public.message_channel, uuid, uuid, text, text, text) is
  'Put one message on the queue [§12]. The template switch, the channel and the address are validated here; delivery is somebody else''s problem and is recorded by public.record_message_attempt.

The session gate was narrowed by 20260908090000 in the same way and for the same reasons as public.open_alert - read that one. §12 messages are queued by scheduled work as well as by Reception, so the worker is admitted explicitly through internal.is_worker_session() rather than by admitting a session with no identity at all. WP036 is the new refusal and WP008 keeps its meaning.

is_marketing is set here, not by the caller, so that INV-17 holds structurally: disabling marketing communication must not stop booking messages, and a caller that could label its own message could get that wrong in either direction.';


comment on function public.record_message_attempt(uuid, public.message_status, text, text) is
  'Record what happened when a queued message was sent [§12, §11.5]. Attempts and errors are stored so §11.5 can report on delivery rather than assume it.

The session gate was narrowed by 20260908090000 in the same way and for the same reasons as public.open_alert - read that one. This is the most worker-shaped of the four, since a delivery attempt is almost always made by a queue worker with no user session, so admitting service_role explicitly rather than admitting an absent identity is exactly the distinction that was missing. WP036 is the new refusal and WP008 keeps its meaning.

A cancelled message is never attempted again, WP022. attempt_count only advances for sent and failed, because those are the two outcomes that cost a provider call.';


revoke all on function public.set_manual_booking_price(uuid, integer, text) from public;
revoke all on function public.record_booking_payment(
  uuid, public.payment_method, integer, text, text, text
) from public;
revoke all on function public.create_reception_booking(
  public.booking_source, public.salutation, text, text, text, date, text, text,
  timestamptz, integer, integer, integer, integer[], jsonb, text, text, jsonb,
  boolean, jsonb, text
) from public;
revoke all on function public.open_alert(
  public.alert_kind, public.alert_severity, text, text, jsonb
) from public;
revoke all on function public.resolve_alert(uuid, text) from public;
revoke all on function public.queue_message(
  text, public.message_channel, uuid, uuid, text, text, text
) from public;
revoke all on function public.record_message_attempt(
  uuid, public.message_status, text, text
) from public;

grant execute on function public.set_manual_booking_price(uuid, integer, text)
  to authenticated, service_role;
grant execute on function public.record_booking_payment(
  uuid, public.payment_method, integer, text, text, text
) to authenticated, service_role;
grant execute on function public.create_reception_booking(
  public.booking_source, public.salutation, text, text, text, date, text, text,
  timestamptz, integer, integer, integer, integer[], jsonb, text, text, jsonb,
  boolean, jsonb, text
) to authenticated, service_role;
grant execute on function public.open_alert(
  public.alert_kind, public.alert_severity, text, text, jsonb
) to authenticated, service_role;
grant execute on function public.resolve_alert(uuid, text)
  to authenticated, service_role;
grant execute on function public.queue_message(
  text, public.message_channel, uuid, uuid, text, text, text
) to authenticated, service_role;
grant execute on function public.record_message_attempt(
  uuid, public.message_status, text, text
) to authenticated, service_role;
