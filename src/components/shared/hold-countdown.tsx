"use client";

import { useEffect, useRef, useState } from "react";

import { formatCountdown } from "@/lib/domain/time";
import { cn } from "@/lib/utils";


export interface HoldCountdownProps {
  expiresAt: Date;
  onExpire?: () => void;
  urgentBelowMs?: number;
  className?: string;
}

function remainingMs(expiresAt: Date): number {
  return expiresAt.getTime() - Date.now();
}

export function HoldCountdown({
  expiresAt,
  onExpire,
  urgentBelowMs,
  className,
}: HoldCountdownProps) {
  const [remaining, setRemaining] = useState(() => remainingMs(expiresAt));
  const fired = useRef(false);

  const expiresAtMs = expiresAt.getTime();

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining(expiresAtMs - Date.now());
    }, 1000);

    return () => window.clearInterval(id);
  }, [expiresAtMs]);

  useEffect(() => {
    if (remaining > 0) {
      fired.current = false;
      return;
    }
    if (fired.current) return;
    fired.current = true;
    onExpire?.();
  }, [remaining, onExpire]);

  const urgent =
    urgentBelowMs !== undefined && remaining > 0 && remaining <= urgentBelowMs;

  return (
    <span
      data-urgent={urgent || undefined}
      className={cn("font-data tabular-nums", className)}
      suppressHydrationWarning
    >
      {formatCountdown(remaining)}
    </span>
  );
}
