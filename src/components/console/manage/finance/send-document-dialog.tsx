"use client";

import { useRef, useState, useTransition } from "react";
import { PlusIcon, SendIcon, XIcon } from "lucide-react";

import { sendTaxDocument, type SendTaxDocumentResult } from "@/app/(console)/manage/finance/invoices/actions";
import { sendTaxDocumentSchema } from "@/app/(console)/manage/finance/invoices/invoice-inputs";
import { ActionError } from "@/components/shared/action-error";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/console/feedback";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { INVOICE_COPY, INVOICE_SEND } from "@/lib/config/invoice";
import type { TaxDocumentType } from "@/lib/db/invoice-record";

export interface SendDocumentDialogProps {
  documentType: TaxDocumentType;
  documentId: string;
  documentNumber: string;
  email: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Row<Value> {
  readonly id: number;
  readonly value: Value;
}


export function SendDocumentDialog({
  documentType,
  documentId,
  documentNumber,
  email,
  open,
  onOpenChange,
}: SendDocumentDialogProps) {
  const [pending, start] = useTransition();
  const nextId = useRef(1);
  const [emails, setEmails] = useState<Row<string>[]>([{ id: 0, value: email }]);
  const [error, setError] = useState<string | null>(null);

  const noun = INVOICE_COPY.documentTypes[documentType].toLowerCase();
  const idBase = `send-${documentId}`;

  function reset() {
    nextId.current = 1;
    setEmails([{ id: 0, value: email }]);
    setError(null);
  }

  function change(next: boolean) {
    if (pending) return;
    if (next) reset();
    onOpenChange(next);
  }

  function addRow() {
    const id = nextId.current++;
    setEmails((rows) => [...rows, { id, value: "" }]);
  }

  function recipients(): string[] {
    return emails.map((row) => row.value.trim()).filter((value) => value !== "");
  }

  function send() {
    if (pending) return;
    const input = { documentType, documentId, channel: "email" as const, recipients: recipients() };
    const checked = sendTaxDocumentSchema.safeParse(input);
    if (!checked.success) {
      setError(checked.error.issues[0].message);
      return;
    }
    setError(null);
    start(async () => {
      let result: SendTaxDocumentResult;
      try {
        result = await sendTaxDocument(checked.data);
      } catch (cause) {
        console.error("[console] sendTaxDocument threw:", cause);
        result = { ok: false, message: NETWORK_MESSAGE };
      }
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success(`${INVOICE_COPY.documentTypes[documentType]} ${documentNumber} sent to ${result.to.join(", ")}`);
      if (result.notSent.length > 0) {
        toast.error(`${INVOICE_COPY.documentTypes[documentType]} ${documentNumber} was not sent to ${result.notSent.join(", ")}`, {
          description: INVOICE_COPY.console.emailNotSent,
        });
      }
      onOpenChange(false);
    });
  }

  const count = emails.length;
  const atLimit = count >= INVOICE_SEND.maxRecipients;

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent
        aria-busy={pending || undefined}
        showCloseButton={!pending}
        className="max-h-dialog-max-h overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>
            Send {noun} {documentNumber}
          </DialogTitle>
          <DialogDescription>
            The PDF goes to each recipient separately and is added to the customer’s message history.
          </DialogDescription>
        </DialogHeader>

        {error && <ActionError id={`${idBase}-error`} message={error} />}

        <div className="flex flex-col gap-3 pt-2">
          {emails.map((row, index) => (
            <Field key={row.id} className="gap-2">
              <FieldLabel htmlFor={`${idBase}-email-${row.id}`}>{`Email address ${index + 1}`}</FieldLabel>
              <div className="flex min-w-0 items-center gap-2">
                <Input
                  id={`${idBase}-email-${row.id}`}
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  value={row.value}
                  disabled={pending}
                  onChange={(event) => {
                    const value = event.target.value;
                    setEmails((rows) => rows.map((item) => (item.id === row.id ? { ...item, value } : item)));
                  }}
                  className="h-control min-w-0 flex-1 text-console-body"
                />
                {emails.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    aria-label={`Remove email address ${index + 1}`}
                    onClick={() => setEmails((rows) => rows.filter((item) => item.id !== row.id))}
                  >
                    <XIcon aria-hidden="true" className="size-4" />
                  </Button>
                )}
              </div>
            </Field>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={addRow}
            disabled={pending || atLimit}
          >
            <PlusIcon aria-hidden="true" className="size-4" />
            Add email address
          </Button>
          <p className="text-micro tabular-nums text-text-muted">{`Up to ${INVOICE_SEND.maxRecipients} recipients`}</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" hoverEffect="sweep" onClick={() => change(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={send} disabled={pending}>
            <SendIcon aria-hidden="true" className="size-4" />
            {pending ? "Sending…" : `Send ${noun}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
