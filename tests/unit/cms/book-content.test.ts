import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { resolveBookingContent } from "@/lib/config/cms/book-content";
import { BOOK_CMS_PAGE } from "@/lib/config/cms/registry";
import { BOOKING_PAGE_CONTENT } from "@/lib/config/booking-page";
import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";

describe("published booking page — §5.1, §4.3", () => {
  it("falls back to the built-in copy when nothing is published", () => {
    const content = resolveBookingContent(null);

    expect(content.hero.title).toBe(BOOKING_PAGE_CONTENT.hero.title);
    expect(content.messages.widgetLabel).toBe(BOOKING_PAGE_CONTENT.messages.widgetLabel);
  });

  it("ignores previously published reassurance — CLIENT 5 September 2026", () => {
    expect(resolveBookingContent({
      assurance: { enabled: true, title: "Removed reassurance" },
      hero: { title: "Reserve your visit" },
    })).toEqual(resolveBookingContent({ hero: { title: "Reserve your visit" } }));
  });

  it("never leaves a booking message empty, whatever an editor clears", () => {
    const content = resolveBookingContent({
      messages: {
        widgetLabel: "",
        loadingLabel: "   ",
        settingsUnavailable: "",
        rateLimited: "",
        timesUnavailable: "",
        systemUnreachable: "",
        addonsUnavailable: "",
      },
    });

    for (const [key, value] of Object.entries(content.messages)) {
      expect(value.length, `${key} resolved empty`).toBeGreaterThan(0);
    }
    expect(content.messages.systemUnreachable).toBe(
      BOOKING_PAGE_CONTENT.messages.systemUnreachable,
    );
  });

  it("lets an editor rewrite what the widget says when it cannot load", () => {
    const content = resolveBookingContent({
      messages: { timesUnavailable: "Times are refreshing. Try again shortly." },
    });

    expect(content.messages.timesUnavailable).toBe(
      "Times are refreshing. Try again shortly.",
    );
    expect(content.messages.rateLimited).toBe(BOOKING_PAGE_CONTENT.messages.rateLimited);
  });

  it("ignores a stored value of the wrong shape rather than rendering it", () => {
    const content = resolveBookingContent({
      hero: { title: 7 },
      messages: { rateLimited: 12 },
    });

    expect(content.hero.title).toBe(BOOKING_PAGE_CONTENT.hero.title);
    expect(content.messages.rateLimited).toBe(BOOKING_PAGE_CONTENT.messages.rateLimited);
  });
});

describe("the booking widget stays out of the CMS — §10.2, R-05", () => {
  it("offers no field that would duplicate a booking setting", () => {
    const keys = BOOK_CMS_PAGE.sections.flatMap((section) =>
      section.fields.flatMap((field) => [
        field.key,
        ...(field.kind === "repeater" ? field.fields.map((leaf) => leaf.key) : []),
      ]),
    );

    const forbidden = /duration|guest|adult|child|hold|buffer|price|promo|interval|horizon/i;
    expect(keys.filter((key) => forbidden.test(key))).toEqual([]);
  });

  it("still reads its limits from settings on the page itself", () => {
    const page = readFileSync("src/app/(site)/book/page.tsx", "utf8");

    expect(page.includes('requireSetting(settings, "booking.durations_hours")')).toBe(true);
    expect(page.includes('requireSetting(settings, "hold.minutes")')).toBe(true);
  });
});

describe("availability never waits on the CMS — §7.4, §7.5", () => {
  const PAGE = readFileSync("src/app/(site)/book/page.tsx", "utf8");

  it("fetches content and availability together, not one after the other", () => {
    expect(PAGE.includes("await Promise.all([")).toBe(true);
    expect(PAGE.includes("loadAvailability(client, now)")).toBe(true);
  });

  it("keeps the availability loader free of any copy", () => {
    const start = PAGE.indexOf("async function loadAvailability");
    const end = PAGE.indexOf("async function BookingWidgetResolved");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = PAGE.slice(start, end);

    expect(body.includes("messages.")).toBe(false);
    expect(body.includes('reason: "settings"')).toBe(true);
  });
});

describe("the booking page can always explain itself — R-33, §10.2", () => {
  it("gives every setting the page reads a usable default", () => {
    const keys = [
      "booking.durations_hours",
      "booking.guests_min",
      "booking.guests_max",
      "booking.child_min_age",
      "booking.child_max_age",
      "booking.booker_min_age",
      "booking.start_interval_minutes",
      "booking.max_horizon_days",
      "booking.personal_request_max_length",
      "hold.minutes",
      "urgency.enabled",
      "urgency.threshold_few",
      "urgency.threshold_last",
      "urgency.text_few",
      "urgency.text_last",
      "urgency.text_none",
      "urgency.text_filling",
    ] as const;

    for (const key of keys) {
      expect(
        requireSetting(EMPTY_SNAPSHOT, key),
        `${key} has no default, so a settings outage would throw instead of showing a message`,
      ).toBeDefined();
    }
  });

  it("keeps the booking horizon and request length out of the page file", () => {
    const page = readFileSync("src/app/(site)/book/page.tsx", "utf8");

    expect(page.includes("HORIZON_DAYS =")).toBe(false);
    expect(page.includes("PERSONAL_REQUEST_MAX_LENGTH =")).toBe(false);
    expect(page.includes('"booking.max_horizon_days"')).toBe(true);
    expect(page.includes('"booking.personal_request_max_length"')).toBe(true);
  });
});
