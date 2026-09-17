"use client";

import { NETWORK_MESSAGE } from "@/lib/console/run-action";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/console/feedback";

import { resolveAlert } from "@/app/(console)/reception/actions";
import { ALERT_NOTE_MAX_LENGTH } from "@/lib/config/console-limits";
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

export interface AlertResolveButtonProps {
  alertId: string;
  label: string;
}

export function AlertResolveButton({ alertId, label }: AlertResolveButtonProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  return (
    <>
      <Button
        hoverEffect="sweep"
        type="button"
        variant="outline"
        size="sm"
        className="min-h-tap shrink-0"
        onClick={() => setOpen(true)}
      >
        Resolve
      </Button>

      <Dialog open={open} onOpenChange={(next) => !next && setOpen(false)}>
        <DialogContent pending={pending} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve: {label}</DialogTitle>
            <DialogDescription>
              Say what you did. If the condition is still true, the alert reopens
              on the next check.
            </DialogDescription>
          </DialogHeader>

          <Field>
            <FieldLabel htmlFor={`resolve-${alertId}`}>What you did</FieldLabel>
            <Textarea
              id={`resolve-${alertId}`}
              value={note}
              onChange={(event) =>
                setNote(event.target.value.slice(0, ALERT_NOTE_MAX_LENGTH))
              }
              rows={2}
              maxLength={ALERT_NOTE_MAX_LENGTH}
              disabled={pending}
              aria-describedby={
                showsCharacterCounter(note, ALERT_NOTE_MAX_LENGTH)
                  ? `resolve-${alertId}-remaining`
                  : `resolve-${alertId}-hint`
              }
              className="text-console-body"
            />
            <p id={`resolve-${alertId}-hint`} className={HINT_CLASS}>
              Up to {ALERT_NOTE_MAX_LENGTH} characters.
            </p>
            <CharacterCounter
              id={`resolve-${alertId}-remaining`}
              value={note}
              maxLength={ALERT_NOTE_MAX_LENGTH}
            />
          </Field>

          <DialogFooter>
            <Button
              hoverEffect="sweep"
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Leave open
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
      try {
                  const result = await resolveAlert(alertId, note);

                  if (result.ok) {
                    toast.success("Alert resolved");
                    setOpen(false);
                    setNote("");
                    router.refresh();
                    return;
                  }

                  toast.error("Nothing was changed", {
                    description: result.message,
                  });
                
      } catch (cause) {
        console.error("[console] action response could not be confirmed", cause);
        toast.error(NETWORK_MESSAGE);
      }
    })
              }
            >
              {pending ? "Resolving…" : "Resolve alert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
