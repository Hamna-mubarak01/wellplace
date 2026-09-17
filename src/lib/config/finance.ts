export const FINANCE_PATH = {
  root: "/manage/finance",
  payments: "/manage/finance/payments",
  refunds: "/manage/finance/refunds",
  invoices: "/manage/finance/invoices",
  invoiceSettings: "/manage/settings?group=invoices",
} as const;

export function invoicePath(invoiceId: string): string {
  return `${FINANCE_PATH.invoices}/${invoiceId}`;
}

export function invoiceDownloadPath(invoiceId: string): string {
  return `/api/console/invoices/${invoiceId}`;
}

export function creditNotePath(creditNoteId: string): string {
  return `${FINANCE_PATH.invoices}/credit-notes/${creditNoteId}`;
}

export function creditNoteDownloadPath(creditNoteId: string): string {
  return `/api/console/credit-notes/${creditNoteId}`;
}

export const INVOICE_ACTION_PARAM = "action";

export const INVOICE_REGENERATE_ACTION = "regenerate";

export function invoiceRegeneratePath(invoiceId: string): string {
  return `${invoicePath(invoiceId)}?${INVOICE_ACTION_PARAM}=${INVOICE_REGENERATE_ACTION}`;
}

export const INVOICES_EXPORT_PATH = "/api/console/invoices/export";

export function managedBookingPath(bookingId: string): string {
  return `/manage/bookings/${bookingId}`;
}

export function managedCustomerPath(customerId: string): string {
  return `/manage/customers/${customerId}`;
}

export const FINANCE_PERIODS = ["today", "week", "month", "all"] as const;

export type FinancePeriod = (typeof FINANCE_PERIODS)[number];

export const FINANCE_DEFAULT_PERIOD: FinancePeriod = "all";

export const FINANCE_WEEK_DAYS = 7;

export const FINANCE_PERIOD_LABEL: Readonly<Record<FinancePeriod, string>> = {
  today: "Today",
  week: `${FINANCE_WEEK_DAYS} days`,
  month: "This month",
  all: "All",
};

export const FINANCE_SUMMARY_READ = { chunkSize: 1000, maxChunks: 50, lookupChunkSize: 200 } as const;

export const CLOSED_BOOKING_STATUSES = ["cancelled", "abandoned", "hold_expired", "no_show", "rescheduled"] as const;
