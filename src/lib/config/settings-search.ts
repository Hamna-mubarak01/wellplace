import { SETTINGS, type SettingKey } from "@/lib/config/registry";
import { settingsFieldLabel, type SettingsPanel } from "@/lib/config/settings-panels";

const KEYWORDS: Partial<Record<SettingKey, string>> = {
  "booking.child_min_age": "children ages youngest minimum",
  "booking.child_max_age": "children ages oldest maximum",
  "booking.booker_min_age": "adult adults ages age restriction",
  "booking.durations_hours": "duration durations hours stay length",
  "booking.guests_min": "people party size minimum",
  "booking.guests_max": "people party size maximum",
  "booking.max_horizon_days": "advance days future booking window",
  "hours.regular": "schedule days weekday weekend opening closing time",
  "hours.seasonal": "custom schedule date range holiday seasonal opening closing time",
  "hours.exceptions": "custom schedule single date opening closing time",
  "hours.closures": "schedule closed day off holiday",
  "allocation.strategy": "allocation priority rotation suite assignment",
  "cleaning.buffer_minutes": "buffer cleaning minutes",
  "hold.minutes": "checkout reservation hold payment timer countdown",
  "reception.arrival_overdue_minutes": "late arrival warning reminder",
  "contact.whatsapp_e164": "phone telephone mobile whatsapp contact number",
  "contact.email": "email address contact support",
  "invoice.issuer_legal_name": "invoice issuer company business licence",
  "invoice.issuer_trn": "invoice trn registration",
  "invoice.issuer_address": "invoice issuer location",
  "invoice.number_prefix": "invoice numbering",
};

function words(text: string): string[] {
  return text.toLocaleLowerCase("en").match(/[\p{L}\p{N}]+/gu) ?? [];
}

function matches(search: string, text: string): boolean {
  const terms = words(text);
  return words(search).every((query) => terms.some((term) => term.startsWith(query)));
}

export function settingsFieldMatches(key: SettingKey, search: string): boolean {
  return matches(search, `${settingsFieldLabel(key)} ${SETTINGS[key].description} ${KEYWORDS[key] ?? ""}`);
}

export function settingsPanelMatches(panel: SettingsPanel, search: string): boolean {
  return matches(search, panel.title) || panel.keys.some((key) => settingsFieldMatches(key, search));
}
