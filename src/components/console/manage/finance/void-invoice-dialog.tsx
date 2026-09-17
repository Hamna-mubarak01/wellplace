"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCwIcon } from "lucide-react";

import { voidIssuedInvoice, type InvoiceActionResult } from "@/app/(console)/manage/finance/invoices/actions";
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
import { toast } from "@/lib/console/feedback";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";

export interface VoidInvoiceDialogProps {
  invoiceId: string;
  invoiceNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegenerate: () => void;
}

export function VoidInvoiceDialog({ invoiceId, invoiceNumber, open, onOpenChange, onRegenerate }: VoidInvoiceDialogProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [hasCreditNotes, setHasCreditNotes] = useState(false);
  const fieldId = `void-invoice-reason-${invoiceId}`;

  function change(next: boolean) {
    if (pending) return;
    if (!next) {
      setReason("");
      setError(undefined);
      setHasCreditNotes(false);
    }
    onOpenChange(next);
  }

  function regenerate() {
    change(false);
    onRegenerate();
  }

  function submit() {
    if (pending) return;
    if (reason.trim() === "") {
      setError("Enter why this invoice is being voided.");
      return;
    }
    setError(undefined);
    start(async () => {
      let result: InvoiceActionResult;
      try {
        result = await voidIssuedInvoice({ invoiceId, reason });
      } catch (cause) {
        console.error("[console] voidIssuedInvoice threw:", cause);
        result = { ok: false, message: NETWORK_MESSAGE };
      }
      if (result.ok) {
        toast.success(`Invoice ${invoiceNumber} voided`);
        setReason("");
        onOpenChange(false);
        router.refresh();
        return;
      }
      setHasCreditNotes(result.hasCreditNotes === true);
      setError(result.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-h-dialog-max-h overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Void invoice {invoiceNumber}?</DialogTitle>
          <DialogDescription>
            Void is for genuine mistakes. The invoice keeps its number and stays on record, marked as void, and the
            booking returns to Missing invoices.
          </DialogDescription>
        </DialogHeader>

        <ReasonField id={fieldId} value={reason} onChange={setReason} error={error} disabled={pending} />

        {hasCreditNotes && (
          <Button type="button" variant="outline" onClick={regenerate} className="self-start">
            <RefreshCwIcon aria-hidden="true" className="size-4" />
            Regenerate instead
          </Button>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" hoverEffect="sweep" onClick={() => change(false)} disabled={pending}>
            Keep invoice
          </Button>
          <Button type="button" variant="destructive" onClick={submit} disabled={pending || hasCreditNotes}>
            {pending ? "Voiding…" : "Void invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
