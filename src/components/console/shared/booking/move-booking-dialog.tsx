"use client";

import { useState, useTransition } from "react";
import { ArrowDownIcon, TriangleAlertIcon } from "lucide-react";

import { useReceptionValidation } from "@/components/console/reception/reception-validation";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { reasonSchema } from "@/lib/validation/audit-reason";
import { SuiteDialogContent } from "@/components/console/suite-dialog-content";
import { toast } from "@/lib/console/feedback";
import { formatDubaiTime } from "@/lib/domain/time";
import {
  NEVER_AUTO_ALLOCATED,
  suiteStatusLabel,
} from "@/components/console/reception/suite-status-badge";
import { ReasonField } from "@/components/console/reception/reception-reason-field";
import { Button } from "@/components/shared/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/console/reception/reception-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/select";
import type {
  BookingDialogResult,
  MoveBookingPlacement,
  MoveBookingRequest,
  MoveBookingSuite,
} from "@/components/console/shared/booking/booking-dialog-types";

export interface MoveBookingDialogCopy {
  readonly title: string;
  readonly submit: string;
  readonly pending: string;
  readonly success: string;
  readonly failure: string;
  readonly suiteReason: string;
  readonly timeReason: string;
}

export const MOVE_BOOKING_COPY: MoveBookingDialogCopy = {
  title: "Move this booking",
  submit: "Move booking",
  pending: "Moving…",
  success: "Booking moved",
  failure: "Booking could not be moved",
  suiteReason: "Reason",
  timeReason: "Reason",
};

export interface MoveBookingDialogProps {
  bookingId: string | null;
  who: string;
  suites: readonly MoveBookingSuite[];
  current: MoveBookingPlacement & { readonly endsAt: string };
  currentSuiteNumber?: number | null;
  durationMs: number;
  initial: MoveBookingPlacement;
  startOptions?: readonly string[];
  openingWindow?: { readonly start: string; readonly end: string } | null;
  copy?: Partial<MoveBookingDialogCopy>;
  onSubmit: (input: MoveBookingRequest) => Promise<BookingDialogResult>;
  onClose: () => void;
  onMoved?: () => void;
}

function suiteNote(suite: MoveBookingSuite): string | null {
  if (suite.isCurrent) return "Current suite";
  if (suite.isAvailable === false && suite.status === "available") return "Taken at this time";
  return null;
}

