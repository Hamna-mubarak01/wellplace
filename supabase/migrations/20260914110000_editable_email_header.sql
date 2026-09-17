alter table public.message_templates
  add column header_design jsonb check (header_design is null or jsonb_typeof(header_design) = 'object');

comment on column public.message_templates.header_design is
  '[OUR CHOICE; project owner''s direction, 14 September 2026] Published fallback email header: logo choice, uploaded logo address, logo width, header wording and alignment. Individual document headerDesign values take precedence; drafts are never used for live sends. Null means the WellPlace wordmark, centred, with no wording.';

create or replace view public.message_documents with (security_invoker = true) as
select
  t.key, t.channel, t.is_active, t.is_marketing, t.subject, t.preheader,
  t.body, t.timing_minutes, t.document, t.draft_document,
  t.draft_subject, t.draft_preheader,
  t.document is not null as is_published,
  t.draft_document is not null as has_draft,
  coalesce(jsonb_array_length(t.document -> 'blocks'), 0) as published_blocks,
  coalesce(jsonb_array_length(t.draft_document -> 'blocks'), 0) as draft_blocks,
  t.document_updated_at, t.draft_updated_at, t.updated_at, t.footer, t.footer_design, t.header_design
from public.message_templates t;

drop function public.message_document_for_send(text);
create function public.message_document_for_send(p_key text)
returns table (subject text, preheader text, document jsonb, is_active boolean, is_marketing boolean, footer text, footer_design jsonb, header_design jsonb)
language sql stable security definer set search_path = ''
as $$
  select t.subject, t.preheader, t.document, t.is_active, t.is_marketing, t.footer, t.footer_design, t.header_design
  from public.message_templates t where t.key = p_key
$$;
revoke all on function public.message_document_for_send(text) from public, anon, authenticated;
grant execute on function public.message_document_for_send(text) to service_role;
comment on function public.message_document_for_send(text) is
  '[§12, §13; OUR CHOICE] Service-only published wording, footer and header for one email. Never returns draft content. Preserves the send reader access boundary.';

create function public.apply_email_header_to_all(p_design jsonb, p_keys text[])
returns table (updated_count integer)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_row public.message_templates%rowtype;
  v_now timestamptz := now();
begin
  perform internal.require_management();
  if p_design is null or jsonb_typeof(p_design) <> 'object'
     or coalesce(p_design ->> 'logo', '') not in ('wordmark', 'custom', 'none') then
    raise exception 'The header design is not valid.' using errcode = '22023';
  end if;
  if length(coalesce(p_design ->> 'text', '')) > 200 then
    raise exception 'Keep the header wording within 200 characters.' using errcode = '22023';
  end if;
  if p_keys is null or cardinality(p_keys) = 0 then
    raise exception 'Choose email templates to update.' using errcode = '22023';
  end if;

  insert into public.message_templates (key, channel, is_active, is_marketing, body)
  select distinct k, 'email'::public.message_channel, true, k = 'review_request', null
  from unnest(p_keys) k
  order by k
  on conflict (key) do nothing;

  updated_count := 0;
  for v_row in
    select t.* from public.message_templates t
    where t.key = any(p_keys) and t.channel = 'email'
    order by t.key for update
  loop
    update public.message_templates t set
      header_design = p_design,
      document = case when t.document is null then null else t.document || jsonb_build_object('headerDesign', p_design) end,
      draft_document = case when t.draft_document is null then null else t.draft_document || jsonb_build_object('headerDesign', p_design) end,
      document_updated_at = case when t.document is null then null else v_now end,
      draft_updated_at = case when t.draft_document is null then null else v_now end
    where t.key = v_row.key;

    perform internal.write_audit(
      'apply_email_header_to_all', 'public.message_templates', v_row.key,
      jsonb_build_object('headerDesign', v_row.header_design, 'document', v_row.document, 'draft_document', v_row.draft_document),
      jsonb_build_object('headerDesign', p_design),
      'Email header applied to all email templates from the console'
    );
    updated_count := updated_count + 1;
  end loop;
  return next;
end
$$;
revoke all on function public.apply_email_header_to_all(jsonb, text[]) from public, anon;
grant execute on function public.apply_email_header_to_all(jsonb, text[]) to authenticated;
comment on function public.apply_email_header_to_all(jsonb, text[]) is
  '[OUR CHOICE; project owner''s direction, 14 September 2026] Atomically replaces the email header design on the system email keys supplied by the console. Management only, with per-template audit. Existing drafts and publications keep their other fields and states. Missing keys receive only the row needed for a header. WhatsApp rows and branding visibility are unchanged. Zod validates the design at the application boundary; the email renderer also rejects an unusable logo address.';
