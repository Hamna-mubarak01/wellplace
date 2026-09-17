"use client";

import { useState } from "react";
import { DownloadIcon, SendIcon } from "lucide-react";

import { SendDocumentDialog } from "@/components/console/manage/finance/send-document-dialog";
import { Button } from "@/components/shared/button";
import { creditNoteDownloadPath } from "@/lib/config/finance";
import { INVOICE_COPY } from "@/lib/config/invoice";

export interface CreditNoteDocumentActionsProps {
  creditNoteId: string;
  creditNoteNumber: string;
  email: string;
  phoneE164: string;
  voided: boolean;
}

export function CreditNoteDocumentActions({
  creditNoteId,
  creditNoteNumber,
  email,
  voided,
}: CreditNoteDocumentActionsProps) {
  const [sending, setSending] = useState(false);

  return (
    <>
      <Button asChild variant="outline">
        <a href={creditNoteDownloadPath(creditNoteId)} download>
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
          <SendDocumentDialog
            documentType="credit_note"
            documentId={creditNoteId}
            documentNumber={creditNoteNumber}
            email={email}
            open={sending}
            onOpenChange={setSending}
          />
        </>
      )}
    </>
  );
}
