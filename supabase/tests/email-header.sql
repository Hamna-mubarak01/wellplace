begin;
select plan(8);

insert into public.staff (id, email, full_name, role) values
  ('ee000000-0000-4000-8000-0000000000f1', 'header.manager@example.test', 'Header Manager', 'management'),
  ('ee000000-0000-4000-8000-0000000000f2', 'header.desk@example.test', 'Header Desk', 'reception');

insert into public.message_templates (key, channel, is_active, is_marketing, body, document, document_updated_at)
values ('waitlist_confirmation', 'email', true, false, 'Body', '{"subject":[],"preheader":[],"blocks":[],"footer":"Kept"}', now())
on conflict (key) do update set channel = 'email', document = excluded.document, document_updated_at = excluded.document_updated_at;

delete from public.message_templates where key = 'contact_acknowledgement';

set local role authenticated;
set local request.jwt.claims = '{"sub":"ee000000-0000-4000-8000-0000000000f1","email":"header.manager@example.test"}';

select is(
  (select r.updated_count from public.apply_email_header_to_all(
    '{"logo":"none","logoSrc":"","logoAlt":"","logoWidth":168,"text":"Welcome","align":"left"}'::jsonb,
    array['waitlist_confirmation', 'contact_acknowledgement']) r),
  2,
  'Management applies one header to the chosen email templates');

select throws_ok(
  $$select * from public.apply_email_header_to_all('{"logo":"banner"}'::jsonb, array['waitlist_confirmation'])$$,
  '22023',
  'The header design is not valid.',
  'an unknown logo choice is refused');

select throws_ok(
  $$select * from public.apply_email_header_to_all('{"logo":"none","text":"Welcome"}'::jsonb, array[]::text[])$$,
  '22023',
  'Choose email templates to update.',
  'an empty template list is refused');

set local request.jwt.claims = '{"sub":"ee000000-0000-4000-8000-0000000000f2","email":"header.desk@example.test"}';

select throws_ok(
  $$select * from public.apply_email_header_to_all('{"logo":"none","logoSrc":"","logoAlt":"","logoWidth":168,"text":"","align":"center"}'::jsonb, array['waitlist_confirmation'])$$,
  '42501',
  null,
  'Reception cannot change the email header');

reset role;

select is(
  (select t.header_design ->> 'text' from public.message_templates t where t.key = 'contact_acknowledgement'),
  'Welcome',
  'a template with no saved document still gets the header for its built-in email');

select is(
  (select (t.document ->> 'footer') || '|' || (t.document -> 'headerDesign' ->> 'align') from public.message_templates t where t.key = 'waitlist_confirmation'),
  'Kept|left',
  'a published document takes the header and keeps everything else');

select is(
  (select s.header_design ->> 'text' from public.message_document_for_send('waitlist_confirmation') s),
  'Welcome',
  'the sender reads the published header');

select ok(
  not has_function_privilege('anon', 'public.apply_email_header_to_all(jsonb, text[])', 'execute'),
  'a visitor with no session cannot apply a header');

select * from finish();
rollback;
