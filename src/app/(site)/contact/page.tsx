import { publicPagePath } from "@/lib/services/site-content";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import {
  ArrowUpRightIcon,
  Clock3Icon,
  MailIcon,
  MapPinIcon,
  NavigationIcon,
} from "lucide-react";

import { ContactForm } from "@/components/marketing/contact-form";
import { OpenStreetMapVenueMap } from "@/components/marketing/home/openstreetmap-venue-map";
import {
  SiteFooterSlot,
  SiteNavSlot,
} from "@/components/marketing/site-chrome-slots";
import { MediaFrame } from "@/components/shared/media-frame";
import { ReservationSlot } from "@/components/marketing/reservation-slot";
import { JsonLd } from "@/components/marketing/structured-data";
import { Button } from "@/components/shared/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EMPTY_SNAPSHOT,
  getSetting,
  type SettingsSnapshot,
} from "@/lib/config";
import {
  CONTACT_PAGE_CONTENT,
} from "@/lib/config/contact";
import {
  VENUE_ADDRESS_LINES,
  VENUE_MAP_PRELOAD_MARGIN,
  VENUE_MAP_TILE_MAX_ZOOM,
  VENUE_MAP_TILE_URL,
} from "@/lib/config/entity";
import { WEEKDAY_KEYS, WEEKDAY_LABEL } from "@/lib/config/opening-hours";
import { clockLabel } from "@/lib/config/clock-picker";
import { publicOpeningHours } from "@/lib/services/opening-hours-service";
import { formatCalendarDayLong } from "@/lib/domain/time";
import { loadPublicBookingSettings } from "@/lib/db/queries/public-settings";
import { createClient } from "@/lib/db/server";
import { cmsPageMetadata } from "@/lib/config/cms/seo";
import type {
  ResolvedContactContent,
  ResolvedContactMethods,
} from "@/lib/config/cms/contact-content";
import { LAUNCH_MODE, SITE_NAME, breadcrumbJsonLd } from "@/lib/config/seo";
import { getContactContent, getHomeContent } from "@/lib/services/site-content";

const TITLE = CONTACT_PAGE_CONTENT.title;
const DESCRIPTION = CONTACT_PAGE_CONTENT.description;

export async function generateMetadata(): Promise<Metadata> {
  const content = await getContactContent();
  return cmsPageMetadata(
    {
      title: TITLE,
      description: DESCRIPTION,
      path: await publicPagePath("/contact"),
      indexable: LAUNCH_MODE === "full",
    },
    content.seo,
  );
}

async function loadContactSettings(): Promise<SettingsSnapshot> {
  try {
    const loaded = await loadPublicBookingSettings(await createClient());
    if (loaded.ok) return loaded.snapshot;
    console.error("[contact] public settings unavailable:", loaded.message);
  } catch (cause) {
    console.error(
      "[contact] public settings unavailable:",
      cause instanceof Error ? cause.message : "Unknown failure",
    );
  }
  return EMPTY_SNAPSHOT;
}

function ContactMethod({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="group flex gap-4 py-5 first:pt-0 last:pb-0">
      <span className="grid size-11 shrink-0 place-items-center rounded-(--radius-card) bg-brand-wash text-brand transition-colors group-hover:bg-brand group-hover:text-on-brand">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-body text-body font-medium text-text-primary">{title}</h3>
        <div className="mt-1 text-small leading-relaxed text-text-secondary">{children}</div>
      </div>
    </div>
  );
}

