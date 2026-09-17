"use client";

import { useEffect, useState } from "react";

import { SiteLoadingScreen } from "@/components/marketing/site-loading-screen";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { LOADING_CONTENT } from "@/lib/config/loading";
import { MARKETING_STARTUP_LOADER_MS } from "@/lib/config/marketing";

export function SiteStartupLoader() {
  const reducedMotion = usePrefersReducedMotion();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const remaining = reducedMotion
      ? 0
      : Math.max(0, MARKETING_STARTUP_LOADER_MS - performance.now());
    const timer = window.setTimeout(
      () => setVisible(false),
      remaining,
    );
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50">
      <SiteLoadingScreen label={LOADING_CONTENT.startupLabel} />
    </div>
  );
}
