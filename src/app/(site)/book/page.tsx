import { CHECKOUT_FLOW } from "@/lib/config/checkout-flow";
import { BookingOfferHeadline } from "@/components/booking/booking-offer-headline";
import { quoteBooking, type Quote } from "@/lib/services/pricing-service";
import { bookingPreviewState } from "@/lib/config/booking-preview";
import type { Metadata } from "next";
import { Suspense } from "react";

import { BookingWidget } from "@/components/booking/booking-widget";
import { BOOKING_STEPS } from "@/components/booking/booking-steps";
import type { BookingLimits } from "@/components/booking/booking-types";
import { BookingPageMotion } from "@/components/marketing/booking-page-motion";
import {
  SiteFooterSlot,
  SiteNavSlot,
} from "@/components/marketing/site-chrome-slots";
import {
  BookingPageHero,
} from "@/components/marketing/booking-page-sections";
import { ReservationSlot } from "@/components/marketing/reservation-slot";
import { JsonLd } from "@/components/marketing/structured-data";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { headers } from "next/headers";

import { EMPTY_SNAPSHOT, getSetting, requireSetting, type SettingsSnapshot } from "@/lib/config";
import {
  BOOKING_PAGE_CONTENT,
  BOOKING_PROMO_CODES_LIVE,
} from "@/lib/config/booking-page";
import type { ResolvedBookingMessages } from "@/lib/config/cms/book-content";
import { cmsPageMetadata } from "@/lib/config/cms/seo";
import { SITE_NAME, breadcrumbJsonLd } from "@/lib/config/seo";
import { createClient } from "@/lib/db/server";
import { loadPublicBookingSettings } from "@/lib/db/queries/public-settings";
import { getAvailabilityWindow } from "@/lib/services/availability-service";
import { paymentMode } from "@/lib/payments";
import { todayBookingStatus } from "@/lib/services/today-booking-service";
import { TodayBookingCountdown } from "@/components/marketing/today-booking-countdown";
import { getBookingContent } from "@/lib/services/site-content";
import { loadRateLimitSettings } from "@/lib/db/queries/rate-limit-settings";
import { checkConfiguredRateLimit } from "@/lib/services/configured-rate-limit";
import { DUBAI_TIME_ZONE, formatDubaiDayLong } from "@/lib/domain/time";
import type {
  BookingAddonCard,
  BookingDay,
} from "@/components/booking/booking-types";
import {
  buildFixtures,
  closedDate,
  unpublishedDate,
} from "@/app/(site)/book/fixtures";
import { toGuestAddonCard } from "@/app/(site)/book/quote";
import { listPublicAddons } from "@/lib/db/queries/pricing";
import type { WellPlaceClient } from "@/lib/db/types";

const TITLE = BOOKING_PAGE_CONTENT.title;
const DESCRIPTION = BOOKING_PAGE_CONTENT.description;

export async function generateMetadata(): Promise<Metadata> {
  const content = await getBookingContent();
  return cmsPageMetadata(
    { title: TITLE, description: DESCRIPTION, path: "/book" },
    content.seo,
  );
}

function dubaiToday(now: Date): { day: number; month: number; year: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DUBAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function horizonDates(
  now: Date,
  horizonDays: number,
): { day: number; month: number; year: number }[] {
  const today = dubaiToday(now);
  const base = Date.UTC(today.year, today.month - 1, today.day);
  return Array.from({ length: horizonDays + 1 }, (_, index) => {
    const d = new Date(base + index * 86_400_000);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  });
}

async function networkKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return `availability:ip:${ip}`;
}

type AvailabilityFailure = "settings" | "rateLimited" | "times";

type RealAvailability =
  | { ok: true; settings: SettingsSnapshot; days: BookingDay[] }
  | { ok: false; settings: SettingsSnapshot; reason: AvailabilityFailure };

function failureMessage(
  reason: AvailabilityFailure,
  messages: ResolvedBookingMessages,
): string {
  if (reason === "settings") return messages.settingsUnavailable;
  if (reason === "rateLimited") return messages.rateLimited;
  return messages.timesUnavailable;
}

