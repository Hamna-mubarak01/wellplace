import { describe, expect, it } from "vitest";

import {
  choice,
  repeater,
  text,
  textLines,
  toggle,
} from "@/lib/config/cms/fields";
import { HOME_CMS_PAGE } from "@/lib/config/cms/registry";
import type { CmsPageSpec } from "@/lib/config/cms/types";
import { defaultValuesFor, splitLines } from "@/lib/config/cms/types";
import {
  isSectionCustomised,
  pruneCmsValues,
  resolveCmsValues,
} from "@/lib/config/cms/values";
import { HOME_PAGE_CONTENT } from "@/lib/config/home";

describe("CMS defaults — §5.1", () => {
  it("prefills every field from the live site content", () => {
    const values = resolveCmsValues(HOME_CMS_PAGE, null);

    expect(values.hero?.title).toBe(HOME_PAGE_CONTENT.hero.title);
    expect(values.hero?.body).toBe(HOME_PAGE_CONTENT.hero.body);
    expect(values.gallery?.body).toBe(HOME_PAGE_CONTENT.gallery.body);
    expect(values.difference?.cards).toHaveLength(
      HOME_PAGE_CONTENT.difference.cards.length,
    );
  });

  it("leaves no field empty, so an editor never starts from scratch", () => {
    const values = resolveCmsValues(HOME_CMS_PAGE, null);

    for (const section of HOME_CMS_PAGE.sections) {
      for (const field of section.fields) {
        const value = values[section.key]?.[field.key];
        expect(value, `${section.key}.${field.key}`).toBeDefined();
        if (field.kind === "text" || field.kind === "textarea") {
          if (field.key !== "staticImage") {
            expect(typeof value).toBe("string");
          }
        }
      }
    }
  });

  it("lays stored overrides on top of the defaults", () => {
    const values = resolveCmsValues(HOME_CMS_PAGE, {
      hero: { title: "A new headline" },
    });

    expect(values.hero?.title).toBe("A new headline");
    expect(values.hero?.body).toBe(HOME_PAGE_CONTENT.hero.body);
  });

  it("ignores a stored value of the wrong shape rather than rendering it", () => {
    const values = resolveCmsValues(HOME_CMS_PAGE, {
      hero: { title: 42, slides: "not-a-list" },
    });

    expect(values.hero?.title).toBe(HOME_PAGE_CONTENT.hero.title);
    expect(values.hero?.slides).toEqual(
      HOME_PAGE_CONTENT.hero.slides.map((url) => ({ kind: "image", url })),
    );
  });

  it("caps carousel media at the configured maximum", () => {
    const tooMany = Array.from({ length: 25 }, (_, index) => ({
      kind: "image" as const,
      url: `/renderings/x-${index}.webp`,
      alt: "",
    }));

    const values = resolveCmsValues(HOME_CMS_PAGE, { hero: { slides: tooMany } });

    expect(values.hero?.slides).toHaveLength(10);
  });
});

describe("CMS pruning — Set to default", () => {
  it("stores nothing when every value still matches the default", () => {
    const values = resolveCmsValues(HOME_CMS_PAGE, null);

    expect(pruneCmsValues(HOME_CMS_PAGE, values)).toEqual({});
  });

  it("stores only the fields that were actually changed", () => {
    const values = resolveCmsValues(HOME_CMS_PAGE, null);
    const edited = {
      ...values,
      hero: { ...values.hero, title: "Changed" },
    };

    expect(pruneCmsValues(HOME_CMS_PAGE, edited)).toEqual({
      hero: { title: "Changed" },
    });
  });

  it("round-trips: prune then resolve gives the same values back", () => {
    const values = resolveCmsValues(HOME_CMS_PAGE, null);
    const edited = {
      ...values,
      gallery: { ...values.gallery, eyebrow: "Reserve now" },
    };

    const stored = pruneCmsValues(HOME_CMS_PAGE, edited);

    expect(resolveCmsValues(HOME_CMS_PAGE, stored)).toEqual(edited);
  });

  it("reports which sections carry an override", () => {
    const values = resolveCmsValues(HOME_CMS_PAGE, { hero: { title: "Changed" } });

    expect(isSectionCustomised(HOME_CMS_PAGE, values, "hero")).toBe(true);
    expect(isSectionCustomised(HOME_CMS_PAGE, values, "cta")).toBe(false);
  });
});

