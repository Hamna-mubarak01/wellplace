import { snapshotFromRows } from "@/lib/config";
import { settingDisabledReason } from "@/lib/config/setting-dependencies";
import { isManagerSetting, isOptionalSetting } from "@/lib/config/settings-presentation";
import { OVERSTAY_KEYS, overstaySummary } from "@/lib/config/overstay";
import { z } from "zod";

import { SETTINGS, SETTING_KEYS } from "@/lib/config/registry";
import { settingHelp } from "@/lib/config/setting-help";
import { WEEKDAY_KEYS, type WeekdayKey } from "@/lib/config/registry";
import type { SettingRecord } from "@/lib/db/queries/settings";

export type SettingControl =
  | { readonly kind: "overstay"; readonly intervalMinutes: number }
  | { readonly kind: "boolean" }
  | { readonly kind: "number"; readonly integer: boolean }
  | { readonly kind: "text"; readonly multiline: boolean }
  | { readonly kind: "time" }
  | { readonly kind: "enum"; readonly options: readonly string[] }
  | { readonly kind: "number-list" }
  | { readonly kind: "weekly-hours" }
  | { readonly kind: "seasonal-hours" }
  | { readonly kind: "opening-exceptions" }
  | { readonly kind: "closures" }
  | { readonly kind: "json" };

export type SettingState = "configured" | "default" | "unset";

export interface SettingView {
  readonly key: string;
  readonly description: string;
  readonly help: string | null;
  readonly groupLabel: string;
  readonly source: string;
  readonly valueType: string;
  readonly control: SettingControl;
  readonly storedValue: unknown;
  readonly fallbackValue: unknown;
  readonly state: SettingState;
  readonly updatedAt: string | null;
  readonly isSeeded: boolean;
  readonly isInRegistry: boolean;
  readonly disabledReason?: string | null;
}

export interface SettingGroupView {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly settings: readonly SettingView[];
  readonly unsetCount: number;
}

interface GroupSpec {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly prefixes: readonly string[];
}

export const SETTING_GROUPS: readonly GroupSpec[] = [
  { id: "hours", label: "Opening hours", description: "Set your usual week, change hours for special dates or close the venue.", prefixes: ["hours."] },
  { id: "booking", label: "Bookings", description: "Choose visit lengths, guest limits and time for payment, cleaning and longer stays.", prefixes: ["booking.", "hold.", "cleaning.", "overrun.", "allocation."] },
  { id: "reception", label: "Reception", description: "Help the team keep track of arrivals, check-ins, cleaning and payments.", prefixes: ["reception."] },
  { id: "pricing", label: "Prices & fees", description: "Manage VAT, the Tabby fee, tax invoice details and the wording shown with booking prices.", prefixes: ["pricing.", "tax.", "fees.", "invoice."] },
  { id: "urgency", label: "Booking messages", description: "Choose what guests see beside a booking time as suites fill up.", prefixes: ["urgency."] },
  { id: "website", label: "Website", description: "Keep your contact details up to date and manage protection against spam.", prefixes: ["contact.", "security."] },
];

export const LEGACY_SETTING_GROUPS: Readonly<Record<string, string>> = {
  hold: "booking", allocation: "booking", tax: "pricing", contact: "website",
  security: "website", privacy: "website", rules: "booking",
};

const WEEKLY_HOURS_KEYS: readonly string[] = ["hours.regular"];

const MULTILINE_LENGTH = 48;

function enumOptions(schema: z.ZodType): readonly string[] | null {
  if (!(schema instanceof z.ZodEnum)) return null;

  const options: unknown = schema.options;
  if (!Array.isArray(options)) return null;

  const values = options.filter(
    (option): option is string => typeof option === "string",
  );

  return values.length > 0 ? values : null;
}

function inferValueType(value: unknown): string {
  if (value === null || value === undefined) return "string";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "decimal";
  }
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "object") return "object";
  return "string";
}

function isNumberList(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === "number")
  );
}

