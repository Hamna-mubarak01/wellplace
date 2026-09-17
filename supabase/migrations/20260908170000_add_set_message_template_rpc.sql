create or replace function public.set_message_template(
  p_key            text,
  p_channel        public.message_channel,
  p_is_active      boolean,
  p_subject        text,
  p_body           text,
  p_timing_minutes integer,
  p_reason         text
)
returns table (
  template_key   text,
  channel        public.message_channel,
  is_active      boolean,
  is_marketing   boolean,
  subject        text,
  body           text,
  timing_minutes integer,
  was_created    boolean,
  updated_at     timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key        text    := nullif(btrim(coalesce(p_key, '')), '');
  v_subject    text    := nullif(btrim(coalesce(p_subject, '')), '');
  v_active     boolean := coalesce(p_is_active, true);
  v_marketing  boolean;
  v_existed    boolean;
  v_old        jsonb;
  v_updated_at timestamptz;
begin
  perform internal.require_management();

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'set_message_template: a reason is required — §12 puts the wording that reaches a guest under Management and §3 audits every manual change [INV-13]'
      using errcode = '22023';
  end if;

  select
      true,
      jsonb_build_object(
        'key',            t.key,
        'channel',        t.channel,
        'is_active',      t.is_active,
        'is_marketing',   t.is_marketing,
        'subject',        t.subject,
        'body',           t.body,
        'timing_minutes', t.timing_minutes
      )
    into v_existed, v_old
    from public.message_templates t
   where t.key = v_key
   for update;

  v_existed   := coalesce(v_existed, false);
  v_marketing := (v_key = 'review_request');

  insert into public.message_templates
    (key, channel, is_active, is_marketing, subject, body, timing_minutes)
  values
    (v_key, p_channel, v_active, v_marketing, v_subject, p_body, p_timing_minutes)
  on conflict (key) do update
     set channel        = excluded.channel,
         is_active      = excluded.is_active,
         is_marketing   = excluded.is_marketing,
         subject        = excluded.subject,
         body           = excluded.body,
         timing_minutes = excluded.timing_minutes
  returning
      public.message_templates.channel,
      public.message_templates.is_active,
      public.message_templates.is_marketing,
      public.message_templates.subject,
      public.message_templates.body,
      public.message_templates.timing_minutes,
      public.message_templates.updated_at
    into channel, is_active, is_marketing, subject, body, timing_minutes, v_updated_at;

  perform internal.write_audit(
    case when v_existed then 'set_message_template' else 'create_message_template' end,
    'public.message_templates',
    v_key,
    v_old,
    jsonb_build_object(
      'key',            v_key,
      'channel',        channel,
      'is_active',      is_active,
      'is_marketing',   is_marketing,
      'subject',        subject,
      'body',           body,
      'timing_minutes', timing_minutes
    ),
    p_reason
  );

  template_key := v_key;
  was_created  := not v_existed;
  updated_at   := v_updated_at;
  return next;
end
$$;


comment on function public.set_message_template(text, public.message_channel, boolean, text, text, integer, text) is
  'Create or replace one §12 automatic message template. Management only, transcribed from docs/5 §3 "Edit CMS content, SEO, templates - reception no, management yes". The only writer of public.message_templates; no role holds an INSERT or UPDATE grant on the table [R-02, R-14].

IT VALIDATES ALMOST NOTHING, ON PURPOSE. The rules already live on the table and a second copy in this function would be the drift SYSTEM.md warns about. message_templates_key_known refuses a key outside the closed eleven, which are character-identical to BOOKING_TEMPLATE_KEYS in src/lib/domain/messaging. message_templates_whatsapp_has_no_subject refuses a subject on a WhatsApp template. message_templates_subject_length and message_templates_body_length refuse an empty or oversized one, so a blank body is refused by the table rather than by a rule written twice. message_templates_timing_plausible bounds the offset. Each raises 23514 naming the constraint, which is a more precise answer than any WPnnn this function could invent.

IS_MARKETING IS DERIVED, NOT AN ARGUMENT. message_templates_marketing_matches_kind fixes it as (key = ''review_request'') - that is INV-17 at database level and the §16.1 acceptance test behind it. Letting a caller pass it would make the classification a screen decision, and both ways of getting it wrong are silent: a booking confirmation flagged as marketing disappears when the marketing switch is turned off, and a review request flagged transactional escapes the switch entirely [§11.4]. The function computes it and the constraint checks the computation, so if the two ever disagree the write fails rather than storing a wrong classification.

IT IS A REPLACE, NOT A PATCH. Every column is written from the arguments given, so a caller must send the whole template and not only the field that changed; a null p_is_active takes the column default of true. The audit entry carries the complete old row and the complete new one, which is what §11.5 and §10.6 need to answer "what did this template say when that message went out". The action is create_message_template on first write and set_message_template thereafter, and was_created tells the caller which happened.

WRITING A TEMPLATE IS NOT SWITCHING MESSAGING ON. public.message_templates ships empty and the send path falls back to the rendered templates in src/lib/messaging/templates, so the first row created here starts overriding a fallback for that key alone.';


revoke all on function public.set_message_template(
  text, public.message_channel, boolean, text, text, integer, text
) from public;

grant execute on function public.set_message_template(
  text, public.message_channel, boolean, text, text, integer, text
) to authenticated, service_role;
