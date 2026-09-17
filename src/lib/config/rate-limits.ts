export const RATE_LIMIT_SETTINGS = {
  waitlist: { enabled: "security.waitlist_rate_limit_enabled", count: "security.waitlist_rate_limit_per_hour", window: "security.waitlist_rate_limit_window_minutes" },
  contact: { enabled: "security.contact_rate_limit_enabled", count: "security.contact_rate_limit_per_hour", window: "security.contact_rate_limit_window_minutes" },
  availability: { enabled: "security.availability_rate_limit_enabled", count: "security.availability_rate_limit_per_hour", window: "security.availability_rate_limit_window_minutes" },
} as const;
export type RateLimitScope = keyof typeof RATE_LIMIT_SETTINGS;
