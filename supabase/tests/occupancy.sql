

begin;
select plan(9);

insert into public.suites (suite_number, priority) values (101, 1010), (102, 1020);

insert into public.suite_occupancy
  (suite_id, kind, experience_period, blocked_period, cleaning_buffer_minutes)
select id, 'booking',
       tstzrange('2026-09-01 10:00+04', '2026-09-01 11:00+04', '[)'),
       tstzrange('2026-09-01 10:00+04', '2026-09-01 11:20+04', '[)'), 20
from public.suites where suite_number = 101;

select throws_ok(
  $$insert into public.suite_occupancy (suite_id, kind, experience_period, blocked_period, cleaning_buffer_minutes)
    select id,'booking',tstzrange('2026-09-01 11:00+04','2026-09-01 13:00+04','[)'),
           tstzrange('2026-09-01 11:00+04','2026-09-01 13:20+04','[)'),20
    from public.suites where suite_number = 101$$,
  '23P01', null,
  '11:00 start is inside the buffer of an 11:00 finish — rejected [§7.1]');

select throws_ok(
  $$insert into public.suite_occupancy (suite_id, kind, experience_period, blocked_period, cleaning_buffer_minutes)
    select id,'booking',tstzrange('2026-09-01 11:15+04','2026-09-01 13:15+04','[)'),
           tstzrange('2026-09-01 11:15+04','2026-09-01 13:35+04','[)'),20
    from public.suites where suite_number = 101$$,
  '23P01', null,
  '11:15 is still inside the buffer — rejected [§7.1]');

select lives_ok(
  $$insert into public.suite_occupancy (suite_id, kind, experience_period, blocked_period, cleaning_buffer_minutes)
    select id,'booking',tstzrange('2026-09-01 11:30+04','2026-09-01 13:30+04','[)'),
           tstzrange('2026-09-01 11:30+04','2026-09-01 13:50+04','[)'),20
    from public.suites where suite_number = 101$$,
  '11:30 is the next start on the 15-minute grid — accepted [§7.1, INV-06]');

select throws_ok(
  $$insert into public.suite_occupancy (suite_id, kind, status, experience_period, blocked_period, cleaning_buffer_minutes, expires_at)
    select id,'hold','active',tstzrange('2026-09-01 12:00+04','2026-09-01 14:00+04','[)'),
           tstzrange('2026-09-01 12:00+04','2026-09-01 14:20+04','[)'),20, now() + interval '10 minutes'
    from public.suites where suite_number = 101$$,
  '23P01', null,
  'a HOLD cannot overlap an existing BOOKING — one table, one constraint [INV-02]');

select lives_ok(
  $$insert into public.suite_occupancy (suite_id, kind, experience_period, blocked_period, cleaning_buffer_minutes)
    select id,'booking',tstzrange('2026-09-01 11:00+04','2026-09-01 13:00+04','[)'),
           tstzrange('2026-09-01 11:00+04','2026-09-01 13:20+04','[)'),20
    from public.suites where suite_number = 102$$,
  'a free suite may still offer 11:00 [§7.1]');

select lives_ok(
  $$insert into public.suite_occupancy (suite_id, kind, status, is_active, experience_period, blocked_period, cleaning_buffer_minutes, expires_at)
    select id,'hold','expired',false,tstzrange('2026-09-01 11:30+04','2026-09-01 13:30+04','[)'),
           tstzrange('2026-09-01 11:30+04','2026-09-01 13:50+04','[)'),20,'2026-09-01 09:00+04'
    from public.suites where suite_number = 101$$,
  'an expired hold does not block, and the row survives [§11.3, R-17]');

select throws_ok(
  $$insert into public.suite_occupancy (suite_id, kind, experience_period, blocked_period, cleaning_buffer_minutes)
    select id,'booking',tstzrange('2026-09-05 10:00+04','2026-09-05 12:00+04','[)'),
           tstzrange('2026-09-05 10:00+04','2026-09-05 11:00+04','[)'),20
    from public.suites where suite_number = 101$$,
  '23514', null,
  'blocked_period must contain experience_period — the buffer is never negative');

select throws_ok(
  $$insert into public.suite_occupancy (suite_id, kind, experience_period, blocked_period, cleaning_buffer_minutes)
    select id,'hold',tstzrange('2026-09-06 10:00+04','2026-09-06 12:00+04','[)'),
           tstzrange('2026-09-06 10:00+04','2026-09-06 12:20+04','[)'),20
    from public.suites where suite_number = 101$$,
  '23514', null,
  'a hold without expires_at would block forever — rejected [§7.3]');

select throws_ok(
  $$insert into public.suite_occupancy (suite_id, kind, status, is_active, experience_period, blocked_period, cleaning_buffer_minutes, expires_at)
    select id,'hold','expired',true,tstzrange('2026-09-07 10:00+04','2026-09-07 12:00+04','[)'),
           tstzrange('2026-09-07 10:00+04','2026-09-07 12:20+04','[)'),20, now()
    from public.suites where suite_number = 101$$,
  '23514', null,
  'is_active must agree with status, or the exclusion predicate lies [INV-02]');

select * from finish();
rollback;
