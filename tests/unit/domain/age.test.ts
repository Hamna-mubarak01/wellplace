import { describe, expect, it } from "vitest";

import { requireSetting, EMPTY_SNAPSHOT } from "@/lib/config";
import {
  birthYearRange,
  calculateAge,
  daysInMonth,
  isRealDate,
  type CalendarDate,
} from "@/lib/domain/age";

import { TIME_ZONES, withTimeZone } from "../support/time";


const AUG_28_2026_MORNING_UTC = new Date("2026-08-28T09:00:00.000Z");

const TURNS_18_ON_28_AUG_2026: CalendarDate = { day: 28, month: 8, year: 2008 };

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function expectedDaysInMonth(month: number, year: number): number {
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return lengths[month - 1];
}

describe("calculateAge — §6.2 'calculate and validate age using the complete date of birth'", () => {
  const born15June2000: CalendarDate = { day: 15, month: 6, year: 2000 };

  it("the day before a birthday, the guest is still the younger age", () => {
    expect(calculateAge(born15June2000, new Date("2026-06-14T09:00:00.000Z"))).toBe(25);
  });

  it("on the birthday itself, the guest is the older age", () => {
    expect(calculateAge(born15June2000, new Date("2026-06-15T09:00:00.000Z"))).toBe(26);
  });

  it("the day after a birthday, the age does not move again", () => {
    expect(calculateAge(born15June2000, new Date("2026-06-16T09:00:00.000Z"))).toBe(26);
  });

  it("the age turns over exactly once across a year boundary [§6.2 'at least 18']", () => {
    const bornNewYearsDay2008: CalendarDate = { day: 1, month: 1, year: 2008 };
    expect(calculateAge(bornNewYearsDay2008, new Date("2025-12-31T23:59:59.000Z"))).toBe(17);
    expect(calculateAge(bornNewYearsDay2008, new Date("2026-01-01T00:00:00.000Z"))).toBe(18);
    expect(calculateAge(bornNewYearsDay2008, new Date("2026-01-02T00:00:00.000Z"))).toBe(18);
  });

  it("a guest born today is 0, not 1", () => {
    expect(calculateAge({ day: 28, month: 8, year: 2026 }, AUG_28_2026_MORNING_UTC)).toBe(0);
  });

  it("the last day of the birth month before the birthday is still the younger age", () => {
    expect(calculateAge({ day: 30, month: 8, year: 2008 }, AUG_28_2026_MORNING_UTC)).toBe(17);
  });
});

describe("calculateAge — the age is the same in every time zone [INV-24, §13]", () => {
  const dubai0200 = new Date("2026-08-28T02:00:00.000+04:00");

  it("a Dubai early-morning instant and the same instant in UTC give one answer", () => {
    const sameInstantInUtc = new Date("2026-08-27T22:00:00.000Z");
    expect(dubai0200.getTime()).toBe(sameInstantInUtc.getTime());

    const fromDubaiLiteral = calculateAge(TURNS_18_ON_28_AUG_2026, dubai0200);
    const fromUtcLiteral = calculateAge(TURNS_18_ON_28_AUG_2026, sameInstantInUtc);

    expect(fromDubaiLiteral).toBe(fromUtcLiteral);
    expect(fromDubaiLiteral).toBe(17);
  });

  it("the answer does not change with the viewer's time zone, ahead of UTC or behind it", () => {
    const answers = TIME_ZONES.map((timeZone) =>
      withTimeZone(timeZone, () => calculateAge(TURNS_18_ON_28_AUG_2026, dubai0200)),
    );
    expect(new Set(answers)).toEqual(new Set([17]));
  });

  it("an instant whose UTC day is the birthday reads as the birthday everywhere", () => {
    const birthdayMorningUtc = new Date("2026-08-28T06:00:00.000Z");
    const answers = TIME_ZONES.map((timeZone) =>
      withTimeZone(timeZone, () => calculateAge(TURNS_18_ON_28_AUG_2026, birthdayMorningUtc)),
    );
    expect(new Set(answers)).toEqual(new Set([18]));
  });

  it("every hour of the birthday agrees with the UTC calendar day, in every zone", () => {
    for (const timeZone of TIME_ZONES) {
      withTimeZone(timeZone, () => {
        for (let hour = 0; hour < 24; hour += 1) {
          const stamp = `2026-08-28T${String(hour).padStart(2, "0")}:00:00.000Z`;
          expect(
            calculateAge(TURNS_18_ON_28_AUG_2026, new Date(stamp)),
            `${stamp} in ${timeZone}`,
          ).toBe(18);
        }
      });
    }
  });
});

describe("calculateAge — 29 February birth dates", () => {
  const bornLeapDay2000: CalendarDate = { day: 29, month: 2, year: 2000 };

  it("ages on the leap day itself in a leap year", () => {
    expect(calculateAge(bornLeapDay2000, new Date("2024-02-28T09:00:00.000Z"))).toBe(23);
    expect(calculateAge(bornLeapDay2000, new Date("2024-02-29T09:00:00.000Z"))).toBe(24);
    expect(calculateAge(bornLeapDay2000, new Date("2024-03-01T09:00:00.000Z"))).toBe(24);
  });

  it("ages on 1 March in a non-leap year, because 29 February does not occur", () => {
    expect(calculateAge(bornLeapDay2000, new Date("2025-02-28T09:00:00.000Z"))).toBe(24);
    expect(calculateAge(bornLeapDay2000, new Date("2025-03-01T09:00:00.000Z"))).toBe(25);
  });

  it("a leap-day guest reaches 18 on 1 March in a non-leap year [§6.2]", () => {
    const bornLeapDay2008: CalendarDate = { day: 29, month: 2, year: 2008 };
    expect(calculateAge(bornLeapDay2008, new Date("2026-02-28T23:00:00.000Z"))).toBe(17);
    expect(calculateAge(bornLeapDay2008, new Date("2026-03-01T00:00:00.000Z"))).toBe(18);
  });

  it("a leap-day birth date is a real date, and the same day in a common year is not", () => {
    expect(isRealDate(bornLeapDay2000)).toBe(true);
    expect(isRealDate({ day: 29, month: 2, year: 2025 })).toBe(false);
  });
});

