import { z } from "zod";
import { settingLimitHint } from "@/lib/config/setting-limits";
import { SETTINGS, type SettingKey } from "@/lib/config/registry";
import { SETTINGS_PANELS, settingsFieldLabel } from "@/lib/config/settings-panels";
import { settingParent } from "@/lib/config/setting-dependencies";
import { overstayValueSchema } from "@/lib/config/overstay";

export const settingsPanelInput = z.object({
  panel: z.string(),
  values: z.record(z.string(), z.json()),
  expected: z.record(z.string(), z.json()),
}).strict();

export function validateSettingsPanel(input: unknown) {
  const parsed = settingsPanelInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "Check your entries and try again." };
  const { panel: id, values, expected } = parsed.data;
  const panel = SETTINGS_PANELS.find((item) => item.id === id);
  if (!panel || [values, expected].some((entries) => Object.keys(entries).length !== panel.keys.length || Object.keys(entries).some((key) => !panel.keys.includes(key as SettingKey)))) {
    return { ok: false as const, message: "These settings cannot be saved here." };
  }
  const effective = (key: SettingKey) => values[key] ?? SETTINGS[key].defaultValue;
  for (const key of panel.keys) {
    if (values[key] !== null) {
      const checked = SETTINGS[key].schema.safeParse(values[key]);
      if (!checked.success) return { ok: false as const, message: `${settingsFieldLabel(key)}: ${key === "contact.email" ? "enter a valid email address, such as hello@example.com." : key.startsWith("hours.") ? checked.error.issues[0].message : settingLimitHint(key) ?? "check this value."}` };
      values[key] = z.json().parse(checked.data);
    }
    const parent = settingParent(key);
    if (parent && effective(parent) === false && JSON.stringify(values[key]) !== JSON.stringify(expected[key])) {
      return { ok: false as const, message: `Turn on ${settingsFieldLabel(parent).toLowerCase()} before changing its details.` };
    }
  }
  if (id === "booking") {
    if (Number(effective("booking.guests_min")) > Number(effective("booking.guests_max"))) return { ok: false as const, message: "Maximum guests must be at least the minimum." };
    if (Number(effective("booking.child_min_age")) > Number(effective("booking.child_max_age"))) return { ok: false as const, message: "The last child age must be at least the first child age." };
    const durations = effective("booking.durations_hours");
    if (Array.isArray(durations) && new Set(durations).size !== durations.length) return { ok: false as const, message: "Each visit length only needs to be selected once." };
  }
  if (id === "overstay") {
    const charge = overstayValueSchema.safeParse({ rateSource: effective("overrun.rate_source"), amountFils: values["overrun.fixed_fils_per_increment"] });
    if (!charge.success || (charge.data.rateSource === "fixed" && charge.data.amountFils === null)) return { ok: false as const, message: "Enter a valid amount per guest for custom charges." };
  }
  return { ok: true as const, panel, values, expected };
}
