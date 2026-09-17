"use client";

import type { GuestSelection } from "@/components/booking/booking-types";
import { Button } from "@/components/shared/button";
import { formatAed } from "@/components/shared/money";
import { Skeleton } from "@/components/ui/skeleton";
import type { PriceLine, PricedBreakdown } from "@/lib/domain/pricing";
import { cn } from "@/lib/utils";


export interface PricePanelProps {
  breakdown: PricedBreakdown | null;
  taxLabel: string;
  taxPercent?: number | null;
  durationHours: number;
  guests: GuestSelection;
  heading: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  awaitingStartTime?: boolean;
  variant?: "rail" | "receipt";
  className?: string;
}

export function partySummary(guests: GuestSelection): string {
  const children = guests.childAges.length;
  const adults = `${guests.adults} ${guests.adults === 1 ? "adult" : "adults"}`;
  if (children === 0) return adults;
  return `${adults}, ${children} ${children === 1 ? "child" : "children"}`;
}

function lineRegularFils(line: PriceLine): number | null {
  if (line.regularUnitPriceFils === null || line.quantity === null) return null;
  const regular = line.regularUnitPriceFils * line.quantity;
  return regular > line.amountFils ? regular : null;
}

function PanelHeading({
  heading,
  receipt,
}: {
  heading: string;
  receipt: boolean;
}) {
  return (
    <h2
      id="book-price-heading"
      className={cn(
        "font-display font-medium text-text-primary",
        receipt ? "text-body" : "text-small",
      )}
    >
      {heading}
    </h2>
  );
}

function PriceRows({
  lines,
  receipt,
  money,
}: {
  lines: readonly PriceLine[];
  receipt: boolean;
  money: (fils: number) => string;
}) {
  return (
    <dl className="mt-3 divide-y divide-border border-t border-border">
      {lines.map((line) => {
        const regularFils = lineRegularFils(line);
        return (
          <div
            key={line.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 py-2"
          >
            <dt className="min-w-0 text-fine text-pretty text-text-secondary">
              {line.label}
              {line.quantity !== null ? (
                <span className="ml-1 font-data tabular-nums text-text-muted">
                  {`× ${line.quantity}`}
                </span>
              ) : null}
            </dt>
            <dd className="flex shrink-0 items-baseline gap-2 justify-self-end">
              {regularFils !== null ? (
                <span className="font-data text-micro whitespace-nowrap tabular-nums text-text-muted line-through">
                  <span className="sr-only">Regular price </span>
                  {money(regularFils)}
                </span>
              ) : null}
              <span
                className={cn(
                  "font-data whitespace-nowrap tabular-nums",
                  receipt ? "text-body" : "text-small",
                  line.isIncluded ? "text-success-ink" : "text-text-primary",
                )}
              >
                {line.isIncluded ? "Included" : money(line.amountFils)}
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function PricePanel({
  breakdown,
  taxLabel,
  taxPercent = null,
  durationHours,
  guests,
  heading,
  loading = false,
  error = null,
  onRetry,
  awaitingStartTime = false,
  variant = "rail",
  className,
}: PricePanelProps) {
  const receipt = variant === "receipt";
  const priced = breakdown !== null && breakdown.outcome === "priced";
  const money = (fils: number) => formatAed(fils, { compact: !receipt });

  const lines = priced
    ? breakdown.lines.filter((line) => line.kind !== "tax")
    : [];

  const durationLabel = `${durationHours} ${durationHours === 1 ? "hour" : "hours"}`;

  return (
    <section
      aria-labelledby="book-price-heading"
      aria-busy={loading || undefined}
      className={cn("min-w-0", className)}
    >
      <PanelHeading heading={heading} receipt={receipt} />

      <p className="mt-1 font-data text-fine tabular-nums text-text-secondary">
        {durationLabel}
        <span aria-hidden> · </span>
        <span className="font-body">{partySummary(guests)}</span>
      </p>

      {loading ? (
        <>
          <p className="sr-only" role="status">
            Working out your price
          </p>
          <div
            aria-hidden
            className="mt-3 divide-y divide-border border-t border-border"
          >
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="flex items-baseline justify-between gap-4 py-2.5"
              >
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-border-strong pt-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className={cn(receipt ? "h-8 w-32" : "h-5 w-24")} />
          </div>
        </>
      ) : error !== null ? (
        <div className="mt-3 border-t border-border pt-4">
          <p role="alert" className="text-body font-medium text-pretty text-danger">
            We could not work out your price.
          </p>
          <p className="mt-1 text-fine text-pretty text-text-secondary">{error}</p>
          {onRetry ? (
            <Button
              type="button"
              variant="outline"
              onClick={onRetry}
              className="mt-4"
            >
              Work it out again
            </Button>
          ) : null}
        </div>
      ) : !priced ? (
        <div className="mt-3 border-t border-border pt-3">
          <p
            className={cn(
              "text-pretty text-text-primary",
              receipt ? "text-body" : "text-small",
            )}
          >
            {awaitingStartTime
              ? "Choose a start time to see your price."
              : "No price is set for this length yet."}
          </p>
          {awaitingStartTime ? null : (
            <p className="mt-1 text-fine text-pretty text-text-secondary">
              Choose a different session length, or ask us and we will confirm
              the price for you.
            </p>
          )}
        </div>
      ) : (
        <>
          <PriceRows lines={lines} receipt={receipt} money={money} />

          <dl className="mt-3 border-t border-border-strong pt-3">
            {breakdown.savingFils > 0 ? (
              <div className="flex items-baseline justify-between gap-x-4">
                <dt className="text-fine text-text-secondary">Regular price</dt>
                <dd className="font-data text-fine whitespace-nowrap tabular-nums text-text-muted line-through">
                  {money(breakdown.regularTotalFils)}
                </dd>
              </div>
            ) : null}

            <div
              className={cn(
                "flex items-baseline justify-between gap-x-4",
                breakdown.savingFils > 0 && "mt-1",
              )}
            >
              <dt
                className={cn(
                  "font-medium text-text-primary",
                  receipt ? "text-body" : "text-small",
                )}
              >
                Total to pay
              </dt>
              <dd
                className={cn(
                  "font-data font-medium whitespace-nowrap tabular-nums text-text-primary",
                  receipt ? "text-h3" : "text-body",
                )}
              >
                {money(breakdown.totalFils)}
              </dd>
            </div>
          </dl>

          {breakdown.savingFils > 0 ? (
            <p className="mt-2 text-fine font-medium text-brand">
              You save{" "}
              <span className="font-data whitespace-nowrap tabular-nums">
                {money(breakdown.savingFils)}
              </span>
              {breakdown.savingPercent > 0
                ? ` (${breakdown.savingPercent}% off)`
                : ""}
            </p>
          ) : null}

          {breakdown.taxIsIncluded && breakdown.taxFils > 0 ? (
            <p
              className={cn(
                "text-fine text-text-secondary",
                breakdown.savingFils > 0 ? "mt-0.5" : "mt-2",
              )}
            >
              Includes {taxPercent !== null && taxPercent > 0 ? `${taxPercent}% ` : ""}{taxLabel}{" "}
              <span className="font-data whitespace-nowrap tabular-nums">
                ({money(breakdown.taxFils)})
              </span>
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
