import { afterEach, describe, expect, it, vi } from "vitest";

import { calculateAge as calculateAgeFromDomain } from "@/lib/domain/age";
import {
  attributionSchema,
  calculateAge as calculateAgeFromValidation,
  dateOfBirthSchema,
  phoneSchema,
  waitlistSubmissionSchema,
} from "@/lib/validation/waitlist";

import { withTimeZone } from "../support/time";

const FROZEN_NOW_UTC = new Date("2026-08-28T09:00:00.000Z");

function validSubmission() {
  return {
    salutation: "ms",
    firstName: "Testguest",
    lastName: "Fixture",
    email: "waitlist.fixture@example.com",
    dateOfBirth: { day: 4, month: 7, year: 1990 },
    phone: { e164: "+971500000000", countryIso2: "ae" },
    termsAccepted: true,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("waitlistSubmissionSchema — §5.2 waitlist capture", () => {
  it("a valid submission is parsed", () => {
    const result = waitlistSubmissionSchema.safeParse(validSubmission());

    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual({
      salutation: "ms",
      firstName: "Testguest",
      lastName: "Fixture",
      email: "waitlist.fixture@example.com",
      dateOfBirth: { day: 4, month: 7, year: 1990 },
      phone: { e164: "+971500000000", countryIso2: "AE" },
      attribution: {},
      termsAccepted: true,
    });
  });

  it("carries no marketing consent field at all — one required tick is the whole of it [CLIENT 31 Aug 2026]", () => {
    const parsed = waitlistSubmissionSchema.safeParse(validSubmission());
    expect(parsed.success).toBe(true);
    expect(parsed.success && Object.keys(parsed.data)).not.toContain("marketingConsent");
  });

  it("a submission that still sends marketingConsent has it stripped, never stored", () => {
    const parsed = waitlistSubmissionSchema.safeParse({
      ...validSubmission(),
      marketingConsent: true,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && Object.keys(parsed.data)).not.toContain("marketingConsent");
  });

  it("attribution defaults when absent — a guest typing the URL directly is a normal signup", () => {
    const parsed = waitlistSubmissionSchema.safeParse(validSubmission());
    expect(parsed.success && parsed.data.attribution).toEqual({});
  });

  it("attribution is carried through when the campaign supplied it [§5.4]", () => {
    const parsed = waitlistSubmissionSchema.safeParse({
      ...validSubmission(),
      attribution: {
        source: "instagram",
        referrer: "https://example.com/campaign",
        utmSource: "instagram",
        utmMedium: "paid_social",
        utmCampaign: "wellplace-launch",
        utmContent: "carousel-a",
        utmTerm: "spa-dubai",
      },
    });

    expect(parsed.success && parsed.data.attribution.utmCampaign).toBe("wellplace-launch");
    expect(parsed.success && parsed.data.attribution.utmMedium).toBe("paid_social");
  });

  it("the honeypot rejects a non-empty value — §5.2 'include spam protection'", () => {
    const result = waitlistSubmissionSchema.safeParse({
      ...validSubmission(),
      website: "https://spam.example/buy",
    });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error.issues.map((i) => i.path.join("."))).toContain(
      "website",
    );
  });

  it("the honeypot accepts the empty string a real visitor leaves behind", () => {
    expect(waitlistSubmissionSchema.safeParse({ ...validSubmission(), website: "" }).success).toBe(
      true,
    );
  });

  it("an email over 254 characters is rejected", () => {
    const tooLong = `${"a".repeat(250)}@example.com`;
    expect(tooLong.length).toBeGreaterThan(254);

    const result = waitlistSubmissionSchema.safeParse({ ...validSubmission(), email: tooLong });

    expect(result.success).toBe(false);
    expect(
      result.success === false &&
        result.error.issues.some((i) => i.path.join(".") === "email" && i.code === "too_big"),
    ).toBe(true);
  });

  it("an email of exactly 254 characters is accepted — the RFC 5321 limit, not one below it", () => {
    const local = "a".repeat(254 - "@example.com".length);
    const atLimit = `${local}@example.com`;
    expect(atLimit.length).toBe(254);
    expect(waitlistSubmissionSchema.safeParse({ ...validSubmission(), email: atLimit }).success).toBe(
      true,
    );
  });

  it("a missing name is refused with the wording the guest will read [§5.5]", () => {
    const result = waitlistSubmissionSchema.safeParse({ ...validSubmission(), firstName: "   " });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error.issues[0].message).toBe(
      "Enter your first name.",
    );
  });

  it("the terms checkbox is required — an unticked box is refused [§6.3, CONFIRMED v1.3]", () => {
    const result = waitlistSubmissionSchema.safeParse({
      ...validSubmission(),
      termsAccepted: false,
    });

    expect(result.success).toBe(false);
    expect(
      result.success === false && result.error.issues.map((i) => i.path.join(".")),
    ).toContain("termsAccepted");
  });

  it("an unticked box is refused with the wording the guest will read [§5.5]", () => {
    const result = waitlistSubmissionSchema.safeParse({
      ...validSubmission(),
      termsAccepted: false,
    });

    const issue =
      result.success === false
        ? result.error.issues.find((i) => i.path.join(".") === "termsAccepted")
        : undefined;

    expect(issue?.message).toBe(
      "Please accept the Legal, Privacy & Marketing Terms to join.",
    );
  });

  it("an absent terms field is refused too — it is never optional and never defaulted", () => {
    const { termsAccepted: _omitted, ...withoutTerms } = validSubmission();
    void _omitted;

    const result = waitlistSubmissionSchema.safeParse(withoutTerms);

    expect(result.success).toBe(false);
    expect(
      result.success === false && result.error.issues.map((i) => i.path.join(".")),
    ).toContain("termsAccepted");
  });

  it("a ticked box passes and the acceptance reaches the service, not just the component", () => {
    const parsed = waitlistSubmissionSchema.safeParse({
      ...validSubmission(),
      termsAccepted: true,
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.termsAccepted).toBe(true);
  });

  it("the one tick is the whole consent decision [CLIENT 31 Aug 2026]", () => {
    const parsed = waitlistSubmissionSchema.safeParse({
      ...validSubmission(),
      termsAccepted: true,
    });

    expect(parsed.success && parsed.data.termsAccepted).toBe(true);
  });

  it("§5.2 offers exactly Mr. and Ms., so nothing else parses", () => {
    expect(waitlistSubmissionSchema.safeParse({ ...validSubmission(), salutation: "mr" }).success).toBe(
      true,
    );
    expect(waitlistSubmissionSchema.safeParse({ ...validSubmission(), salutation: "dr" }).success).toBe(
      false,
    );
  });
});

describe("dateOfBirthSchema — §5.2 'the full date of birth through three separate dropdowns'", () => {
  it("an impossible date is rejected", () => {
    const result = dateOfBirthSchema.safeParse({ day: 31, month: 2, year: 1995 });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error.issues[0].message).toBe(
      "That date does not exist. Check the day and month.",
    );
  });

  it("29 February is rejected in a common year and accepted in a leap year", () => {
    expect(dateOfBirthSchema.safeParse({ day: 29, month: 2, year: 1995 }).success).toBe(false);
    expect(dateOfBirthSchema.safeParse({ day: 29, month: 2, year: 1996 }).success).toBe(true);
  });

  it("the three dropdown values arrive as strings and are coerced", () => {
    const parsed = dateOfBirthSchema.safeParse({ day: "4", month: "7", year: "1990" });
    expect(parsed.success && parsed.data).toEqual({ day: 4, month: 7, year: 1990 });
  });

  it("a future year is rejected", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FROZEN_NOW_UTC);

    expect(dateOfBirthSchema.safeParse({ day: 1, month: 1, year: 2027 }).success).toBe(false);
    expect(dateOfBirthSchema.safeParse({ day: 1, month: 1, year: 2026 }).success).toBe(true);
  });

  it("a future year is rejected in the guest's own time zone too [INV-24]", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-31T22:00:00.000Z"));

    withTimeZone("Asia/Dubai", () => {
      expect(new Date().getFullYear()).toBe(2027);
      expect(dateOfBirthSchema.safeParse({ day: 1, month: 1, year: 2027 }).success).toBe(false);
    });
  });

  it("a year before 1900 is rejected, matching the column's lower bound", () => {
    expect(dateOfBirthSchema.safeParse({ day: 1, month: 1, year: 1899 }).success).toBe(false);
    expect(dateOfBirthSchema.safeParse({ day: 1, month: 1, year: 1900 }).success).toBe(true);
  });

  it("day 0, month 0 and month 13 never reach the date check", () => {
    expect(dateOfBirthSchema.safeParse({ day: 0, month: 6, year: 1990 }).success).toBe(false);
    expect(dateOfBirthSchema.safeParse({ day: 15, month: 0, year: 1990 }).success).toBe(false);
    expect(dateOfBirthSchema.safeParse({ day: 15, month: 13, year: 1990 }).success).toBe(false);
  });
});

