"use client";

import { useReceptionValidation } from "@/components/console/reception/reception-validation";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlertIcon } from "lucide-react";
import { toast } from "@/lib/console/feedback";

import {
  setCustomerWarning,
  type BookingActionResult,
} from "@/app/(console)/reception/actions";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { GUEST_WARNING_MAX_LENGTH } from "@/lib/config/console-limits";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/console/reception/reception-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { ConsoleSwitch } from "@/components/shared/console-switch";
import { Textarea } from "@/components/console/reception/reception-input";
import { ReasonField } from "@/components/console/reception/reception-reason-field";
import {
  CharacterCounter,
  showsCharacterCounter,
} from "@/components/shared/character-counter";
import {
  DANGER_NOTE_CLASS,
  HINT_CLASS,
} from "@/components/console/reception/walk-in-form";

export interface GuestWarningDialogProps {
  bookingId: string;
  customerId: string;
  warningNote: string | null;
  isBlocked: boolean;
}

export function GuestWarningDialog({
  bookingId,
  customerId,
  warningNote,
  isBlocked,
}: GuestWarningDialogProps) {
  const router = useRouter();
  const { reject } = useReceptionValidation();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(warningNote ?? "");
  const [blocked, setBlocked] = useState(isBlocked);
  const [reason, setReason] = useState("");

  const close = () => {
    setOpen(false);
    setNote(warningNote ?? "");
    setBlocked(isBlocked);
    setReason("");

  };

  const submit = () => {
    if (pending) return;
    if (reason.trim().length === 0) {
      reject("guest-warning-reason", "Enter a reason for changing the guest warning.");
      return;
    }

    start(async () => {
      let result: BookingActionResult;

      try {
        result = await setCustomerWarning({
          bookingId,
          customerId,
          warningNote: note.trim().length === 0 ? null : note.trim(),
          isBlocked: blocked,
          reason,
        });
      } catch (cause) {
        console.error("[console] setCustomerWarning threw:", cause);
        result = { ok: false, message: NETWORK_MESSAGE };
      }

      if (result.ok) {
        toast.success(
          note.trim().length === 0 && !blocked
            ? "Warning removed"
            : "Guest record updated",
        );
        setOpen(false);
        setReason("");
        router.refresh();
        return;
      }

      toast.error("Nothing was changed", { description: result.message });

    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        if (next) {
          setNote(warningNote ?? "");
          setBlocked(isBlocked);
          setOpen(true);
        } else close();
      }}
    >
      <DialogTrigger asChild>
        <Button hoverEffect="sweep" type="button" variant="outline" size="sm" className="min-h-tap">
          {warningNote === null && !isBlocked
            ? "Add a warning"
            : "Edit warning"}
        </Button>
      </DialogTrigger>

      <DialogContent pending={pending} className="max-h-dialog-max-h overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Guest warning</DialogTitle>
          <DialogDescription>Shown on this guest’s bookings.</DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="guest-warning-note">
            What colleagues should know
          </FieldLabel>
          <Textarea
            id="guest-warning-note"
            value={note}
            onChange={(event) =>
              setNote(event.target.value.slice(0, GUEST_WARNING_MAX_LENGTH))
            }
            rows={3}
            maxLength={GUEST_WARNING_MAX_LENGTH}
            disabled={pending}
            placeholder="Arrived intoxicated on 3 September and was asked to leave."
            aria-describedby={
              showsCharacterCounter(note, GUEST_WARNING_MAX_LENGTH)
                ? "guest-warning-note-remaining"
                : "guest-warning-note-hint"
            }
            className="text-console-body"
          />
          <p id="guest-warning-note-hint" className={HINT_CLASS}>
            Up to {GUEST_WARNING_MAX_LENGTH} characters. Leave this empty to
            remove the warning.
          </p>
          <CharacterCounter
            id="guest-warning-note-remaining"
            value={note}
            maxLength={GUEST_WARNING_MAX_LENGTH}
          />
        </Field>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="guest-warning-blocked" className="text-console-body">
            Block this guest from booking
          </Label>
          <ConsoleSwitch
            id="guest-warning-blocked"
            checked={blocked}
            onCheckedChange={setBlocked}
            disabled={pending}
          />
        </div>

        <p className={DANGER_NOTE_CLASS}>
          <TriangleAlertIcon
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <span className="min-w-0 text-pretty">
            Blocking prevents new bookings online and at Reception.
          </span>
        </p>

        <ReasonField
          id="guest-warning-reason"
          value={reason}
          onChange={(next) => {
            setReason(next);

          }}

          disabled={pending}
        />

        <DialogFooter>
          <Button
            hoverEffect="sweep"
            type="button"
            variant="ghost"
            onClick={close}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={blocked && !isBlocked ? "destructive" : "default"}
            hoverEffect="sweep"
            onClick={submit}
            disabled={pending}
          >
            {pending ? "Saving…" : "Save guest record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