function controlFor(
  key: string,
  schema: z.ZodType | null,
  valueType: string,
  sample: unknown,
): SettingControl {
  if (key === "booking.same_day_cutoff") return { kind: "time" };
  if (key === "pricing.rounding_fils") return { kind: "number", integer: false };
  if (key.startsWith("urgency.text_") || key.startsWith("pricing.offer_")) return { kind: "text", multiline: true };
  if (key === "hours.seasonal") return { kind: "seasonal-hours" };
  if (key === "hours.exceptions") return { kind: "opening-exceptions" };
  if (key === "hours.closures") return { kind: "closures" };
  if (WEEKLY_HOURS_KEYS.includes(key)) return { kind: "weekly-hours" };

  const options = schema ? enumOptions(schema) : null;
  if (options) return { kind: "enum", options };

  switch (valueType) {
    case "boolean":
      return { kind: "boolean" };
    case "integer":
      return { kind: "number", integer: true };
    case "decimal":
      return { kind: "number", integer: false };
    case "time":
      return { kind: "time" };
    case "array":
      return isNumberList(sample) ? { kind: "number-list" } : { kind: "json" };
    case "object":
      return { kind: "json" };
    default:
      return {
        kind: "text",
        multiline:
          typeof sample === "string" && sample.length > MULTILINE_LENGTH,
      };
  }
}

function stateFor(stored: unknown, fallback: unknown): SettingState {
  if (stored !== null && stored !== undefined) return "configured";
  if (fallback !== null && fallback !== undefined) return "default";
  return "unset";
}

function groupIdFor(key: string): string {
  const match = SETTING_GROUPS.find((group) =>
    group.prefixes.some((prefix) => key.startsWith(prefix)),
  );
  return match?.id ?? "website";
}

function viewFor(
  key: string,
  record: SettingRecord | undefined,
  groupLabel: string,
): SettingView {
  const definition = key in SETTINGS ? SETTINGS[key as keyof typeof SETTINGS] : null;
  const fallbackValue = definition ? (definition.defaultValue ?? null) : null;
  const stored = record?.value ?? null;
  const valueType = record?.valueType ?? inferValueType(fallbackValue);
  const sample = stored ?? fallbackValue;

  return {
    key,
    description: definition?.description ?? record?.description ?? key,
    help: settingHelp(key),
    groupLabel,
    source: record?.sourceTag ?? definition?.source ?? "Not recorded",
    valueType,
    control: controlFor(key, definition?.schema ?? null, valueType, sample),
    storedValue: stored,
    fallbackValue,
    state: stateFor(stored, fallbackValue),
    updatedAt: record?.updatedAt ?? null,
    isSeeded: record !== undefined,
    isInRegistry: definition !== null,
  };
}

export function buildSettingGroups(
  records: readonly SettingRecord[],
): readonly SettingGroupView[] {
  const byKey = new Map(records.map((record) => [record.key, record]));
  const keys = SETTING_KEYS.filter(isManagerSetting);

  const specs = SETTING_GROUPS;
  const labelById = new Map(specs.map((spec) => [spec.id, spec.label]));
  const views = keys.filter((key) => key !== OVERSTAY_KEYS.amount).map((key) =>
    viewFor(key, byKey.get(key), labelById.get(groupIdFor(key)) ?? "Website"),
  );
  const charge = views.find((view) => view.key === OVERSTAY_KEYS.source);
  if (charge) {
    const source = byKey.get(OVERSTAY_KEYS.source);
    const amount = byKey.get(OVERSTAY_KEYS.amount);
    const interval = SETTINGS[OVERSTAY_KEYS.interval].schema.safeParse(byKey.get(OVERSTAY_KEYS.interval)?.value);
    const rateSource = source?.value ?? SETTINGS[OVERSTAY_KEYS.source].defaultValue;
    const amountFils = amount?.value ?? null;
    views[views.indexOf(charge)] = {
      ...charge,
      description: "Overstay charges",
      help: settingHelp(OVERSTAY_KEYS.source),
      control: { kind: "overstay", intervalMinutes: interval.success ? interval.data : SETTINGS[OVERSTAY_KEYS.interval].defaultValue },
      storedValue: { rateSource, amountFils },
      fallbackValue: { rateSource, amountFils },
      state: rateSource === "fixed" && amountFils === null ? "unset" : source?.value != null ? "configured" : "default",
      updatedAt: [source?.updatedAt, amount?.updatedAt].filter((stamp): stamp is string => Boolean(stamp)).sort().at(-1) ?? null,
    };
  }

  const snapshot = snapshotFromRows(records);
  return specs
    .map((spec) => {
      const settings = views.filter((view) => groupIdFor(view.key) === spec.id).map((view) => ({ ...view, disabledReason: settingDisabledReason(view.key, snapshot) }));
      return {
        id: spec.id,
        label: spec.label,
        description: spec.description,
        settings,
        unsetCount: settings.filter((view) => view.state === "unset" && !view.disabledReason && !isOptionalSetting(view.key))
          .length,
      };
    })
    .filter((group) => group.settings.length > 0);
}

