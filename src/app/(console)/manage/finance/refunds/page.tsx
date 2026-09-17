import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlertIcon, CircleCheckIcon, HourglassIcon, SearchXIcon, Undo2Icon } from "lucide-react";

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
  REFUND_ORIGIN_LABEL,
  REFUND_ORIGIN_OPTIONS,
  REFUND_STATE_LABEL,
  REFUND_STATE_OPTIONS,
  financeDay,
  suiteLabel,
} from "@/components/console/manage/finance/finance-labels";
import { LedgerLink } from "@/components/console/manage/finance/ledger-link";
import { RefundRowActions } from "@/components/console/manage/finance/refund-row-actions";
import { ConsoleDataTable, type ConsoleColumn } from "@/components/console/shared/console-data-table";
import { FilterBar } from "@/components/console/shared/filter-bar";
import { MoneyValue } from "@/components/console/shared/money-value";
import { StatCard } from "@/components/console/shared/stat-card";
import { StatGrid } from "@/components/console/shared/stat-grid";
import { Button } from "@/components/shared/button";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import { formatAed } from "@/components/shared/money";
import { requireManagement } from "@/lib/auth/session";
import { FINANCE_DEFAULT_PERIOD, FINANCE_PATH, managedBookingPath, managedCustomerPath } from "@/lib/config/finance";
import { readRefundSummary } from "@/lib/db/queries/finance-page";
import { listRefundLedger, type RefundLedgerRow } from "@/lib/db/queries/management-refunds";
import { createClient } from "@/lib/db/server";
import { formatDubaiTime } from "@/lib/domain/time";

export const metadata: Metadata = {
  title: "Refunds",
  robots: { index: false, follow: false },
};

const PATH = FINANCE_PATH.refunds;

function count(value: number, one: string, other: string): string {
  return `${value.toLocaleString("en-AE")} ${value === 1 ? one : other}`;
}

const COLUMNS: readonly ConsoleColumn<RefundLedgerRow>[] = [
  {
    id: "refund",
    header: "Refund",
    cell: (row) => (
      <>
        <span className="block font-data tabular-nums whitespace-nowrap" title={row.providerReference ?? undefined}>
          {row.reference}
        </span>
        <span className="block font-data text-micro tabular-nums whitespace-nowrap text-text-secondary">
          {financeDay(row.requestedAt)} · {formatDubaiTime(row.requestedAt)}
        </span>
      </>
    ),
  },
  {
    id: "customer",
    header: "Customer",
    cell: (row) => (
      <LedgerLink href={managedCustomerPath(row.customerId)} className="max-w-56">
        <span className="truncate font-medium">{row.customerName || "Name not given"}</span>
        <span className="truncate text-micro text-text-secondary">{row.customerEmail}</span>
      </LedgerLink>
    ),
  },
  {
    id: "booking",
    header: "Booking",
    cell: (row) => (
      <LedgerLink href={managedBookingPath(row.bookingId)} label={`Open booking ${row.bookingReference}`}>
        <span className="font-data tabular-nums whitespace-nowrap">{row.bookingReference}</span>
        <span className="text-micro whitespace-nowrap text-text-secondary">{suiteLabel(row.suiteNumber) ?? "No suite"}</span>
      </LedgerLink>
    ),
  },
  {
    id: "amount",
    header: "Amount",
    align: "end",
    cell: (row) => (
      <>
        <MoneyValue fils={row.amountFils} className="block" />
        <span className="block font-data text-micro tabular-nums whitespace-nowrap text-text-secondary">
          VAT {formatAed(row.taxFils)}
        </span>
      </>
    ),
  },
  {
    id: "reason",
    header: "Reason",
    wrap: true,
    className: "min-w-40 max-w-64",
    cell: (row) => <span className="line-clamp-2 text-pretty break-words text-text-secondary">{row.reason}</span>,
  },
];

