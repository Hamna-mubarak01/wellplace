import { FIXED_SETTING_KEYS } from "@/lib/config/fixed-settings";
import { SETTINGS, isSettingKey, type SettingKey } from "@/lib/config/registry";

export const UNCONNECTED_SETTINGS: readonly SettingKey[] = [
  "rules.cancellation", "rules.reschedule", "rules.refund", "rules.no_show", "rules.late_arrival",
  "privacy.retention_months", "privacy.delete_on_withdrawal",
  "pricing.offer_headline", "pricing.offer_subline",
  // No WhatsApp connection ships with this project, so the number has nowhere
  // to go and is not offered as a Management control.
  "contact.whatsapp_e164",
];

export function isManagerSetting(key: string): key is SettingKey {
  return isSettingKey(key) && !UNCONNECTED_SETTINGS.includes(key) && !FIXED_SETTING_KEYS.some((fixed) => fixed === key);
}

export const SETTING_PRESETS: Partial<Record<SettingKey, readonly number[]>> = {
  "booking.start_interval_minutes": [15, 30, 60],
  "cleaning.buffer_minutes": [15, 20, 30, 45],
  "hold.minutes": [5, 10, 15],
  "booking.max_horizon_days": [7, 14, 21, 30, 60],
  "overrun.increment_minutes": [5, 10, 15, 30],
  "pricing.rounding_fils": [0.5, 1, 5],
};

export const RECEPTION_VIEW_OPTIONS = [
  { value: "day", label: "Day", description: "Bookings for one day." },
  { value: "week", label: "Week", description: "See the week ahead." },
  { value: "month", label: "Month", description: "See the month ahead." },
  { value: "timeline", label: "Suite timeline", description: "Bookings arranged by suite and time." },
] as const;

export function settingOptionLabel(value: string): string {
  const allocationLabels: Record<string, string> = { fixed_priority: "Fixed priority", rotation: "Balanced rotation", lru: "Least recently allocated" };
  if (allocationLabels[value]) return allocationLabels[value];
  return RECEPTION_VIEW_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function settingUnit(key: string): string | null {
  if (key === "pricing.rounding_fils") return "AED";
  if (key.endsWith("_minutes") || key === "hold.minutes") return "minutes";
  if (key.endsWith("_days")) return "days";
  if (key.endsWith("_age")) return "years";
  if (key === "booking.guests_min" || key === "booking.guests_max") return "guests";
  if (key.endsWith("percent")) return "%";
  if (key.endsWith("_max_length")) return "characters";
  if (key.startsWith("urgency.threshold_")) return "suites";
  if (key.endsWith("_per_hour")) return key.includes("availability") ? "searches" : "submissions";
  return null;
}

export function settingSection(key: string): string {
  if (key === "allocation.strategy") return "Suite allocation";
  if (key.startsWith("hours.")) return "Your opening schedule";
  if (key.startsWith("booking.guests_") || key.includes("_age")) return "Guests and ages";
  if (key.startsWith("booking.")) return "Booking times and requests";
  if (key.startsWith("hold.") || key.startsWith("cleaning.")) return "Payment and cleaning time";
  if (key.startsWith("overrun.")) return "Staying longer";
  if (key.startsWith("reception.")) return "Reception reminders and defaults";
  if (key.startsWith("tax.")) return "VAT";
  if (key.startsWith("fees.")) return "Tabby payment fee";
  if (key.startsWith("pricing.offer_")) return "Offer wording";
  if (key.startsWith("pricing.")) return "Price display";
  if (key.startsWith("contact.")) return "How guests reach you";
  if (key.startsWith("invoice.")) return "Tax invoices";
  if (key.startsWith("security.")) return "Spam protection";
  if (key === "urgency.enabled") return "Availability messages";
  if (key.includes("threshold_") || key === "urgency.text_few" || key === "urgency.text_last") return "When availability is low";
  return "Other availability messages";
}

export function emptySettingLabel(key: string): string {
  if (key === "booking.same_day_cutoff") return "Off — accept bookings while times are available";
  if (key === "hours.seasonal") return "Usual hours apply";
  if (key === "hours.exceptions") return "No one-day changes";
  if (key === "hours.closures") return "No closed dates added";
  if (key === "hours.regular") return "Add your opening hours";
  return "Not added yet";
}

export function isOptionalSetting(key: string): boolean {
  return ["booking.same_day_cutoff", "hours.seasonal", "hours.exceptions", "hours.closures"].includes(key);
}

export function editableNumber(key: string, value: number): number {
  return key === "pricing.rounding_fils" ? value / 100 : value;
}

export function parseSettingText(key: string, raw: string): { ok: true; value: unknown } | { ok: false; message: string } {
  if (!isManagerSetting(key)) return { ok: false, message: "This option cannot be changed here." };
  const schema = SETTINGS[key].schema;
  let value: unknown = raw.trim();
  const numeric = typeof SETTINGS[key].defaultValue === "number";
  if (numeric) {
    if (!raw.trim()) return { ok: false, message: "Enter a number." };
    value = Number(raw);
    if (key === "pricing.rounding_fils") {
      if (!/^\d+(?:\.\d{1,2})?$/.test(raw.trim())) return { ok: false, message: "Enter an AED amount with up to two decimal places." };
      value = Math.round(Number(raw) * 100);
    }
  }
  if (key === "pricing.currency") value = raw.trim().toUpperCase();
  if (key === "contact.whatsapp_e164") {
    value = raw.replace(/[\s()-]/g, "");
    if (!/^\+[1-9]\d{6,14}$/.test(String(value))) return { ok: false, message: "Enter the country code and number, starting with +." };
  }
  const checked = schema.safeParse(value);
  if (checked.success) return { ok: true, value: checked.data };
  if (key === "contact.email") return { ok: false, message: "Enter a valid email address, such as hello@example.com." };
  if (key === "pricing.currency") return { ok: false, message: "Enter a three-letter currency code, such as AED." };
  if (numeric) {
    const zeroAllowed = schema.safeParse(0).success;
    const decimalsAllowed = schema.safeParse(1.5).success;
    return { ok: false, message: `Enter ${zeroAllowed ? "zero or a positive" : "a positive"} ${decimalsAllowed ? "number" : "whole number"}.` };
  }
  return { ok: false, message: "Check this value and try again." };
}
