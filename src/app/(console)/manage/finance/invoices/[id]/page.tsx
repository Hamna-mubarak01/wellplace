import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BanIcon, FileMinusIcon } from "lucide-react";

import { single, type FinanceSearchParams } from "@/app/(console)/manage/finance/finance-query";
import { ConsolePage } from "@/components/console/console-page";
import { ConsoleNotice } from "@/components/console/console-surface";
import { INVOICE_STATE_LABEL, INVOICE_STATE_TONE, financeDay } from "@/components/console/manage/finance/finance-labels";
import { InvoiceDocument } from "@/components/console/manage/finance/invoice-document";
import { InvoiceDocumentActions } from "@/components/console/manage/finance/invoice-document-actions";
import { IssueInvoiceButton } from "@/components/console/manage/finance/issue-invoice-button";
import { LedgerLink } from "@/components/console/manage/finance/ledger-link";
import { ConsoleDataTable, type ConsoleColumn } from "@/components/console/shared/console-data-table";
import { DetailSection } from "@/components/console/shared/detail-section";
import { MoneyValue } from "@/components/console/shared/money-value";
import { StatusChip } from "@/components/console/shared/status-chip";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import { formatAed } from "@/components/shared/money";
import { requireManagement } from "@/lib/auth/session";
import {
  FINANCE_PATH,
  INVOICE_ACTION_PARAM,
  INVOICE_REGENERATE_ACTION,
  creditNotePath,
  invoicePath,
  managedBookingPath,
  managedCustomerPath,
} from "@/lib/config/finance";
import { MANAGEMENT_LIST } from "@/lib/config/management-lists";
import { findInvoice, listBookingInvoices, listInvoices, type InvoiceSummary } from "@/lib/db/queries/invoices";
import { createClient } from "@/lib/db/server";
import { invoiceDocument, renderInvoiceDocumentHtml } from "@/lib/messaging/templates/invoice";

export const metadata: Metadata = {
  title: "Tax invoice",
  robots: { index: false, follow: false },
};

const BACK = { backHref: FINANCE_PATH.invoices, backLabel: "Back to invoices" } as const;

const CREDIT_NOTE_COLUMNS: readonly ConsoleColumn<InvoiceSummary>[] = [
  {
    id: "number",
    header: "Credit note",
    cell: (row) => <span className="font-data tabular-nums whitespace-nowrap">{row.invoiceNumber}</span>,
  },
  {
    id: "issued",
    header: "Issued",
    cell: (row) => <span className="whitespace-nowrap">{financeDay(row.issuedAt)}</span>,
  },
  {
    id: "amount",
    header: "Amount",
    align: "end",
    cell: (row) => <MoneyValue fils={row.totalFils} />,
  },
  {
    id: "vat",
    header: "VAT",
    align: "end",
    cell: (row) => <MoneyValue fils={row.taxFils} className="text-text-secondary" />,
  },
  {
    id: "state",
    header: "State",
    cell: (row) => <StatusChip tone={INVOICE_STATE_TONE[row.state]}>{INVOICE_STATE_LABEL[row.state]}</StatusChip>,
  },
];

