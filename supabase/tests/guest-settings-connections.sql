begin;
select plan(13);
select ok(not has_function_privilege('anon','public.reserve_guest_hold(uuid,timestamptz,integer,integer,integer,jsonb)','execute'),'[§13] Anonymous clients cannot bypass the rate-limited guest service');
select ok(not has_function_privilege('authenticated','public.reserve_guest_hold(uuid,timestamptz,integer,integer,integer,jsonb)','execute'),'[§13] Staff browser tokens cannot invoke the guest service gateway');
select ok(not has_table_privilege('service_role','internal.guest_checkout_holds','select'),'[INV-01] Ownership and allocation mappings have no application read grant');
create temporary table hold_settings as select jsonb_object_agg(key,value) value from public.settings where key in (
  'hours.regular','hours.seasonal','hours.exceptions','hours.closures',
  'booking.durations_hours','booking.guests_min','booking.guests_max',
  'booking.child_min_age','booking.child_max_age','booking.booker_min_age',
  'booking.start_interval_minutes','booking.max_horizon_days','cleaning.buffer_minutes','hold.minutes');
update public.suites set is_active = false;
insert into public.suites(id,suite_number,priority,status,is_active) values('10101010-1010-4010-8010-101010101010',9901,1,'available',true);
create temporary table held as select public.reserve_guest_hold('10101010-1010-4010-8010-101010101011',now()+interval '1 day',2,35,12,(select value from hold_settings)) expires_at;
select ok((select expires_at between now()+interval '12 minutes' and clock_timestamp()+interval '12 minutes' from held),'[§7.3] The configured hold length determines the real database expiry');
select is((select cleaning_buffer_minutes from public.suite_occupancy where suite_id='10101010-1010-4010-8010-101010101010'),35,'[§7.1] The new hold stores its configured cleaning buffer');
select is((select upper(blocked_period)-upper(experience_period) from public.suite_occupancy where suite_id='10101010-1010-4010-8010-101010101010'),interval '35 minutes','[§7.1] The buffer is part of the exclusion range');
select is(public.reserve_guest_hold('10101010-1010-4010-8010-101010101011',now()+interval '1 day',2,35,20,(select value from hold_settings)),(select expires_at from held),'[§7.3] Replaying a selection does not renew the checkout timer');
select throws_ok($$select public.reserve_guest_hold('10101010-1010-4010-8010-101010101012',now()+interval '1 day',2,35,12,(select value from hold_settings))$$,'WP061',null,'[INV-02] Another guest cannot claim the occupied time');
select throws_ok($$select public.reserve_guest_hold('10101010-1010-4010-8010-101010101011',now()+interval '2 days',2,35,12,(select value || '{"hold.minutes":999}'::jsonb from hold_settings))$$,'WP060',null,'[§10.2] Settings changed since server validation cause a retry');
select is((select count(*)::integer from public.suite_occupancy where suite_id='10101010-1010-4010-8010-101010101010' and is_active),1,'[§7.3] A refused replacement keeps the original hold');
select public.release_guest_hold('10101010-1010-4010-8010-101010101012');
select is((select count(*)::integer from public.suite_occupancy where suite_id='10101010-1010-4010-8010-101010101010' and is_active),1,'[§13] An unrelated checkout token cannot release a hold');
select public.release_guest_hold('10101010-1010-4010-8010-101010101011');
select is((select status::text from public.suite_occupancy where suite_id='10101010-1010-4010-8010-101010101010'),'released','[§7.3] Changing a visit releases its allocation without deleting abandonment history');
select ok(exists(select 1 from audit.entries where action='release_guest_hold' and entity_id in(select id::text from public.suite_occupancy where suite_id='10101010-1010-4010-8010-101010101010')),'[§3] Guest releases have an audit trail');
select * from finish();
rollback;
