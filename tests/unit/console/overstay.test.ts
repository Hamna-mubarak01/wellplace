import { describe, expect, it } from "vitest";
import { overstayFormSchema, overstaySummary } from "@/lib/config/overstay";
import { priceOverrun } from "@/lib/domain/overrun";

describe("[CLIENT] Overstay charges in AED", () => {
  it.each(["", "-1", "1.234", "1e3", "Infinity", "abc", "21474836.48"])("refuses an invalid custom amount %s", (amountAed) => {
    expect(overstayFormSchema.safeParse({ rateSource: "fixed", amountAed }).success).toBe(false);
  });
  it("converts decimal AED exactly and feeds the existing real overrun calculation", () => {
    const value = overstayFormSchema.parse({ rateSource: "fixed", amountAed: "10.25" });
    expect(value.amountFils).toBe(1025);
    const charge = priceOverrun({
      scheduledEnd: new Date("2026-09-08T10:00:00Z"), actualEnd: new Date("2026-09-08T10:11:00Z"),
      bookedMinutes: 120, incrementMinutes: 5, guests: { adults: 2, children: 1 }, tiers: [],
      rateSource: value.rateSource, fixedFilsPerIncrement: value.amountFils, roundingFils: 50,
    });
    expect(charge.chargeableIncrements).toBe(3);
    expect(charge.totalFils).toBe(9225);
  });
  it("allows a deliberate zero charge and regular or offer rates without a custom amount", () => {
    expect(overstayFormSchema.parse({ rateSource: "fixed", amountAed: "0" }).amountFils).toBe(0);
    for (const rateSource of ["regular_hourly", "offer_hourly"] as const) {
      const value = overstayFormSchema.parse({ rateSource, amountAed: "" });
      expect(value.amountFils).toBeNull();
      expect(overstaySummary(value, 10)).toContain("each started 10 minutes");
      expect(overstaySummary(value, 10)).not.toContain(rateSource);
    }
  });
});
