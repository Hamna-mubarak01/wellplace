import {
  financeWindows,
  isFinanceFiltered,
  listWindow,
  oneOf,
  parseFinanceQuery,
  single,
  type FinanceListQuery,
  type FinanceSearchParams,
  type FinanceWindows,
} from "@/app/(console)/manage/finance/finance-query";
import { INVOICE_STATES, TAX_DOCUMENT_TYPES, type InvoiceState, type TaxDocumentType } from "@/lib/db/invoice-record";
import type { InvoiceQuery } from "@/lib/db/queries/invoices";

export interface InvoiceListQuery {
  readonly query: FinanceListQuery;
  readonly type: TaxDocumentType | null;
  readonly state: InvoiceState | null;
  readonly windows: FinanceWindows;
  readonly filtered: boolean;
  readonly request: Omit<InvoiceQuery, "page" | "pageSize">;
}

export function parseInvoiceListQuery(params: FinanceSearchParams, now: Date): InvoiceListQuery {
  const query = parseFinanceQuery(params);
  const type = oneOf(single(params.type), TAX_DOCUMENT_TYPES);
  const state = oneOf(single(params.state), INVOICE_STATES);
  const windows = financeWindows(now);
  const window = listWindow(query, windows.todayIso);

  return {
    query,
    type,
    state,
    windows,
    filtered: isFinanceFiltered(query, [type, state]),
    request: {
      search: query.search,
      type: type ?? undefined,
      state: state ?? undefined,
      from: window?.from,
      to: window?.to,
    },
  };
}