export function MoveBookingDialog({
  bookingId,
  who,
  suites,
  current,
  currentSuiteNumber,
  durationMs,
  initial,
  startOptions,
  openingWindow = null,
  copy,
  onSubmit,
  onClose,
  onMoved,
}: MoveBookingDialogProps) {
  const text = { ...MOVE_BOOKING_COPY, ...copy };
  const { reject } = useReceptionValidation();
  const [pending, start] = useTransition();
  const [suiteId, setSuiteId] = useState(initial.suiteId);
  const [startsAt, setStartsAt] = useState(() => new Date(initial.startsAt).toISOString());
  const [reason, setReason] = useState("");

  const movesSuite = suiteId !== current.suiteId;
  const unchanged = !movesSuite && Date.parse(startsAt) === Date.parse(current.startsAt);
  const target = suites.find((suite) => suite.id === suiteId) ?? null;
  const fromSuiteNumber =
    currentSuiteNumber !== undefined
      ? currentSuiteNumber
      : (suites.find((suite) => suite.id === current.suiteId)?.suiteNumber ?? null);
  const proposedEnd = new Date(Date.parse(startsAt) + durationMs).toISOString();
  const takesOutOfAllocation =
    target !== null && NEVER_AUTO_ALLOCATED.includes(target.status);
  const choosesStart = startOptions !== undefined;

  const confirm = () =>
    start(async () => {
      if (bookingId === null) {
        toast.error("This item is not a booking, so it cannot be moved.");
        return;
      }

      const parsed = reasonSchema.safeParse(reason);
      if (!parsed.success) { reject("move-reason", parsed.error.issues[0].message); return; }
      try {
        const result = await onSubmit({
          bookingId,
          suiteId,
          startsAt,
          reason: parsed.data,
        });

        if (result.ok) {
          toast.success(text.success);
          onClose();
          onMoved?.();
          return;
        }

        toast.error(text.failure, { description: result.message });
      } catch { toast.error(NETWORK_MESSAGE); }
    });

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !pending) onClose(); }}>
      <SuiteDialogContent
        data-reception-dialog=""
        className="reception-move-dialog sm:max-w-lg"
        closeDisabled={pending}
        onInteractOutside={(event) => {
          const element = event.detail.originalEvent.target;
          if (element instanceof Element && element.closest("[data-sonner-toast]")) event.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0 border-b border-border bg-surface-raised p-5 pr-16">
          <DialogTitle>{text.title}</DialogTitle>
          <DialogDescription>{who}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5">
        <div className={choosesStart ? "grid gap-3 sm:grid-cols-2" : "grid gap-3"}>
          <Field>
            <FieldLabel htmlFor="move-suite">Suite</FieldLabel>
            <Select
              value={suiteId}
              onValueChange={setSuiteId}
              disabled={pending || suites.length === 0}
            >
              <SelectTrigger id="move-suite" className="h-tap! text-console-body">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {suites.map((suite) => {
                  const note = suiteNote(suite);
                  return (
                    <SelectItem key={suite.id} value={suite.id}>
                      <span className="font-data tabular-nums">
                        Suite {suite.suiteNumber}
                      </span>
                      {suite.status !== "available" && (
                        <span className="text-text-muted">
                          {suiteStatusLabel(suite.status)}
                        </span>
                      )}
                      {note !== null && <span className="text-text-muted">{note}</span>}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </Field>

          {choosesStart && (
            <Field>
              <FieldLabel htmlFor="move-start">Start</FieldLabel>
              <Select
                value={startsAt}
                onValueChange={setStartsAt}
                disabled={pending || startOptions.length === 0}
              >
                <SelectTrigger id="move-start" className="h-tap! text-console-body">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {startOptions.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      <span className="font-data tabular-nums">
                        {formatDubaiTime(slot)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {openingWindow !== null && (
                <p className="text-micro text-text-secondary">
                  Open {formatDubaiTime(openingWindow.start)}&ndash;{formatDubaiTime(openingWindow.end)}. A visit must finish inside the opening hours.
                </p>
              )}
            </Field>
          )}
        </div>

        <div className="rounded-(--radius-card) border border-border bg-surface-sunken px-4 py-3">
          <p className="font-data text-console-table tabular-nums text-text-secondary">
            {fromSuiteNumber === null ? "This suite" : `Suite ${fromSuiteNumber}`} ·{" "}
            {formatDubaiTime(current.startsAt)}–
            {formatDubaiTime(current.endsAt)}
          </p>
          <ArrowDownIcon
            aria-hidden="true"
            className="my-1 size-4 text-text-muted"
          />
          <p className="font-data text-console-table font-medium tabular-nums text-text-primary">
            {target === null ? "This suite" : `Suite ${target.suiteNumber}`} ·{" "}
            {formatDubaiTime(startsAt)}–
            {formatDubaiTime(proposedEnd)}
          </p>
          {unchanged && (
            <p className="mt-2 text-micro text-text-muted">
              {choosesStart ? "Choose a different suite or start time." : "Choose a different suite."}
            </p>
          )}
        </div>

        {takesOutOfAllocation && target !== null && (
          <Alert className="border-warning-border bg-warning-wash text-warning-ink">
            <TriangleAlertIcon aria-hidden="true" />
            <AlertTitle>
              Suite {target.suiteNumber} is {suiteStatusLabel(target.status).toLowerCase()}
            </AlertTitle>
            <AlertDescription className="text-warning-ink">
              This suite requires permission to override its status.
            </AlertDescription>
          </Alert>
        )}

        <ReasonField
          id="move-reason"
          value={reason}
          onChange={setReason}
          disabled={pending}
          label={movesSuite ? text.suiteReason : text.timeReason}
        />

        </div>
        <DialogFooter className="m-0! grid shrink-0 grid-cols-2 gap-2 border-t border-border bg-surface-raised p-4 [&>.wellplace-button]:h-auto [&>.wellplace-button]:min-h-tap [&>.wellplace-button]:whitespace-normal [&>.wellplace-button]:px-2">
          <Button
            hoverEffect="sweep"
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={confirm}
            disabled={pending || unchanged || !reason.trim() || bookingId === null}
          >
            {pending ? text.pending : text.submit}
          </Button>
        </DialogFooter>
      </SuiteDialogContent>
    </Dialog>
  );
}
