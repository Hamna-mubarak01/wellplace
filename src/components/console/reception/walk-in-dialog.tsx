"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { LoaderCircleIcon, UserPlusIcon } from "lucide-react";
import { toast } from "@/lib/console/feedback";

import { Button } from "@/components/shared/button";
import {
  EMPTY_DOB,
  calculateAge,
  type DateOfBirthValue,
} from "@/components/shared/dob-select";
import {
  emptyPhoneValue,
  type PhoneValue,
} from "@/components/shared/phone-input";
import { TermsAcceptanceField } from "@/components/shared/terms-acceptance-field";
import type { TimeSlot } from "@/components/shared/time-tile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/console/reception/reception-dialog";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { ConsoleCard, ConsoleCardBody } from "@/components/console/console-surface";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { DESK_PAYMENT_METHODS, DESK_PAYMENT_METHOD_LABEL, RECEPTION_BOOKING_SOURCE, type DeskPaymentMethod } from "@/lib/config/reception";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CUSTOMER_MISMATCH_MESSAGE, EXISTING_CUSTOMER_EMAIL_MESSAGE } from "@/lib/domain/action-errors";
import type { PricedBreakdown } from "@/lib/domain/pricing";
import { buildCart } from "@/lib/domain/vouchers";
import {
  checkGuestRules,
  type GuestRules,
  type ReceptionBookingInput,
} from "@/lib/validation/reception-booking";
import { WalkInExtras } from "@/components/console/reception/walk-in-extras";
import {
  HINT_CLASS,
  LEGEND_CLASS,
  fieldId,
  focusField,
  grantAsVoucher,
  type ReceptionAddonOption,
  type Salutation,
  type VoucherGrant,
} from "@/components/console/reception/walk-in-form";
import { WalkInGuests } from "@/components/console/reception/walk-in-guests";
import { WalkInIdentity } from "@/components/console/reception/walk-in-identity";
import {
  WalkInPrice,
  type VoucherState,
} from "@/components/console/reception/walk-in-price";
import {
  resolveAgreedPrice,
  validateWalkIn,
} from "@/components/console/reception/walk-in-validate";
import type { ReceptionCustomer } from "@/lib/db/queries/reception-customers";
import { BookingCustomerPicker } from "@/components/console/reception/booking-customer-picker";
import { BookingSuitePicker } from "@/components/console/reception/booking-suite-picker";
import { WalkInWhen } from "@/components/console/reception/walk-in-when";

export type { ReceptionAddonOption };

export interface WalkInSelection {
  readonly startsAt: string | null;
  readonly adults: number;
  readonly children: number;
  readonly childAges?: readonly (number | null)[];
  readonly customerId?: string | null;
  readonly addonQuantities: Readonly<Record<string, number>>;
  readonly voucherCode: string;
}

export type WalkInResult =
  | { status: "created"; reference: string; suiteNumber: number }
  | { status: "no_suite" }
  | { status: "refused"; message: string }
  | { status: "error"; message: string };

export interface WalkInDialogProps {
  initialCustomer?: ReceptionCustomer | null;
  triggerLabel?: string;
  onOpenChange?: (open: boolean) => void;
  rules: GuestRules;
  offerLabel: string;
  taxLabel: string;
  voucherMessage?: string | null;
  maxHorizonDays?: number | null;
  earliestDate?: string;
  durationsHours: readonly number[];
  date: string;
  onDateChange: (date: string) => void;
  durationHours: number;
  onDurationChange: (durationHours: number) => void;
  slots: readonly TimeSlot[];
  slotsLoading?: boolean;
  slotsError?: string | null;
  onRetrySlots?: () => void;
  addons?: readonly ReceptionAddonOption[];
  quote?: PricedBreakdown | null;
  quotePending?: boolean;
  quoteError?: string | null;
  onRetryQuote?: () => void;
  voucherGrant?: VoucherGrant | null;
  voucherState?: VoucherState;
  onSelectionChange?: (next: WalkInSelection) => void;
  onSubmit: (input: ReceptionBookingInput) => Promise<WalkInResult>;
  onCreated?: (booking: { reference: string; suiteNumber: number }) => void;
}

const ACTION_LABEL = "Create booking";
const OPEN_LABEL = "New booking";

