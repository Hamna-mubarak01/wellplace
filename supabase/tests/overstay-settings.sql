begin;
select plan(14);
insert into public.staff(id,email,full_name,role) values
 ('d3810000-0000-4000-8000-000000000001','overstay.manager@example.test','Overstay Manager','management'),
 ('d3810000-0000-4000-8000-000000000002','overstay.reception@example.test','Overstay Reception','reception');
select ok(not has_function_privilege('anon','public.set_overstay_charges(jsonb,text)','execute'),'Guests cannot change charges');
set local request.jwt.claims='{"sub":"d3810000-0000-4000-8000-000000000002"}';
select throws_ok($$select public.set_overstay_charges('{"rateSource":"fixed","amountFils":1234}','Test charges')$$,'42501',null,'Reception cannot configure charges');
set local request.jwt.claims='{"sub":"d3810000-0000-4000-8000-000000000001"}';
select is((select amount_fils from public.set_overstay_charges('{"rateSource":"fixed","amountFils":1234}','Test charges')),1234::bigint,'Management saves the AED amount in exact fils');
select is((select value from public.settings where key='overrun.rate_source'),'"fixed"'::jsonb,'The actual pricing-engine rate source changes');
select is((select value from public.settings where key='overrun.fixed_fils_per_increment'),'1234'::jsonb,'The actual pricing-engine custom amount changes');
select is((select count(*)::int from audit.entries where actor_id='d3810000-0000-4000-8000-000000000001' and reason='Test charges'),2,'Both changed settings are audited in the transaction');
select throws_ok($$select public.set_overstay_charges('{"rateSource":"fixed","amountFils":null}','Test')$$,'22023',null,'A custom charge cannot be saved without an amount');
select throws_ok($$select public.set_overstay_charges('{"rateSource":"unknown","amountFils":100}','Test')$$,'22023',null,'Unsupported modes are refused');
select throws_ok($$select public.set_overstay_charges('{"rateSource":"fixed","amountFils":-1}','Test')$$,'22023',null,'Negative amounts are refused');
select throws_ok($$select public.set_overstay_charges('{"rateSource":"fixed","amountFils":1.5}','Test')$$,'22023',null,'Fractional fils are refused');
select is((select rate_source from public.set_overstay_charges('{"rateSource":"offer_hourly","amountFils":1234}','Offer charges')),'offer_hourly','Switching the charge option also reaches the pricing engine');
-- Force the second write to fail: no partial amount or audit entry may survive.
delete from public.settings where key='overrun.rate_source';
create temp table before_overstay_audit as select count(*)::int as n from audit.entries;
select throws_ok($$select public.set_overstay_charges('{"rateSource":"fixed","amountFils":9999}','Must roll back')$$,'WP048',null,'A missing second setting aborts the whole save');
select is((select value from public.settings where key='overrun.fixed_fils_per_increment'),'1234'::jsonb,'The first setting rolls back with the failed second write');
select is((select count(*)::int from audit.entries),(select n from before_overstay_audit),'No partial audit entry survives a failed save');
select * from finish();
rollback;
