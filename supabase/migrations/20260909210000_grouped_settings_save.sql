create or replace function public.set_settings_group(p_changes jsonb, p_reason text)
returns table (saved_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_change jsonb;
  v_old jsonb;
  v_count integer := 0;
begin
  perform internal.require_management();
  if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes) = 0 then
    raise exception 'Choose settings to save.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_changes) c
    where jsonb_typeof(c) <> 'object' or not (c ?& array['key', 'value', 'expected'])
      or jsonb_typeof(c->'key') <> 'string'
  ) or (select count(*) <> count(distinct c->>'key') from jsonb_array_elements(p_changes) c) then
    raise exception 'Check the settings and try again.' using errcode = '22023';
  end if;
  for v_change in select c from jsonb_array_elements(p_changes) c order by c->>'key' loop
    select s.value into v_old from public.settings s where s.key = v_change->>'key' for update;
    if not found then
      raise exception 'This setting is not available yet.' using errcode = 'WP048';
    end if;
    if coalesce(v_old, 'null'::jsonb) is distinct from v_change->'expected' then
      raise exception 'These settings changed while you were editing. Close and reopen this panel to load the latest values.' using errcode = 'WP060';
    end if;
  end loop;
  for v_change in select c from jsonb_array_elements(p_changes) c order by c->>'key' loop
    if v_change->'value' is distinct from v_change->'expected' then
      perform public.set_setting(v_change->>'key', v_change->'value', p_reason);
      v_count := v_count + 1;
    end if;
  end loop;
  return query select v_count;
end
$$;

comment on function public.set_settings_group(jsonb, text) is
  '[CLIENT] Group related Management settings behind one Save changes action. [OUR CHOICE] Compare and lock the full panel before changing any value; stale edits fail atomically. Each changed value uses the existing audited writer [§3, §10.2].';
revoke all on function public.set_settings_group(jsonb, text) from public, anon;
grant execute on function public.set_settings_group(jsonb, text) to authenticated, service_role;
