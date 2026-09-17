alter table public.message_templates
  add column footer text check (footer is null or length(footer) <= 4000);

comment on column public.message_templates.footer is
  '[OUR CHOICE; owner request 12 September 2026] Footer applied across email templates. Used by built-in messages without materialising or publishing their bodies. A document footer takes precedence for individually edited and published templates.';

create or replace view public.message_documents with (security_invoker = true) as
select
  t.key, t.channel, t.is_active, t.is_marketing, t.subject, t.preheader,
  t.body, t.timing_minutes, t.document, t.draft_document,
  t.draft_subject, t.draft_preheader,
  t.document is not null as is_published,
  t.draft_document is not null as has_draft,
  coalesce(jsonb_array_length(t.document -> 'blocks'), 0) as published_blocks,
  coalesce(jsonb_array_length(t.draft_document -> 'blocks'), 0) as draft_blocks,
  t.document_updated_at, t.draft_updated_at, t.updated_at, t.footer
from public.message_templates t;

drop function public.message_document_for_send(text);
create function public.message_document_for_send(p_key text)
returns table (subject text, preheader text, document jsonb, is_active boolean, is_marketing boolean, footer text)
language sql stable security definer set search_path = ''
as $$
  select t.subject, t.preheader, t.document, t.is_active, t.is_marketing, t.footer
  from public.message_templates t where t.key = p_key
$$;
revoke all on function public.message_document_for_send(text) from public, anon, authenticated;
grant execute on function public.message_document_for_send(text) to service_role;
comment on function public.message_document_for_send(text) is
  '[§12, §13; OUR CHOICE] Service-only published wording and footer for one email. Never returns draft content. Preserves the send reader access boundary.';

create function public.apply_email_footer_to_all(p_footer text, p_keys text[])
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
    v_old := jsonb_build_object('footer', v_row.footer, 'document', v_row.document, 'draft_document', v_row.draft_document);
    update public.message_templates t set
      footer = p_footer,
      document = case when t.document is null then null else jsonb_set(t.document, '{footer}', to_jsonb(p_footer)) end,
      draft_document = case when t.draft_document is null then null else jsonb_set(t.draft_document, '{footer}', to_jsonb(p_footer)) end,
      document_updated_at = case when t.document is null then null else v_now end,
      draft_updated_at = case when t.draft_document is null then null else v_now end
    where t.key = v_row.key;

    perform internal.write_audit(
      'apply_email_footer_to_all', 'public.message_templates', v_row.key, v_old,
      jsonb_build_object('footer', p_footer),
      'Email footer applied to all email templates from the console'
    );
    updated_count := updated_count + 1;
  end loop;
  return next;
end
$$;
revoke all on function public.apply_email_footer_to_all(text, text[]) from public, anon;
grant execute on function public.apply_email_footer_to_all(text, text[]) to authenticated;
comment on function public.apply_email_footer_to_all(text, text[]) is
  '[OUR CHOICE; owner request 12 September 2026] Atomically replaces only footers on the system email keys supplied by the console. Management only, with per-template audit. Existing drafts and publications keep their other fields and states. Missing keys receive only the row needed for a footer; active true preserves the existing absent-template send fallback. WhatsApp rows and branding visibility are unchanged.';
