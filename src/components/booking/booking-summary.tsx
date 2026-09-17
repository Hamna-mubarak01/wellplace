"use client";

import { ChevronUpIcon } from "lucide-react";

import { stepIndex, type BookingStepId } from "@/components/booking/booking-steps";
import {
  totalGuests,
  type BookingLimits,
  type GuestSelection,
} from "@/components/booking/booking-types";
import { HoldCountdown } from "@/components/shared/hold-countdown";
import { Button } from "@/components/shared/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";


const FINAL_MINUTE_MS = 60_000;

export interface BookingSummaryProps {
  dayLabel: string;
  checkInLabel: string | null;
  checkOutLabel: string | null;
  guests: GuestSelection;
  limits: BookingLimits;
  securedUntil: Date | null;
  holdExpired: boolean;
  loading?: boolean;
  onEdit: (step: BookingStepId) => void;
  currentStep: BookingStepId;
  reachedStep: BookingStepId;
  layout: "rail" | "bar";
  railFields?: readonly LineKey[];
  onChooseTime?: () => void;
  className?: string;
}

export type LineKey = "date" | "checkin" | "checkout" | "guests";

interface Line {
  readonly key: LineKey;
  readonly step: BookingStepId;
  readonly label: string;
  readonly value: string | null;
  readonly data?: boolean;
  readonly readOnly?: boolean;
}

function useLines({
  dayLabel,
  checkInLabel,
  checkOutLabel,
  guests,
  limits,
}: Pick<
  BookingSummaryProps,
  "dayLabel" | "checkInLabel" | "checkOutLabel" | "guests" | "limits"
>): readonly Line[] {
  const total = totalGuests(guests);
  const childCount = guests.childAges.length;

  return [
    { key: "date", step: "when", label: "Date", value: dayLabel || null },
    {
      key: "checkin",
      step: "when",
      label: "Check-in",
      value: checkInLabel,
      data: true,
    },
    {
      key: "checkout",
      step: "when",
      label: "Check-out",
      value: checkOutLabel,
      data: true,
      readOnly: true,
    },
    {
      key: "guests",
      step: "details",
      label: "Guests",
      value:
        total < limits.guestsMin
          ? null
          : childCount === 0
            ? `${total} ${total === 1 ? "adult" : "adults"}`
            : `${guests.adults} ${guests.adults === 1 ? "adult" : "adults"}, ${childCount} ${childCount === 1 ? "child" : "children"}`,
      data: true,
    },
  ];
}

function SummaryLine({
  line,
  loading,
  onEdit,
  currentStep,
  reachedStep,
  onChoose,
}: {
  line: Line;
  loading: boolean;
  onEdit: (step: BookingStepId) => void;
  currentStep: BookingStepId;
  reachedStep: BookingStepId;
  onChoose?: () => void;
}) {
  const editable =
    !line.readOnly &&
    line.step !== currentStep &&
    stepIndex(line.step) <= stepIndex(reachedStep);
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-fine text-text-secondary">{line.label}</span>

      {loading ? (
        <Skeleton className="h-4 w-24" />
      ) : onChoose ? (
        <Button
          type="button"
          variant="ghost"
          tone="plain"
          onClick={onChoose}
          data-empty={!line.value || undefined}
          aria-label={
            line.value
              ? `Change check-in — currently ${line.value}`
              : "Choose a start time"
          }
          className={cn(
            "booking-summary-edit h-auto min-h-0 rounded-(--radius-control) px-1 py-0 text-right text-small font-medium whitespace-normal hover:underline",
            line.value ? "font-data tabular-nums" : "text-brand",
          )}
        >
          {line.value ?? "Choose a time"}
        </Button>
      ) : line.value === null ? (
        <span className="text-small text-text-muted">
          <span aria-hidden>—</span>
          <span className="sr-only">Not chosen yet</span>
        </span>
      ) : !editable ? (
        <span
          className={cn(
            "text-right text-small font-medium text-text-primary",
            line.data && "font-data tabular-nums",
          )}
        >
          {line.value}
        </span>
      ) : (
        <Button
          type="button"
          variant="ghost"
          tone="plain"
          onClick={() => onEdit(line.step)}
          aria-label={`Change ${line.label.toLowerCase()} — ${line.value}`}
          className={cn(
            "booking-summary-edit h-auto min-h-0 rounded-(--radius-control) px-1 py-0 text-right text-small font-medium whitespace-normal hover:underline",
            line.data && "font-data tabular-nums",
          )}
        >
          {line.value}
        </Button>
      )}
    </div>
  );
}

