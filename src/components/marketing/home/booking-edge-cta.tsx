"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SiteLoadingScreen } from "@/components/marketing/site-loading-screen";
import { Button } from "@/components/shared/button";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";

export interface BookingEdgeCtaProps {
  bookHref: string;
}

export function BookingEdgeCta({ bookHref }: BookingEdgeCtaProps) {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const [visible, setVisible] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    router.prefetch(bookHref);
    const hero = document.getElementById("home-hero");
    if (!hero) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0 },
    );

    observer.observe(hero);
    return () => observer.disconnect();
  }, [bookHref, router]);

  const openBooking = () => {
    if (reducedMotion) return;
    setTransitioning(true);
  };
  return (
    <>
      <Button
        asChild
        tone="edge"
        size="edge"
        data-visible={visible || undefined}
        aria-hidden={!visible}
        tabIndex={visible ? undefined : -1}
        className="booking-edge-button pointer-events-none fixed top-1/2 right-0 z-40 -translate-y-1/2 translate-x-full rounded-none border-r-0 opacity-0 shadow-(--shadow-lg) data-visible:pointer-events-auto data-visible:translate-x-0 data-visible:opacity-100"
      >
        <Link
          href={bookHref}
          onClick={openBooking}
          aria-label="Open suite booking"
        >
          <span aria-hidden="true" className="booking-edge-media">
            <Image
              src="/renderings/reception-sitting-areaa-view-4-960.webp"
              alt=""
              fill
              sizes="(max-width: 767px) 3rem, 5rem"
              loading="eager"
              className="object-cover"
            />
          </span>
          <span className="booking-edge-body">
            <span
              aria-hidden="true"
              className="booking-edge-corner booking-edge-corner-start"
            />
            <span className="booking-edge-label font-data font-semibold tracking-eyebrow uppercase md:font-medium">
              Book now
            </span>
            <span
              aria-hidden="true"
              className="booking-edge-corner booking-edge-corner-end"
            />
          </span>
        </Link>
      </Button>

      {transitioning ? (
        <div className="fixed inset-0 z-50">
          <SiteLoadingScreen label="Loading booking options." />
        </div>
      ) : null}
    </>
  );
}
