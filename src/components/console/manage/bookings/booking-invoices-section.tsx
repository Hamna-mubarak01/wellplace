import type { ReactNode } from "react";
import { FileTextIcon } from "lucide-react";

import { ConsoleDataTable, type ConsoleColumn } from "@/components/console/shared/console-data-table";
import { MoneyValue } from "@/components/console/shared/money-value";
import { StatusChip } from "@/components/console/shared/status-chip";
import { creditNotePath, invoicePath } from "@/lib/config/finance";
import { INVOICE_COPY } from "@/lib/config/invoice";
import type { InvoiceSummary } from "@/lib/db/queries/invoices";
import type { Paged } from "@/lib/db/queries/paging";
import { formatDubaiDateTime } from "@/lib/domain/time";

export interface BookingInvoicesSectionProps {
  documents: Paged<InvoiceSummary>;
  action?: ReactNode;
}

function isCreditNote(document: InvoiceSummary): boolean {
  return document.documentType === "credit_note";
}

function typeLabel(document: InvoiceSummary): string {
  return INVOICE_COPY.documentTypes[document.documentType ?? "invoice"];
}

const COLUMNS: readonly ConsoleColumn<InvoiceSummary>[] = [
  {
    id: "type",
    header: "Type",
    cell: (document) => <span className="whitespace-nowrap">{typeLabel(document)}</span>,
  },
  {
    id: "number",
    header: "Number",
    cell: (document) => (
      <>
        <span className="block font-data tabular-nums whitespace-nowrap">{document.invoiceNumber}</span>
        {document.originalInvoiceNumber && (
          <span className="block font-data text-micro tabular-nums text-text-secondary">
            Credits {document.originalInvoiceNumber}
          </span>
        )}
      </>
    ),
  },
  {
    id: "issued",
    header: "Issued",
    cell: (document) => (
      <>
        <span className="block whitespace-nowrap">{formatDubaiDateTime(document.issuedAt)}</span>
        {document.issuedByName && (
          <span className="block text-micro text-text-secondary">By {document.issuedByName}</span>
        )}
      </>
    ),
  },
  {
    id: "state",
    header: "Status",
    cell: (document) => (
      <span className="flex flex-wrap items-center gap-1.5">
        {document.state === "voided" ? (
          <StatusChip tone="neutral">Voided</StatusChip>
        ) : (
          <StatusChip tone="success">Issued</StatusChip>
        )}
        {document.isTest && <StatusChip tone="info">Test</StatusChip>}
      </span>
    ),
  },
  {
    id: "total",
    header: "Total",
    align: "end",
    cell: (document) => <MoneyValue fils={isCreditNote(document) ? -document.totalFils : document.totalFils} />,
  },
];

export function BookingInvoicesSection({ documents, action }: BookingInvoicesSectionProps) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {action && <div className="flex flex-wrap items-center justify-end gap-2">{action}</div>}
      <ConsoleDataTable
        label="Invoices and credit notes for this booking"
        columns={COLUMNS}
        rows={documents.ok ? documents.rows : []}
        rowKey={(document) => document.id}
        rowHref={(document) => (isCreditNote(document) ? creditNotePath(document.id) : invoicePath(document.id))}
        rowLabel={(document) => `Open ${typeLabel(document).toLowerCase()} ${document.invoiceNumber}`}
        error={
          documents.ok ? null : { title: "Invoices and credit notes could not be loaded", message: documents.message }
        }
        empty={{
          title: "No invoices or credit notes for this booking",
          description:
            "A tax invoice is issued here automatically once the booking is fully paid, and a credit note once a refund is settled.",
          Icon: FileTextIcon,
        }}
      />
    </div>
  );
}
