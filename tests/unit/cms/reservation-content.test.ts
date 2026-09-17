import { describe, expect, it } from "vitest";

import {
  reservationFor,
  resolveReservationContent,
} from "@/lib/config/cms/reservation-content";
import { RESERVATION_CONTENT } from "@/lib/config/reservation";

describe("published reservation banner — §5.1", () => {
  it("falls back to the built-in copy when nothing is published", () => {
    const content = resolveReservationContent(null);

    expect(content.shared.title).toBe(RESERVATION_CONTENT.title);
    expect(content.shared.primaryLabel).toBe(RESERVATION_CONTENT.primaryLabel);
    expect(content.shared.primaryHref).toBe(RESERVATION_CONTENT.primaryHref);
  });

  it("shows the shared banner on every page it is switched on for", () => {
    const content = resolveReservationContent(null);

    expect(reservationFor(content, "home")?.title).toBe(RESERVATION_CONTENT.title);
    expect(reservationFor(content, "suites")?.title).toBe(RESERVATION_CONTENT.title);
    expect(reservationFor(content, "book")).toBeNull();
  });

  it("applies a published override to every page at once", () => {
    const content = resolveReservationContent({
      content: { title: "Doors open", primaryLabel: "Reserve" },
    });

    expect(reservationFor(content, "home")?.title).toBe("Doors open");
    expect(reservationFor(content, "suites")?.primaryLabel).toBe("Reserve");
  });

  it("hides the banner on a page switched off", () => {
    const content = resolveReservationContent({
      placement: { pages: [{ page: "suites", enabled: false }] },
    });

    expect(reservationFor(content, "suites")).toBeNull();
    expect(reservationFor(content, "home")?.title).toBe(RESERVATION_CONTENT.title);
  });

  it("uses a per-page override and inherits every field left blank", () => {
    const content = resolveReservationContent({
      content: { body: "Shared body" },
      placement: {
        pages: [{ page: "faq", enabled: true, title: "Still curious", body: "" }],
      },
    });

    const faq = reservationFor(content, "faq");
    expect(faq?.title).toBe("Still curious");
    expect(faq?.body).toBe("Shared body");
    expect(faq?.accent).toBe(RESERVATION_CONTENT.accent);
  });

  it("shows the shared banner on a page with no row of its own", () => {
    const content = resolveReservationContent({
      placement: { pages: [{ page: "home", enabled: true }] },
    });

    expect(reservationFor(content, "contact")?.title).toBe(RESERVATION_CONTENT.title);
  });

  it("ignores a stored value of the wrong shape rather than rendering it", () => {
    const content = resolveReservationContent({
      content: { title: 42 },
      placement: { pages: "not a list" },
    });

    expect(content.shared.title).toBe(RESERVATION_CONTENT.title);
    expect(reservationFor(content, "home")?.title).toBe(RESERVATION_CONTENT.title);
  });

  it("hides the banner only on an explicit off, never on a malformed value", () => {
    const malformed = resolveReservationContent({
      placement: { pages: [{ page: "home", enabled: "yes" }] },
    });
    expect(reservationFor(malformed, "home")?.title).toBe(RESERVATION_CONTENT.title);

    const missing = resolveReservationContent({
      placement: { pages: [{ page: "home" }] },
    });
    expect(reservationFor(missing, "home")?.title).toBe(RESERVATION_CONTENT.title);

    const off = resolveReservationContent({
      placement: { pages: [{ page: "home", enabled: false }] },
    });
    expect(reservationFor(off, "home")).toBeNull();
  });

  it("keeps the button pointing at the booking page, whatever is stored", () => {
    for (const stored of [
      { primaryHref: "javascript:alert(1)" },
      { primaryHref: "https://example.com" },
      { primaryLabel: "Reserve now" },
    ]) {
      const content = resolveReservationContent({ content: stored });
      expect(content.shared.primaryHref).toBe(RESERVATION_CONTENT.primaryHref);
    }
  });
});

describe("the banner switch falls back to its own declared default — §5.1", () => {
  it("keeps showing the banner when the stored switch is malformed", () => {
    const content = resolveReservationContent({
      placement: { pages: [{ page: "home", enabled: "yes" }] },
    });

    expect(reservationFor(content, "home")?.title).toBe(RESERVATION_CONTENT.title);
  });

  it("still hides it on an explicit off", () => {
    const content = resolveReservationContent({
      placement: { pages: [{ page: "home", enabled: false }] },
    });

    expect(reservationFor(content, "home")).toBeNull();
  });
});
