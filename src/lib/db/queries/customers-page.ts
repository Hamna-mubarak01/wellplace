import type { WellPlaceClient } from "@/lib/db/types";
import { listManagementCustomers, type CustomerFilter } from "@/lib/db/queries/management-customers";

export interface CustomerTotals {
  readonly customers: number;
  readonly returning: number;
  readonly upcoming: number;
}

export type CustomerTotalsResult =
  | { ok: true; totals: CustomerTotals }
  | { ok: false; message: string };

const TOTALS_UNAVAILABLE = "Customer totals could not be loaded. Refresh the page to try again.";

async function countByFilter(client: WellPlaceClient, filter: CustomerFilter): Promise<number | null> {
  const result = await listManagementCustomers(client, { page: 1, pageSize: 1, filter });
  return result.ok ? result.total : null;
}

export async function readCustomerTotals(client: WellPlaceClient): Promise<CustomerTotalsResult> {
  const [customers, returning, upcoming] = await Promise.all([
    countByFilter(client, "customers"),
    countByFilter(client, "returning"),
    countByFilter(client, "upcoming"),
  ]);

  if (customers === null || returning === null || upcoming === null) {
    return { ok: false, message: TOTALS_UNAVAILABLE };
  }

  return { ok: true, totals: { customers, returning, upcoming } };
}
