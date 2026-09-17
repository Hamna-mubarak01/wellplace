


alter table public.staff_invitations
  alter column expires_at set default now() + interval '24 hours';

comment on column public.staff_invitations.expires_at is
  'When claim_staff_invitation() stops accepting this invitation. 24 hours '
  '[CLIENT, 30 August 2026], deliberately the SAME window as the emailed '
  'GoTrue recovery link (mailer_otp_exp = 86400). These two were 7 days and 1 '
  'hour respectively and the mismatch made the console show week-long '
  'invitations whose link died the first evening. If either moves, move both.';





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
    expires_at = now() + interval '24 hours'
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



create or replace function public.resend_staff_invitation(
  p_invitation_id uuid,
  p_reason        text default null
)
returns public.staff_invitation_resend_result
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_inv        public.staff_invitations;
  v_was_expired boolean;
  v_old_expires timestamptz;
  v_old_count  integer;
  v_result     public.staff_invitation_resend_result;
begin
  -- The actor is read from the session by internal.write_audit(), never
  -- accepted as a parameter. An audit log whose actor column is caller-supplied
  -- proves nothing.
  perform internal.require_management();

  -- Row lock, not the management quorum lock: a resend cannot reduce the number
  -- of active management accounts, so internal.staff_quorum_lock() would be a
  -- serialisation point bought for nothing. FOR UPDATE is doing real work here
  -- though — public.claim_staff_invitation() takes the same lock on this row,
  -- so a person clicking their old link at the moment a manager resends is
  -- serialised rather than racing. Whichever commits first wins: if the claim
  -- does, this re-reads a row with accepted_at set and refuses with WP003
  -- instead of extending an invitation that has already been used. Two
  -- concurrent resends serialise the same way and the counter increments twice
  -- rather than losing one.
  select * into v_inv
    from public.staff_invitations
   where id = p_invitation_id
   for update;

  if not found then
    raise exception 'No invitation %', p_invitation_id using errcode = 'P0002';
  end if;

  -- ── Two refusals, two SQLSTATEs, because the remedies are different ────────
  -- WP003 / WP004 are the next free numbers in the WP0xx family established by
  -- 20260830120000_add_staff_deletion.sql, which took WP001 (self-delete) and
  -- WP002 (last active management account). They are distinct from the 42501
  -- that internal.require_management() raises for "you are not Management at
  -- all", and distinct from each other so the console can name the fix.
  --
  -- WP003 — already accepted. This is not a resend at all: the person HAS an
  -- account, and what they have lost is their password, not their invitation.
  -- Reissuing an invitation link would not help them and would tell the
  -- operator the wrong story about why sign-in is failing. The remedy is a
  -- password reset, and the operator has to be able to be told that.
  if v_inv.accepted_at is not null then
    raise exception 'That invitation has already been accepted'
      using errcode = 'WP003';
  end if;

  -- WP004 — revoked. Somebody deliberately withdrew this person's access, or
  -- public.delete_staff_member() withdrew it as part of removing them. Silently
  -- reopening it would make a resend a way to UNDO a revocation without the
  -- revocation ever being reconsidered. The remedy is an explicit new
  -- invitation through public.invite_staff_member(), which is a decision with
  -- its own audit entry and its own inviter.
  if v_inv.revoked_at is not null then
    raise exception 'That invitation has been revoked'
      using errcode = 'WP004';
  end if;

  -- ── An expired invitation is rescued, not refused ─────────────────────────
  -- Expiry is the ONLY state a resend exists to fix, so refusing it would leave
  -- the feature answering the one question it was asked. The window is reset to
  -- a full 24 hours rather than left where it was, and that is not generosity:
  -- public.claim_staff_invitation() only claims a row with expires_at > now(),
  -- so resending against the original deadline would mail a link that is dead
  -- on arrival, or alive for the eleven minutes that happen to remain. A
  -- manager clicking resend has just re-confirmed, now, that they want this
  -- person to have access — the 24 hours runs from that decision, exactly as it
  -- does from the original invite_staff_member().
  --
  -- 24 hours, not the seven days this function shipped with this morning
  v_was_expired := v_inv.expires_at <= now();
  v_old_expires := v_inv.expires_at;
  v_old_count   := v_inv.resend_count;

  update public.staff_invitations
     set expires_at     = now() + interval '24 hours',
         resend_count   = resend_count + 1,
         last_resent_at = now()
   where id = p_invitation_id
   returning * into v_inv;

  perform internal.write_audit(
    'resend_staff_invitation', 'public.staff_invitations', p_invitation_id::text,
    jsonb_build_object(
      'email',        v_inv.email,
      'expires_at',   v_old_expires,
      'resend_count', v_old_count,
      'was_expired',  v_was_expired
    ),
    jsonb_build_object(
      'email',          v_inv.email,
      'expires_at',     v_inv.expires_at,
      'resend_count',   v_inv.resend_count,
      'last_resent_at', v_inv.last_resent_at
    ),
    p_reason
  );

  v_result.invitation_id  := v_inv.id;
  v_result.email          := v_inv.email;
  v_result.full_name      := v_inv.full_name;
  v_result.role           := v_inv.role;
  v_result.expires_at     := v_inv.expires_at;
  v_result.resend_count   := v_inv.resend_count;
  v_result.last_resent_at := v_inv.last_resent_at;
  v_result.was_expired    := v_was_expired;

  return v_result;
