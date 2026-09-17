"use client";

import { NO_START_TIMES_MESSAGE } from "@/lib/domain/action-errors";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { quoteWalkIn } from "@/app/(console)/reception/actions";
import type { PricedBreakdown } from "@/lib/domain/pricing";
import type { TimeSlot } from "@/components/shared/time-tile";
import type { GuestRules, ReceptionBookingInput } from "@/lib/validation/reception-booking";
import {
  WalkInDialog,
  type WalkInResult,
  type WalkInSelection,
} from "@/components/console/reception/walk-in-dialog";
import {
  grantFromCart,
  type ReceptionAddonOption,
  type VoucherGrant,
} from "@/components/console/reception/walk-in-form";
import type { VoucherState } from "@/components/console/reception/walk-in-price";

interface SlotPayload {
  startsAt: string;
  label: string;
  disabled: boolean;
  message: string | null;
  kind: "available" | "secured" | "unavailable";
}

interface AvailabilityPayload {
  status: "open" | "closed" | "hours_unconfigured" | "error" | "invalid" | "rate_limited";
  slots?: SlotPayload[];
}

const STATUS_MESSAGE: Partial<Record<AvailabilityPayload["status"], string>> = {
  closed: NO_START_TIMES_MESSAGE,
  hours_unconfigured:
    "Opening hours have not been set yet. Add them in Management first.",
  error: "Availability could not be loaded.",
  invalid: "That date could not be read.",
  rate_limited: "Too many availability checks. Wait a moment and try again.",
};

const VOUCHER_DEBOUNCE_MS = 300;

interface ResolvedQuote {
  key: string;
  value: PricedBreakdown | null;
  voucherMessage: string | null;
  error: string | null;
}

const NO_QUOTE: ResolvedQuote = {
  key: "",
  value: null,
  voucherMessage: null,
  error: null,
};

export interface WalkInLauncherProps {
  initialCustomer?: import("@/lib/db/queries/reception-customers").ReceptionCustomer | null;
  triggerLabel?: string;
  rules: GuestRules;
  offerLabel: string;
  taxLabel: string;
  maxHorizonDays?: number | null;
  earliestDate?: string;
  durationsHours: readonly number[];
  initialDate: string;
  addons?: readonly ReceptionAddonOption[];
  onSubmit: (input: ReceptionBookingInput) => Promise<WalkInResult>;
}

