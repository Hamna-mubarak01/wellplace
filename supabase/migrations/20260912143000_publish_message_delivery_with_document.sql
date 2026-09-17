create or replace function public.publish_message_template(p_key text)
returns table (
  template_key     text,
  published_blocks integer,
  published_at     timestamptz,
  has_draft        boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key          text        := nullif(btrim(coalesce(p_key, '')), '');
  v_published_at timestamptz := now();
  v_draft        jsonb;
  v_old          jsonb;
  v_new          jsonb;
begin
  perform internal.require_management();

  select
      t.draft_document,
      jsonb_build_object(
        'document',  t.document,
        'preheader', t.preheader,
        'channel', t.channel,
        'is_active', t.is_active,
        'timing_minutes', t.timing_minutes
      ),
      jsonb_build_object(
        'document',  t.draft_document,
        'preheader', t.draft_preheader,
        'delivery', t.draft_document -> 'delivery'
      )
    into v_draft, v_old, v_new
    from public.message_templates t
   where t.key = v_key
   for update;

  if not found or v_draft is null then
    raise exception 'There are no unpublished changes to publish.'
      using errcode = 'WP083';
  end if;

  update public.message_templates t
     set document            = t.draft_document,
         preheader           = t.draft_preheader,
         channel             = coalesce((v_draft -> 'delivery' ->> 'channel')::public.message_channel, t.channel),
         is_active           = coalesce((v_draft -> 'delivery' ->> 'isActive')::boolean, t.is_active),
         timing_minutes      = case when v_draft ? 'delivery' then (v_draft -> 'delivery' ->> 'timingMinutes')::integer else t.timing_minutes end,
         document_updated_at = v_published_at,
         draft_document      = null,
         draft_subject       = null,
         draft_preheader     = null,
         draft_updated_at    = null
   where t.key = v_key;

  perform internal.write_audit(
    'publish_message_template',
    'public.message_templates',
    v_key,
    v_old,
    v_new,
    'Email template published from the console'
  );

  return query
  select
      t.key,
      coalesce(jsonb_array_length(t.document -> 'blocks'), 0),
      t.document_updated_at,
      t.draft_document is not null
    from public.message_templates t
   where t.key = v_key;
end
$$;


comment on function public.publish_message_template(text) is '[§12, §5.1; OUR CHOICE] Publishes wording and its draft delivery settings together. A draft cannot pause a live message or change its channel or timing. Legacy drafts without delivery settings retain existing settings. Flat subject/body remain untouched because the older booking sender owns them. Publication and audit are atomic.';
