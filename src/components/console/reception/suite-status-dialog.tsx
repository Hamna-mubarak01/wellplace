"use client";

import { useReceptionValidation } from "@/components/console/reception/reception-validation";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlertIcon } from "lucide-react";
import { toast } from "@/lib/console/feedback";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";

import { setSuiteStatus, type BookingActionResult } from "@/app/(console)/reception/actions";
import type {
  BoardSuite,
  SuiteStatus,
} from "@/components/console/reception/board-types";
import {
  NEVER_AUTO_ALLOCATED,
  SUITE_STATUSES,
  suiteStatusLabel,
} from "@/components/console/reception/suite-status-badge";
import { ReasonField } from "@/components/console/reception/reception-reason-field";
import { suiteStatusChangeSchema } from "@/lib/validation/suite-status";
import { Button } from "@/components/shared/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/console/reception/reception-dialog";
import { SuiteDialogContent } from "@/components/console/suite-dialog-content";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/select";

export interface SuiteStatusDialogProps {
  suite: BoardSuite;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (input: { suiteId: string; status: SuiteStatus; reason?: string }) => Promise<BookingActionResult>;
}

export function SuiteStatusDialog({
  suite,
  open,
  onOpenChange,
  onSave = setSuiteStatus,
}: SuiteStatusDialogProps) {
  const router = useRouter();
  const { reject } = useReceptionValidation();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<SuiteStatus>(suite.status);
  const [reason, setReason] = useState("");

  const close = () => {
    onOpenChange(false);
    setStatus(suite.status);
    setReason("");
  };

  const leavesAllocation = NEVER_AUTO_ALLOCATED.includes(status);
  const unchanged = status === suite.status;

  const confirm = () => {
    const parsed = suiteStatusChangeSchema.safeParse({ suiteId: suite.id, status, reason: reason.trim() || undefined });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (issue.path[0] === "reason") reject(`suite-status-reason-${suite.id}`, issue.message);
      else toast.error(issue.message);
      return;
    }
    start(async () => {
      try {
      const result = await onSave(parsed.data);

      if (result.ok) {
        toast.success(
          `Suite ${suite.suiteNumber} is now ${suiteStatusLabel(status).toLowerCase()}`,
        );
        close();
        router.refresh();
        return;
      }

      toast.error("The status was not changed", { description: result.message });
      } catch { toast.error(NETWORK_MESSAGE); }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!pending) { if (next) onOpenChange(true); else close(); } }}>
      <SuiteDialogContent data-reception-dialog="" closeDisabled={pending} onInteractOutside={(event) => { if (pending || (event.target instanceof Element && event.target.closest("[data-sonner-toast]"))) event.preventDefault(); }}>
        <DialogHeader className="shrink-0 border-b border-border p-5 sm:p-6">
          <DialogTitle className="text-console-title">Suite {suite.suiteNumber} status</DialogTitle>
          <DialogDescription>
            Current status: {suiteStatusLabel(suite.status).toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain p-5 sm:p-6">
        {suite.internalNote && (
          <p className="whitespace-pre-wrap wrap-anywhere rounded-(--radius-card) border border-border bg-surface-sunken px-4 py-3 text-console-body text-text-secondary">
            {suite.internalNote}
          </p>
        )}

        <Field>
          <FieldLabel htmlFor="suite-status">New status</FieldLabel>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as SuiteStatus)}
            disabled={pending}
          >
            <SelectTrigger id="suite-status" className="h-control! w-full text-console-body">
              <SelectValue />
            </SelectTrigger>
            <SelectContent avoidCollisions={false} className="suite-popup max-h-(--radix-select-content-available-height)">
              {SUITE_STATUSES.map((value) => (
                <SelectItem key={value} value={value} className="min-h-tap">
                  <span>{suiteStatusLabel(value)}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {leavesAllocation && (
          <Alert className="border-warning-border bg-warning-wash text-warning-ink">
            <TriangleAlertIcon aria-hidden="true" />
            <AlertTitle>Suite {suite.suiteNumber} leaves automatic allocation</AlertTitle>
            <AlertDescription className="text-warning-ink">
              Existing bookings, holds and buffers stay where they are.
            </AlertDescription>
          </Alert>
        )}

        {leavesAllocation && <ReasonField id={`suite-status-reason-${suite.id}`} value={reason}
          onChange={setReason} disabled={pending} label="Reason for holding this suite (required)" />}
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 border-t border-border bg-surface-raised p-4 sm:p-5">
          <Button hoverEffect="sweep" type="button" variant="ghost" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={confirm}
            disabled={pending || unchanged}
          >
            {pending ? "Saving…" : "Set status"}
          </Button>
        </DialogFooter>
      </SuiteDialogContent>
    </Dialog>
  );
}
