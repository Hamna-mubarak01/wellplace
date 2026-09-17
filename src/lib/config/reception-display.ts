export const TIMELINE_ZOOMS = ["fit", "wide", "quarter", "five", "minute"] as const;
export type TimelineZoom = (typeof TIMELINE_ZOOMS)[number];
export const TIMELINE_SCALE: Record<TimelineZoom, { label: string; stepMinutes: number; hourRem: number }> = {
  fit: { label: "Full day", stepMinutes: 120, hourRem: 3 },
  wide: { label: "30 min", stepMinutes: 30, hourRem: 11 },
  quarter: { label: "15 min", stepMinutes: 15, hourRem: 24 },
  five: { label: "5 min", stepMinutes: 5, hourRem: 48 },
  minute: { label: "1 min", stepMinutes: 1, hourRem: 240 },
};

export const RECEPTION_SPAN = { minimum: 1, maximum: 24 * 60, subtract: 1, add: 10, minutePresets: [15, 30], closeMinutes: 60 } as const;
export const TIMELINE_SPAN_PRESETS = [15, 30, 60, 24 * 60] as const;

export function visitSpanOptions(durationsHours: readonly number[]): readonly number[] {
  return [...new Set(durationsHours)]
    .map((hours) => hours * 60)
    .filter((minutes) => minutes >= RECEPTION_SPAN.minimum && minutes <= RECEPTION_SPAN.maximum)
    .filter((minutes) => !TIMELINE_SPAN_PRESETS.some((preset) => preset === minutes))
    .toSorted((a, b) => a - b);
}
export type TimelineSpan = "opening" | number;
export function changeTimelineSpan(minutes: number, direction: "less" | "more"): number {
  return Math.max(RECEPTION_SPAN.minimum, Math.min(RECEPTION_SPAN.maximum, minutes + (direction === "less" ? -RECEPTION_SPAN.subtract : RECEPTION_SPAN.add)));
}
export function timelineSpanLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60), remainder = minutes % 60;
  return [hours ? `${hours} h` : "", remainder ? `${remainder} min` : ""].filter(Boolean).join(" ");
}
export function timelineMarkStep(minutes: number): number {
  return [1, 5, 10, 15, 30, 60, 120, 240].find((step) => minutes / step <= 8) ?? 240;
}
export const SCHEDULE_PRESENTATION = { maxRangeDays: 31, weekPreviewCount: 1, monthPreviewCount: 1 } as const;

export const SCHEDULE_READ_PAGE_SIZE = 200;
