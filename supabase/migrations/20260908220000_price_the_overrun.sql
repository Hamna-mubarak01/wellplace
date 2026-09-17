alter table public.bookings
  add column overrun_fils integer;

alter table public.bookings
  add constraint bookings_overrun_fils_non_negative
    check (overrun_fils is null or overrun_fils >= 0);

comment on column public.bookings.overrun_fils is
  'What the overrun was charged, in integer fils [§7.6, §11.2, Q-21]. The
seventh member of the stored priced breakdown beside subtotal_fils,
discount_fils, addons_fils, service_fee_fils, tax_fils and total_fils, and read
the same way: reporting SUMS this column and never recomputes it [INV-21].

IT IS DELIBERATELY NOT ADDED INTO total_fils. total_fils is the amount the guest
accepted before paying and a receipt for that booking has to keep saying so; an
overrun is a later event the guest did not agree to in advance. §11.2 adds the
two when it wants the amount collected, and keeps them apart when it wants to
report overruns as their own line.

NULLABLE, WHERE THE OTHER SIX ARE NOT NULL DEFAULT 0, AND THAT IS THE POINT. The
six always have a value because a booking always has a price. An overrun is an
optional later event, so three states have to be distinguishable: no overrun
recorded (null, alongside a null overrun_minutes), an overrun measured but not
priced (null, alongside a non-null overrun_minutes — the honest answer when
overrun.increment_minutes or the rate source is unconfigured), and an overrun
priced at nothing (0, which is a figure and a sentence). Collapsing the middle
case into 0 would understate §11.2 revenue silently.

Written only by public.record_overrun, which computes it inside the transaction
from the guest counts on the booking and a per-increment rate per guest kind
[§7.6]. The rate itself comes from src/lib/domain/overrun, which reads the
public.price_rules tiers — there is one pricing implementation and the database
is not a second one.';


drop function if exists public.record_overrun(uuid, timestamptz, text);

