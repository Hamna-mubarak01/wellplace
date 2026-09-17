begin;
select plan(33);

insert into public.staff (id, email, full_name, role) values
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'cms.reception@example.test',  'CMS Reception',  'reception'),
  ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'cms.management@example.test', 'CMS Management', 'management');

select has_table('public', 'cms_content', 'the CMS content table exists [§5.1]');
select has_table('public', 'cms_content_versions', 'version history exists [§5.1]');
select has_view('public', 'cms_published_content', 'the published-only view exists [§5.1]');

select has_function('public', 'save_cms_draft',      'draft save is an RPC [R-02]');
select has_function('public', 'publish_cms_page',    'publish is an RPC [R-02]');
select has_function('public', 'reset_cms_page',      'set-to-default is an RPC [R-02]');
select has_function('public', 'restore_cms_version', 'version restore is an RPC [R-02]');

select ok(
  (select relrowsecurity from pg_class
    where oid = 'public.cms_content'::regclass),
  'RLS is enabled on cms_content [R-13]');
select ok(
  (select relrowsecurity from pg_class
    where oid = 'public.cms_content_versions'::regclass),
  'RLS is enabled on cms_content_versions [R-13]');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1","email":"cms.reception@example.test"}';

select throws_ok(
  $$ select public.save_cms_draft('home', '{"hero":{"title":"Reception wrote this"}}'::jsonb) $$,
  '42501',
  'Management role required',
  'Reception cannot save a CMS draft [§10.6, INV-15]');

select throws_ok(
  $$ select public.publish_cms_page('home') $$,
  '42501',
  'Management role required',
  'Reception cannot publish [§10.6, INV-15]');

set local role authenticated;
set local request.jwt.claims = '{"sub":"b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2","email":"cms.management@example.test"}';

select lives_ok(
  $$ select public.save_cms_draft('home', '{"hero":{"title":"Draft headline"}}'::jsonb) $$,
  'Management can save a draft [§5.1]');

select is(
  (select status::text from public.cms_content where slug = 'home'),
  'draft',
  'a saved page is in draft state [§5.1]');

select is(
  (select published_data from public.cms_content where slug = 'home'),
  null,
  'saving a draft publishes nothing [§5.1]');

select is(
  (select count(*)::int from public.cms_published_content where slug = 'home'),
  0,
  'an unpublished draft is invisible to the published view — draft content '
  'can never reach the public site [§5.1]');

reset role;

select is(
  (select count(*)::int from audit.entries
    where entity = 'cms_content' and action = 'cms_draft_saved'),
  1,
  'saving a draft writes an audit entry [INV-13, R-14]');

set local role authenticated;
set local request.jwt.claims = '{"sub":"b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2","email":"cms.management@example.test"}';

select lives_ok(
  $$ select public.publish_cms_page('home', 'First publish') $$,
  'Management can publish [§5.1]');

select is(
  (select published_data ->> 'hero' from public.cms_content where slug = 'home'),
  '{"title": "Draft headline"}',
  'publishing copies the draft into published_data [§5.1]');

select is(
  (select count(*)::int from public.cms_published_content where slug = 'home'),
  1,
  'the published page is now visible through the published view [§5.1]');

select is(
  (select count(*)::int from public.cms_content_versions where slug = 'home'),
  1,
  'publishing snapshots a version [§5.1]');

select lives_ok(
  $$ select public.save_cms_draft('home', '{"hero":{"title":"Second edit"}}'::jsonb) $$,
  'a further edit reopens the draft [§5.1]');

select is(
  (select published_data ->> 'hero' from public.cms_content where slug = 'home'),
  '{"title": "Draft headline"}',
  'editing after publishing does not disturb what is live [§5.1]');

select is(
  (select published_data ->> 'hero' from public.cms_published_content where slug = 'home'),
  '{"title": "Draft headline"}',
  'the public view retains the published snapshot during a new draft [§5.1]');

select lives_ok(
  $$ select public.reset_cms_page('home', 'Back to the built-in copy') $$,
  'Set to default succeeds [§5.1]');

select is(
  (select draft_data from public.cms_content where slug = 'home'),
  '{}'::jsonb,
  'Set to default empties the draft so every field falls back to the '
  'hardcoded default [§5.1]');

select is(
  (select published_data ->> 'hero' from public.cms_published_content where slug = 'home'),
  '{"title": "Draft headline"}',
  'resetting a draft leaves the last publication visible [§5.1]');

reset role;

select is(
  (select count(*)::int from audit.entries
    where entity = 'cms_content' and action = 'cms_reset_to_default'),
  1,
  'Set to default is audited with its reason [INV-13]');

select is(
  (select reason from audit.entries
    where entity = 'cms_content' and action = 'cms_reset_to_default'),
  'Back to the built-in copy',
  'and the reason the operator gave is what was stored [INV-13, §3]');

set local role authenticated;
set local request.jwt.claims = '{"sub":"b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2","email":"cms.management@example.test"}';

select lives_ok(
  $$ select public.restore_cms_version(
       'home',
       (select id from public.cms_content_versions where slug = 'home' order by id desc limit 1)
     ) $$,
  'a published version can be restored [§5.1]');

select is(
  (select draft_data ->> 'hero' from public.cms_content where slug = 'home'),
  '{"title": "Draft headline"}',
  'restoring brings the snapshot back into the draft [§5.1]');

reset role;
set local role anon;

select is(
  (select count(*)::int from public.cms_published_content),
  1,
  'anon still sees the last publication while a restored version is a draft [§5.1, INV-01]');

select throws_ok(
  'select 1 from public.cms_content',
  '42501',
  null,
  'anon cannot read the cms_content table itself, only the published view '
  '[INV-01]');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2","email":"cms.management@example.test"}';
select public.publish_cms_page('home', 'anon read check');

reset role;
set local role anon;

select is(
  (select published_data ->> 'hero' from public.cms_published_content where slug = 'home'),
  '{"title": "Draft headline"}',
  'once published, anon reads exactly the published payload — this is the read '
  'the public home page makes [§5.1]');

reset role;

select * from finish();
rollback;
