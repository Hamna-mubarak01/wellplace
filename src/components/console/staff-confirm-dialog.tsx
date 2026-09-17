"use client";

import { TriangleAlertIcon } from "lucide-react";

import type { StaffRow } from "@/lib/db/queries/staff";
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

export type StaffConfirmKind = "deactivate" | "delete";

export interface StaffConfirmTarget {
  member: StaffRow;
  kind: StaffConfirmKind;
}

export interface StaffConfirmDialogProps {
  target: StaffConfirmTarget | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (target: StaffConfirmTarget) => void;
}

export function StaffConfirmDialog({
  target,
  onOpenChange,
  onConfirm,
}: StaffConfirmDialogProps) {
  const deleting = target?.kind === "delete";
  const name = target?.member.fullName ?? "";

  return (
    <AlertDialog open={target !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <span
            aria-hidden="true"
            className="mb-1 grid size-10 place-items-center rounded-full bg-danger-wash text-danger-ink"
          >
            <TriangleAlertIcon className="size-5" />
          </span>

          <AlertDialogTitle>
            {deleting ? `Delete ${name} permanently?` : `Deactivate ${name}?`}
          </AlertDialogTitle>

          <AlertDialogDescription>
            {deleting
              ? "Their account and sign-in go for good. This cannot be undone."
              : "They are signed out straight away and cannot sign in until reactivated."}
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
              if (target) onConfirm(target);
            }}
          >
            {deleting ? "Delete" : "Deactivate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
