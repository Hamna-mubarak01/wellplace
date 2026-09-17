import { CHECKOUT_FLOW } from "@/lib/config/checkout-flow";
import { z } from "zod";
import { safeImageSrc } from "@/lib/config/cms/links";

export const CATALOGUE = {
  maxInteger: 2_147_483_647,
  maxText: 4000,
  maxName: 120,
  maxQuantity: CHECKOUT_FLOW.maxQuantity,
  maxEligibleHours: 24,
  maxEligibleGuests: 64,
  weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  kinds: ["rental", "consumable", "per_person", "per_booking"],
} as const;
const integer = z.number().int().min(0).max(CATALOGUE.maxInteger);
const money = integer;
const date = z.iso.date().nullable();
const text = z.string().trim().max(CATALOGUE.maxText).nullable();

export const priceEditorSchema = z.object({
  id: z.uuid().nullable(), code: z.string().max(CATALOGUE.maxName).nullable(),
  guest_kind: z.enum(["adult", "child"]), from_hour: integer.min(1), to_hour: integer.min(1).nullable(),
  regular_fils_per_hour: money, offer_fils_per_hour: money.nullable(), offer_percent: z.number().min(0).max(100).nullable(),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).nullable(),
  season_from: date, season_to: date, start_from_minutes: integer.max(1439).nullable(), start_to_minutes: integer.max(1440).nullable(),
  priority: integer, is_active: z.boolean(),
}).strict().superRefine((v, ctx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (v.to_hour !== null && v.to_hour < v.from_hour) issue("to_hour", "The last hour must follow the first hour.");
  if ((v.offer_fils_per_hour === null) === (v.offer_percent === null)) issue("offer_fils_per_hour", "Choose an offer amount or a percentage discount.");
  if (v.offer_fils_per_hour !== null && v.offer_fils_per_hour > v.regular_fils_per_hour) issue("offer_fils_per_hour", "The offer must not exceed the regular price.");
  if (v.season_from && v.season_to && v.season_from > v.season_to) issue("season_to", "The end date must follow the start date.");
  if ((v.start_from_minutes === null) !== (v.start_to_minutes === null) || (v.start_from_minutes !== null && v.start_to_minutes !== null && v.start_from_minutes >= v.start_to_minutes)) issue("start_to_minutes", "Choose a start-time range whose end follows its start.");
});
export const addonEditorSchema = z.object({
  id: z.uuid().nullable(), name: z.string().trim().min(1, "Enter an add-on name.").max(CATALOGUE.maxName), description: text,
  image_path: z.string().max(CATALOGUE.maxText).refine((v) => safeImageSrc(v, "") !== "", "Choose an uploaded image.").nullable(),
  kind: z.enum(CATALOGUE.kinds), regular_price_fils: money, offer_price_fils: money, saving_label: text,
  default_quantity: integer.min(1), min_quantity: integer.min(1), max_quantity: integer.min(1), is_locked: z.boolean(),
  inventory: integer.nullable(), available_from: date, available_to: date, reception_note: text,
  is_taxable: z.boolean(), is_active: z.boolean(), sort_order: integer,
  eligible_min_guests: integer.min(1).max(CATALOGUE.maxEligibleGuests).nullable().default(null),
  eligible_max_guests: integer.min(1).max(CATALOGUE.maxEligibleGuests).nullable().default(null),
  eligible_min_hours: integer.min(1).max(CATALOGUE.maxEligibleHours).nullable().default(null),
  eligible_max_hours: integer.min(1).max(CATALOGUE.maxEligibleHours).nullable().default(null),
}).strict().superRefine((v, ctx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (v.regular_price_fils < v.offer_price_fils) issue("offer_price_fils", "The offer must not exceed the regular price.");
  if (v.min_quantity > v.default_quantity || v.default_quantity > v.max_quantity) issue("default_quantity", "The default quantity must be between the minimum and maximum.");
  if (v.max_quantity > CATALOGUE.maxQuantity) issue("max_quantity", `Use a maximum quantity of ${CATALOGUE.maxQuantity} or fewer.`);
  if (v.inventory !== null && v.inventory > 0 && v.inventory < v.min_quantity) issue("inventory", "Available quantity must cover the minimum quantity, or use 0 for sold out.");
  for (const [min, max] of [["eligible_min_guests", "eligible_max_guests"], ["eligible_min_hours", "eligible_max_hours"]] as const) {
    if (v[min] !== null && v[max] !== null && v[min] > v[max]) issue(max, "The maximum must be at least the minimum.");
  }
  if (v.available_from && v.available_to && v.available_from > v.available_to) issue("available_to", "The end date must follow the start date.");
});
export type EditablePrice = z.infer<typeof priceEditorSchema>;
export type EditableAddon = z.infer<typeof addonEditorSchema>;
export const NEW_PRICE: EditablePrice = { id: null, code: null, guest_kind: "adult", from_hour: 1, to_hour: null,
  regular_fils_per_hour: 0, offer_fils_per_hour: 0, offer_percent: null, weekdays: null, season_from: null, season_to: null,
  start_from_minutes: null, start_to_minutes: null, priority: 0, is_active: false };
