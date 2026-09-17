begin;
select plan(6);
insert into public.staff (id, email, full_name, role, is_active) values
('aaa90000-0000-4000-8000-000000000001','setup.manager@example.test','Setup Manager','management',true),
('aaa90000-0000-4000-8000-000000000002','setup.reception@example.test','Setup Reception','reception',true);
select set_config('request.jwt.claim.sub','aaa90000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.email','setup.manager@example.test',true);
select lives_ok($$select public.set_suite_status((select id from public.suites limit 1),'cleaning','Boundary test')$$,
'[§10.3] Management can change suite status');
select lives_ok($$select public.block_suite_period(array[(select id from public.suites limit 1)],now()+interval '1 day',now()+interval '2 days','Boundary test')$$,
'[§10.3] Management can schedule blocks');
select lives_ok($$select public.hold_suite(now()+interval '1 day',2,20,15)$$,
'[§7.2] Management can allocate through the shared engine');
select ok(has_function_privilege('authenticated','public.set_suite_details(uuid,integer,text,text)','execute'),
'[§10.3] Audited priority and note editor is restored');
select set_config('request.jwt.claim.sub','aaa90000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.email','setup.reception@example.test',true);
select lives_ok($$select public.set_suite_status((select id from public.suites limit 1),'cleaning','Boundary test')$$,
'[CLIENT] Reception retains daily status controls');
select lives_ok($$select public.block_suite_period(array[(select id from public.suites limit 1)],now()+interval '3 days',now()+interval '4 days','Boundary test')$$,
'[§9.2] Reception retains time-specific blocks');
select * from finish();
rollback;