create or replace function public.record_overrun(
  p_booking_id      uuid,
  p_actual_end      timestamptz,
  p_adult_rate_fils integer,
  p_child_rate_fils integer,
  p_rate_source     text,
  p_reason          text
)
returns table (
  booking_id            uuid,
  status                public.booking_status,
  overrun_minutes       integer,
  increment_minutes     integer,
  chargeable_increments integer,
  chargeable_minutes    integer,
  adults                integer,
  children              integer,
  rate_source           text,
  overrun_fils          integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status      public.booking_status;
  v_reference   text;
  v_period      tstzrange;
  v_old_minutes integer;
  v_old_fils    integer;
  v_increment   integer;
  v_overrun     integer;
  v_increments  integer;
  v_chargeable  integer;
  v_adults      integer;
  v_children    integer;
  v_source      text := nullif(btrim(lower(coalesce(p_rate_source, ''))), '');
  v_wants_price boolean;
  v_fils        integer;
  v_at          timestamptz := coalesce(p_actual_end, clock_timestamp());
begin
  if not internal.is_staff() then
    raise exception 'record_overrun: an active staff session is required [§9.2, INV-13]'
      using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'record_overrun: a reason is required — an overrun is charged and INV-13 wants the reason with the charge'
      using errcode = '22023';
  end if;

  if not isfinite(v_at) then
    raise exception 'record_overrun: p_actual_end must be a finite instant, got %',
      p_actual_end
      using errcode = '22004';
  end if;

  v_wants_price := p_adult_rate_fils is not null or p_child_rate_fils is not null;

  if p_adult_rate_fils is not null and p_adult_rate_fils < 0 then
    raise exception 'record_overrun: p_adult_rate_fils must be zero or more, got %',
      p_adult_rate_fils
      using errcode = 'WP055';
  end if;

  if p_child_rate_fils is not null and p_child_rate_fils < 0 then
    raise exception 'record_overrun: p_child_rate_fils must be zero or more, got %',
      p_child_rate_fils
      using errcode = 'WP055';
  end if;

  if v_source is not null
     and v_source not in ('regular_hourly', 'offer_hourly', 'fixed') then
    raise exception 'record_overrun: p_rate_source must be regular_hourly, offer_hourly or fixed — the three readings overrun.rate_source can hold [§7.6, Q-21], got %',
      p_rate_source
      using errcode = 'WP055';
  end if;

  if v_wants_price and v_source is null then
    raise exception 'record_overrun: a rate was supplied without a rate source, so the audit entry could not say which reading of §7.6 produced the charge [Q-21]'
      using errcode = 'WP055';
  end if;

  select b.status, b.reference, b.experience_period, b.overrun_minutes, b.overrun_fils
    into v_status, v_reference, v_period, v_old_minutes, v_old_fils
    from public.bookings b
   where b.id = p_booking_id
   for update;

  if v_status is null then
    raise exception 'record_overrun: no booking with id %', p_booking_id
      using errcode = 'P0002';
  end if;

  if v_status not in (
    'checked_in'::public.booking_status,
    'completed'::public.booking_status
  ) then
    raise exception 'record_overrun: a booking in % cannot record an overrun [§4.4]',
      v_status
      using errcode = 'WP014';
  end if;

  v_overrun := greatest(
    0,
    ceil(extract(epoch from (v_at - upper(v_period))) / 60.0)::integer
  );

  v_increment := internal.setting_integer('overrun.increment_minutes');

  if v_increment is not null and v_increment > 0 then
    v_increments := ceil(v_overrun::numeric / v_increment::numeric)::integer;
    v_chargeable := v_increments * v_increment;
  else
    v_increment  := null;
    v_increments := null;
    v_chargeable := null;
  end if;

  select
    (count(*) filter (where bg.kind = 'adult'))::integer,
    (count(*) filter (where bg.kind = 'child'))::integer
    into v_adults, v_children
    from public.booking_guests bg
   where bg.booking_id = p_booking_id;

  v_adults   := coalesce(v_adults, 0);
  v_children := coalesce(v_children, 0);

  if v_wants_price then
    if v_increment is null then
      raise exception 'record_overrun: a rate was supplied but overrun.increment_minutes carries no value, so there are no commenced increments to charge [§7.6, INV-16]'
        using errcode = 'WP055';
    end if;

    if v_adults + v_children = 0 then
      raise exception 'record_overrun: booking % records no guests, and §7.6''s overrun is charged per guest',
        v_reference
        using errcode = 'WP056';
    end if;

    if v_adults > 0 and p_adult_rate_fils is null then
      raise exception 'record_overrun: booking % carries % adults and no adult rate was supplied',
        v_reference, v_adults
        using errcode = 'WP055';
    end if;

    if v_children > 0 and p_child_rate_fils is null then
      raise exception 'record_overrun: booking % carries % children and no child rate was supplied',
        v_reference, v_children
        using errcode = 'WP055';
    end if;

    v_fils := v_increments
            * ( v_adults   * coalesce(p_adult_rate_fils, 0)
              + v_children * coalesce(p_child_rate_fils, 0) );
  else
    v_fils := null;
  end if;

  update public.bookings b
     set overrun_minutes = v_overrun,
         overrun_fils    = v_fils
   where b.id = p_booking_id;

  perform internal.write_audit(
    'record_overrun',
    'public.bookings',
    p_booking_id::text,
    jsonb_build_object(
      'overrun_minutes', v_old_minutes,
      'overrun_fils',    v_old_fils
    ),
    jsonb_build_object(
      'reference',             v_reference,
      'status',                v_status,
      'scheduled_end',         upper(v_period),
      'actual_end',            v_at,
      'overrun_minutes',       v_overrun,
      'increment_minutes',     v_increment,
      'chargeable_increments', v_increments,
      'chargeable_minutes',    v_chargeable,
      'adults',                v_adults,
      'children',              v_children,
      'rate_source',           v_source,
      'adult_rate_fils',       p_adult_rate_fils,
      'child_rate_fils',       p_child_rate_fils,
      'overrun_fils',          v_fils
    ),
    p_reason
  );

  booking_id            := p_booking_id;
  status                := v_status;
  overrun_minutes       := v_overrun;
  increment_minutes     := v_increment;
  chargeable_increments := v_increments;
  chargeable_minutes    := v_chargeable;
  adults                := v_adults;
  children              := v_children;
  rate_source           := v_source;
  overrun_fils          := v_fils;
  return next;
end
$$;

comment on function public.record_overrun(uuid, timestamptz, integer, integer, text, text) is
  'Measure a visit that ran over AND CHARGE IT [§7.6, Q-21]. "Only the actual overrun is measured, charged in commenced five-minute increments" - so this measures from upper(experience_period) to the actual end and rounds UP twice: to whole minutes, then to whole increments. That is measureOverrun in src/lib/domain/overrun, ceiling division in both places, and the two must agree because the console shows one number and the database stores the other. One minute over costs one whole increment; that is the word "commenced" and it is asserted in supabase/tests/operations-rpcs.sql.

The increment comes from overrun.increment_minutes through internal.setting_integer and is never written here [R-05, INV-16]. When that setting has no value the overrun is still measured and stored, and increment_minutes, chargeable_increments and chargeable_minutes all come back null - the honest answer that the charge is not configured, rather than a five invented in SQL. Supplying a rate in that state is a WP055 rather than a silent zero.

WHY THE RATE IS A PARAMETER AND THE ARITHMETIC IS NOT. §7.6 does not name a rate. Q-21 answers it [ASSUMED, docs/9 §5]: the REGULAR published rate, per guest, per commenced increment - not the Special Offer rate, because the offer is attached to a booked commitment of "minimum 2 guests for 2 hours" and overrun time was neither booked nor committed to, so pricing it at the discount would make overstaying cheaper per hour than booking properly. Which of the three readings applies is overrun.rate_source, a setting, and resolving a tier into an hourly rate is src/lib/domain/pricing''s job. There is exactly one pricing implementation and this function is not a second one, so the RATE arrives as p_adult_rate_fils and p_child_rate_fils, already per increment and already per guest kind.

What the caller does NOT get to supply is the total. The guest counts are read here from public.booking_guests, the increments are counted here, and the money is multiplied here, inside the transaction that stores it. A caller can state a rate; it cannot state an amount, and it cannot inflate the head count.

p_rate_source is recorded so the audit entry says WHICH reading produced the figure, and it is text rather than an enum on purpose: it is the vocabulary of a Management setting, and a fourth reading should be a settings change and a domain expression, not a migration and an ALTER TYPE.

Re-recording replaces both numbers. A corrected actual end rewrites overrun_minutes and overrun_fils together, and recording without a rate sets the money back to null, because a charge computed against minutes that have since changed is worse than an honest gap.

Legal from checked_in and completed, transcribed from ACTION_RESULT.record_overrun. An overrun is normally written up after the guest has left, which is why completed is a legal starting state and the status never moves.

It still does not lengthen the claim, because the time has already been taken and lengthening it retrospectively could collide with the next booking. An overrun that ate into a later claim is a §9.3 upcoming_conflict, raised by the scan, not silently absorbed here. Complimentary bookings are not special-cased: is_complimentary stays on the booking and §11.2 separates them [INV-20], and whether an overstay on a comped visit is charged is the desk''s decision, recorded with its reason.';

revoke all on function
  public.record_overrun(uuid, timestamptz, integer, integer, text, text) from public;

grant execute on function
  public.record_overrun(uuid, timestamptz, integer, integer, text, text)
  to authenticated, service_role;


create or replace view public.booking_detail
  with (security_invoker = true)
as
  select
    b.id                       as booking_id,
    b.reference,
    b.status                   as booking_status,
    b.source,
    b.suite_id,
    s.suite_number,
    b.occupancy_id,
    lower(b.experience_period) as experience_from,
    upper(b.experience_period) as experience_to,
    upper(o.blocked_period)    as blocked_to,
    b.cleaning_buffer_minutes,
    b.arrived_at,
    b.checked_in_at,
    b.checked_out_at,
    b.late_arrival_minutes,
    b.overrun_minutes,
    b.personal_request,
    b.internal_note,
    b.is_complimentary,
    b.created_at,
    b.updated_at,
    b.created_by,
    internal.staff_display_name(b.created_by) as created_by_name,
    coalesce(g.adults, 0)      as adults,
    coalesce(g.children, 0)    as children,
    coalesce(g.child_ages, array[]::integer[]) as child_ages,
    c.id                       as customer_id,
    c.salutation,
    c.first_name,
    c.last_name,
    btrim(c.first_name || ' ' || c.last_name) as guest_name,
    c.email,
    c.phone_e164,
    c.phone_country,
    c.date_of_birth,
    c.is_blocked,
    c.warning_note,
    coalesce(ps.status, 'open'::public.payment_status) as payment_status,
    b.subtotal_fils,
    b.discount_fils,
    b.addons_fils,
    b.service_fee_fils,
    b.tax_fils,
    b.total_fils,
    coalesce(pd.paid_fils, 0) as paid_fils,
    case when internal.has_permission('view_confidential_figures') then coalesce(rf.settled_fils, 0)   end as refunded_fils,
    case when internal.has_permission('view_confidential_figures') then coalesce(rf.pending_fils, 0)   end as refunds_pending_fils,
    b.overrun_fils
  from public.bookings b
  join public.customers c
    on c.id = b.customer_id
  left join public.suites s
    on s.id = b.suite_id
  left join public.suite_occupancy o
    on o.id = b.occupancy_id
  left join lateral (
    select
      (count(*) filter (where bg.kind = 'adult'))::integer as adults,
      (count(*) filter (where bg.kind = 'child'))::integer as children,
      array_agg(bg.age order by bg.age) filter (where bg.kind = 'child') as child_ages
      from public.booking_guests bg
     where bg.booking_id = b.id
  ) g on true
  left join lateral (
    select sum(p.amount_fils)::integer as paid_fils
      from public.payments p
     where p.booking_id = b.id
       and p.status in ('paid', 'partially_refunded', 'fully_refunded')
  ) pd on true
  left join lateral (
    select
      (sum(r.amount_fils) filter (where r.settled_at is not null))::integer as settled_fils,
      (sum(r.amount_fils) filter (where r.is_pending))::integer             as pending_fils
      from public.refunds r
     where r.booking_id = b.id
  ) rf on true
  left join lateral (
    select p.status
      from public.payments p
     where p.booking_id = b.id
     order by case p.status
       when 'fully_refunded'     then 1
       when 'partially_refunded' then 2
       when 'paid'               then 3
       when 'manual_review'      then 4
       when 'pending'            then 5
       when 'failed'             then 6
       when 'cancelled'          then 7
       when 'open'               then 8
     end
     limit 1
  ) ps on true;

comment on column public.booking_detail.overrun_fils is
  'What the overrun on this booking was charged, in integer fils, read straight
from public.bookings.overrun_fils [§7.6, §11.2, Q-21].
Ungated with the rest of this booking''s own money [Q-10, 20260908210000]: a
receptionist who has to collect it at the desk has to be able to read it. It is
not added into total_fils - the two are separate stored figures and §11.2 adds
them only where it wants the amount collected.
Null means the overrun was measured but not priced, which is a different
sentence from a zero. public.booking_detail.overrun_minutes says whether there
was one at all.';
