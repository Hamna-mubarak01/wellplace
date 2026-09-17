create or replace view public.cms_published_content
with (security_invoker = false) as
  select slug, published_data, published_at
    from public.cms_content
   where status = 'published' and published_data is not null;

comment on view public.cms_published_content is
  'The only CMS shape the public site reads, and the reason anon holds a grant '
  'here. security_invoker is false so the view itself is the boundary: the '
  'WHERE clause is the guard, anon holds no grant on cms_content, and only '
  'published_data is projected. A draft can never reach a visitor. [§5.1, INV-01]';

grant select on public.cms_published_content to anon;
