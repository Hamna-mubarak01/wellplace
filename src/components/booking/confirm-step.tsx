"use client";
import { TERMS_ACCEPTANCE } from "@/lib/config/consent";

import type { ReactNode } from "react";

import type { BookingDetails } from "@/components/booking/booking-details";
import type { BookingStepId } from "@/components/booking/booking-steps";
import type { GuestSelection } from "@/components/booking/booking-types";
import { HelpBlock } from "@/components/booking/help-block";
import { PricePanel } from "@/components/booking/price-panel";
import { HoldCountdown } from "@/components/shared/hold-countdown";
import { formatAed } from "@/components/shared/money";
import { toE164 } from "@/components/shared/phone-input";
import { Button } from "@/components/shared/button";
import { GUEST_CHECKOUT } from "@/lib/config/guest-checkout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import type { PricedBreakdown } from "@/lib/domain/pricing";
import type { CartLine } from "@/lib/domain/vouchers";
import { cn } from "@/lib/utils";

const FINAL_MINUTE_MS = 60_000;

export interface ConfirmStepProps {
  visitDate?: string;
  paymentOption?: "card" | "tabby";
  onPaymentOptionChange?: (value: "card" | "tabby") => void;
  paymentSimulation?: boolean;
  simulatePayment?: boolean;
  onSimulatePaymentChange?: (value: boolean) => void;
  details: BookingDetails;
  dayLabel: string;
  timeLabel: string | null;
  checkOutLabel: string | null;
  durationHours: number;
  guests: GuestSelection;
  cart: readonly CartLine[];
  personalRequest: string;
  promoCode: string | null;
  promoCodesLive: boolean;
  breakdown: PricedBreakdown | null;
  taxLabel: string;
  taxPercent?: number | null;
  priceLoading?: boolean;
  priceError?: string | null;
  onPriceRetry?: () => void;
  loading?: boolean;
  securedUntil: Date | null;
  holdExpired: boolean;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  onEdit: (step: BookingStepId) => void;
  email: string | null;
  className?: string;
}

