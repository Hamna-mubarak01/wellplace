"use client";

import { useReceptionValidation } from "@/components/console/reception/reception-validation";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TimerResetIcon } from "lucide-react";
import { toast } from "@/lib/console/feedback";

import {
  recordOverrun,
  type BookingActionResult,
} from "@/app/(console)/reception/actions";
import { allowedActions } from "@/lib/domain/booking";
import { measureOverrun } from "@/lib/domain/overrun";
import type { BookingDetail } from "@/lib/db/queries/bookings";
import { DUBAI_TIME_ZONE, formatDubaiDateTime } from "@/lib/domain/time";
import { OVERRUN_MINUTES } from "@/lib/config/console-limits";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { formatAed } from "@/components/shared/money";
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
import { DateTimeField } from "@/components/console/manage/date-time-field";
import { ReasonField } from "@/components/console/reception/reception-reason-field";


const DUBAI_UTC_OFFSET = "+04:00";
const LOCAL_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function toDubaiInputValue(instant: string | Date): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DUBAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function fromDubaiInputValue(value: string): Date | null {
  if (!LOCAL_INSTANT.test(value)) return null;
  const date = new Date(`${value}:00${DUBAI_UTC_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface OverrunDialogProps {
  booking: BookingDetail;
  incrementMinutes: number;
  canSeeMoney: boolean;
  adultRateFils: number | null;
  childRateFils: number | null;
}

export function OverrunDialog({
  booking,
  incrementMinutes,
  adultRateFils,
  childRateFils,
  canSeeMoney,
}: OverrunDialogProps) {
  const { errors, reject, clear } = useReceptionValidation();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [actualEnd, setActualEnd] = useState(() =>
    toDubaiInputValue(booking.checkedOutAt ?? booking.endsAt),
  );
  const [reason, setReason] = useState("");

  if (!allowedActions(booking.status).includes("record_overrun")) return null;

  const scheduledEnd = new Date(booking.endsAt);
  const chosenEnd = fromDubaiInputValue(actualEnd);

  const measurement =
    chosenEnd === null
      ? null
      : measureOverrun({ scheduledEnd, actualEnd: chosenEnd, incrementMinutes });

  const perIncrementFils =
    adultRateFils === null && childRateFils === null
      ? null
      : booking.adults * (adultRateFils ?? 0) +
        booking.children * (childRateFils ?? 0);

  const chargeFils =
    canSeeMoney && measurement !== null && perIncrementFils !== null
      ? measurement.chargeableIncrements * perIncrementFils
      : null;

  const close = () => {
    clear("overrun-end");
    setOpen(false);
    setActualEnd(toDubaiInputValue(booking.checkedOutAt ?? booking.endsAt));
    setReason("");

  };

  const submit = () => {
    if (pending) return;
    if (chosenEnd === null) {
      reject("overrun-end", "Choose the date and time the guest left.");
      return;
    }

    if (measurement !== null && measurement.overrunMinutes > OVERRUN_MINUTES.max) {
      reject("overrun-end",
        `That is more than ${OVERRUN_MINUTES.max} minutes past the booked end. Check the date.`,
      );
      return;
    }

    if (reason.trim().length === 0) {
      reject("overrun-reason", "Enter a reason for the overrun.");
      return;
    }

    start(async () => {
      let result: BookingActionResult;

      try {
        result = await recordOverrun({
          bookingId: booking.id,
          actualEnd: chosenEnd.toISOString(),
          reason,
        });
      } catch (cause) {
        console.error("[console] recordOverrun threw:", cause);
        result = { ok: false, message: NETWORK_MESSAGE };
      }

      if (result.ok) {
        toast.success("Overrun recorded");
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
        if (next) setOpen(true);
        else close();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="min-h-tap">
          <TimerResetIcon aria-hidden="true" />
          Record overrun
        </Button>
      </DialogTrigger>

      <DialogContent pending={pending} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record an overrun</DialogTitle>
          <DialogDescription>{incrementMinutes}-minute billing increments.</DialogDescription>
        </DialogHeader>



        <div className="flex flex-col gap-1">
          <p className="text-console-body text-text-secondary">Booked to end</p>
          <p className="font-data text-console-body tabular-nums text-text-primary">
            {formatDubaiDateTime(booking.endsAt)}
          </p>
        </div>

        <Field id="overrun-end" aria-label="Actual departure" data-invalid={Boolean(errors["overrun-end"]) || undefined}>
          <FieldLabel>Actual departure</FieldLabel>
          <DateTimeField
            label="Actual departure"
            value={actualEnd}
            onChange={(next) => {
              clear("overrun-end");
              setActualEnd(next);

            }}
            disabled={pending}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              hoverEffect="sweep"
              type="button"
              variant="outline"
              size="sm"
              className="min-h-tap"
              disabled={pending}
              onClick={() => {
                clear("overrun-end");
                setActualEnd(toDubaiInputValue(new Date()));

              }}
            >
              Use current time
            </Button>
          </div>
        </Field>

        {measurement !== null && (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-(--radius-card) bg-surface-sunken p-4 text-console-body">
            <dt className="text-text-secondary">Extra time</dt>
            <dd className="text-right font-data tabular-nums">{measurement.overrunMinutes} min</dd>
            <dt className="text-text-secondary">Billable time</dt>
            <dd className="text-right font-data tabular-nums">{measurement.chargeableMinutes} min</dd>
            {chargeFils !== null && <>
              <dt className="font-medium">Additional charge</dt>
              <dd className="text-right font-data font-medium tabular-nums">{formatAed(chargeFils)}</dd>
            </>}
          </dl>
        )}

        <ReasonField
          id="overrun-reason"
          value={reason}
          onChange={(next) => {
            setReason(next);

          }}

          disabled={pending}
        />

        <DialogFooter>
          <Button
            hoverEffect="sweep"
            type="button"
            variant="ghost"
            onClick={close}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "Recording…" : "Record overrun"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
