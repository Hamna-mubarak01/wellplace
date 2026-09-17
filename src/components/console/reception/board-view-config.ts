export const BOARD_VIEWS = ["day", "week", "month", "timeline"] as const;
export type BoardView = (typeof BOARD_VIEWS)[number];
export const BOARD_VIEW_LABEL: Readonly<Record<BoardView, string>> = {
  day: "Day", week: "Week", month: "Month", timeline: "Day",
};
export function isBoardView(value: unknown): value is BoardView {
  return typeof value === "string" && (BOARD_VIEWS as readonly string[]).includes(value);
}

export function resolveBoardView(value: unknown, fallback: BoardView = "day"): BoardView {
  if (value === "floor") return "day";
  if (value === "range") return "month";
  return isBoardView(value) ? value : fallback;
}
