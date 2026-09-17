"use client";

import { useState } from "react";
import { BanIcon, DownloadIcon, PrinterIcon, RefreshCwIcon, SendIcon } from "lucide-react";

import {
  RegenerateInvoiceDialog,
  type RegenerateBillTo,
} from "@/components/console/manage/finance/regenerate-invoice-dialog";
import { SendDocumentDialog } from "@/components/console/manage/finance/send-document-dialog";
import { VoidInvoiceDialog } from "@/components/console/manage/finance/void-invoice-dialog";
import { Button } from "@/components/shared/button";
import { toast } from "@/lib/console/feedback";
import { invoiceDownloadPath } from "@/lib/config/finance";
import { INVOICE_COPY } from "@/lib/config/invoice";

export interface InvoiceDocumentActionsProps {
  invoiceId: string;
  invoiceNumber: string;
  email: string;
  phoneE164: string;
  billTo: RegenerateBillTo;
  voided: boolean;
  hasCreditNotes: boolean;
  documentHtml: string;
  openRegenerate?: boolean;
}

function openPrintWindow(html: string): boolean {
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const target = window.open(url, "_blank");
  if (target === null) {
    URL.revokeObjectURL(url);
    return false;
  }
  target.addEventListener(
    "load",
    () => {
      target.focus();
      target.print();
      URL.revokeObjectURL(url);
    },
    { once: true },
  );
  return true;
}

export function InvoiceDocumentActions({
  invoiceId,
  invoiceNumber,
  email,
  billTo,
  voided,
  hasCreditNotes,
  documentHtml,
  openRegenerate = false,
}: InvoiceDocumentActionsProps) {
  const [sending, setSending] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [regenerating, setRegenerating] = useState(openRegenerate && !voided);

  function print() {
    if (!openPrintWindow(documentHtml)) {
      toast.error("The print window did not open", {
        description: "Allow pop-ups for this site and try again, or download the invoice and print it from there.",
      });
    }
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={print}>
        <PrinterIcon aria-hidden="true" className="size-4" />
        Print
      </Button>
      <Button asChild variant="outline">
        <a href={invoiceDownloadPath(invoiceId)} download>
          <DownloadIcon aria-hidden="true" className="size-4" />
          {INVOICE_COPY.console.downloadPdf}
        </a>
      </Button>
      {!voided && (
        <>
          <Button type="button" variant="outline" onClick={() => setSending(true)}>
            <SendIcon aria-hidden="true" className="size-4" />
            Send
          </Button>
          <Button type="button" variant="outline" onClick={() => setRegenerating(true)}>
            <RefreshCwIcon aria-hidden="true" className="size-4" />
            Regenerate
          </Button>
          {!hasCreditNotes && (
            <Button type="button" variant="ghost" tone="danger" onClick={() => setVoiding(true)}>
              <BanIcon aria-hidden="true" className="size-4" />
              Void invoice
            </Button>
          )}
          <SendDocumentDialog
            documentType="invoice"
            documentId={invoiceId}
            documentNumber={invoiceNumber}
            email={email}
            open={sending}
            onOpenChange={setSending}
          />
          <RegenerateInvoiceDialog
            invoiceId={invoiceId}
            invoiceNumber={invoiceNumber}
            billTo={billTo}
            open={regenerating}
            onOpenChange={setRegenerating}
          />
          <VoidInvoiceDialog
            invoiceId={invoiceId}
            invoiceNumber={invoiceNumber}
            open={voiding}
            onOpenChange={setVoiding}
            onRegenerate={() => setRegenerating(true)}
          />
        </>
      )}
    </>
  );
}
