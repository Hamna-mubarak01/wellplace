import type { Metadata } from "next";
import Link from "next/link";
import { BanknoteIcon, CalendarDaysIcon, CreditCardIcon, HourglassIcon, SearchXIcon } from "lucide-react";

import {
  FINANCE_PERIOD_OPTIONS,
  financeHref,
  financeWindows,
  isFinanceFiltered,
  listWindow,
  oneOf,
  parseFinanceQuery,
  single,
  type FinanceSearchParams,
} from "@/app/(console)/manage/finance/finance-query";
import { ConsolePage } from "@/components/console/console-page";
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_STATUS_FILTER,
  PAYMENT_STATUS_FILTERS,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  financeDay,
  isRefundable,
  suiteLabel,
} from "@/components/console/manage/finance/finance-labels";
import { LedgerLink } from "@/components/console/manage/finance/ledger-link";
import { RefundDialog } from "@/components/console/reception/refund-dialog";
import { ConsoleDataTable, type ConsoleColumn } from "@/components/console/shared/console-data-table";
import { EmptyValue } from "@/components/console/shared/empty-value";
import { FilterBar } from "@/components/console/shared/filter-bar";
import { MoneyValue } from "@/components/console/shared/money-value";
import { ReferenceValue } from "@/components/console/shared/reference-value";
import { StatCard } from "@/components/console/shared/stat-card";
import { StatGrid } from "@/components/console/shared/stat-grid";
import { StatusChip } from "@/components/console/shared/status-chip";
import { Button } from "@/components/shared/button";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import { formatAed } from "@/components/shared/money";
import { requireManagement } from "@/lib/auth/session";
import { FINANCE_DEFAULT_PERIOD, FINANCE_PATH, managedBookingPath, managedCustomerPath } from "@/lib/config/finance";
import { readPaymentSummary } from "@/lib/db/queries/finance-page";
import { listPaymentLedger, type PaymentLedgerRow } from "@/lib/db/queries/management-payments";
import { createClient } from "@/lib/db/server";
import { formatDubaiTime } from "@/lib/domain/time";

export const metadata: Metadata = {
  title: "Payments",
  robots: { index: false, follow: false },
};

const PATH = FINANCE_PATH.payments;

function count(value: number, one: string, other: string): string {
  return `${value.toLocaleString("en-AE")} ${value === 1 ? one : other}`;
}

function refundNote(row: PaymentLedgerRow): string | null {
  if (row.refundPendingFils > 0) return `${formatAed(row.refundPendingFils)} refund pending`;
  if (row.refundedFils > 0) return `${formatAed(row.refundedFils)} refunded`;
  return null;
}