describe("phoneSchema — §5.2 mobile number with the country kept alongside it", () => {
  it("a non-E.164 phone is rejected", () => {
    const rejected = [
      "0501234567",
      "971500000000",
      "+0501234567",
      "+97150",
      "+9715000000000000",
      "+971 50 000 0000",
      "+971-50-0000000",
      "",
    ];

    for (const e164 of rejected) {
      expect(phoneSchema.safeParse({ e164, countryIso2: "AE" }).success, e164).toBe(false);
    }
  });

  it("a UAE number in E.164 is accepted and the country is normalised", () => {
    const parsed = phoneSchema.safeParse({ e164: "+971500000000", countryIso2: "ae" });
    expect(parsed.success && parsed.data).toEqual({ e164: "+971500000000", countryIso2: "AE" });
  });

  it("the country is two letters, so a shared dial code still round-trips", () => {
    expect(phoneSchema.safeParse({ e164: "+12025550100", countryIso2: "USA" }).success).toBe(false);
    expect(phoneSchema.safeParse({ e164: "+12025550100", countryIso2: "" }).success).toBe(false);
    expect(phoneSchema.safeParse({ e164: "+12025550100", countryIso2: "ca" }).success).toBe(true);
  });
});

describe("attributionSchema — §5.4 'UTM source, medium, campaign, content and term'", () => {
  it("every field is optional", () => {
    const parsed = attributionSchema.safeParse({});
    expect(parsed.success && parsed.data).toEqual({});
  });

  it("carries the five UTM fields §5.4 names, plus source and referrer", () => {
    const parsed = attributionSchema.safeParse({
      source: "qr-poster",
      referrer: "https://example.com/",
      utmSource: "newsletter",
      utmMedium: "email",
      utmCampaign: "soft-launch",
      utmContent: "footer-link",
      utmTerm: "onsen",
    });
    expect(parsed.success && Object.keys(parsed.data).sort()).toEqual([
      "referrer",
      "source",
      "utmCampaign",
      "utmContent",
      "utmMedium",
      "utmSource",
      "utmTerm",
    ]);
  });

  it("an over-long referrer is refused rather than truncated", () => {
    const prefix = "https://example.com/";
    const atLimit = prefix + "x".repeat(2048 - prefix.length);
    expect(atLimit.length).toBe(2048);

    expect(attributionSchema.safeParse({ referrer: `${atLimit}x` }).success).toBe(false);
    expect(attributionSchema.safeParse({ referrer: atLimit }).success).toBe(true);
  });

  it("a referrer that is not an http or https URL is refused", () => {
    for (const referrer of ["javascript:alert(1)", "data:text/html,x", "example.com", "//evil"]) {
      expect(attributionSchema.safeParse({ referrer }).success, referrer).toBe(false);
    }
    expect(attributionSchema.safeParse({ referrer: "" }).success).toBe(true);
    expect(attributionSchema.safeParse({ referrer: "http://example.com/a" }).success).toBe(true);
  });

  it("an attribution value that a spreadsheet would execute is refused [§5.2 export]", () => {
    for (const utmCampaign of ["=1+1", "+1", "-1", "@SUM(A1)", "\tcmd", "\rcmd"]) {
      expect(attributionSchema.safeParse({ utmCampaign }).success, utmCampaign).toBe(false);
    }
    expect(attributionSchema.safeParse({ utmCampaign: "summer-2026" }).success).toBe(true);
  });

  it("a control character in an attribution value is refused — a CRLF splits a CSV row", () => {
    expect(attributionSchema.safeParse({ utmSource: "news\r\nletter" }).success).toBe(false);
    expect(attributionSchema.safeParse({ utmSource: "news\u0000letter" }).success).toBe(false);
    expect(attributionSchema.safeParse({ referrer: "https://example.com/\nx" }).success).toBe(false);
  });

  it("an attribution value longer than 255 characters is refused", () => {
    expect(attributionSchema.safeParse({ utmTerm: "x".repeat(256) }).success).toBe(false);
    expect(attributionSchema.safeParse({ utmTerm: "x".repeat(255) }).success).toBe(true);
  });
});

describe("the age rule exists exactly once [INV-24]", () => {
  it("the schema re-exports the domain function rather than owning a second copy", () => {
    expect(calculateAgeFromValidation).toBe(calculateAgeFromDomain);
  });
});
