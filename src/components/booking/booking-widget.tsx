"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useRouter } from "next/navigation";
import { trackBookingStep } from "@/lib/booking-events";
import { GUEST_CHECKOUT } from "@/lib/config/guest-checkout";
import {
  saveGuestCheckout,
  restoreGuestCheckout,
  startGuestPayment,
  finishSimulatedPayment,
  releaseGuestBooking,
  quoteGuestBooking,
} from "@/app/(site)/book/actions";
import type {
  GuestQuoteRequest,
  GuestQuoteResult,
} from "@/app/(site)/book/quote-types";
import { AddonsStep } from "@/components/booking/addons-step";
import { AvailabilityTagline } from "@/components/booking/availability-tagline";
import {
  validateDetails,
  validateDetailsField,
  type BookingDetails,
  type DetailsField,
} from "@/components/booking/booking-details";
import { BookingRail } from "@/components/booking/booking-rail";
import { BookingStepper } from "@/components/booking/booking-stepper";
import {
  BOOKING_STEPS,
  stepIndex,
  type BookingStepId,
} from "@/components/booking/booking-steps";
import { BookingSummary } from "@/components/booking/booking-summary";
import {
  guestsError,
  type AlternativeDate,
  type BookingAddonCard,
  type BookingDay,
  type BookingLimits,
  type GuestSelection,
} from "@/components/booking/booking-types";
import type { LineKey } from "@/components/booking/booking-summary";
import { ConfirmStep } from "@/components/booking/confirm-step";
import { DetailsStep } from "@/components/booking/details-step";
import { WhenStep } from "@/components/booking/when-step";
import { EMPTY_DOB } from "@/components/shared/dob-select";
import { emptyPhoneValue, toE164 } from "@/components/shared/phone-input";
import type { TimeSlot } from "@/components/shared/time-tile";
import { Button } from "@/components/shared/button";
import { experiencePeriod } from "@/lib/domain/buffer";
import { buildCart, GUEST_INVALID_VOUCHER_MESSAGE } from "@/lib/domain/vouchers";
import { receiptPagePath } from "@/lib/config/receipt";
import { cn } from "@/lib/utils";
import { guestClockLabel } from "@/components/booking/booking-date";

import { BookingConsent } from "@/components/booking/booking-consent";
import { SimulatedPayment } from "@/components/booking/simulated-payment";
import { PaymentNotice, type PaymentNoticeKind } from "@/components/booking/payment-notice";
import {
  CHECKOUT_FLOW,
  type CheckoutProgress,
  type PreparedPayment,
  type SimulationOutcome,
} from "@/lib/config/checkout-flow";

export interface BookingWidgetProps {
  gallery?: readonly import("@/components/booking/venue-carousel").VenueView[];
  initialCoupon?: string;
  preview?: boolean;
  days: readonly BookingDay[];
  limits: BookingLimits;
  initialDate: string;
  initialDurationHours: number;
  initialGuests: GuestSelection;
  addons: readonly BookingAddonCard[];
  personalRequestMaxLength: number;
  promoCodesLive: boolean;
  loading?: boolean;
  error?: string | null;
  addonsError?: string | null;
  initialHoldExpired?: boolean;
  email: string | null;
  paymentSimulation?: boolean;
  className?: string;
}

const RELEASED: TimeSlot["tile"] = {
  kind: "available",
  disabled: false,
  message: null,
  securedUntil: null,
};

const ALTERNATIVE_DATE_COUNT = 3;

interface SettledQuote {
  readonly key: string;
  readonly attempt: number;
  readonly result: GuestQuoteResult;
}

const EMPTY_DETAILS: BookingDetails = {
  salutation: "mr",
  firstName: "",
  lastName: "",
  dateOfBirth: EMPTY_DOB,
  email: "",
  phone: emptyPhoneValue(),
};

