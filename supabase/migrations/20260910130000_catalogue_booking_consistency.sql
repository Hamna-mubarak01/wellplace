do $$
declare v_function record; v_body text; v_count integer := 0;
begin
  for v_function in select p.oid,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='create_reception_booking'
  loop
    v_count := v_count + 1;
    v_body := replace(v_function.prosrc,'where not a.is_active', 'where not a.is_active or a.inventory = 0');
    if v_body = v_function.prosrc then raise exception 'Expected add-on availability guard was not found'; end if;
    v_body := replace(v_body,'current_date', '(clock_timestamp() at time zone ''Asia/Dubai'')::date');
    execute replace(pg_get_functiondef(v_function.oid),v_function.prosrc,v_body);
  end loop;
  if v_count <> 1 then raise exception 'Expected one Reception booking function'; end if;
end $$;
