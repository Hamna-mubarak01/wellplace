import { describe, expect, it } from "vitest";
import { markDeskPanelSeen, parseDeskSeen, unseenDeskItems } from "@/lib/console/desk-notifications";

describe("front desk unread updates", () => {
  it("spots a new item even when the total count stays the same", () => {
    expect(unseenDeskItems(["booking-b"], ["booking-a"])).toBe(1);
  });
  it("keeps unread notes when only arrivals are viewed", () => {
    const seen = markDeskPanelSeen({}, "arrivals", ["booking-a"]);
    expect(unseenDeskItems(["booking-a"], seen.arrivals)).toBe(0);
    expect(unseenDeskItems(["note-a"], seen.notes)).toBe(1);
  });
  it("keeps viewed items across reloads and temporary removal from the list", () => {
    const seen = markDeskPanelSeen({ notes: ["old"] }, "notes", ["new"]);
    const restored = parseDeskSeen(JSON.stringify(seen));
    expect(unseenDeskItems(["old", "new", "new"], restored.notes)).toBe(0);
  });
  it("does not acknowledge unknown data after a failed read", () => {
    const seen = { alerts: ["a"] };
    expect(markDeskPanelSeen(seen, "alerts", null)).toBe(seen);
    expect(unseenDeskItems(null, seen.alerts)).toBe(0);
  });
  it("ignores damaged storage without breaking notifications", () => {
    expect(parseDeskSeen("{bad")).toEqual({});
    expect(parseDeskSeen('{"notes":[9],"alerts":["valid"],"other":["x"]}')).toEqual({ alerts: ["valid"] });
    expect(parseDeskSeen("[]")).toEqual({});
  });
});
