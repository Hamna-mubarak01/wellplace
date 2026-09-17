import { SETTINGS, type SettingKey } from "@/lib/config/registry";

export type SettingsPanel = {
  id: string;
  title: string;
  section: string;
  help: string;
  keys: readonly SettingKey[];
};

export const SETTINGS_PANELS: readonly SettingsPanel[] = [
  { id: "booking", title: "Booking schedule", section: "Bookings", help: "Set when guests can visit, how long they can stay and who can book.", keys: ["hours.regular", "hours.exceptions", "hours.closures", "hours.seasonal", "booking.durations_hours", "booking.guests_min", "booking.guests_max", "booking.child_min_age", "booking.child_max_age", "booking.booker_min_age", "booking.start_interval_minutes", "cleaning.buffer_minutes", "hold.minutes", "booking.max_horizon_days", "allocation.strategy", "reception.arrival_overdue_minutes"] },
  { id: "overstay", title: "Overstay charges", section: "Bookings", help: "Choose how to charge for time used after a booking ends.", keys: ["overrun.rate_source", "overrun.increment_minutes", "overrun.fixed_fils_per_increment"] },
  { id: "pricing", title: "Price display and fees", section: "Prices", help: "Set the Tabby fee, tax display and offer wording.", keys: ["fees.tabby.enabled", "fees.tabby.percent", "fees.tabby.label", "tax.vat_percent", "tax.inclusive", "tax.label", "pricing.rounding_fils", "pricing.offer_label"] },
  { id: "urgency", title: "Availability notices", section: "Bookings", help: "Choose the wording guests see beside available times.", keys: ["urgency.enabled", "urgency.threshold_few", "urgency.text_few", "urgency.threshold_last", "urgency.text_last", "urgency.few_enabled", "urgency.last_enabled", "urgency.none_enabled", "urgency.mode", "urgency.text_general", "urgency.text_none"] },
  { id: "contact", title: "Contact information", section: "Website", help: "How guests can reach WellPlace.", keys: ["contact.email", "contact.address"] },
  { id: "invoices", title: "Tax invoices", section: "Prices", help: "Enter the business details printed on every tax invoice.", keys: ["invoice.issuer_legal_name", "invoice.issuer_trn", "invoice.issuer_address", "invoice.number_prefix"] },
];

export const SETTINGS_PANEL_LINKS: Readonly<Record<string, string>> = {
  reception: "booking", hours: "booking", visits: "booking", timing: "booking", hold: "booking", allocation: "booking", tax: "pricing", website: "contact",
};

export const SETTINGS_FIELD_LABELS: Partial<Record<SettingKey, string>> = {
  "booking.guests_min": "Minimum guests", "booking.guests_max": "Maximum guests",
  "booking.child_min_age": "Child pricing starts at", "booking.child_max_age": "Child pricing ends at",
  "booking.booker_min_age": "Minimum booking age", "booking.personal_request_max_length": "Guest note limit",
  "booking.start_interval_minutes": "Booking starts every", "cleaning.buffer_minutes": "Cleaning between visits",
  "hold.minutes": "Time to finish payment", "booking.max_horizon_days": "Bookings open ahead",
  "booking.same_day_cutoff": "Last booking time for today", "allocation.strategy": "Suite assignment",
  "reception.arrival_overdue_minutes": "Late arrival reminder", "reception.checkin_overdue_minutes": "Check-in reminder",
  "reception.cleaning_confirm_minutes": "Cleaning reminder", "reception.hold_expiry_warning_minutes": "Payment expiry warning",
  "reception.default_extension_minutes": "Suggested visit extension", "reception.board_default_view": "Starting view",
  "overrun.rate_source": "Charge using", "overrun.increment_minutes": "Charge for each started",
  "overrun.fixed_fils_per_increment": "Amount per guest (AED)",
  "fees.tabby.enabled": "Tabby service fee", "fees.tabby.percent": "Fee", "fees.tabby.label": "Fee name",
  "tax.vat_percent": "VAT", "tax.inclusive": "VAT included in prices", "tax.label": "Tax name",
  "urgency.enabled": "Show availability notices", "urgency.threshold_few": "Show when this many suites remain",
  "urgency.threshold_last": "Show when this many suites remain", "urgency.text_few": "A few spaces left",
  "urgency.text_last": "Almost full", "urgency.text_filling": "Booking up", "urgency.text_none": "Fully booked",
  "contact.email": "Email for booking help",
  "invoice.issuer_legal_name": "Legal name", "invoice.issuer_trn": "Tax registration number (TRN)",
  "invoice.issuer_address": "Business address", "invoice.number_prefix": "Invoice number prefix",
};

export const SETTINGS_NUMBER_CHOICES: Partial<Record<SettingKey, readonly number[]>> = {
  "booking.guests_min": [1, 2, 3, 4, 5], "booking.guests_max": [2, 3, 4, 5, 6],
  "booking.child_min_age": [6, 7, 8, 9, 10], "booking.child_max_age": [12, 13, 14, 15, 16],
  "booking.booker_min_age": [16, 18, 21], "booking.personal_request_max_length": [250, 500, 1000],
  "reception.arrival_overdue_minutes": [5, 10, 15, 20, 30], "reception.checkin_overdue_minutes": [5, 10, 15, 20, 30],
  "reception.cleaning_confirm_minutes": [15, 20, 30, 45, 60], "reception.hold_expiry_warning_minutes": [1, 2, 3, 5],
  "reception.default_extension_minutes": [15, 30, 45, 60], "urgency.threshold_few": [1, 2, 3, 4, 5, 6, 7],
  "urgency.threshold_last": [1, 2, 3, 4, 5], "fees.tabby.percent": [0, 3, 5, 6, 10], "tax.vat_percent": [0, 5, 10, 15],
};

export function settingsFieldLabel(key: SettingKey): string {
  return SETTINGS_FIELD_LABELS[key] ?? SETTINGS[key].description;
}

export const SETTINGS_EDITOR = { cutoffTime: "18:00" } as const;
