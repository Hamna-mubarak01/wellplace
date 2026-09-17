import { describe, expect, it } from "vitest";

import {
  MESSAGE_AUDIENCES,
  MESSAGE_DOCUMENT_GROUPS,
  MESSAGE_DOCUMENT_LIMITS,
  SYSTEM_MESSAGES,
  SYSTEM_MESSAGE_KEYS,
  TEST_RECIPIENT_HINT,
  defaultDocument,
  isSystemMessageKey,
  messageSpec,
  sampleValues,
  variableCatalogue,
  type SystemMessageKey,
} from "@/lib/config/message-documents";
import {
  VARIABLE_NAME,
  compileDocument,
  documentVariables,
  inspectDocument,
  isSendableHref,
  variableInToken,
  type AuthoredDocument,
  type CompiledDocument,
} from "@/lib/domain/email/document";
import { authoredDocumentSchema, readyToPublish } from "@/lib/validation/message-document";

const COLOUR = "#8f6529";

const CONNECTED_TODAY: readonly SystemMessageKey[] = [
  "waitlist_confirmation",
  "waitlist_signup_notification",
  "staff_invitation",
  "staff_password_reset",
  "contact_acknowledgement",
  "contact_notification",
  "booking_confirmation",
  "payment_failed",
  "refund_issued",
  "invoice_issued",
];

const KEYS_WITH_A_CODED_DEFAULT: readonly SystemMessageKey[] = [
  "waitlist_confirmation",
  "waitlist_signup_notification",
  "staff_invitation",
  "staff_password_reset",
  "contact_acknowledgement",
  "contact_notification",
  "booking_confirmation",
  "payment_failed",
  "refund_issued",
];

const withDefaults = KEYS_WITH_A_CODED_DEFAULT.map(
  (key) => [key, defaultDocument(key) as AuthoredDocument] as const,
);

function compiledStrings(document: CompiledDocument): readonly string[] {
  const found: string[] = [document.subject, document.preheader];

  for (const block of document.blocks) {
    switch (block.kind) {
      case "eyebrow":
      case "heading":
        found.push(block.text);
        break;
      case "lead":
      case "note":
      case "rich":
        found.push(block.html, block.text);
        break;
      case "panel":
        for (const row of block.rows) found.push(row.label, row.value);
        break;
      case "button":
        found.push(block.label, block.href);
        break;
      case "links":
        found.push(block.label);
        for (const item of block.items) found.push(item.label, item.href);
        break;
      case "image":
        found.push(block.src, block.alt);
        break;
      case "divider":
      case "spacer":
        break;
    }
  }

  return found;
}

function compiledHrefs(document: CompiledDocument): readonly string[] {
  return document.blocks.flatMap((block) => {
    if (block.kind === "button") return [block.href];
    if (block.kind === "links") return block.items.map((item) => item.href);
    if (block.kind === "image") return [block.src];
    return [];
  });
}

describe("§12 — the template list and the specs describe exactly the same set of messages", () => {
  it("gives every key a spec", () => {
    for (const key of SYSTEM_MESSAGE_KEYS) {
      expect(messageSpec(key).key).toBe(key);
    }
  });

  it("keeps every spec's key in the list, and lists each key once", () => {
    expect([...SYSTEM_MESSAGES.map((spec) => spec.key)].sort()).toEqual([...SYSTEM_MESSAGE_KEYS].sort());
    expect(new Set(SYSTEM_MESSAGE_KEYS).size).toBe(SYSTEM_MESSAGE_KEYS.length);
    expect(SYSTEM_MESSAGES).toHaveLength(SYSTEM_MESSAGE_KEYS.length);
  });

  it("refuses a key it does not know rather than returning something empty", () => {
    expect(() => messageSpec("not_a_template" as SystemMessageKey)).toThrow(
      "Unknown message template: not_a_template",
    );
  });

  it.each(SYSTEM_MESSAGE_KEYS)("recognises %s as a template key", (key) => {
    expect(isSystemMessageKey(key)).toBe(true);
  });

  it.each([
    ["an empty string", ""],
    ["a near miss", "booking_confirmed"],
    ["a key in capitals", "BOOKING_CONFIRMATION"],
    ["a key with padding", " booking_confirmation "],
    ["a prototype member", "constructor"],
  ])("does not recognise %s as a template key", (_case, value) => {
    expect(isSystemMessageKey(value)).toBe(false);
  });

  it.each(SYSTEM_MESSAGES.map((spec) => [spec.key, spec] as const))(
    "describes %s with a group, an audience and a trigger a manager can read",
    (_key, spec) => {
      expect(spec.label.trim().length).toBeGreaterThan(0);
      expect(spec.trigger.trim().length).toBeGreaterThan(0);
      expect(MESSAGE_DOCUMENT_GROUPS.map((group) => group.value)).toContain(spec.group);
      expect(MESSAGE_AUDIENCES).toContain(spec.audience);
    },
  );

  it("uses every declared group, so no group renders as an empty section", () => {
    const used = new Set(SYSTEM_MESSAGES.map((spec) => spec.group));

    expect([...MESSAGE_DOCUMENT_GROUPS.map((group) => group.value)].sort()).toEqual([...used].sort());
  });

  it("sends exactly four templates to the operations mailbox rather than to a guest", () => {
    const staff = SYSTEM_MESSAGES.filter((spec) => spec.audience === "staff").map((spec) => spec.key);

    expect([...staff].sort()).toEqual([
      "contact_notification",
      "staff_invitation",
      "staff_password_reset",
      "waitlist_signup_notification",
    ]);
  });
});

