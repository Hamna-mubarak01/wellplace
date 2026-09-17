import { describe, expect, it } from "vitest";

import { isManagerSetting } from "@/lib/config/settings-presentation";
import { SETTING_KEYS, SETTINGS } from "@/lib/config/registry";
import type { SettingRecord } from "@/lib/db/queries/settings";
import {
  EMPTY_WEEKLY_HOURS,
  SETTING_GROUPS,
  buildSettingGroups,
  formatSettingValue,
  matchesSettingSearch,
  toWeeklyHoursDraft,
  type SettingView,
} from "@/components/console/manage/settings-model";

function record(over: Partial<SettingRecord> & { key: string }): SettingRecord {
  return {
    value: null,
    valueType: "string",
    sourceTag: "§10.2",
    description: "A configurable value",
    updatedAt: "2026-09-07T12:00:00.000Z",
    isConfigured: true,
    ...over,
  } as SettingRecord;
}

function viewOf(
  records: readonly SettingRecord[],
  key: string,
): SettingView | undefined {
  return buildSettingGroups(records)
    .flatMap((group) => group.settings)
    .find((setting) => setting.key === key);
}

function groupOf(records: readonly SettingRecord[], key: string): string | undefined {
  return buildSettingGroups(records).find((group) =>
    group.settings.some((setting) => setting.key === key),
  )?.id;
}

describe("§10.2 — every configurable value reaches a Management screen, none is hidden", () => {
  it("does not restore the retired cleaning switch from an older database row [CLIENT]", () => {
    const key = "cleaning.confirm_gates_availability";
    expect(viewOf([record({ key, value: true, valueType: "boolean" })], key)).toBeUndefined();
  });
  it("does not restore minimum notice from an older database row [CLIENT]", () => {
    const key = "booking.min_notice_minutes";
    expect(viewOf([record({ key, value: 90, valueType: "integer" })], key)).toBeUndefined();
    expect(viewOf([], key)).toBeUndefined();
  });
  it("shows every registry key even when the database holds no row for it", () => {
    const shown = buildSettingGroups([]).flatMap((group) =>
      group.settings.map((setting) => setting.key),
    );

    for (const key of SETTING_KEYS) {
      if (!isManagerSetting(key) || key === "overrun.fixed_fils_per_increment") continue;
      expect(shown, key).toContain(key);
    }
  });

  it("combines the two price settings into one AED overstay row", () => {
    const rows = [record({ key: "overrun.rate_source", value: "fixed" }), record({ key: "overrun.fixed_fils_per_increment", value: 1250 })];
    const charge = viewOf(rows, "overrun.rate_source")!;
    expect(charge.description).toBe("Overstay charges");
    expect(charge.control.kind).toBe("overstay");
    expect(formatSettingValue(charge.storedValue, charge.control)).toBe("AED 12.50 per guest / each started 5 minutes");
    expect(viewOf(rows, "overrun.fixed_fils_per_increment")).toBeUndefined();
    expect(viewOf([], "overrun.rate_source")?.state).toBe("default");
  });

  it("does not expose an unknown setting without a supported editor", () => {
    const view = viewOf([record({ key: "some.future_key", value: 7 as never })], "some.future_key");

    expect(view).toBeUndefined();
  });

  it("files every registry key under a named group or the explicit Other group", () => {
    const groups = buildSettingGroups([]);
    const known = new Set([...SETTING_GROUPS.map((group) => group.id), "other"]);

    for (const group of groups) {
      expect(known, group.id).toContain(group.id);
      expect(group.settings.length).toBeGreaterThan(0);
    }
  });

  it("files a key by its prefix, and the hold, cleaning and overrun keys together", () => {
    expect(groupOf([], "hold.minutes")).toBe("booking");
    expect(groupOf([], "cleaning.buffer_minutes")).toBe("booking");
    expect(groupOf([], "overrun.increment_minutes")).toBe("booking");
    expect(groupOf([], "booking.guests_max")).toBe("booking");
    expect(groupOf([], "hours.regular")).toBe("hours");
    expect(groupOf([], "fees.tabby.percent")).toBe("pricing");
    expect(groupOf([record({ key: "unprefixed" })], "unprefixed")).toBeUndefined();
  });
});

