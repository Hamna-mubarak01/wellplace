import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  send: vi.fn(),
  applyFooter: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireManagement: mocks.guard }));
vi.mock("@/lib/messaging/mailer", () => ({
  emailAdapter: () => ({ send: mocks.send }),
}));
vi.mock("@/lib/db/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db/queries/message-documents", () => ({
  fetchMessageDocument: vi.fn(),
}));
vi.mock("@/lib/db/rpc", () => ({
  applyEmailFooterToAll: mocks.applyFooter,
  publishMessageTemplate: vi.fn(),
  resetMessageTemplate: vi.fn(),
  saveMessageTemplateDraft: vi.fn(),
}));
vi.mock("@/lib/services/cms-media-service", () => ({
  uploadCmsMedia: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { applyMessageFooterToAll, sendMessageDocumentTest } from "@/app/(console)/manage/messages/document-actions";
import { defaultDocument } from "@/lib/config/message-documents";
import { DEFAULT_FOOTER_DESIGN } from "@/lib/config/message-footer";
import { text } from "@/lib/domain/email/document";

const valid = {
  key: "waitlist_confirmation",
  document: defaultDocument("waitlist_confirmation"),
  recipientEmail: "reviewer@example.com",
};

describe("[OUR CHOICE] Test email recipient configuration (owner request, 12 September 2026)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.guard.mockResolvedValue({ email: "manager@example.com" });
    mocks.send.mockResolvedValue({ ok: true, id: "test-delivery" });
  });

  it("sends the current unsaved wording only to the chosen recipient", async () => {
    const result = await sendMessageDocumentTest({
      ...valid,
      recipientEmail: "  reviewer+preview@example.com  ",
      document: { ...valid.document, subject: [text("My unsaved subject")] },
    });
    expect(mocks.guard).toHaveBeenCalledOnce();
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "reviewer+preview@example.com",
        subject: "[Test] My unsaved subject",
        html: expect.stringContaining("Layla"),
      }),
    );
    expect(result).toEqual({
      ok: true,
      message: "Test sent to reviewer+preview@example.com.",
    });
  });

  it.each([
    undefined,
    null,
    "",
    "  ",
    "not-an-email",
    "first@example.com,second@example.com",
    "a@example.com\r\nBcc: b@example.com",
  ])(
    "rejects an invalid or absent recipient without sending (%#)",
    async (recipientEmail) => {
      expect(
        await sendMessageDocumentTest({ ...valid, recipientEmail }),
      ).toEqual({
        ok: false,
        message: "Enter one valid email address to receive the test.",
      });
      expect(mocks.send).not.toHaveBeenCalled();
    },
  );

  it("requires management access before accepting any request", async () => {
    mocks.guard.mockRejectedValue(new Error("Access denied"));
    await expect(sendMessageDocumentTest(valid)).rejects.toThrow(
      "Access denied",
    );
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("still refuses a document that cannot be published", async () => {
    expect(
      await sendMessageDocumentTest({
        ...valid,
        document: { ...valid.document, subject: [] },
      }),
    ).toMatchObject({ ok: false });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("does not claim delivery when the provider refuses the message", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.send.mockResolvedValue({
      ok: false,
      reason: "provider",
      message: "Rejected",
    });
    expect(await sendMessageDocumentTest(valid)).toEqual({
      ok: false,
      message: "The test could not be sent. Check the email provider settings.",
    });
    log.mockRestore();
  });
});

describe("[OUR CHOICE; owner request 12 September 2026] Apply footer action", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.guard.mockResolvedValue({ email: "manager@example.test" });
    mocks.applyFooter.mockResolvedValue({ outcome: "ok", value: { updatedCount: 18 } });
  });

  it("passes only the footer and system keys to one atomic database operation", async () => {
    const result = await applyMessageFooterToAll({ footer: "New footer", document: { blocks: ["Unpublished body"] } });
    expect(result.ok).toBe(true);
    expect(mocks.applyFooter).toHaveBeenCalledOnce();
    expect(mocks.applyFooter.mock.calls[0][1]).toEqual({ footer: "New footer", keys: expect.arrayContaining(["staff_invitation", "waitlist_confirmation", "invoice_issued"]) });
  });

  it("passes the reviewed rich footer through the atomic action and rejects unsafe links", async () => {
    const footerDesign = { ...DEFAULT_FOOTER_DESIGN, links: [{ id: "site", icon: "website", label: "Website", href: "https://wellplace.example", enabled: true }] };
    expect((await applyMessageFooterToAll({ footer: "New footer", footerDesign })).ok).toBe(true);
    expect(mocks.applyFooter.mock.calls[0][1].footerDesign).toEqual(footerDesign);
    mocks.applyFooter.mockClear();
    expect((await applyMessageFooterToAll({ footer: "Unsafe", footerDesign: { ...footerDesign, links: [{ ...footerDesign.links[0], href: "javascript:alert(1)" }] } })).ok).toBe(false);
    expect(mocks.applyFooter).not.toHaveBeenCalled();
  });

  it("requires management and rejects malformed text without writing", async () => {
    expect((await applyMessageFooterToAll({ footer: null })).ok).toBe(false);
    expect(mocks.applyFooter).not.toHaveBeenCalled();
    mocks.guard.mockRejectedValue(new Error("Access denied"));
    await expect(applyMessageFooterToAll({ footer: "New footer" })).rejects.toThrow("Access denied");
    expect(mocks.applyFooter).not.toHaveBeenCalled();
  });

  it("reports a failed bulk operation without claiming success", async () => {
    mocks.applyFooter.mockResolvedValue({ outcome: "failed", message: "Database unavailable" });
    expect(await applyMessageFooterToAll({ footer: "New footer" })).toEqual({ ok: false, message: "Database unavailable" });
  });
});
