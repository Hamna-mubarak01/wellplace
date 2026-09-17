import { describe, expect, it } from "vitest";
import { snapshotFromRows, EMPTY_SNAPSHOT } from "@/lib/config";
import { settingDisabledReason } from "@/lib/config/setting-dependencies";
import { buildSettingGroups, matchesSettingSearch } from "@/components/console/manage/settings-model";
import type { SettingRecord } from "@/lib/db/queries/settings";

const row = (key: string, value: boolean | number): SettingRecord => ({ key, value, valueType: typeof value === "boolean" ? "boolean" : "integer", sourceTag: "[CLIENT]", description: "", updatedAt: "2026-09-08T00:00:00Z", isConfigured: true });
describe("dependent settings", () => {
  it("disables only the matching limit and keeps its saved values", () => {
    const groups = buildSettingGroups([row("security.waitlist_rate_limit_enabled", false), row("security.waitlist_rate_limit_per_hour", 17)]);
    const rows = groups.flatMap((group) => group.settings);
    const count = rows.find((setting) => setting.key === "security.waitlist_rate_limit_per_hour");
    expect(count?.storedValue).toBe(17);
    expect(count?.disabledReason).toContain("Turn on “Limit repeated waitlist submissions”");
    expect(rows.find((setting) => setting.key === "security.contact_rate_limit_per_hour")?.disabledReason).toBeNull();
    expect(rows.filter((setting) => matchesSettingSearch(setting, "17")).length).toBe(0);
    expect(rows.filter((setting) => matchesSettingSearch(setting, "Count waitlist"))[0]?.disabledReason).toBeTruthy();
  });
  it("uses enabled defaults and restores editing when reenabled", () => {
    expect(settingDisabledReason("security.availability_rate_limit_per_hour", EMPTY_SNAPSHOT)).toBeNull();
    expect(settingDisabledReason("security.availability_rate_limit_per_hour", snapshotFromRows([{ key: "security.availability_rate_limit_enabled", value: true }]))).toBeNull();
  });
  it("locks optional messages and Tabby details but keeps the fully booked label and VAT usable", () => {
    const snapshot = snapshotFromRows([{ key: "urgency.enabled", value: false }, { key: "fees.tabby.enabled", value: false }, { key: "tax.inclusive", value: false }]);
    expect(settingDisabledReason("urgency.text_few", snapshot)).toBeTruthy();
    expect(settingDisabledReason("fees.tabby.percent", snapshot)).toBeTruthy();
    expect(settingDisabledReason("fees.tabby.label", snapshot)).toBeTruthy();
    expect(settingDisabledReason("urgency.text_none", snapshot)).toBeNull();
    expect(settingDisabledReason("tax.vat_percent", snapshot)).toBeNull();
  });
});
