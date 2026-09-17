"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { useReceptionValidation } from "@/components/console/reception/reception-validation";
import { toast } from "@/lib/console/feedback";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import {
  BOOKING_NOTE_MAX_LENGTH,
  REASON_MAX_LENGTH,
} from "@/lib/config/console-limits";
import { Button } from "@/components/shared/button";
import { DialogFooter } from "@/components/console/reception/reception-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/console/reception/reception-input";
import {
  CharacterCounter,
  showsCharacterCounter,
} from "@/components/shared/character-counter";
import { HINT_CLASS } from "@/components/console/reception/walk-in-form";
import type {
  BookingDialogResult,
  BookingDetailsRequest,
} from "@/components/console/shared/booking/booking-dialog-types";

export interface BookingDetailsFormProps {
  bookingId: string;
  personalRequest: string | null;
  internalNote: string | null;
  personalRequestMaxLength: number;
  onSubmit: (input: BookingDetailsRequest) => Promise<BookingDialogResult>;
  onSaved: () => void;
  onCancel: () => void;
  askReason?: boolean;
  layout?: "inline" | "dialog";
  submitLabel?: string;
  successMessage?: string;
}

export function BookingDetailsForm({
  bookingId,
  personalRequest,
  internalNote,
  personalRequestMaxLength,
  onSubmit,
  onSaved,
  onCancel,
  askReason = true,
  layout = "inline",
  submitLabel = "Save notes",
  successMessage = "Notes saved",
}: BookingDetailsFormProps) {
  const router = useRouter();
  const { reject } = useReceptionValidation();
  const [pending, start] = useTransition();
  const [request, setRequest] = useState(personalRequest ?? "");
  const [note, setNote] = useState(internalNote ?? "");
  const [reason, setReason] = useState("");

  const submit = () => {
    if (pending) return;
    if (askReason && !reason.trim()) {
      reject("booking-notes-reason", "Enter a reason for changing the notes or special request.");
      return;
    }
    if (request.length > personalRequestMaxLength) {
      reject("booking-personal-request",
        `Keep the special request to ${personalRequestMaxLength} characters or fewer.`,
      );
      return;
    }

    start(async () => {
      let result: BookingDialogResult;

      try {
        result = await onSubmit({
          bookingId,
          personalRequest: request,
          internalNote: note,
          reason,
        });
      } catch (cause) {
        console.error("[console] updateBookingDetails threw:", cause);
        result = { ok: false, message: NETWORK_MESSAGE };
      }

      if (result.ok) {
        toast.success(successMessage);
        setReason("");
        onSaved();
        router.refresh();
        return;
      }

      toast.error("Nothing was changed", { description: result.message });
    });
  };

  const save = (
    <Button
      type="button"
      className="min-h-tap"
      onClick={submit}
      disabled={pending}
    >
      {pending ? "Saving…" : submitLabel}
    </Button>
  );

  const cancel = (
    <Button
      hoverEffect="sweep"
      type="button"
      variant="ghost"
      className="min-h-tap"
      onClick={onCancel}
      disabled={pending}
    >
      Cancel
    </Button>
  );

  return (
    <>
      <Field>
        <FieldLabel htmlFor="booking-personal-request">
          Special request
        </FieldLabel>
        <Textarea
          id="booking-personal-request"
          value={request}
          onChange={(event) => {
            setRequest(event.target.value.slice(0, personalRequestMaxLength));
          }}
          disabled={pending}
          rows={3}
          maxLength={personalRequestMaxLength}
          aria-describedby={
            showsCharacterCounter(request, personalRequestMaxLength)
              ? "booking-personal-request-remaining"
              : "booking-personal-request-hint"
          }
          className="text-console-body"
        />
        <p id="booking-personal-request-hint" className={HINT_CLASS}>
          What the guest asked for, up to {personalRequestMaxLength}{" "}
          characters. Read back to them if you change it.
        </p>
        <CharacterCounter
          id="booking-personal-request-remaining"
          value={request}
          maxLength={personalRequestMaxLength}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="booking-internal-note">
          Internal note
        </FieldLabel>
        <Textarea
          id="booking-internal-note"
          value={note}
          onChange={(event) =>
            setNote(event.target.value.slice(0, BOOKING_NOTE_MAX_LENGTH))
          }
          disabled={pending}
          rows={3}
          maxLength={BOOKING_NOTE_MAX_LENGTH}
          aria-describedby={
            showsCharacterCounter(note, BOOKING_NOTE_MAX_LENGTH)
              ? "booking-internal-note-remaining"
              : "booking-internal-note-hint"
          }
          className="text-console-body"
        />
        <p id="booking-internal-note-hint" className={HINT_CLASS}>
          For the desk and the next shift, up to{" "}
          {BOOKING_NOTE_MAX_LENGTH} characters. The guest never sees it.
        </p>
        <CharacterCounter
          id="booking-internal-note-remaining"
          value={note}
          maxLength={BOOKING_NOTE_MAX_LENGTH}
        />
      </Field>

      {askReason && (
        <Field>
          <FieldLabel htmlFor="booking-notes-reason">Reason for change</FieldLabel>
          <Textarea
            id="booking-notes-reason"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value.slice(0, REASON_MAX_LENGTH));
            }}
            disabled={pending}
            required
            rows={2}
            maxLength={REASON_MAX_LENGTH}
            placeholder="Explain why the notes or special request are changing"
            aria-describedby={
              showsCharacterCounter(reason, REASON_MAX_LENGTH)
                ? "booking-notes-reason-remaining"
                : "booking-notes-reason-hint"
            }
            className="text-console-body"
          />
          <p id="booking-notes-reason-hint" className={HINT_CLASS}>
            Up to {REASON_MAX_LENGTH} characters. Saved in booking history
            with your name and the time.
          </p>
          <CharacterCounter
            id="booking-notes-reason-remaining"
            value={reason}
            maxLength={REASON_MAX_LENGTH}
          />
        </Field>
      )}

      {layout === "dialog" ? (
        <DialogFooter>
          {cancel}
          {save}
        </DialogFooter>
      ) : (
        <div className="flex flex-wrap gap-2">
          {save}
          {cancel}
        </div>
      )}
    </>
  );
}
