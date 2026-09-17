"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useReceptionValidation } from "@/components/console/reception/reception-validation";
import { NO_START_TIMES_MESSAGE } from "@/lib/domain/action-errors";
import { toast } from "@/lib/console/feedback";
import { allowedActions } from "@/lib/domain/booking";
import { moveStartRefusal } from "@/lib/domain/booking";
import { formatDubaiDateTime, formatDubaiTime, todayInDubai } from "@/lib/domain/time";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import type { TimeSlot } from "@/components/shared/time-tile";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { ReasonField } from "@/components/console/reception/reception-reason-field";
import { WalkInWhen } from "@/components/console/reception/walk-in-when";
import {
  HINT_CLASS,
  LABEL_CLASS,
  NOTE_CLASS,
} from "@/components/console/reception/walk-in-form";
import type {
  BookingDialogResult,
  RescheduleBookingRequest,
  RescheduleBookingSubject,
  RescheduleTimes,
  RescheduleTimesRequest,
  RescheduleTimesStatus,
} from "@/components/console/shared/booking/booking-dialog-types";

const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_HOUR = 60 * MILLISECONDS_PER_MINUTE;

const STATUS_MESSAGE: Partial<Record<RescheduleTimesStatus, string>> = {
  closed: NO_START_TIMES_MESSAGE,
  hours_unconfigured:
    "Opening hours have not been set yet. Add them in Management first.",
  error: "Availability could not be loaded.",
  invalid: "That date could not be read.",
  rate_limited: "Too many availability checks. Wait a moment and try again.",
};

export interface RescheduleBookingDialogProps {
  booking: RescheduleBookingSubject;
  maxHorizonDays?: number | null;
  durationsHours: readonly number[];
  loadTimes: (request: RescheduleTimesRequest) => Promise<RescheduleTimes>;
  onSubmit: (input: RescheduleBookingRequest) => Promise<BookingDialogResult>;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  reasonLabel?: string;
}