export const NEW_ADDON: EditableAddon = { id: null, name: "", description: null, image_path: null, kind: "rental",
  regular_price_fils: 0, offer_price_fils: 0, saving_label: null, default_quantity: 1, min_quantity: 1, max_quantity: 1,
  is_locked: false, inventory: null, available_from: null, available_to: null, reception_note: null,
  is_taxable: true, is_active: false, sort_order: 100,
  eligible_min_guests: null, eligible_max_guests: null, eligible_min_hours: null, eligible_max_hours: null };
export function priceTitle(price: EditablePrice): string {
  return `${price.guest_kind === "adult" ? "Adult" : "Child"} · ${price.to_hour === null ? `hour ${price.from_hour} onwards` : price.to_hour === price.from_hour ? `hour ${price.from_hour}` : `hours ${price.from_hour}–${price.to_hour}`}`;
}

export function catalogueNumberLimits(key: string, amount = false) {
  const min = ["from_hour", "to_hour", "min_quantity", "default_quantity", "max_quantity", "eligible_min_guests", "eligible_max_guests", "eligible_min_hours", "eligible_max_hours"].includes(key) ? 1 : 0;
  const max = key === "offer_percent" ? 100 : key.includes("quantity") ? CATALOGUE.maxQuantity : key.endsWith("guests") ? CATALOGUE.maxEligibleGuests : key.endsWith("hours") ? CATALOGUE.maxEligibleHours : CATALOGUE.maxInteger;
  return { min, max: max / (amount ? 100 : 1), step: amount ? 0.01 : key === "offer_percent" ? "any" : 1 };
}

export const CATALOGUE_FIELD_LABELS: Readonly<Record<string, string>> = {
  inventory: "Available quantity", image_path: "Photo", eligible_min_guests: "Minimum eligible guests", eligible_max_guests: "Maximum eligible guests", eligible_min_hours: "Minimum eligible hours", eligible_max_hours: "Maximum eligible hours",
  name: "Name", description: "Description", from_hour: "From booked hour", to_hour: "Through booked hour",
  regular_fils_per_hour: "Regular hourly price", offer_fils_per_hour: "Offer hourly price", offer_percent: "Discount",
  regular_price_fils: "Regular price", offer_price_fils: "Offer price", default_quantity: "Default quantity",
  min_quantity: "Minimum quantity", max_quantity: "Maximum quantity", priority: "Priority", sort_order: "Display order",
  saving_label: "Saving label", reception_note: "Preparation or return instructions", guest_kind: "Guest type", kind: "Item type",
  season_from: "From date", season_to: "Through date", available_from: "From date", available_to: "Through date", weekdays: "Days",
};
export function catalogueInputError(issue: { code: string; path: PropertyKey[]; message: string }) {
  if (issue.code === "custom") return issue.message;
  const key = String(issue.path[0] ?? "");
  const label = CATALOGUE_FIELD_LABELS[key] ?? "This entry";
  if (["from_hour", "to_hour", "regular_fils_per_hour", "offer_fils_per_hour", "offer_percent", "regular_price_fils", "offer_price_fils", "default_quantity", "min_quantity", "max_quantity", "priority", "sort_order", "inventory", "eligible_min_guests", "eligible_max_guests", "eligible_min_hours", "eligible_max_hours"].includes(key)) {
    const amount = key.includes("fils");
    const limits = catalogueNumberLimits(key, amount);
    return `${label}: enter ${amount ? "an amount" : key === "offer_percent" ? "a percentage" : "a whole number"} from ${limits.min.toLocaleString("en")} to ${limits.max.toLocaleString("en", { maximumFractionDigits: 2 })}${amount ? " AED" : ""}.`;
  }
  if (["name", "description", "saving_label", "reception_note"].includes(key)) return `${label}: ${key === "name" ? "enter a name using" : "use"} ${key === "name" ? CATALOGUE.maxName : CATALOGUE.maxText} characters or fewer.`;
  if (key === "weekdays") return "Choose at least one day for this rate.";
  return `${label}: choose a valid value before saving.`;
}
