"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { useReceptionValidation } from "@/components/console/reception/reception-validation";
import { toast } from "@/lib/console/feedback";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { CONSOLE_LIST } from "@/lib/config/console-list";
import { EXTENSION_MINUTES } from "@/lib/config/console-limits";
import { formatDubaiTime } from "@/lib/domain/time";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/console/reception/reception-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/console/reception/reception-input";
import { ReasonField } from "@/components/console/reception/reception-reason-field";
import type {
  BookingDialogResult,
  ExtendBookingRequest,
  ExtensionCheck,
  ExtensionCheckRequest,
} from "@/components/console/shared/booking/booking-dialog-types";

export interface ExtendBookingDialogProps {
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultExtensionMinutes: number;
  onSubmit: (input: ExtendBookingRequest) => Promise<BookingDialogResult>;
  reasonLabel?: string;
  endsAt?: string;
  onCheck?: (input: ExtensionCheckRequest) => Promise<ExtensionCheck>;
}

function validMinutes(value: string): boolean {
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes >= EXTENSION_MINUTES.min && minutes <= EXTENSION_MINUTES.max;
}

export function ExtendBookingDialog({
  bookingId,
  open,
  onOpenChange,
  defaultExtensionMinutes,
  onSubmit,
  reasonLabel = "Reason",
  endsAt,
  onCheck,
}: ExtendBookingDialogProps) {
  const router = useRouter();
  const { reject } = useReceptionValidation();
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");
  const [extraMinutes, setExtraMinutes] = useState(String(defaultExtensionMinutes));

  const checkKey = open && onCheck !== undefined && validMinutes(extraMinutes) ? `${bookingId}|${extraMinutes}` : "";
  const [checked, setChecked] = useState<{ key: string; result: ExtensionCheck | null }>({ key: "", result: null });

  useEffect(() => {
    if (checkKey === "" || onCheck === undefined) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      onCheck({ bookingId, extraMinutes: Number(extraMinutes) })
        .then((result) => {
          if (!cancelled) setChecked({ key: checkKey, result });
        })
        .catch(() => {
          if (!cancelled) setChecked({ key: checkKey, result: { status: "error", message: NETWORK_MESSAGE } });
        });
    }, CONSOLE_LIST.searchDelayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [checkKey, onCheck, bookingId, extraMinutes]);

  const close = () => {
    onOpenChange(false);
    setReason("");
    setExtraMinutes(String(defaultExtensionMinutes));
  };

  const submit = () => {
    if (pending) return;
    if (!validMinutes(extraMinutes)) {
      reject("extend-minutes", `Enter extra time as a whole number from ${EXTENSION_MINUTES.min} to ${EXTENSION_MINUTES.max} minutes.`);
      return;
    }
    if (reason.trim().length === 0) {
      reject("extend-reason", "Enter a reason for this change.");
      return;
    }

    start(async () => {
      let result: BookingDialogResult;
      try {
        result = await onSubmit({
          bookingId,
          extraMinutes: Number(extraMinutes) || 0,
          reason,
        });
      } catch (cause) {
        console.error("[console] booking action failed:", cause);
        result = { ok: false, message: NETWORK_MESSAGE };
      }

      if (result.ok) {
        toast.success("Booking extended");
        close();
        router.refresh();
        return;
      }

      toast.error("Nothing was changed", { description: result.message });
    });
  };

  const newEnd =
    endsAt !== undefined && validMinutes(extraMinutes)
      ? new Date(Date.parse(endsAt) + Number(extraMinutes) * 60_000)
      : null;
  const check = checkKey !== "" && checked.key === checkKey ? checked.result : null;
  const checking = checkKey !== "" && checked.key !== checkKey;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !pending && close()}>
      <DialogContent pending={pending} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Extend this booking</DialogTitle>
          <DialogDescription className="sr-only">Extra visit time.</DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="extend-minutes">Extra minutes</FieldLabel>
          <Input
            id="extend-minutes"
            type="number"
            required
            min={EXTENSION_MINUTES.min}
            max={EXTENSION_MINUTES.max}
            step={EXTENSION_MINUTES.step}
            aria-describedby="extend-minutes-limits"
            inputMode="numeric"
            value={extraMinutes}
            onChange={(event) => setExtraMinutes(event.target.value)}
            disabled={pending}
            className="h-tap text-console-body"
          />
          <p id="extend-minutes-limits" className="text-micro text-text-secondary">{EXTENSION_MINUTES.min}–{EXTENSION_MINUTES.max} minutes</p>
        </Field>

        {endsAt !== undefined && (
          <div role="status" aria-live="polite" className="flex flex-col gap-1 rounded-(--radius-card) border border-border bg-surface-sunken px-4 py-3">
            <p className="text-console-body text-text-primary">
              {newEnd === null ? (
                "Enter the extra minutes to see the new end time."
              ) : (
                <>
                  New end time{" "}
                  <span className="font-data font-medium tabular-nums">{formatDubaiTime(newEnd)}</span>
                  <span className="text-text-secondary"> (Dubai)</span>
                </>
              )}
            </p>
            {checking && <p className="text-micro text-text-secondary">Checking the suite…</p>}
            {check?.status === "fits" && (
              <p className="text-micro text-success-ink">
                {check.freeUntil === null
                  ? "Nothing else is booked in this suite afterwards."
                  : `The visit can run until ${formatDubaiTime(check.freeUntil)} and still leave cleaning time before the next booking.`}
              </p>
            )}
            {check?.status === "conflict" && (
              <p className="text-micro text-warning-ink">{check.message}</p>
            )}
            {check?.status === "error" && <p className="text-micro text-danger-ink">{check.message}</p>}
          </div>
        )}

        <ReasonField
          id="extend-reason"
          label={reasonLabel}
          value={reason}
          onChange={setReason}
          disabled={pending}
        />

        <DialogFooter>
          <Button hoverEffect="sweep" type="button" variant="ghost" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={submit}>
            {pending ? "Extending…" : "Extend booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
