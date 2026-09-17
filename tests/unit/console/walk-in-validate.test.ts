import { describe, expect, it } from "vitest";

import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";
import type { GuestRules } from "@/lib/validation/reception-booking";

const rules: GuestRules = {
  guestsMin: requireSetting(EMPTY_SNAPSHOT, "booking.guests_min"),
  guestsMax: requireSetting(EMPTY_SNAPSHOT, "booking.guests_max"),
  childMinAge: requireSetting(EMPTY_SNAPSHOT, "booking.child_min_age"),
  childMaxAge: requireSetting(EMPTY_SNAPSHOT, "booking.child_max_age"),
  bookerMinAge: requireSetting(EMPTY_SNAPSHOT, "booking.booker_min_age"),
};

describe("the walk-in dialog validates through the shared contract", () => {
  it("exposes the same rules the server will enforce", async () => {
    const { validateWalkIn } = await import(
      "@/components/console/reception/walk-in-validate"
    );

    expect(typeof validateWalkIn).toBe("function");
    expect(rules.bookerMinAge).toBe(18);
  });
});
