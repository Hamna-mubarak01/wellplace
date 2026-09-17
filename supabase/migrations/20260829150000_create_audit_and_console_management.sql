begin;

create table audit.entries (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),

  actor_id    uuid,
  actor_email text,
  actor_role  public.staff_role,

  action      text not null,
  entity      text not null,
  entity_id   text,

  old_value   jsonb,
  new_value   jsonb,
  reason      text,

  constraint audit_entries_action_shaped check (action ~ '^[a-z_]+$'),
  constraint audit_entries_entity_shaped check (entity ~ '^[a-z_.]+$')
);

comment on table audit.entries is
  'Append-only [§3, §10.6]. Actor, action, entity, old value, new value and '
  'reason for every manual change. UPDATE and DELETE are revoked at database '
  'level rather than merely unused (INV-14).';

create index audit_entries_entity_idx on audit.entries (entity, entity_id, occurred_at desc);
create index audit_entries_actor_idx  on audit.entries (actor_id, occurred_at desc);

alter table audit.entries enable row level security;

revoke all on audit.entries from anon, authenticated;
grant select on audit.entries to authenticated;

create policy audit_entries_select_management on audit.entries
  for select to authenticated
  using (internal.is_management());

create or replace function internal.current_staff_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.email', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
    ), ''
  )
$$;

create or replace function internal.write_audit(
  p_action    text,
  p_entity    text,
  p_entity_id text,
  p_old_value jsonb default null,
  p_new_value jsonb default null,
  p_reason    text default null
)
returns bigint
language sql
volatile
security definer
set search_path = ''
as $$
  insert into audit.entries (
    actor_id, actor_email, actor_role,
    action, entity, entity_id, old_value, new_value, reason
  )
  values (
    internal.current_staff_id(),
    internal.current_staff_email(),
    internal.current_staff_role(),
    p_action, p_entity, p_entity_id, p_old_value, p_new_value, p_reason
  )
  returning id
$$;

comment on function internal.write_audit(text, text, text, jsonb, jsonb, text) is
  'The only way an audit row is written. internal schema, so no client can '
  'reach it and forge an actor.';

create or replace function internal.require_management()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not internal.is_management() then
    raise exception 'Management role required'
      using errcode = '42501';
  end if;
end
$$;

alter table public.waitlist_entries
  add column archived_at timestamptz,
  add column archived_by uuid references public.staff(id);

create index waitlist_entries_archived_idx
  on public.waitlist_entries (archived_at)
  where archived_at is not null;

create or replace view public.waitlist_leads
  with (security_invoker = true)
as
  select
    e.id,
    e.salutation,
    e.first_name,
    e.last_name,
    e.email,
    e.date_of_birth,

    extract(year from age(current_date, e.date_of_birth))::integer as age_years,

    e.phone_e164,
    e.phone_country,
    e.source,
    e.referrer,
    e.utm_source,
    e.utm_medium,
    e.utm_campaign,
    e.utm_content,
    e.utm_term,
    e.signup_count,
    e.last_signup_at,
    e.created_at,

    coalesce(c.granted, false) as marketing_consent,
    c.occurred_at              as marketing_consent_at,
    e.privacy_notice_version   as privacy_notice_version,

    e.archived_at,
    e.archived_by
  from public.waitlist_entries e

  left join lateral (
    select ev.granted, ev.occurred_at
      from public.marketing_consent_events ev
     where ev.waitlist_entry_id = e.id
     order by ev.seq desc
     limit 1
  ) c on true

  where not e.is_spam;

comment on view public.waitlist_leads is
  'The leads screen [§5.2]. Carries the calculated age, which the table '
  'deliberately does not store, the current marketing consent reduced from '
  'public.marketing_consent_events, and the archive state. security_invoker, '
  'so RLS applies to the caller.';

revoke all on public.waitlist_leads from anon, authenticated;
grant select on public.waitlist_leads to authenticated;

create or replace function public.archive_waitlist_entry(
  p_entry_id uuid,
  p_reason   text default null
)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_archived_at timestamptz;
  v_was         timestamptz;
begin
  perform internal.require_management();

  select archived_at into v_was
    from public.waitlist_entries
   where id = p_entry_id
   for update;

  if not found then
    raise exception 'No waitlist entry %', p_entry_id using errcode = 'P0002';
  end if;

  update public.waitlist_entries
     set archived_at = coalesce(archived_at, now()),
         archived_by = coalesce(archived_by, internal.current_staff_id())
   where id = p_entry_id
   returning archived_at into v_archived_at;

  perform internal.write_audit(
    'archive_waitlist_entry', 'public.waitlist_entries', p_entry_id::text,
    jsonb_build_object('archived_at', v_was),
    jsonb_build_object('archived_at', v_archived_at),
    p_reason
  );

  return v_archived_at;
