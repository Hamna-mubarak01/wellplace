revoke all on public.waitlist_leads from anon, authenticated;
grant select on public.waitlist_leads to authenticated;

comment on view public.waitlist_leads is
  'The waitlist screen and its CSV export [§5.2]. Carries the calculated age, '
  'which the table deliberately does not store. '
  'NO MARKETING COLUMN [CLIENT 31 Aug 2026]. The separate marketing tick was '
  'removed from the form, so every public signup grants and a per-lead column '
  'would read the same for every row. public.marketing_consent_events keeps the '
  'history and is where an unsubscribe surface will read and write; this view '
  'simply no longer projects it. '
  'security_invoker, so RLS applies to the caller. '
  'DROPPING THIS VIEW DROPS ITS GRANTS. 20260831160000 recreated it without '
  're-issuing them and the Management console lost the list with "permission '
  'denied for view waitlist_leads". Any migration that drops it must end with '
  'revoke all from anon, authenticated and grant select to authenticated.';