describe("§12 — a template's variable catalogue is what the editor may offer and the preview must resolve", () => {
  it.each(SYSTEM_MESSAGES.map((spec) => [spec.key, spec] as const))(
    "gives %s variable names the token grammar accepts, each named once",
    (_key, spec) => {
      const names = spec.variables.map((entry) => entry.name);

      for (const name of names) {
        expect(VARIABLE_NAME.test(name)).toBe(true);
      }

      expect(new Set(names).size).toBe(names.length);
    },
  );

  it.each(SYSTEM_MESSAGES.map((spec) => [spec.key, spec] as const))(
    "gives every %s variable a label and a sample a manager can recognise",
    (_key, spec) => {
      for (const entry of spec.variables) {
        expect(entry.label.trim().length).toBeGreaterThan(0);
        expect(entry.sample.trim().length).toBeGreaterThan(0);
      }
    },
  );

  it.each(SYSTEM_MESSAGE_KEYS)("returns the declared names in order for %s", (key) => {
    expect(variableCatalogue(key)).toEqual(messageSpec(key).variables.map((entry) => entry.name));
  });

  it.each(SYSTEM_MESSAGE_KEYS)(
    "covers exactly the declared variables of %s with sample values, so preview never shows a token",
    (key) => {
      const catalogue = variableCatalogue(key);
      const samples = sampleValues(key);

      expect(Object.keys(samples).sort()).toEqual([...catalogue].sort());
      expect(Object.keys(samples)).toHaveLength(catalogue.length);

      for (const name of catalogue) {
        expect(samples[name]).toBe(messageSpec(key).variables.find((entry) => entry.name === name)?.sample);
      }
    },
  );

  it("gives no sample a token of its own, which would print unresolved in a preview", () => {
    for (const key of SYSTEM_MESSAGE_KEYS) {
      for (const value of Object.values(sampleValues(key))) {
        expect(value).not.toContain("{{");
      }
    }
  });
});

