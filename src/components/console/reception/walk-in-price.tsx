"use client";

import { Button } from "@/components/shared/button";
import { InfoIcon } from "lucide-react";
import { ActionError } from "@/components/shared/action-error";

import { Badge } from "@/components/ui/badge";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/console/reception/reception-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/console/reception/reception-input";
import type { PricedBreakdown } from "@/lib/domain/pricing";
import { aedToFils, formatAed } from "@/components/shared/money";
import {
  CONSOLE_MONEY_AED,
  REASON_MAX_LENGTH,
  VOUCHER_CODE_MAX_LENGTH,
} from "@/lib/config/console-limits";
import {
  CharacterCounter,
  showsCharacterCounter,
} from "@/components/shared/character-counter";
import { cn } from "@/lib/utils";
import {
  AREA_CLASS,
  CONTROL_CLASS,
  ERROR_CLASS,
  HINT_CLASS,
  LABEL_CLASS,
  LEGEND_CLASS,
  NOTE_CLASS,
  type ReceptionSource,
  fieldId,
} from "@/components/console/reception/walk-in-form";

export type VoucherState =
  | "none"
  | "unchecked"
  | "checking"
  | "applied"
  | "refused";

export interface WalkInPriceProps {
  offerLabel: string;
  taxLabel: string;
  voucherCode: string;
  onVoucherCodeChange: (next: string) => void;
  voucherMessage: string | null;
  voucherState: VoucherState;
  source: ReceptionSource;
  quote: PricedBreakdown | null;
  quotePending: boolean;
  quoteError: string | null;
  onRetryQuote?: () => void;
  agreedPrice: string;
  onAgreedPriceChange: (next: string) => void;
  reason: string;
  onReasonChange: (next: string) => void;
  manualTotalFils: number | null;
  reasonRequired: boolean;
  disabled: boolean;
  priceError?: string;
  reasonError?: string;
  canChangePrice?: boolean;
}

const SKELETON_LINES = [0, 1, 2];

const VOUCHER_HINT: Readonly<Record<VoucherState, string>> = {
  none: "Optional. A code may make an extra free.",
  unchecked: "Choose a start time and the code is checked against the booking.",
  checking: "Checking the code…",
  applied: "Code applied.",
  refused: "That code was not applied.",
};

