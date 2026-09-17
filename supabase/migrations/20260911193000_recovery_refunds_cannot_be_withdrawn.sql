create or replace function public.withdraw_refund_request(p_refund_id uuid, p_reason text)
returns table (refund_id uuid, payment_id uuid, booking_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment  uuid;
  v_paid     integer;
  v_returned bigint;
  r          public.refunds%rowtype;
begin
  if not internal.is_staff() then
    raise exception 'Sign in to withdraw a refund request.' using errcode = '42501';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 1 and 500 then
    raise exception 'Enter a reason of up to 500 characters.' using errcode = '22023';
  end if;

  select rf.payment_id into v_payment from public.refunds rf where rf.id = p_refund_id;
  if v_payment is null then
    raise exception 'That refund request could not be found.' using errcode = 'P0002';
  end if;

  select pm.amount_fils into v_paid from public.payments pm where pm.id = v_payment for update;
  select * into r from public.refunds rf where rf.id = p_refund_id for update;

  if not r.is_pending or r.settled_at is not null or r.withdrawn_at is not null then
    raise exception 'Only a refund that is still pending can be withdrawn.' using errcode = 'WP066';
  end if;
  if r.requested_by is null then
    raise exception 'This refund was started automatically because the guest''s time could not be kept. It can be confirmed as returned, but not withdrawn.' using errcode = 'WP066';
  end if;

  update public.refunds rf
     set is_pending = false,
         withdrawn_at = now(),
         withdrawn_by = internal.current_staff_id(),
         withdrawal_reason = btrim(p_reason)
   where rf.id = r.id;

  select coalesce(sum(rf.amount_fils), 0) into v_returned
    from public.refunds rf
   where rf.payment_id = v_payment and rf.settled_at is not null;

  update public.payments pm
     set status = case
       when v_returned = 0 then 'paid'::public.payment_status
       when v_returned >= v_paid then 'fully_refunded'::public.payment_status
       else 'partially_refunded'::public.payment_status end
   where pm.id = v_payment
     and pm.status in ('paid', 'partially_refunded', 'fully_refunded');

  perform internal.write_audit(
    'withdraw_refund_request', 'public.refunds', r.id::text,
    jsonb_build_object('is_pending', true, 'amount_fils', r.amount_fils),
    jsonb_build_object('is_pending', false, 'withdrawn', true, 'amount_fils', r.amount_fils, 'payment_id', r.payment_id),
    p_reason
  );

  refund_id := r.id;
  payment_id := r.payment_id;
  booking_id := r.booking_id;
  return next;
end
$$;

comment on function public.withdraw_refund_request(uuid, text) is
  '[OUR CHOICE] Withdraws a refund that a member of staff requested and that has not been settled — for example one entered against the wrong payment. Before this existed, confirm_refund_return was the only way to close a pending refund, so a mistaken request reserved its amount forever and kept the refund_pending alert open.

A REFUND THE SYSTEM STARTED CANNOT BE WITHDRAWN. settle_payment_event creates a refund with no requested_by when money arrives for a booking it cannot keep: cancelled or voided before payment, no suite free, the visit already over, or a second payment. Withdrawing that refund would leave the guest''s money tracked by nothing — the booking may be cancelled, which the alert worker does not watch — so it can only be confirmed as returned. The contract''s late-payment rule is an alert, informing the guest, and a refund; re-accommodating the guest is done by booking them afresh, not by undoing the refund.

After a withdrawal the payment''s status is recomputed from settled refunds only, so a request that record_refund had already counted is no longer reflected in the status. The payment row is locked before the refund, in the same order as request_payment_refund and record_refund.';

create or replace function public.checkout_funnel(p_abandoned_minutes integer, p_limit integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform internal.require_management();
  if p_limit is null or p_limit < 1 then
    raise exception 'Choose how many checkouts to show.' using errcode = '22023';
  end if;
  return coalesce((
    select jsonb_agg(t order by t.updated_at desc)
      from (
        select s.report_id,
               s.progress -> 'identity' ->> 'firstName' as first_name,
               s.progress -> 'identity' ->> 'lastName' as last_name,
               s.progress -> 'identity' ->> 'email' as email,
               case when booked.confirmed then 'payment' else s.progress ->> 'lastCompletedStep' end as last_step,
               s.progress -> 'selection' as selection,
               s.recovered and booked.confirmed as recovered,
               s.updated_at,
               case when booked.confirmed then 'booked'
                    when s.updated_at < now() - make_interval(mins => p_abandoned_minutes) then 'abandoned'
                    else 'in_progress' end as status
          from internal.checkout_sessions s
          cross join lateral (
            select exists (
              select 1 from internal.checkout_attempts a where a.token = s.token and a.result = 'confirmed'
            ) as confirmed
          ) booked
         order by s.updated_at desc
         limit p_limit
      ) t
  ), '[]'::jsonb);
end
$$;

comment on function public.checkout_funnel(integer, integer) is
  '[CLIENT booking offers detail: incomplete bookings; OUR CHOICE] Management''s view of saved checkouts: the last completed step, the selections, booked / abandoned / in progress (the client''s own suggested names), and recovered — which is true only when the guest came back after abandoning the checkout AND completed the booking, exactly as the client asked. Returning without paying does not count. The row cap is passed in from src/lib/config/checkout-flow.ts.';

drop function public.booking_refunds(uuid);

create function public.booking_refunds(p_booking_id uuid)
returns table (
  refund_id    uuid,
  payment_id   uuid,
  amount_fils  integer,
  tax_fils     integer,
  is_pending   boolean,
  is_automatic boolean,
  requested_at timestamptz,
  settled_at   timestamptz,
  withdrawn_at timestamptz,
  reason       text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not internal.is_staff() then
    raise exception 'Sign in to read this booking.' using errcode = '42501';
  end if;
  return query
    select r.id, r.payment_id, r.amount_fils, r.tax_fils, r.is_pending, r.requested_by is null,
           r.requested_at, r.settled_at, r.withdrawn_at, r.reason
      from public.refunds r
     where r.booking_id = p_booking_id
     order by r.requested_at, r.id;
end
$$;

revoke all on function public.booking_refunds(uuid) from public, anon;
grant execute on function public.booking_refunds(uuid) to authenticated, service_role;

comment on function public.booking_refunds(uuid) is
  '[Contract: "Reception cannot see confidential Management figures without explicit permission"; OUR CHOICE] The refunds of ONE booking, for the staff member handling that booking. The ledger as a whole stays behind view_confidential_figures through refunds_select_confidential. is_automatic marks a refund the payment settlement started itself, which staff can confirm as returned but cannot withdraw.';
