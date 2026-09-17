alter table public.message_templates
  add column footer_design jsonb check (footer_design is null or jsonb_typeof(footer_design) = 'object');

comment on column public.message_templates.footer_design is
  '[OUR CHOICE; owner request 12 September 2026] Published fallback footer icon/link design. Individual document footerDesign values take precedence; drafts are never used for live sends.';

create or replace view public.message_documents with (security_invoker = true) as
select
  t.key, t.channel, t.is_active, t.is_marketing, t.subject, t.preheader,
  t.body, t.timing_minutes, t.document, t.draft_document,
  t.draft_subject, t.draft_preheader,
  t.document is not null as is_published,
  t.draft_document is not null as has_draft,
  coalesce(jsonb_array_length(t.document -> 'blocks'), 0) as published_blocks,
  coalesce(jsonb_array_length(t.draft_document -> 'blocks'), 0) as draft_blocks,
  t.document_updated_at, t.draft_updated_at, t.updated_at, t.footer, t.footer_design
from public.message_templates t;

drop function public.message_document_for_send(text);
create function public.message_document_for_send(p_key text)
returns table (subject text, preheader text, document jsonb, is_active boolean, is_marketing boolean, footer text, footer_design jsonb)
language sql stable security definer set search_path = ''
as $$
  select t.subject, t.preheader, t.document, t.is_active, t.is_marketing, t.footer, t.footer_design
  from public.message_templates t where t.key = p_key
$$;
revoke all on function public.message_document_for_send(text) from public, anon, authenticated;
grant execute on function public.message_document_for_send(text) to service_role;
comment on function public.message_document_for_send(text) is
  '[§12, §13; OUR CHOICE] Service-only published wording and footer for one email. Never returns draft content. Preserves the send reader access boundary.';

drop function public.apply_email_footer_to_all(text, text[]);
create function public.apply_email_footer_to_all(p_footer text, p_keys text[], p_design jsonb default null)
returns table (updated_count integer)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_row public.message_templates%rowtype;
  v_old jsonb;
  v_now timestamptz := now();
begin
  perform internal.require_management();
  if p_footer is null or length(p_footer) > 4000 then
    raise exception 'Keep the footer within 4000 characters.' using errcode = '22023';
  end if;
  if p_design is not null and (
    jsonb_typeof(p_design) <> 'object' or
    coalesce(jsonb_typeof(p_design -> 'links'), '') <> 'array'
  ) then
    raise exception 'The footer design must include a links array.' using errcode = '22023';
  end if;
  if p_design is not null and jsonb_array_length(p_design -> 'links') > 16 then
    raise exception 'Keep the footer within 16 links.' using errcode = '22023';
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
    v_old := jsonb_build_object('footer', v_row.footer, 'footerDesign', v_row.footer_design, 'document', v_row.document, 'draft_document', v_row.draft_document);
    update public.message_templates t set
      footer = p_footer,
      footer_design = coalesce(p_design, t.footer_design),
      document = case when t.document is null then null else jsonb_set(t.document, '{footer}', to_jsonb(p_footer)) || case when p_design is null then '{}'::jsonb else jsonb_build_object('footerDesign', p_design) end end,
      draft_document = case when t.draft_document is null then null else jsonb_set(t.draft_document, '{footer}', to_jsonb(p_footer)) || case when p_design is null then '{}'::jsonb else jsonb_build_object('footerDesign', p_design) end end,
      document_updated_at = case when t.document is null then null else v_now end,
      draft_updated_at = case when t.draft_document is null then null else v_now end
    where t.key = v_row.key;

    perform internal.write_audit(
      'apply_email_footer_to_all', 'public.message_templates', v_row.key, v_old,
      jsonb_build_object('footer', p_footer, 'footerDesign', coalesce(p_design, v_row.footer_design)),
      'Email footer applied to all email templates from the console'
    );
    updated_count := updated_count + 1;
  end loop;
  return next;
end
$$;
revoke all on function public.apply_email_footer_to_all(text, text[], jsonb) from public, anon;
grant execute on function public.apply_email_footer_to_all(text, text[], jsonb) to authenticated;
comment on function public.apply_email_footer_to_all(text, text[], jsonb) is
  '[OUR CHOICE; owner request 12 September 2026] Atomically replaces footer text and optional icon/link design on the system email keys supplied by the console. Management only, with per-template audit. Existing drafts and publications keep their other fields and states. Missing keys receive only the row needed for a footer; active true preserves the existing absent-template send fallback. WhatsApp rows and branding visibility are unchanged. A null design preserves existing designs for older callers. Zod validates content at the application boundary; the email renderer also rejects unsafe links.';
