import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BanIcon, FileMinusIcon, FileTextIcon, ListIcon, Undo2Icon, UserRoundIcon } from "lucide-react";

import { ConsolePage } from "@/components/console/console-page";
import { ConsoleNotice } from "@/components/console/console-surface";
import { CreditNoteDocumentActions } from "@/components/console/manage/finance/credit-note-document-actions";
import { INVOICE_STATE_LABEL, INVOICE_STATE_TONE, financeDay } from "@/components/console/manage/finance/finance-labels";
import { LedgerLink } from "@/components/console/manage/finance/ledger-link";
import { ConsoleDataTable, type ConsoleColumn } from "@/components/console/shared/console-data-table";
import { DetailField } from "@/components/console/shared/detail-field";
import { DetailFieldGrid } from "@/components/console/shared/detail-field-grid";
import { DetailSection } from "@/components/console/shared/detail-section";
import { MoneyValue } from "@/components/console/shared/money-value";
import { StatusChip } from "@/components/console/shared/status-chip";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import { formatAed } from "@/components/shared/money";
import { requireManagement } from "@/lib/auth/session";
import { FINANCE_PATH, invoicePath, managedBookingPath, managedCustomerPath } from "@/lib/config/finance";
import { INVOICE_COPY } from "@/lib/config/invoice";
import type { CreditNoteLine } from "@/lib/db/invoice-record";
import { findCreditNote } from "@/lib/db/queries/invoices";
import { createClient } from "@/lib/db/server";
import { invoiceTaxLabel, paymentMethodLabel } from "@/lib/messaging/templates/invoice";
import { formatDubaiTime } from "@/lib/domain/time";

export const metadata: Metadata = {
  title: "Tax credit note",
  robots: { index: false, follow: false },
};

const BACK = { backHref: FINANCE_PATH.invoices, backLabel: "Back to invoices" } as const;
function stamp(instant: string): string {
  return `${financeDay(instant)} · ${formatDubaiTime(instant)}`;
}

type CreditedLine = CreditNoteLine & { readonly key: string };

const LINE_COLUMNS: readonly ConsoleColumn<CreditedLine>[] = [
  {
    id: "description",
    header: "Description",
    wrap: true,
    cell: (line) => <span className="text-pretty break-words">{line.label}</span>,
  },
  {
    id: "quantity",
    header: "Qty",
    align: "end",
    cell: (line) => <span className="font-data tabular-nums">{line.quantity}</span>,
  },
  {
    id: "unit",
    header: "Unit price",
    align: "end",
    cell: (line) => <MoneyValue fils={line.unitPriceFils} />,
  },
  {
    id: "rate",
    header: "VAT rate",
    align: "end",
    cell: (line) => (
      <span className="font-data tabular-nums text-text-secondary">
        {line.vatRatePercent === null ? "None" : `${line.vatRatePercent}%`}
      </span>
    ),
  },
  {
    id: "vat",
    header: "VAT",
    align: "end",
    cell: (line) => <MoneyValue fils={line.vatFils} className="text-text-secondary" />,
  },
  {
    id: "amount",
    header: "Amount credited",
    align: "end",
    cell: (line) => <MoneyValue fils={line.amountFils} />,
  },
];

