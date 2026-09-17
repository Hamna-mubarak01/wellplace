


alter table public.staff
  drop constraint staff_created_by_fkey,
  add  constraint staff_created_by_fkey
    foreign key (created_by) references public.staff(id) on delete set null;

alter table public.staff_permissions
  drop constraint staff_permissions_granted_by_fkey,
  add  constraint staff_permissions_granted_by_fkey
    foreign key (granted_by) references public.staff(id) on delete set null;

alter table public.waitlist_entries
  drop constraint waitlist_entries_archived_by_fkey,
  add  constraint waitlist_entries_archived_by_fkey
    foreign key (archived_by) references public.staff(id) on delete set null;

alter table public.staff_invitations
  alter column invited_by drop not null;

alter table public.staff_invitations
  drop constraint staff_invitations_invited_by_fkey,
  add  constraint staff_invitations_invited_by_fkey
    foreign key (invited_by) references public.staff(id) on delete set null;

alter table public.staff_invitations
  drop constraint staff_invitations_accepted_by_fkey,
  add  constraint staff_invitations_accepted_by_fkey
    foreign key (accepted_by) references public.staff(id) on delete set null;

alter table public.staff_invitations
  drop constraint staff_invitations_revoked_by_fkey,
  add  constraint staff_invitations_revoked_by_fkey
    foreign key (revoked_by) references public.staff(id) on delete set null;

comment on column public.staff_invitations.invited_by is
  'NULL means the inviter has since been deleted, never that nobody invited '
  'them. Who invited whom is preserved permanently by the invite_staff_member '
  'audit entry, which carries actor_email [INV-13].';



create or replace function internal.staff_quorum_lock()
returns void
language sql
volatile
security definer
set search_path = ''
as $$ select pg_advisory_xact_lock(hashtext('wellplace.staff_management_quorum')) $$;

comment on function internal.staff_quorum_lock() is
  'Serialises every operation that can reduce the number of active management '
  'accounts. internal schema, so no client can take or hold it directly.';

revoke all on function internal.staff_quorum_lock() from public;
grant execute on function internal.staff_quorum_lock() to authenticated, service_role;



create type public.staff_deletion_result as (
  staff_id            uuid,
  email               text,
  full_name           text,
  role                public.staff_role,
  was_active          boolean,
  invitations_revoked integer,
  deleted_at          timestamptz
);

comment on type public.staff_deletion_result is
  'Return of public.delete_staff_member(). Carries the email because the staff '
  'row is only half the account: public.staff.id IS the Supabase Auth user id, '
  'and there is no FK between them, so the Server Action still has to delete '
  'the matching auth user afterwards and log that against a real address. '
  'Returning it from the same transaction that removed the row is the only way '
  'the caller can be sure which address it just revoked.';



create function public.delete_staff_member(
  p_staff_id uuid,
  p_reason   text default null
)
returns public.staff_deletion_result
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_staff  public.staff;
  v_inv    record;
  v_actor  uuid := internal.current_staff_id();
  v_count  integer := 0;
  v_result public.staff_deletion_result;
