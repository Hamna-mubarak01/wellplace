import { VENUE_ADDRESS_LINES } from "@/lib/config/entity";
import { LAUNCH_WEEK } from "@/lib/config/opening-hours";
import { z } from "zod";
import { SETTING_LIMITS, SETTING_TEXT_LIMITS } from "./setting-limits";

import { timeOfDay, weeklyHoursSchema, seasonalHoursSchema, openingExceptionsSchema, closuresSchema } from "./opening-hours.ts";
export { WEEKDAY_KEYS } from "./opening-hours.ts";
export type { OpeningWindowValue, WeeklyHours, WeekdayKey } from "./opening-hours.ts";

export const VISIT_LENGTH_LIMITS = { min: 2, max: 23 } as const;
export const visitLengthSchema = z.number().int().min(VISIT_LENGTH_LIMITS.min).max(VISIT_LENGTH_LIMITS.max);

export const SETTINGS = {
  "booking.start_interval_minutes": { schema: z.number().int().positive().min(SETTING_LIMITS["booking.start_interval_minutes"].min).max(SETTING_LIMITS["booking.start_interval_minutes"].max), defaultValue: 15, source: "§7.1", description: "Time between booking starts" },
  "booking.durations_hours":        { schema: z.array(visitLengthSchema).nonempty(), defaultValue: [2, 3, 4, 5, 6], source: "[CLIENT] launch pricing minimum; [OUR CHOICE] whole-hour visits must fit within one day", description: "Visit lengths" },
  "booking.guests_min":             { schema: z.number().int().positive().min(SETTING_LIMITS["booking.guests_min"].min).max(SETTING_LIMITS["booking.guests_min"].max), defaultValue: 2, source: "§6.1", description: "Fewest guests per booking" },
  "booking.guests_max":             { schema: z.number().int().positive().min(SETTING_LIMITS["booking.guests_max"].min).max(SETTING_LIMITS["booking.guests_max"].max), defaultValue: 5, source: "[CLIENT] launch pricing specification — supersedes §6.1's two-to-four", description: "Most guests per booking" },
  "booking.child_min_age":          { schema: z.number().int().nonnegative().min(SETTING_LIMITS["booking.child_min_age"].min).max(SETTING_LIMITS["booking.child_min_age"].max), defaultValue: 8, source: "§6.2", description: "Youngest child allowed" },
  "booking.child_max_age":          { schema: z.number().int().nonnegative().min(SETTING_LIMITS["booking.child_max_age"].min).max(SETTING_LIMITS["booking.child_max_age"].max), defaultValue: 15, source: "§6.2", description: "Last age for child pricing" },
  "booking.booker_min_age":         { schema: z.number().int().nonnegative().min(SETTING_LIMITS["booking.booker_min_age"].min).max(SETTING_LIMITS["booking.booker_min_age"].max), defaultValue: 18, source: "§6.2", description: "Minimum age to make a booking" },
  "booking.max_horizon_days":       { schema: z.number().int().positive().min(SETTING_LIMITS["booking.max_horizon_days"].min).max(SETTING_LIMITS["booking.max_horizon_days"].max), defaultValue: 21, source: "§10.2 · [OUR CHOICE] until the client supplies one", description: "How far ahead guests can book" },
  "booking.personal_request_max_length": { schema: z.number().int().positive().min(SETTING_LIMITS["booking.personal_request_max_length"].min).max(SETTING_LIMITS["booking.personal_request_max_length"].max), defaultValue: 500, source: "§6.1 · [OUR CHOICE]", description: "Guest note length" },
  "booking.same_day_cutoff":        { schema: timeOfDay, defaultValue: null, source: "§10.2", description: "Stop taking bookings for today at" },

  "cleaning.buffer_minutes":        { schema: z.number().int().nonnegative().min(SETTING_LIMITS["cleaning.buffer_minutes"].min).max(SETTING_LIMITS["cleaning.buffer_minutes"].max), defaultValue: 20, source: "§7.1", description: "Cleaning time between visits" },
  "hold.minutes":                   { schema: z.number().int().positive().min(SETTING_LIMITS["hold.minutes"].min).max(SETTING_LIMITS["hold.minutes"].max), defaultValue: 10, source: "§7.3", description: "Time allowed to finish payment" },
  "overrun.increment_minutes":      { schema: z.number().int().positive().min(SETTING_LIMITS["overrun.increment_minutes"].min).max(SETTING_LIMITS["overrun.increment_minutes"].max), defaultValue: 5, source: "§7.6", description: "Charge extra time in blocks of" },
  "overrun.rate_source":            { schema: z.enum(["regular_hourly", "offer_hourly", "fixed"]), defaultValue: "regular_hourly" as const, source: "§7.6 · Q-21", description: "Overstay charges" },
  "overrun.fixed_fils_per_increment": { schema: z.number().int().nonnegative().min(SETTING_LIMITS["overrun.fixed_fils_per_increment"].min).max(SETTING_LIMITS["overrun.fixed_fils_per_increment"].max), defaultValue: null, source: "§7.6 · Q-21", description: "Custom overstay amount" },
  "allocation.strategy":            { schema: z.enum(["fixed_priority", "rotation", "lru"]), defaultValue: "fixed_priority" as const, source: "§7.2", description: "How suites are assigned" },

  "urgency.few_enabled": { schema: z.boolean(), defaultValue: true, source: "[CLIENT]", description: "Few slots notice" },
  "urgency.last_enabled": { schema: z.boolean(), defaultValue: true, source: "[CLIENT]", description: "Last availability notice" },
  "urgency.none_enabled": { schema: z.boolean(), defaultValue: true, source: "[CLIENT]", description: "Fully booked notice" },
  "urgency.mode": { schema: z.enum(["live", "general"]), defaultValue: "live", source: "[OUR CHOICE]", description: "Notice display" },
  "urgency.text_general": { schema: z.string().trim().max(160), defaultValue: "Choose your preferred time", source: "[OUR CHOICE]", description: "General message" },
  "urgency.enabled":                { schema: z.boolean(), defaultValue: true, source: "§7.4", description: "Show availability messages" },
  "urgency.threshold_few":          { schema: z.number().int().nonnegative().min(SETTING_LIMITS["urgency.threshold_few"].min).max(SETTING_LIMITS["urgency.threshold_few"].max), defaultValue: 5, source: "§7.4", description: "Show “few left” when this many suites remain" },
  "urgency.threshold_last":         { schema: z.number().int().nonnegative().min(SETTING_LIMITS["urgency.threshold_last"].min).max(SETTING_LIMITS["urgency.threshold_last"].max), defaultValue: 3, source: "§7.4", description: "Show “almost full” when this many suites remain" },
  "urgency.text_few":               { schema: z.string().max(SETTING_TEXT_LIMITS["urgency.text_few"]), defaultValue: "Only a few slots available", source: "§7.4", description: "Message when a few suites are left" },
  "urgency.text_last":              { schema: z.string().max(SETTING_TEXT_LIMITS["urgency.text_last"]), defaultValue: "Last availability for this time", source: "§7.4", description: "Message when a time is almost full" },
  "urgency.text_none":              { schema: z.string().max(SETTING_TEXT_LIMITS["urgency.text_none"]), defaultValue: "Fully booked", source: "§7.4", description: "Message when a time is fully booked" },
  "urgency.text_filling":           { schema: z.string().max(SETTING_TEXT_LIMITS["urgency.text_filling"]), defaultValue: "This time is booking up", source: "§7.4", description: "Message when a time is getting booked" },

  "reception.board_default_view":   { schema: z.enum(["day", "week", "month", "floor", "timeline"]), defaultValue: "day" as const, source: "§9.1 · [OUR CHOICE]", description: "Reception’s starting view" },
  "reception.arrival_overdue_minutes":     { schema: z.number().int().nonnegative().min(SETTING_LIMITS["reception.arrival_overdue_minutes"].min).max(SETTING_LIMITS["reception.arrival_overdue_minutes"].max), defaultValue: 10, source: "§9.3 · [OUR CHOICE]", description: "Warn when a guest has not arrived" },
  "reception.checkin_overdue_minutes":     { schema: z.number().int().nonnegative().min(SETTING_LIMITS["reception.checkin_overdue_minutes"].min).max(SETTING_LIMITS["reception.checkin_overdue_minutes"].max), defaultValue: 15, source: "§9.3 · [OUR CHOICE]", description: "Warn when check-in is taking too long" },
  "reception.cleaning_confirm_minutes":    { schema: z.number().int().nonnegative().min(SETTING_LIMITS["reception.cleaning_confirm_minutes"].min).max(SETTING_LIMITS["reception.cleaning_confirm_minutes"].max), defaultValue: 30, source: "§9.3 · [OUR CHOICE]", description: "Remind Reception to record cleaning" },
  "reception.default_extension_minutes":   { schema: z.number().int().positive().min(SETTING_LIMITS["reception.default_extension_minutes"].min).max(SETTING_LIMITS["reception.default_extension_minutes"].max), defaultValue: 30, source: "§7.6 · [OUR CHOICE]", description: "Suggested extra time for a visit" },
  "reception.hold_expiry_warning_minutes": { schema: z.number().int().positive().min(SETTING_LIMITS["reception.hold_expiry_warning_minutes"].min).max(SETTING_LIMITS["reception.hold_expiry_warning_minutes"].max), defaultValue: 3, source: "§9.3 · [OUR CHOICE]", description: "Warn before a payment reservation expires" },

  "fees.tabby.enabled":             { schema: z.boolean(), defaultValue: true, source: "§8.1", description: "Add a fee for Tabby payments" },
  "fees.tabby.percent":             { schema: z.number().nonnegative().min(SETTING_LIMITS["fees.tabby.percent"].min).max(SETTING_LIMITS["fees.tabby.percent"].max), defaultValue: 6, source: "§8.1", description: "Tabby fee percentage" },
  "fees.tabby.label":               { schema: z.string().max(SETTING_TEXT_LIMITS["fees.tabby.label"]), defaultValue: "Service Fee", source: "§8.1", description: "Name of the Tabby fee" },

  "hours.regular":                  { schema: weeklyHoursSchema, defaultValue: LAUNCH_WEEK, source: "§10.2", description: "Usual weekly hours" },
  "hours.seasonal":                 { schema: seasonalHoursSchema, defaultValue: null, source: "§10.2", description: "Temporary weekly hours" },
  "hours.exceptions":               { schema: openingExceptionsSchema, defaultValue: null, source: "§10.2", description: "Different hours for one day" },
  "hours.closures":                 { schema: closuresSchema, defaultValue: null, source: "§10.2", description: "Days the venue is closed" },

  "rules.cancellation":             { schema: z.record(z.string(), z.unknown()), defaultValue: null, source: "§10.2 · Q-5", description: "Cancellation policy" },
  "rules.reschedule":               { schema: z.record(z.string(), z.unknown()), defaultValue: null, source: "§10.2 · Q-5", description: "Changing a booking" },
  "rules.refund":                   { schema: z.record(z.string(), z.unknown()), defaultValue: null, source: "§10.2 · Q-5", description: "Refund policy" },
  "rules.no_show":                  { schema: z.record(z.string(), z.unknown()), defaultValue: null, source: "§10.2 · Q-5", description: "Guests who do not arrive" },
  "rules.late_arrival":             { schema: z.record(z.string(), z.unknown()), defaultValue: null, source: "§10.2 · Q-5", description: "Guests who arrive late" },

  "security.waitlist_rate_limit_enabled": { schema: z.boolean(), defaultValue: true, source: "[CLIENT] optional spam limits", description: "Limit repeated waitlist submissions" },
  "security.waitlist_rate_limit_per_hour": { schema: z.number().int().positive().min(SETTING_LIMITS["security.waitlist_rate_limit_per_hour"].min).max(SETTING_LIMITS["security.waitlist_rate_limit_per_hour"].max), defaultValue: 5, source: "§13 · [OUR CHOICE]", description: "Waitlist submissions allowed" },
  "security.waitlist_rate_limit_window_minutes": { schema: z.number().int().positive().min(SETTING_LIMITS["security.waitlist_rate_limit_window_minutes"].min).max(SETTING_LIMITS["security.waitlist_rate_limit_window_minutes"].max), defaultValue: 60, source: "§13 · [OUR CHOICE]", description: "Count waitlist submissions over" },
  "security.contact_rate_limit_enabled": { schema: z.boolean(), defaultValue: true, source: "[CLIENT] optional spam limits", description: "Limit repeated contact messages" },
  "security.contact_rate_limit_per_hour": { schema: z.number().int().positive().min(SETTING_LIMITS["security.contact_rate_limit_per_hour"].min).max(SETTING_LIMITS["security.contact_rate_limit_per_hour"].max), defaultValue: 5, source: "§13 · [OUR CHOICE]", description: "Contact messages allowed" },
  "security.contact_rate_limit_window_minutes": { schema: z.number().int().positive().min(SETTING_LIMITS["security.contact_rate_limit_window_minutes"].min).max(SETTING_LIMITS["security.contact_rate_limit_window_minutes"].max), defaultValue: 60, source: "§13 · [OUR CHOICE]", description: "Count contact messages over" },

  "security.availability_rate_limit_enabled": { schema: z.boolean(), defaultValue: true, source: "[CLIENT] optional spam limits", description: "Limit repeated booking searches" },
  "security.availability_rate_limit_per_hour": { schema: z.number().int().positive().min(SETTING_LIMITS["security.availability_rate_limit_per_hour"].min).max(SETTING_LIMITS["security.availability_rate_limit_per_hour"].max), defaultValue: 240, source: "§13 · [OUR CHOICE]", description: "Booking searches allowed" },
  "security.availability_rate_limit_window_minutes": { schema: z.number().int().positive().min(SETTING_LIMITS["security.availability_rate_limit_window_minutes"].min).max(SETTING_LIMITS["security.availability_rate_limit_window_minutes"].max), defaultValue: 60, source: "§13 · [OUR CHOICE]", description: "Count booking searches over" },

  "privacy.retention_months":      { schema: z.number().int().positive().min(SETTING_LIMITS["privacy.retention_months"].min).max(SETTING_LIMITS["privacy.retention_months"].max), defaultValue: 24, source: "CONFIRMED", description: "How long guest details are kept" },
  "privacy.delete_on_withdrawal":  { schema: z.boolean(), defaultValue: true, source: "CONFIRMED", description: "Delete details after consent is withdrawn" },

  "tax.vat_percent":                { schema: z.number().nonnegative().min(SETTING_LIMITS["tax.vat_percent"].min).max(SETTING_LIMITS["tax.vat_percent"].max), defaultValue: 5, source: "[CLIENT] launch pricing specification", description: "VAT percentage" },
  "tax.inclusive":                  { schema: z.boolean(), defaultValue: true, source: "[CLIENT] launch pricing specification", description: "Prices already include VAT" },
  "tax.label":                      { schema: z.string().max(SETTING_TEXT_LIMITS["tax.label"]), defaultValue: "VAT", source: "[CLIENT] launch pricing specification", description: "Name of the tax" },

  "pricing.currency":               { schema: z.literal("AED"), defaultValue: "AED", source: "§6.4", description: "Price currency" },
  "pricing.rounding_fils":          { schema: z.number().int().positive().min(SETTING_LIMITS["pricing.rounding_fils"].min).max(SETTING_LIMITS["pricing.rounding_fils"].max), defaultValue: 50, source: "[CLIENT] launch pricing specification", description: "Round offer prices to the nearest" },
  "pricing.offer_headline":         { schema: z.string().max(SETTING_TEXT_LIMITS["pricing.offer_headline"]), defaultValue: "Special offer — AED 165 per adult, per hour. Minimum booking: 2 guests for 2 hours. Prices include 5% VAT.", source: "[CLIENT] launch pricing specification", description: "Main offer message" },
  "pricing.offer_subline":          { schema: z.string().max(SETTING_TEXT_LIMITS["pricing.offer_subline"]), defaultValue: "Stay longer and save more — additional hours from only AED 140 per adult.", source: "[CLIENT] launch pricing specification", description: "Extra offer message" },
  "pricing.offer_label":            { schema: z.string().max(SETTING_TEXT_LIMITS["pricing.offer_label"]), defaultValue: "Special offer", source: "[CLIENT] launch pricing specification", description: "Label beside an offer price" },

  "contact.whatsapp_e164":          { schema: z.string().max(SETTING_TEXT_LIMITS["contact.whatsapp_e164"]), defaultValue: null, source: "§4.3", description: "WhatsApp number" },
  "contact.address": { schema: z.string().trim().min(1).max(SETTING_TEXT_LIMITS["contact.address"]), defaultValue: VENUE_ADDRESS_LINES.join("\n"), source: "[§CMS functions]", description: "Venue address" },
  "contact.email":                  { schema: z.email().max(SETTING_TEXT_LIMITS["contact.email"]), defaultValue: null, source: "§4.3", description: "Booking help email" },

  "invoice.issuer_legal_name":      { schema: z.string().trim().max(SETTING_TEXT_LIMITS["invoice.issuer_legal_name"]), defaultValue: null, source: "[CLIENT console redesign brief 2026-09-11; Project owner's direction 2026-09-11]", description: "Legal name on tax invoices" },
  "invoice.issuer_trn":             { schema: z.string().trim().regex(/^(\d{15})?$/), defaultValue: null, source: "[CLIENT console redesign brief 2026-09-11; Project owner's direction 2026-09-11]", description: "Tax registration number" },
  "invoice.issuer_address":         { schema: z.string().trim().max(SETTING_TEXT_LIMITS["invoice.issuer_address"]), defaultValue: null, source: "[CLIENT console redesign brief 2026-09-11; Project owner's direction 2026-09-11]", description: "Address on tax invoices" },
  "invoice.number_prefix":          { schema: z.string().trim().regex(/^[A-Za-z0-9]{1,12}$/), defaultValue: "INV", source: "[CLIENT console redesign brief 2026-09-11; Project owner's direction 2026-09-11]", description: "Invoice number prefix" },
} as const satisfies Record<string, SettingDefinition>;

type SettingDefinition = {
  readonly schema: z.ZodType;
  readonly defaultValue: unknown;
  readonly source: string;
  readonly description: string;
};

export type SettingKey = keyof typeof SETTINGS;

export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTINGS)[K]["schema"]>;

export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];

export function isSettingKey(key: string): key is SettingKey {
  return key in SETTINGS;
}
