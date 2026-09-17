import { FIXED_SETTING_KEYS } from "@/lib/config/fixed-settings";
import { getSetting } from "@/lib/config";
import { describe, expect, it } from "vitest";
import { SETTINGS_PANELS } from "@/lib/config/settings-panels";
import { SETTINGS, SETTING_KEYS } from "@/lib/config/registry";
import { UNCONNECTED_SETTINGS } from "@/lib/config/settings-presentation";
import { validateSettingsPanel } from "@/lib/validation/settings-panel";

function draft(id: string): { panel: string; values: Record<string, unknown>; expected: Record<string, unknown> } {
  const panel = SETTINGS_PANELS.find((item) => item.id === id);
  if (!panel) throw new Error("Unknown panel");
  return { panel: id, values: Object.fromEntries(panel.keys.map((key) => [key, SETTINGS[key].defaultValue])), expected: Object.fromEntries(panel.keys.map((key) => [key, null])) };
}

describe("[CLIENT] Grouped settings", () => {
  it("keeps working business controls reachable once and omits spam controls", () => {
    const keys = SETTINGS_PANELS.flatMap((panel) => panel.keys);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.some((key) => key.startsWith("security."))).toBe(false);
    expect([...keys].sort()).toEqual(SETTING_KEYS.filter((key) => !key.startsWith("security.") && !UNCONNECTED_SETTINGS.includes(key) && !FIXED_SETTING_KEYS.some((fixed) => fixed === key)).sort());
  });
  it("fixes guest notes and ignores the retired cutoff even with old saved values", () => {
    expect(getSetting({ "booking.personal_request_max_length": 9999 }, "booking.personal_request_max_length")).toBe(500);
    expect(getSetting({ "booking.same_day_cutoff": "10:00" }, "booking.same_day_cutoff")).toBeNull();
  });
  it("checks guest and age ranges together", () => {
    const input = draft("booking");
    expect(validateSettingsPanel(input).ok).toBe(true);
    input.values["booking.guests_min"] = 9;
    expect(validateSettingsPanel(input).ok).toBe(false);
    input.values["booking.guests_min"] = 2;
    input.values["booking.child_min_age"] = 17;
    expect(validateSettingsPanel(input).ok).toBe(false);
  });
  it("rejects empty, repeated, fractional and out-of-bounds visit lengths", () => {
    const input = draft("booking");
    for (const durations of [[], [2, 2], [1.5], [1], [24], [8989898989898989]]) {
      input.values["booking.durations_hours"] = durations;
      expect(validateSettingsPanel(input).ok).toBe(false);
    }
  });
  it("allows removing preset and custom durations while keeping one valid visit length", () => {
    const input = draft("booking");
    for (const durations of [[2, 3, 9], [2, 9], [2]]) {
      input.values["booking.durations_hours"] = durations;
      expect(validateSettingsPanel(input).ok).toBe(true);
    }
  });
  it("requires an amount for custom overstay charges, including a deliberate zero", () => {
    const input = draft("overstay");
    input.values["overrun.rate_source"] = "fixed";
    expect(validateSettingsPanel(input).ok).toBe(false);
    input.values["overrun.fixed_fils_per_increment"] = 0;
    expect(validateSettingsPanel(input).ok).toBe(true);
    input.values["overrun.fixed_fils_per_increment"] = -1;
    expect(validateSettingsPanel(input).ok).toBe(false);
  });
  it("validates all four schedules before any of them saves", () => {
    const input = draft("booking");
    expect(validateSettingsPanel(input).ok).toBe(true);
    input.values["hours.exceptions"] = [{ date: "2026-09-12", windows: [{ opens: "22:00", closes: "22:00" }] }];
    expect(validateSettingsPanel(input).ok).toBe(false);
  });
  it("supports enabling fees and editing their details in one save", () => {
    const input = draft("pricing");
    input.expected = { ...input.values, "fees.tabby.enabled": false };
    input.values["fees.tabby.percent"] = 8;
    expect(validateSettingsPanel(input).ok).toBe(true);
    input.values["fees.tabby.enabled"] = false;
    expect(validateSettingsPanel(input).ok).toBe(false);
  });
  it("accepts cleared contacts but checks the supplied email", () => {
    const input = draft("contact");
    expect(validateSettingsPanel(input).ok).toBe(true);
    input.values["contact.email"] = "not-an-email";
    expect(validateSettingsPanel(input).ok).toBe(false);
    input.values["contact.email"] = "hello@example.test";
    expect(validateSettingsPanel(input).ok).toBe(true);
  });
  it("rejects injected keys and incomplete panels", () => {
    const input = draft("contact");
    input.values["security.contact_rate_limit_enabled"] = false;
    expect(validateSettingsPanel(input).ok).toBe(false);
    const incomplete = draft("contact");
    delete incomplete.expected["contact.email"];
    expect(validateSettingsPanel(incomplete).ok).toBe(false);
  });
});
