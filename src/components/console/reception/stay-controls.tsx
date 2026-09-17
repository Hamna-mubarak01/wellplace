"use client";

import { useReceptionValidation } from "@/components/console/reception/reception-validation";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/console/feedback";

import {
  checkIn,
  checkOut,
  markNoShow,
  recordArrival,
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
import {
  LateArrivalDialog,
  canRecordLateArrival,
} from "@/components/console/reception/late-arrival-dialog";

export interface StayControlsProps {
  booking: BookingDetail;
}

export function StayControls({ booking }: StayControlsProps) {
  const { reject } = useReceptionValidation();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [noShowOpen, setNoShowOpen] = useState(false);
  const [reason, setReason] = useState("");

  const actions = allowedActions(booking.status);
  const canArrive = actions.includes("record_arrival") && booking.arrivedAt === null;
  const canCheckIn = actions.includes("check_in");
  const canCheckOut = actions.includes("check_out");
  const canNoShow = actions.includes("mark_no_show");
  const canLateArrival = canRecordLateArrival(booking);

  if (!canArrive && !canCheckIn && !canCheckOut && !canNoShow && !canLateArrival) {
    return null;
  }

  const run = (perform: () => Promise<BookingActionResult>, success: string) => {
    if (pending) return;
    if (noShowOpen && !reason.trim()) { reject("no-show-reason", "Enter a reason for marking this booking as a no-show."); return; }
    start(async () => {
      let result: BookingActionResult;
      try {
        result = await perform();
      } catch (cause) {
        console.error("[console] booking action failed:", cause);
        result = { ok: false, message: NETWORK_MESSAGE };
      }

      if (result.ok) {
        toast.success(success);
        setNoShowOpen(false);
        setReason("");
        router.refresh();
        return;
      }

      toast.error("Nothing was changed", { description: result.message });
    });
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canArrive && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="min-h-tap"
            onClick={() =>
              run(() => recordArrival(booking.id, ""), "Arrival recorded")
            }
          >
            Record arrival
          </Button>
        )}

        {canCheckIn && (
          <Button
            type="button"
            disabled={pending}
            className="min-h-tap"
            onClick={() => run(() => checkIn(booking.id, ""), "Checked in")}
          >
            Check in
          </Button>
        )}

        {canCheckOut && (
          <Button
            type="button"
            disabled={pending}
            className="min-h-tap"
            onClick={() => run(() => checkOut(booking.id, ""), "Checked out")}
          >
            Check out
          </Button>
        )}

        {canNoShow && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="min-h-tap"
            onClick={() => setNoShowOpen(true)}
          >
            No show
          </Button>
        )}

        <LateArrivalDialog booking={booking} />
      </div>

      <Dialog open={noShowOpen} onOpenChange={(next) => { if (!next && !pending) { setNoShowOpen(false); setReason(""); } }}>
        <DialogContent pending={pending} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark this booking a no show</DialogTitle>
            <DialogDescription>Releases the suite for another booking.</DialogDescription>
          </DialogHeader>

          <ReasonField
            id="no-show-reason"
              label="No-show reason"
            value={reason}
            onChange={setReason}
            disabled={pending}
          />

          <DialogFooter>
            <Button
              hoverEffect="sweep"
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => { setNoShowOpen(false); setReason(""); }}
            >
              Keep waiting
            </Button>
            <Button
              hoverEffect="sweep"
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() =>
                run(() => markNoShow(booking.id, reason), "Recorded as a no show")
              }
            >
              {pending ? "Recording…" : "Mark no show"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
