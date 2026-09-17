-- [CLIENT] Navbar CMS accepts ICO favicons alongside PNG uploads.
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not provisioned here; skipping cms-media ICO types';
    return;
  end if;

  update storage.buckets
  set allowed_mime_types = array(
    select distinct mime_type
    from unnest(allowed_mime_types || array['image/vnd.microsoft.icon', 'image/x-icon']) as mime_type
  )
  where id = 'cms-media' and allowed_mime_types is not null;
end
$$;
