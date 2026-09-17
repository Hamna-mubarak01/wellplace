import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { SummaryTile, type SummaryTileTone } from "@/components/console/summary-tile";
import { cn } from "@/lib/utils";

export type StatCardTone = "neutral" | "success" | "warning" | "danger" | "info";

const TILE_TONE: Readonly<Record<StatCardTone, SummaryTileTone>> = {
  neutral: "default",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
};

export interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: StatCardTone;
  Icon?: LucideIcon;
  href?: string;
  selected?: boolean;
}

export function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
  Icon,
  href,
  selected = false,
}: StatCardProps) {
  const tile = (
    <SummaryTile
      label={label}
      value={value}
      hint={sub}
      tone={TILE_TONE[tone]}
      Icon={Icon}
      className={cn(
        href && "transition-colors duration-150 group-hover/stat:border-border-hover motion-reduce:transition-none",
        selected && "border-brand group-hover/stat:border-brand",
      )}
    />
  );

  if (!href) return tile;

  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      className="group/stat block h-full rounded-(--radius-card) outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
    >
      {tile}
    </Link>
  );
}
