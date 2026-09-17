

create table public.suite_occupancy (
  id                uuid primary key default gen_random_uuid(),
  suite_id          uuid not null references public.suites(id),

  kind              public.occupancy_kind   not null,
  status            public.occupancy_status not null default 'active',

  experience_period tstzrange not null,

  blocked_period    tstzrange not null,

  cleaning_buffer_minutes integer not null,

  expires_at        timestamptz,

  is_active         boolean not null default true,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint suite_occupancy_blocked_contains_experience
    check (blocked_period @> experience_period),

  constraint suite_occupancy_periods_bounded
    check (
      not lower_inf(experience_period) and not upper_inf(experience_period)
      and not lower_inf(blocked_period) and not upper_inf(blocked_period)
    ),

  constraint suite_occupancy_buffer_non_negative
    check (cleaning_buffer_minutes >= 0),

  constraint suite_occupancy_hold_has_expiry
    check (kind <> 'hold' or expires_at is not null),

  constraint suite_occupancy_active_matches_status
    check (is_active = (status = 'active')),

  constraint suite_occupancy_no_overlap
    exclude using gist (suite_id with =, blocked_period with &&)
    where (is_active)
);

comment on table public.suite_occupancy is
  'Every claim on a suite''s time: hold, booking, block, maintenance. One '
  'table, because an exclusion constraint only works within one table [§3, §7.5].';

create index suite_occupancy_active_lookup_idx
  on public.suite_occupancy (suite_id, expires_at)
  where is_active;

create index suite_occupancy_expiring_idx
  on public.suite_occupancy (expires_at)
  where is_active and expires_at is not null;

alter table public.suite_occupancy enable row level security;
