create or replace function public.grant_staff_permission(
  p_staff_id   uuid,
  p_permission public.named_permission,
  p_reason     text
)
returns table (
  staff_id   uuid,
  staff_email text,
  permission public.named_permission,
  granted_at timestamptz,
  granted_by uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email     text;
  v_active    boolean;
  v_role      public.staff_role;
  v_granted   timestamptz;
  v_actor     uuid := internal.current_staff_id();
begin
  perform internal.require_management();

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'grant_staff_permission: a reason is required — docs/5 §2 makes a grant an event with an actor and a reason [§10.6, INV-13]'
      using errcode = '22023';
  end if;

  select s.email, s.is_active, s.role
    into v_email, v_active, v_role
    from public.staff s
   where s.id = p_staff_id
   for update;

  if v_email is null then
    raise exception 'grant_staff_permission: no staff member with id %', p_staff_id
      using errcode = 'P0002';
  end if;

  if not v_active then
    raise exception 'grant_staff_permission: % is deactivated and internal.has_permission answers false for a deactivated account whatever it holds [§10.6]',
      v_email
      using errcode = 'WP053';
  end if;

  if exists (
    select 1
      from public.staff_permissions sp
     where sp.staff_id = p_staff_id
       and sp.permission = p_permission
  ) then
    raise exception 'grant_staff_permission: % already holds perm:% — a re-grant would overwrite the actor, the reason and the date of the original [§10.6]',
      v_email, p_permission
      using errcode = 'WP051';
  end if;

  insert into public.staff_permissions (staff_id, permission, granted_by, reason)
  values (p_staff_id, p_permission, v_actor, p_reason)
  returning public.staff_permissions.granted_at into v_granted;

  perform internal.write_audit(
    'grant_staff_permission',
    'public.staff_permissions',
    p_staff_id::text || ':' || p_permission::text,
    null::jsonb,
    jsonb_build_object(
      'staff_id',   p_staff_id,
      'email',      v_email,
      'role',       v_role,
      'permission', p_permission,
      'granted_at', v_granted,
      'granted_by', v_actor
    ),
    p_reason
  );

  staff_id    := p_staff_id;
  staff_email := v_email;
  permission  := p_permission;
  granted_at  := v_granted;
  granted_by  := v_actor;
  return next;
end
$$;


create or replace function public.revoke_staff_permission(
  p_staff_id   uuid,
  p_permission public.named_permission,
  p_reason     text
)
returns table (
  staff_id         uuid,
  staff_email      text,
  permission       public.named_permission,
  revoked_grant_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email      text;
  v_role       public.staff_role;
  v_granted    timestamptz;
  v_granted_by uuid;
  v_reason     text;
begin
  perform internal.require_management();

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'revoke_staff_permission: a reason is required — removing a permission is a manual change and §3 audits every one [§10.6, INV-13]'
      using errcode = '22023';
  end if;

  select s.email, s.role
    into v_email, v_role
    from public.staff s
   where s.id = p_staff_id
   for update;

  if v_email is null then
    raise exception 'revoke_staff_permission: no staff member with id %', p_staff_id
      using errcode = 'P0002';
  end if;

  select sp.granted_at, sp.granted_by, sp.reason
    into v_granted, v_granted_by, v_reason
    from public.staff_permissions sp
   where sp.staff_id = p_staff_id
     and sp.permission = p_permission
   for update;

  if v_granted is null then
    raise exception 'revoke_staff_permission: % does not hold perm:% — there is nothing to revoke and a silent success would read as one [§10.6]',
      v_email, p_permission
      using errcode = 'WP052';
  end if;

  delete from public.staff_permissions sp
   where sp.staff_id = p_staff_id
     and sp.permission = p_permission;

  perform internal.write_audit(
    'revoke_staff_permission',
    'public.staff_permissions',
    p_staff_id::text || ':' || p_permission::text,
    jsonb_build_object(
      'staff_id',   p_staff_id,
      'email',      v_email,
      'role',       v_role,
      'permission', p_permission,
      'granted_at', v_granted,
      'granted_by', v_granted_by,
      'grant_reason', v_reason
    ),
    null::jsonb,
    p_reason
  );

  staff_id         := p_staff_id;
  staff_email      := v_email;
  permission       := p_permission;
  revoked_grant_at := v_granted;
  return next;
end
$$;


comment on function public.grant_staff_permission(uuid, public.named_permission, text) is
  'Grant one named permission to one staff member [§10.6]. Management only, transcribed from docs/5 §3 "Grant or revoke a named permission - reception no, management yes [ASSUMED], implied by §10.6". The four values of public.named_permission are the closed list and the enum refuses a fifth, so no list is restated here.

A RE-GRANT IS REFUSED, NOT RE-STAMPED (WP051). public.staff_permissions carries granted_at, granted_by and the reason, and docs/5 §2 makes a grant "an event with an actor and a reason". An upsert would quietly replace all three with today''s manager and today''s reason, destroying the record of who originally opened the permission and why - the same reason WP019 and WP024 refuse rather than re-stamp elsewhere in this schema. Revoke and grant again if the record genuinely needs to change; both halves are then in audit.entries.

A DEACTIVATED ACCOUNT IS REFUSED (WP053). internal.has_permission returns false for anyone whose staff row is inactive, so the grant would sit in the table doing nothing and reading as access that does not exist. Reactivate first.

SELF-GRANT IS PERMITTED, and that is a decision rather than an oversight. Refusing it would be the stronger segregation of duties, but §10.6 names no second approver and WellPlace may operate with one manager, in which case perm:override_suite_allocation and perm:manual_price_change would be unreachable for anyone. The audit entry names the actor and the subject, so a self-grant is visible in the §10.6 log rather than prevented. Revisit if the client answers Q-9 with a third tier.';


comment on function public.revoke_staff_permission(uuid, public.named_permission, text) is
  'Remove one named permission from one staff member [§10.6]. Management only, the mirror of public.grant_staff_permission and subject to the same docs/5 §3 row.

WP052 REFUSES A REVOKE OF SOMETHING NOT HELD. A no-op that returned a row would read on screen as "the permission has been removed" whether or not it was ever there, which is the wrong answer to give a manager checking who can change a price. The refusal names the person and the permission.

The row is DELETED rather than flagged, which is the one place this schema does not keep history in the table itself. That is safe only because the audit entry carries the whole grant it removed - granted_at, granted_by and the original reason - so audit.entries remains the complete record of who could do what and when, and audit.entries cannot be deleted or altered [INV-14]. The primary key (staff_id, permission) is what makes a soft delete awkward here and a re-grant later is a new event, which is the honest reading of docs/5 §2.

Nothing checks that the caller is not revoking their own last permission. §10.6 does not require it, and a manager who removes their own perm:manual_price_change can be granted it again by any manager, themselves included.';


revoke all on function public.grant_staff_permission(uuid, public.named_permission, text) from public;
revoke all on function public.revoke_staff_permission(uuid, public.named_permission, text) from public;

grant execute on function public.grant_staff_permission(uuid, public.named_permission, text)
  to authenticated, service_role;
grant execute on function public.revoke_staff_permission(uuid, public.named_permission, text)
  to authenticated, service_role;
