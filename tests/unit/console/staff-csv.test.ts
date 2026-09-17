import { describe, expect, it } from "vitest";

import type { StaffRow } from "@/lib/db/queries/staff";
import {
  STAFF_CSV_COLUMNS,
  staffCsv,
  staffCsvFilename,
  staffCsvRow,
  staffXlsxFilename,
} from "@/lib/console/staff-csv";

function member(overrides: Partial<StaffRow> = {}): StaffRow {
  return {
    id: "8f80a15b-990d-4faa-8197-aa0c3da6a6c0",
    email: "amina@example.com",
    fullName: "Amina Haddad",
    role: "management",
    isActive: true,
    createdAt: "2026-08-29T18:36:00.000Z",
    ...overrides,
  };
}

describe("staffCsv — Management staff export [OUR CHOICE]", () => {
  it("starts with an Excel-friendly BOM and one row per staff member", () => {
    const csv = staffCsv([member(), member({ email: "second@example.com" })]);
    const lines = csv.replace("﻿", "").trimEnd().split("\r\n");

    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(STAFF_CSV_COLUMNS.join(","));
  });

  it("exports the visible staff fields and uses Dubai time", () => {
    const row = staffCsvRow(member());

    expect(row).toContain("Amina Haddad");
    expect(row).toContain("amina@example.com");
    expect(row).toContain("Management");
    expect(row).toContain("Active");
    expect(row).toContain("29 August 2026 at 22:36");
  });

  it("labels inactive Reception access plainly", () => {
    const row = staffCsvRow(
      member({ role: "reception", isActive: false }),
    );

    expect(row).toContain("Reception");
    expect(row).toContain("Deactivated");
  });

  it("quotes commas and neutralises spreadsheet formulas", () => {
    const row = staffCsvRow(
      member({ fullName: '=HYPERLINK("https://evil.test"), Admin' }),
    );

    expect(row).toContain('"\t=HYPERLINK(""https://evil.test""), Admin"');
    expect(row).not.toMatch(/^=/);
  });

  it("uses the Dubai date and export scope in the filename", () => {
    expect(
      staffCsvFilename(new Date("2026-08-31T20:00:00.000Z"), "filtered"),
    ).toBe("wellplace-staff-filtered-2026-09-01.csv");
  });

  it("uses the same Dubai date and scope for an Excel filename", () => {
    expect(
      staffXlsxFilename(new Date("2026-08-31T20:00:00.000Z"), "all"),
    ).toBe("wellplace-staff-all-2026-09-01.xlsx");
  });
});
