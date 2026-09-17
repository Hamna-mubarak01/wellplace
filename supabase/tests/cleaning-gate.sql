begin;
select plan(18);

-- [CLIENT 8 September 2026] This replaces the former optional-gate tests.
update public.suites set is_active=false;
insert into public.suites(id,suite_number,priority,status,is_active) values
 ('c9300000-0000-4000-8000-000000000001',9301,9310,'available',true),
 ('c9300000-0000-4000-8000-000000000002',9302,9320,'available',true);
insert into public.staff(id,email,full_name,role) values
 ('c9320000-0000-4000-8000-000000000001','cleaning.reception@example.test','Cleaning Reception','reception');
set local request.jwt.claims='{"sub":"c9320000-0000-4000-8000-000000000001","email":"cleaning.reception@example.test"}';
insert into public.cleaning_tasks(suite_id,status,due_from) values
 ('c9300000-0000-4000-8000-000000000001','pending','2027-06-01 08:00+00');

select is((select count(*)::int from public.settings where key='cleaning.confirm_gates_availability'),0,'The retired gate is not configurable');
select hasnt_function('internal','awaits_cleaning_confirmation','The obsolete confirmation predicate is removed');
select ok((select bool_and(prosrc not like '%awaits_cleaning_confirmation%' and prosrc not like '%confirm_gates_availability%') from pg_proc where proname in ('allocate_suite','count_available_suites')),'Neither availability path gates on task confirmation');
select is((select remaining from public.count_available_suites(array['2027-06-01 08:00+00'::timestamptz],2,20)),2,'An unconfirmed task alone does not reduce availability');
select is((select suite_id from public.hold_suite('2027-06-01 08:00+00',2,20,10)),'c9300000-0000-4000-8000-000000000001'::uuid,'The allocator agrees and can select the suite with the task');
select is((select remaining from public.count_available_suites(array['2027-06-01 10:19+00'::timestamptz],2,20)),1,'The stored buffer still blocks a start before its end');
select is((select remaining from public.count_available_suites(array['2027-06-01 10:20+00'::timestamptz],2,20)),2,'At the exact buffer end availability returns without a confirmation');
select ok((select suite_id from public.hold_suite('2027-06-01 10:20+00',2,20,10)) is not null,'Allocation succeeds at the buffer boundary with balanced suite selection');

select throws_ok($$select public.set_suite_status('c9300000-0000-4000-8000-000000000001','not_ready',' ')$$,'22023',null,'An unexplained manual hold is refused by Postgres');
select is((select status::text from public.set_suite_status('c9300000-0000-4000-8000-000000000001','not_ready','Deep clean taking longer than the buffer')),'not_ready','Reception can hold the suite until it is ready');
select is((select remaining from public.count_available_suites(array['2027-06-02 10:20+00'::timestamptz],2,20)),1,'A manual hold still excludes the suite after all buffers have elapsed');
select is((select reduced_by_demand from public.count_available_suites(array['2027-06-02 10:20+00'::timestamptz],2,20)),false,'A cleaning delay is not advertised as booking demand');
select is((select suite_id from public.hold_suite('2027-06-02 10:20+00',2,20,10)),'c9300000-0000-4000-8000-000000000002'::uuid,'The allocator skips a manually held suite');
select ok(exists(select 1 from audit.entries where action='set_suite_status' and reason='Deep clean taking longer than the buffer'),'The actual delay explanation is recorded in the audit');
update public.cleaning_tasks set status='confirmed',confirmed_at=now() where suite_id='c9300000-0000-4000-8000-000000000001';
select is((select remaining from public.count_available_suites(array['2027-06-03 10:20+00'::timestamptz],2,20)),1,'Confirming a task does not silently clear a manual hold');
select is((select status::text from public.set_suite_status('c9300000-0000-4000-8000-000000000001','available','Cleaning complete; suite ready')),'available','Reception explicitly releases the manual hold');
select is((select remaining from public.count_available_suites(array['2027-06-03 10:20+00'::timestamptz],2,20)),2,'The released suite immediately returns to availability');
select ok(exists(select 1 from audit.entries where action='set_suite_status' and reason='Cleaning complete; suite ready'),'Releasing the suite is audited too');
select * from finish();
rollback;
