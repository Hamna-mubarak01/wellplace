import { describe, expect, it } from "vitest";
import { BOOKING_PREVIEW_STATES, bookingPreviewState } from "@/lib/config/booking-preview";

describe("[§13] booking fixture isolation", () => {
  it("ignores all fixture parameters in production", () => {
    for (const state of BOOKING_PREVIEW_STATES) {
      expect(bookingPreviewState(state, "production")).toBeNull();
      expect(bookingPreviewState([state, "expiring"], "production")).toBeNull();
    }
  });
  it("allows named fixtures only in development", () => {
    expect(bookingPreviewState("expiring", "development")).toBe("expiring");
    expect(bookingPreviewState("unknown", "development")).toBeNull();
    expect(bookingPreviewState("expiring", "test")).toBeNull();
    expect(bookingPreviewState(undefined, "production")).toBeNull();
  });
});
