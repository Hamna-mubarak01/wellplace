export const SETTING_LIMITS = {
  "booking.start_interval_minutes": { min: 5, max: 120, step: 5 },
  "booking.guests_min": { min: 1, max: 20, step: 1 },
  "booking.guests_max": { min: 1, max: 20, step: 1 },
  "booking.child_min_age": { min: 0, max: 17, step: 1 },
  "booking.child_max_age": { min: 1, max: 17, step: 1 },
  "booking.booker_min_age": { min: 16, max: 99, step: 1 },
  "booking.max_horizon_days": { min: 1, max: 730, step: 1 },
  "booking.personal_request_max_length": { min: 50, max: 5_000, step: 50 },

  "cleaning.buffer_minutes": { min: 0, max: 240, step: 5 },
  "hold.minutes": { min: 1, max: 120, step: 1 },

  "overrun.increment_minutes": { min: 1, max: 60, step: 1 },
  "overrun.fixed_fils_per_increment": { min: 0, max: 1_000_000, step: 1 },

  "urgency.threshold_few": { min: 0, max: 50, step: 1 },
  "urgency.threshold_last": { min: 0, max: 50, step: 1 },

  "reception.arrival_overdue_minutes": { min: 0, max: 720, step: 5 },
  "reception.checkin_overdue_minutes": { min: 0, max: 720, step: 5 },
  "reception.cleaning_confirm_minutes": { min: 0, max: 720, step: 5 },
  "reception.default_extension_minutes": { min: 5, max: 720, step: 5 },
  "reception.hold_expiry_warning_minutes": { min: 1, max: 120, step: 1 },

  "fees.tabby.percent": { min: 0, max: 100, step: 0.1 },
  "tax.vat_percent": { min: 0, max: 100, step: 0.1 },
  "pricing.rounding_fils": { min: 1, max: 10_000, step: 1 },

  "privacy.retention_months": { min: 1, max: 120, step: 1 },

  "security.waitlist_rate_limit_per_hour": { min: 1, max: 100_000, step: 1 },
  "security.waitlist_rate_limit_window_minutes": { min: 1, max: 1_440, step: 1 },
  "security.contact_rate_limit_per_hour": { min: 1, max: 100_000, step: 1 },
  "security.contact_rate_limit_window_minutes": { min: 1, max: 1_440, step: 1 },
  "security.availability_rate_limit_per_hour": { min: 1, max: 100_000, step: 1 },
  "security.availability_rate_limit_window_minutes": { min: 1, max: 1_440, step: 1 },
} as const;

export type BoundedSettingKey = keyof typeof SETTING_LIMITS;

export function settingLimits(key: string) {
  return (SETTING_LIMITS as Record<string, { min: number; max: number; step: number }>)[key] ?? null;
}

export const SETTING_TEXT_LIMITS: Readonly<Record<string, number>> = {
  "urgency.text_general": 160, "urgency.text_few": 160, "urgency.text_last": 160,
  "urgency.text_none": 160, "urgency.text_filling": 160,
  "fees.tabby.label": 80, "tax.label": 80, "pricing.offer_label": 80,
  "pricing.offer_headline": 1000, "pricing.offer_subline": 1000,
  "contact.whatsapp_e164": 16, "contact.email": 254, "contact.address": 500,
  "invoice.issuer_legal_name": 200, "invoice.issuer_trn": 15, "invoice.issuer_address": 500, "invoice.number_prefix": 12,
};

export function settingInputLimits(key: string) {
  const limits = settingLimits(key);
  if (!limits) return null;
  const divisor = key === "overrun.fixed_fils_per_increment" || key === "pricing.rounding_fils" ? 100 : 1;
  return { min: limits.min / divisor, max: limits.max / divisor, step: limits.step / divisor };
}

export function settingLimitHint(key: string): string | null {
  const limits = settingInputLimits(key);
  if (limits) return `Enter a number from ${limits.min.toLocaleString("en-US")} to ${limits.max.toLocaleString("en-US")}.`;
  const maximum = SETTING_TEXT_LIMITS[key];
  return maximum ? `Use ${maximum} characters or fewer.` : null;
}
