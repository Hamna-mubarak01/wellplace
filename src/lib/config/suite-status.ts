export const SUITE_STATUSES = [
  "available", "checkout_hold", "booked", "checked_in", "cleaning",
  "blocked", "maintenance", "not_ready", "out_of_service",
] as const;

export const NEVER_AUTO_ALLOCATED: readonly (typeof SUITE_STATUSES)[number][] = [
  "blocked", "maintenance", "not_ready", "out_of_service",
];
