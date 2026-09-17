"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlertIcon } from "lucide-react";

import { changeSuiteStatus } from "@/app/(console)/manage/suites/actions";
import {
  LIVE_STATE_LABEL,
  STAFF_STATUSES,
  STAFF_STATUS_HINT,
  canSaveStatus,
  holdsSuite,
  initialStatusChoice,
  type LiveState,
  type SuiteStatus,
} from "@/app/(console)/manage/suites/suites-view";
import { LIVE_STATE_TONE } from "@/components/console/manage/suites/suite-tones";
import { SuiteDialogContent } from "@/components/console/suite-dialog-content";
import { StatusChip } from "@/components/console/shared/status-chip";
import { ActionError } from "@/components/shared/action-error";
import { Button } from "@/components/shared/button";
import { ReasonField } from "@/components/shared/reason-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/lib/console/feedback";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { suiteStatusChangeSchema } from "@/lib/validation/suite-status";

const OPTION =
  "flex min-h-tap cursor-pointer items-start gap-3 rounded-(--radius-card) border border-border bg-surface-raised p-3 font-normal transition-colors duration-150 hover:bg-surface-hover has-data-checked:border-brand has-data-checked:bg-surface-active motion-reduce:transition-none";

export interface ManageSuiteStatusDialogProps {
  suite: { id: string; suiteNumber: number; status: SuiteStatus };
  live: LiveState;
  onOpenChange: (open: boolean) => void;
}

export function ManageSuiteStatusDialog({ suite, live, onOpenChange }: ManageSuiteStatusDialogProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState<SuiteStatus | null>(() => initialStatusChoice(suite.status));
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [failure, setFailure] = useState<string>();

  const reasonId = `manage-suite-status-reason-${suite.id}`;
  const holding = choice !== null && holdsSuite(choice);

  function save() {
    if (choice === null) return;
    const parsed = suiteStatusChangeSchema.safeParse({
      suiteId: suite.id,
      status: choice,
      reason: holding ? reason : undefined,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (issue.path[0] === "reason") setReasonError(issue.message);
      else setFailure(issue.message);
      return;
    }
    setReasonError(undefined);
    setFailure(undefined);

    start(async () => {
      try {
        const result = await changeSuiteStatus(parsed.data);
        if (!result.ok) {
          setFailure(result.message);
          return;
        }
        toast.success(`Suite ${suite.suiteNumber} is now ${LIVE_STATE_LABEL[choice].toLowerCase()}`);
        onOpenChange(false);
        router.refresh();
      } catch (cause) {
        console.error("[manage] changeSuiteStatus threw:", cause);
        setFailure(NETWORK_MESSAGE);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!pending) onOpenChange(next); }}>
      <SuiteDialogContent closeDisabled={pending}>
        <DialogHeader className="shrink-0 border-b border-border p-5 pr-12 sm:p-6 sm:pr-12">
          <DialogTitle className="text-console-title">Change suite {suite.suiteNumber} status</DialogTitle>
          <DialogDescription>To close the suite for a set time, use Block instead.</DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain p-5 sm:p-6">
            <dl className="grid grid-cols-2 gap-4 rounded-(--radius-card) border border-border bg-surface-raised p-3">
              <div className="flex min-w-0 flex-col items-start gap-1">
                <dt className="text-console-label tracking-label text-text-muted uppercase">Right now</dt>
                <dd>
                  <StatusChip tone={LIVE_STATE_TONE[live]}>{LIVE_STATE_LABEL[live]}</StatusChip>
                </dd>
              </div>
              <div className="flex min-w-0 flex-col items-start gap-1">
                <dt className="text-console-label tracking-label text-text-muted uppercase">Staff status</dt>
                <dd>
                  <StatusChip tone={LIVE_STATE_TONE[suite.status]}>{LIVE_STATE_LABEL[suite.status]}</StatusChip>
                </dd>
              </div>
            </dl>

            <fieldset className="flex min-w-0 flex-col gap-2">
              <legend className="mb-2 text-field-label font-medium text-text-secondary">New status</legend>
              <RadioGroup
                value={choice ?? ""}
                onValueChange={(value) => {
                  setChoice(STAFF_STATUSES.find((status) => status === value) ?? null);
                  setFailure(undefined);
                }}
                disabled={pending}
                aria-label="New status"
                className="grid grid-cols-1 gap-2"
              >
                {STAFF_STATUSES.map((status) => {
                  const id = `manage-suite-status-${suite.id}-${status}`;
                  return (
                    <Label key={status} htmlFor={id} className={OPTION}>
                      <RadioGroupItem value={status} id={id} className="mt-0.5" />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex flex-wrap items-center gap-2 text-console-body font-medium text-text-primary">
                          {LIVE_STATE_LABEL[status]}
                          {status === suite.status && (
                            <span className="text-micro font-normal text-text-muted">Current</span>
                          )}
                        </span>
                        <span className="text-micro text-pretty text-text-secondary">{STAFF_STATUS_HINT[status]}</span>
                      </span>
                    </Label>
                  );
                })}
              </RadioGroup>
            </fieldset>

            {holding && (
              <Alert className="border-warning-border bg-warning-wash text-warning-ink">
                <TriangleAlertIcon aria-hidden="true" />
                <AlertDescription className="text-console-body text-warning-ink">
                  Suite {suite.suiteNumber} stops being offered for new bookings. Existing bookings stay where they are.
                </AlertDescription>
              </Alert>
            )}

            {holding && (
              <ReasonField
                id={reasonId}
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
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 border-t border-border bg-surface-raised p-4 sm:p-5">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !canSaveStatus(choice, suite.status)}>
              {pending ? "Saving…" : "Save status"}
            </Button>
          </DialogFooter>
        </form>
      </SuiteDialogContent>
    </Dialog>
  );
}
