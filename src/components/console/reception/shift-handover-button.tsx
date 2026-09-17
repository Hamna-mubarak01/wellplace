"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/console/feedback";

import {
  handOverShift,
  type BookingActionResult,
} from "@/app/(console)/reception/actions";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { Button } from "@/components/shared/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export interface ShiftHandoverButtonProps {
  onPendingChange?: (pending: boolean) => void;
  noteId: string;
  authorName: string;
  onDone?: () => void;
}

export function ShiftHandoverButton({
  noteId,
  authorName,
  onPendingChange,
  onDone,
}: ShiftHandoverButtonProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  useEffect(() => { onPendingChange?.(pending); }, [pending, onPendingChange]);
  const [open, setOpen] = useState(false);

  const confirm = () =>
    start(async () => {
      let result: BookingActionResult;

      try {
        result = await handOverShift(noteId);
      } catch (cause) {
        console.error("[console] handOverShift threw:", cause);
        result = { ok: false, message: NETWORK_MESSAGE };
      }

      if (result.ok) {
        toast.success("Handover recorded");
        setOpen(false);
        router.refresh();
        onDone?.();
        return;
      }

      toast.error("Nothing was changed", { description: result.message });
    });

  return (
    <AlertDialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
      <AlertDialogTrigger asChild>
        <Button hoverEffect="sweep" type="button" variant="outline" size="sm" className="min-h-tap">
          Mark handed over
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent data-reception-dialog="" className="max-h-dialog-max-h overflow-y-auto sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm this handover?</AlertDialogTitle>
          <AlertDialogDescription>
            This records that {authorName} passed the note to you, with your name
            and the time. It cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel
            data-hover="sweep"
            className="wellplace-button h-tap rounded-(--radius-button) px-4"
            disabled={pending}
          >
            Not yet
          </AlertDialogCancel>
          <AlertDialogAction
            data-hover="sweep"
            className="wellplace-button h-tap rounded-(--radius-button) px-4"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              confirm();
            }}
          >
            {pending ? "Recording…" : "Mark handed over"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
