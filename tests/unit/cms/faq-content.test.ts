import { describe, expect, it } from "vitest";

import { resolveFaqContent } from "@/lib/config/cms/faq-content";
import {
  FAQ_GROUP_BOOKINGS,
  FAQ_GROUP_EXPERIENCE,
  FAQ_GROUP_VISIT,
  FAQ_PAGE_CONTENT,
  FAQ_QUESTIONS,
} from "@/lib/config/faq";

describe("published FAQ page — §5.1, §4.3", () => {
  it("falls back to the built-in questions when nothing is published", () => {
    const content = resolveFaqContent(null);

    expect(content.entries).toHaveLength(FAQ_QUESTIONS.length);
    expect(content.entries[0]?.q).toBe(FAQ_QUESTIONS[0]?.question);
    expect(content.hero.title).toBe(FAQ_PAGE_CONTENT.hero.title);
  });

  it("groups questions by their heading, in first-appearance order", () => {
    const content = resolveFaqContent(null);

    expect(content.groups.map((group) => group.title)).toEqual([
      FAQ_GROUP_EXPERIENCE,
      FAQ_GROUP_VISIT,
      FAQ_GROUP_BOOKINGS,
    ]);
    expect(content.groups[0]?.entries).toHaveLength(4);
    expect(content.groups[0]?.id).toBe("the-wellplace-experience");
  });

  it("puts only the questions switched on onto the home page", () => {
    const content = resolveFaqContent(null);

    expect(content.homeEntries).toHaveLength(4);
    expect(content.homeEntries.map((entry) => entry.q)).toEqual(
      FAQ_QUESTIONS.filter((entry) => entry.showOnHome).map((entry) => entry.question),
    );
  });

  it("lets an editor move a question onto and off the home page", () => {
    const content = resolveFaqContent({
      questions: {
        entries: [
          { question: "Where do I park?", answer: "On site.", group: "Visiting", showOnHome: true },
          { question: "Do you take walk-ins?", answer: "Call us.", group: "Visiting", showOnHome: false },
        ],
      },
    });

    expect(content.entries).toHaveLength(2);
    expect(content.homeEntries).toEqual([{ q: "Where do I park?", a: "On site." }]);
  });

  it("creates a new group the moment a heading is renamed", () => {
    const content = resolveFaqContent({
      questions: {
        entries: [
          { question: "One", answer: "a", group: "Before you book", showOnHome: false },
          { question: "Two", answer: "b", group: "On the day", showOnHome: false },
          { question: "Three", answer: "c", group: "Before you book", showOnHome: false },
        ],
      },
    });

    expect(content.groups.map((group) => group.title)).toEqual([
      "Before you book",
      "On the day",
    ]);
    expect(content.groups[0]?.entries.map((entry) => entry.q)).toEqual(["One", "Three"]);
  });

  it("drops a question with no text and keeps an unanswered one in the list", () => {
    const content = resolveFaqContent({
      questions: {
        entries: [
          { question: "   ", answer: "orphaned", group: "A", showOnHome: true },
          { question: "Kept", answer: "", group: "A", showOnHome: false },
        ],
      },
    });

    expect(content.entries).toEqual([{ q: "Kept", a: "" }]);
    expect(content.homeEntries).toEqual([]);
  });

  it("falls back to one heading when an editor clears every group name", () => {
    const content = resolveFaqContent({
      questions: {
        entries: [{ question: "Only one", answer: "a", group: "", showOnHome: false }],
      },
    });

    expect(content.groups).toHaveLength(1);
    expect(content.groups[0]?.title).toBe(FAQ_PAGE_CONTENT.title);
    expect(content.groups[0]?.id.length).toBeGreaterThan(0);
  });

  it("ignores a stored value of the wrong shape rather than rendering it", () => {
    const content = resolveFaqContent({
      hero: { title: 12 },
      questions: { entries: "not a list" },
    });

    expect(content.hero.title).toBe(FAQ_PAGE_CONTENT.hero.title);
    expect(content.entries).toHaveLength(FAQ_QUESTIONS.length);
  });

  it("keeps both hero buttons pointing where the site says, not the editor", () => {
    const content = resolveFaqContent({
      hero: { primaryHref: "javascript:alert(1)", secondaryHref: "https://example.com" },
    });

    expect(content.hero.primaryHref).toBe(FAQ_PAGE_CONTENT.hero.primaryHref);
    expect(content.hero.secondaryHref).toBe(FAQ_PAGE_CONTENT.hero.secondaryHref);
  });

  it("treats a non-boolean home flag as off rather than promoting it", () => {
    const content = resolveFaqContent({
      questions: {
        entries: [{ question: "Q", answer: "a", group: "A", showOnHome: "yes" }],
      },
    });

    expect(content.homeEntries).toEqual([]);
  });
});

