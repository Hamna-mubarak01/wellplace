import { SparklesIcon } from "lucide-react";

import { formatAed } from "@/components/shared/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Quote } from "@/lib/services/pricing-service";
import type { BookingLimits } from "@/components/booking/booking-types";

export interface BookingOfferHeadlineProps {
  readonly quote: Quote;
  readonly limits: BookingLimits;
  readonly vatPercent: number;
  readonly inclusive: boolean;
}

function StruckFigure({ fils, srLabel }: { fils: number; srLabel: string }) {
  const formatted = formatAed(fils, { compact: true });
  return (
    <>
      <s aria-hidden="true" className="font-data whitespace-nowrap tabular-nums">
        {formatted}
      </s>
      <span className="sr-only">
        {srLabel} {formatted}
      </span>
    </>
  );
}

function HeroFigure({ fils }: { fils: number }) {
  const formatted = formatAed(fils, { compact: true });
  const amount = formatted.replace(/^AED\s+/, "");

  return (
    <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
      <span className="sr-only">{formatted}</span>
      <span aria-hidden="true" className="font-display text-h3 font-medium text-text-secondary">
        AED
      </span>
      <span aria-hidden="true" className="font-data text-display leading-none tabular-nums">
        {amount}
      </span>
    </span>
  );
}

export function BookingOfferHeadline({
  quote,
  limits,
  vatPercent,
  inclusive,
}: BookingOfferHeadlineProps) {
  const hours = Math.min(...limits.durationsHours);
  const price = quote.breakdown;
  const adult = price.adultPrice;
  if (price.outcome !== "priced" || !adult) return null;

  const offerHeading = [
    quote.offerLabel.trim(),
    adult.savingPercent > 0 ? `${adult.savingPercent}% OFF` : "",
  ]
    .filter(Boolean)
    .join(" — ");
  const longestHours = Math.max(...limits.durationsHours);
  const vatLine = inclusive ? `${vatPercent}% VAT included.` : `${vatPercent}% VAT is added at checkout.`;
  const childLine = `Children aged ${limits.childMinAge}–${limits.childMaxAge} can be added during booking at special child rates.`;

  return (
    <div className="mx-auto w-full max-w-widget px-4 pt-5 sm:px-6 lg:px-8">
      <Card className="mx-auto w-full max-w-card-panel gap-0 rounded-(--radius-modal) border border-border bg-surface-raised py-0 text-center shadow-sm ring-0">
        <CardContent className="flex flex-col items-center px-5 py-6 sm:px-10 sm:pt-8 sm:pb-7">
          <Badge className="h-auto gap-2 rounded-full border-brand bg-brand px-3 py-1.5 text-pill font-semibold tracking-pill text-on-brand uppercase">
            <SparklesIcon aria-hidden="true" className="size-3.5" />
            {offerHeading}
          </Badge>

          <h2 className="mt-5 flex flex-col items-center gap-1 text-text-primary">
            <span className="flex flex-wrap items-baseline justify-center gap-x-3">
              <span className="text-lead text-text-muted">
                <StruckFigure fils={adult.regularFils / hours} srLabel="Regular price" />
              </span>
              <HeroFigure fils={adult.offerFils / hours} />
            </span>
            <span className="font-accent text-h3 font-medium text-brand italic">
              per adult, per hour
            </span>
          </h2>

          <Separator className="my-5 bg-border-strong data-horizontal:w-12" />

          <p className="max-w-measure-wide text-body text-balance text-text-secondary">
            Enjoy {hours} to {longestHours} hours of private wellness for{" "}
            {limits.guestsMin} to {limits.guestsMax} guests.
          </p>
          <p className="mt-1 text-small text-text-secondary">
            Minimum booking: {limits.guestsMin} guests for {hours} hours.
          </p>

          <p className="mt-5 flex w-full flex-wrap items-baseline justify-center gap-x-3 gap-y-1 rounded-(--radius-card) bg-surface-sunken px-4 py-3 text-text-primary">
            <span className="text-body font-semibold">
              {limits.guestsMin} adults for {hours} hours:
            </span>
            <span className="text-small text-text-muted">
              <StruckFigure fils={price.regularSubtotalFils} srLabel="Regular total" />
            </span>
            <span className="font-data text-lead font-semibold whitespace-nowrap tabular-nums">
              {formatAed(price.subtotalFils, { compact: true })} total.
            </span>
          </p>

          <p className="mt-4 text-small text-text-secondary">{vatLine}</p>
          <p className="mt-1 max-w-measure-wide text-small text-balance text-text-secondary">
            {childLine}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