begin
  -- The actor is read from the session, never accepted as a parameter. An
  -- audit log whose actor column is caller-supplied proves nothing.
  perform internal.require_management();

  perform internal.staff_quorum_lock();

  select * into v_staff
    from public.staff
   where id = p_staff_id
   for update;

  if not found then
    raise exception 'No staff member %', p_staff_id using errcode = 'P0002';
  end if;

  -- ── Guard order is deliberate: quorum BEFORE self ──────────────────────────
  -- internal.require_management() guarantees the caller is itself an active
  -- management row, so whenever the target is somebody else the caller is a
  -- second active manager and the target cannot be the last one. In a single
  -- session the ONLY way to reach the quorum guard is a last remaining manager
  -- removing themselves — and that is the case an operator will actually hit.
  -- Checking self first would answer them with "you cannot delete your own
  -- account", which is true but hides the reason it matters and suggests the
  -- remedy "ask a colleague" when there is no colleague left to ask.
  --
  -- The guard is NOT merely decorative for the other-target case either. Two
  -- managers deleting each other concurrently both pass a naive check under
  -- READ COMMITTED and both commit, leaving zero. internal.staff_quorum_lock()
  -- above serialises them so the second one re-reads the committed state and
  -- lands here. That path needs two sessions and is out of reach of pgTAP.
  --
  if v_staff.role = 'management' and v_staff.is_active and not exists (
    select 1 from public.staff s
     where s.role = 'management' and s.is_active and s.id <> p_staff_id
  ) then
    raise exception 'The last active management account cannot be deleted'
      using errcode = 'WP002';
  end if;

  -- Distinct SQLSTATE, not the 42501 that require_management() already raises,
  -- because the console has to tell "you are not allowed to do this" apart from
  -- "you are not allowed to do this TO YOURSELF" — the second has an obvious
  -- remedy, ask a colleague, and the first does not.
  if p_staff_id = v_actor then
    raise exception 'You cannot delete your own account'
      using errcode = 'WP001';
  end if;

  -- Open invitations are REVOKED, not deleted, and the choice matters twice.
  --
  -- Security: public.invite_staff_member() only refuses an address that is an
  -- ACTIVE staff member, so a deactivated colleague can be re-invited. Delete
  -- their staff row while that invitation is still open and the next magic link
  -- walks them straight back in through public.claim_staff_invitation(), which
  -- would create a fresh staff row with the invited role. Leaving a live
  -- invitation behind would make this function a way to RESET an account rather
  -- than remove one.
  --
  -- History: revoking sets revoked_at, which releases the
  -- staff_invitations_pending_email_idx slot so the address can be invited
  -- again later — a delete would do that too, but it would also destroy the
  for v_inv in
    select id, email
      from public.staff_invitations
     where email = v_staff.email
       and accepted_at is null
       and revoked_at is null
     for update
  loop
    update public.staff_invitations
       set revoked_at = now(),
           revoked_by = v_actor
     where id = v_inv.id;

    -- Its own audit entry under the EXISTING action name, so a query for
    perform internal.write_audit(
      'revoke_staff_invitation', 'public.staff_invitations', v_inv.id::text,
      jsonb_build_object('email', v_inv.email, 'revoked_at', null),
      jsonb_build_object('email', v_inv.email, 'revoked_at', now()),
      'Cascaded from delete_staff_member'
    );

    v_count := v_count + 1;
  end loop;

  -- staff_permissions rows go with them via ON DELETE CASCADE. Every other
  -- reference is now ON DELETE SET NULL, per section 1 above.
  delete from public.staff where id = p_staff_id;

  -- old_value carries the person's EMAIL AND NAME, and that is correct here —
  -- it is the opposite of the rule public.erase_waitlist_entry() follows, so
  perform internal.write_audit(
    'delete_staff_member', 'public.staff', p_staff_id::text,
    jsonb_build_object(
      'email',                    v_staff.email,
      'full_name',                v_staff.full_name,
      'role',                     v_staff.role,
      'is_active',                v_staff.is_active,
      'created_at',               v_staff.created_at,
      'open_invitations_revoked', v_count
    ),
    null,
    p_reason
  );

  v_result.staff_id            := p_staff_id;
  v_result.email               := v_staff.email;
  v_result.full_name           := v_staff.full_name;
  v_result.role                := v_staff.role;
  v_result.was_active          := v_staff.is_active;
  v_result.invitations_revoked := v_count;
  v_result.deleted_at          := now();

  return v_result;
end
$$;

comment on function public.delete_staff_member(uuid, text) is
  'Permanently removes a staff member [CLIENT request, 30 August 2026]. One '
  'transaction, a typed row, its own audit entry (INV-13, R-14). '
  'REFUSES the caller themselves (WP001) and the last active management '
  'account (WP002, [OUR CHOICE]). Reception gets 42501 from '
  'internal.require_management() before anything is read. '
  'Returns the email so the Server Action can delete the matching Supabase '
  'Auth user, which this function cannot reach — public.staff and auth.users '
  'share an id but no foreign key, so removing the staff row alone leaves a '
  'sign-in that resolves to no role rather than to nothing. '
  'SECURITY DEFINER because public.staff grants authenticated only SELECT and '
  'carries no DELETE policy at all; require_management() is the authorisation.';



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

  -- Only taken on the deactivating path. Reactivation cannot reduce the quorum
  -- and must not queue behind an unrelated deletion.
  if not p_is_active then
    perform internal.staff_quorum_lock();
  end if;

  select is_active into v_was
    from public.staff where id = p_staff_id for update;

  if not found then
    raise exception 'No staff member %', p_staff_id using errcode = 'P0002';
  end if;

  if not p_is_active and exists (
    select 1 from public.staff s
     where s.id = p_staff_id and s.role = 'management' and s.is_active
  ) and not exists (
    select 1 from public.staff s
     where s.role = 'management' and s.is_active and s.id <> p_staff_id
  ) then
    raise exception 'The last active management account cannot be deactivated'
      using errcode = 'WP002';
  end if;

  if p_staff_id = internal.current_staff_id() then
    raise exception 'You cannot change your own access'
      using errcode = '42501';
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



revoke all on function public.delete_staff_member(uuid, text) from public;

grant execute on function public.delete_staff_member(uuid, text) to authenticated;