export function RescheduleBookingDialog({
  booking,
  durationsHours,
  maxHorizonDays,
  loadTimes,
  onSubmit,
  trigger,
  open: controlledOpen,
  onOpenChange,
  reasonLabel = "Reason",
}: RescheduleBookingDialogProps) {
  const router = useRouter();
  const { reject } = useReceptionValidation();
  const [pending, start] = useTransition();
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  const setOpen = onOpenChange ?? setOwnOpen;

  const bookedHours = (
    (new Date(booking.endsAt).getTime() - new Date(booking.startsAt).getTime()) /
      MILLISECONDS_PER_HOUR
  );

  const [date, setDate] = useState(() => todayInDubai(new Date(booking.startsAt)));
  const [durationHours, setDurationHours] = useState(() => bookedHours);
  const bookedMinutes = Math.max(
    1,
    Math.round(
      (new Date(booking.endsAt).getTime() - new Date(booking.startsAt).getTime()) /
        MILLISECONDS_PER_MINUTE,
    ),
  );

  const [durationTouched, setDurationTouched] = useState(false);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [timeError, setTimeError] = useState<string>();
  const [reloadToken, setReloadToken] = useState(0);

  const previewMinutes = durationTouched ? durationHours * 60 : bookedMinutes;
  const requestKey = open ? `${booking.id}|${date}|${previewMinutes}|${reloadToken}` : "";

  const [resolved, setResolved] = useState<{
    key: string;
    slots: readonly TimeSlot[];
    error: string | null;
  }>({ key: "", slots: [], error: null });

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    loadTimes({ bookingId: booking.id, date, durationMinutes: previewMinutes })
      .then((payload) => {
        if (cancelled) return;

        if (payload.status !== "open") {
          setResolved({
            key: requestKey,
            slots: [],
            error: STATUS_MESSAGE[payload.status] ?? "Availability is unavailable.",
          });
          return;
        }

        setResolved({
          key: requestKey,
          error: null,
          slots: (payload.slots ?? []).map((slot) => {
            const refusal = moveStartRefusal(booking.startsAt, slot.startsAt, Date.now());
            return {
              startsAt: slot.startsAt,
              label: slot.label,
              tile: {
                kind: slot.kind,
                disabled: slot.disabled || refusal !== null,
                message: refusal ?? slot.message,
                securedUntil: null,
              },
            };
          }),
        });
      })
      .catch(() => {
        if (cancelled) return;
        setResolved({
          key: requestKey,
          slots: [],
          error: "Availability could not be loaded.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [open, date, booking.id, booking.startsAt, previewMinutes, requestKey, loadTimes]);

  if (!allowedActions(booking.status).includes("reschedule")) return null;

  const loading = resolved.key !== requestKey;
  const slots = loading ? [] : resolved.slots;
  const slotsError = loading ? null : resolved.error;

  const openDialog = () => {
    setDurationTouched(false);
    setDate(todayInDubai(new Date(booking.startsAt)));
    setDurationHours(bookedHours);
    setStartsAt(null);
    setTimeError(undefined);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setStartsAt(null);
    setTimeError(undefined);
    setReason("");
  };

  const submit = () => {
    if (pending) return;
    if (startsAt === null || loading || slotsError || !slots.some((slot) => slot.startsAt === startsAt && !slot.tile.disabled)) {
      setTimeError("Choose an available start time.");
      toast.error("Choose an available start time", { description: loading ? "Please wait while we check availability." : slotsError ?? "Choose a time with room for the whole visit and the cleaning afterwards." });
      return;
    }

    if (reason.trim().length === 0) {
      reject("reschedule-reason", "Enter a reason for moving the booking.");
      return;
    }

    start(async () => {
      let result: BookingDialogResult;

      try {
        result = await onSubmit({
          bookingId: booking.id,
          startsAt,
          durationMinutes: durationTouched ? Math.round(durationHours * 60) : bookedMinutes,
          reason,
        });
      } catch (cause) {
        console.error("[console] rescheduleBooking threw:", cause);
        result = { ok: false, message: NETWORK_MESSAGE };
      }

      if (result.ok) {
        toast.success("Booking rescheduled");
        close();
        router.refresh();
        return;
      }

      setStartsAt(null);
      setTimeError(undefined);
      setReloadToken((token) => token + 1);
      toast.error("Please review the new booking time", { description: result.message });
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        if (next) openDialog();
        else close();
      }}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent pending={pending} className="flex max-h-dialog-max-h min-w-0 flex-col gap-3 overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle className="text-console-title font-medium">
            Reschedule this booking
          </DialogTitle>
          <DialogDescription>Dubai time</DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-dialog-scroll-h min-h-0 min-w-0">
          <div className="flex flex-col gap-5 pr-3">
            <div className="flex flex-col gap-2">
              <span className={LABEL_CLASS}>Booked now</span>
              <p className={NOTE_CLASS}>
                <span className="min-w-0 font-data text-pretty tabular-nums">
                  {formatDubaiDateTime(booking.startsAt)} –{" "}
                  {formatDubaiTime(booking.endsAt)}
                  {booking.suiteNumber === null
                    ? " · no suite secured"
                    : ` · suite ${booking.suiteNumber}`}
                </span>
              </p>
            </div>

            <WalkInWhen
              date={date}
              onDateChange={(next) => {
                setStartsAt(null);
                setTimeError(undefined);
                setDate(next);
              }}
              maxHorizonDays={maxHorizonDays}
              durationsHours={[...new Set([bookedHours, ...durationsHours])].sort((a, b) => a - b)}
              durationHours={durationHours}
              onDurationChange={(next) => {
                setStartsAt(null);
                setTimeError(undefined);
                setDurationTouched(true);
                setDurationHours(next);
              }}
              slots={slots}
              error={timeError}
              startsAt={startsAt}
              onStartsAtChange={(next) => {
                setTimeError(undefined);
                setStartsAt(next);
              }}
              loading={loading}
              slotsError={slotsError}
              onRetrySlots={() => setReloadToken((token) => token + 1)}
              disabled={pending}
            />

            <ReasonField
              id="reschedule-reason"
              label={reasonLabel}
              value={reason}
              onChange={setReason}
              disabled={pending}
            />

            <p className={HINT_CLASS}>
              Tell the guest the new time only once this screen confirms it.
            </p>
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0">
          <Button
            hoverEffect="sweep"
            type="button"
            variant="ghost"
            className="h-tap px-4"
            onClick={close}
            disabled={pending}
          >
            Keep this time
          </Button>
          <Button
            type="button"
            className="h-tap px-4"
            onClick={submit}
            disabled={pending}
          >
            {pending ? "Rescheduling…" : "Reschedule booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
