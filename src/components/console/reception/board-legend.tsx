import {
  BOARD_STATES,
  BOARD_STATE_LABEL,
  BOARD_STATE_TONE,
  type BoardTone,
} from "@/components/console/reception/board-types";

const SWATCH: Readonly<Record<BoardTone, string>> = {
  brand: "border-brand bg-brand-wash",
  success: "border-success-border bg-success-wash",
  warning: "border-warning-border bg-warning-wash",
  danger: "border-danger-border bg-danger-wash",
  info: "border-info-border bg-info-wash",
  muted: "border-border-strong bg-surface-sunken",
};

export function BoardLegend() {
  return (
    <ul aria-label="Schedule status key" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
      {BOARD_STATES.map((state) => (
        <li key={state} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`size-3 shrink-0 rounded-xs border ${SWATCH[BOARD_STATE_TONE[state]]}`}
          />
          <span className="text-micro text-text-secondary">
            {BOARD_STATE_LABEL[state]}
          </span>
        </li>
      ))}
      <li className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-3 shrink-0 rounded-xs border border-border-strong bg-surface-active reception-cleaning-buffer"
        />
        <span className="text-micro text-text-secondary">Cleaning buffer</span>
      </li>
      <li className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-3 shrink-0 rounded-xs border border-danger-border reception-cleaning-overdue"
        />
        <span className="text-micro text-text-secondary">Not released</span>
      </li>
    </ul>
  );
}
