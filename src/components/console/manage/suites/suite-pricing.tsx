import Link from "next/link";

import { MoneyValue } from "@/components/console/shared/money-value";
import { StatusChip, type StatusChipTone } from "@/components/console/shared/status-chip";
import { MonthNav, type MonthLink } from "@/components/console/manage/suites/month-nav";
import { RateCalendar, type DailyRateView } from "@/components/console/manage/suites/rate-calendar";
import { SuiteDrawerSection } from "@/components/console/manage/suites/suite-drawer-section";
import { Button } from "@/components/shared/button";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import { Separator } from "@/components/ui/separator";
import type { EditableAddon } from "@/lib/config/catalogue";

export type SuiteAddonsResult = { ok: true; addons: readonly EditableAddon[] } | { ok: false; message: string };

export interface SuitePricingProps {
  today: string;
  rateMonth: string;
  rateMonthLabel: string;
  rates: readonly DailyRateView[] | null;
  previousMonth: MonthLink;
  nextMonth: MonthLink;
  addons: SuiteAddonsResult;
  pricingHref: string;
}

function addonStatus(addon: EditableAddon): { label: string; tone: StatusChipTone } {
  if (!addon.is_active) return { label: "Not on sale", tone: "neutral" };
  if (addon.inventory === 0) return { label: "Sold out", tone: "warning" };
  return { label: "On sale", tone: "success" };
}

function AddonPrice({ addon }: { addon: EditableAddon }) {
  if (addon.offer_price_fils === 0) return <span className="text-text-secondary">Included</span>;
  return (
    <span className="flex items-baseline gap-2">
      <MoneyValue fils={addon.offer_price_fils} className="text-text-primary" />
      {addon.regular_price_fils > addon.offer_price_fils && (
        <s className="text-micro text-text-muted">
          <MoneyValue fils={addon.regular_price_fils} />
        </s>
      )}
    </span>
  );
}

export function SuitePricing({
  today,
  rateMonth,
  rateMonthLabel,
  rates,
  previousMonth,
  nextMonth,
  addons,
  pricingHref,
}: SuitePricingProps) {
  return (
    <>
      <SuiteDrawerSection
        id="suite-drawer-rates"
        title="Rate by day"
        control={<MonthNav label={rateMonthLabel} previous={previousMonth} next={nextMonth} />}
      >
        {rates === null ? (
          <ConsoleReadError
            title="Prices could not be loaded"
            message="The current rates could not be loaded."
            meaning="Prices have not changed."
            remedy="Close the suite and open it again."
          />
        ) : (
          <RateCalendar month={rateMonth} today={today} rates={rates} />
        )}
      </SuiteDrawerSection>

      <Separator className="bg-border" />

      <SuiteDrawerSection id="suite-drawer-addons" title="Add-ons">
        {!addons.ok ? (
          <ConsoleReadError
            title="Add-ons could not be loaded"
            message={addons.message}
            remedy="Close the suite and open it again."
          />
        ) : addons.addons.length === 0 ? (
          <p className="text-console-body text-text-secondary">No add-ons yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {addons.addons.map((addon) => {
              const status = addonStatus(addon);
              return (
                <li
                  key={addon.id ?? addon.name}
                  className="flex min-h-tap flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5"
                >
                  <span className="min-w-0 break-words text-console-body font-medium text-text-primary">
                    {addon.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-console-table">
                    <AddonPrice addon={addon} />
                    <StatusChip tone={status.tone}>{status.label}</StatusChip>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </SuiteDrawerSection>

      <div>
        <Button asChild variant="outline">
          <Link href={pricingHref}>Manage prices and add-ons</Link>
        </Button>
      </div>
    </>
  );
}
