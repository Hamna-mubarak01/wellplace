create or replace function public.create_customer(
  p_salutation    public.salutation,
  p_first_name    text,
  p_last_name     text,
  p_email         text,
  p_date_of_birth date,
  p_phone_e164    text,
  p_phone_country text,
  p_internal_note text,
  p_reason        text
)
returns table (
  customer_id uuid,
  reference   text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id        uuid;
  v_reference text;
  v_email     text := lower(btrim(coalesce(p_email, '')));
  v_note      text := nullif(btrim(coalesce(p_internal_note, '')), '');
begin
  if not internal.has_permission('correct_customer_record'::public.named_permission) then
    raise exception 'Your account cannot add customers. Ask a colleague with customer correction permission to help.'
      using errcode = 'WP018';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required for this change.'
      using errcode = '22023';
  end if;

  if exists (select 1 from public.customers c where c.identity_key = internal.normalise_email(v_email)) then
    raise exception 'A customer with this email already exists. Search for them instead.'
      using errcode = 'WP087';
  end if;

  begin
    insert into public.customers as c (
      salutation, first_name, last_name, email, date_of_birth, phone_e164, phone_country, internal_note
    )
    values (
      p_salutation,
      btrim(p_first_name),
      btrim(p_last_name),
      v_email,
      p_date_of_birth,
      btrim(p_phone_e164),
      upper(btrim(p_phone_country)),
      v_note
    )
    returning c.id, c.reference into v_id, v_reference;
  exception when unique_violation then
    raise exception 'A customer with this email already exists. Search for them instead.'
      using errcode = 'WP087';
  end;

  perform internal.write_audit(
    'create_customer',
    'public.customers',
    v_id::text,
    null,
    jsonb_build_object(
      'reference', v_reference,
      'salutation', p_salutation,
      'first_name', btrim(p_first_name),
      'last_name', btrim(p_last_name),
      'email', v_email,
      'date_of_birth', p_date_of_birth,
      'phone_e164', btrim(p_phone_e164),
      'phone_country', upper(btrim(p_phone_country)),
      'internal_note', v_note
    ),
    p_reason
  );

  customer_id := v_id;
  reference := v_reference;
  return next;
end
$$;

comment on function public.create_customer(public.salutation, text, text, text, date, text, text, text, text) is
  '[§10.5; Project owner''s direction, 14 September 2026] Management adds a customer record from the console. Gated on perm:correct_customer_record (WP018). The email is the identity key, so a second record for the same normalised email is refused with WP087 rather than duplicated. The record starts with no bookings, so the list shows it under Leads until a booking is confirmed. Writes its own audit entry.';

create or replace function public.update_customer(
  p_customer_id   uuid,
  p_salutation    public.salutation,
  p_first_name    text,
  p_last_name     text,
  p_date_of_birth date,
  p_phone_e164    text,
  p_phone_country text,
  p_internal_note text,
  p_reason        text
)
returns table (
  customer_id uuid,
  reference   text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old  public.customers%rowtype;
  v_note text := nullif(btrim(coalesce(p_internal_note, '')), '');
begin
  if not internal.has_permission('correct_customer_record'::public.named_permission) then
    raise exception 'Your account cannot edit customers. Ask a colleague with customer correction permission to help.'
      using errcode = 'WP018';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required for this change.'
      using errcode = '22023';
  end if;

  select * into v_old from public.customers c where c.id = p_customer_id for no key update;

  if v_old.id is null then
    raise exception 'This customer could not be found. Refresh the list and try again.'
      using errcode = 'P0002';
  end if;

  update public.customers c
     set salutation    = p_salutation,
         first_name    = btrim(p_first_name),
         last_name     = btrim(p_last_name),
         date_of_birth = p_date_of_birth,
         phone_e164    = btrim(p_phone_e164),
         phone_country = upper(btrim(p_phone_country)),
         internal_note = v_note
   where c.id = p_customer_id;

  perform internal.write_audit(
    'update_customer',
    'public.customers',
    p_customer_id::text,
    jsonb_build_object(
      'salutation', v_old.salutation,
      'first_name', v_old.first_name,
      'last_name', v_old.last_name,
      'date_of_birth', v_old.date_of_birth,
      'phone_e164', v_old.phone_e164,
      'phone_country', v_old.phone_country,
      'internal_note', v_old.internal_note
    ),
    jsonb_build_object(
      'salutation', p_salutation,
      'first_name', btrim(p_first_name),
      'last_name', btrim(p_last_name),
      'date_of_birth', p_date_of_birth,
      'phone_e164', btrim(p_phone_e164),
      'phone_country', upper(btrim(p_phone_country)),
      'internal_note', v_note
    ),
    p_reason
  );

  customer_id := p_customer_id;
  reference := v_old.reference;
  return next;
end
$$;

comment on function public.update_customer(uuid, public.salutation, text, text, date, text, text, text, text) is
  '[§10.5; Project owner''s direction, 14 September 2026] Management corrects a customer''s details. The email is deliberately not a parameter: it is the identity key that ties bookings, invoices and consent history to this person, so it cannot be changed here. Gated on perm:correct_customer_record (WP018). last_interaction_at is not moved, so a staff edit never renews retention (INV-28). Writes its own audit entry with the old and new values.';

create or replace function public.delete_customer(
  p_customer_id uuid,
  p_reason      text
)
returns table (
  customer_id uuid,
  reference   text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.customers%rowtype;
begin
  if not internal.has_permission('correct_customer_record'::public.named_permission) then
    raise exception 'Your account cannot delete customers. Ask a colleague with customer correction permission to help.'
      using errcode = 'WP018';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required for this change.'
      using errcode = '22023';
  end if;

  select * into v_old from public.customers c where c.id = p_customer_id for update;

  if v_old.id is null then
    raise exception 'This customer could not be found. Refresh the list and try again.'
      using errcode = 'P0002';
  end if;

  if exists (select 1 from public.bookings b where b.customer_id = p_customer_id)
     or exists (select 1 from public.invoices i where i.customer_id = p_customer_id)
     or exists (select 1 from public.credit_notes n where n.customer_id = p_customer_id)
     or exists (select 1 from public.promo_code_redemptions r where r.customer_id = p_customer_id)
     or exists (select 1 from public.messages m where m.customer_id = p_customer_id) then
    raise exception 'This customer has bookings or messages on record, so they cannot be deleted. Block them instead.'
      using errcode = 'WP088';
  end if;

  delete from public.customers c where c.id = p_customer_id;

  perform internal.write_audit(
    'delete_customer',
    'public.customers',
    p_customer_id::text,
    jsonb_build_object(
      'reference', v_old.reference,
      'first_name', v_old.first_name,
      'last_name', v_old.last_name,
      'email', v_old.email
    ),
    null,
    p_reason
  );

  customer_id := p_customer_id;
  reference := v_old.reference;
  return next;
end
$$;

comment on function public.delete_customer(uuid, text) is
  '[§10.5 "authorised correction or deletion"; Project owner''s direction, 14 September 2026] Management deletes a customer record. Refused with WP088 while bookings, invoices, credit notes, coupon redemptions or messages reference the customer, because those are financial and operational records that must survive; blocking is the alternative. Tags, notes and consent history go with the record. Gated on perm:correct_customer_record (WP018). Writes its own audit entry.';

revoke all on function public.create_customer(public.salutation, text, text, text, date, text, text, text, text) from public;
revoke all on function public.update_customer(uuid, public.salutation, text, text, date, text, text, text, text) from public;
revoke all on function public.delete_customer(uuid, text) from public;

grant execute on function public.create_customer(public.salutation, text, text, text, date, text, text, text, text)
  to authenticated, service_role;
grant execute on function public.update_customer(uuid, public.salutation, text, text, date, text, text, text, text)
  to authenticated, service_role;
grant execute on function public.delete_customer(uuid, text)
  to authenticated, service_role;
