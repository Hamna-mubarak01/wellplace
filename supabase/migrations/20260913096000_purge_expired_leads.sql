create or replace function internal.purge_checkout_progress()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_setting   text;
  v_months    integer;
  cutoff      timestamptz;
  v_customers integer;
  v_messages  integer;
begin
  select s.value #>> '{}' into v_setting
    from public.settings s
   where s.key = 'privacy.retention_months';

  if v_setting is null then
    return;
  end if;

  begin
    v_months := v_setting::integer;
    cutoff := now() - make_interval(months => v_months);
  exception
    when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
      raise warning 'purge_checkout_progress: privacy.retention_months is not a usable whole number of months, so nothing was purged';
      return;
  end;

  update internal.checkout_attempts a
     set snapshot = a.snapshot - 'progress'
    from internal.checkout_sessions s
   where s.token = a.token and s.updated_at < cutoff;

  delete from internal.checkout_sessions where updated_at < cutoff;

  if v_months < 1 then
    raise warning 'purge_checkout_progress: privacy.retention_months is below one month, so no customer was deleted';
    return;
  end if;

  with expired as (
    select c.id
      from public.customers c
     where c.last_interaction_at < cutoff
       and not exists (
         select 1 from public.marketing_consent_events e
          where e.customer_id = c.id and e.occurred_at >= cutoff)
       and not exists (
         select 1 from public.customer_notes n
          where n.customer_id = c.id and n.created_at >= cutoff)
       and not exists (
         select 1 from audit.entries a
          where a.entity = 'public.customers'
            and a.entity_id = c.id::text
            and a.action = 'set_customer_warning'
            and a.occurred_at >= cutoff)
       and not exists (select 1 from public.bookings b where b.customer_id = c.id)
       and not exists (select 1 from public.invoices i where i.customer_id = c.id)
       and not exists (select 1 from public.promo_code_redemptions r where r.customer_id = c.id)
       and not exists (
         select 1 from public.messages m
          where m.customer_id = c.id
            and (m.booking_id is not null or m.created_at >= cutoff))
     for update of c skip locked
  ), removed_messages as (
    delete from public.messages m
     using expired e
     where m.customer_id = e.id
    returning m.id
  ), removed_customers as (
    delete from public.customers c
     using expired e
     where c.id = e.id
    returning c.id
  )
  select (select count(*) from removed_customers), (select count(*) from removed_messages)
    into v_customers, v_messages;

  if v_customers > 0 then
    perform internal.write_audit(
      'purge_expired_leads',
      'public.customers',
      null,
      null,
      jsonb_build_object('customers', v_customers, 'messages', v_messages),
      'Customers with no booking removed after the privacy retention period [INV-28, R-46]'
    );
  end if;
end
$$;

revoke all on function internal.purge_checkout_progress() from public, anon, authenticated, service_role;

comment on function internal.purge_checkout_progress() is
  '[§6.3; INV-28; R-46; CONFIRMED] The daily retention job, run by the wellplace-checkout-retention cron. The cutoff is now less privacy.retention_months, and when that setting is unset the job does nothing.

The setting [OUR CHOICE — project owner''s direction, 13 September 2026]: a value that cannot be read as a whole number of months, such as 24.5 or text, or one so large the cutoff falls outside the timestamp range, raises a warning to the server log and the job purges nothing, because no cutoff can be derived from it; it no longer fails with 22P02. A whole number below one still purges checkout progress exactly as before, then raises a warning and deletes no customer.

Checkout progress: removes the guest''s saved checkout progress from sessions not updated since the cutoff, and strips the progress copy from their payment attempts. Financial line snapshots remain, and expired private receipt links stop resolving.

Leads, since 20260913096000: public.save_checkout_progress now copies a guest''s name, date of birth, email and mobile into public.customers when the details step is submitted, so this job also deletes customers whose last activity is before the cutoff and who have no booking of any status. A customer with a booking, an invoice or a coupon redemption is never touched: whether such a record is anonymised or exempted is Q-17, still open, and a paid booking must not lose its customer.

Last activity [OUR CHOICE — project owner''s direction, 13 September 2026] is the latest of last_interaction_at, the customer''s newest marketing_consent_events.occurred_at, their newest customer_notes.created_at, and the newest audit.entries.occurred_at of a set_customer_warning on them. A recent consent event keeps the customer because deleting a recent unsubscribe would let a recaptured email be marketed again. The warning and blocked status have no timestamp column of their own: customers.updated_at moves on every edit of the row, contact details included, and a backfill with its trigger enabled would restart every lead''s retention period, so it does not record when a warning or block changed. public.set_customer_warning is the only writer of warning_note and is_blocked and writes that audit entry in the same transaction, and audit.entries cannot be altered [INV-14].

What happens to each record that references a customer: marketing_consent_events, customer_notes and customer_tags are the person''s own consent history, notes and tags and are removed with them by their on delete cascade; internal.checkout_sessions.customer_id is set null by its foreign key, and a session older than the cutoff has already been deleted above; a message with no booking carries the person''s address and wording and is deleted with them; a message tied to a booking, or one queued or sent on or after the cutoff, makes the customer ineligible, because it is either part of a booking record or recent contact; public.promo_code_redemptions always belongs to a booking and makes the customer ineligible; public.invoices makes the customer ineligible. acceptance_records and waitlist_entries hold no customer reference.

A customer row locked by another transaction, such as a checkout in progress, is skipped until the next run. When customers are deleted, one audit entry records the number of customers and messages removed and nothing else, so no personal data is copied into audit.entries, which cannot be deleted. Not executable by any application role.';