async function loadAvailability(
  client: WellPlaceClient,
  now: Date,
): Promise<RealAvailability> {
  const [loaded, limits] = await Promise.all([
    loadPublicBookingSettings(client),
    loadRateLimitSettings(),
  ]);
  const settings = loaded.ok ? loaded.snapshot : EMPTY_SNAPSHOT;

  if (!loaded.ok) {
    console.error("[booking] public settings unavailable:", loaded.message);
    return { ok: false, settings, reason: "settings" };
  }

  if (!limits.ok) {
    console.error("[booking] search limits could not be loaded:", limits.message);
    return { ok: false, settings, reason: "settings" };
  }
  const verdict = checkConfiguredRateLimit("availability", limits.snapshot,
    await networkKey(),
  );

  if (!verdict.allowed) {
    console.warn(`[booking] availability rate limit reached, retry in ${verdict.retryAfterSeconds}s`);
    return { ok: false, settings, reason: "rateLimited" };
  }

  const dates = horizonDates(
    now,
    requireSetting(settings, "booking.max_horizon_days"),
  );
  const window = await getAvailabilityWindow(client, settings, {
    dates,
    durationsHours: requireSetting(settings, "booking.durations_hours"),
    now,
  });

  if (!window.ok) {
    return { ok: false, settings, reason: "times" };
  }

  const days: BookingDay[] = window.days.map((day) => ({
    date: day.date,
    label: formatDubaiDayLong(new Date(`${day.date}T12:00:00+04:00`)),
    status: day.status,
    slotsByDuration: day.slotsByDuration,
    messageByDuration: day.messageByDuration,
  }));

  return { ok: true, settings, days };
}

async function loadHeadlineQuote(
  client: WellPlaceClient,
  settings: SettingsSnapshot,
  durationHours: number,
  startsAt: string,
  adults: number,
): Promise<Quote | null> {
  try {
    return await quoteBooking(
      client,
      settings,
      {
        startsAt,
        durationHours,
        adults,
        childAges: [],
        addonQuantities: {},
        voucherCode: null,
        customerId: null,
        manualTotalFils: null,
      },
      { audience: "guest" },
    );
  } catch (cause) {
    console.error(
      "[booking] headline offer quote unavailable:",
      cause instanceof Error ? cause.message : "Unknown failure",
    );
    return null;
  }
}

interface BookPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function BookingPanelLoading({ label }: { label: string }) {
  return (
    <div className="booking-motion-widget">
      <div aria-hidden className="mx-auto w-full max-w-widget px-4 pt-5 sm:px-6 lg:px-8">
        <Card className="mx-auto w-full max-w-card-panel items-center gap-4 rounded-(--radius-modal) border border-border bg-surface-raised px-5 py-8 ring-0 sm:px-10">
          <Skeleton className="h-7 w-48 rounded-full" />
          <Skeleton className="h-14 w-52" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full max-w-measure" />
          <Skeleton className="h-12 w-full" />
        </Card>
      </div>
      <div className="mx-auto w-full max-w-widget px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <Card
          aria-label={label}
          className="gap-0 overflow-hidden border border-border bg-surface-raised py-0"
        >
          <div className="flex justify-between gap-4 border-b border-border px-4 py-5 sm:px-6 lg:px-8">
            {BOOKING_STEPS.map((step) => (
              <Skeleton key={step.id} className="h-5 w-16 sm:w-24" />
            ))}
          </div>
          <div className="grid gap-6 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div className="space-y-5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-control w-full" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-control w-full" />
              <Skeleton className="h-control w-full" />
            </div>
            <Skeleton className="min-h-64 w-full" />
          </div>
        </Card>
      </div>
    </div>
  );
}

