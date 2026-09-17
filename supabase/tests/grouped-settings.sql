begin;
select plan(9);
insert into public.staff (id, email, full_name, role, is_active) values
  ('ab111111-1111-4111-8111-111111111111','panel.manager@example.test','Panel Manager','management',true),
  ('ab222222-2222-4222-8222-222222222222','panel.reception@example.test','Panel Reception','reception',true);
insert into public.settings(key,value,value_type,source_tag,description) values
  ('zz.group.a','1','integer','[OUR CHOICE]','A'),
  ('zz.group.b','2','integer','[OUR CHOICE]','B');
set local request.jwt.claims = '{"sub":"ab222222-2222-4222-8222-222222222222"}';
set local role authenticated;
select throws_ok($$select public.set_settings_group('[{"key":"zz.group.a","value":3,"expected":1}]','edit')$$,'42501',null,'Reception cannot change grouped settings');
reset role;
set local request.jwt.claims = '{"sub":"ab111111-1111-4111-8111-111111111111"}';
set local role authenticated;
select is((select saved_count from public.set_settings_group('[{"key":"zz.group.a","value":3,"expected":1},{"key":"zz.group.b","value":4,"expected":2}]','edit')),2,'Both related values save together');
select throws_ok($$select public.set_settings_group('[{"key":"zz.group.a","value":5,"expected":3},{"key":"zz.group.b","value":6,"expected":2}]','edit')$$,'WP060',null,'A stale value rejects the whole group');
select throws_ok($$select public.set_settings_group('[{"key":"zz.group.a","value":5,"expected":3},{"key":"zz.group.b","value":"bad","expected":4}]','edit')$$,'WP049',null,'A later write failure rolls back earlier writes');
select throws_ok($$select public.set_settings_group('[{"key":"zz.group.a","value":5,"expected":3},{"key":"zz.group.a","value":6,"expected":3}]','edit')$$,'22023',null,'Duplicate keys are rejected');
select is((select saved_count from public.set_settings_group('[{"key":"zz.group.a","value":3,"expected":3},{"key":"zz.group.b","value":4,"expected":4}]','edit')),0,'Unchanged values are not written again');
reset role;
select is((select value::text from public.settings where key='zz.group.a'),'3','Earlier value survived both failures');
select is((select value::text from public.settings where key='zz.group.b'),'4','Other value survived both failures');
select is((select count(*)::integer from audit.entries where entity_id in ('zz.group.a','zz.group.b')),2,'Exactly one audit entry for each changed value');
select * from finish();
rollback;
