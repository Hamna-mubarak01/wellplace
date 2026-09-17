import { describe, expect, it } from "vitest";
import {
  MESSAGE_TEXT_KINDS,
  MESSAGE_TEXT_LIMITS,
} from "@/lib/config/message-text";
import { defaultDocument, sampleValues } from "@/lib/config/message-documents";
import {
  compileDocument,
  text,
  variable,
  type AuthoredBlock,
  type MessageTextAppearance,
} from "@/lib/domain/email/document";
import { renderEmail } from "@/lib/messaging/templates/layout";
import {
  messageTextStyle,
  messageTextCss,
} from "@/lib/messaging/text-appearance";
import { authoredDocumentSchema } from "@/lib/validation/message-document";
import {
  messageDraftSignature,
  parseMessageRecovery,
} from "@/lib/validation/message-draft";

const appearance: MessageTextAppearance = {
  font: "display",
  fontSize: 28,
  lineHeight: 40,
  color: "#123456",
  background: "#ffffff",
  align: "center",
};

describe("[OUR CHOICE] Professional email typography and draft recovery", () => {
  it.each(MESSAGE_TEXT_KINDS)(
    "keeps %s typography and protected variables through storage and rendering",
    (kind) => {
      const content = [text("Hello "), variable("full_name")];
      const block: AuthoredBlock =
        kind === "text"
          ? {
              kind,
              id: kind,
              content,
              appearance,
              size: "normal",
              align: "left",
            }
          : { kind, id: kind, content, appearance };
      const stored = authoredDocumentSchema.parse(
        JSON.parse(
          JSON.stringify({
            ...defaultDocument("waitlist_signup_notification"),
            blocks: [block],
          }),
        ),
      );
      const compiled = compileDocument(
        stored,
        sampleValues("waitlist_signup_notification"),
        "",
      );
      const rendered = renderEmail({ ...compiled, assetBaseUrl: "" });
      expect(rendered.html).toContain("Hello Ms Layla Haddad");
      for (const rule of [
        "font-size:28px",
        "line-height:40px",
        "color:#123456",
        "background-color:#ffffff",
        "text-align:center",
        "font-family:Georgia",
      ])
        expect(rendered.html).toContain(rule);
      expect(rendered.text.toLowerCase()).toContain("hello ms layla haddad");
      expect(stored.blocks[0]).toMatchObject({
        content: [expect.anything(), { kind: "variable", name: "full_name" }],
      });
    },
  );

  it.each([
    { color: "red;display:none" },
    { background: '"><script>alert(1)</script>' },
    { font: "url(https://example.com/font)" },
    { fontSize: MESSAGE_TEXT_LIMITS.fontSize.max + 1 },
    { lineHeight: -1 },
    { fontSize: 12.5 },
    { align: "left;position:fixed" },
  ])(
    "rejects unsafe typography before saving and defensively omits it from rendering (%#)",
    (patch) => {
      const invalid = { ...appearance, ...patch };
      expect(messageTextStyle(invalid)).toEqual({});
      expect(messageTextCss(invalid)).toBe("");
      expect(
        authoredDocumentSchema.safeParse({
          ...defaultDocument("waitlist_signup_notification"),
          blocks: [
            {
              kind: "heading",
              id: "title",
              content: [text("Hello")],
              appearance: invalid,
            },
          ],
        }).success,
      ).toBe(false);
    },
  );

  it("restores an incomplete draft without pretending it has been published", () => {
    const draft = {
      document: {
        name: "Recovered",
        subject: [],
        preheader: [],
        blocks: [{ kind: "button", id: "button", href: "", label: [] }],
      },
      settings: { channel: "email", isActive: true, timingMinutes: null },
    };
    const stored = JSON.stringify({
      owner: "old-editor",
      savedAt: null,
      draft,
    });
    expect(parseMessageRecovery(stored)?.draft).toEqual(draft);
  });

  it("recognises saved content despite JSON field order, but detects reordered blocks", () => {
    const document = defaultDocument("waitlist_signup_notification")!;
    const original = {
      document,
      settings: {
        channel: "email" as const,
        isActive: true,
        timingMinutes: null,
      },
    };
    const recovery = parseMessageRecovery(
      JSON.stringify({ owner: "earlier-tab", savedAt: null, draft: original }),
    )!;
    expect(messageDraftSignature(recovery.draft)).toBe(
      messageDraftSignature(original),
    );
    expect(
      messageDraftSignature({
        ...original,
        document: { ...document, blocks: [...document.blocks].reverse() },
      }),
    ).not.toBe(messageDraftSignature(original));
  });

  it.each([
    null,
    "{broken",
    "{}",
    JSON.stringify({
      owner: "old",
      savedAt: null,
      draft: { document: {}, settings: {} },
    }),
  ])("ignores unusable browser recovery data (%#)", (stored) => {
    expect(parseMessageRecovery(stored)).toBeNull();
  });
});
