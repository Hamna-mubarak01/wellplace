"use client";

import type { ReactNode } from "react";

import type { BookingSummaryProps } from "@/components/booking/booking-summary";
import { BookingSummary } from "@/components/booking/booking-summary";
import {
  guestsError,
  type BookingLimits,
  type GuestSelection,
} from "@/components/booking/booking-types";
import { ChildAgeSelect } from "@/components/booking/child-age-select";
import { GuestCounter } from "@/components/booking/guest-counter";
import { HelpBlock } from "@/components/booking/help-block";
import { PricePanel } from "@/components/booking/price-panel";
import { VenueCarousel } from "@/components/booking/venue-carousel";
import type { PricedBreakdown } from "@/lib/domain/pricing";
import { cn } from "@/lib/utils";

export interface BookingRailProps {
  visitDate?: string;
  gallery?: readonly import("@/components/booking/venue-carousel").VenueView[];
  limits: BookingLimits;
  guests: GuestSelection;
  onGuestsChange: (guests: GuestSelection) => void;
  showGuestErrors?: boolean;
  summary: Omit<BookingSummaryProps, "layout" | "className">;
  showParty: boolean;
  showSummary: boolean;
  showPrice: boolean;
  showVenue?: boolean;
  railFields: BookingSummaryProps["railFields"];
  onChooseTime?: () => void;
  breakdown: PricedBreakdown | null;
  taxLabel: string;
  taxPercent?: number | null;
  durationHours: number;
  priceLoading?: boolean;
  awaitingStartTime?: boolean;
  priceError?: string | null;
  onPriceRetry?: () => void;
  loading?: boolean;
  priceHeading: string;
  email: string | null;
  className?: string;
}

function RailBlock({
  first = false,
  children,
  className,
}: {
  first?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-5 py-5 lg:px-6",
        !first && "border-t border-border",
        className,
      )}
    >
      {children}
    </div>
  );
}

function PartyBlock({
  limits,
  guests,
  onGuestsChange,
  showErrors,
}: {
  limits: BookingLimits;
  guests: GuestSelection;
  onGuestsChange: (guests: GuestSelection) => void;
  showErrors: boolean;
}) {
  const { guestsMin, guestsMax, childMinAge, childMaxAge } = limits;
  const children = guests.childAges;

  const error = guestsError(guests, limits);
  const missingAges = children.some((age) => age === null);
  const agesMessageId = "book-child-ages-message";

  const adultsMin = Math.max(1, guestsMin - children.length);
  const adultsMax = guestsMax - children.length;
  const childrenMax = guestsMax - guests.adults;

  const setChildCount = (count: number) => {
    const next = children.slice(0, count);
    while (next.length < count) next.push(null);
    onGuestsChange({ ...guests, childAges: next });
  };

  const setChildAge = (index: number, age: number) => {
    const next = [...children];
    next[index] = age;
    onGuestsChange({ ...guests, childAges: next });
  };

  return (
    <section aria-labelledby="book-guests-heading" className="min-w-0">
      <h2
        id="book-guests-heading"
        className="font-display text-small font-medium text-text-primary"
      >
        Who is coming
      </h2>
      <p className="mt-1 text-fine text-pretty text-text-secondary">
        Including you.
      </p>

      <div className="mt-4 flex flex-col border-t border-border pt-1">
        <GuestCounter
          id="book-adults"
          label="Adults"
          description={`Aged ${childMaxAge + 1} and over`}
          value={guests.adults}
          min={adultsMin}
          max={adultsMax}
          onValueChange={(adults) => onGuestsChange({ ...guests, adults })}
          decrementLabel="Remove an adult"
          incrementLabel="Add an adult"
          className="border-b border-border pb-4"
        />

        <GuestCounter
          id="book-children"
          label="Children"
          description={`Aged ${childMinAge} to ${childMaxAge}`}
          value={children.length}
          min={0}
          max={childrenMax}
          onValueChange={setChildCount}
          decrementLabel="Remove a child"
          incrementLabel="Add a child"
          className="pt-4"
        />

        {children.length > 0 ? (
          <fieldset className="mt-4 border-t border-border pt-5">
            <legend className="sr-only">How old is each child?</legend>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-1 lg:gap-3">
              {children.map((age, index) => (
                <ChildAgeSelect
                  key={index}
                  id={`book-child-${index + 1}`}
                  label={`Child ${index + 1}`}
                  minAge={childMinAge}
                  maxAge={childMaxAge}
                  value={age}
                  onValueChange={(next) => setChildAge(index, next)}
                  invalid={showErrors && age === null}
                  describedBy={showErrors && missingAges ? agesMessageId : undefined}
                />
              ))}
            </div>

            {showErrors && missingAges ? (
              <p id={agesMessageId} className="mt-3 text-fine font-medium text-danger">
                Choose an age for every child.
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {showErrors && error && !missingAges ? (
          <p
            id="book-guests-error"
            role="alert"
            className="mt-4 border-t border-border pt-4 text-fine font-medium text-pretty text-danger"
          >
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function BookingRail({
  gallery,
  limits,
  guests,
  onGuestsChange,
  showGuestErrors = false,
  summary,
  showParty,
  showSummary,
  showPrice,
  showVenue = false,
  railFields,
  onChooseTime,
  breakdown,
  taxLabel,
  taxPercent = null,
  durationHours,
  priceLoading = false,
  awaitingStartTime = false,
  priceError = null,
  onPriceRetry,
  loading = false,
  priceHeading,
  email,
  className,
}: BookingRailProps) {
  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      {showParty ? (
        <RailBlock first>
          <PartyBlock
            limits={limits}
            guests={guests}
            onGuestsChange={onGuestsChange}
            showErrors={showGuestErrors}
          />
        </RailBlock>
      ) : null}

      {showSummary ? (
        <RailBlock first={!showParty}>
          <BookingSummary
            layout="rail"
            railFields={railFields}
            onChooseTime={onChooseTime}
            {...summary}
          />
        </RailBlock>
      ) : null}

      {showVenue ? (
        <RailBlock className="p-0">
          <VenueCarousel views={gallery} />
        </RailBlock>
      ) : null}

      {showPrice ? (
        <RailBlock>
          <PricePanel
            breakdown={breakdown}
            taxLabel={taxLabel}
            taxPercent={taxPercent}
            durationHours={durationHours}
            guests={guests}
            heading={priceHeading}
            loading={loading || priceLoading}
            error={priceError}
            awaitingStartTime={awaitingStartTime}
            onRetry={onPriceRetry}
          />
        </RailBlock>
      ) : null}

      <RailBlock>
        <HelpBlock
          email={email}
        />
      </RailBlock>
    </div>
  );
}