describe("§10.2 — the control a key gets is derived, never hand-listed", () => {
  const CONTROL_TABLE = [
    { key: "urgency.enabled", valueType: "boolean", value: true, kind: "boolean" },
    { key: "hold.minutes", valueType: "integer", value: 10, kind: "number" },
    { key: "tax.vat_percent", valueType: "decimal", value: 5.5, kind: "number" },
    { key: "urgency.text_few", valueType: "string", value: "Only a few", kind: "text" },
    { key: "booking.durations_hours", valueType: "array", value: [2, 3], kind: "number-list" },
    { key: "hours.exceptions", valueType: "array", value: [], kind: "opening-exceptions" },
    { key: "hours.regular", valueType: "object", value: {}, kind: "weekly-hours" },
  ] as const;

  for (const row of CONTROL_TABLE) {
    it(`renders ${row.key} as a ${row.kind} control`, () => {
      const view = viewOf(
        [record({ key: row.key, valueType: row.valueType, value: row.value as never })],
        row.key,
      );

      expect(view?.control.kind).toBe(row.kind);
    });
  }

  it("prefers an enum select over the raw value type, from the registry schema", () => {
    const view = viewOf(
      [record({ key: "allocation.strategy", valueType: "string", value: "floor" as never })],
      "allocation.strategy",
    );

    expect(view?.control).toEqual({
      kind: "enum",
      options: ["fixed_priority", "rotation", "lru"],
    });
  });

  it("gives a long string a multiline field and a short one a single line", () => {
    const long = "x".repeat(49);
    const short = "x".repeat(48);

    expect(
      viewOf([record({ key: "contact.address", value: long as never })], "contact.address")
        ?.control,
    ).toEqual({ kind: "text", multiline: true });

    expect(
      viewOf([record({ key: "contact.address", value: short as never })], "contact.address")
        ?.control,
    ).toEqual({ kind: "text", multiline: false });
  });

  it("infers the value type from the registry default when no row exists", () => {
    expect(viewOf([], "urgency.enabled")?.valueType).toBe("boolean");
    expect(viewOf([], "hold.minutes")?.valueType).toBe("integer");
    expect(viewOf([], "booking.durations_hours")?.valueType).toBe("array");
    expect(viewOf([], "urgency.text_few")?.valueType).toBe("string");
  });
});

describe("§10.2 — a screen reading an unset value still behaves correctly", () => {
  it("reports configured, default and unset as three distinct states", () => {
    expect(viewOf([record({ key: "hold.minutes", value: 12 as never })], "hold.minutes")?.state)
      .toBe("configured");

    expect(viewOf([], "hold.minutes")?.state).toBe("default");
    expect(viewOf([], "tax.vat_percent")?.state).toBe("default");
    expect(viewOf([], "booking.same_day_cutoff")).toBeUndefined();
  });

  it("keeps the registry default visible beside the stored value", () => {
    const view = viewOf(
      [record({ key: "hold.minutes", valueType: "integer", value: 12 as never })],
      "hold.minutes",
    );

    expect(view?.storedValue).toBe(12);
    expect(view?.fallbackValue).toBe(SETTINGS["hold.minutes"].defaultValue);
  });

  it("does not count working defaults and optional settings as missing", () => {
    const groups = buildSettingGroups([
      record({ key: "hold.minutes", valueType: "integer", value: 10 as never }),
      record({
        key: "cleaning.buffer_minutes",
        valueType: "integer",
        value: 20 as never,
      }),
    ]);

    const hold = groups.find((group) => group.id === "booking");

    expect(hold?.settings.find((s) => s.key === "hold.minutes")?.state).toBe(
      "configured",
    );
    expect(
      hold?.settings.find((s) => s.key === "cleaning.buffer_minutes")?.state,
    ).toBe("configured");
    expect(hold?.unsetCount).toBe(
      0,
    );
  });

  it("carries the group label each setting belongs to", () => {
    const groups = buildSettingGroups([
      record({ key: "hold.minutes", valueType: "integer", value: 10 as never }),
    ]);

    const hold = groups.find((group) => group.id === "booking");

    expect(hold?.settings.find((s) => s.key === "hold.minutes")?.groupLabel).toBe(
      hold?.label,
    );
  });
});

describe("§10.2 — the value a Management screen prints", () => {
  it("prints a boolean as On and Off, never true and false", () => {
    expect(formatSettingValue(true, { kind: "boolean" })).toBe("On");
    expect(formatSettingValue(false, { kind: "boolean" })).toBe("Off");
  });

  it("prints a number list as a readable sequence", () => {
    expect(formatSettingValue([2, 3, 4], { kind: "number-list" })).toBe("2, 3, 4");
  });

  it("prints nothing at all for a value that has never been supplied", () => {
    expect(formatSettingValue(null, { kind: "text", multiline: false })).toBe("");
  });

  it("prints a closed day as closed rather than as an empty line", () => {
    const printed = formatSettingValue(
      { mon: [{ opens: "09:00", closes: "22:00" }] },
      { kind: "weekly-hours" },
    );

    expect(printed).toContain("Mon 09:00–22:00");
    expect(printed).toContain("Sun closed");
  });

  it("reads a malformed weekly-hours value into an empty draft rather than throwing", () => {
    expect(toWeeklyHoursDraft(null)).toEqual(EMPTY_WEEKLY_HOURS);
    expect(toWeeklyHoursDraft([1, 2, 3])).toEqual(EMPTY_WEEKLY_HOURS);
    expect(toWeeklyHoursDraft({ mon: "not an array" })).toEqual(EMPTY_WEEKLY_HOURS);
  });
});

describe("§10.2 — searching the settings screen", () => {
  const view = (): SettingView => viewOf([], "hold.minutes")!;

  it("matches on key, description and source tag", () => {
    expect(matchesSettingSearch(view(), "hold.min")).toBe(true);
    expect(matchesSettingSearch(view(), "finish payment")).toBe(true);
    expect(matchesSettingSearch(view(), "§7.3")).toBe(true);
  });

  it("matches everything on an empty term and nothing on an unrelated one", () => {
    expect(matchesSettingSearch(view(), "")).toBe(true);
    expect(matchesSettingSearch(view(), "stripe")).toBe(false);
  });
});
