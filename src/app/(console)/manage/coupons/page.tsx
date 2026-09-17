import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import {
  CalendarClockIcon,
  CalendarXIcon,
  SearchXIcon,
  TicketCheckIcon,
  TicketPercentIcon,
  TicketXIcon,
} from "lucide-react";

import { requireManagement } from "@/lib/auth/session";
import { CONSOLE_LIST } from "@/lib/config/console-list";
import { COUPON_OVERVIEW, type CouponRow } from "@/lib/config/coupons";
import { createClient } from "@/lib/db/server";
import { listCoupons } from "@/lib/db/coupons";
import { listAddonCatalogue } from "@/lib/db/queries/pricing";
import { todayInDubai } from "@/lib/domain/time";
import { ConsolePage } from "@/components/console/console-page";
import { CouponsWorkspace } from "@/components/console/manage/coupons-workspace";
import { CouponRowActions } from "@/components/console/manage/coupons/coupon-row-actions";
import { CreateCouponsButton } from "@/components/console/manage/coupons/create-coupons-button";
import {
  ConsoleDataTable,
  type ConsoleColumn,
} from "@/components/console/shared/console-data-table";
import { EmptyValue } from "@/components/console/shared/empty-value";
import { FilterBar } from "@/components/console/shared/filter-bar";
import type { FilterSelectConfig } from "@/components/console/shared/filter-types";
import { StatCard } from "@/components/console/shared/stat-card";
import { StatGrid } from "@/components/console/shared/stat-grid";
import { StatusChip, type StatusChipTone } from "@/components/console/shared/status-chip";
import { Button } from "@/components/shared/button";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import { formatAed } from "@/components/shared/money";
import {
  COUPONS_PATH,
  COUPON_FILTERS,
  COUPON_FILTER_LABEL,
  COUPON_KINDS,
  COUPON_KIND_LABEL,
  COUPON_STATUS_LABEL,
  couponBatchNames,
  couponCalendar,
  couponDay,
  couponStatus,
  couponsHref,
  filterCoupons,
  isExpiringSoon,
  isFiltered,
  parseCouponsQuery,
  summariseCoupons,
  withKnownBatch,
  type CouponCalendar,
  type CouponStatus,
  type CouponsSearchParams,
} from "@/app/(console)/manage/coupons/coupons-view";

export const metadata: Metadata = {
  title: "Coupons",
  robots: { index: false, follow: false },
};

const STATUS_TONE: Readonly<Record<CouponStatus, StatusChipTone>> = {
  active: "success",
  scheduled: "info",
  used_up: "neutral",
  expired: "neutral",
  inactive: "neutral",
};

function discountLabel(row: CouponRow): string {
  if (row.kind === "fixed") return formatAed(row.amountFils ?? 0);
  if (row.kind === "percent") return `${row.percent}%`;
  return COUPON_KIND_LABEL.addon_free;
}

