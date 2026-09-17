begin;
select plan(4);

insert into public.staff (id, email, full_name, role) values
  ('e7100000-0000-4000-8000-000000000001', 'paid.desk@example.test', 'Paid Desk', 'reception');

create temp table made (label text primary key, booking_id uuid);
grant all on made to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"e7100000-0000-4000-8000-000000000001","email":"paid.desk@example.test"}';

create function pg_temp.book(p_email text, p_starts timestamptz, p_method public.payment_method, p_total integer)
returns uuid language sql as $$
  select c.booking_id from public.create_reception_booking_paid(
    p_source => 'walk_in', p_salutation => 'mr', p_first_name => 'Paid', p_last_name => 'Guest',
    p_email => p_email, p_date_of_birth => date '1990-05-05', p_phone_e164 => '+971501234567', p_phone_country => 'AE',
    p_starts_at => p_starts,
    p_duration_hours => (select (s.value -> 0)::integer from public.settings s where s.key = 'booking.durations_hours'),
    p_buffer_minutes => (select (s.value #>> '{}')::integer from public.settings s where s.key = 'cleaning.buffer_minutes'),
    p_adults => 2, p_child_ages => array[]::integer[], p_addons => '[]'::jsonb,
    p_personal_request => '', p_internal_note => '',
    p_price => jsonb_build_object('subtotal_fils', p_total, 'discount_fils', 0, 'addons_fils', 0, 'service_fee_fils', 0, 'tax_fils', 0, 'total_fils', p_total, 'voucher_code', null),
    p_is_complimentary => false,
    p_acceptance => (select jsonb_agg(jsonb_build_object('document_slug', slug, 'document_version', '1.0', 'checkbox_text', 'I accept the terms.'))
                       from unnest(array['legal-terms', 'privacy-policy', 'marketing-terms']) slug),
    p_reason => 'Created at Reception',
    p_payment_method => p_method) c
$$;

insert into made select 'card', pg_temp.book('paid.card@example.test', timestamptz '2031-02-03 10:00+04', 'card_terminal', 66000);

select is(
  (select jsonb_build_object('booking', b.status, 'payments', count(p.id), 'method', min(p.method::text), 'payment', min(p.status::text), 'paid_is_total', bool_and(p.amount_fils = b.total_fils))
     from public.bookings b join public.payments p on p.booking_id = b.id
    where b.id = (select booking_id from made where label = 'card')
    group by b.status),
  '{"booking": "confirmed", "payments": 1, "method": "card_terminal", "payment": "paid", "paid_is_total": true}'::jsonb,
  'a booking made at the desk is confirmed and paid in full at once, by the method chosen [Project owner''s direction, 17 September 2026]');

insert into made select 'cash', pg_temp.book('paid.cash@example.test', timestamptz '2031-02-04 10:00+04', 'cash', 66000);

select is(
  (select p.method::text from public.payments p where p.booking_id = (select booking_id from made where label = 'cash')),
  'cash',
  'cash is recorded as cash');

select throws_ok(
  $$select pg_temp.book('paid.link@example.test', timestamptz '2031-02-05 10:00+04', 'payment_link', 66000)$$,
  'WP066', null,
  'a desk booking cannot be left waiting on a payment link — only cash or card is accepted');

select is(
  (select count(*)::integer from public.bookings b join public.customers c on c.id = b.customer_id where c.email = 'paid.link@example.test'),
  0,
  'the refused booking left nothing behind');

select * from finish();
rollback;
