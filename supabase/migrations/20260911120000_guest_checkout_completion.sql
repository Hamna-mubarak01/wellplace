create table internal.checkout_sessions (
  token uuid primary key,
  report_id uuid not null unique default gen_random_uuid(),
  progress jsonb not null,
  consent jsonb not null,
  consent_accepted_at timestamptz not null default now(),
  abandoned_minutes integer not null check(abandoned_minutes > 0),
  recovered boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table internal.checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  token uuid references internal.checkout_sessions(token) on delete set null,
  request_id uuid not null unique,
  booking_id uuid not null unique references public.bookings(id),
  payment_id uuid not null unique references public.payments(id),
  receipt_token uuid not null unique default gen_random_uuid(),
  snapshot jsonb not null,
  currency text not null check(currency = 'AED'),
  payment_option text not null check(payment_option in ('card','tabby')),
  promo_id uuid references public.promo_codes(id),
  reservation_expires_at timestamptz not null,
  result text check(result in ('confirmed','refunded','failed','cancelled')),
  created_at timestamptz not null default now()
);
create index checkout_attempts_token_idx on internal.checkout_attempts(token, created_at desc);
alter table public.payments add column is_simulated boolean not null default false;
alter table public.bookings add column is_simulated boolean not null default false;
alter table public.refunds add column request_key uuid unique;
alter table public.refunds add column tax_fils integer not null default 0 check(tax_fils >= 0);
comment on table internal.checkout_sessions is '[CLIENT Booking offers detail; §6.3] Incomplete bookings are saved only after lead-booker consent. Private cookie ownership is separate from management report identifiers. No public table access.';
comment on table internal.checkout_attempts is '[§8, §8.2; OUR CHOICE] Server-priced, idempotent checkout attempts. Coupon reservations expire with the original suite hold. Receipt tokens expose only the purchased visit and payment summary.';
comment on column public.payments.is_simulated is '[CLIENT simulation request] No money moves. Simulation records must be distinguished from live revenue.';

create function public.checkout_revision() returns text language sql stable security definer set search_path='' as $$
 select md5(jsonb_build_array(
   (select jsonb_agg(to_jsonb(s) order by s.key) from public.settings s),
   (select jsonb_agg(to_jsonb(p) order by p.id) from public.price_rules p),
   (select jsonb_agg(to_jsonb(a) order by a.id) from public.addons a),
   (select jsonb_agg(to_jsonb(c) - 'used_count' - 'updated_at' order by c.id) from public.promo_codes c),
   (select jsonb_agg(to_jsonb(c) order by c.promo_code_id,c.addon_id) from public.promo_code_addons c)
 )::text)
$$;

create function public.save_checkout_progress(p_token uuid,p_progress jsonb,p_consent jsonb,p_abandoned_minutes integer)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_progress->>'acceptedTerms' is distinct from 'true' or jsonb_array_length(p_consent)=0 then
   raise exception 'Accept the booking terms to continue.' using errcode='WP062';
 end if;
 insert into internal.checkout_sessions(token,progress,consent,abandoned_minutes) values(p_token,p_progress,p_consent,p_abandoned_minutes)
 on conflict(token) do update set progress=excluded.progress,consent=excluded.consent,
 consent_accepted_at=case when checkout_sessions.consent=excluded.consent then checkout_sessions.consent_accepted_at else now() end,
 abandoned_minutes=excluded.abandoned_minutes,
 recovered=checkout_sessions.recovered or checkout_sessions.updated_at < now()-make_interval(mins=>p_abandoned_minutes), updated_at=now();
end $$;