async function BookingWidgetResolved({ searchParams }: BookPageProps) {
  const state = bookingPreviewState((await searchParams).state);
  const now = new Date();
  const client = await createClient();

  const [{ messages, gallery }, catalogue, live] = await Promise.all([
    getBookingContent(),
    listPublicAddons(client),
    state === null ? loadAvailability(client, now) : Promise.resolve(null),
  ]);

  const addons: readonly BookingAddonCard[] =
    state === "no-addons" ? [] : catalogue.map(toGuestAddonCard);

  const settings = live?.settings ?? EMPTY_SNAPSHOT;
  const limits: BookingLimits = {
    durationsHours: requireSetting(settings, "booking.durations_hours"),
    guestsMin: requireSetting(settings, "booking.guests_min"),
    guestsMax: requireSetting(settings, "booking.guests_max"),
    childMinAge: requireSetting(settings, "booking.child_min_age"),
    childMaxAge: requireSetting(settings, "booking.child_max_age"),
    bookerMinAge: requireSetting(settings, "booking.booker_min_age"),
    holdMinutes: requireSetting(settings, "hold.minutes"),
  };

  const contactEmail = getSetting(settings, "contact.email");

  const fixtures = buildFixtures({
    now,
    durationsHours: limits.durationsHours,
    startIntervalMinutes: requireSetting(settings, "booking.start_interval_minutes"),
    holdMinutes: limits.holdMinutes,
    holdSeconds: state === "expiring" ? 20 : undefined,
    withHold: state !== "expired",
    urgency: {
      enabled: requireSetting(settings, "urgency.enabled"),
      thresholdFew: requireSetting(settings, "urgency.threshold_few"),
      thresholdLast: requireSetting(settings, "urgency.threshold_last"),
      textFew: requireSetting(settings, "urgency.text_few"),
      textLast: requireSetting(settings, "urgency.text_last"),
      textNone: requireSetting(settings, "urgency.text_none"),
      textFilling: requireSetting(settings, "urgency.text_filling"),
    },
  });

  const days = live === null ? fixtures.days : live.ok ? live.days : [];

  const initialDate =
    state === "closed"
      ? closedDate(fixtures)
      : state === "unpublished"
        ? unpublishedDate(fixtures)
        : (days[0]?.date ?? fixtures.initialDate);

  const errorMessage =
    live && !live.ok
      ? failureMessage(live.reason, messages)
      : state === "error"
        ? messages.systemUnreachable
        : null;

  const headlineDuration = Math.min(...limits.durationsHours);
  const headlineTime = days.flatMap((day) => day.slotsByDuration[headlineDuration] ?? [])[0]?.startsAt ?? now.toISOString();
  const headlineQuote = await loadHeadlineQuote(client, settings, headlineDuration, headlineTime, limits.guestsMin);
  const couponParam = (await searchParams).coupon;
  const today = live?.ok ? days[0] : undefined;
  const todayStatus = today
    ? todayBookingStatus({
        day: {
          date: today.date,
          status: today.status,
          slots: today.slotsByDuration[headlineDuration] ?? [],
          message: today.messageByDuration[headlineDuration] ?? null,
        },
        snapshot: settings,
        now,
      })
    : null;
  return (<>
    {todayStatus && todayStatus.kind !== "closed" && (
      <div className="px-4 pt-5 sm:px-6 lg:px-8">
        <TodayBookingCountdown status={todayStatus} bookHref="#booking-widget" />
      </div>
    )}
    {headlineQuote && <BookingOfferHeadline quote={headlineQuote} limits={limits} vatPercent={requireSetting(settings, "tax.vat_percent")} inclusive={requireSetting(settings, "tax.inclusive")} />}
    <BookingWidget
      gallery={gallery}
      initialCoupon={typeof couponParam === "string" ? couponParam.slice(0, CHECKOUT_FLOW.codeLength).toUpperCase() : ""}
      preview={live === null}
      days={days}
      limits={limits}
      initialDate={initialDate}
      initialDurationHours={limits.durationsHours[0]}
      initialGuests={{ adults: limits.guestsMin, childAges: [] }}
      addons={addons}
      personalRequestMaxLength={requireSetting(
        settings,
        "booking.personal_request_max_length",
      )}
      promoCodesLive={BOOKING_PROMO_CODES_LIVE}
      loading={state === "loading"}
      error={errorMessage}
      addonsError={
        state === "addons-error"
          ? messages.addonsUnavailable
          : null
      }
      initialHoldExpired={state === "expired"}
      email={contactEmail}
      paymentSimulation={paymentMode() === "simulation"}
    />
  </>);
}

export default async function BookPage({ searchParams }: BookPageProps) {
  const content = await getBookingContent();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface-base transition-colors duration-500 motion-reduce:transition-none">
      <SiteNavSlot overlayHeroId="book-hero" />

      <BookingPageMotion>
        <BookingPageHero hero={content.hero} />

        <section
          id="booking-widget"
          aria-label={content.messages.widgetLabel}
          className="relative z-10 -mt-10 scroll-mt-nav pb-16 sm:-mt-12 sm:pb-20 lg:pb-28"
        >
          <Suspense fallback={<BookingPanelLoading label={content.messages.loadingLabel} />}>
            <BookingWidgetResolved searchParams={searchParams} />
          </Suspense>
        </section>
      </BookingPageMotion>

      <ReservationSlot page="book" />

      <SiteFooterSlot />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: SITE_NAME, path: "/" },
          { name: TITLE, path: "/book" },
        ])}
      />
    </div>
  );
}
