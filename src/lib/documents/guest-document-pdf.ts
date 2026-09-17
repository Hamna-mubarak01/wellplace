import type { GuestTaxDocument } from "@/lib/db/invoice-record";
import { creditNotePdfView } from "@/lib/documents/credit-note-pdf-view";
import { invoicePdfView } from "@/lib/documents/invoice-pdf-view";
import { renderTaxDocumentPdf, taxDocumentPdfFilename } from "@/lib/documents/tax-document-pdf";

export interface GuestDocumentPdf {
  readonly number: string;
  readonly filename: string;
  readonly pdf: Buffer;
}

export async function renderGuestDocumentPdf(document: GuestTaxDocument): Promise<GuestDocumentPdf> {
  const { bookingReference } = document;
  const [number, view] =
    document.type === "invoice"
      ? [document.invoice.invoiceNumber, invoicePdfView({ ...document.invoice, bookingReference })]
      : [document.creditNote.creditNoteNumber, creditNotePdfView({ ...document.creditNote, bookingReference })];
  return { number, filename: taxDocumentPdfFilename(number), pdf: await renderTaxDocumentPdf(view) };
}