create function public.load_checkout_progress(p_token uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('progress',s.progress,'recovered',s.recovered,'pendingPayment',
 (select jsonb_build_object('paymentId',a.payment_id,'amountFils',p.amount_fils,'currency',a.currency,'expiresAt',a.reservation_expires_at,'simulated',p.is_simulated) from internal.checkout_attempts a join public.payments p on p.id=a.payment_id where a.token=s.token and a.result is null order by a.created_at desc limit 1),'receiptToken',
 (select a.receipt_token from internal.checkout_attempts a where a.token=s.token and a.result in ('confirmed','refunded') order by a.created_at desc limit 1))
 from internal.checkout_sessions s where s.token=p_token
$$;

create function public.prepare_guest_payment(p_token uuid,p_request_id uuid,p_quote jsonb,p_revision text,p_currency text,p_simulated boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 s internal.checkout_sessions%rowtype; a internal.checkout_attempts%rowtype;
 o public.suite_occupancy%rowtype; c public.customers%rowtype; v public.promo_codes%rowtype;
 identity jsonb; choice jsonb; price jsonb; bid uuid; pid uuid; occupied integer; customer_uses integer;
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
 insert into public.bookings(reference,customer_id,suite_id,source,status,experience_period,cleaning_buffer_minutes,personal_request,
 subtotal_fils,discount_fils,addons_fils,service_fee_fils,tax_fils,total_fils,is_simulated)
 values(internal.next_booking_reference(),c.id,o.suite_id,'online','awaiting_payment',o.experience_period,o.cleaning_buffer_minutes,nullif(choice->>'personalRequest',''),
 (price->>'subtotalFils')::integer,(price->>'discountFils')::integer,(price->>'addonsTotalFils')::integer,(price->>'serviceFeeFils')::integer,(price->>'taxFils')::integer,(price->>'totalFils')::integer,p_simulated) returning id into bid;
 insert into public.booking_guests(booking_id,kind) select bid,'adult' from generate_series(1,(choice->>'adults')::integer);
 insert into public.booking_guests(booking_id,kind,age) select bid,'child',value::integer from jsonb_array_elements_text(choice->'childAges');
 insert into public.booking_addons(booking_id,addon_id,name_snapshot,unit_price_fils,quantity,regular_price_fils,is_included,is_locked,voucher_code)
 select bid,(l->>'id')::uuid,l->>'name',(l->>'unitPriceFils')::integer,(l->>'quantity')::integer,(l->>'regularUnitPriceFils')::integer,
 (l->>'unitPriceFils')::integer=0,coalesce((l->>'isLocked')::boolean,false),nullif(choice->>'voucherCode','') from jsonb_array_elements(p_quote->'cart') l;
 insert into public.acceptance_records(booking_id,accepted_at,source,document_slug,document_version,checkbox_text)
 select bid,s.consent_accepted_at,'online',d->>'document_slug',d->>'document_version',d->>'checkbox_text' from jsonb_array_elements(s.consent) d;
 insert into public.payments(booking_id,status,method,amount_fils,service_fee_fils,is_simulated,note)
 values(bid,'pending','online',(price->>'totalFils')::integer,(price->>'serviceFeeFils')::integer,p_simulated,case when p_simulated then 'Simulation — no money charged' else null end) returning id into pid;
 insert into internal.checkout_attempts(token,request_id,booking_id,payment_id,snapshot,currency,payment_option,promo_id,reservation_expires_at)
 values(p_token,p_request_id,bid,pid,p_quote||jsonb_build_object('progress',s.progress),p_currency,choice->>'paymentOption',v.id,o.expires_at);
 perform internal.write_audit('prepare_guest_payment','public.bookings',bid::text,null,jsonb_build_object('payment_id',pid,'total_fils',price->'totalFils','simulated',p_simulated),'Guest checkout');
 return jsonb_build_object('paymentId',pid,'amountFils',(price->>'totalFils')::integer,'currency',p_currency,'expiresAt',o.expires_at,'simulated',p_simulated);
end $$;

create function public.guest_payment_for_verification(p_token uuid,p_payment_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('paymentId',p.id,'amountFils',p.amount_fils,'currency',a.currency,'option',a.payment_option,'simulated',p.is_simulated)
 from internal.checkout_attempts a join public.payments p on p.id=a.payment_id where a.token=p_token and p.id=p_payment_id
$$;

create function public.settle_guest_payment(p_token uuid,p_payment_id uuid,p_event_id text,p_outcome text,p_amount_fils integer,p_currency text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a internal.checkout_attempts%rowtype; p public.payments%rowtype; b public.bookings%rowtype;
 o public.suite_occupancy%rowtype; v public.promo_codes%rowtype; allocated record; oid uuid; sid uuid;
 success boolean; v_result text; failure text; occupied integer; customer_uses integer;
begin
 perform pg_advisory_xact_lock(hashtext('wellplace.suite_allocation')::bigint);
 select * into a from internal.checkout_attempts where token=p_token and payment_id=p_payment_id for update;
 if not found then raise exception 'This payment does not belong to your booking.' using errcode='WP062'; end if;
 select * into p from public.payments where id=p_payment_id for update;
 select * into b from public.bookings where id=a.booking_id for update;
 if not p.is_simulated or p.amount_fils<>p_amount_fils or a.currency<>p_currency or p_outcome not in ('success','failed','cancelled') then
   raise exception 'The payment result could not be verified.' using errcode='WP065'; end if;
 if a.result is not null then return jsonb_build_object('status',a.result,'receiptToken',case when a.result in ('confirmed','refunded') then a.receipt_token else null end,'reference',b.reference); end if;
 insert into public.payment_events(payment_id,booking_id,provider,provider_event_id,signature_verified,payload,processed_at)
 values(p.id,b.id,'simulation',p_event_id,false,jsonb_build_object('outcome',p_outcome,'amount_fils',p_amount_fils,'currency',p_currency,'server_simulated',true),now()) on conflict(provider,provider_event_id) do nothing;
 success:=p_outcome='success';
 if success then
   if upper(b.experience_period)<=clock_timestamp() then failure:='Your visit had already ended when payment completed.'; end if;
   if exists(select 1 from internal.checkout_attempts ca where ca.token=p_token and ca.id<>a.id and ca.result='confirmed') then failure:='This checkout had already completed through another payment attempt.'; end if;
   perform internal.release_expired_occupancy();
   select oc.* into o from internal.guest_checkout_holds h join public.suite_occupancy oc on oc.id=h.occupancy_id where h.token=p_token for update of oc;
   if a.promo_id is not null then
     select * into v from public.promo_codes where id=a.promo_id for update;
     select count(*),count(*) filter(where bk.customer_id=b.customer_id) into occupied,customer_uses
     from internal.checkout_attempts ca join public.bookings bk on bk.id=ca.booking_id
     where ca.promo_id=v.id and ca.id<>a.id and ca.result is null and ca.reservation_expires_at>now();
     customer_uses:=customer_uses+(select count(*) from public.promo_code_redemptions r where r.promo_code_id=v.id and r.customer_id=b.customer_id);
     if (v.max_uses is not null and v.used_count+occupied>=v.max_uses) or (v.per_customer_limit is not null and customer_uses>=v.per_customer_limit) then failure:='The coupon was no longer available when payment completed.'; end if;
   end if;
   if failure is null then
     if o.is_active and o.kind='hold' and o.expires_at>clock_timestamp() and o.experience_period=b.experience_period then
       update public.suite_occupancy set kind='booking',booking_id=b.id,expires_at=null where id=o.id;
       oid:=o.id; sid:=o.suite_id;
     else
       select * into allocated from internal.allocate_suite(b.experience_period,tstzrange(lower(b.experience_period),upper(b.experience_period)+make_interval(mins=>b.cleaning_buffer_minutes),'[)'),b.cleaning_buffer_minutes,'booking',null,b.id,'Late payment recovery',false,b.suite_id);
       oid:=allocated.allocated_occupancy_id; sid:=allocated.allocated_suite_id;
       if oid is null then
         select * into allocated from internal.allocate_suite(b.experience_period,tstzrange(lower(b.experience_period),upper(b.experience_period)+make_interval(mins=>b.cleaning_buffer_minutes),'[)'),b.cleaning_buffer_minutes,'booking',null,b.id,'Late payment recovery',false,null);
         oid:=allocated.allocated_occupancy_id; sid:=allocated.allocated_suite_id;
       end if;
       if oid is null then failure:='The time was no longer available when payment completed.'; end if;
     end if;
   end if;
   if failure is null then
     update public.bookings set status='confirmed',occupancy_id=oid,suite_id=sid where id=b.id;
     update public.payments set status='paid',provider_reference='SIM-'||p.id::text where id=p.id;
     if a.promo_id is not null then
       insert into public.promo_code_redemptions(promo_code_id,booking_id,customer_id) values(a.promo_id,b.id,b.customer_id);
       update public.promo_codes set used_count=used_count+1 where id=a.promo_id;
     end if;
     v_result:='confirmed';
   else
     update public.bookings set status='cancelled',suite_id=null where id=b.id;
     update public.payments set status='fully_refunded',provider_reference='SIM-'||p.id::text where id=p.id;
     if p.amount_fils>0 then insert into public.refunds(payment_id,booking_id,amount_fils,tax_fils,reason,is_pending,settled_at,provider_reference)
       values(p.id,b.id,p.amount_fils,b.tax_fils,failure||' Automatic simulated refund.',false,now(),'SIM-REFUND-'||p.id::text); end if;
     v_result:='refunded';
   end if;
 else
   v_result:=p_outcome;
   update public.payments set status=p_outcome::public.payment_status where id=p.id;
   update public.bookings set status='payment_failed' where id=b.id;
 end if;
 update internal.checkout_attempts set result=v_result where id=a.id;
 update internal.checkout_sessions set recovered=recovered or updated_at<now()-make_interval(mins=>abandoned_minutes),updated_at=now() where token=p_token;
 perform internal.write_audit('settle_simulated_payment','public.payments',p.id::text,null,jsonb_build_object('result',v_result,'amount_fils',p.amount_fils,'failure',failure),'Server-owned payment simulation; no money moved');
 return jsonb_build_object('status',v_result,'receiptToken',case when success then a.receipt_token else null end,'reference',b.reference);
end $$;

create function public.guest_receipt(p_receipt_token uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('reference',b.reference,'status',b.status,'paymentStatus',p.status,'simulated',p.is_simulated,'currency',a.currency,'paymentOption',a.payment_option,'snapshot',a.snapshot,'createdAt',a.created_at,
 'refunds',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'amountFils',r.amount_fils,'taxFils',r.tax_fils,'pending',r.is_pending,'settledAt',r.settled_at,'requestedAt',r.requested_at) order by r.requested_at) from public.refunds r where r.payment_id=p.id),'[]'::jsonb))
 from internal.checkout_attempts a join public.bookings b on b.id=a.booking_id join public.payments p on p.id=a.payment_id
 where a.receipt_token=p_receipt_token and a.result in ('confirmed','refunded') and a.snapshot ? 'progress'
$$;

create function public.checkout_funnel(p_abandoned_minutes integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform internal.require_management();
 return coalesce((select jsonb_agg(t order by t.updated_at desc) from (
   select s.report_id,s.progress->'identity'->>'firstName' as first_name,s.progress->'identity'->>'lastName' as last_name,
     s.progress->'identity'->>'email' as email,s.progress->>'lastCompletedStep' as last_step,s.progress->'selection' as selection,s.recovered,s.updated_at,
     case when exists(select 1 from internal.checkout_attempts a where a.token=s.token and a.result='confirmed') then 'booked'
       when s.updated_at < now()-make_interval(mins=>p_abandoned_minutes) then 'abandoned' else 'in_progress' end as status
   from internal.checkout_sessions s order by s.updated_at desc limit 500
 ) t),'[]'::jsonb);
end $$;

create function public.request_payment_refund(p_payment_id uuid,p_amount_fils integer,p_reason text,p_request_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.payments%rowtype; r public.refunds%rowtype; total bigint; rid uuid; refund_tax integer;
begin
 if not internal.is_staff() then raise exception 'Sign in to process a refund.' using errcode='42501'; end if;
 select * into p from public.payments where id=p_payment_id for update;
 select * into r from public.refunds where request_key=p_request_key;
 if found then
   if r.payment_id<>p_payment_id or r.amount_fils<>p_amount_fils or r.reason<>btrim(p_reason) then raise exception 'This refund request has already been used.' using errcode='WP066'; end if;
   return r.id;
 end if;
 if p.id is null or p.status not in ('paid','partially_refunded') then raise exception 'Only a paid balance can be refunded.' using errcode='WP066'; end if;
 if p_amount_fils is null or p_amount_fils<=0 or p_request_key is null or p_reason is null or length(btrim(p_reason)) not between 1 and 500 then raise exception 'Enter a positive refund amount and a reason of up to 500 characters.' using errcode='WP066'; end if;
 select coalesce(sum(amount_fils),0) into total from public.refunds where payment_id=p.id;
 if total+p_amount_fils>p.amount_fils then raise exception 'This amount exceeds the remaining refundable balance. Refresh the booking and check previous refunds.' using errcode='WP066'; end if;
 select case when b.total_fils>0 then greatest(0,least(b.tax_fils,round(b.tax_fils::numeric*(total+p_amount_fils)/b.total_fils)::integer)-coalesce((select sum(r.tax_fils) from public.refunds r where r.payment_id=p.id),0)) else 0 end into refund_tax from public.bookings b where b.id=p.booking_id;
 insert into public.refunds(payment_id,booking_id,amount_fils,tax_fils,reason,requested_by,is_pending,settled_at,provider_reference,request_key)
 values(p.id,p.booking_id,p_amount_fils,refund_tax,btrim(p_reason),internal.current_staff_id(),not p.is_simulated,case when p.is_simulated then now() end,
 case when p.is_simulated then 'SIM-REFUND-'||p_request_key::text end,p_request_key) returning id into rid;
 if p.is_simulated then update public.payments set status=case when total+p_amount_fils=p.amount_fils then 'fully_refunded'::public.payment_status else 'partially_refunded'::public.payment_status end where id=p.id; end if;
 perform internal.write_audit('request_payment_refund','public.refunds',rid::text,null,jsonb_build_object('amount_fils',p_amount_fils,'simulated',p.is_simulated,'payment_id',p.id),p_reason);
 return rid;
end $$;
create policy refunds_select_reception on public.refunds for select to authenticated using(internal.is_staff());

revoke all on function public.checkout_revision(),public.save_checkout_progress(uuid,jsonb,jsonb,integer),public.load_checkout_progress(uuid),public.prepare_guest_payment(uuid,uuid,jsonb,text,text,boolean),public.guest_payment_for_verification(uuid,uuid),public.settle_guest_payment(uuid,uuid,text,text,integer,text),public.guest_receipt(uuid) from public,anon,authenticated;
grant execute on function public.checkout_revision(),public.save_checkout_progress(uuid,jsonb,jsonb,integer),public.load_checkout_progress(uuid),public.prepare_guest_payment(uuid,uuid,jsonb,text,text,boolean),public.guest_payment_for_verification(uuid,uuid),public.settle_guest_payment(uuid,uuid,text,text,integer,text),public.guest_receipt(uuid) to service_role;
revoke all on function public.checkout_funnel(integer),public.request_payment_refund(uuid,integer,text,uuid) from public,anon;
grant execute on function public.checkout_funnel(integer),public.request_payment_refund(uuid,integer,text,uuid) to authenticated,service_role;
comment on function public.request_payment_refund(uuid,integer,text,uuid) is '[CLIENT Reception refund request; §8] Active receptionists and managers can request refunds. Idempotent payment lock enforces cumulative pending and settled ceiling. Simulation settles immediately; live requests remain pending until provider confirmation.';

create function public.save_checkout_coupon(p_input jsonb,p_expected_updated_at timestamptz default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare existing public.promo_codes%rowtype; result uuid; targets uuid[];
begin
 perform internal.require_management();
 if nullif(p_input->>'id','') is not null then
   select * into existing from public.promo_codes where id=(p_input->>'id')::uuid for update;
   if existing.id is null or existing.updated_at is distinct from p_expected_updated_at then raise exception 'This coupon changed in another window. Reload before editing it.' using errcode='WP067'; end if;
   if existing.used_count>0 and (existing.code<>p_input->>'code' or existing.kind::text<>p_input->>'kind') then raise exception 'A used coupon keeps its code and discount type. Create a new coupon for a different offer.' using errcode='WP067'; end if;
   if (p_input->>'maxUses')::integer < existing.used_count+(select count(*) from internal.checkout_attempts a where a.promo_id=existing.id and a.result is null and a.reservation_expires_at>now()) then raise exception 'The usage limit cannot be lower than the uses already redeemed or held by checkouts.' using errcode='WP067'; end if;
 end if;
 select array_agg(value::uuid) into targets from jsonb_array_elements_text(p_input->'addonIds');
 select c.promo_code_id into result from public.set_promo_code((p_input->>'id')::uuid,p_input->>'code',(p_input->>'kind')::public.promo_kind,(p_input->>'amountFils')::integer,(p_input->>'percent')::numeric,targets,
 (p_input->>'validFrom')::date,(p_input->>'validTo')::date,(p_input->>'maxUses')::integer,(p_input->>'perCustomerLimit')::integer,(p_input->>'isCombinable')::boolean,(p_input->>'isActive')::boolean,p_input->>'reason') c;
 return result;
end $$;
revoke all on function public.save_checkout_coupon(jsonb,timestamptz) from public,anon;
grant execute on function public.save_checkout_coupon(jsonb,timestamptz) to authenticated,service_role;
comment on function public.save_checkout_coupon(jsonb,timestamptz) is '[CLIENT coupon request; §8] Audited Management coupon controls, inclusive Dubai dates and optimistic concurrency. Used codes retain their identity.';

create function internal.guard_coupon_reservation() returns trigger language plpgsql security definer set search_path='' as $$
declare v public.promo_codes%rowtype; reserved integer; customer_uses integer;
begin
 select * into v from public.promo_codes where id=new.promo_code_id for update;
 select count(*),count(*) filter(where b.customer_id=new.customer_id) into reserved,customer_uses
 from internal.checkout_attempts a join public.bookings b on b.id=a.booking_id
 where a.promo_id=v.id and a.booking_id<>new.booking_id and a.result is null and a.reservation_expires_at>now();
 customer_uses:=customer_uses+(select count(*) from public.promo_code_redemptions where promo_code_id=v.id and customer_id=new.customer_id);
 if (v.max_uses is not null and v.used_count+reserved>=v.max_uses) or (v.per_customer_limit is not null and customer_uses>=v.per_customer_limit) then
   raise exception 'This coupon has reached its usage limit or is reserved by another checkout.' using errcode='WP064';
 end if;
 return new;
end $$;
create trigger promo_redemption_reservation before insert on public.promo_code_redemptions for each row execute function internal.guard_coupon_reservation();
revoke all on function internal.guard_coupon_reservation() from public,anon,authenticated;
comment on function internal.guard_coupon_reservation() is '[§8; CLIENT coupon request] Cross-channel coupon ceiling. Reception redemptions and online reservations share the locked coupon counter.';

create function internal.purge_checkout_progress() returns void language plpgsql security definer set search_path='' as $$
declare cutoff timestamptz;
begin
 select now()-make_interval(months=>(value#>>'{}')::integer) into cutoff from public.settings where key='privacy.retention_months';
 if cutoff is null then return; end if;
 update internal.checkout_attempts a set snapshot=a.snapshot-'progress'
 from internal.checkout_sessions s where s.token=a.token and s.updated_at<cutoff;
 delete from internal.checkout_sessions where updated_at<cutoff;
end $$;
revoke all on function internal.purge_checkout_progress() from public,anon,authenticated,service_role;
select cron.schedule('wellplace-checkout-retention','23 3 * * *','select internal.purge_checkout_progress();');
comment on function internal.purge_checkout_progress() is '[§6.3; INV-28] Removes expired lead-booker checkout details using the Management retention setting. Financial line snapshots remain, and expired private receipt links stop resolving.';

create function internal.update_settled_refund_status() returns trigger language plpgsql security definer set search_path='' as $$
declare paid integer; returned bigint;
begin
 if new.settled_at is null then return new; end if;
 select amount_fils into paid from public.payments where id=new.payment_id for update;
 select coalesce(sum(amount_fils),0) into returned from public.refunds where payment_id=new.payment_id and settled_at is not null;
 update public.payments set status=case when returned>=paid then 'fully_refunded'::public.payment_status else 'partially_refunded'::public.payment_status end where id=new.payment_id;
 return new;
end $$;
create trigger refund_settlement_status after insert or update of settled_at on public.refunds for each row execute function internal.update_settled_refund_status();
revoke all on function internal.update_settled_refund_status() from public,anon,authenticated;
comment on function internal.update_settled_refund_status() is '[§8, §11.2] Confirmed live and simulated returns update the payment state from settled amounts. Pending requests reserve the refund balance without claiming that funds moved.';
comment on column public.refunds.tax_fils is '[§8; CLIENT VAT/refund request; OUR CHOICE] VAT credit apportioned from the stored booking tax using cumulative rounding. Full refunds reverse the original VAT exactly.';
