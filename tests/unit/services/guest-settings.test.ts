import { describe, expect, it, vi } from "vitest";
import { SETTINGS, type SettingsSnapshot } from "@/lib/config";
import { WEEKDAY_KEYS } from "@/lib/config/opening-hours";
import { guestBookingRefusal } from "@/lib/services/guest-booking-rules";
import { priceGuestBooking } from "@/app/(site)/book/quote";
import type { WellPlaceClient } from "@/lib/db/types";

vi.mock("@/lib/db/queries/pricing", () => ({
  listPublicAddons: vi.fn(async () => []),
  listPublicPriceTiers: vi.fn(async () => [
    { id: "adult", guestKind: "adult", fromHour: 1, toHour: null, regularFilsPerHour: 22000, offerFilsPerHour: 16500, offerPercent: null, weekdays: null, startWindow: null, seasonFrom: null, seasonTo: null, priority: 0 },
  ]),
}));

const now = new Date("2026-09-10T04:00:00Z");
const regular = Object.fromEntries(WEEKDAY_KEYS.map((day) => [day, [{ opens: "10:00", closes: "22:00" }]]));
const base: SettingsSnapshot = { ...Object.fromEntries(Object.entries(SETTINGS).map(([key, setting]) => [key, setting.defaultValue])), "hours.regular": regular };
const visit = { startsAt: "2026-09-11T06:00:00Z", durationHours: 2, adults: 2, childAges: [], dateOfBirth: "1990-01-01" };

describe("[§6, §10.2] saved guest booking rules", () => {
  it("accepts the currently configured visit", () => expect(guestBookingRefusal(base, visit, now)).toBeNull());
  it.each([
    [{ "booking.durations_hours": [3] }, "length"],
    [{ "booking.guests_min": 3 }, "guests"],
    [{ "booking.guests_max": 1 }, "guests"],
    [{ "booking.booker_min_age": 40 }, "at least 40"],
    [{ "hours.closures": [{ from: "2026-09-11", to: "2026-09-11" }] }, "closed"],
  ])("rejects an open form after a settings change: %j", (changed, message) => {
    expect(guestBookingRefusal({ ...base, ...changed }, visit, now)).toContain(message);
  });
  it("enforces both saved child age boundaries", () => {
    const party = { ...visit, adults: 1, childAges: [10] };
    expect(guestBookingRefusal(base, party, now)).toBeNull();
    expect(guestBookingRefusal({ ...base, "booking.child_min_age": 11 }, party, now)).toContain("ages");
    expect(guestBookingRefusal({ ...base, "booking.child_max_age": 9 }, party, now)).toContain("ages");
  });
  it("uses the configured grid anchored to opening and includes the final horizon date", () => {
    const time = { ...visit, startsAt: "2026-09-11T06:15:00Z" };
    expect(guestBookingRefusal(base, time, now)).toBeNull();
    expect(guestBookingRefusal({ ...base, "booking.start_interval_minutes": 30 }, time, now)).toContain("start time");
    expect(guestBookingRefusal({ ...base, "booking.max_horizon_days": 1 }, visit, now)).toBeNull();
    expect(guestBookingRefusal({ ...base, "booking.max_horizon_days": 1 }, { ...visit, startsAt: "2026-09-12T06:00:00Z" }, now)).toContain("start time");
  });
  it("honours a closed weekday within a named custom schedule", () => {
    const settings = { ...base, "hours.seasonal": { periods: [{ name: "Private week", from: "2026-09-11", to: "2026-09-17", hours: { ...regular, fri: [] } }] } };
    expect(guestBookingRefusal(settings, visit, now)).toContain("closed");
  });
  it("applies the live Tabby fee only to a Tabby quote, and uses saved offer wording and tax", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    try {
      const settings = { ...base, "fees.tabby.percent": 8, "fees.tabby.label": "Instalment fee", "pricing.offer_label": "Autumn offer", "pricing.offer_headline": "Welcome this autumn", "pricing.offer_subline": "Book your visit", "tax.label": "Included VAT" };
      const request = { ...visit, addonQuantities: {}, comparisonDurationsHours: [] };
      const client = {} as WellPlaceClient;
      const card = await priceGuestBooking(client, settings, { ...request, paymentOption: "card" });
      const tabby = await priceGuestBooking(client, settings, { ...request, paymentOption: "tabby" });
      expect(card.status).toBe("priced"); expect(tabby.status).toBe("priced");
      if (card.status !== "priced" || tabby.status !== "priced") throw new Error("No quote");
      expect(tabby.quote.breakdown.outcome).toBe("priced");
      expect(card.quote.breakdown.totalFils).toBe(66000);
      expect(tabby.quote.breakdown.totalFils).toBe(71280);
      expect(tabby.quote.breakdown.lines.some((line) => line.label === "Instalment fee" && line.amountFils === 5280)).toBe(true);
      expect(tabby.quote.offerLabel).toBe("Autumn offer");
      expect(tabby.quote.taxLabel).toBe("Included VAT");
      const exclusive = await priceGuestBooking(client, { ...settings, "tax.inclusive": false, "tax.vat_percent": 10 }, { ...request, paymentOption: "card" });
      expect(exclusive.status === "priced" && exclusive.quote.breakdown.totalFils).toBe(72600);
      const disabled = await priceGuestBooking(client, { ...settings, "fees.tabby.enabled": false }, { ...request, paymentOption: "tabby" });
      expect(disabled.status === "priced" && disabled.quote.breakdown.totalFils).toBe(card.quote.breakdown.totalFils);
    } finally { vi.useRealTimers(); }
  });
});
