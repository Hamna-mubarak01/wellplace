import type { Metadata } from "next";

import { hasPermission, requireManagement } from "@/lib/auth/session";
import { MANAGEMENT_LIST } from "@/lib/config/management-lists";
import { listManagementCustomers } from "@/lib/db/queries/management-customers";
import { createClient } from "@/lib/db/server";
import { ConsolePage } from "@/components/console/console-page";
import { CustomerBlockDialog } from "@/components/console/manage/customers/customer-block-dialog";
import { CustomersTable } from "@/components/console/manage/customers/customers-table";
import { FilterBar } from "@/components/console/shared/filter-bar";
import {
  BLOCKED_PATH,
  customerHref,
  customersHref,
  parseCustomersQuery,
  type CustomersSearchParams,
} from "@/app/(console)/manage/customers/customers-query";

export const metadata: Metadata = {
  title: "Blocked customers",
  robots: { index: false, follow: false },
};

export default async function BlockedCustomersPage({ searchParams }: { searchParams: Promise<CustomersSearchParams> }) {
  const session = await requireManagement();
  const params = await searchParams;
  const query = parseCustomersQuery(params);
  const canBlock = hasPermission(session, "correct_customer_record");
  const client = await createClient();

  const list = await listManagementCustomers(client, {
    page: query.page,
    pageSize: MANAGEMENT_LIST.pageSize,
    search: query.search,
    filter: "blocked",
    sort: "recent",
  });
  const shown = list.ok ? list.total : 0;

  return (
    <ConsolePage title="Blocked" actions={canBlock ? <CustomerBlockDialog /> : undefined}>
      <FilterBar
        label="Filter blocked customers"
        search={{ label: "Search blocked customers", placeholder: "Name, email or phone", value: query.search }}
        resultsLabel={`${shown.toLocaleString("en-AE")} blocked`}
      />

      <CustomersTable
        variant="blocked"
        canEdit={canBlock}
        rows={list.ok ? list.rows : []}
        page={list.ok ? list.page : 1}
        pageSize={list.ok ? list.pageSize : MANAGEMENT_LIST.pageSize}
        total={shown}
        hrefForPage={(target) => customersHref(params, { page: target > 1 ? String(target) : null }, BLOCKED_PATH)}
        hrefForCustomer={customerHref}
        filtered={query.search !== ""}
        clearHref={BLOCKED_PATH}
        error={list.ok ? null : { title: "Blocked customers could not be loaded", message: list.message }}
      />
    </ConsolePage>
  );
}
