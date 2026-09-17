create or replace function public.record_arrival(
  p_booking_id uuid,
  p_arrived_at timestamptz,
  p_reason     text
)
returns table (
  booking_id  uuid,
  status      public.booking_status,
  arrived_at  timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status    public.booking_status;
  v_reference text;
  v_old       timestamptz;
  v_at        timestamptz := coalesce(p_arrived_at, clock_timestamp());
begin
  if not internal.is_staff() then
    raise exception 'record_arrival: an active staff session is required [§9.2, INV-13]'
      using errcode = '42501';
  end if;

  if not isfinite(v_at) then
    raise exception 'record_arrival: p_arrived_at must be a finite instant, got %',
      p_arrived_at
      using errcode = '22004';
  end if;

  select b.status, b.reference, b.arrived_at
    into v_status, v_reference, v_old
    from public.bookings b
   where b.id = p_booking_id
   for update;

  if v_status is null then
    raise exception 'record_arrival: no booking with id %', p_booking_id
      using errcode = 'P0002';
  end if;

  if v_status <> 'confirmed'::public.booking_status then
    raise exception 'record_arrival: a booking in % cannot record an arrival [§4.4]',
      v_status
      using errcode = 'WP014';
  end if;

  update public.bookings b
     set arrived_at = v_at
   where b.id = p_booking_id;

  perform internal.write_audit(
    'record_arrival',
    'public.bookings',
    p_booking_id::text,
    jsonb_build_object('arrived_at', v_old),
    jsonb_build_object(
      'reference',  v_reference,
      'status',     v_status,
      'arrived_at', v_at
    ),
    coalesce(p_reason, 'Guest arrival recorded at Reception [§9.2]')
  );

  booking_id := p_booking_id;
  status     := v_status;
  arrived_at := v_at;
  return next;
end
$$;


create or replace function public.check_in_booking(
  p_booking_id uuid,
  p_at         timestamptz,
  p_reason     text
)
returns table (
  booking_id    uuid,
  status        public.booking_status,
  arrived_at    timestamptz,
  checked_in_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status    public.booking_status;
  v_reference text;
  v_arrived   timestamptz;
  v_at        timestamptz := coalesce(p_at, clock_timestamp());
begin
  if not internal.is_staff() then
    raise exception 'check_in_booking: an active staff session is required [§9.2, INV-13]'
      using errcode = '42501';
  end if;

  if not isfinite(v_at) then
    raise exception 'check_in_booking: p_at must be a finite instant, got %', p_at
      using errcode = '22004';
  end if;

  select b.status, b.reference, b.arrived_at
    into v_status, v_reference, v_arrived
    from public.bookings b
   where b.id = p_booking_id
   for update;

  if v_status is null then
    raise exception 'check_in_booking: no booking with id %', p_booking_id
      using errcode = 'P0002';
  end if;

  if v_status <> 'confirmed'::public.booking_status then
    raise exception 'check_in_booking: a booking in % cannot be checked in [§4.4]',
      v_status
      using errcode = 'WP014';
  end if;

  update public.bookings b
     set status        = 'checked_in'::public.booking_status,
         checked_in_at = v_at,
         arrived_at    = coalesce(b.arrived_at, v_at)
   where b.id = p_booking_id
  returning b.arrived_at into v_arrived;

  perform internal.write_audit(
    'check_in_booking',
    'public.bookings',
    p_booking_id::text,
    jsonb_build_object('status', v_status, 'checked_in_at', null),
    jsonb_build_object(
      'reference',     v_reference,
      'status',        'checked_in',
      'arrived_at',    v_arrived,
      'checked_in_at', v_at
    ),
    coalesce(p_reason, 'Guest checked in at Reception [§9.2]')
  );

  booking_id    := p_booking_id;
  status        := 'checked_in'::public.booking_status;
  arrived_at    := v_arrived;
  checked_in_at := v_at;
  return next;
end
$$;


create or replace function public.check_out_booking(
  p_booking_id uuid,
  p_at         timestamptz,
  p_reason     text
)
returns table (
  booking_id       uuid,
  status           public.booking_status,
  checked_out_at   timestamptz,
  suite_id         uuid,
  cleaning_task_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status    public.booking_status;
  v_reference text;
  v_suite_id  uuid;
  v_task_id   uuid;
  v_at        timestamptz := coalesce(p_at, clock_timestamp());
begin
  if not internal.is_staff() then
    raise exception 'check_out_booking: an active staff session is required [§9.2, INV-13]'
      using errcode = '42501';
  end if;

  if not isfinite(v_at) then
    raise exception 'check_out_booking: p_at must be a finite instant, got %', p_at
      using errcode = '22004';
  end if;

  select b.status, b.reference, b.suite_id
    into v_status, v_reference, v_suite_id
    from public.bookings b
   where b.id = p_booking_id
   for update;

  if v_status is null then
    raise exception 'check_out_booking: no booking with id %', p_booking_id
      using errcode = 'P0002';
  end if;

  if v_status <> 'checked_in'::public.booking_status then
    raise exception 'check_out_booking: a booking in % cannot be checked out [§4.4]',
      v_status
      using errcode = 'WP014';
  end if;

  update public.bookings b
     set status         = 'completed'::public.booking_status,
         checked_out_at = v_at
   where b.id = p_booking_id;

  if v_suite_id is not null
     and not exists (
       select 1 from public.cleaning_tasks t where t.booking_id = p_booking_id
     ) then
    insert into public.cleaning_tasks (suite_id, booking_id, status, due_from)
    values (v_suite_id, p_booking_id, 'pending'::public.cleaning_status, v_at)
    returning id into v_task_id;

    perform internal.write_audit(
      'create_cleaning_task',
      'public.cleaning_tasks',
      v_task_id::text,
      null::jsonb,
      jsonb_build_object(
        'suite_id',   v_suite_id,
        'booking_id', p_booking_id,
        'status',     'pending',
        'due_from',   v_at
      ),
      coalesce(p_reason, 'Suite came free at check-out [§9.2]')
    );
  end if;

  perform internal.write_audit(
    'check_out_booking',
    'public.bookings',
    p_booking_id::text,
    jsonb_build_object('status', v_status, 'checked_out_at', null),
    jsonb_build_object(
      'reference',        v_reference,
      'status',           'completed',
      'checked_out_at',   v_at,
      'suite_id',         v_suite_id,
      'cleaning_task_id', v_task_id
    ),
    coalesce(p_reason, 'Guest checked out at Reception [§9.2]')
  );

  booking_id       := p_booking_id;
  status           := 'completed'::public.booking_status;
  checked_out_at   := v_at;
  suite_id         := v_suite_id;
  cleaning_task_id := v_task_id;
  return next;
end
$$;


create or replace function public.mark_late_arrival(
  p_booking_id uuid,
  p_minutes    integer,
  p_reason     text
)
returns table (
  booking_id           uuid,
  status               public.booking_status,
  late_arrival_minutes integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status    public.booking_status;
  v_reference text;
  v_old       integer;
begin
  if not internal.is_staff() then
    raise exception 'mark_late_arrival: an active staff session is required [§9.2, INV-13]'
      using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'mark_late_arrival: a reason is required — a late arrival carries a §10.2 consequence and INV-13 wants the reason with it'
      using errcode = '22023';
  end if;

  if p_minutes is null then
    raise exception 'mark_late_arrival: p_minutes must not be null'
      using errcode = '22004';
  end if;

  if p_minutes < 0 or p_minutes > 24 * 60 then
    raise exception 'mark_late_arrival: p_minutes must be between 0 and one day, got %',
      p_minutes
      using errcode = '22023';
  end if;

  select b.status, b.reference, b.late_arrival_minutes
    into v_status, v_reference, v_old
    from public.bookings b
   where b.id = p_booking_id
   for update;

  if v_status is null then
    raise exception 'mark_late_arrival: no booking with id %', p_booking_id
      using errcode = 'P0002';
  end if;

  if v_status not in (
    'confirmed'::public.booking_status,
    'checked_in'::public.booking_status,
    'completed'::public.booking_status
  ) then
    raise exception 'mark_late_arrival: a booking in % cannot record a late arrival [§4.4]',
      v_status
      using errcode = 'WP014';
  end if;

  update public.bookings b
     set late_arrival_minutes = p_minutes
   where b.id = p_booking_id;

  perform internal.write_audit(
    'mark_late_arrival',
    'public.bookings',
    p_booking_id::text,
    jsonb_build_object('late_arrival_minutes', v_old),
    jsonb_build_object(
      'reference',            v_reference,
      'status',               v_status,
      'late_arrival_minutes', p_minutes
    ),
    p_reason
  );

  booking_id           := p_booking_id;
  status               := v_status;
  late_arrival_minutes := p_minutes;
  return next;
end
$$;


create or replace function public.mark_no_show(
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
  v_reference    text;
  v_occupancy_id uuid;
  v_suite_id     uuid;
  v_released     uuid;
begin
  if not internal.is_staff() then
    raise exception 'mark_no_show: an active staff session is required [§9.2, INV-13]'
      using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'mark_no_show: a reason is required — every manual change is audited with one [§3, INV-13]'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);

  select b.status, b.reference, b.occupancy_id, b.suite_id
    into v_status, v_reference, v_occupancy_id, v_suite_id
    from public.bookings b
   where b.id = p_booking_id
   for update;

  if v_status is null then
    raise exception 'mark_no_show: no booking with id %', p_booking_id
      using errcode = 'P0002';
  end if;

  if v_status <> 'confirmed'::public.booking_status then
    raise exception 'mark_no_show: a booking in % cannot be marked a no-show [§4.4]',
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
     set status = 'no_show'::public.booking_status
   where b.id = p_booking_id;

  perform internal.write_audit(
    'mark_no_show',
    'public.bookings',
    p_booking_id::text,
    jsonb_build_object(
      'status',       v_status,
      'suite_id',     v_suite_id,
      'occupancy_id', v_occupancy_id
    ),
    jsonb_build_object(
      'reference',             v_reference,
      'status',                'no_show',
      'released_occupancy_id', v_released
    ),
    p_reason
  );

  booking_id            := p_booking_id;
  status                := 'no_show'::public.booking_status;
  released_occupancy_id := v_released;
  return next;
end
$$;


create or replace function public.record_overrun(
  p_booking_id  uuid,
  p_actual_end  timestamptz,
  p_reason      text
)
returns table (
  booking_id            uuid,
  status                public.booking_status,
  overrun_minutes       integer,
  increment_minutes     integer,
  chargeable_increments integer,
  chargeable_minutes    integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status      public.booking_status;
  v_reference   text;
  v_period      tstzrange;
  v_old         integer;
  v_increment   integer;
  v_overrun     integer;
  v_increments  integer;
  v_chargeable  integer;
  v_at          timestamptz := coalesce(p_actual_end, clock_timestamp());
begin
  if not internal.is_staff() then
    raise exception 'record_overrun: an active staff session is required [§9.2, INV-13]'
      using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'record_overrun: a reason is required — an overrun is charged and INV-13 wants the reason with the charge'
      using errcode = '22023';
  end if;

  if not isfinite(v_at) then
    raise exception 'record_overrun: p_actual_end must be a finite instant, got %',
      p_actual_end
      using errcode = '22004';
  end if;

  select b.status, b.reference, b.experience_period, b.overrun_minutes
    into v_status, v_reference, v_period, v_old
    from public.bookings b
   where b.id = p_booking_id
   for update;

  if v_status is null then
    raise exception 'record_overrun: no booking with id %', p_booking_id
      using errcode = 'P0002';
  end if;

  if v_status not in (
    'checked_in'::public.booking_status,
    'completed'::public.booking_status
  ) then
    raise exception 'record_overrun: a booking in % cannot record an overrun [§4.4]',
      v_status
      using errcode = 'WP014';
  end if;

  v_overrun := greatest(
    0,
    ceil(extract(epoch from (v_at - upper(v_period))) / 60.0)::integer
  );

  v_increment := internal.setting_integer('overrun.increment_minutes');

  if v_increment is not null and v_increment > 0 then
    v_increments := ceil(v_overrun::numeric / v_increment::numeric)::integer;
    v_chargeable := v_increments * v_increment;
  else
    v_increment  := null;
    v_increments := null;
    v_chargeable := null;
  end if;

  update public.bookings b
     set overrun_minutes = v_overrun
   where b.id = p_booking_id;

  perform internal.write_audit(
    'record_overrun',
    'public.bookings',
    p_booking_id::text,
    jsonb_build_object('overrun_minutes', v_old),
    jsonb_build_object(
      'reference',             v_reference,
      'status',                v_status,
      'scheduled_end',         upper(v_period),
      'actual_end',            v_at,
      'overrun_minutes',       v_overrun,
      'increment_minutes',     v_increment,
      'chargeable_increments', v_increments,
      'chargeable_minutes',    v_chargeable
    ),
    p_reason
  );

  booking_id            := p_booking_id;
  status                := v_status;
  overrun_minutes       := v_overrun;
  increment_minutes     := v_increment;
  chargeable_increments := v_increments;
  chargeable_minutes    := v_chargeable;
  return next;
end
$$;


create or replace function public.set_suite_status(
  p_suite_id uuid,
  p_status   public.suite_status,
  p_reason   text
)
returns table (
  suite_id        uuid,
  suite_number    integer,
  status          public.suite_status,
  previous_status public.suite_status
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_number integer;
  v_old    public.suite_status;
begin
  if not internal.is_staff() then
    raise exception 'set_suite_status: an active staff session is required [§9.2, INV-13]'
      using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'set_suite_status: a reason is required — a suite nobody can explain at the desk is the §9.2 failure this refuses'
      using errcode = '22023';
  end if;

  if p_status is null then
    raise exception 'set_suite_status: p_status must not be null'
      using errcode = '22004';
  end if;

  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);

  select s.suite_number, s.status
    into v_number, v_old
    from public.suites s
   where s.id = p_suite_id
   for update;

  if v_number is null then
    raise exception 'set_suite_status: no suite with id %', p_suite_id
      using errcode = 'P0002';
  end if;

  update public.suites s
     set status = p_status
   where s.id = p_suite_id;

  perform internal.write_audit(
    'set_suite_status',
    'public.suites',
    p_suite_id::text,
    jsonb_build_object('status', v_old),
    jsonb_build_object('suite_number', v_number, 'status', p_status),
    p_reason
  );

  suite_id        := p_suite_id;
  suite_number    := v_number;
  status          := p_status;
  previous_status := v_old;
  return next;
end
$$;


create or replace function public.block_suite_period(
  p_suite_ids uuid[],
  p_from      timestamptz,
  p_to        timestamptz,
  p_reason    text
)
returns table (
  suite_id     uuid,
  suite_number integer,
  occupancy_id uuid,
  is_blocked   boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reason    text := nullif(btrim(coalesce(p_reason, '')), '');
  v_period    tstzrange;
  v_candidate record;
  v_claimed   uuid;
  v_missing   uuid;
begin
  if not internal.is_staff() then
    raise exception 'block_suite_period: an active staff session is required [§9.2, INV-13]'
      using errcode = '42501';
  end if;

  if v_reason is null then
    raise exception 'block_suite_period: a reason is required — §9.2 and suite_occupancy_block_has_reason both refuse a block nobody can explain'
      using errcode = '22023';
  end if;

  if p_suite_ids is null then
    raise exception 'block_suite_period: p_suite_ids must name the suites to block'
      using errcode = '22004';
  end if;

  if coalesce(array_length(p_suite_ids, 1), 0) = 0 then
    raise exception 'block_suite_period: p_suite_ids is empty — a block names the suites it takes out, it never means every suite by default'
      using errcode = '22023';
  end if;

  if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) then
    raise exception 'block_suite_period: p_from and p_to must both be finite instants, got % to %',
      coalesce(p_from::text, 'null'), coalesce(p_to::text, 'null')
      using errcode = '22004';
  end if;

  if p_to <= p_from then
    raise exception 'block_suite_period: p_to must be after p_from, got % to %',
      p_from, p_to
      using errcode = '22023';
  end if;

  select r.id
    into v_missing
    from unnest(p_suite_ids) as r(id)
   where not exists (select 1 from public.suites s where s.id = r.id)
   limit 1;

  if v_missing is not null then
    raise exception 'block_suite_period: no suite with id %', v_missing
      using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);

  v_period := tstzrange(p_from, p_to, '[)');

  for v_candidate in
    select s.id, s.suite_number
      from public.suites s
     where s.id = any(p_suite_ids)
     order by s.priority, s.suite_number
  loop
    select a.allocated_occupancy_id
      into v_claimed
      from internal.allocate_suite(
        v_period,
        v_period,
        0,
        'block'::public.occupancy_kind,
        null,
        null,
        v_reason,
        true,
        v_candidate.id
      ) a;

    perform internal.write_audit(
      'block_suite_period',
      'public.suites',
      v_candidate.id::text,
      jsonb_build_object('suite_number', v_candidate.suite_number),
      jsonb_build_object(
        'suite_number',  v_candidate.suite_number,
        'blocked_from',  p_from,
        'blocked_to',    p_to,
        'occupancy_id',  v_claimed,
        'is_blocked',    v_claimed is not null
      ),
      v_reason
    );

    suite_id     := v_candidate.id;
    suite_number := v_candidate.suite_number;
    occupancy_id := v_claimed;
    is_blocked   := v_claimed is not null;
    return next;

    v_claimed := null;
  end loop;

  return;
end
$$;


create or replace function public.release_suite_block(
  p_occupancy_id uuid,
  p_reason       text
)
returns table (
  occupancy_id uuid,
  suite_id     uuid,
  suite_number integer,
  status       public.occupancy_status
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_kind      public.occupancy_kind;
  v_status    public.occupancy_status;
  v_active    boolean;
  v_suite_id  uuid;
  v_number    integer;
  v_period    tstzrange;
begin
  if not internal.is_staff() then
    raise exception 'release_suite_block: an active staff session is required [§9.2, INV-13]'
      using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'release_suite_block: a reason is required — every manual change is audited with one [§3, INV-13]'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);

  select o.kind, o.status, o.is_active, o.suite_id, o.blocked_period
    into v_kind, v_status, v_active, v_suite_id, v_period
    from public.suite_occupancy o
   where o.id = p_occupancy_id
   for update;

  if v_kind is null then
    raise exception 'release_suite_block: no occupancy row with id %', p_occupancy_id
      using errcode = 'P0002';
  end if;

  if v_kind not in (
    'block'::public.occupancy_kind,
    'maintenance'::public.occupancy_kind
  ) then
    raise exception 'release_suite_block: occupancy % is a % claim — a booking or a hold is released by the function that owns it, never here',
      p_occupancy_id, v_kind
      using errcode = '22023';
  end if;

  if not v_active then
    raise exception 'release_suite_block: occupancy % is already % [§4.2]',
      p_occupancy_id, v_status
      using errcode = 'WP014';
  end if;

  update public.suite_occupancy o
     set is_active = false,
         status    = 'released'::public.occupancy_status
   where o.id = p_occupancy_id;

  select s.suite_number into v_number
    from public.suites s
   where s.id = v_suite_id;

  perform internal.write_audit(
    'release_suite_block',
    'public.suite_occupancy',
    p_occupancy_id::text,
    jsonb_build_object('status', v_status, 'is_active', true),
    jsonb_build_object(
      'status',        'released',
      'is_active',     false,
      'kind',          v_kind,
      'suite_id',      v_suite_id,
      'suite_number',  v_number,
      'blocked_from',  lower(v_period),
      'blocked_to',    upper(v_period)
    ),
    p_reason
  );

  occupancy_id := p_occupancy_id;
  suite_id     := v_suite_id;
  suite_number := v_number;
  status       := 'released'::public.occupancy_status;
  return next;
end
$$;


create or replace function public.preview_block_impact(
  p_suite_ids uuid[],
  p_from      timestamptz,
  p_to        timestamptz
)
returns table (
  suite_id          uuid,
  suite_number      integer,
  occupancy_id      uuid,
  occupancy_kind    public.occupancy_kind,
  booking_id        uuid,
  booking_reference text,
  booking_status    public.booking_status,
  experience_from   timestamptz,
  experience_to     timestamptz,
  blocked_from      timestamptz,
  blocked_to        timestamptz,
  expires_at        timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_period tstzrange;
begin
  if not internal.is_staff() then
    raise exception 'preview_block_impact: an active staff session is required — §10.3 is a Management screen and suite numbers never reach a guest [INV-01]'
      using errcode = '42501';
  end if;

  if p_suite_ids is null then
    raise exception 'preview_block_impact: p_suite_ids must name the suites the block would take'
      using errcode = '22004';
  end if;

  if coalesce(array_length(p_suite_ids, 1), 0) = 0 then
    raise exception 'preview_block_impact: p_suite_ids is empty — the preview takes the same input as public.block_suite_period, which never means every suite by default'
      using errcode = '22023';
  end if;

  if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) then
    raise exception 'preview_block_impact: p_from and p_to must both be finite instants, got % to %',
      coalesce(p_from::text, 'null'), coalesce(p_to::text, 'null')
      using errcode = '22004';
  end if;

  if p_to <= p_from then
    raise exception 'preview_block_impact: p_to must be after p_from, got % to %',
      p_from, p_to
      using errcode = '22023';
  end if;

  v_period := tstzrange(p_from, p_to, '[)');

  return query
    select o.suite_id,
           s.suite_number,
           o.id,
           o.kind,
           b.id,
           b.reference,
           b.status,
           lower(o.experience_period),
           upper(o.experience_period),
           lower(o.blocked_period),
           upper(o.blocked_period),
           o.expires_at
      from public.suite_occupancy o
      join public.suites s on s.id = o.suite_id
      left join public.bookings b on b.id = o.booking_id
     where o.suite_id = any(p_suite_ids)
       and o.is_active
       and (o.expires_at is null or o.expires_at > now())
       and o.blocked_period && v_period
     order by s.priority, s.suite_number, lower(o.blocked_period);
end
$$;


create or replace function public.start_cleaning_task(p_task_id uuid)
returns table (
  cleaning_task_id uuid,
  suite_id         uuid,
  status           public.cleaning_status,
  started_at       timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status   public.cleaning_status;
  v_suite_id uuid;
  v_at       timestamptz := clock_timestamp();
begin
  if not internal.is_staff() then
    raise exception 'start_cleaning_task: an active staff session is required [§9.2, INV-13]'
      using errcode = '42501';
  end if;

  select t.status, t.suite_id
    into v_status, v_suite_id
    from public.cleaning_tasks t
   where t.id = p_task_id
   for update;

  if v_status is null then
    raise exception 'start_cleaning_task: no cleaning task with id %', p_task_id
      using errcode = 'P0002';
  end if;

  if v_status <> 'pending'::public.cleaning_status then
    raise exception 'start_cleaning_task: a cleaning task in % cannot be started again [§9.2]',
      v_status
      using errcode = 'WP019';
  end if;

  update public.cleaning_tasks t
     set status     = 'in_progress'::public.cleaning_status,
         started_at = v_at
   where t.id = p_task_id;

  perform internal.write_audit(
    'start_cleaning_task',
    'public.cleaning_tasks',
    p_task_id::text,
    jsonb_build_object('status', v_status, 'started_at', null),
    jsonb_build_object(
      'status',     'in_progress',
      'suite_id',   v_suite_id,
      'started_at', v_at
    ),
    'Cleaning started [§9.2]'
  );

  cleaning_task_id := p_task_id;
  suite_id         := v_suite_id;
  status           := 'in_progress'::public.cleaning_status;
  started_at       := v_at;
  return next;
end
$$;


create or replace function public.assign_cleaning_task(
  p_task_id  uuid,
  p_staff_id uuid
)
returns table (
  cleaning_task_id uuid,
  suite_id         uuid,
  status           public.cleaning_status,
  assigned_to      uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status   public.cleaning_status;
  v_suite_id uuid;
  v_old      uuid;
begin
  if not internal.is_staff() then
    raise exception 'assign_cleaning_task: an active staff session is required [§9.2, INV-13]'
      using errcode = '42501';
  end if;

  if p_staff_id is not null
     and not exists (select 1 from public.staff s where s.id = p_staff_id) then
    raise exception 'assign_cleaning_task: no staff member with id %', p_staff_id
      using errcode = 'P0002';
  end if;

  select t.status, t.suite_id, t.assigned_to
    into v_status, v_suite_id, v_old
    from public.cleaning_tasks t
   where t.id = p_task_id
   for update;

  if v_status is null then
    raise exception 'assign_cleaning_task: no cleaning task with id %', p_task_id
      using errcode = 'P0002';
  end if;

  if v_status = 'confirmed'::public.cleaning_status then
    raise exception 'assign_cleaning_task: a confirmed cleaning task cannot be reassigned [§9.2]'
      using errcode = 'WP019';
  end if;

  update public.cleaning_tasks t
     set assigned_to = p_staff_id
   where t.id = p_task_id;

  perform internal.write_audit(
    'assign_cleaning_task',
    'public.cleaning_tasks',
    p_task_id::text,
    jsonb_build_object('assigned_to', v_old),
    jsonb_build_object(
      'status',      v_status,
      'suite_id',    v_suite_id,
      'assigned_to', p_staff_id
    ),
    'Cleaning assigned [§9.2]'
  );

  cleaning_task_id := p_task_id;
  suite_id         := v_suite_id;
  status           := v_status;
  assigned_to      := p_staff_id;
  return next;
end
$$;


create or replace function public.confirm_cleaning_task(
  p_task_id uuid,
  p_note    text
)
returns table (
  cleaning_task_id uuid,
  suite_id         uuid,
  status           public.cleaning_status,
  confirmed_at     timestamptz,
  confirmed_by     uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status   public.cleaning_status;
  v_suite_id uuid;
  v_note     text := nullif(btrim(coalesce(p_note, '')), '');
  v_actor    uuid := internal.current_staff_id();
  v_at       timestamptz := clock_timestamp();
begin
  if not internal.is_staff() then
    raise exception 'confirm_cleaning_task: an active staff session is required [§9.2, INV-13]'
      using errcode = '42501';
  end if;

  select t.status, t.suite_id
    into v_status, v_suite_id
    from public.cleaning_tasks t
   where t.id = p_task_id
   for update;

  if v_status is null then
    raise exception 'confirm_cleaning_task: no cleaning task with id %', p_task_id
      using errcode = 'P0002';
  end if;

  if v_status = 'confirmed'::public.cleaning_status then
    raise exception 'confirm_cleaning_task: this cleaning task is already confirmed [§9.2]'
      using errcode = 'WP019';
  end if;

  update public.cleaning_tasks t
     set status       = 'confirmed'::public.cleaning_status,
         confirmed_at = v_at,
         confirmed_by = v_actor,
         note         = coalesce(v_note, t.note)
   where t.id = p_task_id;

  perform internal.write_audit(
    'confirm_cleaning_task',
    'public.cleaning_tasks',
    p_task_id::text,
    jsonb_build_object('status', v_status, 'confirmed_at', null),
    jsonb_build_object(
      'status',       'confirmed',
      'suite_id',     v_suite_id,
      'confirmed_at', v_at,
      'confirmed_by', v_actor,
      'note',         v_note
    ),
    coalesce(v_note, 'Cleaning confirmed [§9.2]')
  );

  cleaning_task_id := p_task_id;
  suite_id         := v_suite_id;
  status           := 'confirmed'::public.cleaning_status;
  confirmed_at     := v_at;
  confirmed_by     := v_actor;
  return next;
end
$$;


create or replace function public.create_task(
  p_title       text,
  p_note        text,
  p_assigned_to uuid,
  p_due_on      date,
  p_priority    public.task_priority
)
returns table (
  task_id     uuid,
  title       text,
  status      public.task_status,
  priority    public.task_priority,
  assigned_to uuid,
  due_on      date
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_title    text := nullif(btrim(coalesce(p_title, '')), '');
  v_note     text := nullif(btrim(coalesce(p_note, '')), '');
  v_priority public.task_priority := coalesce(p_priority, 'normal'::public.task_priority);
  v_actor    uuid := internal.current_staff_id();
  v_task_id  uuid;
begin
  if not internal.is_staff() then
    raise exception 'create_task: an active staff session is required [§10.6, INV-13]'
      using errcode = '42501';
  end if;

  if v_title is null then
    raise exception 'create_task: a task needs a title [§10.6]'
      using errcode = '22023';
  end if;

  if p_assigned_to is not null
     and not exists (select 1 from public.staff s where s.id = p_assigned_to) then
    raise exception 'create_task: no staff member with id %', p_assigned_to
      using errcode = 'P0002';
  end if;

  insert into public.tasks (title, note, assigned_to, assigned_by, due_on, priority)
  values (v_title, v_note, p_assigned_to, v_actor, p_due_on, v_priority)
  returning id into v_task_id;

  perform internal.write_audit(
    'create_task',
    'public.tasks',
    v_task_id::text,
    null::jsonb,
    jsonb_build_object(
      'title',       v_title,
      'note',        v_note,
      'assigned_to', p_assigned_to,
      'assigned_by', v_actor,
      'due_on',      p_due_on,
      'priority',    v_priority,
      'status',      'open'
    ),
    'Task raised [§10.6]'
  );

  task_id     := v_task_id;
  title       := v_title;
  status      := 'open'::public.task_status;
  priority    := v_priority;
  assigned_to := p_assigned_to;
  due_on      := p_due_on;
  return next;
end
$$;


create or replace function public.update_task_status(
  p_task_id uuid,
  p_status  public.task_status,
  p_note    text
)
returns table (
  task_id      uuid,
  status       public.task_status,
  note         text,
  completed_at timestamptz,
  completed_by uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old       public.task_status;
  v_old_note  text;
  v_note      text := nullif(btrim(coalesce(p_note, '')), '');
  v_actor     uuid := internal.current_staff_id();
  v_at        timestamptz;
  v_by        uuid;
  v_new_note  text;
begin
  if not internal.is_staff() then
    raise exception 'update_task_status: an active staff session is required [§10.6, INV-13]'
      using errcode = '42501';
  end if;

  if p_status is null then
    raise exception 'update_task_status: p_status must not be null'
      using errcode = '22004';
  end if;

  select t.status, t.note
    into v_old, v_old_note
    from public.tasks t
   where t.id = p_task_id
   for update;

  if v_old is null then
    raise exception 'update_task_status: no task with id %', p_task_id
      using errcode = 'P0002';
  end if;

  if v_old in ('done'::public.task_status, 'cancelled'::public.task_status) then
    raise exception 'update_task_status: a task in % has finished and cannot be moved again [§10.6]',
      v_old
      using errcode = 'WP020';
  end if;

  if p_status = 'done'::public.task_status then
    v_at := clock_timestamp();
    v_by := v_actor;
  else
    v_at := null;
    v_by := null;
  end if;

  v_new_note := coalesce(v_note, v_old_note);

  update public.tasks t
     set status       = p_status,
         note         = v_new_note,
         completed_at = v_at,
         completed_by = v_by,
         updated_at   = clock_timestamp()
   where t.id = p_task_id;

  perform internal.write_audit(
    'update_task_status',
    'public.tasks',
    p_task_id::text,
    jsonb_build_object('status', v_old, 'note', v_old_note),
    jsonb_build_object(
      'status',       p_status,
      'note',         v_new_note,
      'completed_at', v_at,
      'completed_by', v_by
    ),
    coalesce(v_note, 'Task status changed [§10.6]')
  );

  task_id      := p_task_id;
  status       := p_status;
  note         := v_new_note;
  completed_at := v_at;
  completed_by := v_by;
  return next;
end
$$;


create or replace function public.assign_task(
  p_task_id  uuid,
  p_staff_id uuid
)
returns table (
  task_id     uuid,
  status      public.task_status,
  assigned_to uuid,
  assigned_by uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status public.task_status;
  v_old    uuid;
  v_actor  uuid := internal.current_staff_id();
begin
  if not internal.is_staff() then
    raise exception 'assign_task: an active staff session is required [§10.6, INV-13]'
      using errcode = '42501';
  end if;

  if p_staff_id is not null
     and not exists (select 1 from public.staff s where s.id = p_staff_id) then
    raise exception 'assign_task: no staff member with id %', p_staff_id
      using errcode = 'P0002';
  end if;

  select t.status, t.assigned_to
    into v_status, v_old
    from public.tasks t
   where t.id = p_task_id
   for update;

  if v_status is null then
    raise exception 'assign_task: no task with id %', p_task_id
      using errcode = 'P0002';
  end if;

  if v_status in ('done'::public.task_status, 'cancelled'::public.task_status) then
    raise exception 'assign_task: a task in % has finished and cannot be reassigned [§10.6]',
      v_status
      using errcode = 'WP020';
  end if;

  update public.tasks t
     set assigned_to = p_staff_id,
         assigned_by = v_actor,
         updated_at  = clock_timestamp()
   where t.id = p_task_id;

  perform internal.write_audit(
    'assign_task',
    'public.tasks',
    p_task_id::text,
    jsonb_build_object('assigned_to', v_old),
    jsonb_build_object(
      'status',      v_status,
      'assigned_to', p_staff_id,
      'assigned_by', v_actor
    ),
    'Task assigned [§10.6]'
  );

  task_id     := p_task_id;
  status      := v_status;
  assigned_to := p_staff_id;
  assigned_by := v_actor;
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
  if internal.current_staff_id() is not null and internal.current_staff_role() is null then
    raise exception 'open_alert: this account is not an active staff member'
      using errcode = 'WP008';
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
  if v_actor is not null and internal.current_staff_role() is null then
    raise exception 'resolve_alert: this account is not an active staff member'
      using errcode = 'WP008';
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


create or replace function public.add_shift_note(
  p_shift_on date,
  p_body     text
)
returns table (
  shift_note_id  uuid,
  shift_on       date,
  body           text,
  handed_over_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_body    text := nullif(btrim(coalesce(p_body, '')), '');
  v_actor   uuid := internal.current_staff_id();
  v_note_id uuid;
begin
  if not internal.is_staff() then
    raise exception 'add_shift_note: an active staff session is required [§9.2, INV-13]'
      using errcode = '42501';
  end if;

  if p_shift_on is null then
    raise exception 'add_shift_note: p_shift_on is required — the operating day is a Dubai calendar day and the database must not guess it from a UTC clock [INV-24]'
      using errcode = '22004';
  end if;

  if v_body is null then
    raise exception 'add_shift_note: a shift note needs a body [§9.2]'
      using errcode = '22023';
  end if;

  insert into public.shift_notes (author_id, shift_on, body)
  values (v_actor, p_shift_on, v_body)
  returning id into v_note_id;

  perform internal.write_audit(
    'add_shift_note',
    'public.shift_notes',
    v_note_id::text,
    null::jsonb,
    jsonb_build_object(
      'author_id', v_actor,
      'shift_on',  p_shift_on,
      'body',      v_body
    ),
    'Shift note written [§9.2]'
  );

  shift_note_id  := v_note_id;
  shift_on       := p_shift_on;
  body           := v_body;
  handed_over_at := null;
  return next;
end
$$;


create or replace function public.hand_over_shift(p_note_id uuid)
returns table (
  shift_note_id  uuid,
  shift_on       date,
  handed_over_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_shift_on date;
  v_handed   timestamptz;
  v_found    boolean;
  v_actor    uuid := internal.current_staff_id();
  v_at       timestamptz := clock_timestamp();
begin
  if not internal.is_staff() then
    raise exception 'hand_over_shift: an active staff session is required [§9.2, INV-13]'
      using errcode = '42501';
  end if;

  select true, n.shift_on, n.handed_over_at
    into v_found, v_shift_on, v_handed
    from public.shift_notes n
   where n.id = p_note_id
   for update;

  if v_found is null then
    raise exception 'hand_over_shift: no shift note with id %', p_note_id
      using errcode = 'P0002';
  end if;

  if v_handed is not null then
    raise exception 'hand_over_shift: shift note % was already handed over at % [§9.2]',
      p_note_id, v_handed
      using errcode = 'WP024';
  end if;

  update public.shift_notes n
     set handed_over_at = v_at
   where n.id = p_note_id;

  perform internal.write_audit(
    'hand_over_shift',
    'public.shift_notes',
    p_note_id::text,
    jsonb_build_object('handed_over_at', null),
    jsonb_build_object(
      'shift_on',       v_shift_on,
      'handed_over_at', v_at,
      'handed_over_by', v_actor
    ),
    'Shift handed over [§9.2]'
  );

  shift_note_id  := p_note_id;
  shift_on       := v_shift_on;
  handed_over_at := v_at;
  return next;
end
$$;


create or replace function public.set_customer_warning(
  p_customer_id  uuid,
  p_warning_note text,
  p_is_blocked   boolean,
  p_reason       text
)
returns table (
  customer_id  uuid,
  is_blocked   boolean,
  warning_note text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old_note    text;
  v_old_blocked boolean;
  v_note        text := nullif(btrim(coalesce(p_warning_note, '')), '');
  v_blocked     boolean;
begin
  if not internal.has_permission('correct_customer_record'::public.named_permission) then
    raise exception 'set_customer_warning: a warning or a blocked status is a §10.5 customer record correction and needs perm:correct_customer_record [docs/5 §2]'
      using errcode = 'WP018';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'set_customer_warning: a reason is required — every manual change is audited with one [§3, INV-13]'
      using errcode = '22023';
  end if;

  select c.warning_note, c.is_blocked
    into v_old_note, v_old_blocked
    from public.customers c
   where c.id = p_customer_id
   for update;

  if v_old_blocked is null then
    raise exception 'set_customer_warning: no customer with id %', p_customer_id
      using errcode = 'P0002';
  end if;

  v_blocked := coalesce(p_is_blocked, v_old_blocked);

  update public.customers c
     set warning_note = v_note,
         is_blocked   = v_blocked
   where c.id = p_customer_id;

  perform internal.write_audit(
    'set_customer_warning',
    'public.customers',
    p_customer_id::text,
    jsonb_build_object('warning_note', v_old_note, 'is_blocked', v_old_blocked),
    jsonb_build_object('warning_note', v_note, 'is_blocked', v_blocked),
    p_reason
  );

  customer_id  := p_customer_id;
  is_blocked   := v_blocked;
  warning_note := v_note;
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
  if internal.current_staff_id() is not null and internal.current_staff_role() is null then
    raise exception 'queue_message: this account is not an active staff member'
      using errcode = 'WP008';
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
  v_old_status  public.message_status;
  v_old_count   integer;
  v_old_provider text;
  v_provider    text := nullif(btrim(coalesce(p_provider_message_id, '')), '');
  v_error       text := nullif(btrim(coalesce(p_error, '')), '');
  v_at          timestamptz := clock_timestamp();
  v_is_attempt  boolean;
  v_count       integer;
  v_last        timestamptz;
  v_sent        timestamptz;
  v_failed      timestamptz;
begin
  if internal.current_staff_id() is not null and internal.current_staff_role() is null then
    raise exception 'record_message_attempt: this account is not an active staff member'
      using errcode = 'WP008';
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


comment on function public.record_arrival(uuid, timestamptz, text) is
  'Record that the guest actually turned up [§9.2]. §9.2 asks for arrival, check-in and check-out as THREE DISTINCT TIMESTAMPS, and this is the first of them: the guest is at the door, not yet in a suite. The status does not move, which transcribes ACTION_RESULT.record_arrival in src/lib/domain/booking - from confirmed, to null. Anything else raises WP014.

Three timestamps rather than one is not bookkeeping. src/lib/domain/alerts distinguishes arrival_overdue, which fires when a confirmed booking has passed its start with no arrival, from checkin_overdue, which fires when someone arrived and is still standing at the desk. Collapse the two columns and the second alert cannot be computed and Reception loses the case that actually needs a person.

p_arrived_at is optional and defaults to clock_timestamp(), because the ordinary press of the button means now; a receptionist catching up an hour later passes the real instant. It is never derived from the booking start.

Deliberately does NOT compute late_arrival_minutes. rules.late_arrival is an unset §10.2 setting, so any grace period the database invented would be a business rule in SQL [R-05, INV-16] and a wrong one. public.mark_late_arrival is the separate, reasoned action; lateArrivalMinutes in src/lib/domain/overrun is what the console offers as its default.

A reason is optional here, as it is on public.update_booking_details, because recording an observed fact is not a discretionary change. The audit entry still carries one.';


comment on function public.check_in_booking(uuid, timestamptz, text) is
  'Check the guest in [§9.2]. confirmed becomes checked_in, transcribed from ACTION_RESULT.check_in in src/lib/domain/booking. WP014 refuses every other starting state, including a second check-in, and the console disables its button from that same table - two disagreeing copies of a state machine is how a guard silently stops guarding.

arrived_at is backfilled from the check-in instant when nobody pressed arrive [OUR CHOICE]. A guest standing in a suite demonstrably arrived, and leaving the column null would tell §11 they never did. coalesce keeps a real recorded arrival untouched, so the ordinary two-step at the desk still stores two different instants.

THE SUITE STATUS COLUMN IS NOT TOUCHED, AND THAT IS A DECISION. §4.1 draws a suite lifecycle through booked, checked in and cleaning, but public.suites.status is a single column describing a suite for all time, and a suite is booked at 14:00 while free at 10:00 - the column cannot hold both. Which suite is occupied when is answered by public.suite_occupancy, which carries the ranges and the exclusion constraint [INV-02]. public.set_suite_status stays the only writer of that column, where it means the operational override §7.2 makes it: blocked, maintenance, not ready, out of service. Driving it from the booking lifecycle would put a second source of truth beside the one table §3 requires, and a cleaning value written at check-out would make availability wait on a human [Q-16].';


comment on function public.check_out_booking(uuid, timestamptz, text) is
  'Check the guest out and raise the clean [§9.2]. checked_in becomes completed, transcribed from ACTION_RESULT.check_out, and one row is inserted into public.cleaning_tasks for the suite.

due_from IS THE CHECK-OUT INSTANT, NOT THE END OF THE STORED BUFFER, and the choice matters. §7.1 gives the buffer one job: protect the next start. So the buffer is the window the clean has to happen IN, and the moment the guest walks out is the moment the suite is physically free to clean. src/lib/domain/alerts measures reception.cleaning_confirm_minutes from due_from, so measuring from the buffer end would raise cleaning_unconfirmed only after the suite had already become sellable again - an alert that arrives once it is too late to act on is worse than no alert. Measuring from check-out puts the warning inside the window, which is where §9.3 wants it. An early check-out gets its clean started early for the same reason.

The claim in public.suite_occupancy is NOT shortened. The buffer keeps blocking to its stored end even though the guest has gone, because §7.1 protects the next start rather than the current guest, and releasing early would let a booking begin in an uncleaned suite. §7.1 is also why the buffer stored on the row is the one that applies, not today''s setting.

The cleaning task does not gate availability and nothing in the allocation path reads it - read the comment on public.cleaning_tasks before changing that [Q-16].

A booking holding no suite - the §8.2 recovery gap - completes with no cleaning task, and cleaning_task_id comes back null. There is nothing to clean, and public.cleaning_tasks.suite_id is not nullable because a clean without a suite is not a task anybody can do.';


comment on function public.mark_late_arrival(uuid, integer, text) is
  'Store how late the guest was [§9.2]. A measurement, not a transition: the status is unchanged and the value lands on bookings.late_arrival_minutes for the §10.2 late-arrival terms to be applied above the database.

src/lib/domain/booking has no late-arrival action, so the legal states are [OUR CHOICE]: confirmed, checked_in and completed. Confirmed covers the guest who is late and not yet in; checked_in and completed cover the receptionist writing it up afterwards, which is when it usually gets written up at all. A cancelled or no-show booking has no arrival to be late for.

The minutes are supplied rather than computed. lateArrivalMinutes in src/lib/domain/overrun turns a stored arrival into the number the console offers, and rules.late_arrival - unset - decides what a grace period is. Neither belongs in SQL [R-05]. A reason is required because a late arrival carries a consequence for the guest.';


comment on function public.mark_no_show(uuid, text) is
  'The guest never came [§9.2]. confirmed becomes no_show, transcribed from ACTION_RESULT.mark_no_show, and the claim on the suite is given back so the rest of the day can be sold.

The occupancy row is expired BY STATUS - is_active false, status released - and never deleted [R-17]. §11.3 reports abandonment and §11.2 reports no-shows; a delete destroys the only evidence that the suite was held and wasted. bookings.occupancy_id keeps pointing at the released row, the same convention public.cancel_booking follows, so §9.1''s suite timeline can still explain the gap.

It takes the venue-wide advisory lock before it touches anything, like every other function that changes a claim, so a release can never interleave with an allocation. Once released the suite is immediately allocatable again, by the constraint rather than by a job: the next caller into internal.allocate_suite simply finds no active row overlapping the window.';


comment on function public.record_overrun(uuid, timestamptz, text) is
  'Measure a visit that ran over [§7.6]. "Only the actual overrun is measured, charged in commenced five-minute increments" - so this measures from upper(experience_period) to the actual end, and rounds UP twice: to whole minutes, then to whole increments. That is measureOverrun in src/lib/domain/overrun, ceiling division in both places, and the two must agree because the console shows one number and the database stores the other.

The increment comes from overrun.increment_minutes through internal.setting_integer and is never written here [R-05, INV-16]. When that setting has no value the overrun is still measured and stored, and increment_minutes, chargeable_increments and chargeable_minutes all come back null - the honest answer that the charge is not configured, rather than a five invented in SQL.

Legal from checked_in and completed, transcribed from ACTION_RESULT.record_overrun. An overrun is normally written up after the guest has left, which is why completed is a legal starting state and the status never moves.

It stores a measurement and NOTHING ELSE. It does not lengthen the claim, because the time has already been taken and lengthening it retrospectively could collide with the next booking, and it does not price the overrun, because there is exactly one pricing implementation and it lives in src/lib/domain/pricing [INV-21]. An overrun that ate into a later claim is a §9.3 upcoming_conflict, raised by the scan, not silently absorbed here.';


comment on function public.set_suite_status(uuid, public.suite_status, text) is
  'Change what a suite is available for [§7.2, §9.2]. Reception may do this: docs/5 §3 reads "Block a suite or a period - reception yes, management yes". No named permission is involved, and that is deliberate. §7.2''s perm:override_suite_allocation governs ALLOCATING A BOOKING ONTO a blocked, maintenance, not-ready or out-of-service suite, which is public.move_booking''s p_allow_unavailable; taking a suite OUT of service takes nothing from a guest that a receptionist could not already refuse at the desk.

A reason is required. §9.2 wants a suite whose state anybody at the desk can explain, and the audit entry carries the old status, the new one and the reason [§3, INV-13].

Existing claims are not disturbed. Blocking a suite here stops it being allocated from now on; it does not cancel the bookings already on it, and finding out what those are before pressing the button is what public.preview_block_impact is for [§10.3].

It takes the venue-wide advisory lock, so a status change and an allocation cannot interleave and place a guest on a suite in the instant it was being withdrawn.';


comment on function public.block_suite_period(uuid[], timestamptz, timestamptz, text) is
  'Block one or more suites for a period [§9.2, §10.3]. A block is a claim on suite time exactly like a booking, so it is a row in public.suite_occupancy and it goes through internal.allocate_suite - one call per suite with p_suite_id named. There is no second way to take suite time, which is what keeps §7.5 provable [INV-02].

A REASON IS MANDATORY. §9.2 requires it and suite_occupancy_block_has_reason enforces it at database level, so a blank one is refused here with a message rather than at the constraint with a 23514.

p_allow_unavailable is passed true [OUR CHOICE]. §7.2''s permission is about placing a GUEST on an unusable suite; a block places nobody, and refusing to block a suite already flagged maintenance would be an obstruction with no beneficiary. It also keeps the returned is_blocked honest: false then means the time is genuinely taken by something, not that the suite was already flagged.

RETURNS ONE ROW PER REQUESTED SUITE, is_blocked saying whether the claim was taken. A suite whose time is already spoken for is reported, not raised on, because a Management screen blocking five suites needs to know which two collided - which is R-32, results rather than exceptions, for an expected outcome. An unknown suite id IS raised on, with P0002, because that is a caller defect and reporting it as "not blocked" would hide it.

The suites are visited in allocation order, priority then number, and the venue-wide advisory lock is taken once before the loop, so a multi-suite block is atomic against every other allocator rather than five separate races.';


comment on function public.release_suite_block(uuid, text) is
  'Give a blocked or maintenance period back [§9.2, §10.3]. The row is expired BY STATUS - is_active false, status released - and never deleted [R-17], so §9.1''s suite timeline can still explain why the suite was unavailable last Tuesday.

It refuses any claim that is not a block or a maintenance window. A booking or a hold is released by the function that owns it - public.cancel_booking, public.mark_no_show, the expiry sweep - and releasing one here would leave a confirmed booking silently without a suite, which is the §8.2 failure the whole design exists to prevent.

An already released row raises WP014 rather than quietly succeeding, so a double press at the desk is visible instead of writing a second audit entry for a change that did not happen.';


comment on function public.preview_block_impact(uuid[], timestamptz, timestamptz) is
  'THE §10.3 DRY RUN: what would a block break, before Management confirms it. SYSTEM.md 6.5 is explicit that this must be the same allocation logic run read-only, never a second estimator, because an estimator drifts from the code that actually causes the collisions and then reassures somebody wrongly.

internal.allocate_suite writes, so it cannot itself be run in preview. What is shared instead is THE CONFLICT PREDICATE, character for character: is_active, and expires_at is null or expires_at is later than the clock, and blocked_period overlapping the requested range. That is the same three-part test the allocator applies both before and inside the suite lock. If one of the two is ever edited, the other is wrong, and the pgTAP test asserts they agree on a case the constraint decides.

ONE DELIBERATE DIFFERENCE. The allocator uses clock_timestamp() because it may have queued on the advisory lock and must not judge expiry against a clock stopped at BEGIN. This preview takes no lock and stays STABLE, so it uses now(). The gap is at most the age of the transaction and it errs in the safe direction: a hold that expires while the preview runs is still counted as impact, so the screen over-reports rather than under-reports what a block would hit.

It takes the same p_suite_ids array as public.block_suite_period, and refuses an empty one the same way, so the preview cannot be run over a different set of suites from the block it is previewing.

It returns holds as well as bookings, with booking_id null where the claim is a hold, because a guest halfway through checkout is exactly the person a block would strand. It returns suite_number, which is why it is staff-gated and never reachable without a session [INV-01].

Writes nothing. No insert, no update, no audit entry: there is no change to audit, and R-14 attaches to mutations.';


comment on function public.start_cleaning_task(uuid) is
  'Start a clean [§9.2]. The first of the three actions §9.2 names - start, assign, confirm - and the one that moves cleaning_status from pending to in_progress while stamping started_at, which cleaning_tasks_started_is_not_pending requires to move together.

Starting a task that is already started or already confirmed raises WP019 rather than silently restamping, so the §11 operational timings measure the first hands on the suite rather than the last press of a button.';


comment on function public.assign_cleaning_task(uuid, uuid) is
  'Put a name against a clean [§9.2]. Assignment is a column and not a state, so it can happen before or after the clean starts, which is why this function does not move cleaning_status. A null p_staff_id unassigns, because an unassigned task is a real state the Reception list needs to show first.

A confirmed task cannot be reassigned: the work is done and rewriting who did it after the fact would corrupt the only operational record of it. The audit entry carries the previous assignee.';


comment on function public.confirm_cleaning_task(uuid, text) is
  'Confirm the suite is clean [§9.2]. Sets cleaning_status to confirmed with confirmed_at and confirmed_by, which cleaning_tasks_confirmed_carries_time requires to move together, and records the note if one was given.

IT DOES NOT TOUCH public.suite_occupancy, AND THAT IS THE POINT [Q-16]. §7.1 gives the cleaning buffer the job of protecting the next start, and the buffer is already inside blocked_period, so the suite returns to availability when the buffer elapses whether or not anybody pressed confirm. Making availability wait on this function would put a human action in front of the exclusion constraint and give the venue two sources of truth about who holds a suite. supercut4 records the client proposing exactly that; it is video, not contract, and doc 1 wins until Q-16 is answered. If it comes back the other way it is a migration and a change to the allocator, taken deliberately.

It does not resolve the §9.3 cleaning_unconfirmed alert either. reconcileAlerts in src/lib/domain/alerts resolves an alert by no longer detecting it, and confirmed_at being set is precisely what stops cleaningUnconfirmed firing. An alert closed from here as well would be closed twice and, on the pass where the two disagreed, reopened.';


comment on function public.create_task(text, text, uuid, date, public.task_priority) is
  'Raise a task [§10.6]: "Tasks can be assigned to individual Reception or Management users with due date, priority, note and status". assigned_by is taken from the session and never from the caller, so the §10.6 record of who asked cannot be spoofed by an argument.

Both roles may create one. docs/5 §3 reads "Notes, shift handover, tasks, alerts - reception yes, management yes", and §9.2 has Reception working on and completing tasks that either console raised.

p_assigned_to is optional and a task with nobody against it is a real state, not an omission - it is the row a Reception list should show first. p_priority defaults to normal so a task created without a decision does not shout. p_due_on is a DATE because a due date is a calendar day a person works to, never an instant [R-16, INV-24].';


comment on function public.update_task_status(uuid, public.task_status, text) is
  'Move a task along [§10.6]. status and completed_at are written TOGETHER IN BOTH DIRECTIONS, which is what tasks_done_carries_time requires: reaching done stamps the completion and names who completed it, and every other value clears both. A cancelled task carries no completion time, so §11 counts what was actually finished rather than what was merely closed.

done and cancelled are terminal. Moving a finished task again raises WP020 rather than reopening it, because §11 counting completions needs a completion to mean one thing.

p_note is a completion note, and a null or blank one LEAVES THE EXISTING NOTE ALONE rather than clearing it. That is the opposite of public.update_booking_details, which takes the whole state of its two free-text fields; here the caller is changing a status and should not have to resend a note to avoid losing it.';


comment on function public.assign_task(uuid, uuid) is
  'Hand a task to somebody [§10.6]. A null p_staff_id unassigns. assigned_by is refreshed from the session, because the person who reassigned it is the person who now owns the request.

A finished task cannot be reassigned: WP020. Assignment is a routing hint and never a visibility boundary - docs/5 §3 gives both roles every task, and the RLS policy on public.tasks carries no per-assignee filter, so reassigning changes who should act and never who can see.';


comment on function public.open_alert(public.alert_kind, public.alert_severity, text, text, jsonb) is
  'Raise a §9.3 operational alert, IDEMPOTENTLY. reconcileAlerts in src/lib/domain/alerts keys every open alert by kind:entity:entity_id and re-runs on a timer, so opening one that is already open must be a no-op returning the existing row - never a 23505 that fails the whole scan and stops every other alert in the same pass being written.

alerts_open_unique_idx, partial on resolved_at being null, is the guarantee. This function reads through a per-key advisory lock first, so two scans overlapping in time serialise on that key instead of racing to the index and one of them erroring. is_new tells the caller which of the two happened. Once an alert is resolved, detecting the condition again opens A SECOND ROW with its own opened_at, which is what §11.5 counts and what the partial index deliberately permits.

A no-op writes NO audit entry [OUR CHOICE, and a deliberate reading of R-14]. Nothing changed, and a scan running every minute against a dozen open alerts would otherwise bury the manual changes §3 keeps the log for under thousands of entries recording that nothing happened. Opening a row does write one.

The severity is stated by the caller and not derived here. ALERT_SEVERITY in src/lib/domain/alerts owns the mapping, §9.3 grades none of the alerts itself, and duplicating an [OUR CHOICE] grading into SQL would make retuning it a migration.

THIS IS THE ONE FUNCTION FAMILY IN A7 THAT IS NOT STAFF-GATED, AND IT HAS TO BE. §9.3 alerts are raised by a scan running with no user session at all - a cron worker, one of the three permitted service-role call sites - so requiring internal.is_staff() would silently mean no alert is ever raised in production. What it refuses instead is a FORGED identity: a session presenting a staff id that is not an active staff member, which is WP008, the same guard public.hold_suite uses for the unauthenticated guest flow. Reception reaches it through EXECUTE, which is never held by the public role.';


comment on function public.resolve_alert(uuid, text) is
  'Close a §9.3 alert. resolved_by is taken from the session, and a NULL there is meaningful rather than missing: it records that reconcileAlerts closed the alert because the condition stopped being true, not that a person dealt with it. That is why this function carries the same machine-tolerant guard as public.open_alert - the scan resolves as well as opens.

Resolving an already resolved alert raises WP023. The row keeps its resolution_note and its resolved_at forever; §11.5 reports on how long alerts stayed open, so a second close would overwrite the answer.

Resolving does not stop the condition recurring. If the scan detects it again it opens a new row, which is the §11.5 count of how many times something went wrong rather than whether it is wrong now.';


comment on function public.add_shift_note(date, text) is
  'Write the §9.2 shift-handover note. One row per note, keeping its author and its day, so the next shift reads what the last one actually wrote rather than an edited blob.

p_shift_on IS REQUIRED and is never defaulted from the clock. The operating day is a Dubai calendar day and storage is UTC [INV-24], so a database-side current_date would file the first four hours of every Dubai day against yesterday - and a night shift crossing midnight belongs to the day Reception calls it, which only the caller knows. Refusing is the honest answer; guessing would be wrong for four hours out of every twenty-four.

The author comes from the session. shift_notes.author_id is nullable so deactivating an account never removes the note somebody left [§10.6], but a note written now always has one.';


comment on function public.hand_over_shift(uuid) is
  'Mark a shift note as handed over [§9.2]. handed_over_at stays null until it happens, so a note written and never passed on is visible as an unfinished handover instead of being indistinguishable from a completed one - which is the mid-day handover scenario doc 3 names as its own defect class.

Any staff member may hand over, not only the author: a handover is received as much as given, and the audit entry records who pressed it. Handing over twice raises WP024 rather than restamping, because the first time is the one that happened.';


comment on function public.set_customer_warning(uuid, text, boolean, text) is
  'Set a customer warning or block them [§10.5]: "tags, internal notes, warnings and blocked status". Gated on perm:correct_customer_record, which docs/5 §2 derives from §10.5''s "authorised correction or deletion" and grants to management implicitly - a reception account needs the explicit grant, and WP018 says so. Marking somebody blocked stops them booking at all, through the WP012 refusal in public.create_reception_booking, so it is a correction of the record and not a note.

A reason is required and the audit entry carries the old and new value of both fields [§3, INV-13].

The two nulls mean different things, deliberately. A null or blank p_warning_note CLEARS the warning, because clearing is an action a caller takes by sending it. A null p_is_blocked LEAVES THE BLOCKED STATUS ALONE, because a boolean has no third value meaning "unchanged" and defaulting it either way would let a caller editing a note silently unblock somebody.

last_interaction_at is NOT touched. INV-28 deletes personal data 24 months after the last interaction, and counting a staff edit as an interaction would let a customer record renew its own retention indefinitely without the customer ever coming back.';


comment on function public.queue_message(text, public.message_channel, uuid, uuid, text, text, text) is
  'Queue one message [§12]. The row exists before the provider is called, so §11.5 can report on a message that was never delivered - a send that logged nothing on failure is the report''s blind spot.

is_marketing IS COMPUTED HERE AND NEVER TAKEN FROM THE CALLER. It is set to exactly the predicate messages_marketing_matches_template enforces, which is TEMPLATE_KIND in src/lib/domain/messaging: review_request is the one marketing template. This is INV-17 in code as well as in the constraint - flag a booking confirmation as marketing and the marketing kill-switch stops a guest learning their booking exists, silently.

An INACTIVE template is refused with WP021, because §12 gives Management the active switch and queueing past it makes the switch a decoration. A template with NO ROW AT ALL is allowed, and that is not the same case: public.message_templates ships empty by design, and the send path falls back to the rendered templates in src/lib/messaging/templates. Refusing here would mean the first booking confirmation cannot be logged until somebody has configured one. The closed list of keys stays in exactly one place, messages_template_key_known, so an unknown key is refused by the constraint rather than by a second copy of the list that could drift from it.

The address is checked against the channel before the constraint sees it, so a swapped email and mobile number produces a message that names the problem. A WhatsApp message carrying a subject is refused rather than having the subject quietly dropped.';


comment on function public.record_message_attempt(uuid, public.message_status, text, text) is
  'Record what happened when we tried to send [§12, §11.5]. §9.2''s resend is "a recorded attempt, not a silent re-fire", so this increments attempt_count and moves last_attempt_at ON THE MESSAGE BEING RESENT rather than creating a second row - a guest who says they received four confirmations against a log showing one is a dispute nobody can settle [§17.5].

sent_at and failed_at are written in BOTH DIRECTIONS, which messages_sent_carries_time and messages_failed_carries_time require and which §9.3 depends on: src/lib/domain/alerts raises message_failed on failedAt being non-null, and reconcileAlerts resolves an alert only when the scan stops detecting it. A SUCCESSFUL RETRY THAT LEFT failed_at IN PLACE WOULD LEAVE THAT ALERT OPEN FOREVER and train Reception to ignore the alert list. When the failure happened is preserved by last_attempt_at, which is not cleared.

Only sent and failed count as attempts. Requeueing and cancelling are administrative and leave attempt_count where it is, so the §11.5 retry count means calls to the provider.

error carries the LATEST attempt and nothing older, which means a successful retry passing no error clears the text of the failure before it. That is deliberate and it is the same argument as failed_at: the column describes the state the message is in now, not its history. What survives is the audit entry this function writes for every attempt, which keeps each error verbatim with its actor and its timestamp - the §11.5 history lives there and in last_attempt_at, never in a column being read as both current state and archive.

provider_message_id is coalesced rather than overwritten, so a retry that returns no identifier does not erase the one the first attempt got. The column is not unique for the same reason: both identifiers belong to this one message.

A cancelled message is not attempted again: WP022. Re-sending something withdrawn - a reminder for a booking that was cancelled - is exactly the case public.message_status.cancelled exists to make visible.

It carries the same machine-tolerant guard as the alert functions, because the sender is a queue worker with no user session. A Reception resend reaches it through the same EXECUTE grant, and the audit entry names whichever of the two acted.';


revoke all on function public.record_arrival(uuid, timestamptz, text) from public;
revoke all on function public.check_in_booking(uuid, timestamptz, text) from public;
revoke all on function public.check_out_booking(uuid, timestamptz, text) from public;
revoke all on function public.mark_late_arrival(uuid, integer, text) from public;
revoke all on function public.mark_no_show(uuid, text) from public;
revoke all on function public.record_overrun(uuid, timestamptz, text) from public;
revoke all on function public.set_suite_status(uuid, public.suite_status, text) from public;
revoke all on function public.block_suite_period(uuid[], timestamptz, timestamptz, text) from public;
revoke all on function public.release_suite_block(uuid, text) from public;
revoke all on function public.preview_block_impact(uuid[], timestamptz, timestamptz) from public;
revoke all on function public.start_cleaning_task(uuid) from public;
revoke all on function public.assign_cleaning_task(uuid, uuid) from public;
revoke all on function public.confirm_cleaning_task(uuid, text) from public;
revoke all on function public.create_task(text, text, uuid, date, public.task_priority) from public;
revoke all on function public.update_task_status(uuid, public.task_status, text) from public;
revoke all on function public.assign_task(uuid, uuid) from public;
revoke all on function public.open_alert(public.alert_kind, public.alert_severity, text, text, jsonb) from public;
revoke all on function public.resolve_alert(uuid, text) from public;
revoke all on function public.add_shift_note(date, text) from public;
revoke all on function public.hand_over_shift(uuid) from public;
revoke all on function public.set_customer_warning(uuid, text, boolean, text) from public;
revoke all on function public.queue_message(text, public.message_channel, uuid, uuid, text, text, text) from public;
revoke all on function public.record_message_attempt(uuid, public.message_status, text, text) from public;

grant execute on function public.record_arrival(uuid, timestamptz, text)
  to authenticated, service_role;
grant execute on function public.check_in_booking(uuid, timestamptz, text)
  to authenticated, service_role;
grant execute on function public.check_out_booking(uuid, timestamptz, text)
  to authenticated, service_role;
grant execute on function public.mark_late_arrival(uuid, integer, text)
  to authenticated, service_role;
grant execute on function public.mark_no_show(uuid, text)
  to authenticated, service_role;
grant execute on function public.record_overrun(uuid, timestamptz, text)
  to authenticated, service_role;
grant execute on function public.set_suite_status(uuid, public.suite_status, text)
  to authenticated, service_role;
grant execute on function public.block_suite_period(uuid[], timestamptz, timestamptz, text)
  to authenticated, service_role;
grant execute on function public.release_suite_block(uuid, text)
  to authenticated, service_role;
grant execute on function public.preview_block_impact(uuid[], timestamptz, timestamptz)
  to authenticated, service_role;
grant execute on function public.start_cleaning_task(uuid)
  to authenticated, service_role;
grant execute on function public.assign_cleaning_task(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.confirm_cleaning_task(uuid, text)
  to authenticated, service_role;
grant execute on function public.create_task(text, text, uuid, date, public.task_priority)
  to authenticated, service_role;
grant execute on function public.update_task_status(uuid, public.task_status, text)
  to authenticated, service_role;
grant execute on function public.assign_task(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.open_alert(public.alert_kind, public.alert_severity, text, text, jsonb)
  to authenticated, service_role;
grant execute on function public.resolve_alert(uuid, text)
  to authenticated, service_role;
grant execute on function public.add_shift_note(date, text)
  to authenticated, service_role;
grant execute on function public.hand_over_shift(uuid)
  to authenticated, service_role;
grant execute on function public.set_customer_warning(uuid, text, boolean, text)
  to authenticated, service_role;
grant execute on function public.queue_message(text, public.message_channel, uuid, uuid, text, text, text)
  to authenticated, service_role;
grant execute on function public.record_message_attempt(uuid, public.message_status, text, text)
  to authenticated, service_role;
