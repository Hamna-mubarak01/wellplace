import { describe, expect, it } from "vitest";

import { formatAed, parseAed, toAedInput } from "@/components/shared/money";
import { resolveAgreedPrice } from "@/components/console/reception/walk-in-validate";

describe("§11.2 / INV-20 — a complimentary booking is never priced", () => {
  it("forces the agreed price to zero and treats it as supplied", () => {
    expect(resolveAgreedPrice("complimentary", "")).toEqual({
      manualTotalFils: 0,
      supplied: true,
      malformed: false,
    });
  });

  it("ignores whatever was typed before the source was switched", () => {
    expect(resolveAgreedPrice("complimentary", "450.00").manualTotalFils).toBe(0);
  });
});

describe("§6.4 — the agreed price for a Reception booking", () => {
  it("is not supplied when the field is empty", () => {
    expect(resolveAgreedPrice("walk_in", "   ")).toEqual({
      manualTotalFils: null,
      supplied: false,
      malformed: false,
    });
  });

  it("reads whole and fractional AED into integer fils", () => {
    expect(resolveAgreedPrice("walk_in", "450").manualTotalFils).toBe(45_000);
    expect(resolveAgreedPrice("walk_in", "450.50").manualTotalFils).toBe(45_050);
  });

  it("flags something that is not a price rather than guessing", () => {
    const result = resolveAgreedPrice("telephone", "four hundred");

    expect(result.malformed).toBe(true);
    expect(result.manualTotalFils).toBeNull();
  });
});

describe("money formatting stays in integer fils", () => {
  it("round-trips every price through the input formatter without drift", () => {
    for (const fils of [0, 5, 99, 100, 45_050, 1_234_567]) {
      expect(parseAed(toAedInput(fils))).toBe(fils);
    }
  });

  it("formats for display in AED with two minor digits and thousands separators", () => {
    expect(formatAed(45_050)).toBe("AED 450.50");
    expect(formatAed(0)).toBe("AED 0.00");
    expect(formatAed(1_234_567)).toBe("AED 12,345.67");
  });

  it("refuses a display-formatted amount as input, rather than silently truncating it", () => {
    expect(parseAed("12,345.67")).toBeNull();
    expect(parseAed("AED 450.00")).toBeNull();
  });
});
