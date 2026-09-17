import { describe, expect, it } from "vitest";
import {
  editorHistory,
  blockTypingGroup,
  startHistory,
  type TemplateDraft,
} from "@/components/console/manage/messages/editor-history";
import {
  createBlock,
  insertBlock,
} from "@/components/console/manage/messages/message-document-model";
import { MESSAGE_EDITOR } from "@/lib/config/message-documents";
import {
  authoredDocumentSchema,
  readyToPublish,
} from "@/lib/validation/message-document";
import { sanitizeEmailHtml } from "@/lib/validation/email-html";
import { compileDocument, text, variable } from "@/lib/domain/email/document";
import { renderEmail } from "@/lib/messaging/templates/layout";

const draft: TemplateDraft = {
  document: {
    subject: [text("Welcome")],
    preheader: [],
    blocks: [
      {
        kind: "text",
        id: "first",
        content: [text("Welcome")],
        align: "left",
        size: "normal",
      },
    ],
  },
  settings: { channel: "email", isActive: true, timingMinutes: null },
};

function changed(wording: string): TemplateDraft {
  return {
    ...draft,
    document: { ...draft.document, subject: [text(wording)] },
  };
}

describe("[OUR CHOICE] Reference editor workflow", () => {
  it("separates text, typography resets and column removal in undo history", () => {
    const columns = {
      kind: "columns" as const,
      id: "columns",
      columns: [[text("First")], [text("Second")], [text("Third")]],
    };
    const typed = {
      ...columns,
      columns: [...columns.columns.slice(0, 2), [text("Third edited")]],
    };
    expect(blockTypingGroup(columns, typed)).toBe("columns:columns:2:0:text");
    expect(
      blockTypingGroup(typed, { ...typed, columns: typed.columns.slice(0, 2) }),
    ).toBeUndefined();
    const heading = {
      kind: "heading" as const,
      id: "heading",
      content: [text("Welcome")],
      appearance: {
        font: "body" as const,
        fontSize: 28,
        lineHeight: 40,
        color: "#123456",
        background: "#ffffff",
        align: "left" as const,
      },
    };
    expect(
      blockTypingGroup(heading, { ...heading, appearance: undefined }),
    ).toBeUndefined();
    expect(
      blockTypingGroup(heading, {
        ...heading,
        appearance: { ...heading.appearance, align: "center" },
      }),
    ).toBeUndefined();
  });
  it("undoes delivery and wording changes together, then restores them on redo", () => {
    const changedDraft = {
      ...changed("Hello"),
      settings: { ...draft.settings, isActive: false },
    };
    const edited = editorHistory(startHistory(draft), {
      type: "change",
      draft: changedDraft,
      now: 10,
    });
    const undone = editorHistory(edited, { type: "undo" });
    expect(undone.present).toEqual(draft);
    expect(editorHistory(undone, { type: "redo" }).present).toEqual(
      changedDraft,
    );
  });
  it("groups continuous typing but keeps a change in another field separate", () => {
    const first = editorHistory(startHistory(draft), {
      type: "change",
      draft: changed("H"),
      group: "subject",
      now: 10,
    });
    const second = editorHistory(first, {
      type: "change",
      draft: changed("Hello"),
      group: "subject",
      now: 20,
    });
    expect(second.past).toHaveLength(1);
    const third = editorHistory(second, {
      type: "change",
      draft: changed("Hello again"),
      group: "different-block",
      now: 30,
    });
    expect(editorHistory(third, { type: "undo" }).present).toEqual(
      second.present,
    );
  });
  it("clears the redo branch after an edit following undo", () => {
    const edited = editorHistory(startHistory(draft), {
      type: "change",
      draft: changed("A"),
      now: 10,
    });
    const branched = editorHistory(editorHistory(edited, { type: "undo" }), {
      type: "change",
      draft: changed("B"),
      now: 20,
    });
    expect(branched.future).toEqual([]);
    expect(editorHistory(branched, { type: "redo" }).present).toEqual(
      changed("B"),
    );
  });
  it("inserts at the requested position and retains shared-branding and delivery choices", () => {
    const document = {
      ...draft.document,
      branding: false,
      delivery: draft.settings,
    };
    const added = insertBlock(document, createBlock("image"), 0);
    expect(added.blocks.map((block) => block.kind)).toEqual(["image", "text"]);
    expect(added.branding).toBe(false);
    expect(added.delivery).toEqual(draft.settings);
  });
  it("allows incomplete image/button drafts but refuses to publish them", () => {
    const document = {
      ...draft.document,
      blocks: [createBlock("image"), createBlock("button")],
    };
    expect(authoredDocumentSchema.safeParse(document).success).toBe(true);
    expect(readyToPublish("waitlist_confirmation", document).ok).toBe(false);
  });
  it("keeps variable chips typed through draft validation", () => {
    const parsed = authoredDocumentSchema.parse({
      ...draft.document,
      subject: [text("Hello "), variable("first_name")],
    });
    expect(parsed.subject[1]).toEqual({ kind: "variable", name: "first_name" });
  });
  it("bounds undo history", () => {
    let history = startHistory(draft);
    for (let index = 0; index <= MESSAGE_EDITOR.historyDepth; index++)
      history = editorHistory(history, {
        type: "change",
        draft: changed(String(index)),
        now: index,
      });
    expect(history.past).toHaveLength(MESSAGE_EDITOR.historyDepth);
  });
});

describe("[OUR CHOICE] Custom email blocks use the real delivery renderer", () => {
  it.each([
    "<script>alert(1)</script>",
    '<img src="https://example.com/a.png" onerror="alert(1)">',
    '<a href="javascript:alert(1)">Link</a>',
    '<div style="background-image:url(https://example.com/tracker);position:fixed">Text</div>',
    '<svg onload="alert(1)"></svg>',
    '<iframe src="https://example.com"></iframe>',
  ])("removes executable content and tracking styles: %s", (markup) => {
    const safe = sanitizeEmailHtml(markup);
    expect(safe).not.toMatch(
      /script|onerror|onload|javascript:|background-image|position:|<svg|<iframe/i,
    );
    const delivered = renderEmail({
      subject: "Test",
      assetBaseUrl: "https://example.com",
      blocks: [{ kind: "html", markup }],
    });
    expect(delivered.html).not.toMatch(
      /alert\(1\)|javascript:|background-image|position:fixed|<svg|<iframe/i,
    );
  });
  it("renders side-by-side columns with a phone stacking rule and substituted variables", () => {
    const compiled = compileDocument(
      {
        ...draft.document,
        blocks: [
          {
            kind: "columns",
            id: "columns",
            columns: [
              [text("Hello "), variable("first_name")],
              [text("See you soon")],
            ],
          },
        ],
      },
      { first_name: "Layla" },
      "",
    );
    const output = renderEmail({
      subject: compiled.subject,
      assetBaseUrl: "https://example.com",
      blocks: compiled.blocks,
    });
    expect(output.html).toContain("Hello Layla");
    expect(output.html).toContain(".wp-column{display:block");
    expect(output.text).toContain("See you soon");
  });
  it("includes shared branding by default and removes it only when switched off", () => {
    const input = {
      subject: "Test",
      assetBaseUrl: "https://example.com",
      footerLines: ["Shared footer"],
      blocks: [],
    };
    expect(renderEmail(input).html).toContain("wordmark-dark-email.png");
    const without = renderEmail({ ...input, branding: false });
    expect(without.html).not.toContain("wordmark-dark-email.png");
    expect(without.html).not.toContain("Shared footer");
  });
});
