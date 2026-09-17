alter table internal.checkout_attempts drop constraint checkout_attempts_booking_id_key;
create or replace function public.prepare_guest_payment(p_token uuid,p_request_id uuid,p_quote jsonb,p_revision text,p_currency text,p_simulated boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 s internal.checkout_sessions%rowtype; a internal.checkout_attempts%rowtype;
 o public.suite_occupancy%rowtype; c public.customers%rowtype; v public.promo_codes%rowtype;
 identity jsonb; choice jsonb; price jsonb; previous_booking jsonb; bid uuid; pid uuid; occupied integer; customer_uses integer;
 today date := (now() at time zone 'Asia/Dubai')::date;
begin
 perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);
 select * into s from internal.checkout_sessions where token=p_token for update;
 if not found then raise exception 'Your booking session expired. Please enter your details again.' using errcode='WP062'; end if;
 select * into a from internal.checkout_attempts where request_id=p_request_id;
 if found then
   if a.token<>p_token then raise exception 'This payment does not belong to your booking.' using errcode='WP062'; end if;
   return jsonb_build_object('paymentId',a.payment_id,'amountFils',(a.snapshot->'breakdown'->>'totalFils')::integer,'currency',a.currency,'expiresAt',a.reservation_expires_at,'simulated',p_simulated);
 end if;
 if exists(select 1 from internal.checkout_attempts where token=p_token and result in ('confirmed','refunded')) then
   raise exception 'This booking is already complete. Open your receipt before starting another booking.' using errcode='WP062'; end if;
 if exists(select 1 from internal.checkout_attempts where token=p_token and result is null and reservation_expires_at>now()) then
   raise exception 'A payment is already waiting. Return to the payment step to finish it.' using errcode='WP062'; end if;
 perform 1 from public.settings order by key for share;
 perform 1 from public.price_rules order by id for share;
 perform 1 from public.addons order by id for share;
 perform 1 from public.promo_codes order by id for update;
 if p_revision is distinct from public.checkout_revision() then
   raise exception 'Prices or offers have changed. Review the updated total before paying.' using errcode='WP063'; end if;
 if p_currency<>'AED' or p_quote->'breakdown'->>'outcome'<>'priced' then raise exception 'Your price could not be verified.' using errcode='WP063'; end if;
 if s.progress is distinct from p_quote->'progress' then raise exception 'Your booking changed in another window. Review the details before paying.' using errcode='WP062'; end if;
 identity:=s.progress->'identity'; choice:=s.progress->'selection'; price:=p_quote->'breakdown';
 select oc.* into o from internal.guest_checkout_holds h join public.suite_occupancy oc on oc.id=h.occupancy_id where h.token=p_token for update of oc;
 if o.cleaning_buffer_minutes is distinct from (select (value#>>'{}')::integer from public.settings where key='cleaning.buffer_minutes') then raise exception 'Booking options have changed. Please choose your time again before paying.' using errcode='WP062'; end if;
 if o.id is null or not o.is_active or o.expires_at<=clock_timestamp() or o.kind<>'hold'
   or lower(o.experience_period) is distinct from (choice->>'startsAt')::timestamptz
   or upper(o.experience_period) is distinct from (choice->>'startsAt')::timestamptz+make_interval(hours=>(choice->>'durationHours')::integer) then
   raise exception 'Your time hold has expired. Choose an available time before paying.' using errcode='WP062'; end if;
 select * into c from public.customers where identity_key=internal.normalise_email(identity->>'email') for update;
 if c.id is null then
   insert into public.customers(salutation,first_name,last_name,email,date_of_birth,phone_e164,phone_country)
   values((identity->>'salutation')::public.salutation,identity->>'firstName',identity->>'lastName',identity->>'email',(identity->>'dateOfBirth')::date,identity->>'phoneE164',identity->>'phoneCountry')
   on conflict(identity_key) do update set last_interaction_at=now() returning * into c;
 end if;
 if c.is_blocked then raise exception 'Please contact WellPlace to arrange this booking.' using errcode='WP062'; end if;
 update public.customers set last_interaction_at=now() where id=c.id;
 if nullif(choice->>'voucherCode','') is not null then
   select * into v from public.promo_codes where code=upper(choice->>'voucherCode') for update;
   if v.id is null or not v.is_active or today< v.valid_from or today>v.valid_to then
     raise exception 'This coupon is no longer valid. Remove it or enter another code.' using errcode='WP064'; end if;
   select count(*),count(*) filter(where b.customer_id=c.id) into occupied,customer_uses
   from internal.checkout_attempts ca join public.bookings b on b.id=ca.booking_id
   where ca.promo_id=v.id and ca.result is null and ca.reservation_expires_at>now();
   customer_uses:=customer_uses+(select count(*) from public.promo_code_redemptions r where r.promo_code_id=v.id and r.customer_id=c.id);
   if (v.max_uses is not null and v.used_count+occupied>=v.max_uses) or (v.per_customer_limit is not null and customer_uses>=v.per_customer_limit) then
     raise exception 'This coupon has reached its usage limit. Remove it or enter another code.' using errcode='WP064'; end if;
 end if;
 select ca.booking_id,to_jsonb(previous) into bid,previous_booking from internal.checkout_attempts ca join public.bookings previous on previous.id=ca.booking_id
 where ca.token=p_token and ca.result in ('failed','cancelled') and previous.status='payment_failed'
   and previous.is_simulated=p_simulated
   and not exists(select 1 from public.payments history where history.booking_id=previous.id and history.status not in ('failed','cancelled'))
 order by ca.created_at desc limit 1 for update of previous;
 if bid is null then
 insert into public.bookings(reference,customer_id,suite_id,source,status,experience_period,cleaning_buffer_minutes,personal_request,
 subtotal_fils,discount_fils,addons_fils,service_fee_fils,tax_fils,total_fils,is_simulated)
 values(internal.next_booking_reference(),c.id,o.suite_id,'online','awaiting_payment',o.experience_period,o.cleaning_buffer_minutes,nullif(choice->>'personalRequest',''),
 (price->>'subtotalFils')::integer,(price->>'discountFils')::integer,(price->>'addonsTotalFils')::integer,(price->>'serviceFeeFils')::integer,(price->>'taxFils')::integer,(price->>'totalFils')::integer,p_simulated) returning id into bid;
 else
   update public.bookings set status='awaiting_payment',customer_id=c.id,suite_id=o.suite_id,experience_period=o.experience_period,cleaning_buffer_minutes=o.cleaning_buffer_minutes,
     personal_request=nullif(choice->>'personalRequest',''),subtotal_fils=(price->>'subtotalFils')::integer,discount_fils=(price->>'discountFils')::integer,
     addons_fils=(price->>'addonsTotalFils')::integer,service_fee_fils=(price->>'serviceFeeFils')::integer,tax_fils=(price->>'taxFils')::integer,total_fils=(price->>'totalFils')::integer where id=bid;
   delete from public.booking_guests where booking_id=bid;
   delete from public.booking_addons where booking_id=bid;
 end if;
 insert into public.booking_guests(booking_id,kind) select bid,'adult' from generate_series(1,(choice->>'adults')::integer);
 insert into public.booking_guests(booking_id,kind,age) select bid,'child',value::integer from jsonb_array_elements_text(choice->'childAges');
 insert into public.booking_addons(booking_id,addon_id,name_snapshot,unit_price_fils,quantity,regular_price_fils,is_included,is_locked,voucher_code)
 select bid,(l->>'id')::uuid,l->>'name',(l->>'unitPriceFils')::integer,(l->>'quantity')::integer,(l->>'regularUnitPriceFils')::integer,
 (l->>'unitPriceFils')::integer=0,coalesce((l->>'isLocked')::boolean,false),nullif(choice->>'voucherCode','') from jsonb_array_elements(p_quote->'cart') l;
 insert into public.acceptance_records(booking_id,accepted_at,source,document_slug,document_version,checkbox_text)
 select bid,s.consent_accepted_at,'online',d->>'document_slug',d->>'document_version',d->>'checkbox_text' from jsonb_array_elements(s.consent) d on conflict (booking_id,document_slug) do nothing;
 insert into public.payments(booking_id,status,method,amount_fils,service_fee_fils,is_simulated,note)
 values(bid,'pending','online',(price->>'totalFils')::integer,(price->>'serviceFeeFils')::integer,p_simulated,case when p_simulated then 'Simulation — no money charged' else null end) returning id into pid;
 insert into internal.checkout_attempts(token,request_id,booking_id,payment_id,snapshot,currency,payment_option,promo_id,reservation_expires_at)
 values(p_token,p_request_id,bid,pid,p_quote||jsonb_build_object('progress',s.progress),p_currency,choice->>'paymentOption',v.id,o.expires_at);
 perform internal.write_audit('prepare_guest_payment','public.bookings',bid::text,previous_booking,jsonb_build_object('payment_id',pid,'total_fils',price->'totalFils','simulated',p_simulated),'Guest checkout');
 return jsonb_build_object('paymentId',pid,'amountFils',(price->>'totalFils')::integer,'currency',p_currency,'expiresAt',o.expires_at,'simulated',p_simulated);
end $$;
create or replace function public.checkout_funnel(p_abandoned_minutes integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform internal.require_management();
 return coalesce((select jsonb_agg(t order by t.updated_at desc) from (
   select s.report_id,s.progress->'identity'->>'firstName' as first_name,s.progress->'identity'->>'lastName' as last_name,
     s.progress->'identity'->>'email' as email,case when exists(select 1 from internal.checkout_attempts a where a.token=s.token and a.result='confirmed') then 'payment' else s.progress->>'lastCompletedStep' end as last_step,s.progress->'selection' as selection,s.recovered,s.updated_at,
     case when exists(select 1 from internal.checkout_attempts a where a.token=s.token and a.result='confirmed') then 'booked'
       when s.updated_at < now()-make_interval(mins=>p_abandoned_minutes) then 'abandoned' else 'in_progress' end as status
   from internal.checkout_sessions s order by s.updated_at desc limit 500
 ) t),'[]'::jsonb);
end $$;
comment on function public.prepare_guest_payment(uuid,uuid,jsonb,text,text,boolean) is '[§8, §16.1; CLIENT booking completion] A declined or cancelled payment retries against its original booking reference, including an explicitly reviewed change of guests, time or price. Each attempt retains its own immutable quote and provider result; the original hold expiry is never extended. Old failed payment quotes stay immutable and the replacement booking details are audited.';

create or replace function public.guest_receipt(p_receipt_token uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('reference',b.reference,'status',b.status,'checkoutResult',a.result,'paymentReference',p.provider_reference,'paymentStatus',p.status,'simulated',p.is_simulated,'currency',a.currency,'paymentOption',a.payment_option,'snapshot',a.snapshot,'createdAt',a.created_at,
 'refunds',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'amountFils',r.amount_fils,'taxFils',r.tax_fils,'pending',r.is_pending,'settledAt',r.settled_at,'requestedAt',r.requested_at) order by r.requested_at) from public.refunds r where r.payment_id=p.id),'[]'::jsonb))
 from internal.checkout_attempts a join public.bookings b on b.id=a.booking_id join public.payments p on p.id=a.payment_id
 where a.receipt_token=p_receipt_token and a.result in ('confirmed','refunded') and a.snapshot ? 'progress'
$$;
