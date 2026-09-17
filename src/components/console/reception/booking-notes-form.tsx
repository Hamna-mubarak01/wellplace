"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NotebookPenIcon, PencilIcon } from "lucide-react";

import { updateInternalNote } from "@/app/(console)/reception/actions";
import { Button } from "@/components/shared/button";
import { ConsoleCard, ConsoleCardBody } from "@/components/console/console-surface";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/console/feedback";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { BOOKING_NOTE_MAX_LENGTH } from "@/lib/config/console-limits";
import { cn } from "@/lib/utils";

export interface BookingNotesFormProps {
  bookingId: string;
  personalRequest: string | null;
  internalNote: string | null;
}

function NoteText({ value, empty }: { value: string | null; empty: string }) {
  const filled = Boolean(value?.trim());
  return (
    <p className={cn("mt-1 text-console-body text-pretty whitespace-pre-wrap wrap-anywhere", filled ? "text-text-primary" : "text-text-muted")}>
      {filled ? value : empty}
    </p>
  );
}

export function BookingNotesForm({ bookingId, personalRequest, internalNote }: BookingNotesFormProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(internalNote ?? "");
  const [pending, start] = useTransition();

  const save = () => {
    if (pending) return;
    start(async () => {
      try {
        const result = await updateInternalNote({ bookingId, internalNote: draft });
        if (!result.ok) {
          toast.error("The note was not saved", { description: result.message });
          return;
        }
        toast.success("Internal note saved");
        setEditing(false);
        router.refresh();
      } catch {
        toast.error("The note was not saved", { description: NETWORK_MESSAGE });
      }
    });
  };

  return (
    <ConsoleCard>
      <ConsoleCardBody className="flex flex-col gap-5">
        <h2 className="flex items-center gap-2 text-console-body font-medium text-text-primary">
          <NotebookPenIcon aria-hidden="true" className="size-4 text-text-muted" />
          Notes
        </h2>

        <div>
          <p className="text-console-label tracking-label text-text-muted uppercase">Guest&apos;s special request</p>
          <NoteText value={personalRequest} empty="No special request" />
        </div>

        <div>
          <div className="flex min-h-tap items-center justify-between gap-3">
            <p className="text-console-label tracking-label text-text-muted uppercase">Internal note</p>
            {!editing && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(internalNote ?? "");
                  setEditing(true);
                }}
              >
                <PencilIcon aria-hidden="true" />
                {internalNote?.trim() ? "Edit" : "Add note"}
              </Button>
            )}
          </div>
          {editing ? (
            <div className="mt-2 flex flex-col gap-3">
              <Textarea
                aria-label="Internal note"
                value={draft}
                maxLength={BOOKING_NOTE_MAX_LENGTH}
                rows={3}
                disabled={pending}
                placeholder="Anything the next shift needs to know"
                onChange={(event) => setDraft(event.target.value)}
                className="min-h-24 text-console-body"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" hoverEffect="sweep" disabled={pending} onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button type="button" disabled={pending} onClick={save}>
                  {pending ? "Saving…" : "Save note"}
                </Button>
              </div>
            </div>
          ) : (
            <NoteText value={internalNote} empty="No internal note" />
          )}
          <p className="mt-2 text-micro text-text-muted">Only staff see this note.</p>
        </div>
      </ConsoleCardBody>
    </ConsoleCard>
  );
}
