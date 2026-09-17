create function internal.trim_whitespace(p_value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select btrim(
    p_value,
    (select string_agg(chr(c.code_point), '')
       from unnest(array[
         9, 10, 11, 12, 13, 32, 133, 160, 5760,
         8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199,
         8200, 8201, 8202, 8203, 8204, 8205, 8206, 8207,
         8232, 8233, 8239, 8287, 12288, 65279
       ]) as c(code_point))
  )
$$;

revoke all on function internal.trim_whitespace(text) from public, anon;
grant execute on function internal.trim_whitespace(text) to authenticated, service_role;

comment on function internal.trim_whitespace(text) is
  '[CLIENT coupon request 2026-09-12] Removes whitespace from both ends of a value: ASCII whitespace (tab, line feed, vertical tab, form feed, carriage return, space), next line, the no-break and Unicode space separators, the zero-width spaces, joiners and marks, the line and paragraph separators and the byte-order mark. That is everything JavaScript''s String.prototype.trim removes plus the invisible zero-width characters, so a value the console has already trimmed is only ever shortened further by characters nobody can see. Interior characters are never touched. Executable by the signed-in and service roles on purpose, the same reasoning as internal.normalise_email: the promo_codes_batch_name_shaped check constraint calls it, and PostgreSQL checks EXECUTE on a function inside a constraint against the role performing the write.';


update public.promo_codes p
   set batch_name = nullif(internal.trim_whitespace(p.batch_name), '')
 where p.batch_name is distinct from nullif(internal.trim_whitespace(p.batch_name), '');

alter table public.promo_codes
  drop constraint promo_codes_batch_name_shaped;

alter table public.promo_codes
  add constraint promo_codes_batch_name_shaped
    check (
      batch_name is null
      or (
        batch_id is not null
        and batch_name = internal.trim_whitespace(batch_name)
        and char_length(batch_name) between 1 and 80
      )
    );

comment on constraint promo_codes_batch_name_shaped on public.promo_codes is
  '[CLIENT coupon request 2026-09-12] A batch name labels a batch, so it cannot exist without batch_id. It is 1 to 80 characters and has no whitespace at either end, measured by internal.trim_whitespace rather than btrim, which only removes spaces and let a tab, a line break or a no-break space through. 20260912100000 replaced the btrim version and trimmed any stored name that did not meet it.';


alter table public.promo_code_redemptions
  drop constraint promo_code_redemptions_code_snapshot_shaped;

alter table public.promo_code_redemptions
  add constraint promo_code_redemptions_code_snapshot_shaped
    check (
      code_snapshot ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'
      and char_length(code_snapshot) between 3 and 40
    );

comment on constraint promo_code_redemptions_code_snapshot_shaped on public.promo_code_redemptions is
  '[CLIENT coupon request 2026-09-12] The snapshot has exactly the shape public.promo_codes enforces on a code: upper-case letters and digits in hyphen groups, 3 to 40 characters. Since 20260912100000 the snapshot can come from a checkout''s recorded progress rather than from the coupon row, so the column holds the full code shape and not only upper case and length.';


create index checkout_attempts_booking_idx
  on internal.checkout_attempts (booking_id, created_at desc);

comment on index internal.checkout_attempts_booking_idx is
  '[CLIENT coupon request 2026-09-12] Finds the latest payment attempt for a booking, which internal.snapshot_redeemed_coupon_code reads for every redemption and public.settle_payment_event reads when it looks for a newer attempt on the same booking.';


create or replace function internal.snapshot_redeemed_coupon_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_checkout_code text;
begin
  if new.code_snapshot is null then
    select upper(internal.trim_whitespace(a.snapshot #>> '{progress,selection,voucherCode}'))
      into v_checkout_code
      from internal.checkout_attempts a
     where a.booking_id = new.booking_id
       and a.promo_id = new.promo_code_id
     order by a.created_at desc, a.id desc
     limit 1;

    if v_checkout_code is not null
       and v_checkout_code ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'
       and char_length(v_checkout_code) between 3 and 40 then
      new.code_snapshot := v_checkout_code;
    else
      new.code_snapshot := (
        select p.code
          from public.promo_codes p
         where p.id = new.promo_code_id
      );
    end if;
  end if;
  return new;
end
$$;

revoke all on function internal.snapshot_redeemed_coupon_code() from public, anon, authenticated;

comment on function internal.snapshot_redeemed_coupon_code() is
  '[CLIENT coupon request 2026-09-12] Records the code the guest used on a redemption when the writer does not supply one. For an online booking that is the code the checkout recorded: the latest internal.checkout_attempts row for the booking and this coupon, at snapshot.progress.selection.voucherCode. That is the value public.prepare_guest_payment matched to promo_id, so it survives a manager renaming the coupon, or reissuing its old code, while the payment is open. It is used only if it has the shape of a code (upper-case letters and digits in hyphen groups, 3 to 40 characters). Otherwise, and on the Reception path, which has no checkout attempt, the coupon''s current code is used, so a malformed or purged snapshot never makes a settlement fail. The writers in public.create_reception_booking_selected and public.settle_payment_event insert only the coupon, booking and customer and are unchanged.';

comment on trigger promo_redemption_snapshot_code on public.promo_code_redemptions is
  '[CLIENT coupon request 2026-09-12] Fills code_snapshot through internal.snapshot_redeemed_coupon_code: the code the checkout recorded when there is a well-formed one, otherwise the coupon''s current code. Triggers on one table and event fire in name order, so this runs after promo_redemption_reservation, which locks the coupon row; the fallback read of the current code therefore happens under that lock.';


create or replace function public.generate_checkout_coupons(
  p_template   jsonb,
  p_codes      text[],
  p_batch_name text default null,
  p_reason     text default null
)
returns table (
  promo_code_id uuid,
  code          text,
  batch_id      uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_batch_max      constant integer := 500;
  v_batch_name_max constant integer := 80;
  v_codes          text[];
  v_creation_order text[];
  v_duplicates     text;
  v_conflicts      text;
  v_batch_id       uuid := gen_random_uuid();
  v_batch_name     text := nullif(internal.trim_whitespace(p_batch_name), '');
  v_reason         text := coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Coupons generated from the console');
  v_targets        uuid[];
  v_created        uuid[] := array[]::uuid[];
  v_code           text;
  v_id             uuid;
begin
  perform internal.require_management();

  if p_codes is null or cardinality(p_codes) = 0 then
    raise exception 'Add at least one coupon code to generate.'
      using errcode = 'WP080';
  end if;

  if cardinality(p_codes) > v_batch_max then
    raise exception 'Generate no more than % coupons at a time.', v_batch_max
      using errcode = 'WP080';
  end if;

  if exists (
    select 1
      from unnest(p_codes) as t(raw)
     where nullif(internal.trim_whitespace(t.raw), '') is null
  ) then
    raise exception 'Every coupon needs a code. Remove the empty entries and generate again.'
      using errcode = 'WP080';
  end if;

  if v_batch_name is not null and char_length(v_batch_name) > v_batch_name_max then
    raise exception 'Keep the batch name within % characters.', v_batch_name_max
      using errcode = 'WP080';
  end if;

  perform pg_advisory_xact_lock(hashtext('wellplace.coupon_generation')::bigint);

  select array_agg(upper(btrim(t.raw)) order by t.ordinal)
    into v_codes
    from unnest(p_codes) with ordinality as t(raw, ordinal);

  select string_agg(d.normalised, ',' order by d.normalised)
    into v_duplicates
    from (
      select c.normalised
        from unnest(v_codes) as c(normalised)
       group by c.normalised
      having count(*) > 1
    ) d;

  if v_duplicates is not null then
    raise exception 'Each code can appear only once. Remove the repeated codes and generate again.'
      using errcode = 'WP080', detail = v_duplicates;
  end if;

  select string_agg(p.code, ',' order by p.code)
    into v_conflicts
    from public.promo_codes p
   where p.code = any (v_codes);

  if v_conflicts is not null then
    raise exception 'Some of these codes already exist. Change or remove them and generate again.'
      using errcode = 'WP081', detail = v_conflicts;
  end if;

  select array_agg(a.value::uuid)
    into v_targets
    from jsonb_array_elements_text(
      case when jsonb_typeof(p_template -> 'addonIds') = 'array' then p_template -> 'addonIds' end
    ) a;

  select array_agg(c.normalised order by c.normalised collate pg_catalog."C")
    into v_creation_order
    from unnest(v_codes) as c(normalised);

  foreach v_code in array v_creation_order loop
    select c.promo_code_id into v_id
      from public.set_promo_code(
        null,
        v_code,
        (p_template ->> 'kind')::public.promo_kind,
        (p_template ->> 'amountFils')::integer,
        (p_template ->> 'percent')::numeric,
        v_targets,
        (p_template ->> 'validFrom')::date,
        (p_template ->> 'validTo')::date,
        (p_template ->> 'maxUses')::integer,
        (p_template ->> 'perCustomerLimit')::integer,
        (p_template ->> 'isCombinable')::boolean,
        (p_template ->> 'isActive')::boolean,
        v_reason
      ) c;

    v_created := v_created || v_id;
  end loop;

  update public.promo_codes p
     set batch_id   = v_batch_id,
         batch_name = v_batch_name
   where p.id = any (v_created);

  perform internal.write_audit(
    'generate_checkout_coupons',
    'public.promo_codes',
    v_batch_id::text,
    null,
    jsonb_build_object(
      'batch_id',   v_batch_id,
      'batch_name', v_batch_name,
      'count',      cardinality(v_created),
      'coupon_ids', to_jsonb(v_created),
      'codes',      to_jsonb(v_codes),
      'template',   p_template
    ),
    v_reason
  );

  return query
    select p.id, p.code, p.batch_id
      from unnest(v_codes) with ordinality as n(normalised, ordinal)
      join public.promo_codes p on p.code = n.normalised
     where p.id = any (v_created)
     order by n.ordinal;
end
$$;

revoke all on function public.generate_checkout_coupons(jsonb, text[], text, text) from public, anon;
grant execute on function public.generate_checkout_coupons(jsonb, text[], text, text) to authenticated, service_role;

comment on function public.generate_checkout_coupons(jsonb, text[], text, text) is
  '[CLIENT coupon request 2026-09-12] Creates coupons in bulk. The manager chooses how many, and whether the codes are random or typed in. The random codes are built in TypeScript (src/lib/domain/vouchers/coupon-codes.ts), so this function receives the final list and creates all of it or none of it. Management only. Refused with WP080: an empty list, more than 500 entries (COUPON_GENERATION.batchMax), an entry that is null or only whitespace, a code that appears twice after upper-casing and trimming (the repeated codes are in DETAIL), and a batch name over 80 characters once internal.trim_whitespace has removed whitespace from both ends. A code that already exists is refused with WP081, with the conflicting codes in DETAIL so the caller can regenerate only those. Generation runs one batch at a time under a transaction advisory lock, and it also creates coupons in code order (C collation). That way a batch never deadlocks with another: a batch that overlaps one still running waits, then sees the other batch''s codes and gets WP081, and a race with a single coupon saved at the same moment surfaces as 23505. Each coupon is created through public.set_promo_code with the shared terms in p_template (the same camelCase keys public.save_checkout_coupon reads), so validation and the per-coupon audit entry are identical to creating one by hand. One batch-level audit entry records the batch id, name, template and the codes in the order given. Returns one row per coupon, in the order the codes were given, with the batch id they share.';
