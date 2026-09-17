

create table public.suites (
  id            uuid primary key default gen_random_uuid(),
  suite_number  integer not null unique,
  status        public.suite_status not null default 'available',

  priority      integer not null default 100,

  internal_note text,
  is_active     boolean not null default true,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint suites_suite_number_positive check (suite_number > 0)
);

comment on column public.suites.suite_number is
  'Operational identifier. NEVER exposed to a guest [§3, INV-01].';

create index suites_allocation_order_idx
  on public.suites (priority, suite_number)
  where is_active;

alter table public.suites enable row level security;