function OpeningHours({ settings, copy }: { settings: SettingsSnapshot; copy: ResolvedContactMethods }) {
  let schedule: ReturnType<typeof publicOpeningHours>;
  try { schedule = publicOpeningHours(settings); }
  catch { return <p>Opening hours are temporarily unavailable. Please contact us before visiting.</p>; }
  const week = schedule.days.slice(0, WEEKDAY_KEYS.length);
  const groups = week
    .map(({ date, windows }) => {
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
      return {
        order: (weekday + WEEKDAY_KEYS.length - 1) % WEEKDAY_KEYS.length,
        label: WEEKDAY_LABEL[WEEKDAY_KEYS[weekday]],
        hours: windows === null ? copy.unpublishedHours : windows.length ? windows.map((w) => `${clockLabel(w.opens)} – ${clockLabel(w.closes)}`).join(", ") : copy.closedLabel,
      };
    })
    .sort((a, b) => a.order - b.order)
    .reduce<{ from: string; to: string; hours: string }[]>((runs, day) => {
      const last = runs.at(-1);
      if (last && last.hours === day.hours) last.to = day.label;
      else runs.push({ from: day.label, to: day.label, hours: day.hours });
      return runs;
    }, []);
  return (
    <div className="flex flex-col gap-3">
      {week.every(({ windows }) => windows === null) ? <p>{copy.unpublishedHours}</p> : <dl className="flex flex-col gap-1.5">
        {groups.map(({ from, to, hours }) => (
          <div key={from} className="flex flex-wrap justify-between gap-x-3 gap-y-1">
            <dt>{from === to ? from : `${from} – ${to}`}</dt>
            <dd className="font-data text-text-primary">{hours}</dd>
          </div>
        ))}
      </dl>}
      {schedule.special.length > 0 && <div className="flex flex-col gap-3 border-t border-border pt-3">
        <p className="text-micro font-medium text-text-primary">Upcoming changes</p>
        <p className="text-micro text-text-muted">Closures take priority. One-off hours replace the schedule for that date.</p>
        {schedule.special.map((entry, i) => <div key={`${entry.kind}-${entry.from}-${i}`} className="text-micro">
          <p className="font-medium text-text-primary">{entry.kind} · {formatCalendarDayLong(entry.from)}{entry.to !== entry.from ? ` – ${formatCalendarDayLong(entry.to)}` : ""}</p>
          <p className="mt-1 text-text-secondary">{entry.detail}</p>
        </div>)}
      </div>}
    </div>
  );
}

