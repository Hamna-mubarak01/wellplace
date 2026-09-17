-- [CLIENT] One Overstay charges editor saves its two engine settings atomically.
create or replace function public.set_overstay_charges(p_value jsonb, p_reason text)
returns table(rate_source text, amount_fils bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source text;
  v_amount numeric;
begin
  perform internal.require_management();
  if p_value is null or jsonb_typeof(p_value) <> 'object' then
    raise exception 'Choose valid overstay charges.' using errcode='22023';
  end if;
  v_source := p_value->>'rateSource';
  if v_source is null or v_source not in ('regular_hourly','offer_hourly','fixed') then
    raise exception 'Choose a supported overstay charge option.' using errcode='22023';
  end if;
  if p_value->'amountFils' is not null and p_value->'amountFils' <> 'null'::jsonb then
    if jsonb_typeof(p_value->'amountFils') <> 'number' then
      raise exception 'Choose a valid custom amount.' using errcode='22023';
    end if;
    v_amount := (p_value->>'amountFils')::numeric;
    if v_amount < 0 or v_amount <> trunc(v_amount) or v_amount > 2147483647 then
      raise exception 'Choose a valid custom amount.' using errcode='22023';
    end if;
  end if;
  if v_source='fixed' and v_amount is null then
    raise exception 'Enter the custom amount before saving.' using errcode='22023';
  end if;

  -- A concurrent editor cannot combine one manager's mode with another's amount.
  perform 1 from public.settings
    where key in ('overrun.fixed_fils_per_increment','overrun.rate_source')
    order by key for update;
  perform public.set_setting('overrun.fixed_fils_per_increment',to_jsonb(v_amount),p_reason);
  perform public.set_setting('overrun.rate_source',to_jsonb(v_source),p_reason);
  return query select v_source,v_amount::bigint;
end
$$;
comment on function public.set_overstay_charges(jsonb,text) is
  '[CLIENT, §7.6] Management saves the charge option and custom amount together. Uses the existing audited settings writer; the pricing and overrun recording engines continue reading the same keys. Existing recorded charges are unchanged.';
revoke all on function public.set_overstay_charges(jsonb,text) from public,anon;
grant execute on function public.set_overstay_charges(jsonb,text) to authenticated,service_role;
