import { FileCheckIcon, ReceiptIcon, ReceiptTextIcon } from "lucide-react";

import {
  bookingHref,
  documentTitle,
  formatDubaiDate,
  invoiceHref,
  receiptHref,
  type CustomerReceipt,
} from "@/components/console/manage/customers/customer-view";
import { ConsoleDataTable, type ConsoleColumn } from "@/components/console/shared/console-data-table";
import { DetailSection } from "@/components/console/shared/detail-section";
import { MoneyValue } from "@/components/console/shared/money-value";
import { StatusChip } from "@/components/console/shared/status-chip";
import { creditNotePath } from "@/lib/config/finance";
import { INVOICE_COPY } from "@/lib/config/invoice";
import type { TaxDocumentType } from "@/lib/db/invoice-record";
import type { InvoiceSummary } from "@/lib/db/queries/invoices";
import type { AcceptanceDocument, InvoiceDocument } from "@/lib/db/queries/management-customers";
import type { Paged } from "@/lib/db/queries/paging";
import { formatDubaiTime } from "@/lib/domain/time";

function dateAndTime(instant: string) {
  return (
    <span className="flex flex-col gap-0.5">
      <span>{formatDubaiDate(instant)}</span>
      <span className="font-data text-micro tabular-nums text-text-secondary">{formatDubaiTime(instant)}</span>
    </span>
  );
}

const ACCEPTANCE_COLUMNS: readonly ConsoleColumn<AcceptanceDocument>[] = [
  {
    id: "document",
    header: "Document",
    wrap: true,
    cell: (row) => documentTitle(row.documentSlug),
  },
  {
    id: "version",
    header: "Version",
    cell: (row) => <span className="font-data tabular-nums">{row.documentVersion}</span>,
  },
  {
    id: "accepted",
    header: "Accepted",
    cell: (row) => dateAndTime(row.acceptedAt),
  },
  {
    id: "booking",
    header: "Booking",
    cell: (row) => <span className="font-data tabular-nums">{row.bookingReference}</span>,
  },
];

interface TaxDocumentRow {
  id: string;
  type: TaxDocumentType;
  number: string;
  issuedAt: string;
  bookingId: string;
  bookingReference: string;
  state: InvoiceDocument["state"];
  totalFils: number;
}

function taxDocumentRows(invoices: readonly InvoiceDocument[], creditNotes: Paged<InvoiceSummary>): TaxDocumentRow[] {
  const invoiceRows = invoices.map((row): TaxDocumentRow => ({ ...row, type: "invoice", number: row.invoiceNumber }));
  const creditNoteRows = (creditNotes.ok ? creditNotes.rows : []).map(
    (row): TaxDocumentRow => ({
      id: row.id,
      type: "credit_note",
      number: row.invoiceNumber,
      issuedAt: row.issuedAt,
      bookingId: row.bookingId,
      bookingReference: row.bookingReference,
      state: row.state,
      totalFils: -row.totalFils,
    }),
  );
  return [...invoiceRows, ...creditNoteRows].sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt));
}

const INVOICE_COLUMNS: readonly ConsoleColumn<TaxDocumentRow>[] = [
  {
    id: "type",
    header: "Type",
    cell: (row) => <span className="whitespace-nowrap">{INVOICE_COPY.documentTypes[row.type]}</span>,
  },
  {
    id: "number",
    header: "Number",
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="font-data tabular-nums">{row.number}</span>
        {row.state === "voided" && <StatusChip tone="neutral">Voided</StatusChip>}
      </span>
    ),
  },
  {
    id: "date",
    header: "Date",
    cell: (row) => formatDubaiDate(row.issuedAt),
  },
  {
    id: "booking",
    header: "Booking",
    cell: (row) => <span className="font-data tabular-nums">{row.bookingReference}</span>,
  },
  {
    id: "total",
    header: "Total",
    align: "end",
    cell: (row) => <MoneyValue fils={row.totalFils} />,
  },
];

