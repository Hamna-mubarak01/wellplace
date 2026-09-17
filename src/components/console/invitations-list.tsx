"use client";

import { useState, useTransition } from "react";
import {
  ConciergeBellIcon,
  MailCheckIcon,
  SendIcon,
  ShieldIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";

import { runAction } from "@/lib/console/run-action";
import { dubaiStamp } from "@/components/console/lead-format";
import type { InvitationRow } from "@/lib/db/queries/staff";
import {
  resendInvitation,
  revokeInvitation,
} from "@/app/(console)/manage/staff/actions";
import {
  ConsoleDataTable,
  type ConsoleColumn,
} from "@/components/console/shared/console-data-table";
import { DetailSection } from "@/components/console/shared/detail-section";
import { StatusChip } from "@/components/console/shared/status-chip";
import { Button } from "@/components/shared/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface InvitationsListProps {
  invitations: InvitationRow[];
}

const COLUMNS: readonly ConsoleColumn<InvitationRow>[] = [
  {
    id: "name",
    header: "Name",
    wrap: true,
    cell: (invitation) => (
      <span className="flex min-w-40 flex-col gap-0.5">
        <span className="font-medium break-words text-text-primary">{invitation.fullName}</span>
        <span className="font-data text-micro break-all text-text-secondary">{invitation.email}</span>
      </span>
    ),
  },
  {
    id: "role",
    header: "Role",
    className: "hidden md:table-cell",
    cell: (invitation) => {
      const RoleIcon = invitation.role === "management" ? ShieldIcon : ConciergeBellIcon;
      return (
        <span className="inline-flex items-center gap-2 text-text-secondary">
          <RoleIcon aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
          {invitation.role === "management" ? "Management" : "Reception"}
        </span>
      );
    },
  },
  {
    id: "expires",
    header: "Link expires",
    wrap: true,
    cell: (invitation) => {
      const expires = dubaiStamp(invitation.expiresAt);
      return (
        <>
          <span className="block font-data tabular-nums whitespace-nowrap">
            {expires.date} at {expires.time}
          </span>
          {invitation.isExpired && (
            <span className="block text-micro text-text-secondary">Resend to send a fresh link</span>
          )}
        </>
      );
    },
  },
  {
    id: "status",
    header: "Status",
    cell: (invitation) =>
      invitation.isExpired ? (
        <StatusChip tone="danger">Expired</StatusChip>
      ) : (
        <StatusChip tone="info">Invited</StatusChip>
      ),
  },
];

export function InvitationsList({ invitations }: InvitationsListProps) {
  const [pending, start] = useTransition();
  const [revoking, setRevoking] = useState<InvitationRow | null>(null);

  function confirmRevoke(invitation: InvitationRow) {
    setRevoking(null);
    start(async () => {
      await runAction(
        () => revokeInvitation({ invitationId: invitation.id }),
        "Invitation revoked",
      );
    });
  }

  if (invitations.length === 0) return null;

  return (
    <DetailSection
      title="Invited, not yet signed in"
      Icon={MailCheckIcon}
      count={invitations.length}
      id="invitations"
    >
      <ConsoleDataTable
        label="Invitations waiting for the colleague to sign in"
        columns={COLUMNS}
        rows={invitations}
        rowKey={(invitation) => invitation.id}
        actions={(invitation) => (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              aria-label={`Send the invitation to ${invitation.email} again`}
              onClick={() =>
                start(async () => {
                  await runAction(
                    () => resendInvitation({ invitationId: invitation.id }),
                    "Invitation sent again",
                  );
                })
              }
            >
              <SendIcon aria-hidden="true" />
              Resend
            </Button>

            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              aria-label={`Revoke the invitation sent to ${invitation.email}`}
              onClick={() => setRevoking(invitation)}
            >
              <XIcon aria-hidden="true" />
              Revoke
            </Button>
          </>
        )}
        empty={{
          title: "No invitations waiting",
          Icon: MailCheckIcon,
        }}
      />

      <AlertDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <span
              aria-hidden="true"
              className="mb-1 grid size-10 place-items-center rounded-full bg-danger-wash text-danger-ink"
            >
              <TriangleAlertIcon className="size-5" />
            </span>
            <AlertDialogTitle>
              Revoke the invitation to {revoking?.fullName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Their emailed link stops working and they cannot sign in. Invite
              them again if you change your mind.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel className="wellplace-button h-tap rounded-(--radius-button) px-4">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="wellplace-button h-tap rounded-(--radius-button) px-4"
              onClick={() => {
                if (revoking) confirmRevoke(revoking);
              }}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DetailSection>
  );
}