function HoldLine({
  securedUntil,
  holdExpired,
  onEdit,
  onChooseTime,
  className,
}: {
  securedUntil: Date | null;
  holdExpired: boolean;
  onEdit: (step: BookingStepId) => void;
  onChooseTime?: () => void;
  className?: string;
}) {
  if (holdExpired) {
    return (
      <div className={className}>
        <p className="text-fine text-pretty text-text-secondary">
          Your suite is no longer held. Nothing else you have entered is lost.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={onChooseTime ?? (() => onEdit("when"))}
          className="mt-2 h-control w-full rounded-(--radius-card) border-border bg-surface-raised px-4 text-control font-medium text-text-primary hover:border-brand hover:bg-surface-hover"
        >
          Choose a new time
        </Button>
      </div>
    );
  }

  if (!securedUntil) return null;

  return (
    <p className={cn("text-fine text-text-secondary", className)}>
      Held for you ·{" "}
      <HoldCountdown
        expiresAt={securedUntil}
        urgentBelowMs={FINAL_MINUTE_MS}
        className="font-medium text-text-primary data-[urgent]:text-warning"
      />
    </p>
  );
}

export function BookingSummary(props: BookingSummaryProps) {
  const {
    securedUntil,
    holdExpired,
    loading = false,
    onEdit,
    currentStep,
    reachedStep,
    layout,
    railFields,
    onChooseTime,
    className,
  } = props;
  const allLines = useLines(props);
  const lines = allLines.filter(
    (line) => stepIndex(line.step) <= stepIndex(reachedStep),
  );

  if (layout === "rail") {
    const railLines = railFields
      ? railFields
          .map((key) => allLines.find((line) => line.key === key))
          .filter((line): line is Line => line !== undefined)
      : allLines;

    return (
      <section
        aria-labelledby="book-summary-heading"
        className={cn("min-w-0", className)}
      >
        <h2
          id="book-summary-heading"
          className="font-display text-small font-medium text-text-primary"
        >
          Your booking
        </h2>

        <div className="mt-3 divide-y divide-border border-t border-border">
          {railLines.map((line) => (
            <SummaryLine
              key={line.key}
              line={line}
              loading={loading}
              onEdit={onEdit}
              currentStep={currentStep}
              reachedStep={reachedStep}
              onChoose={line.key === "checkin" ? onChooseTime : undefined}
            />
          ))}
        </div>

        <div aria-live="polite" className="mt-4 empty:hidden">
          <HoldLine
            securedUntil={securedUntil}
            holdExpired={holdExpired}
            onEdit={onEdit}
            onChooseTime={onChooseTime}
          />
        </div>
      </section>
    );
  }

  const digest = lines.find((line) => line.key === "checkin")?.value;
  const dayDigest = lines.find((line) => line.key === "date")?.value;

  return (
    <Collapsible className={cn("border-b border-border", className)}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          tone="plain"
          className="group/bar flex h-auto min-h-tap w-full items-center justify-between gap-3 rounded-none px-0 py-2.5 text-left hover:bg-transparent"
        >
          <span className="min-w-0">
            <span className="block truncate text-small font-medium text-text-primary">
              {dayDigest ?? "Your booking so far"}
              {digest ? (
                <>
                  <span aria-hidden> · </span>
                  <span className="font-data tabular-nums">{digest}</span>
                </>
              ) : null}
            </span>
            <span className="block text-fine text-text-secondary">
              {holdExpired
                ? "Hold expired"
                : securedUntil
                  ? "Held for you"
                  : "Tap to see your choices"}
            </span>
          </span>
          <ChevronUpIcon
            aria-hidden
            className="size-4 shrink-0 text-text-secondary transition-transform duration-150 group-data-[state=open]/bar:rotate-180 motion-reduce:transition-none"
          />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="pb-3">
        <div className="divide-y divide-border border-t border-border">
          {lines.map((line) => (
            <SummaryLine
              key={line.key}
              line={line}
              loading={loading}
              onEdit={onEdit}
              currentStep={currentStep}
              reachedStep={reachedStep}
            />
          ))}
        </div>
      </CollapsibleContent>

      <div aria-live="polite" className="pb-3 empty:hidden">
        <HoldLine
          securedUntil={securedUntil}
          holdExpired={holdExpired}
          onEdit={onEdit}
        />
      </div>
    </Collapsible>
  );
}
