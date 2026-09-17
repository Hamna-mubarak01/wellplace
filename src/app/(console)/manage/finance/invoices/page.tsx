import type { Metadata } from "next";
import Link from "next/link";
import {
  BanIcon,
  BanknoteIcon,
  DownloadIcon,
  PercentIcon,
  ReceiptTextIcon,
  SearchXIcon,
} from "lucide-react";

import {
  FINANCE_PERIOD_OPTIONS,
  financeHref,
  type FinanceSearchParams,
} from "@/app/(console)/manage/finance/finance-query";
import { parseInvoiceListQuery } from "@/app/(console)/manage/finance/invoices/invoice-list-query";
import { ConsolePage } from "@/components/console/console-page";
import {
  INVOICE_STATE_LABEL,
  INVOICE_STATE_OPTIONS,
  financeDay,
} from "@/components/console/manage/finance/finance-labels";
import { InvoiceSettingsNotice } from "@/components/console/manage/finance/invoice-settings-notice";
import { LedgerLink } from "@/components/console/manage/finance/ledger-link";
import { TaxDocumentRowActions } from "@/components/console/manage/finance/tax-document-row-actions";
import { ConsoleDataTable, type ConsoleColumn } from "@/components/console/shared/console-data-table";
import { FilterBar } from "@/components/console/shared/filter-bar";
import { MoneyValue } from "@/components/console/shared/money-value";
import { StatCard } from "@/components/console/shared/stat-card";
import { StatGrid } from "@/components/console/shared/stat-grid";
import { Button } from "@/components/shared/button";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import { formatAed } from "@/components/shared/money";
import { requireManagement } from "@/lib/auth/session";
import {
  FINANCE_DEFAULT_PERIOD,
  FINANCE_PATH,
  INVOICES_EXPORT_PATH,
  creditNotePath,
  invoicePath,
  managedBookingPath,
  managedCustomerPath,
} from "@/lib/config/finance";
import { INVOICE_COPY, INVOICE_SETTING_KEYS, invoiceIssuerReadiness } from "@/lib/config/invoice";
import { TAX_DOCUMENT_TYPES } from "@/lib/db/invoice-record";
import { readInvoiceMonthSummary } from "@/lib/db/queries/finance-page";
import { listInvoices, type InvoiceSummary } from "@/lib/db/queries/invoices";
import { readSettingsSnapshot } from "@/lib/db/queries/settings";
import { createClient } from "@/lib/db/server";

export const metadata: Metadata = {
  title: "Invoices",
  robots: { index: false, follow: false },
};

const PATH = FINANCE_PATH.invoices;

function count(value: number, one: string, other: string): string {
  return `${value.toLocaleString("en-AE")} ${value === 1 ? one : other}`;
}

function documentHref(row: InvoiceSummary): string {
  return row.documentType === "credit_note" ? creditNotePath(row.id) : invoicePath(row.id);
}

const COLUMNS: readonly ConsoleColumn<InvoiceSummary>[] = [
  {
    id: "number",
    header: "Number",
    cell: (row) => (
      <>
        <span className="block font-data tabular-nums whitespace-nowrap">{row.invoiceNumber}</span>
        {row.originalInvoiceNumber && (
          <span className="block font-data text-micro tabular-nums text-text-secondary">
            {`For ${row.originalInvoiceNumber}`}
          </span>
        )}
      </>
    ),
  },
  {
    id: "type",
    header: "Type",
    cell: (row) => {
      const type = row.documentType ?? "invoice";
      return <span className="whitespace-nowrap text-text-secondary">{INVOICE_COPY.documentTypes[type]}</span>;
    },
  },
  {
    id: "issued",
    header: "Issued",
    cell: (row) => <span className="whitespace-nowrap">{financeDay(row.issuedAt)}</span>,
  },
  {
    id: "customer",
    header: "Customer",
    wrap: true,
    cell: (row) => (
      <LedgerLink href={managedCustomerPath(row.customerId)}>
        <span className="font-medium break-words">{row.customerName || "Name not given"}</span>
        {row.customerReference && (
          <span className="font-data text-micro tabular-nums text-text-secondary">{row.customerReference}</span>
        )}
      </LedgerLink>
    ),
  },
  {
    id: "booking",
    header: "Booking",
    cell: (row) => (
      <LedgerLink href={managedBookingPath(row.bookingId)} label={`Open booking ${row.bookingReference}`} data>
        {row.bookingReference}
      </LedgerLink>
    ),
  },
  {
    id: "total",
    header: "Total",
    align: "end",
    cell: (row) => <MoneyValue fils={row.totalFils} />,
  },
  {
    id: "vat",
    header: "VAT",
    align: "end",
    cell: (row) => <MoneyValue fils={row.taxFils} className="text-text-secondary" />,
  },
];

