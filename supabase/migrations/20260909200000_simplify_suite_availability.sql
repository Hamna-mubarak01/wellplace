do $$
declare
  v_suite public.suites%rowtype;
  v_status public.suite_status;
begin
  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);
  for v_suite in select * from public.suites where not is_active for update loop
    v_status := case when v_suite.status in ('blocked','maintenance','not_ready','out_of_service')
      then v_suite.status else 'out_of_service'::public.suite_status end;
    update public.suites set is_active = true, status = v_status where id = v_suite.id;
    perform internal.write_audit('simplify_suite_availability','public.suites',v_suite.id::text,
      jsonb_build_object('is_active',false,'status',v_suite.status),
      jsonb_build_object('is_active',true,'status',v_status),
      '[OUR CHOICE; client direction] Replace booking inclusion with suite status, preserving unavailability and existing bookings.');
  end loop;
end
$$;

create function public.save_suite_setup(
  p_suite_id uuid, p_suite_number integer, p_display_name text,
  p_create boolean, p_reason text, p_priority integer, p_internal_note text
)
returns table (suite_id uuid, suite_number integer, display_name text, is_active boolean)
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform internal.require_management();
  return query select * from public.configure_suite(
    p_suite_id,p_suite_number,p_display_name,true,p_create,p_reason,p_priority,p_internal_note);
end
$$;
revoke all on function public.save_suite_configuration(uuid,integer,text,boolean,boolean,text) from public,anon,authenticated,service_role;
revoke all on function public.configure_suite(uuid,integer,text,boolean,boolean,text,integer,text) from public,anon,authenticated,service_role;
revoke all on function public.save_suite_setup(uuid,integer,text,boolean,text,integer,text) from public,anon;
grant execute on function public.save_suite_setup(uuid,integer,text,boolean,text,integer,text) to authenticated,service_role;
comment on function public.save_suite_setup(uuid,integer,text,boolean,text,integer,text) is
  '[OUR CHOICE; client direction] New suites accept bookings automatically. Management edits identity, priority and notes [§10.3]; statuses and timed blocks control availability. Edits preserve status and existing bookings. Legacy booking-inclusion RPCs are no longer exposed to application roles.';