export default async function FinanceRefundsPage({
  searchParams,
}: {
  searchParams: Promise<FinanceSearchParams>;
}) {
  await requireManagement();
  const params = await searchParams;
  const query = parseFinanceQuery(params);
  const state = oneOf(single(params.state), REFUND_STATE_OPTIONS);
  const origin = oneOf(single(params.origin), REFUND_ORIGIN_OPTIONS);
  const windows = financeWindows(new Date());
  const window = listWindow(query, windows.todayIso);
  const client = await createClient();

  const [ledger, summary] = await Promise.all([
    listRefundLedger(client, {
      page: query.page,
      search: query.search,
      states: state === null ? undefined : [state],
      origin: origin ?? undefined,
      from: window?.from,
      to: window?.to,
    }),
    readRefundSummary(client, windows),
  ]);

  const filtered = isFinanceFiltered(query, [state, origin]);
  const toggle = (patch: Readonly<Record<string, string | null>>, selected: boolean) =>
    financeHref(
      PATH,
      params,
      selected ? Object.fromEntries(Object.keys(patch).map((key) => [key, null])) : patch,
    );
  const pendingSelected = state === "pending" && origin === null;
  const returnedSelected = state === "returned";
  const withdrawnSelected = state === "withdrawn";
  const automaticSelected = state === "pending" && origin === "automatic";

  return (
    <ConsolePage title="Refunds">
      {summary.ok ? (
        <StatGrid columns={4} label="Refund totals">
          <StatCard
            label="Pending"
            value={summary.value.pendingCount}
            sub={`${formatAed(summary.value.pendingFils)} to return`}
            tone={summary.value.pendingCount > 0 ? "warning" : "neutral"}
            Icon={HourglassIcon}
            href={toggle({ state: "pending", origin: null }, pendingSelected)}
            selected={pendingSelected}
          />
          <StatCard
            label="Returned this month"
            value={formatAed(summary.value.returnedMonthFils)}
            sub={`${count(summary.value.returnedMonthCount, "refund", "refunds")} · ${windows.monthLabel}`}
            tone="success"
            Icon={CircleCheckIcon}
            href={toggle({ state: "returned", origin: null }, returnedSelected)}
            selected={returnedSelected}
          />
          <StatCard
            label="Withdrawn"
            value={summary.value.withdrawnCount}
            sub={`${formatAed(summary.value.withdrawnFils)} not refunded`}
            Icon={Undo2Icon}
            href={toggle({ state: "withdrawn" }, withdrawnSelected)}
            selected={withdrawnSelected}
          />
          <StatCard
            label="Automatic, still pending"
            value={summary.value.automaticPendingCount}
            sub={`${formatAed(summary.value.automaticPendingFils)} to return`}
            tone={summary.value.automaticPendingCount > 0 ? "danger" : "neutral"}
            Icon={CircleAlertIcon}
            href={toggle({ state: "pending", origin: "automatic" }, automaticSelected)}
            selected={automaticSelected}
          />
        </StatGrid>
      ) : (
        <ConsoleReadError title="Refund totals could not be loaded" message={summary.message} />
      )}

      <FilterBar
        label="Filter refunds"
        search={{
          label: "Search refunds",
          placeholder: "Booking reference, customer or reason",
          value: query.search,
        }}
        selects={[
          {
            param: "state",
            label: "State",
            allLabel: "All states",
            value: state,
            options: REFUND_STATE_OPTIONS.map((value) => ({ value, label: REFUND_STATE_LABEL[value] })),
          },
          {
            param: "origin",
            label: "Origin",
            allLabel: "All origins",
            value: origin,
            options: REFUND_ORIGIN_OPTIONS.map((value) => ({ value, label: REFUND_ORIGIN_LABEL[value] })),
          },
        ]}
        period={{
          label: "Requested",
          value: query.period,
          defaultValue: FINANCE_DEFAULT_PERIOD,
          options: FINANCE_PERIOD_OPTIONS,
        }}
        resultsLabel={ledger.ok ? count(ledger.total, "refund", "refunds") : undefined}
      />

      <ConsoleDataTable
        label="Refunds"
        columns={COLUMNS}
        rows={ledger.ok ? ledger.rows : []}
        rowKey={(row) => row.id}
        actionsHeader="Actions"
        actions={(row) => <RefundRowActions row={row} />}
        error={ledger.ok ? null : { title: "Refunds could not be loaded", message: ledger.message }}
        pagination={
          ledger.ok
            ? {
                page: ledger.page,
                pageSize: ledger.pageSize,
                total: ledger.total,
                hrefFor: (target) => financeHref(PATH, params, { page: target > 1 ? String(target) : null }),
                noun: { one: "refund", other: "refunds" },
              }
            : undefined
        }
        empty={
          filtered
            ? {
                title: "No refunds match these filters",
                description: "Clear a filter, or search by another booking reference, customer or reason.",
                Icon: SearchXIcon,
                action: (
                  <Button asChild variant="outline">
                    <Link href={PATH}>Clear filters</Link>
                  </Button>
                ),
              }
            : {
                title: "No refunds yet",
                description: "Refunds are recorded from a payment. Open Payments to refund one.",
                Icon: Undo2Icon,
                action: (
                  <Button asChild variant="outline">
                    <Link href={FINANCE_PATH.payments}>Open payments</Link>
                  </Button>
                ),
              }
        }
      />
    </ConsolePage>
  );
}
