drop function if exists public.reschedule_booking(uuid, timestamptz, integer, text);

create function public.reschedule_booking(
  p_booking_id       uuid,
  p_starts_at        timestamptz,
  p_reason           text,
  p_duration_hours   integer default null,
  p_duration_minutes integer default null
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
  v_source        text;
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

  if p_duration_minutes is not null
     and (p_duration_minutes <= 0 or p_duration_minutes > 24 * 60 * 366) then
    raise exception 'reschedule_booking: p_duration_minutes must be between 1 and one year, got %',
      p_duration_minutes
      using errcode = 'WP005';
  end if;

  if p_duration_hours is not null
     and (p_duration_hours <= 0 or p_duration_hours > 24 * 366) then
    raise exception 'reschedule_booking: p_duration_hours must be between 1 and one year, got %',
      p_duration_hours
      using errcode = 'WP005';
  end if;

  if p_duration_minutes is not null
     and p_duration_hours is not null
     and p_duration_hours * 60 <> p_duration_minutes then
    raise exception 'reschedule_booking: p_duration_hours is % and p_duration_minutes is %, and they describe different lengths — send the exact minutes alone [§7.6]',
      p_duration_hours, p_duration_minutes
      using errcode = 'WP054';
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

  if p_duration_minutes is not null then
    v_duration := p_duration_minutes * interval '1 minute';
    v_source   := 'minutes';
  elsif p_duration_hours is not null then
    v_duration := p_duration_hours * interval '1 hour';
    v_source   := 'hours';
  else
    v_duration := upper(v_old_period) - lower(v_old_period);
    v_source   := 'preserved';
  end if;

  v_experience := tstzrange(p_starts_at, p_starts_at + v_duration, '[)');

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
      'experience_from',  lower(v_old_period),
      'experience_to',    upper(v_old_period),
      'duration_minutes',
        (extract(epoch from (upper(v_old_period) - lower(v_old_period))) / 60)::integer,
      'suite_id',         v_old_suite,
      'occupancy_id',     v_old_occupancy
    ),
    jsonb_build_object(
      'reference',             v_reference,
      'experience_from',       lower(v_experience),
      'experience_to',         upper(v_experience),
      'duration_minutes',      (extract(epoch from v_duration) / 60)::integer,
      'duration_source',       v_source,
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


comment on function public.reschedule_booking(uuid, timestamptz, text, integer, integer) is
  'Move a booking to a new time, atomically [§7.6, §3, INV-12]. The §16.1 acceptance test is "failed atomic rescheduling does not lose the old booking", and the property is structural rather than careful: the work is done by internal.reclaim_booking_window, which secures the new claim before releasing the old one and, on the retry path, undoes its own release inside a subtransaction before returning nothing. Read that function before changing this one.

A RESCHEDULE MUST NOT CHANGE HOW LONG A BOOKING IS. Until 20260908190000 the only way to say how long was p_duration_hours, an integer number of WHOLE HOURS, and a booking is not always a whole number of hours: §7.6 lets Reception extend one by any number of minutes, so a 2h30m booking is reachable in ordinary use. Rescheduling it through a caller that rounded to 3 silently sold the guest another thirty minutes, and rounding to 2 silently took thirty away. public.move_booking never had the defect - it carries the interval across as upper(experience_period) - lower(experience_period) - and public.extend_booking never had it either, because it was always denominated in minutes. This was the one path that rebuilt a length out of a coarser unit than the one the length is stored in.

THREE WAYS TO SAY HOW LONG, AND THE SAFEST IS THE SIMPLEST. p_duration_minutes wins when supplied and is the parameter every caller should move to. p_duration_hours alone is the pre-existing behaviour, unchanged in meaning. BOTH OMITTED PRESERVES THE BOOKING''S CURRENT LENGTH EXACTLY, which is what public.move_booking does and what §9.2 means by moving a booking: the §9.2 drag on the Reception timeline should send no duration at all, and a caller that forgets to send one now changes nothing about the length rather than inventing one.

BOTH DURATIONS ARE DEFAULTED AND p_reason IS NOT, WHICH IS WHY THE ARGUMENT ORDER CHANGED. PostgREST resolves a function by the SET OF ARGUMENT NAMES supplied, so a parameter with no default can never be omitted by a caller through the API - leaving p_duration_hours third and mandatory would have made the preserving call unreachable from the application and reachable only from SQL. Postgres requires every parameter after a defaulted one to be defaulted too, so p_reason moved ahead of both. It stays mandatory in the generated types, which is the point: §3 and INV-13 want a reason on every manual change, and an optional one in the type would be a quiet weakening of that. Argument ORDER is not part of the contract with the application - every call from src/lib/db/rpc.ts is by name - so only this repository''s own SQL callers moved.

WP054 IS THE DEFECT MADE LOUD. Supplying both parameters with different lengths is refused rather than silently resolved, because a caller that sends 3 hours and 150 minutes in the same call does not know how long the booking is, and picking one of its two answers would reproduce exactly the class of bug this migration exists to end. Supplying both in agreement is accepted.

The audit entry carries duration_minutes on BOTH sides and duration_source on the new one, so §11 can see that a length changed - or provably did not - without subtracting two timestamps and without guessing which parameter the caller used [INV-13].

WP016 means no suite was free for the new window. The old booking, its suite and its occupancy row are then exactly as they were - guaranteed twice over, once by the helper''s internal rollback and once because this raise aborts the statement.

Only a confirmed booking may be rescheduled, transcribed from ACTION_RESULT.reschedule, and the status stays confirmed afterwards. It does NOT become the booking_status value rescheduled. statusAfter(''reschedule'', ''confirmed'') returns confirmed in src/lib/domain/booking, so that is what the database does; the rescheduled label in the enum is reserved for a booking superseded by a different one and nothing writes it yet.

The cleaning buffer is taken from the booking, not from settings [§7.1]. A booking keeps the buffer it was sold with even after Management retunes the default, so a reschedule re-applies the stored value and the §7.1 worked example keeps reproducing for old bookings.

The suite can change. Availability is computed across all seven suites and a guest never sees a suite number [§3, INV-01], so being moved is invisible to them; where the same suite is still free for the new window it is normally the one re-taken, because the helper releases the old claim before its second attempt and the fixed priority order then finds it first.';


revoke all on function public.reschedule_booking(uuid, timestamptz, text, integer, integer)
  from public;

grant execute on function public.reschedule_booking(uuid, timestamptz, text, integer, integer)
  to authenticated, service_role;
