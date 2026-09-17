"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ConciergeBellIcon,
  EllipsisVerticalIcon,
  SearchXIcon,
  ShieldIcon,
  Trash2Icon,
  UserRoundCheckIcon,
  UserRoundXIcon,
  UsersRoundIcon,
} from "lucide-react";

import { runAction } from "@/lib/console/run-action";
import { dubaiStamp } from "@/components/console/lead-format";
import type { NamedPermission, StaffRole, StaffRow } from "@/lib/db/queries/staff";
import {
  changeMemberAccess,
  changeMemberRole,
  deleteMember,
} from "@/app/(console)/manage/staff/actions";
import { STAFF_PATH } from "@/app/(console)/manage/staff/staff-view";
import {
  StaffConfirmDialog,
  type StaffConfirmTarget,
} from "@/components/console/staff-confirm-dialog";
import {
  ConsoleDataTable,
  type ConsoleColumn,
} from "@/components/console/shared/console-data-table";
import { StatusChip } from "@/components/console/shared/status-chip";
import { ROLE_PERMISSIONS, permissionLabel } from "@/lib/config/permissions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/shared/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface StaffTableProps {
  members: StaffRow[];
  currentUserId: string;
  filtered: boolean;
}

const ROLE_LABEL: Readonly<Record<StaffRole, string>> = {
  management: "Management",
  reception: "Reception",
};

const ROLE_ICON = {
  management: ShieldIcon,
  reception: ConciergeBellIcon,
} as const;

