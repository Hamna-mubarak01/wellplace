import { describe, expect, it } from "vitest";

import { resolveHomeContent } from "@/lib/config/cms/home-content";
import { HOME_PAGE_CONTENT } from "@/lib/config/home";
import { isContentIcon } from "@/lib/config/cms/icons";

describe("difference cards — front and back are separately editable", () => {
  it("prefills both faces and an icon from the live site", () => {
    const [first] = resolveHomeContent(null).difference.cards;

    expect(first?.label).toBe(HOME_PAGE_CONTENT.difference.cards[0]?.label);
    expect(first?.backTitle).toBe(HOME_PAGE_CONTENT.difference.cards[0]?.title);
    expect(first?.icon).toBe("key");
  });

  it("ships an icon that the renderer actually knows", () => {
    for (const card of resolveHomeContent(null).difference.cards) {
      expect(isContentIcon(card.icon), card.icon).toBe(true);
    }
  });

  it("lets the two faces say different things", () => {
    const [card] = resolveHomeContent({
      difference: {
        cards: [
          {
            label: "Front label",
            title: "Front title",
            backLabel: "Back label",
            backTitle: "Back title",
            detail: "Detail",
            action: "Go",
            image: "/a.webp",
            icon: "waves",
          },
        ],
      },
    }).difference.cards;

    expect(card?.label).toBe("Front label");
    expect(card?.title).toBe("Front title");
    expect(card?.backLabel).toBe("Back label");
    expect(card?.backTitle).toBe("Back title");
    expect(card?.icon).toBe("waves");
  });

  it("falls back to the front copy when the back is left empty", () => {
    const [card] = resolveHomeContent({
      difference: {
        cards: [
          { label: "Only front", title: "Only title", backLabel: "  ", backTitle: "" },
        ],
      },
    }).difference.cards;

    expect(card?.backLabel).toBe("Only front");
    expect(card?.backTitle).toBe("Only title");
  });

  it("keeps content published before the split working", () => {
    const [card] = resolveHomeContent({
      difference: {
        cards: [{ label: "Old shape", title: "Old title", detail: "d", action: "a" }],
      },
    }).difference.cards;

    expect(card?.backLabel).toBe("Old shape");
    expect(card?.backTitle).toBe("Old title");
    expect(isContentIcon(card?.icon ?? "")).toBe(true);
  });

  it("ignores an icon name the renderer cannot draw", () => {
    const [card] = resolveHomeContent({
      difference: { cards: [{ label: "x", icon: "not-an-icon" }] },
    }).difference.cards;

    expect(card?.icon).toBe("not-an-icon");
    expect(isContentIcon(card?.icon ?? "")).toBe(false);
  });
});

// [§Homepage difference cards] The new copy keeps the approved interactions.
it("uses the three client headings on both existing card faces", () => {
  const cards = resolveHomeContent(null).difference.cards;
  const titles = ["Everything behind one door", "Never shared", "Your time, your rhythm"];
  expect(cards.map((card) => card.title)).toEqual(titles);
  expect(cards.map((card) => card.backTitle)).toEqual(titles);
  expect(JSON.stringify(cards)).not.toMatch(/configured minimum age|from age/);
  expect(cards[0]?.image).toBe("/renderings/suite-view-1-960.webp");
});