export default async function FinanceCreditNotePage({ params }: { params: Promise<{ id: string }> }) {
  await requireManagement();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const lookup = await findCreditNote(await createClient(), id);
  if (lookup.outcome === "not_found") notFound();
  if (lookup.outcome === "failed") {
    return (
      <ConsolePage title="Tax credit note" {...BACK}>
        <ConsoleReadError title="This credit note could not be loaded" message={lookup.message} />
      </ConsolePage>
    );
  }

  const note = lookup.creditNote;
  const voided = note.state === "voided";
  const addressLines = (note.billTo.address ?? "").split(/\r?\n/).filter((line) => line.trim() !== "");

  return (
    <ConsolePage
      title={note.creditNoteNumber}
      {...BACK}
      meta={[
        <LedgerLink key="invoice" href={invoicePath(note.invoiceId)}>
          {`Credits ${note.invoiceNumber}`}
        </LedgerLink>,
        <LedgerLink key="booking" href={managedBookingPath(note.bookingId)}>
          {`Booking ${note.bookingReference}`}
        </LedgerLink>,
        <LedgerLink key="customer" href={managedCustomerPath(note.customerId)}>
          {[note.customerName || "Customer", note.customerReference].filter(Boolean).join(" · ")}
        </LedgerLink>,
        note.issuedByName ? `Issued by ${note.issuedByName}` : null,
      ]}
      status={
        <span className="flex flex-wrap gap-1">
          <StatusChip tone={INVOICE_STATE_TONE[note.state]}>{INVOICE_STATE_LABEL[note.state]}</StatusChip>
          {note.isTest && <StatusChip tone="warning">Test</StatusChip>}
        </span>
      }
      actions={
        <CreditNoteDocumentActions
          creditNoteId={note.id}
          creditNoteNumber={note.creditNoteNumber}
          email={note.billTo.email}
          phoneE164={note.billTo.phoneE164}
          voided={voided}
        />
      }
    >
      {voided && (
        <ConsoleNotice tone="warning" Icon={BanIcon}>
          {`This credit note is void. It was voided on ${note.voidedAt ? financeDay(note.voidedAt) : "an unknown date"}${
            note.voidedByName ? ` by ${note.voidedByName}` : ""
          }${note.voidReason ? `. Reason: ${note.voidReason}` : "."}`}
        </ConsoleNotice>
      )}

      <DetailSection
        title="What was credited"
        Icon={ListIcon}
        flush
        actions={
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-console-body">
            <div className="flex gap-2">
              <dt className="text-text-muted">{invoiceTaxLabel(note.tax)}</dt>
              <dd className="font-data tabular-nums text-text-primary">{formatAed(note.taxFils)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-text-muted">Total credited</dt>
              <dd className="font-data font-semibold tabular-nums text-text-primary">{formatAed(note.amountFils)}</dd>
            </div>
          </dl>
        }
      >
        <ConsoleDataTable
          label={`Lines credited by ${note.creditNoteNumber}`}
          framed={false}
          columns={LINE_COLUMNS}
          rows={note.lines.map((line, index) => ({ ...line, key: `${line.kind}-${index}` }))}
          rowKey={(line) => line.key}
          empty={{
            title: "No lines",
            description: "This credit note has no itemised lines. The total above is what was credited.",
            Icon: ListIcon,
          }}
        />
      </DetailSection>

      <DetailSection title="Original invoice" Icon={FileTextIcon}>
        <DetailFieldGrid columns={3}>
          <DetailField
            label="Invoice number"
            value={
              <LedgerLink href={invoicePath(note.invoiceId)} data>
                {note.invoiceNumber}
              </LedgerLink>
            }
          />
          <DetailField label="Invoice issued" value={stamp(note.invoiceIssuedAt)} data />
          <DetailField label="Visit date (date of supply)" value={financeDay(note.supplyDate)} data />
        </DetailFieldGrid>
      </DetailSection>

      <DetailSection title="Refund" Icon={Undo2Icon}>
        <DetailFieldGrid columns={3}>
          <DetailField label="Refund number" value={note.refund.reference} data />
          <DetailField label="Refund requested" value={stamp(note.refund.requestedAt)} data />
          <DetailField label="Money returned" value={stamp(note.refund.settledAt)} data />
          <DetailField
            label="Paid back to"
            value={[paymentMethodLabel(note.refund.paymentMethod), note.refund.paymentReference].filter(Boolean).join(" · ")}
          />
          <DetailField label="Reason for the refund" value={note.reason} span={2} />
        </DetailFieldGrid>
      </DetailSection>

      <DetailSection title="This credit note" Icon={FileMinusIcon}>
        <DetailFieldGrid columns={3}>
          <DetailField label="Credit note issued" value={stamp(note.issuedAt)} data />
          <DetailField label="Issued by" value={note.issuedByName ?? "Issued automatically"} />
          <DetailField label="Amount credited" value={<MoneyValue fils={note.amountFils} />} />
          <DetailField label={invoiceTaxLabel(note.tax)} value={<MoneyValue fils={note.taxFils} />} />
          <DetailField label={INVOICE_COPY.labels.taxable} value={<MoneyValue fils={note.taxableFils} />} />
        </DetailFieldGrid>
      </DetailSection>

      <DetailSection title={INVOICE_COPY.labels.billTo} Icon={UserRoundIcon}>
        <DetailFieldGrid columns={3}>
          <DetailField label="Name" value={note.billTo.name} />
          <DetailField label={INVOICE_COPY.labels.email} value={note.billTo.email} />
          <DetailField label={INVOICE_COPY.labels.phone} value={note.billTo.phoneE164} data />
          {note.billTo.company && <DetailField label={INVOICE_COPY.labels.company} value={note.billTo.company} />}
          {note.billTo.trn && <DetailField label="Customer TRN" value={note.billTo.trn} data />}
          {addressLines.length > 0 && <DetailField label={INVOICE_COPY.labels.address} value={addressLines.join(", ")} />}
        </DetailFieldGrid>
      </DetailSection>
    </ConsolePage>
  );
}