function couponColumns(calendar: CouponCalendar): readonly ConsoleColumn<CouponRow>[] {
  return [
    {
      id: "code",
      header: "Code",
      cell: (row) => <span className="font-data font-medium tabular-nums">{row.code}</span>,
    },
    {
      id: "batch",
      header: "Batch",
      wrap: true,
      cell: (row) =>
        row.batchName === null ? <EmptyValue label="Not in a batch" /> : <span>{row.batchName}</span>,
    },
    {
      id: "discount",
      header: "Discount",
      cell: (row) => (
        <span className={row.kind === "addon_free" ? undefined : "font-data tabular-nums"}>
          {discountLabel(row)}
        </span>
      ),
    },
    {
      id: "valid",
      header: "Valid through",
      cell: (row) =>
        row.validTo === null ? (
          <span className="text-text-secondary">No expiry</span>
        ) : (
          <>
            <span className="block whitespace-nowrap">{couponDay(row.validTo)}</span>
            {isExpiringSoon(row, calendar) && (
              <span className="block text-micro text-warning-ink">
                {COUPON_FILTER_LABEL.expiring}
              </span>
            )}
          </>
        ),
    },
    {
      id: "uses",
      header: "Uses",
      cell: (row) => (
        <span className="font-data tabular-nums whitespace-nowrap">
          {row.usedCount.toLocaleString("en-AE")} /{" "}
          {row.maxUses === null ? "Unlimited" : row.maxUses.toLocaleString("en-AE")}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => {
        const status = couponStatus(row, calendar.today);
        return <StatusChip tone={STATUS_TONE[status]}>{COUPON_STATUS_LABEL[status]}</StatusChip>;
      },
    },
  ];
}

export default async function CouponsPage({
  searchParams,
}: {
  searchParams: Promise<CouponsSearchParams>;
}) {
  await requireManagement();
  const params = await searchParams;
  const client = await createClient();

  const [listing, catalogue] = await Promise.all([
    listCoupons(client).then(
      (coupons) => ({ ok: true as const, coupons }),
      (error: unknown) => {
        unstable_rethrow(error);
        return { ok: false as const };
      },
    ),
    listAddonCatalogue(client),
  ]);

  const addons = catalogue.ok ? catalogue.addons.map(({ id, name }) => ({ id, name })) : null;

  if (!listing.ok) {
    return (
      <CouponsWorkspace addons={addons}>
        <ConsolePage title="Coupons" actions={<CreateCouponsButton />}>
          <ConsoleReadError
            title="Coupons could not be loaded"
            message="The latest coupons could not be loaded."
            meaning="No coupon has changed."
            remedy="Reload the page to try again."
          />
        </ConsolePage>
      </CouponsWorkspace>
    );
  }

  const batchNames = couponBatchNames(listing.coupons);
  const query = withKnownBatch(parseCouponsQuery(params), batchNames);
  const calendar = couponCalendar(todayInDubai(new Date()));
  const summary = summariseCoupons(listing.coupons, calendar);
  const matching = filterCoupons(listing.coupons, query, calendar);
  const pageCount = Math.max(1, Math.ceil(matching.length / CONSOLE_LIST.pageSize));
  const page = Math.min(query.page, pageCount);
  const visible = matching.slice((page - 1) * CONSOLE_LIST.pageSize, page * CONSOLE_LIST.pageSize);
  const filtered = isFiltered(query);
  const statusHref = (status: (typeof COUPON_FILTERS)[number]) =>
    couponsHref(params, { status: query.status === status ? null : status });
  const filters: FilterSelectConfig[] = [
    {
      param: "status",
      label: "Status",
      allLabel: "All statuses",
      value: query.status,
      options: COUPON_FILTERS.map((status) => ({ value: status, label: COUPON_FILTER_LABEL[status] })),
    },
    {
      param: "kind",
      label: "Discount type",
      allLabel: "All discount types",
      value: query.kind,
      options: COUPON_KINDS.map((kind) => ({ value: kind, label: COUPON_KIND_LABEL[kind] })),
    },
  ];
  if (batchNames.length > 0) {
    filters.push({
      param: "batch",
      label: "Batch",
      allLabel: "All batches",
      value: query.batch,
      options: batchNames.map((name) => ({ value: name, label: name })),
    });
  }

  return (
    <CouponsWorkspace addons={addons}>
      <ConsolePage title="Coupons" actions={<CreateCouponsButton />}>
        <StatGrid columns={4} label="Coupon summary">
          <StatCard
            label="Active"
            value={summary.active}
            sub="Can be used at checkout"
            tone="success"
            Icon={TicketCheckIcon}
            href={statusHref("active")}
            selected={query.status === "active"}
          />
          <StatCard
            label="Expiring soon"
            value={summary.expiring}
            sub={`Within ${COUPON_OVERVIEW.expiringSoonDays.toLocaleString("en-AE")} days`}
            tone={summary.expiring > 0 ? "warning" : "neutral"}
            Icon={CalendarClockIcon}
            href={statusHref("expiring")}
            selected={query.status === "expiring"}
          />
          <StatCard
            label="Used up"
            value={summary.usedUp}
            sub="Every use has been taken"
            Icon={TicketXIcon}
            href={statusHref("used_up")}
            selected={query.status === "used_up"}
          />
          <StatCard
            label="Expired"
            value={summary.expired}
            sub="Past their expiry date"
            Icon={CalendarXIcon}
            href={statusHref("expired")}
            selected={query.status === "expired"}
          />
        </StatGrid>

        <FilterBar
          label="Filter coupons"
          search={{
            label: "Search coupons",
            placeholder: "Coupon code",
            value: query.search,
          }}
          selects={filters}
          resultsLabel={`${matching.length.toLocaleString("en-AE")} ${matching.length === 1 ? "coupon" : "coupons"}`}
        />

        <ConsoleDataTable
          label="Coupons"
          columns={couponColumns(calendar)}
          rows={visible}
          rowKey={(row) => row.id ?? row.code}
          actions={(row) => <CouponRowActions coupon={row} />}
          pagination={{
            page,
            pageSize: CONSOLE_LIST.pageSize,
            total: matching.length,
            hrefFor: (target) => couponsHref(params, { page: target > 1 ? String(target) : null }),
            noun: { one: "coupon", other: "coupons" },
          }}
          empty={
            filtered
              ? {
                  title: "No coupons match these filters",
                  description: "Clear a filter, choose another batch, or search by another code.",
                  Icon: SearchXIcon,
                  action: (
                    <Button asChild variant="outline">
                      <Link href={COUPONS_PATH}>Clear filters</Link>
                    </Button>
                  ),
                }
              : {
                  title: "No coupons yet",
                  description: "Create a coupon, or a batch of them, to offer a discount at checkout.",
                  Icon: TicketPercentIcon,
                  action: <CreateCouponsButton variant="outline" />,
                }
          }
        />
      </ConsolePage>
    </CouponsWorkspace>
  );
}
