"use client";

import { useReceptionValidation } from "@/components/console/reception/reception-validation";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/console/feedback";

import { addShiftNote } from "@/app/(console)/reception/actions";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { SHIFT_NOTE_MAX_LENGTH } from "@/lib/config/console-limits";
import { Button } from "@/components/shared/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/console/reception/reception-input";
import {
  CharacterCounter,
  showsCharacterCounter,
} from "@/components/shared/character-counter";
import { HINT_CLASS } from "@/components/console/reception/walk-in-form";

export function ShiftNoteForm({ shiftOn, onSaved, onPendingChange }: { shiftOn: string; onSaved?: () => void; onPendingChange?: (pending: boolean) => void }) {
  const router = useRouter();
  const { reject } = useReceptionValidation();
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");
  useEffect(() => { onPendingChange?.(pending); }, [pending, onPendingChange]);

  return (
    <form noValidate
      className="flex flex-col gap-3 rounded-(--radius-card) border border-border bg-surface-raised px-4 py-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;

        if (body.trim().length === 0) {
          reject("shift-note", "Write the note before saving it.");
          return;
        }

        start(async () => {
          try {
          const result = await addShiftNote(shiftOn, body);

          if (result.ok) {
            toast.success("Shift note saved");
            setBody("");
            router.refresh();
            onSaved?.();
            return;
          }

          toast.error("The note was not saved", { description: result.message });
          } catch {
            toast.error("The note was not saved", { description: NETWORK_MESSAGE });
          }
        });
      }}
    >
      <Field>
        <FieldLabel htmlFor="shift-note">
          What should the next shift know?
        </FieldLabel>
        <Textarea
          id="shift-note"
          required
          value={body}
          onChange={(event) => {
            setBody(event.target.value.slice(0, SHIFT_NOTE_MAX_LENGTH));
          }}
          rows={3}
          maxLength={SHIFT_NOTE_MAX_LENGTH}
          disabled={pending}
          placeholder="Suite 4 heater is slow to warm. Guest in 2 asked for a late checkout."
          aria-describedby={
            showsCharacterCounter(body, SHIFT_NOTE_MAX_LENGTH)
              ? "shift-note-remaining"
              : "shift-note-hint"
          }
          className="text-console-body"
        />
        <p id="shift-note-hint" className={HINT_CLASS}>
          Up to {SHIFT_NOTE_MAX_LENGTH} characters.
        </p>
        <CharacterCounter
          id="shift-note-remaining"
          value={body}
          maxLength={SHIFT_NOTE_MAX_LENGTH}
        />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending} className="min-h-tap">
          {pending ? "Saving…" : "Save note"}
        </Button>
      </div>
    </form>
  );
}