describe("the home teaser follows the FAQ page — §5.1", () => {
  it("leaves the home list empty when every question is switched off", () => {
    const content = resolveFaqContent({
      questions: {
        entries: FAQ_QUESTIONS.map((entry) => ({ ...entry, showOnHome: false })),
      },
    });

    expect(content.entries).toHaveLength(FAQ_QUESTIONS.length);
    expect(content.homeEntries).toEqual([]);
  });

  it("keeps the home order the same as the FAQ page order", () => {
    const content = resolveFaqContent({
      questions: {
        entries: [
          { question: "Third", answer: "c", group: "A", showOnHome: true },
          { question: "First", answer: "a", group: "A", showOnHome: false },
          { question: "Second", answer: "b", group: "A", showOnHome: true },
        ],
      },
    });

    expect(content.homeEntries.map((entry) => entry.q)).toEqual(["Third", "Second"]);
  });
});

describe("group headings become safe, unique ids — §4.1", () => {
  it("keeps two headings apart when they read the same in a URL", () => {
    const content = resolveFaqContent({
      questions: {
        entries: [
          { question: "One", answer: "a", group: "Before you book", showOnHome: false },
          { question: "Two", answer: "b", group: "Before, you book!", showOnHome: false },
          { question: "Three", answer: "c", group: "BEFORE YOU BOOK", showOnHome: false },
        ],
      },
    });

    const ids = content.groups.map((group) => group.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("before-you-book");
  });

  it("still gives a heading of pure punctuation a usable id", () => {
    const content = resolveFaqContent({
      questions: {
        entries: [
          { question: "One", answer: "a", group: "!!!", showOnHome: false },
          { question: "Two", answer: "b", group: "???", showOnHome: false },
        ],
      },
    });

    const ids = content.groups.map((group) => group.id);
    expect(ids.every((id) => /^[a-z0-9-]+$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(2);
  });
});

describe("structured data never ships a half-written answer — §4.3", () => {
  it("leaves an unanswered question out of the search listing", () => {
    const content = resolveFaqContent({
      questions: {
        entries: [
          { question: "Answered", answer: "Yes.", group: "A", showOnHome: false },
          { question: "Still drafting", answer: "   ", group: "A", showOnHome: false },
        ],
      },
    });

    expect(content.entries.map((entry) => entry.q)).toEqual([
      "Answered",
      "Still drafting",
    ]);
    expect(content.answered.map((entry) => entry.q)).toEqual(["Answered"]);
  });

  it("emits nothing to search when no question has an answer yet", () => {
    const content = resolveFaqContent({
      questions: { entries: [{ question: "Q", answer: "", group: "A", showOnHome: false }] },
    });

    expect(content.answered).toEqual([]);
  });
});

describe("half-finished questions never reach a visitor — §5.1", () => {
  it("keeps an unanswered question in the editor but off the page", () => {
    const content = resolveFaqContent({
      questions: {
        entries: [
          { question: "Answered", answer: "Yes.", group: "A", showOnHome: false },
          { question: "Unanswered", answer: "", group: "A", showOnHome: true },
        ],
      },
    });

    expect(content.entries.map((entry) => entry.q)).toEqual([
      "Answered",
      "Unanswered",
    ]);
    expect(content.groups[0]?.entries.map((entry) => entry.q)).toEqual(["Answered"]);
  });

  it("sends one copy of a duplicated question to search engines", () => {
    const content = resolveFaqContent({
      questions: {
        entries: [
          { question: "Is parking available?", answer: "Yes.", group: "A", showOnHome: false },
          { question: "is parking AVAILABLE?", answer: "Also yes.", group: "A", showOnHome: false },
        ],
      },
    });

    expect(content.groups[0]?.entries).toHaveLength(2);
    expect(content.answered).toHaveLength(1);
  });
});

describe("a repeater toggle falls back to its own declared default — §5.1", () => {
  it("leaves a malformed home flag off, because the field defaults to off", () => {
    const content = resolveFaqContent({
      questions: {
        entries: [{ question: "Q", answer: "a", group: "A", showOnHome: "yes" }],
      },
    });

    expect(content.homeEntries).toEqual([]);
  });
});

describe("dedicated Home FAQ controls", () => {
  it("inherits old Home wording until the FAQ preview is first saved", () => {
    expect(resolveFaqContent(null, { faq: { title: "Legacy heading" } }).homePreview.title).toBe("Legacy heading");
    expect(resolveFaqContent({ homePreview: { title: "New heading" } }, { faq: { title: "Legacy heading" } }).homePreview.title).toBe("New heading");
  });
  it("an explicit reset stops inheriting the old Home section", () => {
    expect(resolveFaqContent({ homePreview: {} }, { faq: { title: "Legacy heading" } }).homePreview.title).not.toBe("Legacy heading");
  });
});
