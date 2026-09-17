import { describe, expect, it } from "vitest";

import { contactSubmissionSchema } from "@/lib/validation/contact";

function validSubmission() {
  return {
    firstName: "Amina",
    lastName: "Haddad",
    email: "amina@example.test",
    phone: { e164: "+971501234567", countryIso2: "ae" },
    message: "I would like help planning a private group visit.",
    termsAccepted: true,
    website: "",
  };
}

describe("contactSubmissionSchema — §4.3 contact form", () => {
  it("normalises and accepts a complete enquiry", () => {
    const parsed = contactSubmissionSchema.safeParse(validSubmission());

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toEqual({
      firstName: "Amina",
      lastName: "Haddad",
      email: "amina@example.test",
      phone: { e164: "+971501234567", countryIso2: "AE" },
      message: "I would like help planning a private group visit.",
      termsAccepted: true,
      website: "",
    });
  });

  it("accepts an empty optional mobile number", () => {
    const parsed = contactSubmissionSchema.safeParse({
      ...validSubmission(),
      phone: { e164: "", countryIso2: "ae" },
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects malformed mobile numbers", () => {
    const parsed = contactSubmissionSchema.safeParse({
      ...validSubmission(),
      phone: { e164: "050 123", countryIso2: "ae" },
    });

    expect(parsed.success).toBe(false);
    expect(
      parsed.success === false &&
        parsed.error.issues.some((issue) => issue.path.join(".") === "phone.e164"),
    ).toBe(true);
  });

  it("requires acceptance of the Legal, Privacy & Marketing Terms", () => {
    const parsed = contactSubmissionSchema.safeParse({
      ...validSubmission(),
      termsAccepted: false,
    });

    expect(parsed.success).toBe(false);
    expect(
      parsed.success === false &&
        parsed.error.issues.some((issue) => issue.path.join(".") === "termsAccepted"),
    ).toBe(true);
  });

  it("rejects a message that is too short to be actionable", () => {
    const parsed = contactSubmissionSchema.safeParse({
      ...validSubmission(),
      message: "Hello",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects a filled honeypot as spam", () => {
    const parsed = contactSubmissionSchema.safeParse({
      ...validSubmission(),
      website: "https://spam.example",
    });

    expect(parsed.success).toBe(false);
    expect(
      parsed.success === false &&
        parsed.error.issues.some((issue) => issue.path.join(".") === "website"),
    ).toBe(true);
  });
});
