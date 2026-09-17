"use client";

import { useState } from "react";
import { PencilIcon } from "lucide-react";

import { updateManagedBookingDetails } from "@/app/(console)/manage/bookings/actions";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/console/reception/reception-dialog";
import { BookingDetailsForm } from "@/components/console/shared/booking/booking-details-form";

export interface BookingNotesEditActionProps {
  readonly bookingId: string;
  readonly who: string;
  readonly personalRequest: string | null;
  readonly internalNote: string | null;
  readonly personalRequestMaxLength: number;
}

export function BookingNotesEditAction({
  bookingId,
  who,
  personalRequest,
  internalNote,
  personalRequestMaxLength,
}: BookingNotesEditActionProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PencilIcon aria-hidden="true" className="size-4" />
        Edit
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-dialog-max-h flex-col gap-4 sm:max-w-lg">
          <DialogHeader className="pr-8">
            <DialogTitle>Edit booking notes</DialogTitle>
            <DialogDescription>{who}</DialogDescription>
          </DialogHeader>
          {open && (
            <BookingDetailsForm
              bookingId={bookingId}
              personalRequest={personalRequest}
              internalNote={internalNote}
              personalRequestMaxLength={personalRequestMaxLength}
              onSubmit={updateManagedBookingDetails}
              onSaved={() => setOpen(false)}
              onCancel={() => setOpen(false)}
              askReason={false}
              layout="dialog"
              submitLabel="Save notes"
              successMessage="Booking notes saved"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