export function matchesSettingSearch(view: SettingView, term: string): boolean {
  if (term.length === 0) return true;
  const needle = term.toLowerCase();
  return (
    view.key.toLowerCase().includes(needle) ||
    view.description.toLowerCase().includes(needle) ||
    view.source.toLowerCase().includes(needle) ||
    (view.help?.toLowerCase().includes(needle) ?? false) ||
    view.groupLabel.toLowerCase().includes(needle)
  );
}

export const WEEKDAY_LABEL: Readonly<Record<WeekdayKey, string>> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

export const WEEKDAY_ORDER: readonly WeekdayKey[] = WEEKDAY_KEYS;

export interface OpeningWindowDraft {
  readonly opens: string;
  readonly closes: string;
}

export type WeeklyHoursDraft = Readonly<Record<WeekdayKey, readonly OpeningWindowDraft[]>>;

export const EMPTY_WEEKLY_HOURS: WeeklyHoursDraft = Object.freeze({
  sun: [],
  mon: [],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
});

export function toWeeklyHoursDraft(value: unknown): WeeklyHoursDraft {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return EMPTY_WEEKLY_HOURS;
  }

  const source = value as Record<string, unknown>;
  const draft: Record<WeekdayKey, OpeningWindowDraft[]> = {
    sun: [],
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
  };

  for (const day of WEEKDAY_KEYS) {
    const windows = source[day];
    if (!Array.isArray(windows)) continue;

    for (const entry of windows) {
      if (entry === null || typeof entry !== "object") continue;
      const window = entry as Record<string, unknown>;
      const opens = typeof window.opens === "string" ? window.opens : "";
      const closes = typeof window.closes === "string" ? window.closes : "";
      draft[day].push({ opens, closes });
    }
  }

  return draft;
}

export function formatSettingValue(
  value: unknown,
  control: SettingControl,
): string {
  if (value === null || value === undefined) return "";

  switch (control.kind) {
    case "overstay":
      return overstaySummary(value, control.intervalMinutes);
    case "boolean":
      return value === true ? "On" : "Off";
    case "number-list":
      return Array.isArray(value) ? value.join(", ") : String(value);
    case "weekly-hours":
      return formatWeeklyHours(value);
    case "seasonal-hours": {
      const parsed = SETTINGS["hours.seasonal"].schema.safeParse(value);
      return parsed.success ? parsed.data.periods.map((p) => `${p.from} – ${p.to}`).join(" · ") || "No seasonal hours" : "Saved hours need review";
    }
    case "opening-exceptions": {
      const parsed = SETTINGS["hours.exceptions"].schema.safeParse(value);
      return parsed.success ? parsed.data.map((p) => `${p.date}: ${p.windows.map((w) => `${w.opens}–${w.closes}`).join(", ") || "Closed"}`).join(" · ") || "No one-off hours" : "Saved hours need review";
    }
    case "closures": {
      const parsed = SETTINGS["hours.closures"].schema.safeParse(value);
      return parsed.success ? parsed.data.map((p) => p.from === p.to ? p.from : `${p.from} – ${p.to}`).join(" · ") || "No closures" : "Saved hours need review";
    }
    case "json":
      return JSON.stringify(value);
    default:
      return typeof value === "string" ? value : JSON.stringify(value);
  }
}

function formatWeeklyHours(value: unknown): string {
  const draft = toWeeklyHoursDraft(value);
  const lines = WEEKDAY_KEYS.map((day) => {
    const windows = draft[day];
    const label = WEEKDAY_LABEL[day].slice(0, 3);
    if (windows.length === 0) return `${label} closed`;
    return `${label} ${windows
      .map((window) => `${window.opens}–${window.closes}`)
      .join(", ")}`;
  });

  return lines.join(" · ");
}