export function StaffTable({
  members,
  currentUserId,
  filtered,
}: StaffTableProps) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState<StaffConfirmTarget | null>(null);
  const orderedMembers = [...members].sort(
    (first, second) =>
      Number(second.id === currentUserId) - Number(first.id === currentUserId),
  );

  function act(
    run: () => Promise<{ ok: boolean; message?: string }>,
    success: string,
  ) {
    start(async () => {
      await runAction(run, success);
    });
  }

  function runConfirmed({ member, kind }: StaffConfirmTarget) {
    setConfirming(null);

    if (kind === "delete") {
      act(() => deleteMember({ staffId: member.id }), "Deleted");
      return;
    }

    act(
      () => changeMemberAccess({ staffId: member.id, isActive: false }),
      "Deactivated",
    );
  }

  const heldBy = (member: StaffRow): readonly NamedPermission[] => ROLE_PERMISSIONS[member.role];

  const columns: readonly ConsoleColumn<StaffRow>[] = [
    {
      id: "name",
      header: "Name",
      wrap: true,
      cell: (member) => {
        const added = dubaiStamp(member.createdAt);
        const held = heldBy(member);
        return (
          <div className="flex min-w-48 items-center gap-3">
            <Avatar aria-hidden="true" className="size-9">
              <AvatarFallback
                className={cn(
                  "font-data text-micro font-medium",
                  member.isActive
                    ? "bg-brand text-on-brand"
                    : "bg-surface-sunken text-text-muted ring-1 ring-inset ring-border-interactive",
                )}
              >
                {initials(member.fullName)}
              </AvatarFallback>
            </Avatar>

            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={cn(
                    "font-medium break-words",
                    member.isActive ? "text-text-primary" : "text-text-muted",
                  )}
                >
                  {member.fullName}
                </span>
                {member.id === currentUserId && (
                  <StatusChip tone="neutral">You · read only</StatusChip>
                )}
              </span>
              <span className="font-data text-micro break-all text-text-secondary">
                {member.email}
              </span>

              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-micro text-text-secondary md:hidden">
                <span>{member.isActive ? "Active" : "Deactivated"}</span>
                <span aria-hidden="true">·</span>
                <span>{ROLE_LABEL[member.role]}</span>
                <span aria-hidden="true">·</span>
                <span className="font-data tabular-nums">{added.date}</span>
                <span aria-hidden="true" className="lg:hidden">
                  ·
                </span>
                <span className="lg:hidden">
                  {held.length === 0
                    ? "No permissions"
                    : `${held.length} ${held.length === 1 ? "permission" : "permissions"}`}
                </span>
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: "role",
      header: "Role",
      className: "hidden md:table-cell",
      cell: (member) => {
        const RoleIcon = ROLE_ICON[member.role];
        return (
          <span className="inline-flex items-center gap-2 text-text-secondary">
            <RoleIcon aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
            {ROLE_LABEL[member.role]}
          </span>
        );
      },
    },
    {
      id: "access",
      header: "Access",
      className: "hidden md:table-cell",
      cell: (member) => (
        <StatusChip tone={member.isActive ? "success" : "neutral"}>
          {member.isActive ? "Active" : "Deactivated"}
        </StatusChip>
      ),
    },
    {
      id: "permissions",
      header: "Permissions",
      wrap: true,
      className: "hidden lg:table-cell",
      cell: (member) => {
        const held = heldBy(member);
        return held.length === 0 ? (
          <span className="text-text-muted">None</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {held.map((permission) => (
              <StatusChip key={permission} tone="neutral">
                {permissionLabel(permission)}
              </StatusChip>
            ))}
          </span>
        );
      },
    },
    {
      id: "added",
      header: "Added",
      className: "hidden xl:table-cell",
      cell: (member) => {
        const added = dubaiStamp(member.createdAt);
        return (
          <>
            <span className="block font-data tabular-nums text-text-secondary">{added.date}</span>
            <span className="block font-data text-micro tabular-nums text-text-muted">
              {added.time}
            </span>
          </>
        );
      },
    },
  ];

  function rowActions(member: StaffRow) {
    if (member.id === currentUserId) return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={pending}
            aria-label={`Actions for ${member.fullName}`}
          >
            <EllipsisVerticalIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem
            className="min-h-tap whitespace-nowrap"
            onSelect={() =>
              act(
                () =>
                  changeMemberRole({
                    staffId: member.id,
                    role: member.role === "management" ? "reception" : "management",
                  }),
                "Role updated",
              )
            }
          >
            <ShieldIcon aria-hidden="true" />
            Make{" "}
            {member.role === "management" ? ROLE_LABEL.reception : ROLE_LABEL.management}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {member.isActive ? (
            <DropdownMenuItem
              variant="destructive"
              className="min-h-tap whitespace-nowrap"
              onSelect={(event) => {
                event.preventDefault();
                setConfirming({ member, kind: "deactivate" });
              }}
            >
              <UserRoundXIcon aria-hidden="true" />
              Deactivate
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="min-h-tap whitespace-nowrap"
              onSelect={() =>
                act(
                  () => changeMemberAccess({ staffId: member.id, isActive: true }),
                  "Reactivated",
                )
              }
            >
              <UserRoundCheckIcon aria-hidden="true" />
              Reactivate
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            className="min-h-tap whitespace-nowrap"
            onSelect={(event) => {
              event.preventDefault();
              setConfirming({ member, kind: "delete" });
            }}
          >
            <Trash2Icon aria-hidden="true" />
            Delete permanently
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <ConsoleDataTable
        label="Everyone with access to the WellPlace console, their role and whether they can currently sign in."
        columns={columns}
        rows={orderedMembers}
        rowKey={(member) => member.id}
        actions={rowActions}
        empty={
          filtered
            ? {
                title: "Nobody matches this search",
                description:
                  "Try a shorter term, or clear the filters to see everyone with console access.",
                Icon: SearchXIcon,
                action: (
                  <Button asChild variant="outline">
                    <Link href={STAFF_PATH}>Show everyone</Link>
                  </Button>
                ),
              }
            : {
                title: "No colleagues yet",
                description:
                  "Invite the people who will run Reception and Management. They choose their own password from the emailed link.",
                Icon: UsersRoundIcon,
              }
        }
      />

      <StaffConfirmDialog
        target={confirming}
        onOpenChange={(open) => !open && setConfirming(null)}
        onConfirm={runConfirmed}
      />
    </>
  );
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}
