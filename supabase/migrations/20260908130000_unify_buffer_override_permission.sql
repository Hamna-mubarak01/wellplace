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


comment on function public.override_booking_buffer(uuid, integer, text) is
  'Change the cleaning buffer of one booking [§7.1]. "An authorised single-booking override requires a conflict check and audit entry", and this is both: blocked_period is recomputed from the stored experience_period, the later claims on that suite are checked, the exclusion constraint stays the backstop, and the change is audited with the old and new buffer.

The value is written to the occupancy row AND to bookings.cleaning_buffer_minutes, which must not be allowed to disagree. The booking column is what a reschedule re-applies and what a receipt explains; the occupancy column is what the constraint enforces.

THE GUARD IS perm:override_suite_allocation, AND THAT IS NEW [ASSUMED]. Until migration 20260908130000 this function required the management ROLE while public.create_reception_booking gated the very same number on perm:override_suite_allocation and raised WP035 - two guards on one value, disagreeing according to whether the booking existed yet. They are now one thing. perm:override_suite_allocation is the only named permission doc 1 attaches to a suite-level override, and §7.1''s bare word "authorised" names no permission at all, so this is the nearest thing to a transcription available; docs/5 §2 names no permission for a buffer. It is tagged [ASSUMED] rather than [§7.1] for that reason and it is SYSTEM.md Q-19 - the client answer replaces both guards in one migration.

The direction is deliberate. It WIDENS the reach of a receptionist who holds the grant, which is where the need arises - at the desk, mid-turnaround - and Q-19 records that widening later costs nothing while narrowing after Reception has been trained on it does not undo the exposure. It also NARROWS management-without-the-grant, which is not an oversight: SYSTEM.md 11.1 reads §7.2 as requiring the permission from Management too, and public.create_reception_booking already behaved that way.

One asymmetry with public.create_reception_booking survives on purpose. There, a buffer equal to the configured cleaning.buffer_minutes is accepted from anyone, because storing the default on a new row is not an override of anything. Here, every call moves the blocked_period of a live claim on a suite, so every call needs the permission - including one that happens to restore the default.

Only a booking holding a live claim can have its buffer overridden; anything else raises WP014. WP015 means the new buffer would reach a later claim on the same suite. WP035 means the caller holds no override permission.';


revoke all on function public.override_booking_buffer(uuid, integer, text) from public;

grant execute on function public.override_booking_buffer(uuid, integer, text)
  to authenticated, service_role;
