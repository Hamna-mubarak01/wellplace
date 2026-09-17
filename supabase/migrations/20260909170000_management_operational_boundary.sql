create or replace function internal.require_reception_operator()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if internal.is_management() then
    raise exception 'Daily operations belong to Reception. Management monitors operations and configures suites.'
      using errcode = 'WP057';
  end if;
end
$$;
revoke all on function internal.require_reception_operator() from public, anon, authenticated, service_role;
comment on function internal.require_reception_operator() is
  '[CLIENT 9 September 2026] Management configures and monitors; it cannot act as Reception. Existing RPC authentication, permission checks, worker access, transaction boundaries and audit behavior remain in force after this additional role refusal.';

do $$
declare
  v_name text;
  v_function record;
  v_body text;
  v_count integer;
begin
  foreach v_name in array array[
    'hold_suite', 'create_reception_booking', 'cancel_booking', 'reschedule_booking', 'extend_booking',
    'move_booking', 'update_booking_details', 'record_arrival', 'check_in_booking',
    'check_out_booking', 'mark_no_show', 'record_overrun', 'mark_late_arrival',
    'override_booking_buffer', 'start_cleaning_task', 'assign_cleaning_task',
    'confirm_cleaning_task', 'block_suite_period', 'release_suite_block', 'set_suite_status',
    'record_booking_payment', 'set_manual_booking_price', 'add_shift_note', 'hand_over_shift'
  ]
  loop
    v_count := 0;
    for v_function in
      select p.oid, p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      join pg_language l on l.oid = p.prolang
      where n.nspname = 'public' and p.proname = v_name and l.lanname = 'plpgsql'
    loop
      v_body := regexp_replace(v_function.prosrc, '\mbegin\M', E'begin\n  perform internal.require_reception_operator();', 'i');
      if v_body = v_function.prosrc then
        raise exception 'No entry point found for %', v_name;
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

revoke execute on function public.set_suite_details(uuid, integer, text, text) from authenticated, service_role;
comment on function public.set_suite_details(uuid, integer, text, text) is
  '[CLIENT 9 September 2026] Retired priority/staff-note editor. Kept for historical schema compatibility, with application execution revoked. Suite setup now uses the inventory RPCs.';
