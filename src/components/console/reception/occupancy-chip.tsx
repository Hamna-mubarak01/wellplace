import { BookingGuestName } from "./booking-guest-name";
import { cn } from "@/lib/utils";
import { formatDubaiTime } from "@/lib/domain/time";
import {
  BOARD_STATE_LABEL,
  BOARD_STATE_TONE,
  type BoardEntry,
  type BoardTone,
} from "@/components/console/reception/board-types";

const TONE_CLASS: Readonly<Record<BoardTone, string>> = {
  brand: "border-brand bg-brand-wash text-text-primary",
  success: "border-success-border bg-success-wash text-success-ink",
  warning: "border-warning-border bg-warning-wash text-warning-ink",
  danger: "border-danger-border bg-danger-wash text-danger-ink",
  info: "border-info-border bg-info-wash text-info-ink",
  muted: "border-border-strong bg-surface-sunken text-text-secondary",
};

export function toneClassFor(entry: BoardEntry): string {
  return TONE_CLASS[BOARD_STATE_TONE[entry.state]];
}

export interface OccupancyChipProps {
  entry: BoardEntry;
  compact?: boolean;
  contentOffset?: number;
  className?: string;
}

export function OccupancyChip({
  entry,
  compact = false,
  contentOffset = 0,
  className,
}: OccupancyChipProps) {
  const label = BOARD_STATE_LABEL[entry.state];
  const who = entry.guestName ?? entry.reason ?? label;

  return (
    <span
      style={contentOffset > 0 ? { paddingLeft: `calc(0.5rem + ${contentOffset}px)` } : undefined}
      className={cn(
        "flex h-full min-w-0 flex-col justify-center overflow-hidden rounded-(--radius-control) border border-l-4 px-2 py-1 text-left",
        TONE_CLASS[BOARD_STATE_TONE[entry.state]],
        entry.state === "hold" && "border-dashed",
        className,
      )}
    >
      <span className="min-w-0 truncate text-console-table font-semibold">
        {entry.guestName?.trim() ? <BookingGuestName name={entry.guestName} /> : who}
      </span>
      {!compact && (
        <span className="truncate font-data text-micro tabular-nums opacity-80">
          {formatDubaiTime(entry.experienceStart)}–
          {formatDubaiTime(entry.experienceEnd)}
          {entry.adults !== undefined && ` · ${entry.adults + (entry.children ?? 0)} guests`}
        </span>
      )}
      {!compact && <span className="reception-booking-contact truncate text-micro">{entry.guestPhone || entry.guestEmail || (entry.state === "hold" ? "Awaiting payment" : BOARD_STATE_LABEL[entry.state])}</span>}
    </span>
  );
}

export function chipDescription(entry: BoardEntry): string {
  const parts = [
    BOARD_STATE_LABEL[entry.state],
    entry.guestName,
    `${formatDubaiTime(entry.experienceStart)} to ${formatDubaiTime(entry.experienceEnd)}`,
    entry.reason,
  ].filter((part): part is string => Boolean(part));

  return parts.join(", ");
}
