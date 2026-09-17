"use client";

import { useReceptionValidation } from "@/components/console/reception/reception-validation";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/console/feedback";

import {
  cancelBooking,
  extendBooking,
  type BookingActionResult,
} from "@/app/(console)/reception/actions";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { allowedActions } from "@/lib/domain/booking";
import type { BookingDetail } from "@/lib/db/queries/bookings";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/console/reception/reception-dialog";
import { ReasonField } from "@/components/console/reception/reception-reason-field";
import { ExtendBookingDialog } from "@/components/console/shared/booking/extend-booking-dialog";

type OpenAction = "cancel" | "extend" | null;

export interface BookingActionsProps {
  booking: BookingDetail;
  defaultExtensionMinutes: number;
}

export function BookingActions({
  booking,
  defaultExtensionMinutes,
}: BookingActionsProps) {
  const router = useRouter();
  const { reject } = useReceptionValidation();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<OpenAction>(null);
  const [reason, setReason] = useState("");

  const actions = allowedActions(booking.status);
  const canCancel = actions.includes("cancel");
  const canExtend = actions.includes("extend");

  if (!canCancel && !canExtend) return null;

  const closeCancel = () => {
    setOpen(null);
    setReason("");
  };

  const confirmCancel = () => {
    if (pending) return;
    if (reason.trim().length === 0) {
      reject("cancel-reason", "Enter a reason for this change.");
      return;
    }

    start(async () => {
      let result: BookingActionResult;
      try {
        result = await cancelBooking(booking.id, reason);
      } catch (cause) {
        console.error("[console] booking action failed:", cause);
        result = { ok: false, message: NETWORK_MESSAGE };
      }

      if (result.ok) {
        toast.success("Booking cancelled");
        closeCancel();
        router.refresh();
        return;
      }

      toast.error("Nothing was changed", { description: result.message });
    });
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canExtend && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen("extend")}
            className="min-h-tap"
          >
            Extend
          </Button>
        )}
        {canCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen("cancel")}
            className="min-h-tap"
          >
            Cancel booking
          </Button>
        )}
      </div>

      <ExtendBookingDialog
        bookingId={booking.id}
        open={open === "extend"}
        onOpenChange={(next) => setOpen(next ? "extend" : null)}
        defaultExtensionMinutes={defaultExtensionMinutes}
        onSubmit={extendBooking}
        reasonLabel="Extension reason"
      />

      <Dialog open={open === "cancel"} onOpenChange={(next) => !next && !pending && closeCancel()}>
        <DialogContent pending={pending} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this booking</DialogTitle>
            <DialogDescription>Releases the suite for another booking.</DialogDescription>
          </DialogHeader>

          <ReasonField
            id="cancel-reason"
            label="Cancellation reason"
            value={reason}
            onChange={setReason}
            disabled={pending}
          />

          <DialogFooter>
            <Button hoverEffect="sweep" type="button" variant="ghost" onClick={closeCancel} disabled={pending}>
              Keep booking
            </Button>
            <Button
              hoverEffect="sweep"
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={confirmCancel}
            >
              {pending ? "Cancelling…" : "Cancel booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