export function WalkInPrice({
  source,
  offerLabel,
  taxLabel,
  voucherCode,
  onVoucherCodeChange,
  voucherMessage,
  voucherState,
  quote,
  quotePending,
  quoteError,
  onRetryQuote,
  agreedPrice,
  onAgreedPriceChange,
  reason,
  onReasonChange,
  manualTotalFils,
  reasonRequired,
  disabled,
  priceError,
  reasonError,
  canChangePrice = false,
}: WalkInPriceProps) {
  const complimentary = source === "complimentary";
  const lowestFils = aedToFils(CONSOLE_MONEY_AED.min);
  const highestFils = aedToFils(CONSOLE_MONEY_AED.max);
  const priced = quote !== null && quote.outcome === "priced";




  const totalFils = manualTotalFils ?? (priced ? quote.totalFils : null);
  const showSkeleton = quotePending && quote === null && quoteError === null;

  const voucherHint =
    voucherState === "refused"
      ? (voucherMessage ?? VOUCHER_HINT.refused)
      : VOUCHER_HINT[voucherState];

  return (
    <FieldSet className="gap-3">
      <FieldLegend className={LEGEND_CLASS}>Price summary</FieldLegend>

      {complimentary ? (
        <p className={NOTE_CLASS}>
          <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 text-pretty">
            A complimentary booking is charged nothing and is reported
            separately, so it never counts as revenue. Record why below.
          </span>
        </p>
      ) : null}

      {quoteError !== null ? (
        <div className="space-y-3">
        <ActionError
          title="The booking price could not be calculated"
          message={quoteError}
        />
        {onRetryQuote && <Button type="button" variant="outline" disabled={disabled || quotePending} onClick={onRetryQuote}>Retry price calculation</Button>}
        </div>
      ) : null}

      {priced && quote.savingFils > 0 ? (
        <p className="rounded-(--radius-control) border border-brand bg-brand-wash px-3 py-2 text-console-body text-text-primary">
          <span className="font-medium">
            {offerLabel} — save {formatAed(quote.savingFils)}
          </span>
          {quote.savingPercent > 0 ? (
            <span className="ml-1 font-data tabular-nums text-text-secondary">
              ({quote.savingPercent}% off)
            </span>
          ) : null}
        </p>
      ) : null}

      {showSkeleton ? (
        <div
          aria-hidden="true"
          className="flex flex-col gap-2 border-y border-border py-2"
        >
          {SKELETON_LINES.map((line) => (
            <Skeleton key={line} className="h-price-line w-full rounded-(--radius-control)" />
          ))}
        </div>
      ) : priced ? (
        <dl
          aria-busy={quotePending || undefined}
          className={cn(
            "divide-y divide-border border-y border-border",
            quotePending && "opacity-70",
          )}
        >
          {quote.lines.map((line) => (
            <div
              key={line.id}
              className="flex items-baseline justify-between gap-4 py-2"
            >
              <dt className="min-w-0 text-console-body text-text-secondary">
                {line.label}
                {line.quantity !== null ? (
                  <span className="ml-1 font-data tabular-nums text-text-muted">
                    {`× ${line.quantity}`}
                  </span>
                ) : null}
              </dt>
              <dd className="flex shrink-0 items-baseline gap-2 font-data text-console-body tabular-nums text-text-primary">
                {line.regularUnitPriceFils !== null &&
                  line.quantity !== null &&
                  line.regularUnitPriceFils * line.quantity > line.amountFils && (
                    <span className="text-text-muted line-through">
                      {formatAed(line.regularUnitPriceFils * line.quantity)}
                    </span>
                  )}
                {line.isIncluded ? (
                  <span className="text-success-ink">Included</span>
                ) : (
                  formatAed(line.amountFils)
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : quoteError === null ? (
        <p className={NOTE_CLASS}>
          <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 text-pretty">
            {quote === null ? "Choose a start time for a price." : "No price available for this visit."}
          </span>
        </p>
      ) : null}

      {canChangePrice ? (
      <Field className="gap-2" data-invalid={Boolean(priceError) || undefined}>
        <FieldLabel htmlFor={fieldId("agreed-price")} className={LABEL_CLASS}>
          {priced ? "Agreed price, if it differs" : "Agreed price"}
        </FieldLabel>
        <Input
          id={fieldId("agreed-price")}
          name="agreedPrice"
          type="number"
          inputMode="decimal"
          min={CONSOLE_MONEY_AED.min}
          max={CONSOLE_MONEY_AED.max}
          step={CONSOLE_MONEY_AED.step}
          autoComplete="off"
          placeholder="450.00"
          disabled={disabled || complimentary}
          value={complimentary ? "0.00" : agreedPrice}
          onChange={(event) => onAgreedPriceChange(event.target.value)}
          aria-invalid={Boolean(priceError) || undefined}
          aria-describedby={
            priceError ? fieldId("agreed-price-error") : fieldId("agreed-price-hint")
          }
          className={`${CONTROL_CLASS} font-data tabular-nums`}
        />
        <p id={fieldId("agreed-price-hint")} className={HINT_CLASS}>
          Between {formatAed(lowestFils)} and {formatAed(highestFils)},
          including VAT and any service fee. Leave it empty to charge the
          calculated price.
        </p>
        {priceError ? (
          <FieldError id={fieldId("agreed-price-error")} className={ERROR_CLASS}>
            {priceError}
          </FieldError>
        ) : null}
      </Field>
      ) : null}

      <Field className="gap-2">
        <FieldLabel htmlFor={fieldId("voucher")} className={LABEL_CLASS}>
          Voucher code
        </FieldLabel>
        <Input
          id={fieldId("voucher")}
          name="voucherCode"
          value={voucherCode}
          maxLength={VOUCHER_CODE_MAX_LENGTH}
          disabled={disabled || complimentary}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) =>
            onVoucherCodeChange(
              event.target.value.toUpperCase().slice(0, VOUCHER_CODE_MAX_LENGTH),
            )
          }
          aria-describedby={fieldId("voucher-hint")}
          className={`${CONTROL_CLASS} font-data tabular-nums`}
        />
        <p
          id={fieldId("voucher-hint")}
          role="status"
          className={cn(
            HINT_CLASS,
            voucherState === "refused" && "font-medium text-danger-ink",
            voucherState === "applied" && "font-medium text-success-ink",
          )}
        >
          {voucherHint}
        </p>
      </Field>

      <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-border pt-3">
        <span className="text-console-body font-medium text-text-primary">
          Total
          {quotePending ? (
            <span className="ml-2 text-micro font-normal text-text-muted">
              Updating…
            </span>
          ) : null}
        </span>
        <span className="flex items-baseline gap-2">
          {priced && quote.regularTotalFils > quote.totalFils ? (
            <span className="font-data text-micro tabular-nums text-text-muted line-through">
              {formatAed(quote.regularTotalFils)}
            </span>
          ) : null}
          {complimentary ? (
            <Badge variant="outline" className="border-success-border bg-success-wash text-success-ink">
              Complimentary
            </Badge>
          ) : null}
          <span
            aria-busy={quotePending || undefined}
            className={cn(
              "font-data text-console-title tabular-nums text-text-primary",
              quotePending && "opacity-70",
            )}
          >
            {totalFils === null ? "Not priced" : formatAed(totalFils)}
          </span>
        </span>
      </div>

      {priced && quote.taxIsIncluded && quote.taxFils > 0 ? (
        <p className="font-data text-micro tabular-nums text-text-muted">
          Includes {formatAed(quote.taxFils)} {taxLabel}
        </p>
      ) : null}

      {canChangePrice || reasonRequired ? (
      <Field className="gap-2" data-invalid={Boolean(reasonError) || undefined}>
        <FieldLabel htmlFor={fieldId("reason")} className={LABEL_CLASS}>
          Reason for this price
          {reasonRequired ? (
            <>
              <span aria-hidden="true" className="ml-1 text-brand">
                *
              </span>
              <span className="sr-only"> (required)</span>
            </>
          ) : null}
        </FieldLabel>
        <Textarea
          id={fieldId("reason")}
          name="reason"
          rows={2}
          maxLength={REASON_MAX_LENGTH}
          disabled={disabled}
          value={reason}
          placeholder="Reason for the price adjustment"
          onChange={(event) =>
            onReasonChange(event.target.value.slice(0, REASON_MAX_LENGTH))
          }
          aria-invalid={Boolean(reasonError) || undefined}
          aria-describedby={
            reasonError
              ? fieldId("reason-error")
              : showsCharacterCounter(reason, REASON_MAX_LENGTH)
                ? fieldId("reason-remaining")
                : undefined
          }
          className={AREA_CLASS}
        />
        <CharacterCounter
          id={fieldId("reason-remaining")}
          value={reason}
          maxLength={REASON_MAX_LENGTH}
        />
        {reasonError ? (
          <FieldError id={fieldId("reason-error")} className={ERROR_CLASS}>
            {reasonError}
          </FieldError>
        ) : null}
      </Field>
      ) : null}
    </FieldSet>
  );
}
