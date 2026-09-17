import { describe, expect, it } from "vitest";

import {
  MESSAGE_BUTTON_DEFAULTS,
  MESSAGE_BUTTON_LIMITS,
} from "@/lib/config/message-button";
import { defaultDocument, sampleValues } from "@/lib/config/message-documents";
import {
  compileDocument,
  text,
  type AuthoredDocument,
} from "@/lib/domain/email/document";
import { EMAIL_THEME } from "@/lib/messaging/email-theme";
import { renderEmail } from "@/lib/messaging/templates/layout";
import { authoredDocumentSchema } from "@/lib/validation/message-document";
import {
  messageButtonAppearanceSchema,
  resolveMessageButtonAppearance,
} from "@/lib/validation/message-button";

const custom = {
  ...MESSAGE_BUTTON_DEFAULTS,
  followBrand: false,
  width: "full" as const,
  align: "center" as const,
  background: "#123456",
  textColor: "#ffffff",
  radius: 24,
  paddingX: 32,
  paddingY: 18,
};

describe("[OUR CHOICE] The selected email button keeps its appearance through draft and delivery", () => {
  it("round-trips the renamed template and the exact styled block through validation and rendering", () => {
    const document: AuthoredDocument = {
      ...defaultDocument("waitlist_confirmation")!,
      name: "My waitlist welcome",
      blocks: [
        {
          kind: "button",
          id: "chosen-button",
          label: [text("Open booking")],
          href: "https://example.com/book",
          appearance: custom,
        },
      ],
    };
    const stored = authoredDocumentSchema.parse(
      JSON.parse(JSON.stringify(document)),
    );
    expect(stored.name).toBe(document.name);
    const compiled = compileDocument(
      stored,
      sampleValues("waitlist_confirmation"),
      EMAIL_THEME.brand,
    );
    expect(compiled.blocks).toEqual([
      {
        kind: "button",
        label: "Open booking",
        href: "https://example.com/book",
        appearance: custom,
      },
    ]);
    const rendered = renderEmail({ ...compiled, assetBaseUrl: "" });
    for (const style of [
      "background-color:#123456",
      "color:#ffffff",
      "border-radius:24px",
      "padding:18px 32px",
      "width:100%",
      'align="center"',
    ])
      expect(rendered.html).toContain(style);
    expect(rendered.text).toContain("Open booking: https://example.com/book");
  });

  it("follows shared colours and corners while keeping local layout and spacing", () => {
    expect(
      resolveMessageButtonAppearance({ ...custom, followBrand: true }),
    ).toEqual({
      ...custom,
      followBrand: true,
      background: MESSAGE_BUTTON_DEFAULTS.background,
      textColor: MESSAGE_BUTTON_DEFAULTS.textColor,
      radius: MESSAGE_BUTTON_DEFAULTS.radius,
    });
  });

  it.each([
    { background: "red; background-image:url(https://example.com)" },
    { textColor: '"><script>alert(1)</script>' },
    { align: 'center" onclick="alert(1)' },
    { width: "200%" },
    { radius: MESSAGE_BUTTON_LIMITS.radius.max + 1 },
    { paddingX: -1 },
    { paddingY: MESSAGE_BUTTON_LIMITS.padding.max + 1 },
    { radius: 1.5 },
  ])("rejects unsafe or out-of-range styling (%#)", (patch) => {
    expect(
      messageButtonAppearanceSchema.safeParse({ ...custom, ...patch }).success,
    ).toBe(false);
    expect(resolveMessageButtonAppearance({ ...custom, ...patch })).toEqual(
      MESSAGE_BUTTON_DEFAULTS,
    );
  });

  it("leaves older documents without appearance settings valid and uses the existing email button", () => {
    const document = defaultDocument("waitlist_confirmation")!;
    expect(authoredDocumentSchema.safeParse(document).success).toBe(true);
    const rendered = renderEmail({
      subject: "Test",
      assetBaseUrl: "",
      blocks: [{ kind: "button", label: "Open", href: "https://example.com" }],
    });
    expect(rendered.html).toContain("v:roundrect");
    expect(rendered.html).toContain(`background-color:${EMAIL_THEME.brand}`);
  });
});