export function WalkInDialog({
  initialCustomer = null,
  triggerLabel = OPEN_LABEL,
  onOpenChange,
  rules,
  offerLabel,
  taxLabel,
  voucherMessage = null,
  maxHorizonDays,
  earliestDate,
  durationsHours,
  date,
  onDateChange,
  durationHours,
  onDurationChange,
  slots,
  slotsLoading = false,
  slotsError = null,
  onRetrySlots,
  addons = [],
  quote = null,
  quotePending = false,
  quoteError = null,
  onRetryQuote,
  voucherGrant = null,
  voucherState = "none",
  onSelectionChange,
  onSubmit,
  onCreated,
}: WalkInDialogProps) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  const [customer, setCustomer] = useState<ReceptionCustomer | null>(null);
  const [suiteId, setSuiteId] = useState<string | null>(null);
  const [suiteRevision, setSuiteRevision] = useState(0);

  const [salutation, setSalutation] = useState<Salutation>("mr");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState<DateOfBirthValue>(EMPTY_DOB);
  const [phone, setPhone] = useState<PhoneValue>(() => emptyPhoneValue());

  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [adults, setAdults] = useState(rules.guestsMin);
  const [childAges, setChildAges] = useState<(number | null)[]>([]);

  const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>({});
  const [voucherCode, setVoucherCode] = useState("");

  useEffect(() => {
    onSelectionChange?.({
      startsAt,
      adults,
      children: childAges.length,
      childAges,
      customerId: customer?.id ?? null,
      addonQuantities,
      voucherCode,
    });
  }, [
    onSelectionChange,
    startsAt,
    adults,
    childAges,
    customer,
    addonQuantities,
    voucherCode,
  ]);

  const cart = useMemo(
    () => buildCart(addons, addonQuantities, grantAsVoucher(voucherGrant)),
    [addons, addonQuantities, voucherGrant],
  );
  const [personalRequest, setPersonalRequest] = useState("");
  const [internalNote, setInternalNote] = useState("");

  const [agreedPrice, setAgreedPrice] = useState("");
  const [reason, setReason] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<DeskPaymentMethod>("card_terminal");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const resolvedPrice = resolveAgreedPrice(RECEPTION_BOOKING_SOURCE, agreedPrice);
  const manualTotalFils = resolvedPrice.manualTotalFils;
  const hasCalculatedPrice = quote !== null && quote.outcome === "priced";

  const bookerAge = calculateAge(dob);

  const ruleFailure = useMemo(
    () =>
      checkGuestRules(
        {
          adults,
          children: childAges
            .filter((age): age is number => age !== null)
            .map((age) => ({ age })),
          bookerAge,
        },
        rules,
      ),
    [adults, childAges, bookerAge, rules],
  );

  function selectCustomer(next: ReceptionCustomer | null) {
    setCustomer(next);
    setSalutation(next?.salutation ?? "mr");
    setFirstName(next?.first_name ?? "");
    setLastName(next?.last_name ?? "");
    setEmail(next?.email ?? "");
    const birth = next?.date_of_birth?.split("-").map(Number);
    setDob(birth ? { year: birth[0], month: birth[1], day: birth[2] } : EMPTY_DOB);
    const savedPhone = emptyPhoneValue(next?.phone_country);
    setPhone({ ...savedPhone, nationalNumber: next?.phone_e164?.startsWith(savedPhone.dialCode) ? next.phone_e164.slice(savedPhone.dialCode.length) : "" });
    setFieldErrors({});
    setAcceptedTerms(false);
  }

  function reset() {
    setCustomer(null);
    setSuiteId(null);
    setSalutation("mr");
    setFirstName("");
    setLastName("");
    setEmail("");
    setDob(EMPTY_DOB);
    setPhone(emptyPhoneValue());
    setStartsAt(null);
    setAdults(rules.guestsMin);
    setChildAges([]);
    setAddonQuantities({});
    setVoucherCode("");
    setPersonalRequest("");
    setInternalNote("");
    setAgreedPrice("");
    setReason("");
    setAcceptedTerms(false);
    setPaymentMethod("card_terminal");
    setFieldErrors({});
  }

  function firstError(...keys: string[]): string | undefined {
    for (const key of keys) {
      const message = fieldErrors[key];
      if (message) return message;
    }
    return undefined;
  }

  function clearError(...keys: string[]) {
    setFieldErrors((current) => {
      if (!keys.some((key) => key in current)) return current;
      const remaining = { ...current };
      for (const key of keys) delete remaining[key];
      return remaining;
    });
  }

  function report(result: WalkInResult) {
    if (result.status === "created") {
      setOpen(false);
      onOpenChange?.(false);
      reset();
      onCreated?.({
        reference: result.reference,
        suiteNumber: result.suiteNumber,
      });
      toast.success("Booking created", {
        description: `Suite ${result.suiteNumber}`,
      });
      return;
    }

    if (result.status === "no_suite") {
      const message = suiteId ? "The selected suite is no longer available. Choose another suite or time." : "No suite is free at that time.";
      setSuiteRevision((value) => value + 1);
      onRetrySlots?.();
      toast.error(message);
    } else if (customer === null && result.message === CUSTOMER_MISMATCH_MESSAGE) {
      setFieldErrors((current) => ({ ...current, email: EXISTING_CUSTOMER_EMAIL_MESSAGE }));
      toast.error("This customer already exists", { description: EXISTING_CUSTOMER_EMAIL_MESSAGE });
    } else {
      toast.error(result.message);
    }

  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    if (slotsLoading || slotsError || !slots.some((slot) => slot.startsAt === startsAt && !slot.tile.disabled)) {
      setFieldErrors((current) => ({ ...current, startsAt: "Choose an available start time." }));
      toast.error("Choose an available start time", {
        description: slotsLoading
          ? "Please wait while we check which times are available."
          : slotsError ?? "Choose a time that has room for the whole visit and the cleaning time afterwards.",
      });
      focusField("startsAt");
      return;
    }

    const checked = validateWalkIn(
      {
        source: RECEPTION_BOOKING_SOURCE,
        salutation,
        firstName,
        lastName,
        email,
        dateOfBirth: dob,
        phone,
        startsAt,
        durationHours,
        adults,
        childAges,
        cart,
        voucherCode,
        personalRequest,
        internalNote,
        reason,
        acceptedTerms,
        paymentMethod,
      },
      { agreedPrice: resolvedPrice, hasCalculatedPrice, ruleFailure },
    );
    if (!checked.ok) {
      setFieldErrors(checked.errors);
      const first = Object.keys(checked.errors)[0];
      if (first) focusField(first);
      toast.error("Check the booking details", { description: Object.values(checked.errors)[0] });
      return;
    }

    setFieldErrors({});

    start(async () => {
      let result: WalkInResult;
      try {
        result = await onSubmit({ ...checked.data, customerId: customer?.id ?? null, suiteId });
      } catch (cause) {
        console.error("[console] walk-in booking threw:", cause);
        result = { status: "error", message: NETWORK_MESSAGE };
      }
      report(result);
    });
  }

  const formError = firstError("form");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending && !next) return;
        setOpen(next);
        onOpenChange?.(next);
        if (next && initialCustomer) selectCustomer(initialCustomer);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-tap">
          <UserPlusIcon aria-hidden="true" />
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent pending={pending} className="flex max-h-dialog-max-h min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="shrink-0 border-b border-border bg-surface-raised p-5 pr-12 text-left">
          <DialogTitle className="text-console-title font-medium">
            {triggerLabel}
          </DialogTitle>
          <DialogDescription>Dubai time · AED</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
            <div className="flex min-w-0 flex-col gap-6">

              {formError && (
                <p role="alert" className="sr-only">
                  {formError}
                </p>
              )}

              <div className="grid min-w-0 items-start gap-6 lg:grid-cols-3">
              <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
              <WalkInWhen
                date={date}
                onDateChange={(next) => {
                  setStartsAt(null);
                  setSuiteId(null);
                  clearError("startsAt");
                  onDateChange(next);
                }}
                maxHorizonDays={maxHorizonDays}
                earliestDate={earliestDate}
                durationsHours={durationsHours}
                durationHours={durationHours}
                onDurationChange={(next) => {
                  setStartsAt(null);
                  setSuiteId(null);
                  clearError("startsAt");
                  onDurationChange(next);
                }}
                slots={slots}
                startsAt={startsAt}
                onStartsAtChange={(next) => {
                  setStartsAt(next);
                  setSuiteId(null);
                  clearError("startsAt");
                }}
                loading={slotsLoading}
                slotsError={slotsError}
                onRetrySlots={onRetrySlots}
                disabled={pending}
                error={firstError("startsAt")}
              />



              <BookingSuitePicker key={suiteRevision} startsAt={startsAt} durationHours={durationHours} value={suiteId} onChange={setSuiteId} disabled={pending} />

              <BookingCustomerPicker customer={customer} onChange={selectCustomer} disabled={pending} />

              <WalkInIdentity
                salutation={salutation}
                onSalutationChange={setSalutation}
                firstName={firstName}
                onFirstNameChange={(next) => {
                  setFirstName(next);
                  clearError("firstName");
                }}
                lastName={lastName}
                onLastNameChange={(next) => {
                  setLastName(next);
                  clearError("lastName");
                }}
                email={email}
                onEmailChange={(next) => {
                  setEmail(next);
                  clearError("email");
                }}
                dateOfBirth={dob}
                onDateOfBirthChange={(next) => {
                  setDob(next);
                  clearError(
                    "dateOfBirth",
                    "dateOfBirth.day",
                    "dateOfBirth.month",
                    "dateOfBirth.year",
                  );
                }}
                phone={phone}
                onPhoneChange={(next) => {
                  setPhone(next);
                  clearError("phone", "phone.e164", "phone.countryIso2");
                }}
                bookerMinAge={rules.bookerMinAge}
                disabled={pending || customer !== null}
                dobDisabled={pending || Boolean(customer?.date_of_birth)}
                errors={{
                  firstName: firstError("firstName"),
                  lastName: firstError("lastName"),
                  email: firstError("email"),
                  dateOfBirth: firstError(
                    "dateOfBirth",
                    "dateOfBirth.day",
                    "dateOfBirth.month",
                    "dateOfBirth.year",
                  ),
                  phone: firstError("phone.e164", "phone.countryIso2", "phone"),
                }}
              />



              <WalkInGuests
                rules={rules}
                adults={adults}
                onAdultsChange={(next) => {
                  setAdults(next);
                  clearError("guests", "adults");
                }}
                childAges={childAges}
                onChildAgesChange={(next) => {
                  setChildAges(next);
                  clearError("guests", "children");
                }}
                ruleFailure={ruleFailure}
                disabled={pending}
                error={firstError("guests", "children", "adults")}
              />



              <WalkInExtras
                addons={addons}
                cart={cart}
                onQuantityChange={(id, quantity) =>
                  setAddonQuantities((current) => ({ ...current, [id]: quantity }))
                }
                personalRequest={personalRequest}
                onPersonalRequestChange={setPersonalRequest}
                internalNote={internalNote}
                onInternalNoteChange={setInternalNote}
                disabled={pending}
              />



              </div>
              <ConsoleCard className="min-w-0 lg:sticky lg:top-0">
              <ConsoleCardBody className="flex min-w-0 flex-col gap-6">
              <WalkInPrice
                source={RECEPTION_BOOKING_SOURCE}
                offerLabel={offerLabel}
                taxLabel={taxLabel}
                voucherCode={voucherCode}
                onVoucherCodeChange={setVoucherCode}
                voucherMessage={voucherMessage}
                voucherState={voucherState}
                quote={quote}
                quotePending={quotePending}
                quoteError={quoteError}
                onRetryQuote={onRetryQuote}
                agreedPrice={agreedPrice}
                onAgreedPriceChange={(next) => {
                  setAgreedPrice(next);
                  clearError("manualTotalFils");
                }}
                reason={reason}
                onReasonChange={(next) => {
                  setReason(next);
                  clearError("reason");
                }}
                manualTotalFils={manualTotalFils}
                reasonRequired={manualTotalFils !== null}
                disabled={pending}
                priceError={firstError("manualTotalFils")}
                reasonError={firstError("reason")}
              />



              <FieldSet className="gap-3">
                <FieldLegend className={LEGEND_CLASS}>Paid in full by</FieldLegend>
                <ToggleGroup
                  type="single"
                  aria-label="How the guest paid"
                  value={paymentMethod}
                  disabled={pending}
                  onValueChange={(next) => {
                    if (next === "card_terminal" || next === "cash") setPaymentMethod(next);
                  }}
                  className="grid w-full grid-cols-2 gap-2 rounded-none"
                >
                  {DESK_PAYMENT_METHODS.map((method) => (
                    <ToggleGroupItem
                      key={method}
                      value={method}
                      className="h-tap cursor-pointer rounded-(--radius-card) border border-border bg-surface-raised px-3 text-console-body text-text-primary transition-colors duration-150 hover:border-brand hover:bg-surface-hover data-[state=on]:border-brand data-[state=on]:bg-brand-wash data-[state=on]:font-medium data-[state=on]:text-brand"
                    >
                      {DESK_PAYMENT_METHOD_LABEL[method]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <p className={HINT_CLASS}>
                  Take the full total before creating the booking. The payment is recorded with it.
                </p>
              </FieldSet>

              <FieldSet className="gap-3" data-invalid={Boolean(firstError("acceptedTerms")) || undefined}>
                <FieldLegend className={LEGEND_CLASS}>Guest agreement</FieldLegend>
                <TermsAcceptanceField
                  id={fieldId("terms")}
                  checked={acceptedTerms}
                  onCheckedChange={(next) => {
                    setAcceptedTerms(next === true);
                    clearError("acceptedTerms");
                  }}
                  disabled={pending}
                  error={firstError("acceptedTerms")}
                />
                <p className={HINT_CLASS}>
                  Read this to the guest and tick it only once they agree. The
                  wording and its version are stored with the booking.
                </p>
              </FieldSet>
              </ConsoleCardBody>
              </ConsoleCard>
              </div>
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 border-t border-border bg-surface-raised p-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              className="h-tap px-4"
              disabled={pending}
              onClick={() => { setOpen(false); onOpenChange?.(false); reset(); }}
            >
              Cancel
            </Button>
            <Button type="submit" className="h-tap px-4" disabled={pending}>
              {pending && (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="motion-safe:animate-spin"
                />
              )}
              {pending ? "Creating…" : ACTION_LABEL}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