const COLUMNS: readonly ConsoleColumn<PaymentLedgerRow>[] = [
  {
    id: "date",
    header: "Date",
    cell: (row) => (
      <>
        <span className="block whitespace-nowrap">{financeDay(row.recordedAt)}</span>
        <span className="block font-data text-micro tabular-nums text-text-secondary">
          {formatDubaiTime(row.recordedAt)}
        </span>
      </>
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
    id: "customer",
    header: "Customer",
    wrap: true,
    cell: (row) => (
      <LedgerLink href={managedCustomerPath(row.customerId)}>
        <span className="font-medium break-words">{row.customerName || "Name not given"}</span>
        <span className="text-micro break-all text-text-secondary">{row.customerEmail}</span>
      </LedgerLink>
    ),
  },
  {
    id: "suite",
    header: "Suite",
    cell: (row) => suiteLabel(row.suiteNumber) ?? <EmptyValue label="No suite" />,
  },
  {
    id: "reference",
    header: "Reference",
    wrap: true,
    cell: (row) => <ReferenceValue reference={row.reference} secondary={row.providerReference} />,
  },
  {
    id: "method",
    header: "Method",
    cell: (row) => (
      <>
        <span className="block whitespace-nowrap">{PAYMENT_METHOD_LABEL[row.method]}</span>
        {row.isSimulated && <span className="block text-micro text-text-secondary">Test payment</span>}
      </>
    ),
  },
  {
    id: "amount",
    header: "Amount",
    align: "end",
    cell: (row) => {
      const note = refundNote(row);
      return (
        <>
          <MoneyValue fils={row.amountFils} className="block" />
          {note && <span className="block text-micro whitespace-nowrap text-text-secondary">{note}</span>}
        </>
      );
    },
  },
  {
    id: "status",
    header: "Status",
    cell: (row) => <StatusChip tone={PAYMENT_STATUS_TONE[row.status]}>{PAYMENT_STATUS_LABEL[row.status]}</StatusChip>,
  },
];

export default async function FinancePaymentsPage({
  searchParams,
}: {
  searchParams: Promise<FinanceSearchParams>;
}) {
  await requireManagement();
  const params = await searchParams;
  const query = parseFinanceQuery(params);
  const method = oneOf(single(params.method), PAYMENT_METHOD_OPTIONS);
  const status = oneOf(single(params.status), PAYMENT_STATUS_FILTERS);
  const windows = financeWindows(new Date());
  const window = listWindow(query, windows.todayIso);
  const client = await createClient();

  const [ledger, summary] = await Promise.all([
    listPaymentLedger(client, {
      page: query.page,
      search: query.search,
      methods: method === null ? undefined : [method],
      statuses: status === null ? undefined : PAYMENT_STATUS_FILTER[status].statuses,
      from: window?.from,
      to: window?.to,
    }),
    readPaymentSummary(client, windows),
  ]);

  const filtered = isFinanceFiltered(query, [method, status]);
  const periodHref = (period: "today" | "month") =>
    financeHref(PATH, params, {
      period: query.period === period && query.from === null ? null : period,
      from: null,
      to: null,
    });

  return (
    <ConsolePage title="Payments">
      {summary.ok ? (
        <StatGrid columns={4} label="Payment totals">
          <StatCard
            label="Today’s takings"
            value={formatAed(summary.value.todayFils)}
            sub={count(summary.value.todayCount, "payment", "payments")}
            tone="success"
            Icon={BanknoteIcon}
            href={periodHref("today")}
            selected={query.period === "today" && query.from === null}
          />
          <StatCard
            label="This month"
            value={formatAed(summary.value.monthFils)}
            sub={windows.monthLabel}
            tone="success"
            Icon={CalendarDaysIcon}
            href={periodHref("month")}
            selected={query.period === "month" && query.from === null}
          />
          <StatCard
            label="Payments this month"
            value={summary.value.monthCount}
            sub="Received"
            Icon={CreditCardIcon}
          />
          <StatCard
            label="Awaiting payment"
            value={summary.value.awaitingCount}
            sub={`${formatAed(summary.value.awaitingFils)} open or pending`}
            tone={summary.value.awaitingCount > 0 ? "warning" : "neutral"}
            Icon={HourglassIcon}
            href={financeHref(PATH, params, { status: status === "awaiting" ? null : "awaiting" })}
            selected={status === "awaiting"}
          />
        </StatGrid>
      ) : (
        <ConsoleReadError title="Payment totals could not be loaded" message={summary.message} />
      )}

      <FilterBar
        label="Filter payments"
        search={{
          label: "Search payments",
          placeholder: "Booking reference or customer",
          value: query.search,
        }}
        selects={[
          {
            param: "method",
            label: "Method",
            allLabel: "All methods",
            value: method,
            options: PAYMENT_METHOD_OPTIONS.map((value) => ({ value, label: PAYMENT_METHOD_LABEL[value] })),
          },
          {
            param: "status",
            label: "Status",
            allLabel: "All statuses",
            value: status,
            options: PAYMENT_STATUS_FILTERS.map((value) => ({ value, label: PAYMENT_STATUS_FILTER[value].label })),
          },
        ]}
        dateRange={{ label: "Dates", from: query.from, to: query.to, clears: ["period"] }}
        period={{
          label: "Period",
          value: query.period,
          defaultValue: FINANCE_DEFAULT_PERIOD,
          options: FINANCE_PERIOD_OPTIONS,
          clears: ["from", "to"],
        }}
        resultsLabel={ledger.ok ? count(ledger.total, "payment", "payments") : undefined}
      />

      <ConsoleDataTable
        label="Payments"
        columns={COLUMNS}
        rows={ledger.ok ? ledger.rows : []}
        rowKey={(row) => row.id}
        actionsHeader="Actions"
        actions={(row) =>
          isRefundable(row) ? (
            <RefundDialog
              bookingId={row.bookingId}
              paymentId={row.id}
              paymentAmountFils={row.refundableFils}
              paymentLabel={`${row.bookingReference} · ${formatAed(row.refundableFils)} remaining to refund`}
            />
          ) : null
        }
        error={ledger.ok ? null : { title: "Payments could not be loaded", message: ledger.message }}
        pagination={
          ledger.ok
            ? {
                page: ledger.page,
                pageSize: ledger.pageSize,
                total: ledger.total,
                hrefFor: (target) => financeHref(PATH, params, { page: target > 1 ? String(target) : null }),
                noun: { one: "payment", other: "payments" },
              }
            : undefined
        }
        empty={
          filtered
            ? {
                title: "No payments match these filters",
                description: "Clear a filter, or search by another booking reference or customer.",
                Icon: SearchXIcon,
                action: (
                  <Button asChild variant="outline">
                    <Link href={PATH}>Clear filters</Link>
                  </Button>
                ),
              }
            : {
                title: "No payments yet",
                description: "Payments taken online or recorded at Reception appear here.",
                Icon: CreditCardIcon,
              }
        }
      />
    </ConsolePage>
  );
}