function ReceiptBlock({
  id,
  title,
  description,
  action,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className={cn(
        "min-w-0 rounded-(--radius-card) bg-surface-sunken p-5",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id={`${id}-heading`}
          className="font-display text-body font-medium text-pretty text-text-primary"
        >
          {title}
        </h2>
        {action}
      </div>
      {description ? (
        <p className="mt-1 text-fine text-pretty text-text-secondary">
          {description}
        </p>
      ) : null}
      {children}
    </section>
  );
}

function ChangeLink({
  what,
  step,
  onEdit,
}: {
  what: string;
  step: BookingStepId;
  onEdit: (step: BookingStepId) => void;
}) {
  return (
    <Button
      type="button"
      variant="link"
      onClick={() => onEdit(step)}
      aria-label={`Change ${what}`}
      className="-mr-2 h-tap shrink-0 rounded-(--radius-control) px-2 text-small font-medium text-brand underline-offset-4 hover:bg-transparent hover:text-brand-hover hover:underline focus-visible:underline"
    >
      Change
    </Button>
  );
}

function ReceiptRows({ children }: { children: ReactNode }) {
  return <dl className="mt-3 space-y-2">{children}</dl>;
}

function ReceiptRow({
  label,
  value,
  data = false,
  missing = false,
  loading = false,
}: {
  label: string;
  value: string;
  data?: boolean;
  missing?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4">
      <dt className="min-w-0 text-fine text-pretty text-text-secondary">
        {label}
      </dt>
      <dd className="min-w-0 justify-self-end text-right">
        {loading ? (
          <Skeleton className="h-5 w-24" />
        ) : (
          <span
            className={cn(
              "text-body break-words",
              missing ? "text-text-muted" : "text-text-primary",
              data && !missing && "font-data tabular-nums",
            )}
          >
            {value}
          </span>
        )}
      </dd>
    </div>
  );
}

export function ConfirmStep({
  paymentOption = "card",
  onPaymentOptionChange,
  paymentSimulation = false,
  simulatePayment = false,
  onSimulatePaymentChange,
  details,
  dayLabel,
  timeLabel,
  checkOutLabel,
  durationHours,
  guests,
  cart,
  personalRequest,
  promoCode,
  promoCodesLive,
  breakdown,
  taxLabel,
  taxPercent = null,
  priceLoading = false,
  priceError = null,
  onPriceRetry,
  loading = false,
  securedUntil,
  holdExpired,
  accepted,
  onAcceptedChange,
  onEdit,
  email,
  className,
}: ConfirmStepProps) {
  const children = guests.childAges;

  const name = [details.firstName, details.lastName].filter(Boolean).join(" ");
  const salutation =
    details.salutation === "mr"
      ? "Mr."
      : details.salutation === "ms"
        ? "Ms."
        : "";
  const fullName = [salutation, name].filter(Boolean).join(" ");

  const phone = toE164(details.phone);
  const note = personalRequest.trim();

  const when = (
    <ReceiptBlock
      id="book-receipt-when"
      title="When"
      description="Dubai time. Check-out is the end of your session."
      action={
        <ChangeLink what="the date and time" step="when" onEdit={onEdit} />
      }
    >
      <ReceiptRows>
        <ReceiptRow
          label="Date"
          value={dayLabel || "Not chosen yet"}
          missing={!dayLabel}
          loading={loading}
        />
        <ReceiptRow
          label="Check-in"
          value={
            timeLabel === null
              ? "Not chosen yet"
              : holdExpired
                ? `${timeLabel} · no longer held`
                : timeLabel
          }
          data={timeLabel !== null && !holdExpired}
          missing={timeLabel === null}
          loading={loading}
        />
        <ReceiptRow
          label="Check-out"
          value={checkOutLabel ?? "Not chosen yet"}
          data={checkOutLabel !== null}
          missing={checkOutLabel === null}
          loading={loading}
        />
        <ReceiptRow
          label="Length"
          value={`${durationHours} ${durationHours === 1 ? "hour" : "hours"}`}
          data
          loading={loading}
        />
      </ReceiptRows>
    </ReceiptBlock>
  );

  const who = (
    <ReceiptBlock
      id="book-receipt-guests"
      title="Who is coming"
      description="Including you. Children are priced from their age."
      action={<ChangeLink what="the guests" step="details" onEdit={onEdit} />}
    >
      <ReceiptRows>
        <ReceiptRow label="Adults" value={`${guests.adults}`} data />
        {children.map((age, index) => (
          <ReceiptRow
            key={index}
            label={`Child ${index + 1}`}
            value={age === null ? "Age not chosen" : `${age} years old`}
            data={age !== null}
            missing={age === null}
          />
        ))}
      </ReceiptRows>

      {children.length === 0 ? (
        <p className="mt-3 text-fine text-pretty text-text-secondary">
          No children on this booking.
        </p>
      ) : null}
    </ReceiptBlock>
  );

  const yourDetails = (
    <ReceiptBlock
      id="book-receipt-details"
      title="Your details"
      description="Contact details for this booking."
      action={<ChangeLink what="your details" step="details" onEdit={onEdit} />}
    >
      <ReceiptRows>
        <ReceiptRow
          label="Name"
          value={fullName || "Not entered yet"}
          missing={!fullName}
        />
        <ReceiptRow
          label="Email"
          value={details.email || "Not entered yet"}
          missing={!details.email}
        />
        <ReceiptRow
          label="Mobile"
          value={phone || "Not entered yet"}
          data={Boolean(phone)}
          missing={!phone}
        />
      </ReceiptRows>
    </ReceiptBlock>
  );

  const request = (
    <ReceiptBlock
      id="book-receipt-request"
      title="Anything we should know"
      description="What you asked us to have ready, exactly as you wrote it."
      action={
        <ChangeLink
          what="your personal request"
          step="addons"
          onEdit={onEdit}
        />
      }
    >
      {note === "" ? (
        <p className="mt-3 text-body text-pretty text-text-muted">
          You have not added a note.
        </p>
      ) : (
        <p className="mt-3 text-body break-words whitespace-pre-line text-pretty text-text-primary">
          {note}
        </p>
      )}
    </ReceiptBlock>
  );

  const addons = (
    <ReceiptBlock
      id="book-receipt-addons"
      title="Add-ons"
      description="Everything here is prepared before you arrive."
      action={<ChangeLink what="the add-ons" step="addons" onEdit={onEdit} />}
    >
      {cart.length === 0 ? (
        <>
          <p className="mt-3 text-body text-pretty text-text-muted">
            None added.
          </p>
          <p className="mt-1 text-fine text-pretty text-text-secondary">
            You can still add extras before you pay.
          </p>
        </>
      ) : (
        <ReceiptRows>
          {cart.map((line) => (
            <ReceiptRow
              key={line.id}
              label={
                line.quantity > 1
                  ? `${line.name} × ${line.quantity}`
                  : line.name
              }
              value={
                line.isIncluded
                  ? "Included"
                  : formatAed(line.unitPriceFils * line.quantity)
              }
              data={!line.isIncluded}
            />
          ))}
        </ReceiptRows>
      )}
    </ReceiptBlock>
  );

  const promo = (
    <ReceiptBlock
      id="book-receipt-promo"
      title="Promotional code"
      description="Eligible discounts are included in your total."
      action={
        <ChangeLink what="the promotional code" step="addons" onEdit={onEdit} />
      }
    >
      {promoCode === null ? (
        <p className="mt-3 text-body text-pretty text-text-muted">
          No code added.
        </p>
      ) : (
        <ReceiptRows>
          <ReceiptRow label="Code" value={promoCode} data />
        </ReceiptRows>
      )}

      {promoCode !== null && !promoCodesLive ? (
        <p className="mt-3 text-fine font-medium text-pretty text-warning">
          This code has not been checked. WellPlace has not supplied any codes
          yet and payment is not connected, so nothing has come off the total.
        </p>
      ) : null}
    </ReceiptBlock>
  );

  const price = (
    <div className="min-w-0 rounded-(--radius-card) bg-surface-sunken p-5">
      {onPaymentOptionChange ? (
        <div className="mb-5 space-y-2">
          <Label htmlFor="booking-payment-option">Payment option</Label>
          <Select
            value={simulatePayment ? GUEST_CHECKOUT.simulationOption.value : paymentOption}
            onValueChange={(value) => {
              if (value === GUEST_CHECKOUT.simulationOption.value) {
                onSimulatePaymentChange?.(true);
                onPaymentOptionChange("card");
                return;
              }
              if (value === "card" || value === "tabby") {
                onSimulatePaymentChange?.(false);
                onPaymentOptionChange(value);
              }
            }}
          >
            <SelectTrigger
              id="booking-payment-option"
              className="min-h-tap w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paymentSimulation ? (
                <SelectItem value={GUEST_CHECKOUT.simulationOption.value}>
                  {GUEST_CHECKOUT.simulationOption.label}
                </SelectItem>
              ) : null}
              {GUEST_CHECKOUT.paymentOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} disabled={paymentSimulation}>
                  {paymentSimulation
                    ? `${option.label} — ${GUEST_CHECKOUT.simulationOption.unavailableSuffix}`
                    : option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <PricePanel
        breakdown={breakdown}
        taxLabel={taxLabel}
        taxPercent={taxPercent}
        durationHours={durationHours}
        guests={guests}
        heading="Price"
        loading={loading || priceLoading}
        error={priceError}
        onRetry={onPriceRetry}
        variant="receipt"
      />
    </div>
  );

  const help = (
    <div className="min-w-0 rounded-(--radius-card) bg-surface-sunken p-5">
      <HelpBlock
        email={email}
        layout="inline"
      />
    </div>
  );

  return (
    <div className={cn("min-w-0", className)}>
      <div aria-live="polite" className="empty:hidden">
        {holdExpired ? (
          <div className="mb-4 rounded-(--radius-card) bg-surface-sunken p-5">
            <p className="text-body font-medium text-pretty text-text-primary">
              Your suite is no longer held.
            </p>
            <p className="mt-1 text-fine text-pretty text-text-secondary">
              The hold on this start time has run out. Nothing you have entered
              is lost — choose a time again and the rest of this booking stays
              as it is.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => onEdit("when")}
              className="mt-4 h-control rounded-(--radius-card) border-border bg-surface-raised px-4 text-control font-medium text-text-primary hover:border-brand hover:bg-surface-hover"
            >
              Choose a new time
            </Button>
          </div>
        ) : securedUntil ? (
          <p className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-(--radius-card) bg-surface-sunken px-5 py-4 text-small text-text-secondary">
            <span>Your suite is held while you check this</span>
            <HoldCountdown
              expiresAt={securedUntil}
              urgentBelowMs={FINAL_MINUTE_MS}
              className="font-data text-h3 font-medium tabular-nums text-text-primary data-[urgent]:text-warning"
            />
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          {when}
          {who}
          {yourDetails}
          {request}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {addons}
          {promo}
          {price}
          {help}
        </div>
      </div>

      <ReceiptBlock id="book-terms" title="Booking terms" className="mt-4">
        <label
          htmlFor="book-accept-terms"
          className="mt-4 flex min-h-tap cursor-pointer items-start gap-3 select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand"
        >
          <Checkbox
            id="book-accept-terms"
            checked={accepted}
            onCheckedChange={(next) => onAcceptedChange(next === true)}
            className="mt-0.5 shrink-0 border-border-interactive data-checked:border-brand data-checked:bg-brand data-checked:text-on-brand"
          />
          <span className="text-body text-pretty text-text-primary">
            {TERMS_ACCEPTANCE.text}
          </span>
        </label>
      </ReceiptBlock>
    </div>
  );
}
