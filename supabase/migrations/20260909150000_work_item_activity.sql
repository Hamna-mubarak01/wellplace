create or replace function public.work_item_activity(p_kind text, p_id uuid)
returns table (
  event_id bigint,
  action text,
  occurred_at timestamptz,
  actor_name text,
  status text,
  assignee_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not internal.is_staff() then
    raise exception 'An active staff session is required' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('task', 'note') then
    raise exception 'Choose a task or handover note' using errcode = '22023';
  end if;
  if (p_kind = 'task' and not exists (select 1 from public.tasks where id = p_id))
     or (p_kind = 'note' and not exists (select 1 from public.shift_notes where id = p_id)) then
    raise exception 'The task or note could not be found' using errcode = 'P0002';
  end if;
  return query
    select e.id, e.action, e.occurred_at,
      internal.staff_display_name(e.actor_id),
      e.new_value ->> 'status',
      case when e.action = 'assign_task' then
        internal.staff_display_name((e.new_value ->> 'assigned_to')::uuid)
      else null::text end
    from audit.entries e
    where e.entity_id = p_id::text
      and ((p_kind = 'task' and e.entity = 'public.tasks'
        and e.action in ('create_task', 'assign_task', 'update_task_status'))
        or (p_kind = 'note' and e.entity = 'public.shift_notes'
        and e.action in ('add_shift_note', 'hand_over_shift')))
    order by e.occurred_at, e.id;
end
$$;

revoke all on function public.work_item_activity(text, uuid) from public, anon;
grant execute on function public.work_item_activity(text, uuid) to authenticated;

comment on function public.work_item_activity(text, uuid) is
  '[CLIENT, D49; §9.2, §10.6] Read a single task or shift note activity trail. Active staff only. Returns event names, staff display names and timestamps for five operational actions; never exposes general audit entries, email addresses, notes, reasons, old values or unrelated entities. Read-only; original audit records remain unchanged.';
