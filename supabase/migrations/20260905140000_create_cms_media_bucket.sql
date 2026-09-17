do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not provisioned here; skipping cms-media bucket';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'cms-media',
    'cms-media',
    true,
    52428800,
    array[
      'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif',
      'video/mp4', 'video/webm'
    ]
  )
  on conflict (id) do update
    set public             = excluded.public,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists cms_media_public_read      on storage.objects;
  drop policy if exists cms_media_management_write on storage.objects;
  drop policy if exists cms_media_management_edit  on storage.objects;
  drop policy if exists cms_media_management_erase on storage.objects;

  create policy cms_media_public_read on storage.objects
    for select to anon, authenticated
    using (bucket_id = 'cms-media');

  create policy cms_media_management_write on storage.objects
    for insert to authenticated
    with check (bucket_id = 'cms-media' and internal.is_management());

  create policy cms_media_management_edit on storage.objects
    for update to authenticated
    using (bucket_id = 'cms-media' and internal.is_management())
    with check (bucket_id = 'cms-media' and internal.is_management());

  create policy cms_media_management_erase on storage.objects
    for delete to authenticated
    using (bucket_id = 'cms-media' and internal.is_management());
end
$$;