export default async function FinanceInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<FinanceSearchParams>;
}) {
  await requireManagement();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();

  const client = await createClient();
  const lookup = await findInvoice(client, id);
  if (lookup.outcome === "not_found") notFound();
  if (lookup.outcome === "failed") {
    return (
      <ConsolePage title="Tax invoice" {...BACK}>
        <ConsoleReadError title="This invoice could not be loaded" message={lookup.message} />
      </ConsolePage>
    );
  }

  const invoice = lookup.invoice;
  const voided = invoice.state === "voided";
  const document = invoiceDocument(invoice);
  const documentHtml = renderInvoiceDocumentHtml(document);

  const [creditNotes, replaced, bookingInvoices] = await Promise.all([
    listInvoices(client, {
      invoiceId: invoice.id,
      type: "credit_note",
      page: 1,
      pageSize: MANAGEMENT_LIST.bookingInvoicesLimit,
    }),
    invoice.replacesInvoiceId ? findInvoice(client, invoice.replacesInvoiceId) : Promise.resolve(null),
    voided ? listBookingInvoices(client, invoice.bookingId) : Promise.resolve(null),
  ]);

  const liveInvoices = bookingInvoices?.ok ? bookingInvoices.rows.filter((row) => row.state === "issued") : [];
  const replacement = liveInvoices.find((row) => row.replacesInvoiceId === invoice.id) ?? null;
  const live = replacement ?? liveInvoices[0] ?? null;
  const validCreditNotes = creditNotes.ok ? creditNotes.rows.filter((row) => row.state === "issued").length : 0;
  const credited = invoice.creditedFils ?? 0;
  const hasCreditNotes = validCreditNotes > 0 || credited > 0;

  return (
    <ConsolePage
      title={invoice.invoiceNumber}
      {...BACK}
      meta={[
        <LedgerLink key="booking" href={managedBookingPath(invoice.bookingId)}>
          {`Booking ${invoice.bookingReference}`}
        </LedgerLink>,
        <LedgerLink key="customer" href={managedCustomerPath(invoice.customerId)}>
          {[invoice.customerName || "Customer", invoice.customerReference].filter(Boolean).join(" · ")}
        </LedgerLink>,
        replaced?.outcome === "found" ? (
          <LedgerLink key="replaces" href={invoicePath(replaced.invoice.id)}>
            {`Replaces ${replaced.invoice.invoiceNumber}`}
          </LedgerLink>
        ) : null,
        invoice.issuedByName ? `Issued by ${invoice.issuedByName}` : null,
      ]}
      status={
        <span className="flex flex-wrap gap-1">
          <StatusChip tone={INVOICE_STATE_TONE[invoice.state]}>{INVOICE_STATE_LABEL[invoice.state]}</StatusChip>
          {invoice.isTest && <StatusChip tone="warning">Test</StatusChip>}
        </span>
      }
      actions={
        <InvoiceDocumentActions
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoiceNumber}
          email={invoice.billTo.email}
          phoneE164={invoice.billTo.phoneE164}
          billTo={{
            name: invoice.billTo.name,
            company: invoice.billTo.company ?? null,
            trn: invoice.billTo.trn ?? null,
            address: invoice.billTo.address ?? null,
          }}
          voided={voided}
          hasCreditNotes={hasCreditNotes}
          documentHtml={documentHtml}
          openRegenerate={single(query[INVOICE_ACTION_PARAM]) === INVOICE_REGENERATE_ACTION}
        />
      }
    >
      {voided && (
        <ConsoleNotice tone="warning" Icon={BanIcon}>
          <div className="flex flex-col items-start gap-3">
            <p className="text-pretty">
              {`This invoice is void. It was voided on ${invoice.voidedAt ? financeDay(invoice.voidedAt) : "an unknown date"}${
                invoice.voidedByName ? ` by ${invoice.voidedByName}` : ""
              }${invoice.voidReason ? `. Reason: ${invoice.voidReason}` : "."}`}
            </p>
            {replacement ? (
              <LedgerLink href={invoicePath(replacement.id)}>{`Replaced by ${replacement.invoiceNumber}`}</LedgerLink>
            ) : (
              <IssueInvoiceButton
                bookingId={invoice.bookingId}
                existing={live ? { id: live.id, number: live.invoiceNumber } : null}
              />
            )}
          </div>
        </ConsoleNotice>
      )}

      <InvoiceDocument document={document} />

      <DetailSection
        title="Credit notes"
        Icon={FileMinusIcon}
        count={creditNotes.ok ? creditNotes.total : undefined}
        flush={creditNotes.ok}
        actions={
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-console-body">
            <div className="flex gap-2">
              <dt className="text-text-muted">Credited</dt>
              <dd className="font-data tabular-nums text-text-primary">{formatAed(credited)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-text-muted">Net</dt>
              <dd className="font-data font-semibold tabular-nums text-text-primary">
                {formatAed(invoice.totalFils - credited)}
              </dd>
            </div>
          </dl>
        }
      >
        <ConsoleDataTable
          label={`Credit notes for ${invoice.invoiceNumber}`}
          framed={false}
          columns={CREDIT_NOTE_COLUMNS}
          rows={creditNotes.ok ? creditNotes.rows : []}
          rowKey={(row) => row.id}
          rowHref={(row) => creditNotePath(row.id)}
          rowLabel={(row) => `Open credit note ${row.invoiceNumber}`}
          error={creditNotes.ok ? null : { title: "Credit notes could not be loaded", message: creditNotes.message }}
          empty={{
            title: "No credit notes",
            description: "A credit note is issued automatically when a refund on this invoice settles.",
            Icon: FileMinusIcon,
          }}
        />
      </DetailSection>
    </ConsolePage>
  );
}
