import { describe, expect, it } from "vitest";

import {
  AUTHORED_BLOCK_KINDS,
  BLOCK_ALIGNMENTS,
  IMAGE_WIDTH,
  SPACER_HEIGHT,
  TEXT_SIZES,
  VARIABLE_NAME,
  compileDocument,
  documentVariables,
  escape,
  inlineToHtml,
  inlineToText,
  inspectDocument,
  isBlank,
  isSendableHref,
  isUsableHref,
  link,
  resolveHref,
  strong,
  text,
  variable,
  variableInToken,
  variableToken,
  type AuthoredBlock,
  type AuthoredBlockKind,
  type AuthoredDocument,
  type CompiledDocument,
  type InlineLink,
  type InlineNode,
  type LinkItem,
  type LinkableNode,
  type PanelRow,
  type VariableValues,
} from "@/lib/domain/email/document";

const COLOUR = "#8f6529";

function html(nodes: readonly InlineNode[], values: VariableValues = {}): string {
  return inlineToHtml(nodes, values, COLOUR);
}

function plain(nodes: readonly InlineNode[], values: VariableValues = {}): string {
  return inlineToText(nodes, values);
}

function compile(document: AuthoredDocument, values: VariableValues = {}): CompiledDocument {
  return compileDocument(document, values, COLOUR);
}

const OWN_TAGS = /<\/?(?:strong|em|u|br|a)\b[^>]*>/g;

function withoutOwnTags(rendered: string): string {
  return rendered.replace(OWN_TAGS, "");
}

function doc(over: Partial<AuthoredDocument> = {}): AuthoredDocument {
  return {
    subject: [text("Your WellPlace booking is confirmed")],
    preheader: [text("Your private suite is reserved.")],
    blocks: [{ kind: "heading", id: "heading-1", content: [text("You’re booked")] }],
    ...over,
  };
}

function withBlocks(...blocks: AuthoredBlock[]): AuthoredDocument {
  return doc({ blocks });
}

const SAMPLE_BLOCKS: Readonly<Record<AuthoredBlockKind, AuthoredBlock>> = {
  band: { kind: "band", id: "band", content: [text("Welcome")] },
  quote: { kind: "quote", id: "quote", content: [text("A quiet moment")] },
  columns: { kind: "columns", id: "columns", columns: [[text("One")], [text("Two")]] },
  hero: { kind: "hero", id: "hero", src: "https://wellplace.example/hero.png", alt: "Suite", content: [text("Welcome")] },
  video: { kind: "video", id: "video", src: "https://wellplace.example/video.png", alt: "Suite tour", href: "https://wellplace.example/tour", label: [text("Watch video")] },
  file: { kind: "file", id: "file", href: "https://wellplace.example/guide.pdf", label: [text("Read guide")] },
  html: { kind: "html", id: "html", markup: "<p>Welcome</p>" },
  eyebrow: { kind: "eyebrow", id: "b-eyebrow", content: [text("Booking confirmed")] },
  heading: {
    kind: "heading",
    id: "b-heading",
    content: [text("You’re booked, "), variable("first_name")],
  },
  lead: { kind: "lead", id: "b-lead", content: [text("Your private suite is reserved.")] },
  text: {
    kind: "text",
    id: "b-text",
    content: [text("See you soon.")],
    align: "left",
    size: "normal",
  },
  note: { kind: "note", id: "b-note", content: [text("Reply to this email with any question.")] },
  panel: {
    kind: "panel",
    id: "b-panel",
    rows: [{ label: [text("Reference")], value: [variable("reference")] }],
  },
  button: {
    kind: "button",
    id: "b-button",
    label: [text("View your receipt")],
    href: variableToken("receipt_url"),
  },
  links: {
    kind: "links",
    id: "b-links",
    label: [text("Useful links")],
    items: [{ label: [text("Directions")], href: "https://wellplace.example/contact" }],
  },
  divider: { kind: "divider", id: "b-divider" },
  spacer: { kind: "spacer", id: "b-spacer", height: SPACER_HEIGHT.fallback },
  image: {
    kind: "image",
    id: "b-image",
    src: "https://wellplace.example/email/arrival.png",
    alt: "The arrival lounge at dusk",
    width: IMAGE_WIDTH.fallback,
  },
};

const SAMPLE_CATALOGUE = ["first_name", "reference", "receipt_url"];

const SAMPLE_VALUES: VariableValues = {
  first_name: "Layla",
  reference: "WP-4821",
  receipt_url: "https://wellplace.example/book/receipt/abc",
};

const HOSTILE: readonly (readonly [string, string])[] = [
  ["a script tag", "<script>alert(1)</script>"],
  ["an attribute break-out", '"><img src=x onerror=alert(1)>'],
  ["a single-quote break-out", "' onmouseover='alert(1)"],
  ["a javascript url written as words", "javascript:alert(document.cookie)"],
  ["an svg onload payload", "<svg/onload=alert(1)>"],
  ["a bare ampersand", "Tom & Jerry & Co"],
  ["an already-escaped entity", "&lt;b&gt;already escaped&lt;/b&gt;"],
  ["an html comment", "<!-- hidden -->"],
  ["a closing anchor", "</a><a href=\"javascript:alert(1)\">click</a>"],
  ["right-to-left and emoji", "مرحبا ‮gnirts desrever‬ 😀"],
  ["a tab in the middle", "before after\tend"],
];

const UNSENDABLE_VALUES: readonly (readonly [string, VariableValues])[] = [
  ["no value was supplied at all", {}],
  ["the value is empty", { receipt_url: "" }],
  ["the value is only spaces", { receipt_url: "   " }],
  ["the value is a javascript url", { receipt_url: "javascript:alert(1)" }],
  ["the value is a data url", { receipt_url: "data:image/svg+xml,<svg onload=alert(1)/>" }],
  ["the value is protocol-relative", { receipt_url: "//evil.example/x.png" }],
  ["the value is plain http", { receipt_url: "http://wellplace.example/x.png" }],
  ["the value is a scheme alone", { receipt_url: "https://" }],
];

const UNSENDABLE: readonly (readonly [string, string])[] = [
  ["a javascript url", "javascript:alert(1)"],
  ["a javascript url in mixed case", "JaVaScRiPt:alert(1)"],
  ["a data url", "data:text/html,<script>alert(1)</script>"],
  ["a vbscript url", "vbscript:msgbox(1)"],
  ["a file url", "file:///etc/passwd"],
  ["plain http", "http://wellplace.example"],
  ["a protocol-relative address", "//evil.example/steal"],
  ["a site-relative path", "/book"],
  ["a bare hostname", "wellplace.example"],
  ["an empty address", ""],
  ["only spaces", "   "],
  ["a scheme with nothing after it", "https://"],
  ["a mailto with no recipient", "mailto:"],
];