describe("CMS registry shape", () => {
  it("gives every section and field a unique key", () => {
    const sectionKeys = HOME_CMS_PAGE.sections.map((section) => section.key);
    expect(new Set(sectionKeys).size).toBe(sectionKeys.length);

    for (const section of HOME_CMS_PAGE.sections) {
      const fieldKeys = section.fields.map((field) => field.key);
      expect(new Set(fieldKeys).size, section.key).toBe(fieldKeys.length);
    }
  });

  it("defaultValuesFor matches a resolve with nothing stored", () => {
    expect(defaultValuesFor(HOME_CMS_PAGE)).toEqual(
      resolveCmsValues(HOME_CMS_PAGE, null),
    );
  });
});

describe("toggle, lines and select fields — §5.1", () => {
  const page: CmsPageSpec = {
    slug: "field-kinds-fixture",
    label: "Fixture",
    description: "Fixture",
    icon: "settings",
    group: "Shared",
    route: null,
    sections: [
      {
        key: "block",
        label: "Block",
        icon: "settings",
        title: "Block",
        description: "Block",
        fields: [
          toggle("shown", "Shown", true),
          textLines("points", "Points", "Point", 3, ["One", "Two"]),
          choice(
            "side",
            "Side",
            [
              { value: "left", label: "Left" },
              { value: "right", label: "Right" },
            ],
            "left",
          ),
          repeater(
            "rows",
            "Rows",
            "Row",
            4,
            [toggle("enabled", "Enabled", false), text("name", "Name", "")],
            [{ enabled: true, name: "Home" }],
          ),
        ],
      },
    ],
  };

  it("keeps a stored boolean and rejects a string that looks like one", () => {
    expect(resolveCmsValues(page, { block: { shown: false } }).block?.shown).toBe(false);
    expect(resolveCmsValues(page, { block: { shown: "false" } }).block?.shown).toBe(true);
  });

  it("stores lines as one string and splits them on read", () => {
    expect(resolveCmsValues(page, null).block?.points).toBe("One\nTwo");
    expect(splitLines("  A  \n\n B \n", 3)).toEqual(["A", "B"]);
    expect(splitLines("A\nB\nC\nD", 3)).toEqual(["A", "B", "C"]);
  });

  it("falls back to the default when a select value is not an option", () => {
    expect(resolveCmsValues(page, { block: { side: "right" } }).block?.side).toBe("right");
    expect(resolveCmsValues(page, { block: { side: "sideways" } }).block?.side).toBe("left");
  });

  it("carries booleans through repeater items", () => {
    const stored = { block: { rows: [{ enabled: false, name: "Concept" }] } };
    expect(resolveCmsValues(page, stored).block?.rows).toEqual([
      { enabled: false, name: "Concept" },
    ]);
  });

  it("prunes a toggle that still matches its default", () => {
    const untouched = resolveCmsValues(page, null);
    expect(pruneCmsValues(page, untouched)).toEqual({});

    const changed = { ...untouched, block: { ...untouched.block, shown: false } };
    expect(pruneCmsValues(page, changed)).toEqual({ block: { shown: false } });
  });
});

describe("content stored before a field was removed — §5.1", () => {
  it("drops a repeater key the page no longer defines", () => {
    const values = resolveCmsValues(HOME_CMS_PAGE, {
      gallery: {
        shots: [
          { image: "/uploads/a.webp", alt: "left over", orientation: "portrait" },
        ],
      },
    });

    expect(values.gallery?.shots).toEqual([
      { image: "/uploads/a.webp", orientation: "portrait" },
    ]);
  });

  it("stops a removed field making a section look edited", () => {
    const withOrphans = {
      gallery: {
        shots: HOME_PAGE_CONTENT.gallery.shots.map((shot) => ({ ...shot })),
      },
    };
    const values = resolveCmsValues(HOME_CMS_PAGE, withOrphans);

    expect(isSectionCustomised(HOME_CMS_PAGE, values, "gallery")).toBe(false);
    expect(pruneCmsValues(HOME_CMS_PAGE, values)).toEqual({});
  });

  it("ignores a whole section the page no longer has", () => {
    const values = resolveCmsValues(HOME_CMS_PAGE, {
      cta: { title: "Left over from before" },
    });

    expect(values.cta).toBeUndefined();
    expect(pruneCmsValues(HOME_CMS_PAGE, values)).toEqual({});
  });
});