function ContactMethodsLoading({ label }: { label: string }) {
  return (
    <Card
      aria-label={label}
      className="h-full gap-0 border border-border bg-surface-raised py-0 shadow-(--shadow-lg)"
    >
      <CardHeader className="border-b border-border px-5 py-6 sm:px-8 sm:py-7">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-5 w-64 max-w-full" />
      </CardHeader>
      <CardContent className="space-y-6 px-5 py-6 sm:px-8 sm:py-8">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex gap-4">
            <Skeleton className="size-11 shrink-0 rounded-(--radius-card)" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full max-w-sm" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

async function ContactMethodsCard({ copy }: { copy: ResolvedContactMethods }) {
  await connection();
  const settings = await loadContactSettings();
  const address = getSetting(settings, "contact.address")?.split("\n").filter(Boolean) ?? VENUE_ADDRESS_LINES;
  const addressLines = address.length > 3 ? [address[0], address.slice(1, -1).join(", "), address[address.length - 1]] : address;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.join(", "))}`;
  const email = getSetting(settings, "contact.email");

  return (
    <Card className="h-full gap-0 border border-border bg-surface-raised py-0 shadow-(--shadow-lg)">
      <CardHeader className="border-b border-border px-5 py-6 sm:px-8 sm:py-7">
        <h2 className="font-display text-h2 tracking-display text-text-primary">
          {copy.heading}
        </h2>
        <p className="mt-1 text-small text-text-secondary">{copy.description}</p>
      </CardHeader>
      <CardContent className="px-5 py-6 sm:px-8 sm:py-8">
        <ContactMethod icon={<MailIcon aria-hidden="true" className="size-5" />} title={copy.emailTitle}>
          {email ? (
            <a
              href={`mailto:${email}`}
              className="inline-flex items-center gap-1.5 font-medium text-brand hover:text-brand-hover"
            >
              {email}
              <ArrowUpRightIcon aria-hidden="true" className="size-3.5" />
            </a>
          ) : (
            <p>{copy.emailFallback}</p>
          )}
        </ContactMethod>


        <Separator />
        <ContactMethod icon={<MapPinIcon aria-hidden="true" className="size-5" />} title={copy.visitTitle}>
          <address className="not-italic">
            {addressLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
          <Button asChild variant="link" size="sm" className="mt-2">
            <a href={directions} target="_blank" rel="noopener noreferrer">
              <NavigationIcon aria-hidden="true" />
              {copy.directionsLabel}
              <ArrowUpRightIcon aria-hidden="true" data-icon="inline-end" />
            </a>
          </Button>
        </ContactMethod>

        <Separator />
        <ContactMethod icon={<Clock3Icon aria-hidden="true" className="size-5" />} title={<>{copy.hoursTitle} <span className="font-normal text-text-muted">(Dubai time)</span></>}>
          <OpeningHours settings={settings} copy={copy} />
        </ContactMethod>
      </CardContent>
    </Card>
  );
}

async function ContactMap() {
  const { location } = await getHomeContent();
  return (
    <section aria-label={location.locality} className="relative h-80 w-full overflow-hidden border-t border-border bg-surface-sunken sm:h-96 lg:h-120">
      <OpenStreetMapVenueMap
        center={location.center}
        locality={location.locality}
        maxZoom={VENUE_MAP_TILE_MAX_ZOOM}
        preloadMargin={VENUE_MAP_PRELOAD_MARGIN}
        tileUrl={VENUE_MAP_TILE_URL}
        zoom={location.mapZoom}
      />
      <span className="pointer-events-none absolute bottom-3 left-3 z-20 inline-flex w-fit max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full border border-on-scrim/20 bg-scrim-ink/65 px-2.5 py-1.5 text-micro font-medium text-on-scrim shadow-(--shadow-md) backdrop-blur-md sm:bottom-5 sm:left-5 sm:gap-2 sm:px-3.5 sm:py-2 sm:text-small">
        <MapPinIcon aria-hidden="true" className="size-3.5 text-band-accent sm:size-4" />
        {location.locality}
      </span>
      <span className="absolute top-3 right-3 z-20 sm:top-5 sm:right-5">
        <Button asChild tone="band-scrim" size="sm" className="shadow-(--shadow-md) backdrop-blur-md">
          <a href={location.mapLink} target="_blank" rel="noopener noreferrer">
            {location.openMapLabel}
            <ArrowUpRightIcon aria-hidden="true" data-icon="inline-end" />
          </a>
        </Button>
      </span>
    </section>
  );
}

export default async function ContactPage() {
  const content: ResolvedContactContent = await getContactContent();
  const { hero } = content;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface-base transition-colors duration-500 motion-reduce:transition-none">
      <SiteNavSlot overlayHeroId="contact-hero" />
      <main className="flex-1">
        <section
          id="contact-hero"
          className="relative isolate flex min-h-hero-media items-center overflow-hidden bg-home-hero-surface px-5 pt-nav text-band-ink xs:px-6 sm:px-10 lg:px-14"
        >
          <MediaFrame
            src={hero.image}
            alt={hero.imageAlt}
            sizes="100vw"
            preload
            frameClassName="absolute inset-0 -z-30"
            className="object-center"
          />
          <span aria-hidden="true" className="absolute inset-0 -z-20 bg-band-deep/65" />
          <span
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-linear-to-b from-band-deep/45 via-band-deep/65 to-band-deep/90"
          />

          <header className="mx-auto w-full max-w-4xl py-16 text-center sm:py-20">
            <span className="inline-flex items-center gap-3 font-data text-micro font-medium tracking-kicker text-band-accent uppercase">
              <span aria-hidden="true" className="h-px w-8 bg-current" />
              {hero.eyebrow}
              <span aria-hidden="true" className="h-px w-8 bg-current" />
            </span>
            <h1 className="mt-5 font-display text-display leading-none tracking-display text-band-ink text-balance">
              {hero.title}{" "}
              <em className="font-accent font-medium text-band-accent italic">
                {hero.accent}
              </em>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-small leading-relaxed text-band-muted text-pretty sm:mt-6 sm:text-lead">
              {hero.body}
            </p>
          </header>
        </section>

        <section className="relative z-10 -mt-10 px-5 pb-16 xs:px-6 sm:-mt-12 sm:px-10 sm:pb-20 lg:px-14 lg:pb-28">
          <div className="mx-auto grid w-full max-w-6xl items-stretch gap-6 lg:grid-cols-2 lg:gap-10">
            <ContactForm copy={content.form} />
            <Suspense
              fallback={<ContactMethodsLoading label={content.methods.loadingLabel} />}
            >
              <ContactMethodsCard copy={content.methods} />
            </Suspense>
          </div>
        </section>
        <ReservationSlot page="contact" />
        <Suspense fallback={<Skeleton className="h-80 w-full rounded-none sm:h-96 lg:h-120" />}>
          <ContactMap />
        </Suspense>
      </main>
      <SiteFooterSlot />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: SITE_NAME, path: "/" },
          { name: TITLE, path: "/contact" },
        ])}
      />
    </div>
  );
}
