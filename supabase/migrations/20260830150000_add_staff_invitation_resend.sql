


alter table public.staff_invitations
  add column resend_count   integer not null default 0,
  add column last_resent_at timestamptz;

comment on column public.staff_invitations.resend_count is
  'How many times this invitation has been re-mailed by '
  'public.resend_staff_invitation(). Never reset — a re-invite over the same '
  'open row keeps the running total, because the question it answers is abuse '
  'review, not "when was the current invitation issued" (invited_at).';

comment on column public.staff_invitations.last_resent_at is
  'NULL means never resent, never "resent when it was created".';



create type public.staff_invitation_resend_result as (
  invitation_id  uuid,
  email          text,
  full_name      text,
  role           public.staff_role,
  expires_at     timestamptz,
  resend_count   integer,
  last_resent_at timestamptz,
  was_expired    boolean
);

comment on type public.staff_invitation_resend_result is
  'Return of public.resend_staff_invitation(). Carries email, full_name and '
  'role because the caller has to address and word the mail, and reading them '
  'back out of the table afterwards would mail whatever the row says THEN '
  'rather than what this transaction authorised. was_expired lets the console '
  'say "that invitation had lapsed and now has a fresh seven days" instead of '
  'reporting a plain success for two materially different situations.';



create function public.resend_staff_invitation(
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
  -- a full seven days rather than left where it was, and that is not
  -- generosity: public.claim_staff_invitation() only claims a row with
  -- expires_at > now(), so resending against the original deadline would mail a
  -- link that is dead on arrival, or alive for the eleven minutes that happen
  -- to remain. A manager clicking resend has just re-confirmed, now, that they
  -- want this person to have access — the seven days runs from that decision,
  -- exactly as it does from the original invite_staff_member(). The alternative
  -- an operator would otherwise be pushed into is revoke-and-reinvite, which
  -- grants the same seven days and destroys the record as well.
  --
  -- invited_at is deliberately NOT moved. It is when this person was first
  -- invited and by whom, which is the history the client asked us to keep.
  v_was_expired := v_inv.expires_at <= now();
  v_old_expires := v_inv.expires_at;
  v_old_count   := v_inv.resend_count;

  update public.staff_invitations
     set expires_at     = now() + interval '7 days',
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
  'transaction, a typed row, its own audit entry (INV-13, R-14). Extends '
  'expires_at by a fresh seven days and increments resend_count; invited_at and '
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
  'has its own one-hour GoTrue lifetime. '
  'SECURITY DEFINER because public.staff_invitations grants authenticated only '
  'SELECT and carries no UPDATE policy at all; require_management() is the '
  'authorisation.';



revoke all on function public.resend_staff_invitation(uuid, text) from public;

grant execute on function public.resend_staff_invitation(uuid, text) to authenticated;
