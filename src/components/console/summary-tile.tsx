import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { ConsoleCard, ConsoleCardBody } from "@/components/console/console-surface";
import { cn } from "@/lib/utils";

export type SummaryTileTone = "default" | "muted" | "success" | "warning" | "danger" | "info";

const TONE_CARD: Readonly<Record<SummaryTileTone, string>> = {
  default: "",
  muted: "",
  success: "border-success-border bg-success-wash",
  warning: "border-warning-border bg-warning-wash",
  danger: "border-danger-border bg-danger-wash",
  info: "border-info-border bg-info-wash",
};

const TONE_LABEL: Readonly<Record<SummaryTileTone, string>> = {
  default: "text-text-muted",
  muted: "text-text-muted",
  success: "text-success-ink",
  warning: "text-warning-ink",
  danger: "text-danger-ink",
  info: "text-info-ink",
};

const TONE_VALUE: Readonly<Record<SummaryTileTone, string>> = {
  default: "text-text-primary",
  muted: "text-text-secondary",
  success: "text-success-ink",
  warning: "text-warning-ink",
  danger: "text-danger-ink",
  info: "text-info-ink",
};

const TONE_HINT: Readonly<Record<SummaryTileTone, string>> = {
  default: "text-text-muted",
  muted: "text-text-muted",
  success: "text-success-ink",
  warning: "text-warning-ink",
  danger: "text-danger-ink",
  info: "text-info-ink",
};

export interface SummaryTileProps {
  label: string;
  value: ReactNode;
  hint?: string;
  muted?: boolean;
  tone?: SummaryTileTone;
  Icon?: LucideIcon;
  className?: string;
}

export function SummaryTile({
  label,
  value,
  hint,
  muted = false,
  tone,
  Icon,
  className,
}: SummaryTileProps) {
  const resolved: SummaryTileTone = tone ?? (muted ? "muted" : "default");

  return (
    <ConsoleCard className={cn("h-full", TONE_CARD[resolved], className)}>
      <ConsoleCardBody className="@container flex h-full min-h-console-tile flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "min-w-0 text-console-label tracking-label uppercase",
              TONE_LABEL[resolved],
            )}
          >
            {label}
          </p>
          {Icon && (
            <Icon
              aria-hidden="true"
              className={cn("size-4 shrink-0", TONE_LABEL[resolved])}
            />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <div
            className={cn(
              "font-data text-stat font-medium tabular-nums",
              TONE_VALUE[resolved],
            )}
          >
            {typeof value === "number" ? value.toLocaleString("en-AE") : value}
          </div>

          <p className={cn("min-h-4 text-micro text-pretty", TONE_HINT[resolved])}>{hint ?? ""}</p>
        </div>
      </ConsoleCardBody>
    </ConsoleCard>
  );
}
