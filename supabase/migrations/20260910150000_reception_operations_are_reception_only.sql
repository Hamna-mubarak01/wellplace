create or replace function internal.require_desk_operator()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if internal.is_management() then
    raise exception 'The front desk runs the day. Ask Reception to make this change.'
      using errcode = 'WP057';
  end if;
end
$$;

revoke all on function internal.require_desk_operator()
  from public, anon, authenticated, service_role;

comment on function internal.require_desk_operator() is
  '[CLIENT 10 September 2026] A Management account may not open the Reception console, so it may not perform a Reception operation either. Refuses the management role inside the eighteen daily desk functions. The line it draws: plain desk work is refused, and anything the contract attaches to a named permission or to a Management screen is not. Suite status, priority, notes and blocks stay with Management under 10.3; customer warnings under 10.5; tasks and alerts under 10.6; refunds and payment voids under 8; and the two permission-gated actions, set_manual_booking_price under 6.4 and override_booking_buffer under 7.1, stay reachable by whoever actually holds the grant, because 6.4 and 7.2 make those a property of the person rather than of the desk. Existing authentication, permission checks, worker access, transaction boundaries and audit behaviour are unchanged.';

do $$
declare
  v_name text;
  v_function record;
  v_body text;
  v_count integer;
begin
  foreach v_name in array array[
    'create_reception_booking', 'cancel_booking', 'reschedule_booking', 'extend_booking',
    'move_booking', 'update_booking_details', 'record_arrival', 'check_in_booking',
    'check_out_booking', 'mark_no_show', 'record_overrun', 'mark_late_arrival',
    'start_cleaning_task', 'assign_cleaning_task', 'confirm_cleaning_task',
    'record_booking_payment', 'add_shift_note', 'hand_over_shift'
  ]
  loop
    v_count := 0;

    for v_function in
      select p.oid, p.prosrc
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        join pg_language l on l.oid = p.prolang
       where n.nspname = 'public' and p.proname = v_name and l.lanname = 'plpgsql'
    loop
      v_body := regexp_replace(
        v_function.prosrc,
        '(^|\n)begin(\r?\n)',
        '\1begin\2  perform internal.require_desk_operator();\2'
      );

      if v_body = v_function.prosrc then
        raise exception 'No line-anchored entry point found for %', v_name;
      end if;

      if (select count(*) from regexp_matches(v_body, 'perform internal\.require_desk_operator\(\);', 'g')) <> 1 then
        raise exception 'Expected exactly one desk guard in %', v_name;
      end if;

      execute replace(pg_get_functiondef(v_function.oid), v_function.prosrc, v_body);
      v_count := v_count + 1;
    end loop;

    if v_count <> 1 then
      raise exception 'Expected one operational function %, found %', v_name, v_count;
    end if;
  end loop;
end
$$;
