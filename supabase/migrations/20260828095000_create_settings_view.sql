

create view public.settings_snapshot
  with (security_invoker = true)
as
  select
    s.key,

    s.value,

    s.value_type,
    s.source_tag,
    s.description,
    s.updated_at
  from public.settings s;

comment on view public.settings_snapshot is
  'The configuration read contract [§10.2]. Shape consumed by snapshotFromRows '
  'in src/lib/config/index.ts. security_invoker, so settings_select_staff applies.';

revoke all on public.settings_snapshot from anon, authenticated;

grant select on public.settings_snapshot to authenticated;
