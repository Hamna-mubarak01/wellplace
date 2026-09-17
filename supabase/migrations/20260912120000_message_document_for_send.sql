create function public.message_document_for_send(p_key text)
returns table (
  subject      text,
  preheader    text,
  document     jsonb,
  is_active    boolean,
  is_marketing boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.subject, t.preheader, t.document, t.is_active, t.is_marketing
    from public.message_templates t
   where t.key = p_key
$$;

comment on function public.message_document_for_send(text) is
  '[§12, §13; doc 3 §5.6] The published wording for one message, read at the moment an email is sent. THE ONLY READER ON THE SEND PATH, and the reason it exists at all is that three of the six system emails are sent with no user session: the waitlist confirmation, the waitlist signup notification, the contact acknowledgement and the contact notification all originate in anonymous public server actions on the site. public.message_documents is staff-only under message_templates_select_staff, so those sends cannot read their own template, and there is no session for RLS to evaluate.

THE ALTERNATIVES WERE BOTH WORSE. Granting anon a read would put every template, draft included, behind a key the browser holds — INV-01 fails the build on any anon grant for exactly this reason. Widening public.message_documents would loosen a staff boundary for the benefit of a server-side caller that has no user at all. So this is the narrow third way: a definer function executable by service_role alone, which no browser and no staff session can reach.

WHAT IT DELIBERATELY DOES NOT RETURN. No draft_document, draft_subject or draft_preheader, so an unpublished rewrite can never reach a guest — that separation is the whole point of the draft columns and it would be pointless if the send path could see past it. No key, no body, no timing, no stamps, no audit trail: five columns, which is precisely what rendering one email needs and nothing a caller could accumulate into a picture of the console. A key with no row returns no row, and the caller falls back to the coded default in src/lib/config/message-documents.ts.

IT IS A READ. No audit entry and no transaction ceremony: nothing changes, and INV-13 audits changes. Its one call site is src/lib/db/message-templates-send.ts, which is listed in doc 3 §5.6, in SYSTEM.md Part 11 and in the SEC2 allowlist in scripts/check-boundaries.sh. It is modelled on src/lib/db/queries/rate-limit-settings.ts, the same shape of problem: a fixed, named set of rows a server request handler needs before it knows who is asking.';

revoke all on function public.message_document_for_send(text) from public, anon, authenticated;

grant execute on function public.message_document_for_send(text) to service_role;
