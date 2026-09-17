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
        'preheader', t.preheader
      ),
      jsonb_build_object(
        'document',  t.draft_document,
        'preheader', t.draft_preheader
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


create or replace function public.reset_message_template(p_key text)
returns table (
  template_key     text,
  cleared_document boolean,
  cleared_draft    boolean,
  reset_at         timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_key      text        := nullif(btrim(coalesce(p_key, '')), '');
  v_reset_at timestamptz := now();
  v_had_doc  boolean;
  v_had_draft boolean;
  v_old      jsonb;
begin
  perform internal.require_management();

  select
      t.document is not null,
      t.draft_document is not null,
      jsonb_build_object(
        'document',       t.document,
        'preheader',      t.preheader,
        'draft_document', t.draft_document
      )
    into v_had_doc, v_had_draft, v_old
    from public.message_templates t
   where t.key = v_key
   for update;

  if not found or not (v_had_doc or v_had_draft) then
    raise exception 'There is nothing to put back for this message.'
      using errcode = 'WP082';
  end if;

  update public.message_templates t
     set document            = null,
         preheader           = null,
         document_updated_at = null,
         draft_document      = null,
         draft_subject       = null,
         draft_preheader     = null,
         draft_updated_at    = null
   where t.key = v_key;

  perform internal.write_audit(
    'reset_message_template',
    'public.message_templates',
    v_key,
    v_old,
    jsonb_build_object('document', null, 'preheader', null, 'draft_document', null),
    'Email template returned to its built-in wording from the console'
  );

  return query
  select v_key, v_had_doc, v_had_draft, v_reset_at;
end
$$;


comment on function public.publish_message_template(text) is
  '[§5.1] THIS IS THE MOMENT THE WORDING CHANGES FOR A GUEST, and it is the only '
  'one. Saving a draft changes nothing a guest can receive.

  Narrowed 12 September 2026, and the narrowing is load-bearing. This function used '
  'to copy draft_subject into the SUBJECT column as well. It must not, because '
  'subject and body do not belong to the document editor: public.message_templates '
  'carries two wordings for the same row. The document columns feed the block '
  'editor and public.message_document_for_send. The flat subject and body columns '
  'feed the older §12 booking path — src/lib/db/payment-events.ts readAuthoredTemplate '
  'selects is_active, subject and body, and src/lib/messaging/templates/booking.ts '
  'renders a paying guest''s confirmation, failed-payment and refund emails from them.

  While this function wrote subject, publishing a rewrite of booking_confirmation put '
  'a subject full of unresolved {{tokens}} in front of a paying guest, and the server '
  'action that called it flattened the document with SAMPLE values, so one guest''s '
  'confirmation could carry another name, reference and amount. The two wordings now '
  'stay in their own columns, so the block editor cannot reach the booking path at '
  'all. Wiring those three keys onto the document model is the separate change that '
  'makes the editor govern them; until then it must not half-govern them.

  preheader stays because nothing but the document path has ever read it.';

comment on function public.reset_message_template(text) is
  '[§5.1] Clears the published document, its preheader and any draft, so the coded '
  'default in src/lib/config/message-documents.ts governs again. The row survives, '
  'because channel, is_active and timing_minutes are settings rather than wording.

  It leaves subject and body untouched for the reason publish does: those columns '
  'belong to the older §12 booking path, and clearing them would blank a live guest '
  'email that this editor never wrote.';
