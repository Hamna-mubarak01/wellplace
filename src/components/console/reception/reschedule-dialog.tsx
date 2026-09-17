"use client";

import { CalendarClockIcon } from "lucide-react";

import { rescheduleBooking } from "@/app/(console)/reception/actions";
import type { BookingDetail } from "@/lib/db/queries/bookings";
import { Button } from "@/components/shared/button";
import { RescheduleBookingDialog } from "@/components/console/shared/booking/reschedule-booking-dialog";
import type {
  RescheduleTimes,
  RescheduleTimesRequest,
} from "@/components/console/shared/booking/booking-dialog-types";

async function loadReceptionTimes(request: RescheduleTimesRequest): Promise<RescheduleTimes> {
  const query = new URLSearchParams({
    date: request.date,
    bookingId: request.bookingId,
    durationMinutes: String(request.durationMinutes),
  });
  const response = await fetch(`/api/availability?${query.toString()}`, { cache: "no-store" });
  return (await response.json()) as RescheduleTimes;
}

export interface RescheduleDialogProps {
  booking: BookingDetail;
  maxHorizonDays?: number | null;
  durationsHours: readonly number[];
}

export function RescheduleDialog({ booking, durationsHours, maxHorizonDays }: RescheduleDialogProps) {
  return (
    <RescheduleBookingDialog
      booking={booking}
      durationsHours={durationsHours}
      maxHorizonDays={maxHorizonDays}
      loadTimes={loadReceptionTimes}
      onSubmit={rescheduleBooking}
      reasonLabel="Rescheduling reason"
      trigger={
        <Button type="button" variant="outline" className="min-h-tap">
          <CalendarClockIcon aria-hidden="true" />
          Reschedule
        </Button>
      }
    />
  );
}