describe("daysInMonth", () => {
  it("returns the length of all twelve months in a non-leap year", () => {
    const lengths = Array.from({ length: 12 }, (_, i) => daysInMonth(i + 1, 2025));
    expect(lengths).toEqual([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
  });

  it("returns the length of all twelve months in a leap year", () => {
    const lengths = Array.from({ length: 12 }, (_, i) => daysInMonth(i + 1, 2024));
    expect(lengths).toEqual([31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
  });

  it("1900 is not a leap year and 2000 is — the century rule, both ways", () => {
    expect(daysInMonth(2, 1900)).toBe(28);
    expect(daysInMonth(2, 2000)).toBe(29);
    expect(daysInMonth(2, 2100)).toBe(28);
  });

  it("agrees with the Gregorian leap rule for every month from 1900 to 2100", () => {
    for (let year = 1900; year <= 2100; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        expect(daysInMonth(month, year), `${month}/${year}`).toBe(
          expectedDaysInMonth(month, year),
        );
      }
    }
  });

  it("does not depend on the viewer's time zone", () => {
    const answers = TIME_ZONES.map((timeZone) =>
      withTimeZone(timeZone, () => [daysInMonth(2, 2024), daysInMonth(3, 2024)].join("/")),
    );
    expect(new Set(answers)).toEqual(new Set(["29/31"]));
  });
});

describe("isRealDate — an impossible date is refused before it reaches the database", () => {
  it("rejects 31 February", () => {
    expect(isRealDate({ day: 31, month: 2, year: 1995 })).toBe(false);
  });

  it("rejects 31 April", () => {
    expect(isRealDate({ day: 31, month: 4, year: 1995 })).toBe(false);
  });

  it("rejects month 0 and month 13", () => {
    expect(isRealDate({ day: 15, month: 0, year: 1995 })).toBe(false);
    expect(isRealDate({ day: 15, month: 13, year: 1995 })).toBe(false);
  });

  it("rejects day 0", () => {
    expect(isRealDate({ day: 0, month: 6, year: 1995 })).toBe(false);
  });

  it("accepts the last day of every month and rejects the day after it", () => {
    for (let month = 1; month <= 12; month += 1) {
      const last = expectedDaysInMonth(month, 1995);
      expect(isRealDate({ day: last, month, year: 1995 }), `${last}/${month}`).toBe(true);
      expect(isRealDate({ day: last + 1, month, year: 1995 }), `${last + 1}/${month}`).toBe(
        false,
      );
    }
  });
});

describe("birthYearRange — §6.2 age rules, read from the configuration registry", () => {
  const bookerMinAge = requireSetting(EMPTY_SNAPSHOT, "booking.booker_min_age");
  const childMinAge = requireSetting(EMPTY_SNAPSHOT, "booking.child_min_age");
  const childMaxAge = requireSetting(EMPTY_SNAPSHOT, "booking.child_max_age");

  const PICKER_CEILING_YEARS = 100;

  const today = AUG_28_2026_MORNING_UTC;
  const currentYear = today.getUTCFullYear();

  function yearCanProduceAgeInRange(year: number, minAge: number, maxAge: number): boolean {
    const oldest = calculateAge({ day: 1, month: 1, year }, today);
    const youngest = calculateAge({ day: 31, month: 12, year }, today);
    return youngest <= maxAge && oldest >= minAge;
  }

  it("the latest year offered is the year in which a guest turns the minimum age", () => {
    const { latest } = birthYearRange(bookerMinAge, PICKER_CEILING_YEARS, today);

    const endOfYear = new Date(Date.UTC(currentYear, 11, 31, 12));
    expect(calculateAge({ day: 1, month: 1, year: latest }, endOfYear)).toBe(bookerMinAge);
    expect(calculateAge({ day: 1, month: 1, year: latest + 1 }, endOfYear)).toBe(
      bookerMinAge - 1,
    );
  });

  it("offering a birth year is not an age gate — a guest below the minimum can still be entered", () => {
    const { latest } = birthYearRange(bookerMinAge, PICKER_CEILING_YEARS, today);
    expect(calculateAge({ day: 31, month: 12, year: latest }, today)).toBe(bookerMinAge - 1);
  });

  it("the range is inclusive and non-empty for the §6.2 child window", () => {
    const { earliest, latest } = birthYearRange(childMinAge, childMaxAge, today);
    expect(earliest).toBeLessThanOrEqual(latest);
    expect(latest - earliest).toBe(childMaxAge - childMinAge + 1);
  });

  it("every birth year that can produce a child age of 8 through 15 is inside the range [§6.2]", () => {
    const qualifying: number[] = [];
    for (let year = currentYear - 30; year <= currentYear; year += 1) {
      if (yearCanProduceAgeInRange(year, childMinAge, childMaxAge)) qualifying.push(year);
    }

    expect(birthYearRange(childMinAge, childMaxAge, today)).toEqual({
      earliest: qualifying[0],
      latest: qualifying[qualifying.length - 1],
    });
  });
});