describe("§12 — no coded default can send a blank or broken transactional email", () => {
  it("supplies a document for exactly the templates that are authored rather than coded", () => {
    const supplied = SYSTEM_MESSAGE_KEYS.filter((key) => defaultDocument(key) !== null);

    expect([...supplied].sort()).toEqual([...KEYS_WITH_A_CODED_DEFAULT].sort());
  });

  it.each(SYSTEM_MESSAGE_KEYS)("answers for %s with a document or an explicit null, never undefined", (key) => {
    expect(defaultDocument(key)).not.toBeUndefined();
  });

  it.each(withDefaults)("finds no problem at all in the default for %s", (key, document) => {
    expect(inspectDocument(document, variableCatalogue(key))).toEqual([]);
  });

  it.each(withDefaults)("passes the default for %s through the publish gate the console uses", (key, document) => {
    expect(readyToPublish(key, document)).toEqual({ ok: true });
  });

  it.each(withDefaults)("uses only catalogue variables in the default for %s", (key, document) => {
    const catalogue = variableCatalogue(key);

    for (const name of documentVariables(document)) {
      expect(catalogue).toContain(name);
    }
  });

  it.each(withDefaults)("leaves no unresolved token anywhere in the compiled default for %s", (key, document) => {
    const compiled = compileDocument(document, sampleValues(key), COLOUR);

    for (const value of compiledStrings(compiled)) {
      expect(value).not.toContain("{{");
      expect(value).not.toContain("undefined");
    }
  });

  it.each(withDefaults)("keeps every block of the default for %s in the compiled preview", (key, document) => {
    const compiled = compileDocument(document, sampleValues(key), COLOUR);

    expect(compiled.blocks).toHaveLength(document.blocks.length);
  });

  it.each(withDefaults)("resolves every address in the default for %s to one the renderer can send", (key, document) => {
    const compiled = compileDocument(document, sampleValues(key), COLOUR);

    for (const href of compiledHrefs(compiled)) {
      expect(isSendableHref(href)).toBe(true);
    }
  });

  it.each(withDefaults)("keeps every button of the default for %s, so no message loses its action", (key, document) => {
    const authored = document.blocks.filter((block) => block.kind === "button");
    const compiled = compileDocument(document, sampleValues(key), COLOUR).blocks.filter(
      (block) => block.kind === "button",
    );

    expect(compiled).toHaveLength(authored.length);
    for (const block of compiled) {
      expect(isSendableHref(block.href)).toBe(true);
    }
  });

  it.each(withDefaults)("draws every button address of the default for %s from its own catalogue", (key, document) => {
    const catalogue = variableCatalogue(key);

    for (const block of document.blocks) {
      if (block.kind !== "button") continue;

      const name = variableInToken(block.href);
      if (name === null) {
        expect(isSendableHref(block.href)).toBe(true);
        continue;
      }

      expect(catalogue).toContain(name);
      expect(isSendableHref(sampleValues(key)[name])).toBe(true);
    }
  });

  it("gives the staff invitation and the waitlist notification a button that survives compilation", () => {
    for (const key of ["staff_invitation", "waitlist_signup_notification"] as const) {
      const document = defaultDocument(key) as AuthoredDocument;
      const compiled = compileDocument(document, sampleValues(key), COLOUR);

      expect(compiled.blocks.filter((block) => block.kind === "button")).toHaveLength(1);
    }
  });

  it.each(withDefaults)("gives the default for %s a subject and at least one block", (_key, document) => {
    expect(document.subject.length).toBeGreaterThan(0);
    expect(document.blocks.length).toBeGreaterThan(0);
  });

  it.each(withDefaults)("compiles the default for %s to at least one block with sample values", (key, document) => {
    const compiled = compileDocument(document, sampleValues(key), COLOUR);

    expect(compiled.subject.trim().length).toBeGreaterThan(0);
    expect(compiled.blocks.length).toBeGreaterThan(0);
  });

  it.each(withDefaults)("gives every block in the default for %s its own id", (_key, document) => {
    const ids = document.blocks.map((block) => block.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id.trim().length).toBeGreaterThan(0);
    }
  });

  it("gives no two defaults a block id in common, so one editor cannot collide with another", () => {
    const ids = withDefaults.flatMap(([, document]) => document.blocks.map((block) => block.id));

    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(withDefaults)("keeps the default for %s within what the schema will store", (_key, document) => {
    const parsed = authoredDocumentSchema.safeParse(document);

    expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
    expect(parsed.success).toBe(true);
  });
});

describe("§12 — connected says an email for that template leaves the building today", () => {
  it("marks exactly the templates with a live send path", () => {
    const connected = SYSTEM_MESSAGES.filter((spec) => spec.connected).map((spec) => spec.key);

    expect([...connected].sort()).toEqual([...CONNECTED_TODAY].sort());
  });

  it("tells a manager plainly when nothing is connected yet", () => {
    for (const spec of SYSTEM_MESSAGES) {
      if (spec.connected) continue;
      expect(spec.trigger).toContain("No send path is connected yet");
    }
  });

  it("describes the moment of sending for every connected template", () => {
    for (const spec of SYSTEM_MESSAGES) {
      if (!spec.connected) continue;
      expect(spec.trigger).not.toContain("No send path is connected yet");
      expect(spec.trigger.trim().endsWith(".")).toBe(true);
    }
  });

  it("leaves the tax invoice connected without an authored default, because it renders from its own coded template", () => {
    expect(messageSpec("invoice_issued").connected).toBe(true);
    expect(defaultDocument("invoice_issued")).toBeNull();
  });

  it("gives every template with no send path no authored default either", () => {
    for (const spec of SYSTEM_MESSAGES) {
      if (spec.connected) continue;
      expect(defaultDocument(spec.key)).toBeNull();
    }
  });
});

describe("§12 — the stored shape a manager's document has to fit", () => {
  it.each(Object.entries(MESSAGE_DOCUMENT_LIMITS))("bounds %s at a whole number above zero", (_name, value) => {
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThan(0);
  });

  it("carries the test-recipient hint as plain readable wording", () => {
    expect(TEST_RECIPIENT_HINT.trim().length).toBeGreaterThan(0);
    expect(TEST_RECIPIENT_HINT).not.toContain("{{");
  });
});
