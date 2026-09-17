create table internal.guest_checkout_holds (
  token uuid primary key,
  occupancy_id uuid not null references public.suite_occupancy(id),
  updated_at timestamptz not null default now()
);
revoke all on internal.guest_checkout_holds from public, anon, authenticated, service_role;
comment on table internal.guest_checkout_holds is '[§7.3, §13; OUR CHOICE] Opaque server-cookie ownership of guest holds. No guest identity data. Application roles cannot read tokens or allocations. Expired occupancy records remain available for abandonment reporting.';

create function public.reserve_guest_hold(
  p_token uuid, p_starts_at timestamptz, p_duration_hours integer,
  p_buffer_minutes integer, p_hold_minutes integer, p_expected_settings jsonb
)
returns timestamptz
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_current public.suite_occupancy%rowtype;
  v_allocated record;
  v_row record;
  v_experience tstzrange;
  v_expected_count integer;
begin
  if p_token is null or p_starts_at is null or not isfinite(p_starts_at) or p_starts_at < clock_timestamp() then
    raise exception 'Choose an available time.' using errcode = 'WP061';
  end if;
  if jsonb_typeof(p_expected_settings) is distinct from 'object' then
    raise exception 'Refresh the booking rules and try again.' using errcode = 'WP060';
  end if;
  select count(*) into v_expected_count from jsonb_object_keys(p_expected_settings);
  if v_expected_count <> 14 then
    raise exception 'Refresh the booking rules and try again.' using errcode = 'WP060';
  end if;
  for v_row in select key, value from public.settings where key in (
    'hours.regular','hours.seasonal','hours.exceptions','hours.closures',
    'booking.durations_hours','booking.guests_min','booking.guests_max',
    'booking.child_min_age','booking.child_max_age','booking.booker_min_age',
    'booking.start_interval_minutes','booking.max_horizon_days','cleaning.buffer_minutes','hold.minutes'
  ) order by key for share loop
    if not p_expected_settings ? v_row.key or coalesce(v_row.value,'null'::jsonb) is distinct from p_expected_settings -> v_row.key then
      raise exception 'Booking rules changed. Choose your time again.' using errcode = 'WP060';
    end if;
    v_expected_count := v_expected_count - 1;
  end loop;
  if v_expected_count <> 0 then
    raise exception 'Booking rules are unavailable. Try again shortly.' using errcode = 'WP060';
  end if;
  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);
  perform internal.release_expired_occupancy();
  select o.* into v_current from internal.guest_checkout_holds h
    join public.suite_occupancy o on o.id = h.occupancy_id where h.token = p_token for update of o;
  v_experience := tstzrange(p_starts_at, p_starts_at + p_duration_hours * interval '1 hour', '[)');
  if v_current.is_active and v_current.kind = 'hold' and v_current.experience_period = v_experience then
    return v_current.expires_at;
  end if;
  if v_current.is_active and v_current.kind = 'hold' then
    update public.suite_occupancy set is_active = false, status = 'released' where id = v_current.id;
    perform internal.write_audit('release_guest_hold','public.suite_occupancy',v_current.id::text,
      jsonb_build_object('status','active'),jsonb_build_object('status','released'),'Guest selected another time.');
  end if;
  select h.occupancy_id, h.expires_at into v_allocated from public.hold_suite(
    p_starts_at, p_duration_hours, p_buffer_minutes, p_hold_minutes) h;
  if v_allocated.occupancy_id is null then
    raise exception 'That time was just taken. Choose another available time.' using errcode = 'WP061';
  end if;
  insert into internal.guest_checkout_holds(token,occupancy_id) values(p_token,v_allocated.occupancy_id)
    on conflict(token) do update set occupancy_id = excluded.occupancy_id, updated_at = now();
  return v_allocated.expires_at;
end
$$;

create function public.release_guest_hold(p_token uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare v_current public.suite_occupancy%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);
  perform internal.release_expired_occupancy();
  select o.* into v_current from internal.guest_checkout_holds h
    join public.suite_occupancy o on o.id = h.occupancy_id where h.token = p_token for update of o;
  if v_current.is_active and v_current.kind = 'hold' then
    update public.suite_occupancy set is_active = false, status = 'released' where id = v_current.id;
    perform internal.write_audit('release_guest_hold','public.suite_occupancy',v_current.id::text,
      jsonb_build_object('status','active'),jsonb_build_object('status','released'),'Guest changed their visit selection.');
  end if;
end
$$;

revoke all on function public.reserve_guest_hold(uuid,timestamptz,integer,integer,integer,jsonb) from public,anon,authenticated;
revoke all on function public.release_guest_hold(uuid) from public,anon,authenticated;
grant execute on function public.reserve_guest_hold(uuid,timestamptz,integer,integer,integer,jsonb) to service_role;
grant execute on function public.release_guest_hold(uuid) to service_role;
comment on function public.reserve_guest_hold(uuid,timestamptz,integer,integer,integer,jsonb) is '[§7.3, §7.5, §10.2, §13; OUR CHOICE] Guest checkout service gateway after rate limiting, configured visit and age checks. Service credentials are confined to src/lib/db/guest-checkout.ts and its named RPCs/private fee read. Settings are compared and locked before allocating through the shared engine; a failed replacement rolls back the old hold. Replays never extend its expiry. Only expiry reaches the browser; suite identifiers remain internal.';
comment on function public.release_guest_hold(uuid) is '[§7.3, §13] Releases only the active hold owned by the opaque checkout cookie. Converted bookings and abandoned history are preserved.';
