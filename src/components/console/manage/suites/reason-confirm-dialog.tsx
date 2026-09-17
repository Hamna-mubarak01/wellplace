"use client";

import { useState, useTransition, type ReactNode } from "react";

import type { SuiteActionResult } from "@/app/(console)/manage/suites/actions";
import { ActionError } from "@/components/shared/action-error";
import { ReasonField } from "@/components/shared/reason-field";
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
import { toast } from "@/lib/console/feedback";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { reasonSchema } from "@/lib/validation/audit-reason";

const FOOTER_BUTTON = "wellplace-button h-tap rounded-(--radius-button) px-4";

export interface ReasonConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  reasonId: string;
  reasonLabel?: string;
  confirmLabel: string;
  pendingLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  blocker?: ReactNode;
  successMessage: string;
  onConfirm: (reason: string) => Promise<SuiteActionResult>;
  onDone: () => void;
}

export function ReasonConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  reasonId,
  reasonLabel = "Reason",
  confirmLabel,
  pendingLabel,
  cancelLabel = "Cancel",
  destructive = false,
  blocker,
  successMessage,
  onConfirm,
  onDone,
}: ReasonConfirmDialogProps) {
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [failure, setFailure] = useState<string>();

  function change(next: boolean) {
    if (pending) return;
    if (!next) {
      setReason("");
      setReasonError(undefined);
      setFailure(undefined);
    }
    onOpenChange(next);
  }

  function submit() {
    const parsed = reasonSchema.safeParse(reason);
    if (!parsed.success) {
      setReasonError(parsed.error.issues[0].message);
      return;
    }
    setReasonError(undefined);
    setFailure(undefined);

    start(async () => {
      let result: SuiteActionResult;
      try {
        result = await onConfirm(parsed.data);
      } catch (cause) {
        console.error("[manage] suite action threw:", cause);
        result = { ok: false, message: NETWORK_MESSAGE };
      }

      if (!result.ok) {
        setFailure(result.message);
        return;
      }

      toast.success(successMessage);
      setReason("");
      onOpenChange(false);
      onDone();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={change}>
      <AlertDialogContent className="max-h-dialog-max-h overflow-y-auto sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-console-title">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-console-body text-text-secondary">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {blocker}

        {!blocker && (
          <ReasonField
            id={reasonId}
            label={reasonLabel}
            value={reason}
            onChange={(next) => {
              setReason(next);
              if (reasonError) setReasonError(undefined);
            }}
            error={reasonError}
            disabled={pending}
          />
        )}

        {failure && <ActionError message={failure} />}

        <AlertDialogFooter>
          <AlertDialogCancel className={FOOTER_BUTTON} disabled={pending}>
            {cancelLabel}
          </AlertDialogCancel>
          {!blocker && (
            <AlertDialogAction
              variant={destructive ? "destructive" : "default"}
              data-hover={destructive ? "simple" : undefined}
              className={FOOTER_BUTTON}
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              {pending ? pendingLabel : confirmLabel}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
