import { describe, expect, it } from "vitest";
import { CLEANING_BUFFER_MINUTES, EXTENSION_MINUTES, LATE_ARRIVAL_MINUTES, REASON_MAX_LENGTH, TASK_TITLE_MAX_LENGTH, PAYMENT_REFERENCE_MAX_LENGTH, CONSOLE_MONEY_AED } from "@/lib/config/console-limits";
import { cleaningBufferInput, extensionInput, lateArrivalInput, newTaskInput, paymentReferenceInput, rescheduleInput, shiftNoteInput } from "@/lib/validation/reception-action-inputs";
import { reasonSchema } from "@/lib/validation/audit-reason";
import { filsSchema } from "@/lib/validation/console-inputs";
import { SETTINGS } from "@/lib/config/registry";
import { SETTING_LIMITS, settingInputLimits } from "@/lib/config/setting-limits";
import { cmsFieldError } from "@/lib/validation/cms-values";
import { textLines, repeater, text } from "@/lib/config/cms/fields";

const id = "7e2e0001-0000-4000-8000-000000000001";
describe("[OUR CHOICE] Console inputs enforce the same bounds at the server boundary", () => {
  it.each([
    [extensionInput, "extraMinutes", EXTENSION_MINUTES],
    [lateArrivalInput, "minutes", LATE_ARRIVAL_MINUTES],
    [cleaningBufferInput, "bufferMinutes", CLEANING_BUFFER_MINUTES],
  ] as const)("accepts whole-minute boundaries and refuses invalid values (%s)", (schema, key, bounds) => {
    const parse = (value: number) => schema.safeParse({ bookingId: id, reason: "Guest requested this change", [key]: value });
    expect(parse(bounds.min).success).toBe(true);
    expect(parse(bounds.max).success).toBe(true);
    for (const value of [bounds.min - 1, bounds.max + 1, 1.5, NaN, Infinity]) expect(parse(value).success).toBe(false);
  });
  it("rejects overlong audit reasons and payment references instead of letting the DB truncate them", () => {
    expect(reasonSchema.safeParse("x".repeat(REASON_MAX_LENGTH)).success).toBe(true);
    expect(reasonSchema.safeParse("x".repeat(REASON_MAX_LENGTH + 1)).success).toBe(false);
    expect(paymentReferenceInput.safeParse("x".repeat(PAYMENT_REFERENCE_MAX_LENGTH)).success).toBe(true);
    expect(paymentReferenceInput.safeParse("x".repeat(PAYMENT_REFERENCE_MAX_LENGTH + 1)).success).toBe(false);
    expect(filsSchema.safeParse(CONSOLE_MONEY_AED.max * 100).success).toBe(true);
    expect(filsSchema.safeParse(CONSOLE_MONEY_AED.max * 100 + 1).success).toBe(false);
  });
  it("validates task titles, dates and priorities", () => {
    const task = { title: "x".repeat(TASK_TITLE_MAX_LENGTH), note: "", assignedTo: null, dueOn: null, priority: "normal" };
    expect(newTaskInput.safeParse(task).success).toBe(true);
    for (const patch of [{ title: " " }, { title: task.title + "x" }, { dueOn: "2026-02-30" }, { priority: "unexpected" }, { assignedTo: "invalid" }]) expect(newTaskInput.safeParse({ ...task, ...patch }).success).toBe(false);
    expect(shiftNoteInput.safeParse({ shiftOn: "2026-02-30", body: "Note" }).success).toBe(false);
  });
  it("keeps exact rescheduling minutes and refuses conflicting duration fields and reversed blocks", () => {
    const input = { bookingId: id, startsAt: "2026-09-12T06:00:00Z", durationMinutes: 150, reason: "Guest request" };
    expect(rescheduleInput.safeParse(input).success).toBe(true);
    expect(rescheduleInput.safeParse({ ...input, durationHours: 3 }).success).toBe(false);
    expect(rescheduleInput.safeParse({ ...input, startsAt: "tomorrow" }).success).toBe(false);
  });
  it("bounds every registered numeric setting and converts money to AED for inputs", () => {
    for (const [key, bounds] of Object.entries(SETTING_LIMITS)) {
      const schema = SETTINGS[key as keyof typeof SETTING_LIMITS].schema;
      expect(schema.safeParse(bounds.min).success, key).toBe(true);
      expect(schema.safeParse(bounds.max).success, key).toBe(true);
      expect(schema.safeParse(bounds.min - 1).success, key).toBe(false);
      expect(schema.safeParse(bounds.max + 1).success, key).toBe(false);
    }
    expect(settingInputLimits("pricing.rounding_fils")).toEqual({ min: 0.01, max: 100, step: 0.01 });
  });
  it("refuses excess CMS lines and nested item content before projection can discard it", () => {
    const lines = textLines("items", "Facilities", "Facility", 2, []);
    expect(cmsFieldError(lines, "First\nSecond")).toBeUndefined();
    expect(cmsFieldError(lines, "First\nSecond\nThird")).toContain("2 lines");
    const field = repeater("cards", "Cards", "Card", 1, [{ ...text("title", "Title", ""), maxLength: 3 }], []);
    expect(cmsFieldError(field, [{ title: "OK" }])).toBeUndefined();
    expect(cmsFieldError(field, [{ title: "Long" }])).toContain("3 characters");
    expect(cmsFieldError(field, [{ title: "A" }, { title: "B" }])).toContain("1 items");
  });
});
