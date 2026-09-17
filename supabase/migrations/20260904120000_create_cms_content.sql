create type public.cms_status as enum ('draft', 'published');

create table public.cms_content (
  slug            text primary key,
  status          public.cms_status not null default 'draft',
  draft_data      jsonb not null default '{}'::jsonb,
  published_data  jsonb,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.staff(id),
  published_at    timestamptz,
  published_by    uuid references public.staff(id)
);

comment on table public.cms_content is
  'One row per CMS-managed page. draft_data is what an editor is working on; '
  'published_data is what the public site may read. A field absent from either '
  'falls back to the hardcoded default in src/lib/config, which is what makes '
  '"Set to default" a delete rather than a copy. [§5.1]';

comment on column public.cms_content.published_data is
  'Null until the page has been published once. Never write site content here '
  'directly — publish_cms_page copies the draft across in one transaction.';

create table public.cms_content_versions (
  id            bigint generated always as identity primary key,
  slug          text not null references public.cms_content(slug) on delete cascade,
  data          jsonb not null,
  label         text,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.staff(id),
  created_email text
);

comment on table public.cms_content_versions is
  'Append-only snapshot taken at every publish, so §5.1 version history and '
  'restoration of the last published version are possible.';

create index cms_content_versions_slug_idx
  on public.cms_content_versions (slug, created_at desc);

create trigger cms_content_set_updated_at
  before update on public.cms_content
  for each row execute function internal.set_updated_at();

alter table public.cms_content enable row level security;
alter table public.cms_content_versions enable row level security;

revoke all on public.cms_content from anon, authenticated;
revoke all on public.cms_content_versions from anon, authenticated;
grant select on public.cms_content to authenticated;
grant select on public.cms_content_versions to authenticated;

create policy cms_content_select_staff on public.cms_content
  for select to authenticated
  using (internal.current_staff_id() is not null);

create policy cms_versions_select_management on public.cms_content_versions
  for select to authenticated
  using (internal.is_management());

create or replace function public.save_cms_draft(
  p_slug text,
  p_data jsonb
)
returns public.cms_content
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.cms_content;
  v_row public.cms_content;
begin
  perform internal.require_management();

  select * into v_old from public.cms_content where slug = p_slug;

  insert into public.cms_content (slug, status, draft_data, updated_by)
  values (p_slug, 'draft', p_data, internal.current_staff_id())
  on conflict (slug) do update
    set draft_data = excluded.draft_data,
        status     = 'draft',
        updated_by = excluded.updated_by
  returning * into v_row;

  perform internal.write_audit(
    'cms_draft_saved', 'cms_content', p_slug,
    to_jsonb(v_old.draft_data), to_jsonb(v_row.draft_data), null
  );

  return v_row;
end
$$;

create or replace function public.publish_cms_page(
  p_slug  text,
  p_label text default null
)
returns public.cms_content
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.cms_content;
  v_row public.cms_content;
begin
  perform internal.require_management();

  select * into v_old from public.cms_content where slug = p_slug;

  if v_old.slug is null then
    raise exception 'Nothing to publish for %', p_slug
      using errcode = 'P0002';
  end if;

  update public.cms_content
     set published_data = draft_data,
         status         = 'published',
         published_at   = now(),
         published_by   = internal.current_staff_id()
   where slug = p_slug
  returning * into v_row;

  insert into public.cms_content_versions (slug, data, label, created_by, created_email)
  values (
    p_slug, v_row.published_data, p_label,
    internal.current_staff_id(), internal.current_staff_email()
  );

  perform internal.write_audit(
    'cms_published', 'cms_content', p_slug,
    to_jsonb(v_old.published_data), to_jsonb(v_row.published_data), p_label
  );

  return v_row;
end
$$;

create or replace function public.reset_cms_page(
  p_slug   text,
  p_reason text default null
)
returns public.cms_content
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.cms_content;
  v_row public.cms_content;
begin
  perform internal.require_management();

  select * into v_old from public.cms_content where slug = p_slug;

  if v_old.slug is null then
    return null;
  end if;

  update public.cms_content
     set draft_data = '{}'::jsonb,
         status     = 'draft',
         updated_by = internal.current_staff_id()
   where slug = p_slug
  returning * into v_row;

  perform internal.write_audit(
    'cms_reset_to_default', 'cms_content', p_slug,
    to_jsonb(v_old.draft_data), to_jsonb(v_row.draft_data), p_reason
  );

  return v_row;
end
$$;

create or replace function public.restore_cms_version(
  p_slug       text,
  p_version_id bigint
)
returns public.cms_content
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old     public.cms_content;
  v_version public.cms_content_versions;
  v_row     public.cms_content;
begin
  perform internal.require_management();

  select * into v_version
    from public.cms_content_versions
   where id = p_version_id and slug = p_slug;

  if v_version.id is null then
    raise exception 'Version % not found for %', p_version_id, p_slug
      using errcode = 'P0002';
  end if;

  select * into v_old from public.cms_content where slug = p_slug;

  update public.cms_content
     set draft_data = v_version.data,
         status     = 'draft',
         updated_by = internal.current_staff_id()
   where slug = p_slug
  returning * into v_row;

  perform internal.write_audit(
    'cms_version_restored', 'cms_content', p_slug,
    to_jsonb(v_old.draft_data), to_jsonb(v_row.draft_data),
    'Restored version ' || p_version_id::text
  );

  return v_row;
end
$$;

revoke all on function public.save_cms_draft(text, jsonb) from public, anon, authenticated;
revoke all on function public.publish_cms_page(text, text) from public, anon, authenticated;
revoke all on function public.reset_cms_page(text, text) from public, anon, authenticated;
revoke all on function public.restore_cms_version(text, bigint) from public, anon, authenticated;

grant execute on function public.save_cms_draft(text, jsonb) to authenticated;
grant execute on function public.publish_cms_page(text, text) to authenticated;
grant execute on function public.reset_cms_page(text, text) to authenticated;
grant execute on function public.restore_cms_version(text, bigint) to authenticated;

create or replace view public.cms_published_content
with (security_invoker = true) as
  select slug, published_data, published_at
    from public.cms_content
   where status = 'published' and published_data is not null;

comment on view public.cms_published_content is
  'The only shape the public site reads. Draft content can never leak through it.';

grant select on public.cms_published_content to authenticated;

comment on column public.cms_content.status is
  'No anon grant yet. The public site still renders its built-in content, so '
  'granting anon read here would widen the surface for nothing. The grant and '
  'its INV-01 exemption land together with the change that makes the site read '
  'published CMS content.';