describe("§12 — a variable is a node, so the author can delete it whole but never edit it letter by letter", () => {
  it("does not read a variable out of a text node whose own words happen to contain a token", () => {
    const document = doc({
      subject: [text("Hello {{first_name}}")],
      preheader: [text("{{reference}} and {{amount}}")],
      blocks: [{ kind: "lead", id: "lead-1", content: [text("{{receipt_url}}")] }],
    });

    expect(documentVariables(document)).toEqual([]);
  });

  it("escapes a typed token as ordinary words and never substitutes a value for it", () => {
    const typed = [text("Hello {{first_name}}")];

    expect(html(typed, { first_name: "Layla" })).toBe("Hello {{first_name}}");
    expect(plain(typed, { first_name: "Layla" })).toBe("Hello {{first_name}}");
  });

  it("collects the variable node standing beside an identical typed token, and only that node", () => {
    const document = doc({
      subject: [text("{{first_name}} is not a variable, "), variable("first_name")],
    });

    expect(documentVariables(document)).toEqual(["first_name"]);
    expect(plain(document.subject, { first_name: "Layla" })).toBe(
      "{{first_name}} is not a variable, Layla",
    );
  });

  it("collects a variable from every place the model allows one", () => {
    const document: AuthoredDocument = {
      subject: [variable("in_subject")],
      preheader: [variable("in_preheader")],
      blocks: [
        { kind: "eyebrow", id: "1", content: [variable("in_eyebrow")] },
        { kind: "heading", id: "2", content: [variable("in_heading")] },
        {
          kind: "lead",
          id: "3",
          content: [
            variable("in_lead"),
            link(variableToken("in_lead_href"), [variable("in_lead_label")]),
          ],
        },
        {
          kind: "text",
          id: "4",
          content: [variable("in_text")],
          align: "left",
          size: "normal",
        },
        { kind: "note", id: "5", content: [variable("in_note")] },
        {
          kind: "panel",
          id: "6",
          rows: [{ label: [variable("in_panel_label")], value: [variable("in_panel_value")] }],
        },
        {
          kind: "button",
          id: "7",
          label: [variable("in_button_label")],
          href: variableToken("in_button_href"),
        },
        {
          kind: "links",
          id: "8",
          label: [variable("in_links_label")],
          items: [
            { label: [variable("in_item_label")], href: variableToken("in_item_href") },
          ],
        },
        { kind: "divider", id: "9" },
        { kind: "spacer", id: "10", height: 24 },
        { kind: "image", id: "11", src: variableToken("in_image_src"), alt: "Hero", width: 520 },
      ],
    };

    expect(documentVariables(document)).toEqual([
      "in_button_href",
      "in_button_label",
      "in_eyebrow",
      "in_heading",
      "in_image_src",
      "in_item_href",
      "in_item_label",
      "in_lead",
      "in_lead_href",
      "in_lead_label",
      "in_links_label",
      "in_note",
      "in_panel_label",
      "in_panel_value",
      "in_preheader",
      "in_subject",
      "in_text",
    ]);
  });

  it("names each variable once however often it is used, in a stable sorted order", () => {
    const document = doc({
      subject: [variable("reference"), variable("first_name")],
      preheader: [variable("first_name")],
      blocks: [
        { kind: "heading", id: "h", content: [variable("amount"), variable("first_name")] },
      ],
    });

    expect(documentVariables(document)).toEqual(["amount", "first_name", "reference"]);
  });

  it("forgets a variable the moment its node is removed, with nothing left behind in the text", () => {
    const before = doc({ subject: [text("Hello "), variable("first_name"), text("!")] });
    const after = doc({ subject: [text("Hello "), text("!")] });

    expect(documentVariables(before)).toEqual(["first_name"]);
    expect(documentVariables(after)).toEqual([]);
    expect(plain(after.subject, { first_name: "Layla" })).toBe("Hello !");
  });

  it("treats a variable as content, so a subject holding nothing but a variable is not blank", () => {
    expect(isBlank([variable("first_name")])).toBe(false);
    expect(inspectDocument(doc({ subject: [variable("first_name")] }), ["first_name"])).toEqual([]);
  });

  it("never resolves a variable out of the prototype chain", () => {
    for (const name of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
      expect(plain([variable(name)], {})).toBe(`{{${name}}}`);
      expect(html([variable(name)], {})).toBe(`{{${name}}}`);
    }
  });

  it("accepts only the variable names the token grammar allows", () => {
    for (const good of ["a", "first_name", "tax_amount", "x9", `a${"b".repeat(39)}`]) {
      expect(VARIABLE_NAME.test(good)).toBe(true);
      expect(variableInToken(variableToken(good))).toBe(good);
    }

    for (const bad of ["", "A", "First_Name", "1name", "_name", "na-me", "na me", `a${"b".repeat(40)}`]) {
      expect(VARIABLE_NAME.test(bad)).toBe(false);
      expect(variableInToken(variableToken(bad))).toBeNull();
    }
  });

  it.each([
    ["a plain token", "{{first_name}}", "first_name"],
    ["a token with surrounding whitespace", "  \n{{first_name}}\t ", "first_name"],
    ["padding inside the braces", "{{ first_name }}", null],
    ["words before the token", "Hello {{first_name}}", null],
    ["words after the token", "{{first_name}} there", null],
    ["two tokens", "{{a}}{{b}}", null],
    ["single braces", "{first_name}", null],
    ["an empty token", "{{}}", null],
    ["an uppercase name", "{{First_Name}}", null],
    ["a name starting with a digit", "{{1name}}", null],
  ])("reads %s as %s", (_case, token, expected) => {
    expect(variableInToken(token)).toBe(expected);
  });
});

describe("§12 — a link may stand only where the type allows one", () => {
  type HasNoLink<T> = T extends readonly (infer N)[] ? (InlineLink extends N ? false : true) : never;

  const LINK_FREE_RUNS = {
    subject: true satisfies HasNoLink<AuthoredDocument["subject"]>,
    preheader: true satisfies HasNoLink<AuthoredDocument["preheader"]>,
    eyebrow: true satisfies HasNoLink<Extract<AuthoredBlock, { kind: "eyebrow" }>["content"]>,
    heading: true satisfies HasNoLink<Extract<AuthoredBlock, { kind: "heading" }>["content"]>,
    panelLabel: true satisfies HasNoLink<PanelRow["label"]>,
    panelValue: true satisfies HasNoLink<PanelRow["value"]>,
    buttonLabel: true satisfies HasNoLink<Extract<AuthoredBlock, { kind: "button" }>["label"]>,
    linksLabel: true satisfies HasNoLink<Extract<AuthoredBlock, { kind: "links" }>["label"]>,
    linksItemLabel: true satisfies HasNoLink<LinkItem["label"]>,
    linkLabel: true satisfies HasNoLink<InlineLink["label"]>,
  } as const;

  const LINK_BEARING_RUNS = {
    lead: false satisfies HasNoLink<Extract<AuthoredBlock, { kind: "lead" }>["content"]>,
    text: false satisfies HasNoLink<Extract<AuthoredBlock, { kind: "text" }>["content"]>,
    note: false satisfies HasNoLink<Extract<AuthoredBlock, { kind: "note" }>["content"]>,
  } as const;

  it("keeps a link out of the subject, the preheader, a panel, a button and every other label", () => {
    expect(Object.values(LINK_FREE_RUNS).every((allowed) => allowed)).toBe(true);
    expect(Object.keys(LINK_FREE_RUNS)).toHaveLength(10);
  });

  it("allows a link only in a lead, a text block and a note, which are the runs that render html", () => {
    expect(Object.values(LINK_BEARING_RUNS).every((allowed) => !allowed)).toBe(true);
    expect(Object.keys(LINK_BEARING_RUNS)).toEqual(["lead", "text", "note"]);
  });
});

