with added as (
  insert into public.settings (key, value, value_type, source_tag, description)
  values
    ('security.waitlist_rate_limit_enabled', 'true'::jsonb, 'boolean', '[CLIENT] optional spam limits', 'Limit repeated waitlist submissions'),
    ('security.contact_rate_limit_enabled', 'true'::jsonb, 'boolean', '[CLIENT] optional spam limits', 'Limit repeated contact messages'),
    ('security.availability_rate_limit_enabled', 'true'::jsonb, 'boolean', '[CLIENT] optional spam limits', 'Limit repeated booking searches')
  on conflict (key) do nothing
  returning key, value
)
select internal.write_audit('initialize_setting', 'public.settings', s.key, null, jsonb_build_object('value', s.value),
  'Add optional spam limit switches, enabled by default to preserve existing protection. [CLIENT 8 September 2026]') from added s;

