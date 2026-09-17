"use client";
import { useState } from "react";
import { TimerResetIcon } from "lucide-react";
import { Button } from "@/components/shared/button";
import { ScheduleBufferDialog } from "@/components/console/reception/schedule-buffer-dialog";
export function BookingBufferButton({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <TimerResetIcon aria-hidden />
        Cleaning buffer
      </Button>
      {open && (
        <ScheduleBufferDialog
          bookingId={bookingId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
