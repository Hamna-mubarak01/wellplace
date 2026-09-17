import {
  ArrowUpRightIcon,
  MapPinIcon,
  NavigationIcon,
} from "lucide-react";

import { OpenStreetMapVenueMap } from "@/components/marketing/home/openstreetmap-venue-map";
import { Reveal } from "@/components/marketing/home/reveal";
import { Button } from "@/components/shared/button";
import { Card } from "@/components/ui/card";
import type { ResolvedHomeContent } from "@/lib/config/cms/home-content";
import {
  VENUE_MAP_PRELOAD_MARGIN,
  VENUE_MAP_TILE_MAX_ZOOM,
  VENUE_MAP_TILE_URL,
} from "@/lib/config/entity";

export function HomeLocation({
  content,
}: {
  content: ResolvedHomeContent["location"];
}) {
  // [§Owner Find Us correction, 15 Sep] Keep the complete address in three rows.
  const addressLines = [
    content.addressLines[0],
    content.addressLines.slice(1, -1).join(", "),
    content.addressLines.at(-1),
  ];

  return (
    <section
      id="location"
      className="bg-home-location-surface py-8 transition-colors duration-500 motion-reduce:transition-none sm:py-20 md:py-24 lg:py-32"
    >
      <div className="home-floating-safe mx-auto w-full max-w-7xl px-5 xs:px-6 sm:px-10 lg:px-14">
        <div className="grid items-center gap-4 sm:gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
          <Reveal>
            <Card className="relative aspect-16/10 gap-0 overflow-hidden border border-border bg-surface-sunken py-0 shadow-(--shadow-lg) sm:aspect-16/11">
              <OpenStreetMapVenueMap
                center={content.center}
                locality={content.locality}
                maxZoom={VENUE_MAP_TILE_MAX_ZOOM}
                preloadMargin={VENUE_MAP_PRELOAD_MARGIN}
                tileUrl={VENUE_MAP_TILE_URL}
                zoom={content.mapZoom}
              />
              <span className="pointer-events-none absolute right-2.5 bottom-2.5 left-2.5 z-20 inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border border-on-scrim/20 bg-scrim-ink/65 px-2.5 py-1.5 text-micro font-medium text-on-scrim shadow-(--shadow-md) backdrop-blur-md sm:right-auto sm:bottom-5 sm:left-5 sm:gap-2 sm:px-3.5 sm:py-2 sm:text-small">
                <MapPinIcon aria-hidden="true" className="size-3.5 text-band-accent sm:size-4" />
                {content.locality}
              </span>
              <span className="absolute top-5 right-5 z-20 hidden sm:block">
                <Button
                  asChild
                  tone="scrim"
                  size="sm"
                  className="shadow-(--shadow-md) backdrop-blur-md"
                >
                  <a href={content.mapLink} target="_blank" rel="noopener noreferrer">
                    {content.openMapLabel}
                    <ArrowUpRightIcon aria-hidden="true" data-icon="inline-end" />
                  </a>
                </Button>
              </span>
            </Card>

          </Reveal>

          <Reveal delayStep={1} className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2.5 font-data text-label font-medium tracking-label text-brand uppercase">
              <span aria-hidden="true" className="h-0.5 w-6 bg-current" />
              {content.eyebrow}
            </span>
            <h2 className="mt-2 font-display text-h2 leading-tight text-text-primary sm:mt-4 sm:text-h1">
              {content.title}{" "}
              <em className="font-accent font-medium text-brand italic">{content.accent}</em>
            </h2>
            <p className="mx-auto mt-2.5 max-w-measure text-micro leading-relaxed text-text-secondary text-pretty sm:mt-5 sm:text-body lg:mx-0">
              {content.body}
            </p>

            <div className="mt-4 flex flex-col items-center justify-center gap-2.5 border-y border-border py-3 sm:mt-7 sm:flex-row sm:items-start sm:gap-4 sm:py-5 lg:flex-col lg:items-center xl:flex-row xl:items-start xl:justify-start">
              <span className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-surface-raised shadow-(--shadow-xs) sm:size-11">
                <MapPinIcon aria-hidden="true" className="size-4 text-brand sm:size-5" />
              </span>
              <address className="font-body text-micro leading-relaxed text-text-secondary text-center not-italic sm:font-data sm:text-left sm:text-small sm:leading-loose lg:text-center xl:text-left">
                {addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-1.5 xs:flex xs:flex-wrap xs:items-center xs:justify-center sm:mt-7 sm:gap-3 lg:justify-start">
              <Button asChild tone="brand" size="sm" className="w-full xs:w-auto">
                <a href={content.directionsLink} target="_blank" rel="noopener noreferrer">
                  <NavigationIcon aria-hidden="true" />
                  {content.directionsLabel}
                </a>
              </Button>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
