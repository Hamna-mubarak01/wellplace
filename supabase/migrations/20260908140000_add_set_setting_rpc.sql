create or replace function public.set_setting(
  p_key    text,
  p_value  jsonb,
  p_reason text
)
returns table (
  setting_key    text,
  setting_value  jsonb,
  value_type     text,
  source_tag     text,
  updated_at     timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key        text := nullif(btrim(coalesce(p_key, '')), '');
  v_value      jsonb;
  v_old_value  jsonb;
  v_type       text;
  v_source     text;
  v_updated_at timestamptz;
  v_json_kind  text;
begin
  perform internal.require_management();

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'set_setting: a reason is required — a configuration change is a manual change and §3 audits every one [INV-13]'
      using errcode = '22023';
  end if;

  select s.value, s.value_type, s.source_tag
    into v_old_value, v_type, v_source
    from public.settings s
   where s.key = v_key
   for update;

  if not found then
    raise exception 'set_setting: % is not a configured setting key — the seeded rows of public.settings are the closed list [§10.2]',
      coalesce(v_key, 'null')
      using errcode = 'WP048';
  end if;

  v_value := case
    when p_value is null then null
    when jsonb_typeof(p_value) = 'null' then null
    else p_value
  end;

  if v_value is not null then
    v_json_kind := jsonb_typeof(v_value);

    if not (
      (v_type = 'integer'  and v_json_kind = 'number'
        and (v_value #>> '{}')::numeric = trunc((v_value #>> '{}')::numeric))
      or (v_type = 'decimal'  and v_json_kind = 'number')
      or (v_type = 'duration' and v_json_kind in ('number', 'string'))
      or (v_type = 'boolean'  and v_json_kind = 'boolean')
      or (v_type = 'string'   and v_json_kind = 'string')
      or (v_type = 'time'     and v_json_kind = 'string')
      or (v_type = 'array'    and v_json_kind = 'array')
      or (v_type = 'object'   and v_json_kind = 'object')
    ) then
      raise exception 'set_setting: % is declared % and a % was supplied [§10.2]',
        v_key, v_type, v_json_kind
        using errcode = 'WP049';
    end if;
  end if;

  update public.settings s
     set value      = v_value,
         updated_by = internal.current_staff_id()
   where s.key = v_key
   returning s.updated_at into v_updated_at;

  perform internal.write_audit(
    'set_setting',
    'public.settings',
    v_key,
    jsonb_build_object('key', v_key, 'value', v_old_value, 'value_type', v_type),
    jsonb_build_object('key', v_key, 'value', v_value, 'value_type', v_type),
    p_reason
  );

  setting_key   := v_key;
  setting_value := v_value;
  value_type    := v_type;
  source_tag    := v_source;
  updated_at    := v_updated_at;
  return next;
end
$$;


comment on function public.set_setting(text, jsonb, text) is
  'Write one §10.2 configuration value. The only writer of public.settings from the application, so every Management change to a business number arrives with an actor, a reason and an audit entry [R-02, R-14, INV-13]. Management only, transcribed from docs/5 §3 "Configure opening hours, booking rules, buffer, hold - reception no, management yes"; Reception reads the same rows through settings_snapshot and cannot change one.

THE KEY LIST IS NOT RESTATED HERE. WP048 is raised when public.settings holds no row for the key, which makes the seeded key set the authority and keeps src/lib/config/registry.ts the single place a key is declared - scripts/generate-seed.mjs prints the rows from it. A second copy of the list in SQL would drift from the registry the moment a key is added, and the drift would be silent in exactly the direction that matters: a Management screen quietly writing a key nothing reads.

WP049 is the type guard. Each row declares its own value_type, and this checks only that the JSON KIND agrees with it - number for integer and decimal, string for string and time, and so on - never the shape or range, which belong to the Zod schema in the registry at the boundary. The check exists because internal.setting_integer and its siblings read these rows inside the allocation path: a string written into cleaning.buffer_minutes would not fail here, it would fail at a booking. An integer additionally has to be whole.

CLEARING A SETTING IS A LEGITIMATE WRITE. A SQL NULL and a JSON null both store NULL, which SYSTEM.md Part 8 defines as "the client has not supplied this value yet" - a working state that every screen must still render [§2]. It is not an error and it is audited like any other change.';


revoke all on function public.set_setting(text, jsonb, text) from public;

grant execute on function public.set_setting(text, jsonb, text)
  to authenticated, service_role;
