"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BanIcon, DownloadIcon, EllipsisVerticalIcon, EyeIcon, RefreshCwIcon, SendIcon } from "lucide-react";

import { SendDocumentDialog } from "@/components/console/manage/finance/send-document-dialog";
import { VoidInvoiceDialog } from "@/components/console/manage/finance/void-invoice-dialog";
import { Button } from "@/components/shared/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  creditNoteDownloadPath,
  creditNotePath,
  invoiceDownloadPath,
  invoicePath,
  invoiceRegeneratePath,
} from "@/lib/config/finance";
import { INVOICE_COPY } from "@/lib/config/invoice";
import type { TaxDocumentType } from "@/lib/db/invoice-record";

export interface TaxDocumentRowActionsProps {
  documentType: TaxDocumentType;
  documentId: string;
  documentNumber: string;
  email: string;
  voided: boolean;
}

export function TaxDocumentRowActions({
  documentType,
  documentId,
  documentNumber,
  email,
  voided,
}: TaxDocumentRowActionsProps) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const isInvoice = documentType === "invoice";
  const noun = INVOICE_COPY.documentTypes[documentType].toLowerCase();
  const viewHref = isInvoice ? invoicePath(documentId) : creditNotePath(documentId);
  const regenerateHref = invoiceRegeneratePath(documentId);

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={`Actions for ${noun} ${documentNumber}`}>
            <EllipsisVerticalIcon aria-hidden="true" className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem asChild className="min-h-tap">
            <Link href={viewHref}>
              <EyeIcon aria-hidden="true" />
              View {noun}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="min-h-tap">
            <a href={isInvoice ? invoiceDownloadPath(documentId) : creditNoteDownloadPath(documentId)} download>
              <DownloadIcon aria-hidden="true" />
              {INVOICE_COPY.console.downloadPdf}
            </a>
          </DropdownMenuItem>
          {!voided && (
            <DropdownMenuItem className="min-h-tap" onSelect={() => setSending(true)}>
              <SendIcon aria-hidden="true" />
              Send
            </DropdownMenuItem>
          )}
          {!voided && isInvoice && (
            <>
              <DropdownMenuItem asChild className="min-h-tap">
                <Link href={regenerateHref}>
                  <RefreshCwIcon aria-hidden="true" />
                  Regenerate
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" className="min-h-tap" onSelect={() => setVoiding(true)}>
                <BanIcon aria-hidden="true" />
                Void invoice
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {!voided && (
        <SendDocumentDialog
          documentType={documentType}
          documentId={documentId}
          documentNumber={documentNumber}
          email={email}
          open={sending}
          onOpenChange={setSending}
        />
      )}
      {!voided && isInvoice && (
        <VoidInvoiceDialog
          invoiceId={documentId}
          invoiceNumber={documentNumber}
          open={voiding}
          onOpenChange={setVoiding}
          onRegenerate={() => router.push(regenerateHref)}
        />
      )}
    </>
  );
}
