import { describe, expect, it } from "vitest";

import { referenceParts } from "@/components/console/shared/reference-display";

describe("[OUR CHOICE — project owner's direction, 13 September 2026] the WP number is the headline, the provider reference is secondary", () => {
  it("shows the WP reference as primary and the provider reference underneath", () => {
    expect(referenceParts("WP-P1001", "SIM-abc123")).toEqual({ primary: "WP-P1001", secondary: "SIM-abc123" });
    expect(referenceParts("WP-R1002", "TRM-88")).toEqual({ primary: "WP-R1002", secondary: "TRM-88" });
  });

  it("omits the secondary line when there is no provider reference", () => {
    expect(referenceParts("WP-P1001", null)).toEqual({ primary: "WP-P1001", secondary: null });
    expect(referenceParts("WP-P1001", undefined)).toEqual({ primary: "WP-P1001", secondary: null });
  });

  it("falls back to the provider reference as primary when no WP reference is stored", () => {
    expect(referenceParts(undefined, "SIM-abc123")).toEqual({ primary: "SIM-abc123", secondary: null });
    expect(referenceParts(null, "SIM-abc123")).toEqual({ primary: "SIM-abc123", secondary: null });
  });

  it("has nothing to show when neither reference exists", () => {
    expect(referenceParts(undefined, undefined)).toEqual({ primary: null, secondary: null });
    expect(referenceParts(null, null)).toEqual({ primary: null, secondary: null });
  });
});
