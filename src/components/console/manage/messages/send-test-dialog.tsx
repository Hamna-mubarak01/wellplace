"use client";

import { useState } from "react";
import { SendIcon } from "lucide-react";

import { ActionError } from "@/components/shared/action-error";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { testRecipientSchema } from "@/lib/validation/message-test";

export function SendTestDialog({
  from,
  subject,
  sending,
  sendError,
  onSendTest,
}: {
  from: string;
  subject: string;
  sending: boolean;
  sendError: string | null;
  onSendTest?: (recipientEmail: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (sending) return;
        setOpen(next);
        setValidationError(null);
        setAttempted(false);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" disabled={sending || !onSendTest}>
          <SendIcon aria-hidden="true" className="size-4" />
          Send test
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="density-console">
        <DialogHeader>
          <DialogTitle>Send a test email</DialogTitle>
          <DialogDescription>
            Choose who receives this test. It includes your latest edits and
            uses the sample details shown in the preview.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="flex min-w-0 flex-col gap-5"
          onSubmit={async (event) => {
            event.preventDefault();
            if (sending || !onSendTest) return;
            const parsed = testRecipientSchema.safeParse(email);
            if (!parsed.success) {
              setValidationError(
                "Enter one valid email address to receive the test.",
              );
              return;
            }
            setValidationError(null);
            setAttempted(true);
            if (await onSendTest(parsed.data)) setOpen(false);
          }}
        >
          <Field data-invalid={validationError ? true : undefined}>
            <FieldLabel htmlFor="test-recipient-email">
              Recipient email
            </FieldLabel>
            <Input
              id="test-recipient-email"
              name="recipientEmail"
              type="email"
              autoComplete="email"
              required
              disabled={sending}
              value={email}
              placeholder="name@example.com"
              className="min-h-tap"
              aria-invalid={validationError ? true : undefined}
              aria-describedby={
                validationError ? "test-recipient-error" : "test-recipient-hint"
              }
              onChange={(event) => {
                setEmail(event.target.value);
                setValidationError(null);
                setAttempted(false);
              }}
            />
            <FieldDescription id="test-recipient-hint">
              This test is sent only to the address you enter here.
            </FieldDescription>
            {validationError && (
              <FieldError id="test-recipient-error">
                {validationError}
              </FieldError>
            )}
          </Field>
          <dl className="grid min-w-0 grid-cols-[auto_1fr] gap-x-3 gap-y-2 rounded-(--radius-card) border border-border bg-surface-raised p-3 text-console-body">
            <dt className="text-text-muted">From</dt>
            <dd className="min-w-0 wrap-anywhere">{from}</dd>
            <dt className="text-text-muted">Subject</dt>
            <dd className="min-w-0 wrap-anywhere">[Test] {subject}</dd>
          </dl>
          {attempted && sendError && (
            <ActionError title="The test was not sent" message={sendError} />
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              hoverEffect="sweep"
              disabled={sending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={sending}>
              <SendIcon aria-hidden="true" className="size-4" />
              {sending ? "Sending…" : "Send email"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
