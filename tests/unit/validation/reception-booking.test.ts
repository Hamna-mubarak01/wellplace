import { describe, expect, it } from "vitest";

import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";
import {
  RECEPTION_SOURCES,
  checkGuestRules,
  receptionBookingSchema,
  type GuestRules,
} from "@/lib/validation/reception-booking";

const rules: GuestRules = {
  guestsMin: requireSetting(EMPTY_SNAPSHOT, "booking.guests_min"),
  guestsMax: requireSetting(EMPTY_SNAPSHOT, "booking.guests_max"),
  childMinAge: requireSetting(EMPTY_SNAPSHOT, "booking.child_min_age"),
  childMaxAge: requireSetting(EMPTY_SNAPSHOT, "booking.child_max_age"),
  bookerMinAge: requireSetting(EMPTY_SNAPSHOT, "booking.booker_min_age"),
};

const valid = {
  source: "walk_in" as const,
  salutation: "ms" as const,
  firstName: "Amina",
  lastName: "Khan",
  email: "amina@example.ae",
  dateOfBirth: { day: 4, month: 6, year: 1990 },
  phone: { e164: "+971501234567", countryIso2: "AE" },
  startsAt: "2026-09-14T10:00:00+04:00",
  durationHours: 3,
  adults: 2,
  children: [],
  addons: [],
  manualTotalFils: null,
  acceptedTerms: true as const,
  paymentMethod: "card_terminal" as const,
};

describe("§9.2 — Reception creates walk-in, telephone, manual and complimentary bookings", () => {
  it("offers exactly the four sources the contract names, and never online", () => {
    expect([...RECEPTION_SOURCES]).toEqual([
      "walk_in",
      "telephone",
      "manual",
      "complimentary",
    ]);
    expect(RECEPTION_SOURCES).not.toContain("online");
  });

  it("accepts a complete walk-in", () => {
    expect(receptionBookingSchema.safeParse(valid).success).toBe(true);
  });

  it("§6.3 — refuses a booking whose terms were not accepted", () => {
    const result = receptionBookingSchema.safeParse({
      ...valid,
      acceptedTerms: false,
    });

    expect(result.success).toBe(false);
  });

  it("refuses an impossible date of birth", () => {
    expect(
      receptionBookingSchema.safeParse({
        ...valid,
        dateOfBirth: { day: 31, month: 2, year: 1990 },
      }).success,
    ).toBe(false);
  });

  it("refuses a mobile number that is not E.164", () => {
    expect(
      receptionBookingSchema.safeParse({
        ...valid,
        phone: { e164: "0501234567", countryIso2: "AE" },
      }).success,
    ).toBe(false);
  });

  it("refuses a start time with no offset, because Dubai is a display concern", () => {
    expect(
      receptionBookingSchema.safeParse({ ...valid, startsAt: "2026-09-14T10:00:00" })
        .success,
    ).toBe(false);
  });
});

describe("§6.2 — age, children and guest count", () => {
  it("reads every rule from configuration, never a literal", () => {
    expect(rules.guestsMin).toBe(2);
    expect(rules.guestsMax).toBe(5);
    expect(rules.childMinAge).toBe(8);
    expect(rules.childMaxAge).toBe(15);
    expect(rules.bookerMinAge).toBe(18);
  });

  it("accepts two adults", () => {
    expect(
      checkGuestRules({ adults: 2, children: [], bookerAge: 34 }, rules),
    ).toBeNull();
  });

  it("requires at least one adult", () => {
    expect(
      checkGuestRules({ adults: 0, children: [{ age: 10 }], bookerAge: 34 }, rules)
        ?.code,
    ).toBe("no_adult");
  });

  it("counts children toward the maximum of five", () => {
    expect(
      checkGuestRules(
        { adults: 2, children: [{ age: 9 }, { age: 11 }, { age: 13 }], bookerAge: 34 },
        rules,
      ),
    ).toBeNull();

    expect(
      checkGuestRules(
        {
          adults: 2,
          children: [{ age: 9 }, { age: 11 }, { age: 13 }, { age: 15 }],
          bookerAge: 34,
        },
        rules,
      )?.code,
    ).toBe("too_many_guests");
  });

  it("refuses fewer than the minimum", () => {
    expect(
      checkGuestRules({ adults: 1, children: [], bookerAge: 34 }, rules)?.code,
    ).toBe("too_few_guests");
  });

  it("refuses a child under eight", () => {
    expect(
      checkGuestRules({ adults: 2, children: [{ age: 7 }], bookerAge: 34 }, rules)
        ?.code,
    ).toBe("child_too_young");
  });

  it("accepts a child of exactly eight and of exactly fifteen", () => {
    expect(
      checkGuestRules({ adults: 1, children: [{ age: 8 }], bookerAge: 34 }, rules),
    ).toBeNull();
    expect(
      checkGuestRules({ adults: 1, children: [{ age: 15 }], bookerAge: 34 }, rules),
    ).toBeNull();
  });

  it("treats sixteen as an adult rather than a child", () => {
    expect(
      checkGuestRules({ adults: 2, children: [{ age: 16 }], bookerAge: 34 }, rules)
        ?.code,
    ).toBe("child_too_old");
  });

  it("refuses a booker under eighteen", () => {
    expect(
      checkGuestRules({ adults: 2, children: [], bookerAge: 17 }, rules)?.code,
    ).toBe("booker_too_young");
  });

  it("accepts a booker of exactly eighteen", () => {
    expect(
      checkGuestRules({ adults: 2, children: [], bookerAge: 18 }, rules),
    ).toBeNull();
  });
});
