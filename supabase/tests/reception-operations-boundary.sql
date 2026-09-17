begin;
select plan(14);

insert into public.staff (id, email, full_name, role, is_active) values
('bbb90000-0000-4000-8000-000000000001','desk.manager@example.test','Desk Manager','management',true),
('bbb90000-0000-4000-8000-000000000002','desk.reception@example.test','Desk Reception','reception',true);

insert into public.customers (id, first_name, last_name, email, phone_e164, phone_country) values
('bbb90000-0000-4000-8000-0000000000c1','Desk','Guest','desk.guest@example.test','+971500009001','AE');

insert into public.bookings (id, reference, customer_id, source, status, experience_period, cleaning_buffer_minutes) values
('bbb90000-0000-4000-8000-0000000000b1','WPDESKB01','bbb90000-0000-4000-8000-0000000000c1','telephone','confirmed',
 tstzrange(timestamptz '2041-05-01 10:00+04', timestamptz '2041-05-01 12:00+04', '[)'), 20);

select is(
  (select count(*)::integer
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_reception_booking','cancel_booking','record_arrival','check_in_booking',
        'check_out_booking','mark_no_show','record_overrun','mark_late_arrival',
        'start_cleaning_task','assign_cleaning_task','confirm_cleaning_task',
        'record_booking_payment','add_shift_note','hand_over_shift')
      and position(E'\nbegin\n  perform internal.require_desk_operator();\n' in p.prosrc)
          is distinct from nullif(position(E'\nbegin\n' in p.prosrc), 0)),
  0,
  '[CLIENT] No function bearing a desk name lacks the guard, and none carries it anywhere but as the first executable statement of its outer block. Counting the UNGUARDED ones is what makes an added overload fail here, and pinning the position is what stops a guard parked after a return or inside a comment from passing'
);

select is(
  (select count(*)::integer
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosrc like '%internal.require_desk_operator()%'
      and p.proname in (
        'create_reception_booking','cancel_booking','record_arrival','check_in_booking',
        'check_out_booking','mark_no_show','record_overrun','mark_late_arrival',
        'start_cleaning_task','assign_cleaning_task','confirm_cleaning_task',
        'record_booking_payment','add_shift_note','hand_over_shift')),
  14,
  '[CLIENT] and there are exactly fourteen of them, so a desk function quietly dropped from the set fails here too'
);

select is(
  (select count(*)::integer
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('update_booking_details','reschedule_booking','move_booking','extend_booking')),
  4,
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] The four booking changes Management makes from its own booking page each exist exactly once'
);

select is(
  (select count(*)::integer
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosrc like '%internal.require_desk_operator()%'
      and p.proname in ('update_booking_details','reschedule_booking','move_booking','extend_booking')),
  0,
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] and none of the four carries the desk guard. They are carved out deliberately: a later create or replace that restores the guard fails here'
);

select is(
  (select count(*)::integer
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('update_booking_details','reschedule_booking','move_booking','extend_booking')
      and position(E'\nbegin\n  if not internal.is_staff() then\n' in p.prosrc) > 0),
  4,
  '[§9.2, INV-13] Each carve-out still refuses a caller who is not active staff, as its first executable statement'
);

select is(
  (select count(*)::integer
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosrc like '%internal.require_desk_operator()%'
      and p.proname in (
        'set_suite_status','block_suite_period','release_suite_block','preview_block_impact',
        'set_suite_details','create_task','assign_task','update_task_status','open_alert',
        'resolve_alert','set_customer_warning','record_refund','void_booking_payment',
        'set_manual_booking_price','override_booking_buffer')),
  0,
  '[§10.3, §10.5, §10.6, §8, §6.4, §7.1] Contract capabilities are deliberately not caught by the desk guard. The two permission-gated ones belong to whoever holds the grant, not to the desk'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"bbb90000-0000-4000-8000-000000000001","email":"desk.manager@example.test"}';

select throws_ok(
  $$select public.add_shift_note(current_date,'Manager tried to write a handover note')$$,
  'WP057',
  'The front desk runs the day. Ask Reception to make this change.',
  '[CLIENT] Management is refused a Reception shift note'
);

select throws_ok(
  $$select public.start_cleaning_task('bbb90000-0000-4000-8000-0000000000ff')$$,
  'WP057',
  'The front desk runs the day. Ask Reception to make this change.',
  '[CLIENT] The guard refuses Management before the arguments are even read'
);

select throws_ok(
  $$select public.cancel_booking('bbb90000-0000-4000-8000-0000000000b1','Manager tried to cancel')$$,
  'WP057',
  'The front desk runs the day. Ask Reception to make this change.',
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] Cancellation stays Reception-only'
);

select is(
  (select u.internal_note
     from public.update_booking_details('bbb90000-0000-4000-8000-0000000000b1', null, 'Manager note', 'Edited from the booking page') u),
  'Manager note',
  '[CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] Management edits booking details from its own booking page'
);

select lives_ok(
  $$select public.set_suite_status((select id from public.suites order by suite_number limit 1),'maintenance','Desk boundary test')$$,
  '[§10.3] Management keeps suite status'
);

select lives_ok(
  $$select public.block_suite_period(array[(select id from public.suites order by suite_number limit 1)],now()+interval '80 days',now()+interval '81 days','Desk boundary test')$$,
  '[§10.3] Management keeps scheduled blocks'
);

select lives_ok(
  $$select public.create_task('Desk boundary test','',null,null,'normal'::public.task_priority)$$,
  '[§10.6] Management keeps task assignment'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbb90000-0000-4000-8000-000000000002","email":"desk.reception@example.test"}';

select lives_ok(
  $$select public.add_shift_note(current_date,'Reception wrote a handover note')$$,
  '[§9.2] Reception keeps the desk work the guard reserves for it'
);

reset role;
select * from finish();
rollback;