export default async function FinanceInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<FinanceSearchParams>;
}) {
  await requireManagement();
  const params = await searchParams;
  const { query, type, state, windows, filtered, request } = parseInvoiceListQuery(params, new Date());
  const client = await createClient();

  const [listing, summary, settings] = await Promise.all([
    listInvoices(client, { ...request, page: query.page }),
    readInvoiceMonthSummary(client, windows),
    readSettingsSnapshot(client, INVOICE_SETTING_KEYS),
  ]);

  if (!settings.ok) console.error("[finance] invoice settings could not be read:", settings.message);
  const readiness = settings.ok ? invoiceIssuerReadiness(settings.snapshot) : null;
  const settingsIncomplete = readiness !== null && !readiness.ready;
  const monthSelected = query.period === "month" && query.from === null && state === "issued";
  const voidedSelected = state === "voided";

  return (
    <ConsolePage
      title="Invoices"
      actions={
        <Button asChild variant="outline">
          <a href={financeHref(INVOICES_EXPORT_PATH, params, {})} download>
            <DownloadIcon aria-hidden="true" className="size-4" />
            Export CSV
          </a>
        </Button>
      }
    >
      {settingsIncomplete && <InvoiceSettingsNotice />}

      {summary.ok ? (
        <StatGrid columns={4} label="Invoice totals">
          <StatCard
            label="Issued this month"
            value={summary.value.issuedMonthCount}
            sub={windows.monthLabel}
            Icon={ReceiptTextIcon}
            href={financeHref(
              PATH,
              params,
              monthSelected
                ? { period: null, state: null }
                : { period: "month", state: "issued", from: null, to: null },
            )}
            selected={monthSelected}
          />
          <StatCard
            label="Invoiced this month"
            value={formatAed(summary.value.issuedMonthTotalFils)}
            sub="Total of issued invoices"
            tone="success"
            Icon={BanknoteIcon}
          />
          <StatCard
            label="VAT this month"
            value={formatAed(summary.value.issuedMonthTaxFils)}
            sub="VAT on issued invoices"
            Icon={PercentIcon}
          />
          <StatCard
            label="Voided"
            value={summary.value.voidedCount}
            sub="All time"
            Icon={BanIcon}
            href={financeHref(PATH, params, { state: voidedSelected ? null : "voided" })}
            selected={voidedSelected}
          />
        </StatGrid>
      ) : (
        <ConsoleReadError title="Invoice totals could not be loaded" message={summary.message} />
      )}

      <FilterBar
        label="Filter invoices"
        search={{
          label: "Search invoices and credit notes",
          placeholder: "Number, booking, customer name or number",
          value: query.search,
        }}
        selects={[
          {
            param: "type",
            label: "Type",
            allLabel: "All types",
            value: type,
            options: TAX_DOCUMENT_TYPES.map((value) => ({ value, label: INVOICE_COPY.documentTypes[value] })),
          },
          {
            param: "state",
            label: "State",
            allLabel: "All states",
            value: state,
            options: INVOICE_STATE_OPTIONS.map((value) => ({ value, label: INVOICE_STATE_LABEL[value] })),
          },
        ]}
        dateRange={{ label: "Issued between", from: query.from, to: query.to, clears: ["period"] }}
        period={{
          label: "Issued",
          value: query.period,
          defaultValue: FINANCE_DEFAULT_PERIOD,
          options: FINANCE_PERIOD_OPTIONS,
          clears: ["from", "to"],
        }}
        resultsLabel={listing.ok ? count(listing.total, "document", "documents") : undefined}
      />

      <ConsoleDataTable
        label="Invoices and credit notes"
        columns={COLUMNS}
        rows={listing.ok ? listing.rows : []}
        rowKey={(row) => `${row.documentType ?? "invoice"}-${row.id}`}
        rowHref={documentHref}
        rowLabel={(row) => `Open ${INVOICE_COPY.documentTypes[row.documentType ?? "invoice"].toLowerCase()} ${row.invoiceNumber}`}
        actionsHeader="Actions"
        actions={(row) => (
          <TaxDocumentRowActions
            documentType={row.documentType ?? "invoice"}
            documentId={row.id}
            documentNumber={row.invoiceNumber}
            email={row.customerEmail}
            voided={row.state === "voided"}
          />
        )}
        error={listing.ok ? null : { title: "Invoices could not be loaded", message: listing.message }}
        pagination={
          listing.ok
            ? {
                page: listing.page,
                pageSize: listing.pageSize,
                total: listing.total,
                hrefFor: (target) => financeHref(PATH, params, { page: target > 1 ? String(target) : null }),
                noun: { one: "document", other: "documents" },
              }
            : undefined
        }
        empty={
          filtered
            ? {
                title: "No invoices or credit notes match these filters",
                description: "Clear a filter, or search by another number, booking reference or customer.",
                Icon: SearchXIcon,
                action: (
                  <Button asChild variant="outline">
                    <Link href={PATH}>Clear filters</Link>
                  </Button>
                ),
              }
            : {
                title: "No invoices yet",
                description: "Invoices are issued automatically when a booking is fully paid, and appear here with their number.",
                Icon: ReceiptTextIcon,
                action: settingsIncomplete ? (
                  <Button asChild variant="outline">
                    <Link href={FINANCE_PATH.invoiceSettings}>{INVOICE_COPY.console.openSettings}</Link>
                  </Button>
                ) : undefined,
              }
        }
      />
    </ConsolePage>
  );
}