export function WalkInLauncher({
  initialCustomer,
  triggerLabel,
  rules,
  offerLabel,
  taxLabel,
  maxHorizonDays,
  earliestDate,
  durationsHours,
  initialDate,
  addons = [],
  onSubmit,
}: WalkInLauncherProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(initialDate);
  const [durationHours, setDurationHours] = useState(durationsHours[0] ?? 0);
  const [reloadToken, setReloadToken] = useState(0);

  const requestKey = `${date}|${durationHours}|${reloadToken}`;

  const [resolved, setResolved] = useState<{
    key: string;
    slots: readonly TimeSlot[];
    error: string | null;
  }>({ key: "", slots: [], error: null });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const query = new URLSearchParams({
      date,
      durationHours: String(durationHours),
    });

    fetch(`/api/availability?${query.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as AvailabilityPayload;
        if (cancelled) return;

        if (payload.status !== "open") {
          setResolved({
            key: requestKey,
            slots: [],
            error: STATUS_MESSAGE[payload.status] ?? "Availability is unavailable.",
          });
          return;
        }

        setResolved({
          key: requestKey,
          error: null,
          slots: (payload.slots ?? []).map((slot) => ({
            startsAt: slot.startsAt,
            label: slot.label,
            tile: {
              kind: slot.kind,
              disabled: slot.disabled,
              message: slot.message,
              securedUntil: null,
            },
          })),
        });
      })
      .catch(() => {
        if (cancelled) return;
        setResolved({
          key: requestKey,
          slots: [],
          error: "Availability could not be loaded.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [open, date, durationHours, requestKey]);

  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [adults, setAdults] = useState(rules.guestsMin);
  const [childAges, setChildAges] = useState<readonly (number | null)[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [addonQuantities, setAddonQuantities] = useState<
    Readonly<Record<string, number>>
  >({});
  const [voucherCode, setVoucherCode] = useState("");
  const [settledVoucher, setSettledVoucher] = useState("");
  const [voucherGrant, setVoucherGrant] = useState<VoucherGrant | null>(null);
  const [quoteRetry, setQuoteRetry] = useState(0);
  const [resolvedQuote, setResolvedQuote] = useState<ResolvedQuote>(NO_QUOTE);

  const typedVoucher = voucherCode.trim().toUpperCase();

  useEffect(() => {
    if (typedVoucher === settledVoucher) return;

    const timer = setTimeout(
      () => setSettledVoucher(typedVoucher),
      VOUCHER_DEBOUNCE_MS,
    );

    return () => clearTimeout(timer);
  }, [typedVoucher, settledVoucher]);

  const addonKey = useMemo(
    () =>
      Object.entries(addonQuantities)
        .filter(([, quantity]) => Number.isFinite(quantity))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([id, quantity]) => `${id}:${quantity}`)
        .join(","),
    [addonQuantities],
  );

  const quoteKey =
    startsAt === null
      ? ""
      : `${startsAt}|${durationHours}|${adults}|${JSON.stringify(childAges)}|${customerId}|${addonKey}|${settledVoucher}|${quoteRetry}`;

  useEffect(() => {
    if (!open || quoteKey === "" || startsAt === null || childAges.some((age) => age === null)) return;

    let cancelled = false;

    quoteWalkIn({
      startsAt,
      durationHours,
      adults,
      childAges: childAges.filter((age): age is number => age !== null),
      customerId,
      addonQuantities: { ...addonQuantities },
      voucherCode: settledVoucher === "" ? null : settledVoucher,
    })
      .then((result) => {
        if (cancelled) return;

        if (!result.ok) {
          setResolvedQuote({
            key: quoteKey,
            value: null,
            voucherMessage: null,
            error: result.message,
          });
          return;
        }

        setVoucherGrant(grantFromCart(result.cart));
        setResolvedQuote({
          key: quoteKey,
          value: result.breakdown,
          voucherMessage: result.voucherMessage,
          error: null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedQuote({
          key: quoteKey,
          value: null,
          voucherMessage: null,
          error: "The connection was interrupted while calculating the price. Check your connection and try again.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    open,
    quoteKey,
    startsAt,
    durationHours,
    adults,
    childAges,
    customerId,
    addonQuantities,
    settledVoucher,
  ]);

  const settled = resolvedQuote.key === quoteKey;
  const missingChildAge = childAges.some((age) => age === null);
  const quotePending = quoteKey !== "" && !settled && !missingChildAge;
  const quote = quoteKey === "" || !settled ? null : resolvedQuote.value;
  const quoteError = missingChildAge ? "Enter each child’s age to calculate the price." : quoteKey === "" || !settled ? null : resolvedQuote.error;
  const voucherMessage = settled ? resolvedQuote.voucherMessage : null;

  const activeGrant =
    voucherGrant !== null &&
    voucherGrant.code.trim().toUpperCase() === typedVoucher
      ? voucherGrant
      : null;

  const voucherState: VoucherState = (() => {
    if (typedVoucher === "") return "none";
    if (startsAt === null) return "unchecked";
    if (quotePending || settledVoucher !== typedVoucher) return "checking";
    if (resolvedQuote.error !== null) return "unchecked";
    return voucherMessage === null ? "applied" : "refused";
  })();

  const loading = resolved.key !== requestKey;
  const slots = loading ? [] : resolved.slots;
  const error = loading ? null : resolved.error;

  const retry = useCallback(() => setReloadToken((token) => token + 1), []);

  const handleSelectionChange = useCallback((next: WalkInSelection) => {
    setStartsAt(next.startsAt);
    setAdults(next.adults);
    setChildAges(next.childAges ?? []);
    setCustomerId(next.customerId ?? null);
    setAddonQuantities(next.addonQuantities);
    setVoucherCode(next.voucherCode);
  }, []);

  if (durationsHours.length === 0) {
    return (
      <p className="rounded-(--radius-control) border border-warning-border bg-warning-wash px-3 py-2 text-console-body text-warning-ink">
        No bookable durations are configured yet.
      </p>
    );
  }

  return (
    <WalkInDialog
      initialCustomer={initialCustomer}
      triggerLabel={triggerLabel}
      onOpenChange={(next) => { setOpen(next); if (next) { retry(); setQuoteRetry((token) => token + 1); } }}
      rules={rules}
      offerLabel={offerLabel}
      taxLabel={taxLabel}
      voucherMessage={voucherMessage}
      voucherState={voucherState}
      voucherGrant={activeGrant}
      maxHorizonDays={maxHorizonDays}
      earliestDate={earliestDate}
      durationsHours={durationsHours}
      date={date}
      onDateChange={setDate}
      durationHours={durationHours}
      onDurationChange={setDurationHours}
      slots={slots}
      slotsLoading={loading}
      slotsError={error}
      onRetrySlots={retry}
      addons={addons}
      quote={quote}
      quotePending={quotePending}
      quoteError={quoteError}
      onRetryQuote={missingChildAge ? undefined : () => setQuoteRetry((token) => token + 1)}
      onSelectionChange={handleSelectionChange}
      onSubmit={onSubmit}
      onCreated={() => {
        retry();
        router.refresh();
      }}
    />
  );
}