describe("§13 — inlineToHtml can never turn author input into markup", () => {
  it.each(HOSTILE)("escapes %s written as text", (_case, payload) => {
    const rendered = html([text(payload)]);

    expect(rendered).toBe(escape(payload));
    expect(withoutOwnTags(rendered)).not.toMatch(/[<>]/);
  });

  it.each(HOSTILE)("escapes %s written as a link label", (_case, payload) => {
    const rendered = html([link("https://wellplace.example", [text(payload)])]);

    expect(withoutOwnTags(rendered)).not.toMatch(/[<>]/);
    expect(rendered).toContain(escape(payload));
  });

  it.each(HOSTILE)("escapes %s arriving as a variable value", (_case, payload) => {
    const rendered = html([variable("message")], { message: payload });

    expect(rendered).toBe(escape(payload));
    expect(withoutOwnTags(rendered)).not.toMatch(/[<>]/);
  });

  it.each(HOSTILE)("escapes %s carried inside an address it will send", (_case, payload) => {
    const value = `https://wellplace.example/?q=${payload}`;
    const rendered = html([link(variableToken("action_url"), [text("Open")])], {
      action_url: value,
    });

    expect(rendered).toMatch(/^<a href="/);
    expect(withoutOwnTags(rendered)).not.toMatch(/[<>]/);
    expect(rendered).toContain(escape(value.trim()));
  });

  it.each(HOSTILE)("escapes %s written as a panel label and a panel value", (_case, payload) => {
    for (const rendered of [html([text(payload)]), html([strong(payload)])]) {
      expect(withoutOwnTags(rendered)).not.toMatch(/[<>]/);
    }
  });

  it.each(HOSTILE)("escapes %s written as a button label", (_case, payload) => {
    expect(withoutOwnTags(html([text(payload)]))).not.toMatch(/[<>]/);
  });

  it("cannot be closed out of the href attribute by a quote in the value", () => {
    const rendered = html([link(variableToken("action_url"), [text("Open")])], {
      action_url: 'https://wellplace.example/" onmouseover="alert(1)',
    });

    expect(rendered).toBe(
      '<a href="https://wellplace.example/&quot; onmouseover=&quot;alert(1)" style="color:#8f6529;text-decoration:underline;">Open</a>',
    );
    expect(rendered).not.toContain('" onmouseover="alert(1)"');
  });

  it("cannot be closed out of the anchor by a value that looks like a tag", () => {
    const rendered = html([link("https://wellplace.example", [variable("message")])], {
      message: '</a><img src=x onerror=alert(1)>',
    });

    expect(rendered).not.toMatch(/<img/);
    expect(rendered).toContain("&lt;/a&gt;&lt;img src=x onerror=alert(1)&gt;");
  });

  it.each([
    ["an ampersand", "&", "&amp;"],
    ["a less-than sign", "<", "&lt;"],
    ["a greater-than sign", ">", "&gt;"],
    ["a double quote", '"', "&quot;"],
    ["a single quote", "'", "&#39;"],
    ["all five together", `&<>"'`, "&amp;&lt;&gt;&quot;&#39;"],
    ["an entity, escaped once only", "&amp;", "&amp;amp;"],
    ["characters it must leave alone", "AED 1,695.00 · 14:00–18:00 é😀", "AED 1,695.00 · 14:00–18:00 é😀"],
  ])("escapes %s", (_case, input, expected) => {
    expect(escape(input)).toBe(expected);
  });

  it.each([
    ["no marks", { bold: false, italic: false, underline: false }, "word"],
    ["bold", { bold: true, italic: false, underline: false }, "<strong>word</strong>"],
    ["italic", { bold: false, italic: true, underline: false }, "<em>word</em>"],
    ["underline", { bold: false, italic: false, underline: true }, "<u>word</u>"],
    ["bold and italic", { bold: true, italic: true, underline: false }, "<em><strong>word</strong></em>"],
    ["bold and underline", { bold: true, italic: false, underline: true }, "<u><strong>word</strong></u>"],
    ["italic and underline", { bold: false, italic: true, underline: true }, "<u><em>word</em></u>"],
    ["all three", { bold: true, italic: true, underline: true }, "<u><em><strong>word</strong></em></u>"],
  ])("renders %s as exactly the tags the email client understands", (_case, marks, expected) => {
    expect(html([{ kind: "text", text: "word", ...marks }])).toBe(expected);
  });

  it("uses no styling tag beyond strong, em, u, br and a", () => {
    const rendered = html([
      { kind: "text", text: "a\nb", bold: true, italic: true, underline: true },
      link("https://wellplace.example", [text("c")]),
    ]);

    expect(withoutOwnTags(rendered)).toBe("abc");
  });

  it("escapes before it turns a newline into a line break", () => {
    expect(html([text("<b>\n</b>")])).toBe("&lt;b&gt;<br />&lt;/b&gt;");
    expect(html([strong("first\nsecond")])).toBe("<strong>first<br />second</strong>");
  });

  it("renders a link with the supplied colour and nothing else", () => {
    expect(html([link("mailto:hello@wellplace.example", [text("Write to us")])])).toBe(
      '<a href="mailto:hello@wellplace.example" style="color:#8f6529;text-decoration:underline;">Write to us</a>',
    );
  });

  it("escapes the resolved value when it lands in the href attribute", () => {
    expect(
      html([link(variableToken("action_url"), [text("Open")])], {
        action_url: "https://wellplace.example/?a&b<c",
      }),
    ).toBe(
      '<a href="https://wellplace.example/?a&amp;b&lt;c" style="color:#8f6529;text-decoration:underline;">Open</a>',
    );
  });

  it("renders an empty run as an empty string rather than anything at all", () => {
    expect(html([])).toBe("");
    expect(plain([])).toBe("");
  });
});

describe("§13 — inlineToHtml refuses to make an anchor of an address it could not send", () => {
  it.each(UNSENDABLE)("renders the label as plain words when the address is %s", (_case, href) => {
    expect(html([link(href, [text("Open")])])).toBe("Open");
  });

  it.each(UNSENDABLE)("emits no href attribute at all when the address is %s", (_case, href) => {
    const rendered = html([link(href, [text("Open")])]);

    expect(rendered).not.toContain("<a");
    expect(rendered).not.toContain("href");
  });

  it("renders a variable address with no value supplied as plain words, not a token in an attribute", () => {
    const rendered = html([link(variableToken("action_url"), [text("Open")])], {});

    expect(rendered).toBe("Open");
    expect(rendered).not.toContain("{{action_url}}");
  });

  it.each(UNSENDABLE)("refuses %s arriving as the value behind a variable address", (_case, payload) => {
    expect(html([link(variableToken("action_url"), [text("Open")])], { action_url: payload })).toBe(
      "Open",
    );
  });

  it("keeps the label's own formatting and escaping when it drops the anchor", () => {
    expect(html([link("javascript:alert(1)", [strong("Open")])])).toBe("<strong>Open</strong>");
    expect(html([link("javascript:alert(1)", [text("<script>x</script>")])])).toBe(
      "&lt;script&gt;x&lt;/script&gt;",
    );
  });

  it("leaves the parse boundary as the primary gate, which refuses the same addresses before storage", () => {
    for (const [, href] of UNSENDABLE) {
      expect(isUsableHref(href)).toBe(false);
      expect(isSendableHref(href)).toBe(false);
    }
  });
});

describe("§13 — the link colour cannot break out of the style attribute", () => {
  it.each([
    ["a quote break-out", '#fff" onmouseover="alert(1)'],
    ["a second declaration", "#fff;background:url(javascript:alert(1))"],
    ["a css expression", "expression(alert(1))"],
    ["a url function", "url(https://evil.example)"],
    ["a named colour", "red"],
    ["an rgb function", "rgb(255,0,0)"],
    ["a closing style tag", "</style><script>alert(1)</script>"],
    ["an empty string", ""],
    ["a hex with too few digits", "#ab"],
    ["a hex with too many digits", "#0123456789"],
    ["a hex with a non-hex letter", "#gggggg"],
    ["a colour with no hash", "8f6529"],
  ])("leaves the colour out of the style altogether rather than accepting %s", (_case, colour) => {
    const rendered = inlineToHtml([link("https://wellplace.example", [text("Open")])], {}, colour);

    expect(rendered).toBe(
      '<a href="https://wellplace.example" style="text-decoration:underline;">Open</a>',
    );
    expect(rendered).not.toContain("color:");
  });

  it.each([
    ["three digits", "#abc"],
    ["four digits", "#abcd"],
    ["six digits", "#8f6529"],
    ["six digits in capitals", "#8F6529"],
    ["eight digits with alpha", "#8f6529ff"],
    ["a colour with padding", "  #8f6529  "],
  ])("keeps %s", (_case, colour) => {
    expect(inlineToHtml([link("https://wellplace.example", [text("Open")])], {}, colour)).toContain(
      `style="color:${colour.trim()};text-decoration:underline;"`,
    );
  });

  it("drops a rejected colour for a link nested inside a block's own formatting", () => {
    const block: AuthoredBlock = {
      kind: "lead",
      id: "l",
      content: [link("https://wellplace.example", [strong("Book")])],
    };

    expect(compileDocument(withBlocks(block), {}, "red").blocks).toEqual([
      {
        kind: "lead",
        html: '<a href="https://wellplace.example" style="text-decoration:underline;"><strong>Book</strong></a>',
        text: "Book (https://wellplace.example)",
      },
    ]);
  });

  it("leaves the email client's own link colour in place when the colour is rejected", () => {
    const rendered = inlineToHtml([link("https://wellplace.example", [text("Open")])], {}, "");

    expect(rendered).toContain('style="text-decoration:underline;"');
    expect(rendered).not.toMatch(/color:/);
  });
});

describe("§13 — only https, mailto and a bare variable may be stored as a link", () => {
  it.each([
    ["an https address", "https://wellplace.example/book"],
    ["an https address in capitals", "HTTPS://WELLPLACE.AE/BOOK"],
    ["an https address with mixed case scheme", "HtTpS://wellplace.example"],
    ["an https address with padding", "  https://wellplace.example  "],
    ["a mailto address", "mailto:hello@wellplace.example"],
    ["a mailto address in capitals", "MAILTO:hello@wellplace.example"],
    ["a bare variable token", "{{action_url}}"],
    ["a bare variable token with padding", "  {{action_url}}  "],
  ])("accepts %s", (_case, href) => {
    expect(isUsableHref(href)).toBe(true);
  });

  it.each([
    ["plain http", "http://wellplace.example"],
    ["http in capitals", "HTTP://WELLPLACE.AE"],
    ["a javascript url", "javascript:alert(1)"],
    ["a javascript url in mixed case", "JaVaScRiPt:alert(1)"],
    ["a javascript url with padding", "   javascript:alert(1)   "],
    ["a javascript url behind a newline", "\njavascript:alert(1)"],
    ["a data url", "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="],
    ["a vbscript url", "vbscript:msgbox(1)"],
    ["a file url", "file:///etc/passwd"],
    ["a protocol-relative address", "//evil.example/steal"],
    ["a backslash protocol-relative address", "\\\\evil.example"],
    ["a site-relative path", "/book"],
    ["a bare hostname", "wellplace.example"],
    ["an https scheme with one slash", "https:/wellplace.example"],
    ["an https scheme percent-encoded", "https:%2f%2fwellplace.example"],
    ["an empty string", ""],
    ["only spaces", "   "],
    ["only whitespace characters", "\t\n\r "],
    ["a token with padding inside the braces", "{{ action_url }}"],
    ["a token with an uppercase name", "{{Action_URL}}"],
    ["a token with words around it", "https and {{action_url}}"],
    ["a token name that is too long", `{{a${"b".repeat(40)}}}`],
  ])("refuses %s", (_case, href) => {
    expect(isUsableHref(href)).toBe(false);
  });

  it.each([
    ["a scheme with no host", "https://"],
    ["a mailto with no recipient", "mailto:"],
    ["a scheme followed only by a newline", "https://\nwellplace.example"],
    ["a scheme followed only by spaces", "https://   "],
  ])("refuses %s, because a scheme alone sends nowhere", (_case, href) => {
    expect(isUsableHref(href)).toBe(false);
    expect(isSendableHref(href)).toBe(false);
  });

  it("refuses a bare variable token as a sendable address, because it is not one until it resolves", () => {
    expect(isUsableHref("{{action_url}}")).toBe(true);
    expect(isSendableHref("{{action_url}}")).toBe(false);
  });

  it.each([
    ["an https address", "https://wellplace.example"],
    ["an https address with padding", "  https://wellplace.example  "],
    ["a mailto address", "mailto:hello@wellplace.example"],
    ["an https address with one character of host", "https://a"],
  ])("accepts %s as sendable", (_case, href) => {
    expect(isSendableHref(href)).toBe(true);
  });
});

describe("§12 — a link that is a variable resolves to the value supplied for it", () => {
  it("leaves an ordinary address exactly as written", () => {
    expect(resolveHref("https://wellplace.example/book", { action_url: "https://elsewhere" })).toBe(
      "https://wellplace.example/book",
    );
  });

  it("substitutes the value behind a bare token", () => {
    expect(resolveHref(variableToken("action_url"), { action_url: "https://wellplace.example/x" })).toBe(
      "https://wellplace.example/x",
    );
  });

  it("substitutes through padding around the token", () => {
    expect(resolveHref("  {{action_url}}  ", { action_url: "https://wellplace.example/x" })).toBe(
      "https://wellplace.example/x",
    );
  });

  it("falls back to the literal token when no value was supplied", () => {
    expect(resolveHref(variableToken("action_url"), {})).toBe("{{action_url}}");
    expect(resolveHref(variableToken("action_url"), { other: "x" })).toBe("{{action_url}}");
  });

  it("returns a supplied empty value rather than the token", () => {
    expect(resolveHref(variableToken("action_url"), { action_url: "" })).toBe("");
    expect(resolveHref(variableToken("action_url"), { action_url: "   " })).toBe("");
  });

  it("trims an address whether it was written out or arrived in a value", () => {
    expect(resolveHref("  https://wellplace.example  ", {})).toBe("https://wellplace.example");
    expect(resolveHref(variableToken("action_url"), { action_url: " https://wellplace.example\n" })).toBe(
      "https://wellplace.example",
    );
  });
});

describe("§12 — inspectDocument reports every problem that would stop a message going out", () => {
  it("finds nothing wrong with a document built only from catalogue variables", () => {
    const document = withBlocks(...AUTHORED_BLOCK_KINDS.map((kind) => SAMPLE_BLOCKS[kind]));

    expect(inspectDocument(document, SAMPLE_CATALOGUE)).toEqual([]);
  });

  it.each<readonly [string, readonly LinkableNode[]]>([
    ["nothing at all", []],
    ["an empty text node", [text("")]],
    ["only spaces", [text("   ")]],
    ["only whitespace characters", [text("\n\t  ")]],
    ["several empty nodes", [text(""), text(" "), text("\t")]],
  ])("reports a subject holding %s", (_case, subject) => {
    expect(inspectDocument(doc({ subject }), SAMPLE_CATALOGUE)).toContainEqual({
      kind: "subject_blank",
    });
  });

  it("reports a document with no blocks", () => {
    expect(inspectDocument(doc({ blocks: [] }), SAMPLE_CATALOGUE)).toEqual([{ kind: "no_blocks" }]);
  });

  it.each([
    ["eyebrow", { kind: "eyebrow", id: "x", content: [text("  ")] } as AuthoredBlock],
    ["heading", { kind: "heading", id: "x", content: [] } as AuthoredBlock],
    ["lead", { kind: "lead", id: "x", content: [text("\n")] } as AuthoredBlock],
    [
      "text",
      { kind: "text", id: "x", content: [], align: "left", size: "normal" } as AuthoredBlock,
    ],
    ["note", { kind: "note", id: "x", content: [text(" ")] } as AuthoredBlock],
    [
      "lead",
      {
        kind: "lead",
        id: "x",
        content: [link("https://wellplace.example", [text("  ")])],
      } as AuthoredBlock,
    ],
    [
      "text",
      {
        kind: "text",
        id: "x",
        content: [link("https://wellplace.example", [text("")])],
        align: "left",
        size: "normal",
      } as AuthoredBlock,
    ],
    [
      "note",
      {
        kind: "note",
        id: "x",
        content: [link("mailto:hello@wellplace.example", [text(" ")])],
      } as AuthoredBlock,
    ],
    ["panel", { kind: "panel", id: "x", rows: [] } as AuthoredBlock],
    [
      "panel",
      { kind: "panel", id: "x", rows: [{ label: [text(" ")], value: [text("")] }] } as AuthoredBlock,
    ],
    ["button", { kind: "button", id: "x", label: [], href: "https://wellplace.example" } as AuthoredBlock],
    ["links", { kind: "links", id: "x", label: [text("More")], items: [] } as AuthoredBlock],
    [
      "links",
      {
        kind: "links",
        id: "x",
        label: [text("More")],
        items: [{ label: [text("  ")], href: "https://wellplace.example" }],
      } as AuthoredBlock,
    ],
  ])("reports a blank %s block by its id and kind", (kind, block) => {
    expect(inspectDocument(withBlocks(block), SAMPLE_CATALOGUE)).toContainEqual({
      kind: "block_blank",
      blockId: "x",
      block: kind,
    });
  });

  it.each([
    ["divider", SAMPLE_BLOCKS.divider],
    ["spacer", SAMPLE_BLOCKS.spacer],
    ["image", SAMPLE_BLOCKS.image],
  ])("never calls a %s block blank, because it carries no words", (_kind, block) => {
    expect(inspectDocument(withBlocks(block), SAMPLE_CATALOGUE)).toEqual([]);
  });

  it("reports a lead holding only a link with a blank label, which would ship an invisible clickable", () => {
    const block: AuthoredBlock = {
      kind: "lead",
      id: "l",
      content: [link("https://wellplace.example", [text("  ")])],
    };

    expect(isBlank(block.content)).toBe(true);
    expect(inspectDocument(withBlocks(block), SAMPLE_CATALOGUE)).toEqual([
      { kind: "block_blank", blockId: "l", block: "lead" },
    ]);
  });

  it("measures a link by its words alone, not by the address the plain-text twin prints beside them", () => {
    const nodes = [link("https://wellplace.example", [text("  ")])];

    expect(isBlank(nodes)).toBe(true);
    expect(plain(nodes)).toBe("   (https://wellplace.example)");
  });

  it("keeps a panel whose row has a label and a variable that is empty today", () => {
    const block: AuthoredBlock = {
      kind: "panel",
      id: "p",
      rows: [{ label: [text("Children")], value: [variable("children")] }],
    };

    expect(inspectDocument(withBlocks(block), ["children"])).toEqual([]);
  });

  it("names a variable that is not in this template's catalogue", () => {
    const document = doc({ subject: [variable("first_name"), variable("suite_number")] });

    expect(inspectDocument(document, ["first_name"])).toEqual([
      { kind: "unknown_variable", name: "suite_number" },
    ]);
  });

  it("names each unknown variable once and in a stable order", () => {
    const document = doc({
      subject: [variable("zebra"), variable("apple"), variable("zebra")],
      blocks: [{ kind: "heading", id: "h", content: [variable("apple")] }],
    });

    expect(inspectDocument(document, [])).toEqual([
      { kind: "unknown_variable", name: "apple" },
      { kind: "unknown_variable", name: "zebra" },
    ]);
  });

  it("names an unknown variable used only as an href", () => {
    const block: AuthoredBlock = {
      kind: "button",
      id: "b",
      label: [text("Open")],
      href: variableToken("secret_url"),
    };

    expect(inspectDocument(withBlocks(block), ["first_name"])).toEqual([
      { kind: "unknown_variable", name: "secret_url" },
    ]);
  });

  it("finds nothing wrong when every variable is in the catalogue", () => {
    const document = doc({
      subject: [text("Hello "), variable("first_name")],
      preheader: [variable("reference")],
      blocks: [SAMPLE_BLOCKS.button, SAMPLE_BLOCKS.panel],
    });

    expect(inspectDocument(document, SAMPLE_CATALOGUE)).toEqual([]);
  });

  it.each([
    [
      "a button",
      { kind: "button", id: "bad", label: [text("Pay")], href: "javascript:alert(1)" } as AuthoredBlock,
      "javascript:alert(1)",
    ],
    [
      "a links item",
      {
        kind: "links",
        id: "bad",
        label: [text("More")],
        items: [{ label: [text("Map")], href: "http://wellplace.example" }],
      } as AuthoredBlock,
      "http://wellplace.example",
    ],
    [
      "an image source",
      { kind: "image", id: "bad", src: "", alt: "Lounge", width: 520 } as AuthoredBlock,
      "",
    ],
    [
      "an image source that is a scheme alone",
      { kind: "image", id: "bad", src: "https://", alt: "Lounge", width: 520 } as AuthoredBlock,
      "https://",
    ],
    [
      "a link inside a lead",
      {
        kind: "lead",
        id: "bad",
        content: [link("//evil.example", [text("Open")])],
      } as AuthoredBlock,
      "//evil.example",
    ],
    [
      "a link inside a text block",
      {
        kind: "text",
        id: "bad",
        content: [link("data:text/html,<script>alert(1)</script>", [text("Open")])],
        align: "left",
        size: "normal",
      } as AuthoredBlock,
      "data:text/html,<script>alert(1)</script>",
    ],
    [
      "a link inside a note",
      {
        kind: "note",
        id: "bad",
        content: [text("See "), link("vbscript:msgbox(1)", [text("here")])],
      } as AuthoredBlock,
      "vbscript:msgbox(1)",
    ],
  ])("reports an unusable address on %s", (_case, block, href) => {
    expect(inspectDocument(withBlocks(block), SAMPLE_CATALOGUE)).toContainEqual({
      kind: "bad_link",
      blockId: "bad",
      href,
    });
  });

  it.each([
    ["an empty description", ""],
    ["a description of spaces", "   "],
    ["a description of whitespace", "\n\t"],
  ])("reports an image with %s", (_case, alt) => {
    const block: AuthoredBlock = {
      kind: "image",
      id: "img",
      src: "https://wellplace.example/hero.png",
      alt,
      width: 520,
    };

    expect(inspectDocument(withBlocks(block), SAMPLE_CATALOGUE)).toEqual([
      { kind: "image_without_description", blockId: "img" },
    ]);
  });

  it("says nothing about an image that has a description", () => {
    expect(inspectDocument(withBlocks(SAMPLE_BLOCKS.image), SAMPLE_CATALOGUE)).toEqual([]);
  });

  it("returns every problem in one pass rather than stopping at the first", () => {
    const document: AuthoredDocument = {
      subject: [text("  ")],
      preheader: [],
      blocks: [
        { kind: "heading", id: "h", content: [] },
        { kind: "button", id: "b", label: [text("Pay")], href: "javascript:alert(1)" },
        { kind: "image", id: "i", src: "https://wellplace.example/x.png", alt: " ", width: 520 },
        { kind: "note", id: "n", content: [variable("suite_number")] },
      ],
    };

    expect(inspectDocument(document, ["first_name"])).toEqual([
      { kind: "subject_blank" },
      { kind: "block_blank", blockId: "h", block: "heading" },
      { kind: "bad_link", blockId: "b", href: "javascript:alert(1)" },
      { kind: "image_without_description", blockId: "i" },
      { kind: "unknown_variable", name: "suite_number" },
    ]);
  });

  it("does not mind a blank preheader, which is optional", () => {
    expect(inspectDocument(doc({ preheader: [] }), SAMPLE_CATALOGUE)).toEqual([]);
    expect(inspectDocument(doc({ preheader: [text("   ")] }), SAMPLE_CATALOGUE)).toEqual([]);
  });
});

describe("§12 — compileDocument substitutes the values and drops what has nothing to say", () => {
  it("substitutes into the subject and the preheader", () => {
    const document = doc({
      subject: [text("Hello "), variable("first_name"), text(" — "), variable("reference")],
      preheader: [variable("amount"), text(" paid")],
    });

    const compiled = compile(document, {
      first_name: "Layla",
      reference: "WP-4821",
      amount: "AED 1,695.00",
    });

    expect(compiled.subject).toBe("Hello Layla — WP-4821");
    expect(compiled.preheader).toBe("AED 1,695.00 paid");
  });

  it("prints the literal token when a value is missing, never undefined and never nothing", () => {
    const compiled = compile(doc({ subject: [text("Hello "), variable("first_name")] }), {});

    expect(compiled.subject).toBe("Hello {{first_name}}");
    expect(compiled.subject).not.toContain("undefined");
  });

  it("prints nothing when an empty value was deliberately supplied", () => {
    const compiled = compile(doc({ subject: [text("Hello "), variable("first_name")] }), {
      first_name: "",
    });

    expect(compiled.subject).toBe("Hello ");
  });

  it("substitutes into every block that carries words", () => {
    const document = withBlocks(
      { kind: "eyebrow", id: "1", content: [variable("first_name")] },
      { kind: "heading", id: "2", content: [variable("first_name")] },
      { kind: "lead", id: "3", content: [variable("first_name")] },
      { kind: "text", id: "4", content: [variable("first_name")], align: "left", size: "normal" },
      { kind: "note", id: "5", content: [variable("first_name")] },
      {
        kind: "panel",
        id: "6",
        rows: [{ label: [text("Guest")], value: [variable("first_name")] }],
      },
      { kind: "button", id: "7", label: [variable("first_name")], href: variableToken("receipt_url") },
      {
        kind: "links",
        id: "8",
        label: [variable("first_name")],
        items: [{ label: [variable("first_name")], href: variableToken("receipt_url") }],
      },
      { kind: "image", id: "9", src: variableToken("receipt_url"), alt: "Receipt", width: 520 },
    );

    expect(compile(document, SAMPLE_VALUES).blocks).toEqual([
      { kind: "eyebrow", text: "Layla" },
      { kind: "heading", text: "Layla" },
      { kind: "lead", html: "Layla", text: "Layla" },
      { kind: "rich", html: "Layla", text: "Layla", align: "left", size: "normal" },
      { kind: "note", html: "Layla", text: "Layla" },
      { kind: "panel", rows: [{ label: "Guest", value: "Layla" }] },
      { kind: "button", label: "Layla", href: "https://wellplace.example/book/receipt/abc" },
      {
        kind: "links",
        label: "Layla",
        items: [{ label: "Layla", href: "https://wellplace.example/book/receipt/abc" }],
      },
      {
        kind: "image",
        src: "https://wellplace.example/book/receipt/abc",
        alt: "Receipt",
        width: 520,
      },
    ]);
  });

  it("compiles a text block to a rich block carrying both renderings", () => {
    const block: AuthoredBlock = {
      kind: "text",
      id: "t",
      content: [text("See "), link("https://wellplace.example", [strong("the map")])],
      align: "center",
      size: "large",
    };

    expect(compile(withBlocks(block)).blocks[0]).toEqual({
      kind: "rich",
      html: 'See <a href="https://wellplace.example" style="color:#8f6529;text-decoration:underline;"><strong>the map</strong></a>',
      text: "See the map (https://wellplace.example)",
      align: "center",
      size: "large",
    });
  });

  it.each(
    BLOCK_ALIGNMENTS.flatMap((align) => TEXT_SIZES.map((size) => [align, size] as const)),
  )("carries alignment %s and size %s onto the compiled rich block", (align, size) => {
    const block: AuthoredBlock = { kind: "text", id: "t", content: [text("word")], align, size };

    expect(compile(withBlocks(block)).blocks[0]).toEqual({
      kind: "rich",
      html: "word",
      text: "word",
      align,
      size,
    });
  });

  it("drops a panel row whose value resolves blank and keeps the rest", () => {
    const block: AuthoredBlock = {
      kind: "panel",
      id: "p",
      rows: [
        { label: [text("Reference")], value: [variable("reference")] },
        { label: [text("Children")], value: [variable("children")] },
        { label: [text("Adults")], value: [variable("adults")] },
      ],
    };

    expect(compile(withBlocks(block), { reference: "WP-4821", children: "", adults: "2" }).blocks).toEqual([
      { kind: "panel", rows: [{ label: "Reference", value: "WP-4821" }, { label: "Adults", value: "2" }] },
    ]);
  });

  it.each([
    ["an empty value", ""],
    ["a value of spaces", "   "],
    ["a value of whitespace", "\n\t"],
  ])("drops a panel row whose value is %s", (_case, value) => {
    const block: AuthoredBlock = {
      kind: "panel",
      id: "p",
      rows: [{ label: [text("Children")], value: [variable("children")] }],
    };

    expect(compile(withBlocks(block), { children: value }).blocks).toEqual([]);
  });

  it("keeps a panel row whose label is blank but whose value is not", () => {
    const block: AuthoredBlock = {
      kind: "panel",
      id: "p",
      rows: [{ label: [], value: [text("Standing alone")] }],
    };

    expect(compile(withBlocks(block)).blocks).toEqual([
      { kind: "panel", rows: [{ label: "", value: "Standing alone" }] },
    ]);
  });

  it("removes a panel entirely once every one of its rows has dropped", () => {
    const block: AuthoredBlock = {
      kind: "panel",
      id: "p",
      rows: [
        { label: [text("Children")], value: [variable("children")] },
        { label: [text("Refund")], value: [variable("refund_amount")] },
      ],
    };

    expect(compile(withBlocks(block), { children: "", refund_amount: " " }).blocks).toEqual([]);
  });

  it("removes a panel that was authored with no rows at all", () => {
    expect(compile(withBlocks({ kind: "panel", id: "p", rows: [] })).blocks).toEqual([]);
  });

  it("removes a links block that has no items", () => {
    const block: AuthoredBlock = { kind: "links", id: "l", label: [text("More")], items: [] };

    expect(compile(withBlocks(block)).blocks).toEqual([]);
  });

  it("keeps the surviving blocks in the order they were authored", () => {
    const document = withBlocks(
      SAMPLE_BLOCKS.eyebrow,
      { kind: "panel", id: "gone", rows: [] },
      SAMPLE_BLOCKS.divider,
      { kind: "links", id: "also-gone", label: [text("More")], items: [] },
      SAMPLE_BLOCKS.spacer,
    );

    expect(compile(document).blocks.map((block) => block.kind)).toEqual([
      "eyebrow",
      "divider",
      "spacer",
    ]);
  });

  it.each([
    ["a divider", SAMPLE_BLOCKS.divider, { kind: "divider" }],
    ["a spacer", SAMPLE_BLOCKS.spacer, { kind: "spacer", height: SPACER_HEIGHT.fallback }],
    [
      "an image",
      SAMPLE_BLOCKS.image,
      {
        kind: "image",
        src: "https://wellplace.example/email/arrival.png",
        alt: "The arrival lounge at dusk",
        width: IMAGE_WIDTH.fallback,
      },
    ],
  ])("carries %s through unchanged", (_case, block, expected) => {
    expect(compile(withBlocks(block)).blocks).toEqual([expected]);
  });

  it("compiles every block kind the model defines", () => {
    const document = withBlocks(...AUTHORED_BLOCK_KINDS.map((kind) => SAMPLE_BLOCKS[kind]));

    expect(compile(document, SAMPLE_VALUES).blocks.map((block) => block.kind)).toEqual([
      "layout", "layout", "layout", "layout", "video", "button", "html",
      "eyebrow",
      "heading",
      "lead",
      "rich",
      "note",
      "panel",
      "button",
      "links",
      "divider",
      "spacer",
      "image",
    ]);
  });

  it("lists every block kind exactly once, with no kind missing", () => {
    expect([...AUTHORED_BLOCK_KINDS].sort()).toEqual(Object.keys(SAMPLE_BLOCKS).sort());
    expect(new Set(AUTHORED_BLOCK_KINDS).size).toBe(AUTHORED_BLOCK_KINDS.length);
  });

  it("lists every alignment and every size exactly once", () => {
    expect(BLOCK_ALIGNMENTS).toEqual(["left", "center", "right"]);
    expect(TEXT_SIZES).toEqual(["small", "normal", "large"]);
  });

  it("compiles an empty document to an empty document", () => {
    expect(compile({ subject: [], preheader: [], blocks: [] })).toEqual({
      subject: "",
      preheader: "",
      blocks: [],
    });
  });
});

describe("§12 — an image compiles away rather than sending a broken picture", () => {
  const imageBlock: AuthoredBlock = {
    kind: "image",
    id: "img",
    src: variableToken("receipt_url"),
    alt: "Your receipt",
    width: 520,
  };

  it("substitutes the supplied value into the compiled image source", () => {
    expect(inspectDocument(withBlocks(imageBlock), ["receipt_url"])).toEqual([]);
    expect(compile(withBlocks(imageBlock), { receipt_url: "https://wellplace.example/hero.png" }).blocks).toEqual([
      { kind: "image", src: "https://wellplace.example/hero.png", alt: "Your receipt", width: 520 },
    ]);
  });

  it.each(UNSENDABLE_VALUES)("drops the whole image block when %s", (_case, values) => {
    expect(compile(withBlocks(imageBlock), values).blocks).toEqual([]);
  });

  it("never leaves an unresolved token in a compiled image source", () => {
    const compiled = compile(withBlocks(imageBlock), {});

    expect(compiled.blocks).toEqual([]);
    expect(JSON.stringify(compiled)).not.toContain("{{receipt_url}}");
  });

  it("trims a written-out source and keeps the block", () => {
    const block: AuthoredBlock = {
      kind: "image",
      id: "img",
      src: "  https://wellplace.example/hero.png  ",
      alt: "Lounge",
      width: 520,
    };

    expect(compile(withBlocks(block)).blocks).toEqual([
      { kind: "image", src: "https://wellplace.example/hero.png", alt: "Lounge", width: 520 },
    ]);
  });

  it("keeps the surrounding blocks when only the image drops", () => {
    const document = withBlocks(SAMPLE_BLOCKS.eyebrow, imageBlock, SAMPLE_BLOCKS.divider);

    expect(compile(document).blocks.map((block) => block.kind)).toEqual(["eyebrow", "divider"]);
  });
});

describe("§12 — a button drops rather than shipping a dead or hostile primary action", () => {
  const buttonBlock: AuthoredBlock = {
    kind: "button",
    id: "b",
    label: [text("View your receipt")],
    href: variableToken("receipt_url"),
  };

  it("keeps the button when its address resolves to one the renderer can send", () => {
    expect(compile(withBlocks(buttonBlock), SAMPLE_VALUES).blocks).toEqual([
      {
        kind: "button",
        label: "View your receipt",
        href: "https://wellplace.example/book/receipt/abc",
      },
    ]);
  });

  it.each(UNSENDABLE_VALUES)("drops the whole button when %s", (_case, values) => {
    expect(compile(withBlocks(buttonBlock), values).blocks).toEqual([]);
  });

  it.each(UNSENDABLE)("drops a button whose author wrote %s straight into it", (_case, href) => {
    const block: AuthoredBlock = { kind: "button", id: "b", label: [text("Pay")], href };

    expect(compile(withBlocks(block)).blocks).toEqual([]);
  });

  it("never leaves an unresolved token in a compiled button href", () => {
    const compiled = compile(withBlocks(buttonBlock), {});

    expect(compiled.blocks).toEqual([]);
    expect(JSON.stringify(compiled)).not.toContain("{{receipt_url}}");
  });

  it("keeps the surrounding blocks when only the button drops", () => {
    const document = withBlocks(SAMPLE_BLOCKS.eyebrow, buttonBlock, SAMPLE_BLOCKS.divider);

    expect(compile(document, {}).blocks.map((block) => block.kind)).toEqual(["eyebrow", "divider"]);
  });
});

describe("§12 — a links block keeps the items it can send and drops the rest", () => {
  const mixed: AuthoredBlock = {
    kind: "links",
    id: "l",
    label: [text("Useful links")],
    items: [
      { label: [text("Directions")], href: "https://wellplace.example/contact" },
      { label: [text("Your receipt")], href: variableToken("receipt_url") },
      { label: [text("Old site")], href: "http://wellplace.example" },
      { label: [text("Write to us")], href: "mailto:hello@wellplace.example" },
    ],
  };

  it("drops only the items whose address it cannot send", () => {
    expect(compile(withBlocks(mixed), {}).blocks).toEqual([
      {
        kind: "links",
        label: "Useful links",
        items: [
          { label: "Directions", href: "https://wellplace.example/contact" },
          { label: "Write to us", href: "mailto:hello@wellplace.example" },
        ],
      },
    ]);
  });

  it("keeps an item once its variable resolves", () => {
    expect(compile(withBlocks(mixed), SAMPLE_VALUES).blocks).toEqual([
      {
        kind: "links",
        label: "Useful links",
        items: [
          { label: "Directions", href: "https://wellplace.example/contact" },
          { label: "Your receipt", href: "https://wellplace.example/book/receipt/abc" },
          { label: "Write to us", href: "mailto:hello@wellplace.example" },
        ],
      },
    ]);
  });

  it.each(UNSENDABLE_VALUES)("drops the whole links block when every item fails and %s", (_case, values) => {
    const block: AuthoredBlock = {
      kind: "links",
      id: "l",
      label: [text("Useful links")],
      items: [
        { label: [text("Your receipt")], href: variableToken("receipt_url") },
        { label: [text("Old site")], href: "http://wellplace.example" },
      ],
    };

    expect(compile(withBlocks(block), values).blocks).toEqual([]);
  });

  it("never leaves an unresolved token in a compiled links item href", () => {
    const compiled = compile(withBlocks(mixed), {});

    expect(JSON.stringify(compiled)).not.toContain("{{receipt_url}}");
  });

  it("keeps the surrounding blocks when only the links block drops", () => {
    const block: AuthoredBlock = {
      kind: "links",
      id: "l",
      label: [text("More")],
      items: [{ label: [text("Old site")], href: "http://wellplace.example" }],
    };
    const document = withBlocks(SAMPLE_BLOCKS.eyebrow, block, SAMPLE_BLOCKS.divider);

    expect(compile(document).blocks.map((entry) => entry.kind)).toEqual(["eyebrow", "divider"]);
  });
});

describe("§12 — compiled plain fields are author text, escaped later by the renderer", () => {
  it.each(HOSTILE)("hands %s back verbatim in a plain field and escaped in an html one", (_case, payload) => {
    const document = withBlocks(
      { kind: "eyebrow", id: "1", content: [text(payload)] },
      { kind: "heading", id: "2", content: [text(payload)] },
      { kind: "note", id: "3", content: [text(payload)] },
      { kind: "panel", id: "4", rows: [{ label: [text(payload)], value: [text(payload)] }] },
      { kind: "button", id: "5", label: [text(payload)], href: "https://wellplace.example" },
      {
        kind: "links",
        id: "6",
        label: [text(payload)],
        items: [{ label: [text(payload)], href: "https://wellplace.example" }],
      },
      { kind: "image", id: "7", src: "https://wellplace.example/x.png", alt: payload, width: 520 },
    );

    expect(compile(document).blocks).toEqual([
      { kind: "eyebrow", text: payload },
      { kind: "heading", text: payload },
      { kind: "note", html: escape(payload), text: payload },
      { kind: "panel", rows: [{ label: payload, value: payload }] },
      { kind: "button", label: payload, href: "https://wellplace.example" },
      { kind: "links", label: payload, items: [{ label: payload, href: "https://wellplace.example" }] },
      { kind: "image", src: "https://wellplace.example/x.png", alt: payload, width: 520 },
    ]);
  });

  it("escapes the same input the moment it goes through the html rendering instead", () => {
    const document = withBlocks({
      kind: "lead",
      id: "l",
      content: [text("<script>alert(1)</script>")],
    });

    expect(compile(document).blocks).toEqual([
      {
        kind: "lead",
        html: "&lt;script&gt;alert(1)&lt;/script&gt;",
        text: "<script>alert(1)</script>",
      },
    ]);
  });

  it("gives an eyebrow and a heading plain text only, because neither can hold a link", () => {
    const document = withBlocks(SAMPLE_BLOCKS.eyebrow, SAMPLE_BLOCKS.heading);

    expect(compile(document, SAMPLE_VALUES).blocks).toEqual([
      { kind: "eyebrow", text: "Booking confirmed" },
      { kind: "heading", text: "You’re booked, Layla" },
    ]);
  });
});

describe("§12 — a link inside a note survives into the message", () => {
  it("keeps the anchor in the html and the address in the plain text", () => {
    const block: AuthoredBlock = {
      kind: "note",
      id: "n",
      content: [text("See "), link("https://wellplace.example/contact", [strong("directions")])],
    };

    expect(compile(withBlocks(block)).blocks).toEqual([
      {
        kind: "note",
        html: 'See <a href="https://wellplace.example/contact" style="color:#8f6529;text-decoration:underline;"><strong>directions</strong></a>',
        text: "See directions (https://wellplace.example/contact)",
      },
    ]);
  });

  it("keeps a note's bold, italic and underline instead of flattening them", () => {
    const block: AuthoredBlock = {
      kind: "note",
      id: "n",
      content: [{ kind: "text", text: "important", bold: true, italic: true, underline: true }],
    };

    expect(compile(withBlocks(block)).blocks).toEqual([
      { kind: "note", html: "<u><em><strong>important</strong></em></u>", text: "important" },
    ]);
  });

  it("gives a lead and a note the same pair of renderings from the same content", () => {
    const content: readonly InlineNode[] = [
      text("See "),
      link(variableToken("receipt_url"), [text("your receipt")]),
    ];

    expect(
      compile(
        withBlocks({ kind: "lead", id: "l", content }, { kind: "note", id: "n", content }),
        SAMPLE_VALUES,
      ).blocks,
    ).toEqual([
      { kind: "lead", html: html(content, SAMPLE_VALUES), text: plain(content, SAMPLE_VALUES) },
      { kind: "note", html: html(content, SAMPLE_VALUES), text: plain(content, SAMPLE_VALUES) },
    ]);
  });

  it("drops the anchor inside a note when the address is one it cannot send", () => {
    const block: AuthoredBlock = {
      kind: "note",
      id: "n",
      content: [text("See "), link("javascript:alert(1)", [text("here")])],
    };

    expect(compile(withBlocks(block)).blocks).toEqual([
      { kind: "note", html: "See here", text: "See here" },
    ]);
  });
});

describe("§12 — the plain-text twin carries a link's address so the reader can follow it", () => {
  it("prints the words and then the address", () => {
    expect(plain([link("https://wellplace.example/book/receipt/abc", [text("View your receipt")])])).toBe(
      "View your receipt (https://wellplace.example/book/receipt/abc)",
    );
  });

  it("resolves a variable address before printing it", () => {
    expect(
      plain([link(variableToken("receipt_url"), [text("View your receipt")])], SAMPLE_VALUES),
    ).toBe("View your receipt (https://wellplace.example/book/receipt/abc)");
  });

  it.each([
    ["an empty address", "", {}],
    ["an address of spaces", "   ", {}],
    ["a variable resolving to nothing", variableToken("action_url"), { action_url: "" }],
  ])("prints the words alone when the link has %s", (_case, href, values) => {
    expect(plain([link(href, [text("Open")])], values)).toBe("Open");
  });

  it("does not repeat an address the author already wrote out as the words", () => {
    expect(plain([link("https://wellplace.example", [text("https://wellplace.example")])])).toBe(
      "https://wellplace.example",
    );
    expect(plain([link("  https://wellplace.example  ", [text("https://wellplace.example")])])).toBe(
      "https://wellplace.example",
    );
  });

  it("carries no markup alongside the address", () => {
    const nodes = [link("https://wellplace.example", [strong("Book")])];

    expect(plain(nodes)).toBe("Book (https://wellplace.example)");
    expect(plain(nodes)).not.toMatch(/[<>]/);
  });

  it.each(UNSENDABLE)("prints the words alone for %s, exactly as the html rendering does", (_case, href) => {
    expect(plain([link(href, [text("Open")])])).toBe("Open");
    expect(html([link(href, [text("Open")])])).toBe("Open");
  });

  it("prints the words alone for an unresolved token, exactly as the html rendering does", () => {
    expect(plain([link(variableToken("action_url"), [text("Open")])], {})).toBe("Open");
    expect(html([link(variableToken("action_url"), [text("Open")])], {})).toBe("Open");
  });

  it.each([
    ["an https address", "https://wellplace.example/book", true],
    ["an https address with padding", "  https://wellplace.example/book  ", true],
    ["a mailto address", "mailto:hello@wellplace.example", true],
    ["a javascript url", "javascript:alert(1)", false],
    ["a data url", "data:text/html,<script>alert(1)</script>", false],
    ["a vbscript url", "vbscript:msgbox(1)", false],
    ["plain http", "http://wellplace.example", false],
    ["a protocol-relative address", "//evil.example", false],
    ["a site-relative path", "/book", false],
    ["a bare hostname", "wellplace.example", false],
    ["an empty address", "", false],
    ["a scheme alone", "https://", false],
    ["an unresolved variable", variableToken("action_url"), false],
  ])(
    "prints %s in the plain part exactly when the html part made an anchor of it",
    (_case, href, sendable) => {
      const nodes = [link(href, [text("Open")])];
      const resolved = resolveHref(href, {});

      expect(html(nodes).includes("<a href=")).toBe(sendable);
      expect(plain(nodes)).toBe(sendable ? `Open (${resolved})` : "Open");
    },
  );
});

describe("§12 — inlineToText is the plain-text twin of the same nodes", () => {
  it("carries no markup of any kind, however the author formatted it", () => {
    const nodes: readonly InlineNode[] = [
      { kind: "text", text: "Arrive at ", bold: true, italic: true, underline: true },
      variable("starts_at"),
      text(" — see "),
      link("https://wellplace.example/contact", [strong("directions")]),
    ];

    expect(plain(nodes, { starts_at: "14:00" })).toBe(
      "Arrive at 14:00 — see directions (https://wellplace.example/contact)",
    );
    expect(plain(nodes, { starts_at: "14:00" })).not.toMatch(/[<>]/);
  });

  it("resolves a variable exactly as the html rendering does, without escaping it", () => {
    const nodes = [variable("message")];
    const values = { message: '<b>Tom & "Jerry"</b>' };

    expect(plain(nodes, values)).toBe('<b>Tom & "Jerry"</b>');
    expect(html(nodes, values)).toBe("&lt;b&gt;Tom &amp; &quot;Jerry&quot;&lt;/b&gt;");
  });

  it("keeps a newline as a newline where the html rendering makes a line break", () => {
    expect(plain([text("first\nsecond")])).toBe("first\nsecond");
    expect(html([text("first\nsecond")])).toBe("first<br />second");
  });

  it("falls back to the literal token for a missing value, as the html rendering does", () => {
    expect(plain([variable("first_name")], {})).toBe("{{first_name}}");
    expect(html([variable("first_name")], {})).toBe("{{first_name}}");
  });

  it("agrees with isBlank about what counts as empty", () => {
    expect(isBlank([])).toBe(true);
    expect(isBlank([text("")])).toBe(true);
    expect(isBlank([text(" \n\t ")])).toBe(true);
    expect(isBlank([text("."), text(" ")])).toBe(false);
    expect(isBlank([link("", [text("  ")])])).toBe(true);
    expect(isBlank([link("https://wellplace.example", [text("  ")])])).toBe(true);
    expect(isBlank([link("https://wellplace.example", [text("Open")])])).toBe(false);
  });

  it("builds the node shapes the editor hands it", () => {
    expect(text("a")).toEqual({ kind: "text", text: "a", bold: false, italic: false, underline: false });
    expect(strong("a")).toEqual({ kind: "text", text: "a", bold: true, italic: false, underline: false });
    expect(variable("a")).toEqual({ kind: "variable", name: "a" });
    expect(link("https://x.ae", [text("a")])).toEqual({
      kind: "link",
      href: "https://x.ae",
      label: [text("a")],
    });
    expect(variableToken("first_name")).toBe("{{first_name}}");
  });
});