const RECEIPT_COLUMNS: readonly ConsoleColumn<CustomerReceipt>[] = [
  {
    id: "booking",
    header: "Receipt for booking",
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="font-data tabular-nums">{row.bookingReference}</span>
        {row.simulated && <StatusChip tone="neutral">Simulation</StatusChip>}
      </span>
    ),
  },
  {
    id: "paid",
    header: "Last payment",
    cell: (row) => formatDubaiDate(row.lastPaidAt),
  },
  {
    id: "received",
    header: "Received",
    align: "end",
    cell: (row) => <MoneyValue fils={row.receivedFils} />,
  },
];

export interface CustomerDocumentsProps {
  acceptances: readonly AcceptanceDocument[];
  invoices: readonly InvoiceDocument[];
  creditNotes: Paged<InvoiceSummary>;
  receipts: readonly CustomerReceipt[];
  shownDocuments: number;
  totalDocuments: number;
  receiptsComplete: boolean;
}

export function CustomerDocuments({
  acceptances,
  invoices,
  creditNotes,
  receipts,
  shownDocuments,
  totalDocuments,
  receiptsComplete,
}: CustomerDocumentsProps) {
  const taxDocuments = taxDocumentRows(invoices, creditNotes);
  const notes = [
    shownDocuments < totalDocuments
      ? `Showing the latest ${shownDocuments.toLocaleString("en-AE")} of ${totalDocuments.toLocaleString("en-AE")} accepted terms and invoices.`
      : null,
    creditNotes.ok && creditNotes.rows.length < creditNotes.total
      ? `Showing the latest ${creditNotes.rows.length.toLocaleString("en-AE")} of ${creditNotes.total.toLocaleString("en-AE")} credit notes.`
      : null,
    creditNotes.ok ? null : "Credit notes could not be loaded, so only invoices are listed. Reload the page to try again.",
    receiptsComplete ? null : "Receipts are listed for the latest payments only.",
  ].filter((note): note is string => note !== null);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DetailSection title="Accepted terms" Icon={FileCheckIcon} count={acceptances.length} flush>
        <ConsoleDataTable
          label="Terms this customer accepted"
          framed={false}
          columns={ACCEPTANCE_COLUMNS}
          rows={acceptances}
          rowKey={(row) => row.id}
          rowHref={(row) => bookingHref(row.bookingId)}
          rowLabel={(row) => `Open booking ${row.bookingReference}`}
          empty={{
            title: "No accepted terms on file",
            description: "Terms are recorded when a guest accepts them for a booking.",
            Icon: FileCheckIcon,
          }}
        />
      </DetailSection>

      <DetailSection title="Invoices and credit notes" Icon={ReceiptTextIcon} count={taxDocuments.length} flush>
        <ConsoleDataTable
          label="Invoices and credit notes for this customer’s bookings"
          framed={false}
          columns={INVOICE_COLUMNS}
          rows={taxDocuments}
          rowKey={(row) => row.id}
          rowHref={(row) => (row.type === "credit_note" ? creditNotePath(row.id) : invoiceHref(row.id))}
          rowLabel={(row) => `Open ${INVOICE_COPY.documentTypes[row.type].toLowerCase()} ${row.number}`}
          empty={{
            title: "No invoices or credit notes yet",
            description: "Invoices and credit notes issued for this customer’s bookings appear here.",
            Icon: ReceiptTextIcon,
          }}
        />
      </DetailSection>

      <DetailSection title="Receipts" Icon={ReceiptIcon} count={receipts.length} flush>
        <ConsoleDataTable
          label="Receipts for bookings this customer paid for"
          framed={false}
          columns={RECEIPT_COLUMNS}
          rows={receipts}
          rowKey={(row) => row.bookingId}
          rowHref={(row) => receiptHref(row.bookingId)}
          rowLabel={(row) => `Open the receipt for booking ${row.bookingReference}`}
          empty={{
            title: "No receipts yet",
            description: "A receipt is available for each booking once a payment is received.",
            Icon: ReceiptIcon,
          }}
        />
      </DetailSection>

      {notes.length > 0 && <p className="text-console-table text-text-secondary">{notes.join(" ")}</p>}
    </div>
  );
}
