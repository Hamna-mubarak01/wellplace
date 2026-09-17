import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { resolveSuitesContent } from "@/lib/config/cms/suites-content";
import { SUITES_PAGE_CONTENT, SUITE_STORY_CARDS } from "@/lib/config/suites";

describe("published suites page — §5.1, §4.3", () => {
  it("falls back to the built-in copy when nothing is published", () => {
    const content = resolveSuitesContent(null);

    expect(content.hero.title).toBe(SUITES_PAGE_CONTENT.hero.title);
    expect(content.tour.body).toBe(SUITES_PAGE_CONTENT.tour.body);
    expect(content.cards).toHaveLength(8);
  });

  it("keeps the authored image description for every built-in card", () => {
    const content = resolveSuitesContent(null);

    expect(content.cards.map((card) => card.imageAlt)).toEqual(
      SUITE_STORY_CARDS.map((card) => card.imageAlt),
    );
  });

  it("splits the facilities from one line each", () => {
    const content = resolveSuitesContent(null);

    expect(content.cards[0]?.facilities).toEqual(SUITE_STORY_CARDS[0]?.facilities);
  });

  it("ignores previously published optional bands — CLIENT 5 September 2026", () => {
    expect(resolveSuitesContent({
      introduction: { enabled: true, title: "Removed introduction" },
      included: { enabled: true, title: "Removed included band" },
      facilities: { title: "Removed facilities grid", items: [{ title: "Old facility" }] },
      tour: { title: "Your suite tour" },
    })).toEqual(resolveSuitesContent({ tour: { title: "Your suite tour" } }));
  });

  it("lets an editor rewrite a card and its facilities", () => {
    const content = resolveSuitesContent({
      cards: {
        items: [
          {
            eyebrow: "Steam",
            title: "Heat that stays",
            accent: "yours alone",
            body: "b",
            image: "/uploads/steam.webp",
            facilities: "Private steam\nRain shower\n",
          },
        ],
      },
    });

    const [card] = content.cards;
    expect(card?.facilities).toEqual(["Private steam", "Rain shower"]);
    expect(card?.imageAlt).toBe("Steam Heat that stays yours alone, suite card 1");
  });

  it("ignores a stored value of the wrong shape rather than rendering it", () => {
    const content = resolveSuitesContent({
      hero: { title: 3 },
      cards: { items: "not a list" },
    });

    expect(content.hero.title).toBe(SUITES_PAGE_CONTENT.hero.title);
    expect(content.cards).toHaveLength(SUITE_STORY_CARDS.length);
  });
});

describe("the suites page never publishes a suite count — §3, INV-01", () => {
  it("keeps no card total in the rendered component", () => {
    const source = readFileSync(
      "src/components/marketing/suites-experience.tsx",
      "utf8",
    );

    expect(source.includes("total")).toBe(false);
    expect(source.includes("cards.length")).toBe(false);
  });

  it("keeps the authored description for the hero image", () => {
    const content = resolveSuitesContent(null);

    expect(content.hero.imageAlt).toBe(SUITES_PAGE_CONTENT.hero.imageAlt);
  });
});
