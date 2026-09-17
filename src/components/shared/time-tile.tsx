import { CheckIcon } from "lucide-react";
import { cva } from "class-variance-authority";

import { HoldCountdown } from "@/components/shared/hold-countdown";
import { ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TileState } from "@/lib/domain/availability";
import { cn } from "@/lib/utils";


export interface TimeSlot {
  readonly startsAt: string;
  readonly label: string;
  readonly tile: TileState;
}

const tileVariants = cva(
  "group/tile flex h-auto min-h-tap w-full min-w-0 flex-col items-start justify-center gap-0.5 rounded-(--radius-card) border px-4 py-2.5 text-left whitespace-normal transition-colors duration-150 disabled:pointer-events-none disabled:opacity-100",
  {
    variants: {
      kind: {
        available:
          "cursor-pointer border-border bg-surface-raised hover:border-brand hover:bg-surface-hover data-[state=on]:border-brand data-[state=on]:bg-brand-wash data-[state=on]:ring-1 data-[state=on]:ring-brand",
        secured:
          "cursor-pointer border-brand bg-brand-wash ring-1 ring-brand data-[state=on]:bg-brand-wash",
        unavailable:
          "cursor-not-allowed border-dashed border-border-interactive bg-surface-base",
      },
    },
    defaultVariants: { kind: "available" },
  },
);

export interface TimeTileProps {
  slot: TimeSlot;
  onHoldExpire?: (startsAt: string) => void;
  showAvailability?: boolean;
  className?: string;
}

export function TimeTile({ slot, onHoldExpire, showAvailability = true, className }: TimeTileProps) {
  const { tile, label, startsAt } = slot;
  const isSecured = tile.kind === "secured" && tile.securedUntil !== null;

  return (
    <ToggleGroupItem
      value={startsAt}
      disabled={tile.disabled}
      aria-label={isSecured ? `${label} — held for you` : undefined}
      className={cn(tileVariants({ kind: tile.kind }), className)}
    >
      <span className="flex w-full items-center justify-between gap-3">
        <span
          className={cn(
            "font-data text-tile-time tabular-nums",
            tile.kind === "unavailable"
              ? "font-regular text-text-secondary"
              : "font-medium text-text-primary",
            "group-data-[state=on]/tile:font-bold group-data-[state=on]/tile:text-brand",
            isSecured && "font-bold text-brand",
          )}
        >
          {label}
        </span>

        {tile.kind !== "unavailable" ? (
          <CheckIcon
            aria-hidden
            className={cn(
              "size-4 shrink-0 text-brand transition-opacity duration-150",
              isSecured ? "opacity-100" : "opacity-0 group-data-[state=on]/tile:opacity-100",
            )}
          />
        ) : null}
      </span>

      {isSecured && tile.securedUntil ? (
        <span className="text-fine text-text-secondary">
          Held for you ·{" "}
          <HoldCountdown
            expiresAt={tile.securedUntil}
            onExpire={onHoldExpire ? () => onHoldExpire(startsAt) : undefined}
          />
        </span>
      ) : tile.message && (showAvailability || tile.kind === "unavailable") ? (
        <span className="text-fine text-pretty text-text-secondary">{tile.message}</span>
      ) : null}
    </ToggleGroupItem>
  );
}
