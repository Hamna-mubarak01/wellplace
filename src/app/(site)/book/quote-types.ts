import type { BookingAddonCard } from "@/components/booking/booking-types";
import type { PricedBreakdown } from "@/lib/domain/pricing";
import type { CartLine, CartVoucher } from "@/lib/domain/vouchers";

export interface GuestQuoteRequest {
  readonly voucherCode?: string;
  readonly paymentOption?: "card" | "tabby";
  readonly dateOfBirth?: string;
  readonly startsAt: string;
  readonly durationHours: number;
  readonly adults: number;
  readonly childAges: readonly number[];
  readonly addonQuantities: Readonly<Record<string, number>>;
  readonly comparisonDurationsHours: readonly number[];
}

export interface GuestQuote {
  readonly cartVoucher?: CartVoucher | null;
  readonly revision?: string;
  readonly voucherMessage?: string | null;
  readonly breakdown: PricedBreakdown;
  readonly cart: readonly CartLine[];
  readonly addons: readonly BookingAddonCard[];
  readonly durationTotals: Readonly<Record<number, number>>;
  readonly offerLabel: string;
  readonly taxLabel: string;
  readonly taxPercent: number | null;
}

export type GuestQuoteResult =
  | { readonly status: "priced"; readonly quote: GuestQuote }
  | { readonly status: "unpriced"; readonly message: string };

export const QUOTE_UNAVAILABLE =
  "We could not work out your price just now. Your dates, times and details are unaffected — try again in a moment.";

export const QUOTE_RATE_LIMITED =
  "You have changed this booking a lot in a short time. Wait a moment, then change it again to see the new price.";

export const QUOTE_REJECTED =
  "That combination could not be priced. Change the length or the number of guests and we will work it out again.";
