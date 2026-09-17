import { describe, expect, it } from "vitest";
import { SETTING_KEYS } from "@/lib/config/registry";
import { buildSettingGroups, matchesSettingSearch } from "@/components/console/manage/settings-model";
import type { SettingRecord } from "@/lib/db/queries/settings";
import { editableNumber, isManagerSetting, parseSettingText, settingUnit, UNCONNECTED_SETTINGS } from "@/lib/config/settings-presentation";

describe("[CLIENT] Settings for nontechnical managers", () => {
  it("groups all working settings once into six categories and omits inactive controls", () => {
    const groups = buildSettingGroups([]);
    expect(groups.map((group) => group.id)).toEqual(["hours", "booking", "reception", "pricing", "urgency", "website"]);
    const rows = groups.flatMap((group) => group.settings);
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    for (const key of SETTING_KEYS.filter(isManagerSetting)) {
      if (key !== "overrun.fixed_fils_per_increment") expect(rows.some((row) => row.key === key), key).toBe(true);
    }
    for (const key of UNCONNECTED_SETTINGS) expect(rows.some((row) => row.key === key), key).toBe(false);
    for (const row of rows) {
      expect(row.help, row.key).toBeTruthy();
      expect(row.control.kind, row.key).not.toBe("json");
      expect(row.description, row.key).not.toMatch(/fils|threshold|client-supplied|wall clock|increment|JSON/);
    }
  });
  it("treats optional schedules and working defaults as usable, not missing", () => {
    const groups = buildSettingGroups([]);
    expect(groups.find((group) => group.id === "hours")?.unsetCount).toBe(0);
    expect(groups.find((group) => group.id === "booking")?.unsetCount).toBe(0);
    const pricing = groups.find((group) => group.id === "pricing");
    const missing = pricing?.settings.filter((row) => row.state === "unset").map((row) => row.key);
    expect(missing).toEqual(["invoice.issuer_legal_name", "invoice.issuer_trn", "invoice.issuer_address"]);
  });
  it("[CLIENT] reads the tax invoice issuer details as Not set until WellPlace enters them", () => {
    const rows = buildSettingGroups([]).flatMap((group) => group.settings);
    const state = (key: string) => rows.find((row) => row.key === key)?.state;
    expect(state("invoice.issuer_legal_name")).toBe("unset");
    expect(state("invoice.issuer_trn")).toBe("unset");
    expect(state("invoice.issuer_address")).toBe("unset");
    expect(state("invoice.number_prefix")).toBe("default");
    expect(rows.find((row) => row.key === "invoice.issuer_trn")?.groupLabel).toBe("Prices & fees");
    expect(buildSettingGroups([]).find((group) => group.id === "pricing")?.unsetCount).toBe(3);

    const entered = (key: string, value: string): SettingRecord => ({
      key, value, valueType: "string", sourceTag: "test", description: "", updatedAt: "2026-09-11T08:00:00.000Z", isConfigured: true,
    });
    const supplied = buildSettingGroups([
      entered("invoice.issuer_legal_name", "Example Test Trading Co"),
      entered("invoice.issuer_trn", "100000000000003"),
      entered("invoice.issuer_address", "1 Example Street, Test City"),
    ]);
    expect(supplied.find((group) => group.id === "pricing")?.unsetCount).toBe(0);
  });
  it("finds settings by their explanations and excludes the retired cutoff", () => {
    const rows = buildSettingGroups([]).flatMap((group) => group.settings);
    const cutoff = rows.find((row) => row.key === "booking.same_day_cutoff");
    expect(cutoff).toBeUndefined();
    expect(rows.filter((row) => matchesSettingSearch(row, "spam")).length).toBeGreaterThan(0);
  });
  it("shows friendly units and converts AED rounding to stored fils exactly", () => {
    expect(settingUnit("booking.max_horizon_days")).toBe("days");
    expect(settingUnit("booking.guests_max")).toBe("guests");
    expect(settingUnit("reception.arrival_overdue_minutes")).toBe("minutes");
    expect(editableNumber("pricing.rounding_fils", 50)).toBe(0.5);
    expect(parseSettingText("pricing.rounding_fils", "0.50")).toEqual({ ok: true, value: 50 });
    expect(parseSettingText("pricing.rounding_fils", "1.25")).toEqual({ ok: true, value: 125 });
    for (const value of ["0.001", "-1", "0", "", "abc"]) expect(parseSettingText("pricing.rounding_fils", value).ok, value).toBe(false);
  });
  it("[Project owner's direction 2026-09-12] stops offering the offer headline and subline once the website no longer shows them, and keeps the offer label", () => {
    expect(isManagerSetting("pricing.offer_headline")).toBe(false);
    expect(isManagerSetting("pricing.offer_subline")).toBe(false);
    expect(isManagerSetting("pricing.offer_label")).toBe(true);
  });
  it("accepts zero where allowed and refuses invalid whole-number values", () => {
    expect(parseSettingText("cleaning.buffer_minutes", "0")).toEqual({ ok: true, value: 0 });
    expect(parseSettingText("booking.start_interval_minutes", "0").ok).toBe(false);
    expect(parseSettingText("booking.start_interval_minutes", "1.5").ok).toBe(false);
    expect(parseSettingText("booking.start_interval_minutes", "30")).toEqual({ ok: true, value: 30 });
  });
  it("checks contact details and keeps the contracted currency fixed", () => {
    expect(parseSettingText("contact.email", "hello@example.test")).toEqual({ ok: true, value: "hello@example.test" });
    expect(parseSettingText("contact.email", "not an email").ok).toBe(false);
    expect(parseSettingText("pricing.currency", "aed").ok).toBe(false);
    expect(parseSettingText("rules.refund", "{}").ok).toBe(false);
  });
});
