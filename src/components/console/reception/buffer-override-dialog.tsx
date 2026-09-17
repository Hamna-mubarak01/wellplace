"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MinusIcon, PlusIcon } from "lucide-react";
import { toast } from "@/lib/console/feedback";
import { overrideBookingBuffer } from "@/app/(console)/reception/actions";
import { loadScheduleBuffer } from "@/app/(console)/reception/schedule-details";
import type { CleaningBufferOptions } from "@/lib/config/cleaning-buffer";
import { CLEANING_BUFFER_MINUTES } from "@/lib/config/console-limits";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
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
import { useReceptionValidation } from "@/components/console/reception/reception-validation";
import { formatDubaiTime } from "@/lib/domain/time";

export function BufferOverrideDialog({
  options,
  onClose,
}: {
  options: CleaningBufferOptions;
  onClose: () => void;
}) {
  const router = useRouter();
  const { reject, clear } = useReceptionValidation();
  const [pending, start] = useTransition();
  const [limits, setLimits] = useState(options);
  const [minutes, setMinutes] = useState(String(options.currentMinutes));
  const [reason, setReason] = useState("");
  const floor = limits.canShorten
    ? CLEANING_BUFFER_MINUTES.min
    : limits.currentMinutes;
  const parsed = minutes.trim() === "" ? null : Number(minutes);
  const valid =
    parsed !== null &&
    Number.isInteger(parsed) &&
    parsed >= floor &&
    parsed <= limits.maxMinutes;
  const changed = valid && parsed !== limits.currentMinutes;
  const limitTime = limits.limitAt
    ? formatDubaiTime(new Date(limits.limitAt))
    : "—";
  const refreshLimits = async () => {
    const fresh = await loadScheduleBuffer(limits.bookingId);
    if (fresh.outcome === "found") setLimits(fresh.options);
    else toast.error(fresh.message);
  };
  const submit = () => {
    if (!valid) {
      reject(
        "buffer-minutes",
        `Enter a whole number between ${floor} and ${limits.maxMinutes} minutes.`,
      );
      return;
    }
    if (!reason.trim()) {
      reject("buffer-reason", "Enter a reason for changing the cleaning time.");
      return;
    }
    start(async () => {
      try {
        const result = await overrideBookingBuffer({
          bookingId: limits.bookingId,
          bufferMinutes: parsed,
          reason,
        });
        if (result.ok) {
          toast.success("Cleaning time updated");
          onClose();
          router.refresh();
        } else {
          toast.error("Cleaning time was not changed", {
            description: result.message,
          });
          await refreshLimits();
        }
      } catch {
        toast.error(NETWORK_MESSAGE);
      }
    });
  };
  const adjust = (amount: number) => {
    clear("buffer-minutes");
    setMinutes(
      String(
        Math.max(
          floor,
          Math.min(
            limits.maxMinutes,
            (parsed ?? limits.currentMinutes) + amount,
          ),
        ),
      ),
    );
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        pending={pending}
        className="reception-buffer-dialog sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Cleaning time</DialogTitle>
          <DialogDescription className="sr-only">
            Change the cleaning time reserved after this visit.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3 text-console-body">
          <span className="text-text-secondary">Current buffer</span>
          <span className="font-data">{limits.currentMinutes} min</span>
        </div>
        <Field data-invalid={(parsed !== null && !valid) || undefined}>
          <FieldLabel htmlFor="buffer-minutes">
            Total cleaning time (minutes)
          </FieldLabel>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              tone="plain"
              aria-label={`Reduce cleaning time by ${CLEANING_BUFFER_MINUTES.step} minutes`}
              disabled={
                pending ||
                !limits.canEdit ||
                (parsed ?? floor) <= floor ||
                floor > limits.maxMinutes
              }
              onClick={() => adjust(-CLEANING_BUFFER_MINUTES.step)}
            >
              <MinusIcon aria-hidden />
            </Button>
            <Input
              id="buffer-minutes"
              type="number"
              min={floor}
              max={limits.maxMinutes}
              step={1}
              required
              autoComplete="off"
              value={minutes}
              disabled={pending || !limits.canEdit}
              onChange={(event) => setMinutes(event.target.value)}
              className="min-w-0 flex-1 text-center font-data text-console-title"
              aria-describedby="buffer-limit"
              aria-invalid={(parsed !== null && !valid) || undefined}
            />
            <Button
              variant="outline"
              size="icon"
              tone="plain"
              aria-label={`Extend cleaning time by ${CLEANING_BUFFER_MINUTES.step} minutes`}
              disabled={
                pending ||
                !limits.canEdit ||
                (parsed ?? limits.currentMinutes) >= limits.maxMinutes ||
                floor > limits.maxMinutes
              }
              onClick={() => adjust(CLEANING_BUFFER_MINUTES.step)}
            >
              <PlusIcon aria-hidden />
            </Button>
          </div>
          <p id="buffer-limit" className="text-small text-text-secondary">
            Up to {limits.maxMinutes} minutes ·{" "}
            {limits.limitKind === "next_reservation"
              ? "Next reservation"
              : "Closing"}{" "}
            at {limitTime}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={
                pending ||
                !limits.canEdit ||
                floor > limits.maxMinutes ||
                parsed === limits.maxMinutes
              }
              onClick={() => {
                clear("buffer-minutes");
                setMinutes(String(limits.maxMinutes));
              }}
            >
              Use available time
            </Button>
            <Button
              hoverEffect="sweep"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  try {
                    await refreshLimits();
                  } catch {
                    toast.error(NETWORK_MESSAGE);
                  }
                })
              }
            >
              Refresh limit
            </Button>
          </div>
        </Field>
        {valid && (
          <p
            role="status"
            className="rounded-(--radius-card) bg-surface-sunken p-3 text-console-body"
          >
            Cleaning finishes{" "}
            <strong className="font-data">
              {formatDubaiTime(
                new Date(Date.parse(limits.endsAt) + parsed * 60_000),
              )}
            </strong>
          </p>
        )}
        {!limits.canEdit ? (
          <p className="text-small text-danger-ink">{limits.message}</p>
        ) : (
          limits.limitKind === "next_reservation" && (
            <p className="text-small text-text-secondary">
              Move the next booking to make more time available.
            </p>
          )
        )}
        <ReasonField
          id="buffer-reason"
          value={reason}
          onChange={setReason}
          disabled={pending}
        />
        <DialogFooter>
          <Button hoverEffect="sweep" variant="ghost" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={pending || !changed || !limits.canEdit}
            onClick={submit}
          >
            {pending ? "Saving…" : "Save cleaning time"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
