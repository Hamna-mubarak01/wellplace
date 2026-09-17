"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/console/feedback";

import {
  assignCleaning,
  confirmCleaning,
  startCleaning,
  takeCleaningTask,
  type BookingActionResult,
} from "@/app/(console)/reception/actions";
import type { CleaningRow } from "@/lib/db/queries/operations";
import { CLEANING_NOTE_MAX_LENGTH } from "@/lib/config/console-limits";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/console/reception/reception-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/console/reception/reception-input";
import {
  CharacterCounter,
  showsCharacterCounter,
} from "@/components/shared/character-counter";
import { HINT_CLASS } from "@/components/console/reception/walk-in-form";
import {
  StaffAssignMenu,
  type StaffOption,
} from "@/components/console/reception/staff-assign-menu";

export interface CleaningActionsProps {
  task: CleaningRow;
  staff: readonly StaffOption[];
}

export function CleaningActions({ task, staff }: CleaningActionsProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  if (task.status === "confirmed") return null;

  const run = (perform: () => Promise<BookingActionResult>, success: string) => {
    start(async () => {
      let result: BookingActionResult;

      try {
        result = await perform();
      } catch (cause) {
        console.error("[console] cleaning action threw:", cause);
        result = { ok: false, message: NETWORK_MESSAGE };
      }

      if (result.ok) {
        toast.success(success);
        setOpen(false);
        setNote("");
        router.refresh();
        return;
      }

      toast.error("Nothing was changed", { description: result.message });
    });
  };

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        {task.assignedTo === null && (
          <Button
            hoverEffect="sweep"
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            className="min-h-tap"
            onClick={() => run(() => takeCleaningTask(task.id), "Assigned to you")}
          >
            Take it
          </Button>
        )}

        <StaffAssignMenu
          staff={staff}
          assignedTo={task.assignedTo}
          disabled={pending}
          triggerLabel={task.assignedTo === null ? "Assign" : "Reassign"}
          menuLabel="Give this clean to"
          onAssign={(staffId) =>
            run(() => assignCleaning(task.id, staffId), "Cleaning assigned")
          }
        />

        {task.status === "pending" && (
          <Button
            hoverEffect="sweep"
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            className="min-h-tap"
            onClick={() => run(() => startCleaning(task.id), "Cleaning started")}
          >
            Start
          </Button>
        )}

        <Button
          hoverEffect="sweep"
          type="button"
          size="sm"
          disabled={pending}
          className="min-h-tap"
          onClick={() => setOpen(true)}
        >
          Mark finished
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(next) => { if (!next && !pending) { setOpen(false); setNote(""); } }}>
        <DialogContent pending={pending} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm suite {task.suiteNumber} is clean</DialogTitle>
            <DialogDescription className="sr-only">Confirm the cleaning is complete.</DialogDescription>
          </DialogHeader>

          <Field>
            <FieldLabel htmlFor={`cleaning-note-${task.id}`}>
              Note (optional)
            </FieldLabel>
            <Textarea
              id={`cleaning-note-${task.id}`}
              value={note}
              onChange={(event) =>
                setNote(event.target.value.slice(0, CLEANING_NOTE_MAX_LENGTH))
              }
              rows={2}
              maxLength={CLEANING_NOTE_MAX_LENGTH}
              disabled={pending}
              aria-describedby={
                showsCharacterCounter(note, CLEANING_NOTE_MAX_LENGTH)
                  ? `cleaning-note-${task.id}-remaining`
                  : `cleaning-note-${task.id}-hint`
              }
              className="text-console-body"
            />
            <p id={`cleaning-note-${task.id}-hint`} className={HINT_CLASS}>
              Up to {CLEANING_NOTE_MAX_LENGTH} characters.
            </p>
            <CharacterCounter
              id={`cleaning-note-${task.id}-remaining`}
              value={note}
              maxLength={CLEANING_NOTE_MAX_LENGTH}
            />
          </Field>

          <DialogFooter>
            <Button
              hoverEffect="sweep"
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => { setOpen(false); setNote(""); }}
            >
              Not yet
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => confirmCleaning(task.id, note), "Cleaning confirmed")
              }
            >
              {pending ? "Saving…" : "Mark cleaning finished"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
