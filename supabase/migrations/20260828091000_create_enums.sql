

create type public.suite_status as enum (
  'available',
  'checkout_hold',
  'booked',
  'checked_in',
  'cleaning',
  'blocked',
  'maintenance',
  'not_ready',
  'out_of_service'
);

create type public.occupancy_kind as enum (
  'hold',
  'booking',
  'block',
  'maintenance'
);

create type public.occupancy_status as enum (
  'active',
  'converted',
  'expired',
  'released'
);