end
$$;



comment on function public.resend_staff_invitation(uuid, text) is
  'Reissues an open staff invitation [CLIENT request, 30 August 2026]. One '
  'transaction, a typed row, its own audit entry (INV-13, R-14). Resets '
  'expires_at to a fresh 24 hours and increments resend_count; invited_at and '
  'invited_by are untouched, so one row keeps the whole history rather than '
  'revoke-and-reinvite splitting it across two. '
  'REFUSES an accepted invitation (WP003 — that person needs a password reset, '
  'not an invitation) and a revoked one (WP004 — reopening it would undo a '
  'revocation without anyone deciding to). An EXPIRED invitation is resent: '
  'that is the case the feature exists for. '
  'Does NOT refuse an address that has since become a staff member by another '
  'route; claim_staff_invitation() returns an existing active member their own '
  'role and never applies the invitation''s, so the link merely signs them in. '
  'Sends nothing — the emailed recovery link is the Server Action''s job and '
  'has its own GoTrue lifetime, raised to 24 hours on 30 August 2026 so that '
  'the link and this row expire together. '
  'SECURITY DEFINER because public.staff_invitations grants authenticated only '
  'SELECT and carries no UPDATE policy at all; require_management() is the '
  'authorisation.';

comment on type public.staff_invitation_resend_result is
  'Return of public.resend_staff_invitation(). Carries email, full_name and '
  'role because the caller has to address and word the mail, and reading them '
  'back out of the table afterwards would mail whatever the row says THEN '
  'rather than what this transaction authorised. was_expired lets the console '
  'say "that invitation had lapsed and now has a fresh 24 hours" instead of '
  'reporting a plain success for two materially different situations.';

comment on function public.invite_staff_member(text, text, public.staff_role) is
  'Invites a colleague, or re-issues the open invitation for an address that '
  'already has one (ON CONFLICT over staff_invitations_pending_email_idx). '
  'One transaction, its own audit entry (INV-13, R-14). The window is 24 hours '
  '[CLIENT, 30 August 2026] and reaches a new row through the column DEFAULT, '
  'not through this body — the literal here covers only the re-issue path. '
  'SECURITY DEFINER; internal.require_management() is the authorisation.';



grant execute on function public.invite_staff_member(text, text, public.staff_role) to authenticated;
grant execute on function public.resend_staff_invitation(uuid, text) to authenticated;
