import { describe, expect, it } from "vitest";
import { SETTINGS_PANELS } from "@/lib/config/settings-panels";
import { settingsFieldMatches, settingsPanelMatches } from "@/lib/config/settings-search";

const results = (query: string) => SETTINGS_PANELS.filter((panel) => settingsPanelMatches(panel, query)).map((panel) => panel.id);

describe("[CLIENT] Relevant settings search", () => {
  it("finds guest ages without matching message or percentage", () => {
    for (const query of ["age", "ages", " AGE ", "child age", "minimum age"]) expect(results(query)).toEqual(["booking"]);
    expect(settingsFieldMatches("fees.tabby.percent", "age")).toBe(false);
    expect(settingsFieldMatches("urgency.text_few", "age")).toBe(false);
    expect(settingsFieldMatches("booking.booker_min_age", "age")).toBe(true);
  });
  it("finds the controls for relevant names, prefixes and aliases", () => {
    expect(results("email")).toEqual(["contact"]);
    expect(results("vat")).toEqual(["pricing"]);
    expect(results("fully booked")).toEqual(["urgency"]);
    expect(results("durat")).toEqual(["booking"]);
    expect(results("day off")).toEqual(["booking"]);
    expect(results("custom schedule")).toEqual(["booking"]);
    expect(results("overstay")).toEqual(["overstay"]);
  });
  it("excludes removed controls and unrelated combinations", () => {
    expect(results("spam protection")).toEqual([]);
    expect(results("check-in reminder")).toEqual([]);
    expect(results("starting view")).toEqual([]);
    expect(results("guest age fee")).toEqual([]);
  });
  it("restores all panels when cleared", () => {
    expect(results("")).toEqual(SETTINGS_PANELS.map((panel) => panel.id));
    expect(results("  ")).toEqual(results(""));
  });
});
