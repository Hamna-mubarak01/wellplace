"use client";

import { useEffect, useState } from "react";
import { loadScheduleBuffer } from "@/app/(console)/reception/schedule-details";
import { BufferOverrideDialog } from "./buffer-override-dialog";
import { ReceptionValidation } from "./reception-validation";
import { ActionError } from "@/components/shared/action-error";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/console/reception/reception-dialog";

type Details = Awaited<ReturnType<typeof loadScheduleBuffer>>;

export function ScheduleBufferDialog({
  bookingId,
  onClose,
}: {
  bookingId: string;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<Details | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    loadScheduleBuffer(bookingId)
      .then((result) => {
        if (active) setDetails(result);
      })
      .catch(() => {
        if (active)
          setDetails({
            outcome: "failed",
            message:
              "The cleaning buffer could not be loaded. Check your connection and try again.",
          });
      });
    return () => {
      active = false;
    };
  }, [bookingId, retry]);

  if (details?.outcome === "found" && details.options.canEdit) {
    return (
      <ReceptionValidation>
        <BufferOverrideDialog options={details.options} onClose={onClose} />
      </ReceptionValidation>
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cleaning buffer</DialogTitle>
          <DialogDescription className="sr-only">
            Cleaning time reserved after this visit.
          </DialogDescription>
        </DialogHeader>
        {!details && (
          <p role="status" className="text-console-body text-text-secondary">
            Loading the current cleaning buffer…
          </p>
        )}
        {details?.outcome === "failed" && (
          <ActionError message={details.message} />
        )}
        {details?.outcome === "found" && (
          <p className="text-console-body">{details.options.message}</p>
        )}
        <DialogFooter>
          {details?.outcome === "failed" && (
            <Button
              variant="outline"
              onClick={() => {
                setDetails(null);
                setRetry((value) => value + 1);
              }}
            >
              Try again
            </Button>
          )}
          <Button variant="outline" hoverEffect="sweep" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
