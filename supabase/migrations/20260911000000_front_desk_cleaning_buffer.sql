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
  if not internal.is_staff() then
    raise exception 'override_booking_buffer: an active staff session is required [§9.2, INV-13]'
      using errcode = '42501';
  end if;

  if not internal.has_permission('override_suite_allocation'::public.named_permission) then
    raise exception 'override_booking_buffer: changing the cleaning buffer of an existing booking needs perm:override_suite_allocation [§7.1, §7.2]'
      using errcode = 'WP035';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'override_booking_buffer: a reason is required — §7.1 makes the override an audited change [§3, INV-13]'
      using errcode = '22023';
  end if;

  if p_buffer_minutes is null or p_buffer_minutes < 0 or p_buffer_minutes > 240 then
    raise exception 'override_booking_buffer: p_buffer_minutes must be between 0 and 240 minutes, got %',
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
    'checked_in'::public.booking_status,
    'completed'::public.booking_status
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

  if v_status = 'completed'::public.booking_status
     and upper(v_old_blocked) <= clock_timestamp() then
    raise exception 'This cleaning buffer has already ended. Set the suite to Not ready if more cleaning is needed.'
      using errcode = 'WP014';
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

