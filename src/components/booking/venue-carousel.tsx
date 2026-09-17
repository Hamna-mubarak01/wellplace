"use client";

import { BOOKING_RENDERINGS } from "@/lib/config/booking-media";
import Image from "next/image";
import { ImageOffIcon } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Button } from "@/components/shared/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";


export interface VenueView {
  readonly id: string;
  readonly src: string;
  readonly alt: string;
}

const ARROW_CLASS =
  "border-0 bg-on-scrim text-on-scrim-action shadow-sm hover:bg-on-scrim-muted hover:text-on-scrim-action disabled:opacity-0";

function VenueSlide({ view }: { view: VenueView }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-surface-sunken">
      {status !== "error" ? (
        <Image
          src={view.src}
          alt={view.alt}
          fill
          sizes="(min-width: 1024px) 20rem, 100vw"
          className={cn(
            "object-cover transition-opacity duration-150 motion-reduce:transition-none",
            status === "loaded" ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
      ) : null}

      {status === "loading" ? (
        <Skeleton className="absolute inset-0 rounded-none" />
      ) : null}

      {status === "error" ? (
        <div className="flex size-full flex-col items-center justify-center gap-2 px-4 text-center">
          <ImageOffIcon aria-hidden className="size-5 text-text-muted" />
          <p className="text-fine text-pretty text-text-secondary">
            This view isn&apos;t available right now.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function VenueCarousel({ className, views = BOOKING_RENDERINGS }: { className?: string; views?: readonly VenueView[] }) {
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const headingId = useId();

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSelected(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  const scrollTo = useCallback((index: number) => api?.scrollTo(index), [api]);

  return (
    <div className={cn("relative", className)}>
      <h2 id={headingId} className="sr-only">
        Suite views
      </h2>

      <Carousel
        setApi={setApi}
        aria-labelledby={headingId}
        opts={{ loop: true, duration: reducedMotion ? 0 : undefined }}
      >
        <CarouselContent className="ml-0">
          {views.map((view) => (
            <CarouselItem key={view.id} className="pl-0">
              <VenueSlide view={view} />
            </CarouselItem>
          ))}
        </CarouselContent>

        <CarouselPrevious
          aria-label="Show previous view"
          size="icon"
          className={cn(ARROW_CLASS, "left-2")}
        />
        <CarouselNext
          aria-label="Show next view"
          size="icon"
          className={cn(ARROW_CLASS, "right-2")}
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1">
          {views.map((view, index) => (
            <Button
              key={view.id}
              type="button"
              variant="ghost"
              tone="plain"
              size="icon"
              onClick={() => scrollTo(index)}
              aria-label={index === selected ? "Current view" : "Show this view"}
              aria-current={index === selected || undefined}
              className="pointer-events-auto size-6 rounded-full bg-transparent hover:bg-transparent dark:hover:bg-transparent"
            >
              <span
                aria-hidden
                className={cn(
                  "size-2 rounded-full shadow-sm transition-colors duration-150 motion-reduce:transition-none",
                  index === selected ? "bg-on-scrim" : "bg-on-scrim/50",
                )}
              />
            </Button>
          ))}
        </div>
      </Carousel>
    </div>
  );
}