export function BookingWidget({
  gallery,
  initialCoupon = "",
  preview = false,
  days,
  limits,
  initialDate,
  initialDurationHours,
  initialGuests,
  addons,
  personalRequestMaxLength,
  promoCodesLive,
  loading = false,
  error = null,
  addonsError = null,
  initialHoldExpired = false,
  email,
  paymentSimulation = false,
  className,
}: BookingWidgetProps) {
  const router = useRouter();
  const [prepared, setPrepared] = useState<PreparedPayment | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<PaymentNoticeKind | null>(null);
  const [outcome, setOutcome] =
    useState<SimulationOutcome["outcome"]>("success");
  const [submitting, setSubmitting] = useState(false);
  const submitBusy = useRef(false);
  const paymentRequest = useRef<string | null>(null);
  const [restored, setRestored] = useState(preview);

  const [activeHold, setActiveHold] = useState<{
    startsAt: string;
    durationHours: number;
    expiresAt: string;
  } | null>(null);
  const [holding, setHolding] = useState(false);
  const holdBusy = useRef(false);
  const [paymentOption, setPaymentOption] = useState<"card" | "tabby">("card");
  const [simulatePayment, setSimulatePayment] = useState(paymentSimulation);
  const [step, setStep] = useState<BookingStepId>("details");
  const [furthest, setFurthest] = useState<BookingStepId>("details");

  const [details, setDetails] = useState<BookingDetails>(EMPTY_DETAILS);
  const [detailErrors, setDetailErrors] = useState<
    Partial<Record<DetailsField, string>>
  >({});
  const [showGuestErrors, setShowGuestErrors] = useState(false);

  const [dateKey, setDateKey] = useState(initialDate);
  const [durationHours, setDurationHours] = useState(initialDurationHours);
  const [guests, setGuests] = useState<GuestSelection>(initialGuests);
  const [addonQuantities, setAddonQuantities] = useState<
    Readonly<Record<string, number>>
  >({});
  const [personalRequest, setPersonalRequest] = useState("");
  const [promoCode, setPromoCode] = useState<string | null>(
    initialCoupon || null,
  );
  const [accepted, setAccepted] = useState(false);
  const [holdExpired, setHoldExpired] = useState(initialHoldExpired);
  const [timesOpen, setTimesOpen] = useState(false);
  const [releasedHolds, setReleasedHolds] = useState<readonly string[]>([]);
  const [availabilityError, setAvailabilityError] = useState(error);
  const [addonListError, setAddonListError] = useState(addonsError);
  const [settledQuote, setSettledQuote] = useState<SettledQuote | null>(null);
  const [quoteAttempt, setQuoteAttempt] = useState(0);

  const headingRef = useRef<HTMLHeadingElement>(null);

  const day = useMemo(
    () => days.find((entry) => entry.date === dateKey) ?? days[0],
    [days, dateKey],
  );

  const slots = useMemo(() => {
    const forDuration = day?.slotsByDuration[durationHours] ?? [];
    return forDuration.map((source): TimeSlot => {
      const slot = { ...source, label: guestClockLabel(source.startsAt) };
      if (
        activeHold?.startsAt === slot.startsAt &&
        activeHold.durationHours === durationHours
      ) {
        return {
          ...slot,
          tile: {
            kind: "secured",
            disabled: false,
            message: null,
            securedUntil: new Date(activeHold.expiresAt),
          },
        };
      }
      return preview && releasedHolds.includes(slot.startsAt)
        ? { ...slot, tile: RELEASED }
        : slot;
    });
  }, [day, durationHours, releasedHolds, activeHold, preview]);

  const [startsAt, setStartsAt] = useState<string | null>(() => {
    const initial = days.find((entry) => entry.date === initialDate);
    const initialSlots = initial?.slotsByDuration[initialDurationHours] ?? [];
    return (
      initialSlots.find((slot) => slot.tile.kind === "secured")?.startsAt ??
      null
    );
  });

  const selected = slots.find((slot) => slot.startsAt === startsAt) ?? null;
  const [pickedAvailability, setPickedAvailability] = useState<{ startsAt: string; message: string | null } | null>(null);
  const availabilityTagline =
    selected === null
      ? (day?.messageByDuration[durationHours] ?? null)
      : pickedAvailability?.startsAt === selected.startsAt
        ? pickedAvailability.message
        : selected.tile.kind === "available"
          ? selected.tile.message
          : null;

  const checkOutLabel = useMemo(() => {
    if (!selected) return null;
    const experience = experiencePeriod(
      new Date(selected.startsAt),
      durationHours,
    );
    return guestClockLabel(experience.end);
  }, [selected, durationHours]);

  const alternativeDurations = useMemo(
    () =>
      limits.durationsHours.filter(
        (hours) =>
          hours !== durationHours &&
          (day?.slotsByDuration[hours]?.length ?? 0) > 0,
      ),
    [limits.durationsHours, durationHours, day],
  );

  const alternativeDates = useMemo<readonly AlternativeDate[]>(() => {
    const from = days.findIndex((entry) => entry.date === dateKey);
    if (from === -1) return [];
    const found: AlternativeDate[] = [];
    for (const entry of days.slice(from + 1)) {
      if (found.length === ALTERNATIVE_DATE_COUNT) break;
      if (entry.status !== "open") continue;
      const hasBookable = (entry.slotsByDuration[durationHours] ?? []).some(
        (slot) => !slot.tile.disabled,
      );
      if (hasBookable) found.push({ date: entry.date, label: entry.label });
    }
    return found;
  }, [days, dateKey, durationHours]);

  const childAges = useMemo(
    () => guests.childAges.filter((age): age is number => age !== null),
    [guests.childAges],
  );

  const birthDate =
    details.dateOfBirth.year &&
    details.dateOfBirth.month &&
    details.dateOfBirth.day
      ? `${details.dateOfBirth.year}-${String(details.dateOfBirth.month).padStart(2, "0")}-${String(details.dateOfBirth.day).padStart(2, "0")}`
      : undefined;

  const quoteRequest = useMemo<GuestQuoteRequest | null>(() => {
    if (startsAt === null) return null;
    if (childAges.length !== guests.childAges.length) return null;

    return {
      voucherCode: promoCode ?? "",
      startsAt,
      durationHours,
      dateOfBirth: birthDate,
      paymentOption,
      adults: guests.adults,
      childAges,
      addonQuantities,
      comparisonDurationsHours: [],
    };
  }, [
    startsAt,
    durationHours,
    guests.adults,
    guests.childAges.length,
    childAges,
    addonQuantities,
    birthDate,
    paymentOption,
    promoCode,
  ]);

  const quoteKey = useMemo(
    () => (quoteRequest === null ? null : JSON.stringify(quoteRequest)),
    [quoteRequest],
  );

  useEffect(() => {
    if (quoteRequest === null || quoteKey === null) return;

    let live = true;

    void quoteGuestBooking(quoteRequest)
      .then((result) => {
        if (!live) return;
        setSettledQuote({ key: quoteKey, attempt: quoteAttempt, result });
        if (result.status === "priced" && result.quote.voucherMessage) {
          toast.error(GUEST_INVALID_VOUCHER_MESSAGE);
          setPromoCode(null);
        }
      })
      .catch(() => {
        if (live)
          setSettledQuote({
            key: quoteKey,
            attempt: quoteAttempt,
            result: {
              status: "unpriced",
              message: "Your price could not be loaded. Please try again.",
            },
          });
      });

    return () => {
      live = false;
    };
  }, [quoteRequest, quoteKey, quoteAttempt]);

  const progress = useMemo((): CheckoutProgress | null => {
    if (
      !accepted ||
      !birthDate ||
      !details.salutation ||
      childAges.length !== guests.childAges.length
    )
      return null;
    return {
      identity: {
        salutation: details.salutation,
        firstName: details.firstName,
        lastName: details.lastName,
        email: details.email,
        dateOfBirth: birthDate,
        phoneE164: toE164(details.phone),
        phoneCountry: details.phone.countryIso2,
      },
      selection: {
        date: dateKey,
        startsAt,
        durationHours,
        adults: guests.adults,
        childAges,
        addonQuantities: { ...addonQuantities },
        voucherCode: promoCode ?? "",
        personalRequest,
        paymentOption,
      },
      acceptedTerms: true,
      lastCompletedStep: BOOKING_STEPS[Math.max(0, stepIndex(furthest) - 1)].id,
    };
  }, [
    accepted,
    birthDate,
    details,
    childAges,
    guests,
    dateKey,
    startsAt,
    durationHours,
    addonQuantities,
    promoCode,
    personalRequest,
    paymentOption,
    furthest,
  ]);

  useEffect(() => {
    if (preview) return;
    let live = true;
    void restoreGuestCheckout()
      .then((saved) => {
        if (!live || !saved || saved.receiptToken) return;
        const [year, month, day] = saved.identity.dateOfBirth
          .split("-")
          .map(Number);
        const phone = emptyPhoneValue(saved.identity.phoneCountry);
        setDetails({
          ...saved.identity,
          dateOfBirth: { year, month, day },
          phone: {
            ...phone,
            nationalNumber: saved.identity.phoneE164.slice(
              phone.dialCode.length,
            ),
          },
        });
        setGuests({
          adults: saved.selection.adults,
          childAges: saved.selection.childAges,
        });
        setDurationHours(saved.selection.durationHours);
        setAddonQuantities(saved.selection.addonQuantities);
        setPersonalRequest(saved.selection.personalRequest);
        setPromoCode(saved.selection.voucherCode || null);
        setPaymentOption(saved.selection.paymentOption);
        setAccepted(true);
        if (saved.selection.date) setDateKey(saved.selection.date);
        if (saved.pendingPayment) {
          setPrepared(saved.pendingPayment);
          setStep("payment");
          setFurthest("payment");
          setStartsAt(saved.selection.startsAt);
          if (saved.selection.startsAt)
            setActiveHold({
              startsAt: saved.selection.startsAt,
              durationHours: saved.selection.durationHours,
              expiresAt: saved.pendingPayment.expiresAt,
            });
        } else {
          setStep("when");
          setFurthest("when");
        }
      })
      .catch(() =>
        toast.error(
          "Your saved booking could not be loaded. You can start again here.",
        ),
      )
      .finally(() => {
        if (live) setRestored(true);
      });
    return () => {
      live = false;
    };
  }, [preview]);

  useEffect(() => {
    if (!restored || preview || !progress || furthest === "details" || prepared)
      return;
    const timer = window.setTimeout(() => {
      void saveGuestCheckout(progress)
        .then((result) => {
          if (!result.ok) toast.error(result.message);
        })
        .catch(() => toast.error("Your latest changes could not be saved."));
    }, CHECKOUT_FLOW.saveDelayMilliseconds);
    return () => window.clearTimeout(timer);
  }, [progress, preview, restored, furthest, prepared]);

  const currentQuote =
    settledQuote !== null &&
    settledQuote.key === quoteKey &&
    (settledQuote.attempt === quoteAttempt || settledQuote.result.status === "priced")
      ? settledQuote.result
      : null;

  const quote = currentQuote?.status === "priced" ? currentQuote.quote : null;

  const lastPriced = settledQuote?.result.status === "priced" ? settledQuote.result.quote : null;
  const currentAddons = quote?.addons ?? lastPriced?.addons ?? addons;
  const cachedVoucher = lastPriced?.cartVoucher;
  const voucherForCart = promoCode && cachedVoucher?.code === promoCode.trim().toUpperCase() ? cachedVoucher : null;
  const pricedCart = quote?.cart ?? buildCart(currentAddons, addonQuantities, voucherForCart);
  useEffect(() => {
    if (!quoteRequest || prepared || !["addons", "confirm", "when"].includes(step)) return;
    const refresh = () => { if (document.visibilityState === "visible") setQuoteAttempt((attempt) => attempt + 1); };
    const timer = window.setInterval(refresh, CHECKOUT_FLOW.quoteRefreshMilliseconds);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [quoteRequest, prepared, step]);
  const appliedVoucherCode = useRef<string | null>(null);
  useEffect(() => {
    if (!promoCode) appliedVoucherCode.current = null;
    const voucher = quote?.cartVoucher;
    if (!voucher || voucher.code === appliedVoucherCode.current) return;
    appliedVoucherCode.current = voucher.code;
    setAddonQuantities((chosen) => Object.fromEntries(Object.entries(chosen).filter(([id, count]) => count !== 0 || !voucher.targetAddonIds.includes(id))));
  }, [quote?.cartVoucher, promoCode]);

  const quoteError =
    currentQuote?.status === "unpriced" ? currentQuote.message : null;

  const validatePromoCode = async (
    code: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> => {
    if (quoteRequest === null) return { ok: true };
    try {
      const result = await quoteGuestBooking({ ...quoteRequest, voucherCode: code });
      if (result.status !== "priced") return { ok: false, message: result.message };
      if (result.quote.voucherMessage) return { ok: false, message: GUEST_INVALID_VOUCHER_MESSAGE };
      return { ok: true };
    } catch {
      return { ok: false, message: "Your code could not be checked. Please try again." };
    }
  };

  const quoting = quoteKey !== null && currentQuote === null;
  const shownQuote = quote ?? (quoting ? lastPriced : null);
  const priceLoading = quoting && shownQuote === null;

  const dayHasTimes = useCallback(
    (nextDate: string, nextDuration: number) => {
      if (loading || availabilityError !== null) return true;
      const entry = days.find((day) => day.date === nextDate);
      return (entry?.slotsByDuration[nextDuration] ?? []).length > 0;
    },
    [days, loading, availabilityError],
  );

  const releaseSelection = async () => {
    if (preview || activeHold === null) return true;
    const result = await releaseGuestBooking();
    if (!result.ok) {
      toast.error(result.message);
      return false;
    }
    setActiveHold(null);
    return true;
  };

  const handleDateChange = async (next: string) => {
    if (holdBusy.current) return;
    holdBusy.current = true;
    setHolding(true);
    try {
      if (next !== dateKey && !(await releaseSelection())) return;
      setDateKey(next);
      if (next !== dateKey) {
        setStartsAt(null);
        setHoldExpired(false);
      }
      setTimesOpen(dayHasTimes(next, durationHours));
    } finally {
      holdBusy.current = false;
      setHolding(false);
    }
  };

  const handleDurationChange = async (next: number) => {
    if (holdBusy.current) return;
    holdBusy.current = true;
    setHolding(true);
    try {
      if (!(await releaseSelection())) return;
      setDurationHours(next);
      setStartsAt(null);
      setHoldExpired(false);
      setTimesOpen((open) => open && dayHasTimes(dateKey, next));
    } finally {
      holdBusy.current = false;
      setHolding(false);
    }
  };

  const handleTimeChange = async (next: string | null) => {
    if (holdBusy.current) return;
    if (next !== null) {
      const picked = slots.find((slot) => slot.startsAt === next);
      if (picked && picked.tile.kind === "available") setPickedAvailability({ startsAt: next, message: picked.tile.message });
    }
    const keepsHold =
      activeHold !== null &&
      activeHold.startsAt === next &&
      activeHold.durationHours === durationHours;
    if (preview || activeHold === null || keepsHold) {
      setStartsAt(next);
      setHoldExpired(false);
      return;
    }
    holdBusy.current = true;
    setHolding(true);
    try {
      if (!(await releaseSelection())) return;
      setStartsAt(next);
      setHoldExpired(false);
    } finally {
      holdBusy.current = false;
      setHolding(false);
    }
  };

  const handleHoldExpire = useCallback((expired: string) => {
    setReleasedHolds((current) =>
      current.includes(expired) ? current : [...current, expired],
    );
    setActiveHold(null);
    setHoldExpired(true);
    setStartsAt((current) => (current === expired ? null : current));
  }, []);

  useEffect(() => {
    if (preview) return;
    const refresh = () => {
      if (
        document.visibilityState === "visible" &&
        navigator.onLine &&
        !holdBusy.current
      ) {
        router.refresh();
        setQuoteAttempt((attempt) => attempt + 1);
      }
    };
    const interval = window.setInterval(
      refresh,
      GUEST_CHECKOUT.refreshMilliseconds,
    );
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, preview]);

  const handleBlurField = useCallback(
    (field: DetailsField, next?: BookingDetails) => {
      const source = next ?? details;
      setDetailErrors((current) => {
        const message = validateDetailsField(
          field,
          source,
          limits.bookerMinAge,
        );
        const next = { ...current };
        if (message) next[field] = message;
        else delete next[field];
        return next;
      });
    },
    [details, limits.bookerMinAge],
  );

  const goTo = useCallback((next: BookingStepId) => {
    setStep(next);
    window.requestAnimationFrame(() => headingRef.current?.focus());
  }, []);

  const preparedRef = useRef<PreparedPayment | null>(null);
  useEffect(() => {
    preparedRef.current = prepared;
  }, [prepared]);

  const leavePaymentOnExpiry = useCallback(() => {
    if (preparedRef.current === null) return;
    preparedRef.current = null;
    setPrepared(null);
    paymentRequest.current = null;
    setPaymentNotice("expired");
    goTo("confirm");
  }, [goTo]);

  useEffect(() => {
    if (!activeHold) return;
    const timeout = window.setTimeout(
      () => {
        handleHoldExpire(activeHold.startsAt);
        leavePaymentOnExpiry();
      },
      Math.max(0, new Date(activeHold.expiresAt).getTime() - Date.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [activeHold, handleHoldExpire, leavePaymentOnExpiry]);

  const completed = useMemo(() => {
    const upto = stepIndex(furthest);
    return BOOKING_STEPS.slice(0, upto)
      .map((entry) => entry.id)
      .filter((id) => id !== step);
  }, [furthest, step]);

  const advance = (next: BookingStepId) => {
    if (progress && !preview)
      trackBookingStep(
        "booking_step_completed",
        { ...progress, lastCompletedStep: step },
        quote?.breakdown.totalFils,
      );
    if (stepIndex(next) > stepIndex(furthest)) setFurthest(next);
    goTo(next);
  };

  const primary = {
    details: { label: "Continue to date and time", disabled: false },
    when: {
      label: "Continue to add-ons",
      disabled: holding,
    },
    addons: { label: "Continue to check your booking", disabled: false },
    confirm: {
      label: simulatePayment ? "Pay with simulation" : "Continue to payment",
      disabled: quoting || !quote || !accepted || !startsAt || (paymentSimulation && !simulatePayment),
    },
    payment: { label: "Run payment simulation", disabled: !prepared },
  }[step];

  const handlePrimary = async () => {
    if (submitBusy.current) return;
    if (preview && step !== "details" && step !== "when" && step !== "addons") {
      toast.info("This preview cannot create a booking.");
      return;
    }

    if (step === "details") {
      const errors = validateDetails(details, limits.bookerMinAge);
      const party = guestsError(guests, limits);
      setDetailErrors(errors);
      setShowGuestErrors(true);

      if (Object.keys(errors).length > 0 || party !== null) {
        toast.error(
          party !== null && Object.keys(errors).length === 0
            ? party
            : "Check the highlighted fields and try again.",
        );
        return;
      }
      if (!accepted || !progress) {
        toast.error("Accept the booking terms to continue.");
        return;
      }
      if (!preview) {
        submitBusy.current = true;
        setSubmitting(true);
        try {
          const saved = await saveGuestCheckout(progress, { captureCustomer: true });
          if (!saved.ok) {
            toast.error(saved.message);
            return;
          }
        } catch {
          toast.error("Your details could not be saved. Please try again.");
          return;
        } finally {
          submitBusy.current = false;
          setSubmitting(false);
        }
      }
      advance("when");
      return;
    }

    if (step === "when") {
      if (!startsAt) {
        toast.error("Choose a start time to continue.");
        return;
      }
      advance("addons");
      return;
    }

    if (step === "addons") {
      advance("confirm");
      return;
    }
    if (step === "confirm" && progress && quote && startsAt) {
      submitBusy.current = true;
      setSubmitting(true);
      paymentRequest.current ??= crypto.randomUUID();
      setPaymentNotice(null);
      try {
        const result = await startGuestPayment({
          ...progress,
          expectedTotalFils: quote.breakdown.totalFils,
          revision: quote.revision,
          requestId: paymentRequest.current,
        });
        if (!result.ok) {
          toast.error(result.message);
          if ("timeUnavailable" in result) {
            paymentRequest.current = null;
            setStartsAt(null);
            router.refresh();
            goTo("when");
            setTimesOpen(true);
            return;
          }
          setQuoteAttempt((value) => value + 1);
          return;
        }
        setActiveHold({ startsAt, durationHours, expiresAt: result.value.expiresAt });
        setHoldExpired(false);
        if (result.value.redirectUrl) {
          window.location.assign(result.value.redirectUrl);
          return;
        }
        if (simulatePayment && result.value.simulated) {
          const settled = await finishSimulatedPayment({ paymentId: result.value.paymentId, outcome: "success" });
          if (settled.ok && settled.value.receiptToken) {
            trackBookingStep(
              "booking_payment_result",
              { ...progress, lastCompletedStep: "payment" },
              result.value.amountFils,
              settled.value.status,
            );
            router.push(receiptPagePath(settled.value.receiptToken, true));
            return;
          }
          toast.error(settled.ok ? "The simulated payment is still being checked. Try again." : settled.message);
        }
        setPrepared(result.value);
        advance("payment");
      } catch {
        toast.error("Payment could not be started. Please try again.");
      } finally {
        submitBusy.current = false;
        setSubmitting(false);
      }
    } else if (step === "payment" && prepared) {
      submitBusy.current = true;
      setSubmitting(true);
      try {
        const result = await finishSimulatedPayment({
          paymentId: prepared.paymentId,
          outcome,
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        if (progress)
          trackBookingStep(
            "booking_payment_result",
            { ...progress, lastCompletedStep: "payment" },
            prepared.amountFils,
            result.value.status,
          );
        if (result.value.receiptToken) {
          router.push(receiptPagePath(result.value.receiptToken, true));
          return;
        }
        if (result.value.status === "pending") {
          setPaymentNotice("pending");
          return;
        }
        const declined = result.value.status === "failed";
        toast.error(
          declined
            ? "Payment was declined. No money was charged. You can retry while your time is held."
            : "Payment was cancelled. No money was charged.",
        );
        setPaymentNotice(declined ? "failed" : "cancelled");
        setPrepared(null);
        paymentRequest.current = null;
        advance("confirm");
      } catch {
        toast.error(
          "The payment result could not be checked. Try again; your payment will not be duplicated.",
        );
      } finally {
        submitBusy.current = false;
        setSubmitting(false);
      }
    }
  };

  const currentIndex = stepIndex(step);
  const currentStep = BOOKING_STEPS[currentIndex];

  const showBar = step === "when" || step === "addons";

  const showRail = step !== "confirm" && step !== "payment";

  const previous = currentIndex > 0 ? BOOKING_STEPS[currentIndex - 1] : null;
  const canGoBack = previous !== null && completed.includes(previous.id);

  const railFields: readonly LineKey[] =
    step === "when"
      ? ["date", "checkin", "checkout"]
      : ["date", "checkin", "checkout", "guests"];

  const summary = {
    dayLabel: day?.label ?? "",
    checkInLabel: selected?.label ?? null,
    checkOutLabel,
    guests,
    limits,
    securedUntil: selected?.tile.securedUntil ?? null,
    holdExpired,
    loading,
    onEdit: goTo,
    currentStep: step,
    reachedStep: furthest,
  };

  return (
    <div className={className}>
      <div className="mx-auto w-full max-w-widget px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="booking-widget-panel overflow-clip rounded-(--radius-modal) border border-border bg-surface-raised">
          <div className="border-b border-border px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
            <BookingStepper
              navigationLocked={submitting || prepared !== null}
              current={step}
              completed={completed}
              onNavigate={(next) => {
                if (!submitting && !prepared) goTo(next);
              }}
            />
          </div>

          <div
            className={cn(
              showRail &&
                "lg:grid lg:grid-cols-[minmax(0,1fr)_var(--container-rail)] lg:items-stretch",
            )}
          >
            <div className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
              <AvailabilityTagline
                message={
                  step === "payment" || loading || availabilityError !== null
                    ? null
                    : availabilityTagline
                }
                className="mb-5"
              />
              <div key={step} className="step-change min-w-0">
                <h2 ref={headingRef} tabIndex={-1} className="sr-only">
                  {currentStep?.heading}
                </h2>

                {step === "details" ? (
                  <section aria-labelledby="book-details-heading">
                    <h2 id="book-details-heading" className="sr-only">
                      Your details
                    </h2>
                    <DetailsStep
                      details={details}
                      onChange={setDetails}
                      bookerMinAge={limits.bookerMinAge}
                      errors={detailErrors}
                      onBlurField={handleBlurField}
                    />
                    <BookingConsent accepted={accepted} onChange={setAccepted} />
                  </section>
                ) : step === "when" ? (
                  <WhenStep
                    days={days}
                    dateKey={dateKey}
                    onDateChange={handleDateChange}
                    durationsHours={limits.durationsHours}
                    durationHours={durationHours}
                    onDurationChange={handleDurationChange}
                    slots={slots}
                    dayStatus={day?.status ?? "hours-unpublished"}
                    dayLabel={day?.label ?? ""}
                    alternativeDurations={alternativeDurations}
                    alternativeDates={alternativeDates}
                    startsAt={startsAt}
                    onStartsAtChange={handleTimeChange}
                    onHoldExpire={handleHoldExpire}
                    timesOpen={timesOpen}
                    onTimesOpenChange={setTimesOpen}
                    loading={loading || holding}
                    error={availabilityError}
                    onRetry={() => setAvailabilityError(null)}
                  />
                ) : step === "addons" ? (
                  <AddonsStep
                    addons={currentAddons}
                    cart={pricedCart}
                    quantities={addonQuantities}
                    onQuantitiesChange={setAddonQuantities}
                    personalRequest={personalRequest}
                    onPersonalRequestChange={setPersonalRequest}
                    personalRequestMaxLength={personalRequestMaxLength}
                    promoCode={promoCode}
                    onPromoCodeChange={setPromoCode}
                    onValidatePromoCode={validatePromoCode}
                    promoCodesLive={promoCodesLive}
                    loading={loading}
                    error={addonListError}
                    onRetry={() => setAddonListError(null)}
                  />
                ) : step === "payment" && prepared ? (
                  <>
                    {paymentNotice === "pending" && <PaymentNotice kind="pending" />}
                    <SimulatedPayment
                      payment={prepared}
                      outcome={outcome}
                      onChange={setOutcome}
                      onHoldExpire={() => {
                        setHoldExpired(true);
                        leavePaymentOnExpiry();
                      }}
                      disabled={submitting}
                    />
                  </>
                ) : (
                  <>
                  {step === "confirm" && paymentNotice !== null && paymentNotice !== "pending" && (
                    <PaymentNotice kind={paymentNotice} />
                  )}
                  <ConfirmStep
                    paymentOption={paymentOption}
                    onPaymentOptionChange={setPaymentOption}
                    paymentSimulation={paymentSimulation}
                    simulatePayment={simulatePayment}
                    onSimulatePaymentChange={setSimulatePayment}
                    details={details}
                    dayLabel={day?.label ?? ""}
                    timeLabel={selected?.label ?? null}
                    checkOutLabel={checkOutLabel}
                    durationHours={durationHours}
                    guests={guests}
                    cart={pricedCart}
                    personalRequest={personalRequest}
                    promoCode={promoCode}
                    promoCodesLive={promoCodesLive}
                    breakdown={shownQuote?.breakdown ?? null}
                    taxLabel={shownQuote?.taxLabel ?? ""}
                    taxPercent={shownQuote?.taxPercent ?? null}
                    priceLoading={priceLoading}
                    priceError={quoteError}
                    onPriceRetry={() => setQuoteAttempt((count) => count + 1)}
                    loading={loading}
                    securedUntil={selected?.tile.securedUntil ?? null}
                    holdExpired={holdExpired}
                    accepted={accepted}
                    onAcceptedChange={setAccepted}
                    onEdit={goTo}
                    email={email}
                  />
                  </>
                )}
              </div>
            </div>

            {showRail ? (
              <div className="border-t border-border bg-surface-sunken lg:border-t-0 lg:border-l">
                <div className="lg:sticky lg:top-0">
                  <BookingRail
                    gallery={gallery}
                    limits={limits}
                    guests={guests}
                    onGuestsChange={setGuests}
                    showGuestErrors={showGuestErrors}
                    summary={summary}
                    showParty={step === "details"}
                    showSummary={step !== "details"}
                    showVenue={step === "details"}
                    showPrice={step === "addons" || step === "when"}
                    railFields={railFields}
                    onChooseTime={
                      step === "when" ? () => setTimesOpen(true) : undefined
                    }
                    breakdown={shownQuote?.breakdown ?? null}
                    taxLabel={shownQuote?.taxLabel ?? ""}
                    taxPercent={shownQuote?.taxPercent ?? null}
                    durationHours={durationHours}
                    priceLoading={priceLoading}
                    awaitingStartTime={startsAt === null}
                    priceError={quoteError}
                    onPriceRetry={() => setQuoteAttempt((count) => count + 1)}
                    loading={loading}
                    priceHeading="Your price so far"
                    email={email}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="booking-widget-actions sticky bottom-0 z-10 border-t border-border bg-surface-raised px-4 pt-3 pb-safe sm:px-6 lg:static lg:px-8 lg:py-5">
            {showBar ? (
              <BookingSummary
                layout="bar"
                className="mb-3 lg:hidden"
                {...summary}
              />
            ) : null}

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
              {canGoBack && !prepared ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => goTo(previous.id)}
                  aria-label={`Back to ${previous.label.toLowerCase()}`}
                  className="hidden h-control shrink-0 gap-2 rounded-(--radius-card) px-4 text-control font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary md:inline-flex lg:px-5"
                >
                  <ArrowLeftIcon aria-hidden className="size-4" />
                  Back
                </Button>
              ) : null}

              <Button
                type="button"
                onClick={handlePrimary}
                disabled={primary.disabled || submitting || !restored}
                aria-disabled={primary.disabled || undefined}
                className="h-control w-full shrink-0 rounded-(--radius-card) bg-brand text-control font-medium text-on-brand hover:bg-brand-hover disabled:opacity-40 lg:ml-auto lg:w-auto lg:px-6"
              >
                {submitting ? "Please wait…" : primary.label}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
