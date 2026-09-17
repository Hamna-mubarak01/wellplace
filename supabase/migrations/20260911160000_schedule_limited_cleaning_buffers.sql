create function internal.cleaning_closes_at(p_visit tstzrange) returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare
 d date := (lower(p_visit) at time zone 'Asia/Dubai')::date;
 weekday text := (array['sun','mon','tue','wed','thu','fri','sat'])[extract(dow from d)::integer+1];
 regular jsonb; seasonal jsonb; exceptions jsonb; closures jsonb; windows jsonb; season jsonb;
 result timestamptz;
begin
 select value into regular from public.settings where key='hours.regular';
 select value into seasonal from public.settings where key='hours.seasonal';
 select value into exceptions from public.settings where key='hours.exceptions';
 select value into closures from public.settings where key='hours.closures';
 if exists(select 1 from jsonb_array_elements(coalesce(nullif(closures,'null'::jsonb),'[]'::jsonb)) e where d between (e->>'from')::date and (e->>'to')::date) then return null; end if;
 select e->'windows' into windows from jsonb_array_elements(coalesce(nullif(exceptions,'null'::jsonb),'[]'::jsonb)) e where (e->>'date')::date=d limit 1;
 if windows is null then
   select e->'hours' into season from jsonb_array_elements(coalesce(seasonal->'periods','[]'::jsonb)) e where d between (e->>'from')::date and (e->>'to')::date limit 1;
   windows:=coalesce(nullif(season,'null'::jsonb),regular)->weekday;
 end if;
 select min((d+(w->>'closes')::time) at time zone 'Asia/Dubai') into result
 from jsonb_array_elements(coalesce(nullif(windows,'null'::jsonb),'[]'::jsonb)) w
 where lower(p_visit)>=(d+(w->>'opens')::time) at time zone 'Asia/Dubai'
   and upper(p_visit)<=(d+(w->>'closes')::time) at time zone 'Asia/Dubai';
 return result;
end $$;
revoke all on function internal.cleaning_closes_at(tstzrange) from public,anon,authenticated,service_role;

