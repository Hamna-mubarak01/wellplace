import { describe, expect, it } from "vitest";

import type { WaitlistLead } from "@/lib/db/queries/waitlist-leads";
import {
  WAITLIST_CSV_COLUMNS,
  waitlistCsv,
  waitlistCsvFilename,
  waitlistCsvRow,
  waitlistXlsxFilename,
} from "@/lib/console/waitlist-csv";

function lead(overrides: Partial<WaitlistLead> = {}): WaitlistLead {
  return {
    id: "8f80a15b-990d-4faa-8197-aa0c3da6a6c0",
    salutation: "ms",
    termsAcceptanceVersion: "1.3",
    firstName: "Amina",
    lastName: "Haddad",
    email: "amina@example.com",
    ageYears: 34,
    phoneE164: "+971500000000",
    phoneCountry: "AE",
    source: null,
    utmCampaign: null,
    signupCount: 1,
    createdAt: "2026-08-31T06:30:00.000Z",
    archivedAt: null,
    ...overrides,
  };
}

describe("waitlistCsv — the §5.2 export", () => {
  it("puts the header first and one line per lead, CRLF separated", () => {
    const csv = waitlistCsv([lead(), lead({ email: "second@example.com" })]);
    const lines = csv.replace("﻿", "").trimEnd().split("\r\n");

    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(WAITLIST_CSV_COLUMNS.join(","));
  });

  it("starts with a UTF-8 BOM so Excel does not mangle a non-ASCII name", () => {
    expect(waitlistCsv([lead({ lastName: "Ünlü" })]).startsWith("﻿")).toBe(true);
  });

  it("renders the fields a manager actually needs", () => {
    const row = waitlistCsvRow(lead());

    expect(row).toContain("Ms.");
    expect(row).toContain("Amina");
    expect(row).toContain("amina@example.com");
    expect(row).toContain("+971500000000");
    expect(row).toContain("1.3");
  });

  it("shows an untagged signup as Direct rather than as an empty cell", () => {
    expect(waitlistCsvRow(lead({ source: null }))).toContain("Direct");
  });

  it("times are Dubai time, never UTC [INV-24]", () => {
    expect(waitlistCsvRow(lead())).toContain("10:30");
  });
});

describe("field escaping — a name must not become two columns", () => {
  it("quotes a value containing a comma and doubles its own quotes", () => {
    const row = waitlistCsvRow(lead({ lastName: 'O"Brien, Jr.' }));
    expect(row).toContain('"O""Brien, Jr."');
  });

  it("quotes a value containing a newline", () => {
    expect(waitlistCsvRow(lead({ firstName: "Two\nLines" }))).toContain('"Two\nLines"');
  });

  it("keeps every row on the same number of fields, whatever is in them", () => {
    const nasty = lead({ firstName: 'a,b', lastName: 'c"d', source: "e\nf" });
    const fields = (waitlistCsvRow(nasty).match(/(^|,)(?:"(?:[^"]|"")*"|[^,]*)/g) ?? []).length;
    expect(fields).toBe(WAITLIST_CSV_COLUMNS.length);
  });
});

describe("formula injection — a spreadsheet must not execute a signup", () => {
  for (const prefix of ["=", "+", "-", "@"]) {
    it(`neutralises a field starting with ${prefix}`, () => {
      const row = waitlistCsvRow(lead({ firstName: `${prefix}HYPERLINK("http://evil")` }));

      expect(row).toContain(`\t${prefix}HYPERLINK`);
      expect(row).not.toMatch(new RegExp(`(^|,)\\${prefix}HYPERLINK`));
    });
  }

  it("leaves an ordinary name untouched", () => {
    expect(waitlistCsvRow(lead({ firstName: "Amina" }))).toContain(",Amina,");
  });
});

describe("waitlistCsvFilename", () => {
  it("names the file by Dubai date and scope, so a folder sorts chronologically", () => {
    const name = waitlistCsvFilename(new Date("2026-08-31T20:00:00.000Z"), "active");
    expect(name).toBe("wellplace-waitlist-active-2026-09-01.csv");
  });

  it("uses the same Dubai date and scope for an Excel filename", () => {
    const name = waitlistXlsxFilename(
      new Date("2026-08-31T20:00:00.000Z"),
      "archived",
    );
    expect(name).toBe("wellplace-waitlist-archived-2026-09-01.xlsx");
  });
});

describe("[§Waitlist export] consent and attribution", () => {
  it("exports DOB independently of age, separate UTM values and archived status", () => {
    const row = waitlistCsvRow(lead({ dateOfBirth: "1992-02-09", ageYears: 34,
      marketingGranted: false, marketingConsentAt: "2026-09-01T08:00:00Z",
      termsAcceptanceText: "I agree, to the approved wording.", referrer: "https://example.com/landing",
      utmSource: "newsletter", utmMedium: "email", utmCampaign: "launch", utmContent: "hero", utmTerm: "wellness",
      archivedAt: "2026-09-02T08:00:00Z" }));
    expect(row).toContain("09-02-1992,34");
    expect(row).toContain("Withdrawn");
    expect(row).toContain('"I agree, to the approved wording."');
    expect(row).toContain("newsletter,email,launch,hero,wellness,Archived");
    expect(row).toContain("12:00");
  });
  it("does not invent marketing consent for manually added or legacy entries", () => {
    expect(waitlistCsvRow(lead({ marketingGranted: null }))).toContain("Not recorded");
    expect(waitlistCsvRow(lead({ marketingGranted: true }))).toContain("Subscribed");
  });
});
