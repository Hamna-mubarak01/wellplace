import { describe, expect, it } from "vitest";

import { resolveConceptContent } from "@/lib/config/cms/concept-content";
import { CONCEPT_CHAPTER_DETAIL_MAX } from "@/lib/config/cms/pages/concept";
import { CONCEPT_CHAPTERS, CONCEPT_PAGE_CONTENT } from "@/lib/config/concept";

describe("published concept page — §5.1, §4.3", () => {
  it("falls back to the built-in copy when nothing is published", () => {
    const content = resolveConceptContent(null);

    expect(content.hero.title).toBe(CONCEPT_PAGE_CONTENT.hero.title);
    expect(content.chapters).toHaveLength(CONCEPT_CHAPTERS.length);
    expect(content.chapters[0]?.number).toBe(CONCEPT_CHAPTERS[0]?.number);
  });

  it("keeps the authored image description for every built-in chapter", () => {
    const content = resolveConceptContent(null);

    expect(content.chapters.map((chapter) => chapter.imageAlt)).toEqual(
      CONCEPT_CHAPTERS.map((chapter) => chapter.imageAlt),
    );
    expect(content.hero.imageAlt).toBe(CONCEPT_PAGE_CONTENT.hero.imageAlt);
  });

  it("splits the detail pills from one line each", () => {
    const content = resolveConceptContent(null);

    expect(content.chapters[0]?.details).toEqual(CONCEPT_CHAPTERS[0]?.details);
  });

  it("lets an editor rewrite a chapter and its pills", () => {
    const content = resolveConceptContent({
      chapters: {
        items: [
          {
            number: "01",
            eyebrow: "Arrival",
            title: "A door that",
            accent: "closes behind you",
            body: "Step inside.",
            image: "/uploads/door.webp",
            details: "  Private  \n\n  Yours alone  \n",
            mediaSide: "left",
          },
        ],
      },
    });

    const [chapter] = content.chapters;
    expect(chapter?.details).toEqual(["Private", "Yours alone"]);
    expect(chapter?.mediaSide).toBe("left");
    expect(chapter?.imageAlt).toBe("Arrival A door that closes behind you, chapter 1");
  });

  it("caps the lines at the configured maximum of three", () => {
    const content = resolveConceptContent({
      chapters: {
        items: [
          { title: "T", body: "b", details: "one\ntwo\nthree\nfour\nfive\nsix" },
        ],
      },
    });

    expect(CONCEPT_CHAPTER_DETAIL_MAX).toBe(3);
    expect(content.chapters[0]?.details).toHaveLength(CONCEPT_CHAPTER_DETAIL_MAX);
  });

  it("falls back to the right-hand image side for an unknown value", () => {
    const content = resolveConceptContent({
      chapters: { items: [{ title: "T", body: "b", mediaSide: "sideways" }] },
    });

    expect(content.chapters[0]?.mediaSide).toBe("right");
  });

  it("drops a chapter with neither a title nor a body", () => {
    const content = resolveConceptContent({
      chapters: {
        items: [
          { title: "Kept", body: "" },
          { title: "   ", body: "  " },
        ],
      },
    });

    expect(content.chapters.map((chapter) => chapter.title)).toEqual(["Kept"]);
  });

  it("ignores a stored value of the wrong shape rather than rendering it", () => {
    const content = resolveConceptContent({
      hero: { title: 9 },
      chapters: { items: "not a list" },
    });

    expect(content.hero.title).toBe(CONCEPT_PAGE_CONTENT.hero.title);
    expect(content.chapters).toHaveLength(CONCEPT_CHAPTERS.length);
  });
});
