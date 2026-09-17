import type { Metadata } from "next";

import { hasPermission, requireManagement } from "@/lib/auth/session";
import { MANAGEMENT_LIST } from "@/lib/config/management-lists";
import { listManagementCustomers } from "@/lib/db/queries/management-customers";
import { createClient } from "@/lib/db/server";
import { ConsolePage } from "@/components/console/console-page";
import { CustomerFormDialog } from "@/components/console/manage/customers/customer-form-dialog";
import { CustomersTable } from "@/components/console/manage/customers/customers-table";
import { FilterBar } from "@/components/console/shared/filter-bar";
import {
  DEFAULT_SORT,
  LEADS_PATH,
  SORT_LABEL,
  SORT_OPTIONS,
  customerHref,
  customersHref,
  parseCustomersQuery,
  type CustomersSearchParams,
} from "@/app/(console)/manage/customers/customers-query";

export const metadata: Metadata = {
  title: "Leads",
  robots: { index: false, follow: false },
};

export default async function LeadsPage({ searchParams }: { searchParams: Promise<CustomersSearchParams> }) {
  const session = await requireManagement();
  const params = await searchParams;
  const query = parseCustomersQuery(params);
  const canEdit = hasPermission(session, "correct_customer_record");
  const client = await createClient();

  const list = await listManagementCustomers(client, {
    page: query.page,
    pageSize: MANAGEMENT_LIST.pageSize,
    search: query.search,
    filter: "leads",
    sort: query.sort,
  });
  const shown = list.ok ? list.total : 0;

  return (
    <ConsolePage title="Leads" actions={canEdit ? <CustomerFormDialog /> : undefined}>
      <FilterBar
        label="Filter leads"
        search={{ label: "Search leads", placeholder: "Name, email or phone", value: query.search }}
        period={{
          param: "sort",
          label: "Sort",
          value: query.sort,
          defaultValue: DEFAULT_SORT,
          options: SORT_OPTIONS.filter((sort) => sort !== "value").map((sort) => ({ value: sort, label: SORT_LABEL[sort] })),
        }}
        resultsLabel={`${shown.toLocaleString("en-AE")} ${shown === 1 ? "lead" : "leads"}`}
      />

      <CustomersTable
        variant="leads"
        rows={list.ok ? list.rows : []}
        page={list.ok ? list.page : 1}
        pageSize={list.ok ? list.pageSize : MANAGEMENT_LIST.pageSize}
        total={shown}
        hrefForPage={(target) => customersHref(params, { page: target > 1 ? String(target) : null }, LEADS_PATH)}
        hrefForCustomer={customerHref}
        filtered={query.search !== ""}
        clearHref={LEADS_PATH}
        canEdit={canEdit}
        error={list.ok ? null : { title: "Leads could not be loaded", message: list.message }}
      />
    </ConsolePage>
  );
}
