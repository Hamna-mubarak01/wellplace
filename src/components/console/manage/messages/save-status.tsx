"use client";

import { useEffect, useState } from "react";
import {
  CheckIcon,
  LoaderIcon,
  PencilIcon,
  TriangleAlertIcon,
} from "lucide-react";

import {
  StatusChip,
  type StatusChipTone,
} from "@/components/console/shared/status-chip";
import { formatDubaiTime } from "@/lib/domain/time";

export type SaveState = "clean" | "unsaved" | "saving" | "error";

export interface SaveStatusProps {
  state: SaveState;
  savedAt: string | null;
  className?: string;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function elapsedLabel(savedAt: string, now: number): string {
  const saved = new Date(savedAt).getTime();
  if (!Number.isFinite(saved)) return "Saved";

  const gap = Math.max(0, now - saved);
  if (gap < 5_000) return "Saved just now";
  if (gap < MINUTE) return `Saved ${Math.floor(gap / 1000)}s ago`;
  if (gap < HOUR) {
    const minutes = Math.floor(gap / MINUTE);
    return `Saved ${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }
  return `Saved at ${formatDubaiTime(savedAt)}`;
}

const TONE: Readonly<Record<SaveState, StatusChipTone>> = {
  clean: "success",
  unsaved: "warning",
  saving: "info",
  error: "danger",
};

export function SaveStatus({ state, savedAt, className }: SaveStatusProps) {
  const [now, setNow] = useState(() => Date.now());
  const ticking = state === "clean" && savedAt !== null;

  useEffect(() => {
    if (!ticking) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [ticking]);

  if (state === "saving") {
    return (
      <StatusChip tone={TONE.saving} Icon={LoaderIcon} className={className}>
        Saving…
      </StatusChip>
    );
  }

  if (state === "error") {
    return (
      <StatusChip
        tone={TONE.error}
        Icon={TriangleAlertIcon}
        className={className}
      >
        Not saved
      </StatusChip>
    );
  }

  if (state === "unsaved") {
    return (
      <StatusChip tone={TONE.unsaved} Icon={PencilIcon} className={className}>
        Unsaved changes
      </StatusChip>
    );
  }

  return (
    <StatusChip tone={TONE.clean} Icon={CheckIcon} className={className}>
      <span suppressHydrationWarning>
        {savedAt === null ? "No changes yet" : elapsedLabel(savedAt, now)}
      </span>
    </StatusChip>
  );
}
