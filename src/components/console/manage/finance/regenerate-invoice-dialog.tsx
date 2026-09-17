"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { regenerateTaxInvoice, type IssueInvoiceResult } from "@/app/(console)/manage/finance/invoices/actions";
import { regenerateInvoiceSchema } from "@/app/(console)/manage/finance/invoices/invoice-inputs";
import { InvoiceSettingsNotice } from "@/components/console/manage/finance/invoice-settings-notice";
import { ActionError } from "@/components/shared/action-error";
import { Button } from "@/components/shared/button";
import { ReasonField } from "@/components/shared/reason-field";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/console/feedback";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { invoicePath } from "@/lib/config/finance";
import { INVOICE_BILL_TO_LIMITS, INVOICE_COPY } from "@/lib/config/invoice";

export interface RegenerateBillTo {
  name: string;
  company: string | null;
  trn: string | null;
  address: string | null;
}

export interface RegenerateInvoiceDialogProps {
  invoiceId: string;
  invoiceNumber: string;
  billTo: RegenerateBillTo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Draft {
  reason: string;
  name: string;
  company: string;
  trn: string;
  address: string;
}

function draftFrom(billTo: RegenerateBillTo): Draft {
  return {
    reason: "",
    name: billTo.name,
    company: billTo.company ?? "",
    trn: billTo.trn ?? "",
    address: billTo.address ?? "",
  };
}

export function RegenerateInvoiceDialog({ invoiceId, invoiceNumber, billTo, open, onOpenChange }: RegenerateInvoiceDialogProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(billTo));
  const [error, setError] = useState<string | null>(null);
  const [settingsBlocked, setSettingsBlocked] = useState<string | null>(null);
  const id = `regenerate-${invoiceId}`;

  function change(next: boolean) {
    if (pending) return;
    if (next) {
      setDraft(draftFrom(billTo));
      setError(null);
      setSettingsBlocked(null);
    }
    onOpenChange(next);
  }

  function update(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function submit() {
    if (pending) return;
    const checked = regenerateInvoiceSchema.safeParse({
      invoiceId,
      reason: draft.reason,
      billTo: { name: draft.name, company: draft.company, trn: draft.trn, address: draft.address },
    });
    if (!checked.success) {
      setError(checked.error.issues[0].message);
      return;
    }
    setError(null);
    setSettingsBlocked(null);
    start(async () => {
      let result: IssueInvoiceResult;
      try {
        result = await regenerateTaxInvoice(checked.data);
      } catch (cause) {
        console.error("[console] regenerateTaxInvoice threw:", cause);
        result = { ok: false, reason: "failed", message: NETWORK_MESSAGE };
      }
      if (result.ok) {
        toast.success(`Invoice ${result.invoice.number} issued`, { description: `It replaces ${invoiceNumber}.` });
        onOpenChange(false);
        router.push(invoicePath(result.invoice.id));
        return;
      }
      if (result.reason === "settings_incomplete") {
        setSettingsBlocked(result.message);
        return;
      }
      setError(result.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent
        aria-busy={pending || undefined}
        showCloseButton={!pending}
        className="max-h-dialog-max-h overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>Regenerate invoice {invoiceNumber}?</DialogTitle>
          <DialogDescription>{INVOICE_COPY.console.regenerateHint}</DialogDescription>
        </DialogHeader>

        {settingsBlocked !== null && <InvoiceSettingsNotice message={settingsBlocked} />}
        {error && <ActionError id={`${id}-error`} message={error} />}

        <ReasonField id={`${id}-reason`} value={draft.reason} onChange={(value) => update("reason", value)} disabled={pending} />

        <Field className="gap-2">
          <FieldLabel htmlFor={`${id}-name`}>Bill to</FieldLabel>
          <Input
            id={`${id}-name`}
            value={draft.name}
            maxLength={INVOICE_BILL_TO_LIMITS.name}
            disabled={pending}
            onChange={(event) => update("name", event.target.value)}
            className="h-control text-console-body"
          />
        </Field>

        <Field className="gap-2">
          <FieldLabel htmlFor={`${id}-company`}>Company</FieldLabel>
          <Input
            id={`${id}-company`}
            value={draft.company}
            maxLength={INVOICE_BILL_TO_LIMITS.company}
            disabled={pending}
            onChange={(event) => update("company", event.target.value)}
            className="h-control text-console-body"
          />
        </Field>

        <Field className="gap-2">
          <FieldLabel htmlFor={`${id}-trn`}>Customer TRN</FieldLabel>
          <Input
            id={`${id}-trn`}
            value={draft.trn}
            inputMode="numeric"
            autoComplete="off"
            disabled={pending}
            onChange={(event) => update("trn", event.target.value)}
            className="h-control font-data text-console-body tabular-nums"
          />
        </Field>

        <Field className="gap-2">
          <FieldLabel htmlFor={`${id}-address`}>Address</FieldLabel>
          <Textarea
            id={`${id}-address`}
            value={draft.address}
            rows={3}
            maxLength={INVOICE_BILL_TO_LIMITS.address}
            disabled={pending}
            onChange={(event) => update("address", event.target.value)}
            className="resize-none text-console-body"
          />
        </Field>

        <DialogFooter>
          <Button type="button" variant="ghost" hoverEffect="sweep" onClick={() => change(false)} disabled={pending}>
            Keep invoice
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "Regenerating…" : "Regenerate invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