create function public.booking_buffer_options(p_booking_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
 b public.bookings%rowtype; o public.suite_occupancy%rowtype; suite_status public.suite_status;
 closes timestamptz; next_start timestamptz; deadline timestamptz; observed_at timestamptz:=clock_timestamp();
 available boolean; unavailable_reason text;
begin
 if not internal.is_staff() then raise exception 'Sign in to manage cleaning time.' using errcode='42501'; end if;
 select * into b from public.bookings where id=p_booking_id;
 if b.id is null then raise exception 'This booking could not be found.' using errcode='P0002'; end if;
 select * into o from public.suite_occupancy where id=b.occupancy_id;
 select status into suite_status from public.suites where id=b.suite_id;
 closes:=internal.cleaning_closes_at(b.experience_period);
 select min(lower(other.blocked_period)) into next_start from public.suite_occupancy other
 where other.suite_id=b.suite_id and other.id is distinct from o.id and other.is_active
   and (other.expires_at is null or other.expires_at>observed_at)
   and upper(other.blocked_period)>upper(b.experience_period);
 deadline:=case when closes is null then null else least(closes,coalesce(next_start,closes)) end;
 available:=coalesce(o.is_active,false) and (o.expires_at is null or o.expires_at>observed_at)
   and b.status in ('held','awaiting_payment','payment_failed','confirmed','checked_in','completed');
 if b.status='completed' and upper(o.blocked_period)<=observed_at and suite_status not in ('cleaning','not_ready') then available:=false; end if;
 if b.status='completed' and exists(select 1 from public.suite_occupancy newer where newer.suite_id=b.suite_id and newer.id<>o.id and newer.is_active and newer.kind='booking' and lower(newer.experience_period)>=upper(b.experience_period) and lower(newer.experience_period)<=observed_at) then available:=false; end if;
 if not available then unavailable_reason:='This visit no longer holds the suite. Open its current booking or update the suite status.';
 elsif closes is null then available:=false; unavailable_reason:='No opening window covers this visit. Ask Management to review the opening hours.';
 elsif deadline<=observed_at and upper(b.experience_period)<=observed_at then available:=false; unavailable_reason:=case when next_start<=closes then 'The next reservation has started. Move it to another suite before extending this cleaning time.' else 'WellPlace has closed for this visit. Cleaning time cannot extend past closing.' end;
 end if;
 return jsonb_build_object('bookingId',b.id,'endsAt',upper(b.experience_period),'currentMinutes',coalesce(b.cleaning_buffer_minutes,internal.setting_integer('cleaning.buffer_minutes')),
 'defaultMinutes',internal.setting_integer('cleaning.buffer_minutes'),'maxMinutes',case when deadline is null then 0 else greatest(0,floor(extract(epoch from (deadline-upper(b.experience_period)))/60)::integer) end,
 'limitAt',deadline,'limitKind',case when next_start<=closes then 'next_reservation' else 'closing' end,
 'canEdit',available,'canShorten',internal.has_permission('override_suite_allocation'::public.named_permission),'message',unavailable_reason);
end $$;
revoke all on function public.booking_buffer_options(uuid) from public,anon;
grant execute on function public.booking_buffer_options(uuid) to authenticated;

create or replace function public.override_booking_buffer(p_booking_id uuid,p_buffer_minutes integer,p_reason text)
returns table(booking_id uuid,occupancy_id uuid,cleaning_buffer_minutes integer,blocked_to timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare
 b public.bookings%rowtype; o public.suite_occupancy%rowtype; options jsonb; finish timestamptz;
begin
 if not internal.is_staff() then raise exception 'Sign in to manage cleaning time.' using errcode='42501'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 1 and 500 then raise exception 'Enter a reason of up to 500 characters.' using errcode='22023'; end if;
 if p_buffer_minutes is null or p_buffer_minutes<0 then raise exception 'Enter a whole number of minutes, zero or more.' using errcode='WP006'; end if;
 perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);
 perform internal.release_expired_occupancy();
 perform 1 from public.settings where key like 'hours.%' or key='cleaning.buffer_minutes' order by key for share;
 select * into b from public.bookings where id=p_booking_id for update;
 if b.id is null then raise exception 'This booking could not be found.' using errcode='P0002'; end if;
 select * into o from public.suite_occupancy where id=b.occupancy_id for update;
 perform 1 from public.suites where id=b.suite_id for update;
 options:=public.booking_buffer_options(p_booking_id);
 if not (options->>'canEdit')::boolean then raise exception '%',options->>'message' using errcode='WP069'; end if;
 if p_buffer_minutes<(options->>'currentMinutes')::integer and not (options->>'canShorten')::boolean then raise exception 'Shortening cleaning time needs Management permission.' using errcode='WP035'; end if;
 if p_buffer_minutes>(options->>'maxMinutes')::integer then raise exception 'Cleaning must finish by % (%). Move the next reservation or use less time.',options->>'limitAt',options->>'limitKind' using errcode='WP068'; end if;
 finish:=upper(b.experience_period)+make_interval(mins=>p_buffer_minutes);
 if p_buffer_minutes>(options->>'currentMinutes')::integer and finish<=clock_timestamp() then raise exception 'Choose a cleaning end time later than now.' using errcode='WP070'; end if;
 begin
   update public.suite_occupancy set blocked_period=tstzrange(lower(o.experience_period),finish,'[)'),cleaning_buffer_minutes=p_buffer_minutes where id=o.id;
 exception when exclusion_violation then raise exception 'Another reservation now needs this suite. Refresh the available cleaning time.' using errcode='WP068'; end;
 update public.bookings set cleaning_buffer_minutes=p_buffer_minutes where id=b.id;
 perform internal.write_audit('override_booking_buffer','public.suite_occupancy',o.id::text,
 jsonb_build_object('cleaning_buffer_minutes',b.cleaning_buffer_minutes,'blocked_to',upper(o.blocked_period)),
 jsonb_build_object('booking_id',b.id,'reference',b.reference,'suite_id',b.suite_id,'cleaning_buffer_minutes',p_buffer_minutes,'blocked_to',finish),btrim(p_reason));
 return query select b.id,o.id,p_buffer_minutes,finish;
end $$;
comment on function internal.cleaning_closes_at(tstzrange) is '[§10.2; CLIENT buffer instruction] Dubai closing time for the opening window containing the visit. Full closures override exceptions, seasonal hours and the regular week.';
comment on function public.booking_buffer_options(uuid) is '[CLIENT buffer instruction] Staff-only live cleaning limits. Reception may extend with a reason until the next active reservation starts or the containing opening window closes. Expired checkout holds do not consume time. A completed but unreleased suite remains editable.';
comment on function public.override_booking_buffer(uuid,integer,text) is '[§7.1; CLIENT buffer instruction] All active Reception staff may extend a specific booking buffer with an audited reason. Shortening retains the existing named permission. The database rechecks current opening hours, next reservation, occupancy and release state under allocation locks. No fixed four-hour cap.';
