create or replace function public.set_suite_details(
  p_suite_id      uuid,
  p_priority      integer,
  p_internal_note text,
  p_reason        text
)
returns table (
  suite_id          uuid,
  suite_number      integer,
  priority          integer,
  previous_priority integer,
  internal_note     text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_number       integer;
  v_old_priority integer;
  v_old_note     text;
  v_priority     integer;
  v_note         text := nullif(btrim(coalesce(p_internal_note, '')), '');
begin
  perform internal.require_management();

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'set_suite_details: a reason is required — allocation order is an operational decision and §3 audits every manual change [INV-13]'
      using errcode = '22023';
  end if;

  if p_priority is not null and p_priority < 0 then
    raise exception 'set_suite_details: priority is an ascending ordering key and cannot be negative, got %',
      p_priority
      using errcode = 'WP050';
  end if;

  perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);

  select s.suite_number, s.priority, s.internal_note
    into v_number, v_old_priority, v_old_note
    from public.suites s
   where s.id = p_suite_id
   for update;

  if v_number is null then
    raise exception 'set_suite_details: no suite with id %', p_suite_id
      using errcode = 'P0002';
  end if;

  v_priority := coalesce(p_priority, v_old_priority);

  update public.suites s
     set priority      = v_priority,
         internal_note = v_note
   where s.id = p_suite_id;

  perform internal.write_audit(
    'set_suite_details',
    'public.suites',
    p_suite_id::text,
    jsonb_build_object(
      'suite_number',  v_number,
      'priority',      v_old_priority,
      'internal_note', v_old_note
    ),
    jsonb_build_object(
      'suite_number',  v_number,
      'priority',      v_priority,
      'internal_note', v_note
    ),
    p_reason
  );

  suite_id          := p_suite_id;
  suite_number      := v_number;
  priority          := v_priority;
  previous_priority := v_old_priority;
  internal_note     := v_note;
  return next;
end
$$;


comment on function public.set_suite_details(uuid, integer, text, text) is
  'Edit the two Management-owned fields of a suite [§7.2, §10.3]: the allocation priority and the internal note. Management only, transcribed from docs/5 §3 "Configure allocation priority - reception no, management yes". Status is NOT here: public.set_suite_status owns it, because a status change is an operational act Reception performs at the desk with its own state machine, while priority is configuration.

PRIORITY IS THE ALLOCATOR''S SORT KEY, which is why this takes the same venue-wide advisory lock internal.allocate_suite takes, before it reads the row. §7.2 makes fixed priority the default allocation strategy and internal.allocate_suite orders its candidates by (priority, suite_number) ascending - lower is preferred. Re-ordering the suites while an allocation is choosing between them would let one transaction read half of an old order and half of a new one. Holding the lock costs a few milliseconds and removes the question. WP050 refuses a negative value: the key is ascending and a negative one reads as "unset" to a human without behaving that way.

THE TWO ARGUMENTS ARE DELIBERATELY ASYMMETRIC, because the two columns are. priority is NOT NULL with a default, so it has no "cleared" state and a null p_priority means LEAVE IT AS IT IS. internal_note is nullable, so a null or blank p_internal_note means CLEAR THE NOTE - the same reading public.set_customer_warning gives its own free-text field. Both directions are audited with the old and new value, so a note cleared by accident is recoverable from audit.entries rather than lost.

Returns the suite_number, which is safe here and nowhere near a guest: this function is granted to authenticated only and never to anon [INV-01].';


revoke all on function public.set_suite_details(uuid, integer, text, text) from public;

grant execute on function public.set_suite_details(uuid, integer, text, text)
  to authenticated, service_role;
