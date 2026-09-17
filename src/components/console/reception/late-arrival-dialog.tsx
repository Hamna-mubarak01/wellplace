"use client";

import { useReceptionValidation } from "@/components/console/reception/reception-validation";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClockAlertIcon } from "lucide-react";
import { toast } from "@/lib/console/feedback";

import {
  markLateArrival,
  type BookingActionResult,
} from "@/app/(console)/reception/actions";
import type { BookingDetail } from "@/lib/db/queries/bookings";
import type { BookingStatus } from "@/lib/domain/booking";
import { lateArrivalMinutes } from "@/lib/domain/overrun";
import { LATE_ARRIVAL_MINUTES } from "@/lib/config/console-limits";
import { formatDubaiDateTime } from "@/lib/domain/time";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/console/reception/reception-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/console/reception/reception-input";
import { ReasonField } from "@/components/console/reception/reception-reason-field";
import { HINT_CLASS } from "@/components/console/reception/walk-in-form";

const RECORDABLE_STATUSES: readonly BookingStatus[] = [
  "confirmed",
  "checked_in",
  "completed",
];

function measuredMinutes(booking: BookingDetail): number {
  if (booking.arrivedAt === null) return 0;
  return lateArrivalMinutes(
    new Date(booking.startsAt),
    new Date(booking.arrivedAt),
  );
}

export function canRecordLateArrival(booking: BookingDetail): boolean {
  if (!RECORDABLE_STATUSES.includes(booking.status)) return false;
  if (booking.lateArrivalMinutes !== null) return true;
  return measuredMinutes(booking) > 0;
}

export function LateArrivalDialog({ booking }: { booking: BookingDetail }) {
  const router = useRouter();
  const { reject } = useReceptionValidation();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const initial = String(booking.lateArrivalMinutes ?? measuredMinutes(booking));
  const [minutes, setMinutes] = useState(initial);
  const [reason, setReason] = useState("");

  if (!canRecordLateArrival(booking)) return null;

  const close = () => {
    setOpen(false);
    setMinutes(initial);
    setReason("");

  };

  const submit = () => {
    if (pending) return;
    const parsed = Number(minutes.trim());

    if (minutes.trim() === "" || !Number.isInteger(parsed)) {
      reject("late-arrival-minutes", "Enter how many minutes late, as a whole number.");
      return;
    }

    if (parsed < LATE_ARRIVAL_MINUTES.min || parsed > LATE_ARRIVAL_MINUTES.max) {
      reject("late-arrival-minutes",
        `Enter between ${LATE_ARRIVAL_MINUTES.min} and ${LATE_ARRIVAL_MINUTES.max} minutes. Check the arrival time.`,
      );
      return;
    }

    if (reason.trim().length === 0) {
      reject("late-arrival-reason", "Enter a reason for the late arrival.");
      return;
    }

    start(async () => {
      let result: BookingActionResult;

      try {
        result = await markLateArrival({
          bookingId: booking.id,
          minutes: parsed,
          reason,
        });
      } catch (cause) {
        console.error("[console] markLateArrival threw:", cause);
        result = { ok: false, message: NETWORK_MESSAGE };
      }

      if (result.ok) {
        toast.success("Late arrival recorded");
        close();
        router.refresh();
        return;
      }

      toast.error("Nothing was changed", { description: result.message });

    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        if (next) {
          setMinutes(initial);
          setOpen(true);
        } else close();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="min-h-tap">
          <ClockAlertIcon aria-hidden="true" />
          {booking.lateArrivalMinutes === null
            ? "Late arrival"
            : "Correct late arrival"}
        </Button>
      </DialogTrigger>

      <DialogContent pending={pending} className="max-h-dialog-max-h overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record a late arrival</DialogTitle>
          <DialogDescription className="sr-only">Arrival delay in minutes.</DialogDescription>
        </DialogHeader>



        <dl className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-console-body text-text-secondary">Booked start</dt>
            <dd className="font-data text-console-body tabular-nums text-text-primary">
              {formatDubaiDateTime(booking.startsAt)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-console-body text-text-secondary">Arrived</dt>
            <dd className="font-data text-console-body tabular-nums text-text-primary">
              {booking.arrivedAt === null
                ? "Not recorded"
                : formatDubaiDateTime(booking.arrivedAt)}
            </dd>
          </div>
        </dl>

        <Field>
          <FieldLabel htmlFor="late-arrival-minutes">Minutes late</FieldLabel>
          <Input
            id="late-arrival-minutes"
            type="number"
            required
            inputMode="numeric"
            min={LATE_ARRIVAL_MINUTES.min}
            max={LATE_ARRIVAL_MINUTES.max}
            step={LATE_ARRIVAL_MINUTES.step}
            value={minutes}
            onChange={(event) => {
              setMinutes(event.target.value);

            }}
            disabled={pending}
            aria-describedby="late-arrival-minutes-hint"
            className="h-tap font-data tabular-nums text-console-body"
          />
          <p id="late-arrival-minutes-hint" className={HINT_CLASS}>
            Between {LATE_ARRIVAL_MINUTES.min} and {LATE_ARRIVAL_MINUTES.max}{" "}
            minutes, taken from the arrival time. Change it if the guest was held
            up at the desk rather than late to the door.
          </p>

        </Field>

        <ReasonField
          id="late-arrival-reason"
          value={reason}
          onChange={(next) => {
            setReason(next);

          }}

          disabled={pending}
        />

        <DialogFooter>
          <Button hoverEffect="sweep" type="button" variant="ghost" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "Recording…" : "Record late arrival"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