end
$$;

create or replace function public.restore_waitlist_entry(
  p_entry_id uuid,
  p_reason   text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_was timestamptz;
begin
  perform internal.require_management();

  select archived_at into v_was
    from public.waitlist_entries
   where id = p_entry_id
   for update;

  if not found then
    raise exception 'No waitlist entry %', p_entry_id using errcode = 'P0002';
  end if;

  update public.waitlist_entries
     set archived_at = null,
         archived_by = null
   where id = p_entry_id;

  perform internal.write_audit(
    'restore_waitlist_entry', 'public.waitlist_entries', p_entry_id::text,
    jsonb_build_object('archived_at', v_was),
    jsonb_build_object('archived_at', null),
    p_reason
  );
end
$$;

create or replace function public.erase_waitlist_entry(
  p_entry_id uuid,
  p_reason   text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email        text;
  v_signup_count integer;
  v_created_at   timestamptz;
begin
  perform internal.require_management();

  select email, signup_count, created_at
    into v_email, v_signup_count, v_created_at
    from public.waitlist_entries
   where id = p_entry_id
   for update;

  if not found then
    raise exception 'No waitlist entry %', p_entry_id using errcode = 'P0002';
  end if;

  delete from public.waitlist_entries where id = p_entry_id;

  perform internal.write_audit(
    'erase_waitlist_entry', 'public.waitlist_entries', p_entry_id::text,
    jsonb_build_object(
      'email_domain', split_part(v_email, '@', 2),
      'signup_count', v_signup_count,
      'created_at',   v_created_at
    ),
    null,
    p_reason
  );
end
$$;

comment on function public.erase_waitlist_entry(uuid, text) is
  'Permanent erasure for a withdrawal request [CONFIRMED, INV-28, R-46]. The '
  'audit entry deliberately records only the email DOMAIN, the signup count and '
  'the join date: an erasure that copied the name, address and phone into an '
  'append-only log would not be an erasure. The fact of the deletion, its actor '
  'and its reason survive; the person does not.';

create table public.staff_invitations (
  id          uuid primary key default gen_random_uuid(),

  email       text not null,
  full_name   text not null,
  role        public.staff_role not null,

  invited_by  uuid not null references public.staff(id),
  invited_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days',

  accepted_at timestamptz,
  accepted_by uuid references public.staff(id),

  revoked_at  timestamptz,
  revoked_by  uuid references public.staff(id),

  constraint staff_invitations_email_lowercase check (email = lower(email)),
  constraint staff_invitations_email_shaped    check (email like '%_@_%._%'),
  constraint staff_invitations_name_length     check (length(full_name) between 1 and 120)
);

comment on table public.staff_invitations is
  'An invitation is an event with an inviter and an expiry. The staff row is '
  'created only when the person actually signs in and claims it, so an '
  'unaccepted invitation never becomes an account that can be used.';

create unique index staff_invitations_pending_email_idx
  on public.staff_invitations (email)
  where accepted_at is null and revoked_at is null;

alter table public.staff_invitations enable row level security;

revoke all on public.staff_invitations from anon, authenticated;
grant select on public.staff_invitations to authenticated;

create policy staff_invitations_select_management on public.staff_invitations
  for select to authenticated
  using (internal.is_management());

create or replace function public.invite_staff_member(
  p_email     text,
  p_full_name text,
  p_role      public.staff_role
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id    uuid;
begin
  perform internal.require_management();

  if exists (select 1 from public.staff where email = v_email and is_active) then
    raise exception 'That address is already an active staff member'
      using errcode = '23505';
  end if;

  insert into public.staff_invitations (email, full_name, role, invited_by)
  values (v_email, btrim(p_full_name), p_role, internal.current_staff_id())
  on conflict (email) where accepted_at is null and revoked_at is null
  do update set
    full_name  = excluded.full_name,
    role       = excluded.role,
    invited_by = excluded.invited_by,
    invited_at = now(),
    expires_at = now() + interval '7 days'
  returning id into v_id;

  perform internal.write_audit(
    'invite_staff_member', 'public.staff_invitations', v_id::text,
    null,
    jsonb_build_object('email', v_email, 'role', p_role),
    null
  );

  return v_id;
end
$$;

create or replace function public.revoke_staff_invitation(
  p_invitation_id uuid,
  p_reason        text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  perform internal.require_management();

  update public.staff_invitations
     set revoked_at = now(),
         revoked_by = internal.current_staff_id()
   where id = p_invitation_id
     and accepted_at is null
     and revoked_at is null
   returning email into v_email;

  if not found then
    raise exception 'No open invitation %', p_invitation_id using errcode = 'P0002';
  end if;

  perform internal.write_audit(
    'revoke_staff_invitation', 'public.staff_invitations', p_invitation_id::text,
    jsonb_build_object('email', v_email, 'revoked_at', null),
    jsonb_build_object('email', v_email, 'revoked_at', now()),
    p_reason
  );
end
$$;

create or replace function public.claim_staff_invitation()
returns public.staff_role
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := internal.current_staff_id();
  v_email text := internal.current_staff_email();
  v_inv   public.staff_invitations;
begin
  if v_uid is null or v_email is null then
    return null;
  end if;

  select role into strict v_inv.role
    from public.staff
   where id = v_uid and is_active;

  return v_inv.role;

exception when no_data_found then
  select * into v_inv
    from public.staff_invitations
   where email = lower(v_email)
     and accepted_at is null
     and revoked_at is null
     and expires_at > now()
   for update;

  if not found then
    return null;
  end if;

  insert into public.staff (id, email, full_name, role, created_by)
  values (v_uid, lower(v_email), v_inv.full_name, v_inv.role, v_inv.invited_by)
  on conflict (id) do update set is_active = true;

  update public.staff_invitations
     set accepted_at = now(),
         accepted_by = v_uid
   where id = v_inv.id;

  perform internal.write_audit(
    'claim_staff_invitation', 'public.staff', v_uid::text,
    null,
    jsonb_build_object('email', lower(v_email), 'role', v_inv.role),
    'Invitation accepted at first sign-in'
  );

  return v_inv.role;
end
$$;

comment on function public.claim_staff_invitation() is
  'Called once per console load. Returns the caller''s role, creating the staff '
  'row on the first sign-in after an invitation. A signed-in user with neither '
  'a staff row nor a live invitation gets NULL and therefore no access — which '
  'is what makes it safe for anyone to request a magic link.';

create or replace function public.set_staff_active(
  p_staff_id  uuid,
  p_is_active boolean,
  p_reason    text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_was boolean;
begin
  perform internal.require_management();

  if p_staff_id = internal.current_staff_id() then
    raise exception 'You cannot change your own access'
      using errcode = '42501';
  end if;

  select is_active into v_was
    from public.staff where id = p_staff_id for update;

  if not found then
    raise exception 'No staff member %', p_staff_id using errcode = 'P0002';
  end if;

  update public.staff set is_active = p_is_active where id = p_staff_id;

  perform internal.write_audit(
    'set_staff_active', 'public.staff', p_staff_id::text,
    jsonb_build_object('is_active', v_was),
    jsonb_build_object('is_active', p_is_active),
    p_reason
  );
end
$$;

create or replace function public.set_staff_role(
  p_staff_id uuid,
  p_role     public.staff_role,
  p_reason   text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_was public.staff_role;
begin
  perform internal.require_management();

  if p_staff_id = internal.current_staff_id() then
    raise exception 'You cannot change your own role'
      using errcode = '42501';
  end if;

  select role into v_was
    from public.staff where id = p_staff_id for update;

  if not found then
    raise exception 'No staff member %', p_staff_id using errcode = 'P0002';
  end if;

  update public.staff set role = p_role where id = p_staff_id;

  perform internal.write_audit(
    'set_staff_role', 'public.staff', p_staff_id::text,
    jsonb_build_object('role', v_was),
    jsonb_build_object('role', p_role),
    p_reason
  );
end
$$;

revoke all on function
  public.archive_waitlist_entry(uuid, text),
  public.restore_waitlist_entry(uuid, text),
  public.erase_waitlist_entry(uuid, text),
  public.invite_staff_member(text, text, public.staff_role),
  public.revoke_staff_invitation(uuid, text),
  public.claim_staff_invitation(),
  public.set_staff_active(uuid, boolean, text),
  public.set_staff_role(uuid, public.staff_role, text)
from public;

grant execute on function
  public.archive_waitlist_entry(uuid, text),
  public.restore_waitlist_entry(uuid, text),
  public.erase_waitlist_entry(uuid, text),
  public.invite_staff_member(text, text, public.staff_role),
  public.revoke_staff_invitation(uuid, text),
  public.claim_staff_invitation(),
  public.set_staff_active(uuid, boolean, text),
  public.set_staff_role(uuid, public.staff_role, text)
to authenticated;

commit;
