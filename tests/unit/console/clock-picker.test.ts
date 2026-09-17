import { describe, expect, it } from "vitest";
import { clockParts, clockValue, clockLabel } from "@/lib/config/clock-picker";
import { scheduleWeekDraft } from "@/lib/config/schedule-editor";
import { EMPTY_WEEK, weeklyHoursSchema } from "@/lib/config/opening-hours";

describe("[CLIENT] AM/PM time picker", () => {
  it("handles midnight and noon without shifting the stored day", () => {
    expect(clockLabel("00:00")).toBe("12:00 AM");
    expect(clockLabel("12:00")).toBe("12:00 PM");
    expect(clockValue({ hour: "12", minute: "30", period: "AM" })).toBe("00:30");
    expect(clockValue({ hour: "12", minute: "30", period: "PM" })).toBe("12:30");
    expect(clockValue({ hour: "10", minute: "07", period: "PM" })).toBe("22:07");
  });
  it("preserves every existing minute when switching presentation", () => {
    for (let hour = 0; hour < 24; hour++) for (let minute = 0; minute < 60; minute++) {
      const stored = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      expect(clockValue(clockParts(stored))).toBe(stored);
    }
  });
  it("keeps an incomplete time-range edit visible while preventing it from saving", () => {
    const editing = { ...EMPTY_WEEK, mon: [{ opens: "22:00", closes: "22:00" }] };
    expect(scheduleWeekDraft.safeParse(editing).success).toBe(true);
    expect(weeklyHoursSchema.safeParse(editing).success).toBe(false);
    expect(weeklyHoursSchema.safeParse({ ...editing, mon: [] }).success).toBe(true);
  });
});
