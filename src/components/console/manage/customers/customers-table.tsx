import Link from "next/link";
import { BanIcon, ContactRoundIcon, SearchXIcon, StarIcon, UserRoundPlusIcon, type LucideIcon } from "lucide-react";

import { CustomerBlockDialog } from "@/components/console/manage/customers/customer-block-dialog";
import { CustomerRowActions } from "@/components/console/manage/customers/customer-row-actions";
import {
  displayName,
  formatDubaiDate,
  formatPhone,
  isReturning,
} from "@/components/console/manage/customers/customer-view";
import {
  ConsoleDataTable,
  type ConsoleColumn,
  type ConsoleTableError,
} from "@/components/console/shared/console-data-table";
import { EmptyValue } from "@/components/console/shared/empty-value";
import { MoneyValue } from "@/components/console/shared/money-value";
import { Button } from "@/components/shared/button";
import type { ManagementCustomer } from "@/lib/db/queries/management-customers";

export type CustomersTableVariant = "customers" | "leads" | "blocked";

function nameColumn(starReturning: boolean): ConsoleColumn<ManagementCustomer> {
  return {
    id: "name",
    header: "Name",
    wrap: true,
    cell: (row) => {
      const returning = starReturning && isReturning(row);
      return (
        <span className="flex min-w-28 flex-col gap-0.5">
          <span className="flex items-center gap-1.5 font-medium text-text-primary">
            {displayName(row)}
            {returning && <StarIcon aria-hidden="true" className="size-3.5 shrink-0 fill-brand text-brand" />}
          </span>
          <span className="font-data text-micro tabular-nums text-text-secondary">
            {row.reference}
            {returning && <span className="font-sans font-medium text-brand">{` · Returning guest`}</span>}
          </span>
        </span>
      );
    },
  };
}

const CONTACT: ConsoleColumn<ManagementCustomer> = {
  id: "contact",
  header: "Contact",
  wrap: true,
  cell: (row) => {
    const phone = formatPhone(row.phoneE164);
    return (
      <span className="flex min-w-40 flex-col gap-0.5">
        {row.email === "" ? <EmptyValue label="No email" /> : <span className="break-words text-text-primary">{row.email}</span>}
        {phone !== "" && <span className="font-data text-micro tabular-nums text-text-secondary">{phone}</span>}
      </span>
    );
  },
};

const BOOKINGS: ConsoleColumn<ManagementCustomer> = {
  id: "bookings",
  header: "Bookings",
  align: "end",
  cell: (row) => <span className="font-data tabular-nums">{row.bookingsCount.toLocaleString("en-AE")}</span>,
};

const LAST_VISIT: ConsoleColumn<ManagementCustomer> = {
  id: "last-visit",
  header: "Last visit",
  cell: (row) => (row.lastVisitAt === null ? <EmptyValue label="No visits yet" /> : formatDubaiDate(row.lastVisitAt)),
};

const UPCOMING: ConsoleColumn<ManagementCustomer> = {
  id: "upcoming",
  header: "Upcoming",
  cell: (row) =>
    row.upcomingCount === 0 ? (
      <EmptyValue label="No upcoming visits" />
    ) : (
      <span className="flex flex-col gap-0.5">
        <span className="font-data tabular-nums">{row.upcomingCount.toLocaleString("en-AE")}</span>
        {row.nextVisitAt !== null && <span className="text-micro text-text-secondary">Next {formatDubaiDate(row.nextVisitAt)}</span>}
      </span>
    ),
};

const PAID: ConsoleColumn<ManagementCustomer> = {
  id: "paid",
  header: "Paid",
  align: "end",
  cell: (row) => <MoneyValue fils={row.paidFils} compact />,
};

const ADDED: ConsoleColumn<ManagementCustomer> = {
  id: "added",
  header: "Added",
  cell: (row) => formatDubaiDate(row.createdAt),
};

const LAST_ACTIVITY: ConsoleColumn<ManagementCustomer> = {
  id: "last-activity",
  header: "Last activity",
  cell: (row) => formatDubaiDate(row.lastInteractionAt),
};

const COLUMNS: Readonly<Record<CustomersTableVariant, readonly ConsoleColumn<ManagementCustomer>[]>> = {
  customers: [nameColumn(true), CONTACT, BOOKINGS, LAST_VISIT, UPCOMING, PAID],
  leads: [nameColumn(false), CONTACT, ADDED, LAST_ACTIVITY],
  blocked: [nameColumn(false), CONTACT, BOOKINGS, PAID],
};

const COPY: Readonly<
  Record<
    CustomersTableVariant,
    {
      readonly label: string;
      readonly noun: { readonly one: string; readonly other: string };
      readonly emptyTitle: string;
      readonly emptyDescription: string;
      readonly filteredTitle: string;
      readonly Icon: LucideIcon;
    }
  >
> = {
  customers: {
    label: "Customers",
    noun: { one: "customer", other: "customers" },
    emptyTitle: "No customers yet",
    emptyDescription: "Guests appear here after their first confirmed booking, online or at Reception.",
    filteredTitle: "No customers match these filters",
    Icon: ContactRoundIcon,
  },
  leads: {
    label: "Leads",
    noun: { one: "lead", other: "leads" },
    emptyTitle: "No leads yet",
    emptyDescription: "People who start a booking online but have not booked yet appear here.",
    filteredTitle: "No leads match this search",
    Icon: UserRoundPlusIcon,
  },
  blocked: {
    label: "Blocked customers",
    noun: { one: "blocked customer", other: "blocked customers" },
    emptyTitle: "Nobody is blocked",
    emptyDescription: "Blocked customers cannot book online or at Reception, and appear here until they are unblocked.",
    filteredTitle: "No blocked customers match this search",
    Icon: BanIcon,
  },
};

export interface CustomersTableProps {
  variant: CustomersTableVariant;
  rows: readonly ManagementCustomer[];
  page: number;
  pageSize: number;
  total: number;
  hrefForPage: (page: number) => string;
  hrefForCustomer: (id: string) => string;
  filtered: boolean;
  clearHref: string;
  error: ConsoleTableError | null;
  canEdit?: boolean;
}

export function CustomersTable({
  variant,
  rows,
  page,
  pageSize,
  total,
  hrefForPage,
  hrefForCustomer,
  filtered,
  clearHref,
  error,
  canEdit = false,
}: CustomersTableProps) {
  const copy = COPY[variant];
  const unblockable = variant === "blocked" && canEdit;

  return (
    <ConsoleDataTable
      label={copy.label}
      columns={COLUMNS[variant]}
      rows={rows}
      rowKey={(row) => row.id}
      rowHref={(row) => hrefForCustomer(row.id)}
      rowLabel={(row) => `Open the record for ${displayName(row)}`}
      actionsHeader="Actions"
      actions={(row) => (
        <span className="flex items-center justify-end gap-2">
          {unblockable && <CustomerBlockDialog customer={{ id: row.id, name: displayName(row) }} blocked />}
          <CustomerRowActions customer={row} canEdit={canEdit} />
        </span>
      )}
      error={error}
      pagination={{ page, pageSize, total, hrefFor: hrefForPage, noun: copy.noun }}
      empty={
        filtered
          ? {
              title: copy.filteredTitle,
              description: "Clear the search, or try another name, email or phone number.",
              Icon: SearchXIcon,
              action: (
                <Button asChild variant="outline">
                  <Link href={clearHref}>Clear filters</Link>
                </Button>
              ),
            }
          : { title: copy.emptyTitle, description: copy.emptyDescription, Icon: copy.Icon }
      }
    />
  );
}
