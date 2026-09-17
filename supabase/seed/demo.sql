-- ─────────────────────────────────────────────────────────────────────────────
-- Demo booking data.
--
-- Runs after reference-data.sql, which seeds the suites, add-ons, price rules
-- and settings. This file fills the consoles with something to look at: a
-- spread of bookings around today, from every booking source, so the Reception
-- board, the Management lists and the finance screens are not empty on a fresh
-- clone.
--
-- Every guest here is invented. Bookings are created through
-- public.create_reception_booking rather than by inserting rows, so the demo
-- data obeys exactly the same allocation, capacity and pricing rules as a
-- booking taken at the desk.
-- ─────────────────────────────────────────────────────────────────────────────

-- A staff row to act as the author of the seeded bookings. It has no login:
-- the two accounts you actually sign in with are created by
-- `npm run demo:seed`, which needs the Auth service running.
insert into public.staff (id, email, full_name, role, is_active) values
  ('00000000-0000-4000-8000-0000000000da', 'demo.manager@wellplace.example',   'Demo Seed (Management)', 'management', true),
  ('00000000-0000-4000-8000-0000000000de', 'demo.reception@wellplace.example', 'Demo Seed (Reception)',  'reception',  true)
on conflict (id) do update set is_active = true;

do $$
declare
  actor    uuid := '00000000-0000-4000-8000-0000000000de';
  towel    uuid;
  acceptance jsonb := '[{"document_slug":"legal-terms","document_version":"1.0",'
                      '"checkbox_text":"I agree to the Legal, Privacy & Marketing Terms."}]'::jsonb;
  guest    record;
begin
  select id into towel from public.addons where is_active order by sort_order limit 1;

  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', actor, 'email', 'demo.reception@wellplace.example')::text,
    true);

  for guest in
    select *
      from (values
        -- day offset, hour, source, salutation, first, last, adults, children
        (-6, 11, 'telephone', 'ms', 'Riya',   'Shah',    2, array[]::integer[]),
        (-3, 17, 'walk_in',   'mr', 'Omar',   'Faris',   2, array[9]),
        (-1, 13, 'telephone', 'ms', 'Layla',  'Amin',    3, array[]::integer[]),
        ( 0, 10, 'manual',    'mr', 'Noah',   'Bennett', 2, array[]::integer[]),
        ( 0, 17, 'walk_in',   'ms', 'Amira',  'Saleh',   3, array[9, 11]),
        ( 1, 13, 'telephone', 'mr', 'James',  'Okafor',  2, array[]::integer[]),
        ( 2, 10, 'walk_in',   'ms', 'Lena',   'Novak',   2, array[10]),
        ( 5, 17, 'manual',    'mr', 'Ravi',   'Iyer',    3, array[]::integer[]),
        (12, 13, 'telephone', 'ms', 'Maya',   'Chen',    2, array[]::integer[])
      ) as t(day_offset, hour, source, salutation, first_name, last_name, adults, child_ages)
  loop
    perform public.create_reception_booking(
      guest.source::public.booking_source,
      guest.salutation::public.salutation,
      guest.first_name,
      guest.last_name,
      lower(guest.first_name || '.' || guest.last_name || '@example.test'),
      date '1990-01-01' + (guest.adults * 400),
      '+9715000' || lpad((10000 + guest.day_offset * 7 + guest.hour)::text, 5, '0'),
      'AE',
      (current_date + guest.day_offset)::timestamp + make_interval(hours => guest.hour),
      3,
      20,
      guest.adults,
      guest.child_ages,
      case when towel is null or guest.day_offset % 3 <> 0 then '[]'::jsonb
           else jsonb_build_array(jsonb_build_object('addon_id', towel, 'quantity', 2)) end,
      null,
      null,
      -- A self-consistent breakdown: 5% VAT is included in the total.
      jsonb_build_object(
        'subtotal_fils',    33000 * (guest.adults + coalesce(array_length(guest.child_ages, 1), 0)),
        'discount_fils',    0,
        'addons_fils',      0,
        'service_fee_fils', 0,
        'tax_fils',         round(33000 * (guest.adults + coalesce(array_length(guest.child_ages, 1), 0)) * 5.0 / 105.0),
        'total_fils',       33000 * (guest.adults + coalesce(array_length(guest.child_ages, 1), 0))
      ),
      false,
      acceptance,
      'Demo data'
    );
  end loop;

  perform set_config('role', 'none', true);
end $$;
