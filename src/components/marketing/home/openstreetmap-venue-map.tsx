"use client";

import "leaflet/dist/leaflet.css";

import type { Map as LeafletMap } from "leaflet";
import { MapPinIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";

interface OpenStreetMapVenueMapProps {
  center: readonly [number, number];
  locality: string;
  maxZoom: number;
  preloadMargin: string;
  tileUrl: string;
  zoom: number;
}

function MapPending({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="relative grid size-full place-items-center overflow-hidden bg-surface-sunken text-center"
    >
      <Skeleton className="absolute inset-0 size-full rounded-none" />
      <span className="relative flex flex-col items-center gap-3 px-6 text-small text-text-secondary">
        <span className="grid size-12 place-items-center rounded-full border border-border bg-surface-raised shadow-(--shadow-xs)">
          <MapPinIcon aria-hidden="true" className="size-5 text-brand" />
        </span>
        {label}
      </span>
    </div>
  );
}

export function OpenStreetMapVenueMap({
  center,
  locality,
  maxZoom,
  preloadMargin,
  tileUrl,
  zoom,
}: OpenStreetMapVenueMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: preloadMargin },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [preloadMargin]);

  useEffect(() => {
    const container = containerRef.current;
    if (!nearViewport || !container || mapRef.current) return;

    let active = true;

    void import("leaflet")
      .then((leaflet) => {
        if (!active) return;

        const mapCenter: [number, number] = [center[0], center[1]];
        const map = leaflet.map(container, {
          attributionControl: false,
          center: mapCenter,
          scrollWheelZoom: false,
          zoom,
          zoomControl: false,
        });

        leaflet
          .tileLayer(tileUrl, {
            maxZoom,
          })
          .addTo(map);

        leaflet.control.zoom({ position: "bottomright" }).addTo(map);
        leaflet
          .circleMarker(mapCenter, {
            color: "var(--on-brand)",
            fillColor: "var(--brand)",
            fillOpacity: 0.9,
            radius: 7,
            weight: 3,
          })
          .bindTooltip(locality, { direction: "top", offset: [0, -8] })
          .addTo(map);

        mapRef.current = map;
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [center, locality, maxZoom, nearViewport, tileUrl, zoom]);

  return (
    <div className="relative isolate size-full">
      {(!nearViewport || failed) && (
        <div className="absolute inset-0 z-10">
          <MapPending
            label={failed ? "Open the full map to view the location" : "Loading map preview…"}
          />
        </div>
      )}
      <div
        ref={containerRef}
        aria-label={`Interactive map of ${locality}`}
        className="size-full bg-surface-sunken"
      />
    </div>
  );
}
