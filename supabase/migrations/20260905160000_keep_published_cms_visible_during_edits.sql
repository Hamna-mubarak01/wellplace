-- [§5.1] Draft status describes the editor, not whether the last publication exists.
-- Preserve the existing view shape and grants; never expose draft_data.
create or replace view public.cms_published_content
with (security_invoker = false) as
  select slug, published_data, published_at
    from public.cms_content
   where published_data is not null;

comment on view public.cms_published_content is
  'Last published payload only. Draft saves, resets and restores leave this '
  'snapshot visible until the next publish. Never projects draft_data. [§5.1, INV-01]';
