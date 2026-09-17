create or replace function public.create_reception_booking_paid(
  p_source            public.booking_source,
  p_salutation        public.salutation,
  p_first_name        text,
  p_last_name         text,
  p_email             text,
  p_date_of_birth     date,
  p_phone_e164        text,
  p_phone_country     text,
  p_starts_at         timestamptz,
  p_duration_hours    integer,
  p_buffer_minutes    integer,
  p_adults            integer,
  p_child_ages        integer[],
  p_addons            jsonb,
  p_personal_request  text,
  p_internal_note     text,
  p_price             jsonb,
  p_is_complimentary  boolean,
  p_acceptance        jsonb,
  p_reason            text,
  p_payment_method    public.payment_method,
  p_customer_id       uuid default null,
  p_suite_id          uuid default null
)
returns table (booking_id uuid, reference text, suite_id uuid, suite_number integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking_id   uuid;
  v_reference    text;
  v_suite_id     uuid;
  v_suite_number integer;
  v_total        integer;
begin
  if p_payment_method is null
     or p_payment_method not in ('cash'::public.payment_method, 'card_terminal'::public.payment_method) then
    raise exception 'Choose how the guest paid: cash or card.' using errcode = 'WP066';
  end if;

  select c.booking_id, c.reference, c.suite_id, c.suite_number
    into v_booking_id, v_reference, v_suite_id, v_suite_number
    from public.create_reception_booking_selected(
      p_source           => p_source,
      p_salutation       => p_salutation,
      p_first_name       => p_first_name,
      p_last_name        => p_last_name,
      p_email            => p_email,
      p_date_of_birth    => p_date_of_birth,
      p_phone_e164       => p_phone_e164,
      p_phone_country    => p_phone_country,
      p_starts_at        => p_starts_at,
      p_duration_hours   => p_duration_hours,
      p_buffer_minutes   => p_buffer_minutes,
      p_adults           => p_adults,
      p_child_ages       => p_child_ages,
      p_addons           => p_addons,
      p_personal_request => p_personal_request,
      p_internal_note    => p_internal_note,
      p_price            => p_price,
      p_is_complimentary => p_is_complimentary,
      p_acceptance       => p_acceptance,
      p_reason           => p_reason,
      p_customer_id      => p_customer_id,
      p_suite_id         => p_suite_id
    ) c
   limit 1;

  select b.total_fils into v_total from public.bookings b where b.id = v_booking_id;

  if coalesce(v_total, 0) > 0 then
    perform public.record_booking_payment(
      v_booking_id, p_payment_method, v_total, null, null, 'Paid in full at the desk when the booking was made'
    );
  end if;

  booking_id := v_booking_id;
  reference := v_reference;
  suite_id := v_suite_id;
  suite_number := v_suite_number;
  return next;
end
$$;

revoke all on function public.create_reception_booking_paid(public.booking_source, public.salutation, text, text, text, date, text, text, timestamptz, integer, integer, integer, integer[], jsonb, text, text, jsonb, boolean, jsonb, text, public.payment_method, uuid, uuid) from public, anon;
grant execute on function public.create_reception_booking_paid(public.booking_source, public.salutation, text, text, text, date, text, text, timestamptz, integer, integer, integer, integer[], jsonb, text, text, jsonb, boolean, jsonb, text, public.payment_method, uuid, uuid) to authenticated;

comment on function public.create_reception_booking_paid(public.booking_source, public.salutation, text, text, text, date, text, text, timestamptz, integer, integer, integer, integer[], jsonb, text, text, jsonb, boolean, jsonb, text, public.payment_method, uuid, uuid) is
  '[Project owner''s direction, 17 September 2026] A guest booked at the desk pays in full there, so a Reception booking is never left awaiting money. Creates the booking through public.create_reception_booking_selected and, in the same transaction, records one payment for the stored booking total by cash or card terminal through public.record_booking_payment, which also issues the invoice. A booking whose total is zero takes no payment. If either step is refused, nothing is saved.';
