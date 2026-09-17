import { describe, expect, it } from "vitest";
import { buildMessageTemplateViews, matchesTemplateSearch } from "@/components/console/manage/message-template-model";
import { messageTemplateSchema, parseTemplateTiming, timingDraft } from "@/lib/validation/message-template";
import { MESSAGE_BODY_MAX, MESSAGE_TIMING_MAX } from "@/lib/config/message-templates";

describe("[§12] Template timing editor", () => {
  it.each([null, 0, -15, 17, -60, 90, 1440, -2880, MESSAGE_TIMING_MAX, -MESSAGE_TIMING_MAX])("preserves the saved offset %s", (minutes) => {
    const draft = timingDraft(minutes);
    expect(parseTemplateTiming(draft.direction, draft.amount, draft.unit)).toEqual({ ok: true, minutes: minutes || null });
  });
  it("converts plain-language before and after values into minutes", () => {
    expect(parseTemplateTiming("before", "2", "days")).toEqual({ ok: true, minutes: -2880 });
    expect(parseTemplateTiming("after", "3", "hours")).toEqual({ ok: true, minutes: 180 });
  });
  it.each(["", "0", "-1", "1.5", "abc", "Infinity"])("rejects an invalid time amount %s", (amount) => {
    expect(parseTemplateTiming("before", amount, "minutes").ok).toBe(false);
  });
  it("refuses values beyond the database timing boundary", () => {
    expect(parseTemplateTiming("after", "366", "days").ok).toBe(false);
  });
});

describe("[§12] Message content and presentation", () => {
  const input = { key: "booking_reminder", channel: "email", isActive: true, subject: "  Visit reminder  ", body: "  We look forward to welcoming you.  ", timingMinutes: -1440 };
  it("saves trimmed reusable wording", () => {
    expect(messageTemplateSchema.parse(input)).toMatchObject({ subject: "Visit reminder", body: "We look forward to welcoming you." });
  });
  it("rejects empty or oversized messages and unknown templates", () => {
    for (const body of ["", "   ", "a".repeat(MESSAGE_BODY_MAX + 1)]) expect(messageTemplateSchema.safeParse({ ...input, body }).success).toBe(false);
    expect(messageTemplateSchema.safeParse({ ...input, key: "unknown" }).success).toBe(false);
  });
  it("does not allow an email subject on WhatsApp", () => {
    expect(messageTemplateSchema.safeParse({ ...input, channel: "whatsapp" }).success).toBe(false);
    expect(messageTemplateSchema.safeParse({ ...input, channel: "whatsapp", subject: null }).success).toBe(true);
  });
  it("treats missing templates as unconfigured rather than inventing a fallback", () => {
    const templates = buildMessageTemplateViews([]);
    expect(templates).toHaveLength(11);
    for (const template of templates) {
      expect(template.isWritten).toBe(false);
      expect(template.body).toBe("");
      expect(template.help.length).toBeGreaterThan(0);
    }
    expect(templates.filter((template) => template.kind === "marketing").map((template) => template.key)).toEqual(["review_request"]);
  });
  it("searches the saved subject, body and help text", () => {
    const template = buildMessageTemplateViews([{ key: "booking_reminder", channel: "email", isActive: true, isMarketing: false, subject: "Prepare for tomorrow", body: "Bring your slippers", timingMinutes: -1440 }]).find((item) => item.key === "booking_reminder");
    expect(template).toBeDefined();
    if (!template) return;
    for (const term of ["TOMORROW", "slippers", "suitable number"]) expect(matchesTemplateSearch(template, term)).toBe(true);
  });
});
