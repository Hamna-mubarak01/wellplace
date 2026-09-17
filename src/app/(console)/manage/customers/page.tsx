import type { Metadata } from "next";

import { hasPermission, requireManagement } from "@/lib/auth/session";
import { MANAGEMENT_LIST } from "@/lib/config/management-lists";
import { readCustomerTotals } from "@/lib/db/queries/customers-page";
import { listManagementCustomers } from "@/lib/db/queries/management-customers";
import { createClient } from "@/lib/db/server";
import { ConsolePage } from "@/components/console/console-page";
import { CustomerFormDialog } from "@/components/console/manage/customers/customer-form-dialog";
import { CustomerListStats } from "@/components/console/manage/customers/customer-list-stats";
import { CustomersTable } from "@/components/console/manage/customers/customers-table";
import { FilterBar } from "@/components/console/shared/filter-bar";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import {
  CUSTOMERS_PATH,
  DEFAULT_SORT,
  FILTER_LABEL,
  NARROWING_FILTERS,
  SORT_LABEL,
  SORT_OPTIONS,
  customerHref,
  customersHref,
  isFiltered,
  parseCustomersQuery,
  type CustomersSearchParams,
} from "@/app/(console)/manage/customers/customers-query";

export const metadata: Metadata = {
  title: "Customers",
  robots: { index: false, follow: false },
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<CustomersSearchParams>;
}) {
  const session = await requireManagement();
  const params = await searchParams;
  const query = parseCustomersQuery(params);
  const canEdit = hasPermission(session, "correct_customer_record");
  const client = await createClient();

  const [list, totals] = await Promise.all([
    listManagementCustomers(client, {
      page: query.page,
      pageSize: MANAGEMENT_LIST.pageSize,
      search: query.search,
      filter: query.filter ?? "customers",
      sort: query.sort,
    }),
    readCustomerTotals(client),
  ]);

  const shown = list.ok ? list.total : 0;

  return (
    <ConsolePage title="Customers" actions={canEdit ? <CustomerFormDialog /> : undefined}>
      {totals.ok ? (
        <CustomerListStats
          totals={totals.totals}
          selected={query.filter}
          hrefs={{
            all: customersHref(params, { filter: null }),
            returning: customersHref(params, { filter: "returning" }),
            upcoming: customersHref(params, { filter: "upcoming" }),
          }}
        />
      ) : (
        <ConsoleReadError title="Customer totals could not be loaded" message={totals.message} />
      )}

      <FilterBar
        label="Filter customers"
        search={{ label: "Search customers", placeholder: "Name, email or phone", value: query.search }}
        selects={[
          {
            param: "filter",
            label: "Show",
            allLabel: "All customers",
            value: query.filter,
            options: NARROWING_FILTERS.map((filter) => ({ value: filter, label: FILTER_LABEL[filter] })),
          },
        ]}
        period={{
          param: "sort",
          label: "Sort",
          value: query.sort,
          defaultValue: DEFAULT_SORT,
          options: SORT_OPTIONS.map((sort) => ({ value: sort, label: SORT_LABEL[sort] })),
        }}
        resultsLabel={`${shown.toLocaleString("en-AE")} ${shown === 1 ? "customer" : "customers"}`}
      />

      <CustomersTable
        variant="customers"
        rows={list.ok ? list.rows : []}
        page={list.ok ? list.page : 1}
        pageSize={list.ok ? list.pageSize : MANAGEMENT_LIST.pageSize}
        total={shown}
        hrefForPage={(target) => customersHref(params, { page: target > 1 ? String(target) : null })}
        hrefForCustomer={customerHref}
        filtered={isFiltered(query)}
        clearHref={CUSTOMERS_PATH}
        canEdit={canEdit}
        error={list.ok ? null : { title: "Customers could not be loaded", message: list.message }}
      />
    </ConsolePage>
  );
}
