export const BOOKING_PREVIEW_STATES = ["loading", "error", "closed", "unpublished", "expired", "expiring", "no-addons", "addons-error"] as const;

export function bookingPreviewState(value: string | string[] | undefined, environment = process.env.NODE_ENV) {
  if (environment !== "development") return null;
  const first = Array.isArray(value) ? value[0] : value;
  return BOOKING_PREVIEW_STATES.find((state) => state === first) ?? null;
}
