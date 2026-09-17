import { describe, expect, it } from "vitest";

import { resolveHomeContent } from "@/lib/config/cms/home-content";
import {
  VENUE_ADDRESS_LINES,
  VENUE_DIRECTIONS_LINK,
  VENUE_MAP_CENTER,
  VENUE_MAP_LINK,
} from "@/lib/config/entity";
import { HOME_PAGE_CONTENT } from "@/lib/config/home";

describe("published home content — §5.1", () => {
  it("falls back to the built-in copy when nothing is published", () => {
    const content = resolveHomeContent(null);

    expect(content.hero.title).toBe(HOME_PAGE_CONTENT.hero.title);
    expect(content.gallery.body).toBe(HOME_PAGE_CONTENT.gallery.body);
    expect(content.hero.slides).toHaveLength(HOME_PAGE_CONTENT.hero.slides.length);
  });

  it("renders a published override on the page", () => {
    const content = resolveHomeContent({
      hero: { title: "Step out of black world", accent: "Into your cool places" },
    });

    expect(content.hero.title).toBe("Step out of black world");
    expect(content.hero.accent).toBe("Into your cool places");
    expect(content.hero.body).toBe(HOME_PAGE_CONTENT.hero.body);
  });

  it("uses the static background image when the carousel is emptied", () => {
    const content = resolveHomeContent({
      hero: { slides: [], staticImage: "/renderings/suite-view-1-1920.webp" },
    });

    expect(content.hero.slides).toEqual([
      { kind: "image", url: "/renderings/suite-view-1-1920.webp" },
    ]);
  });

  it("returns to the built-in slides when both carousel and static image are empty", () => {
    const content = resolveHomeContent({ hero: { slides: [], staticImage: "" } });

    expect(content.hero.slides.map((item) => item.url)).toEqual([
      ...HOME_PAGE_CONTENT.hero.slides,
    ]);
  });

  it("drops carousel entries with no URL rather than rendering a broken image", () => {
    const content = resolveHomeContent({
      hero: {
        slides: [
          { kind: "image", url: "/renderings/suite-view-2-1920.webp" },
          { kind: "image", url: "   " },
        ],
      },
    });

    expect(content.hero.slides).toHaveLength(1);
  });

  it("carries published card and suite lists through", () => {
    const content = resolveHomeContent({
      difference: {
        cards: [
          { label: "L", title: "T", detail: "D", action: "A", image: "/i.webp" },
        ],
      },
    });

    expect(content.difference.cards).toEqual([
      {
        label: "L",
        title: "T",
        backLabel: "L",
        backTitle: "T",
        icon: "sparkles",
        imageAlt: "",
        detail: "D",
        action: "A",
        image: "/i.webp",
      },
    ]);
  });

  it("prefills the gallery and leaves FAQ ownership to its dedicated CMS", () => {
    const content = resolveHomeContent(null);

    expect(content.gallery.shots.length).toBe(HOME_PAGE_CONTENT.gallery.shots.length);
    expect(content.gallery.shots[0]?.src).toBe(HOME_PAGE_CONTENT.gallery.shots[0]?.image);
    expect("faq" in content).toBe(false);
  });

  it("lets an editor replace the gallery entirely", () => {
    const content = resolveHomeContent({
      gallery: {
        shots: [{ image: "/uploads/a.webp", alt: "A", orientation: "portrait" }],
      },
    });

    expect(content.gallery.shots).toEqual([
      {
        src: "/uploads/a.webp",
        alt: "Move through the details, image 1",
        orientation: "portrait",
      },
    ]);
  });

  it("falls back to landscape when an orientation is not recognised", () => {
    const content = resolveHomeContent({
      gallery: { shots: [{ image: "/uploads/a.webp", alt: "A", orientation: "sideways" }] },
    });

    expect(content.gallery.shots[0]?.orientation).toBe("landscape");
  });

  it("drops gallery rows and FAQ rows with nothing in them", () => {
    const content = resolveHomeContent({
      gallery: { shots: [{ image: "", alt: "", orientation: "landscape" }] },
    });

    expect(content.gallery.shots).toEqual([]);
  });

  it("prefills the map from the venue details", () => {
    const content = resolveHomeContent(null);

    expect(content.location.center).toEqual([...VENUE_MAP_CENTER]);
    expect(content.location.mapZoom).toBe(16);
    expect(content.location.addressLines.length).toBe(4);
    expect(content.location.mapLink).toContain("Lantern");
  });

  it("moves the map when an editor changes the coordinates", () => {
    const content = resolveHomeContent({
      location: { latitude: "25.2048", longitude: "55.2708", mapZoom: "18" },
    });

    expect(content.location.center).toEqual([25.2048, 55.2708]);
    expect(content.location.mapZoom).toBe(18);
  });

  it("keeps the venue coordinates when a value is not a number", () => {
    const content = resolveHomeContent({
      location: { latitude: "north a bit", longitude: "", mapZoom: "abc" },
    });

    expect(content.location.center).toEqual([...VENUE_MAP_CENTER]);
    expect(content.location.mapZoom).toBe(16);
  });

  it("clamps the zoom to what the tiles support", () => {
    expect(resolveHomeContent({ location: { mapZoom: "99" } }).location.mapZoom).toBe(19);
    expect(resolveHomeContent({ location: { mapZoom: "-4" } }).location.mapZoom).toBe(1);
  });

  it("keeps one address for the page, the map and the search listing", () => {
    const content = resolveHomeContent({
      location: { addressLines: ["Somewhere New", "Dubai"] },
    });

    expect(content.location.addressLines).toEqual(VENUE_ADDRESS_LINES);
    expect(content.location.mapLink).toBe(VENUE_MAP_LINK);
    expect(content.location.directionsLink).toBe(VENUE_DIRECTIONS_LINK);
  });

  it("ignores a malformed published payload instead of breaking the page", () => {
    const content = resolveHomeContent({ hero: "not-an-object" } as never);

    expect(content.hero.title).toBe(HOME_PAGE_CONTENT.hero.title);
  });
});

describe("image descriptions without a CMS field — §5.1, §9.7", () => {
  it("keeps the authored description for every built-in rendering", () => {
    const content = resolveHomeContent(null);

    expect(content.gallery.shots.map((shot) => shot.alt)).toEqual(
      HOME_PAGE_CONTENT.gallery.shots.map((shot) => shot.alt),
    );
    expect(content.suite.views.map((view) => view.imageAlt)).toEqual(
      HOME_PAGE_CONTENT.suite.views.map((view) => view.imageAlt),
    );
    expect(content.hero.mediaLabel).toBe(HOME_PAGE_CONTENT.hero.mediaLabel);
  });

  it("describes an uploaded image from the copy around it", () => {
    const content = resolveHomeContent({
      suite: {
        views: [
          {
            label: "Steam",
            title: "Heat that stays",
            emphasis: "yours alone",
            image: "/uploads/steam.webp",
          },
        ],
      },
      gallery: { shots: [{ image: "/uploads/new.webp", orientation: "landscape" }] },
    });

    expect(content.suite.views[0]?.imageAlt).toBe(
      "Steam Heat that stays yours alone, suite view 1",
    );
    expect(content.gallery.shots[0]?.alt).toBe("Move through the details, image 1");
  });

  it("never leaves a description empty, even with every heading cleared", () => {
    const content = resolveHomeContent({
      gallery: { title: "", accent: "", shots: [{ image: "/uploads/x.webp" }] },
    });

    expect(content.gallery.shots[0]?.alt).toBe("Image 1");
    expect(content.hero.mediaLabel.length).toBeGreaterThan(0);
  });
});
