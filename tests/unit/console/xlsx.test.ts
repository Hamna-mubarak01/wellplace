import { Workbook } from "exceljs";
import { describe, expect, it } from "vitest";

import { parseExportFormat } from "@/lib/console/export-format";
import type { StaffRow } from "@/lib/db/queries/staff";
import type { WaitlistLead } from "@/lib/db/queries/waitlist-leads";
import { STAFF_CSV_COLUMNS } from "@/lib/console/staff-csv";
import { staffXlsx } from "@/lib/console/staff-xlsx";
import { WAITLIST_CSV_COLUMNS } from "@/lib/console/waitlist-csv";
import { waitlistXlsx } from "@/lib/console/waitlist-xlsx";

const MEMBER: StaffRow = {
  id: "8f80a15b-990d-4faa-8197-aa0c3da6a6c0",
  email: "amina@example.com",
  fullName: "Amina Haddad",
  role: "management",
  isActive: true,
  createdAt: "2026-08-29T18:36:00.000Z",
};

const LEAD: WaitlistLead = {
  id: "d7241828-7ef1-4c3e-aadc-8d9a4e21af64",
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
  signupCount: 2,
  createdAt: "2026-08-31T06:30:00.000Z",
  archivedAt: null,
};

async function openWorkbook(data: ArrayBuffer): Promise<Workbook> {
  const workbook = new Workbook();
  await workbook.xlsx.load(data);
  return workbook;
}

describe("management Excel exports [OUR CHOICE]", () => {
  it("creates a real waitlist workbook with headers, filters, and numeric values", async () => {
    const workbook = await openWorkbook(await waitlistXlsx([LEAD]));
    const sheet = workbook.getWorksheet("Waitlist");

    expect(sheet).toBeDefined();
    expect(sheet?.getRow(1).values).toEqual([undefined, ...WAITLIST_CSV_COLUMNS]);
    expect(sheet?.getCell("B2").value).toBe("Amina");
    expect(sheet?.getCell("H2").value).toBe(34);
    expect(sheet?.getCell("I2").value).toBe(2);
    expect(sheet?.autoFilter).toBeDefined();
    expect(sheet?.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
  });

  it("creates a staff workbook and keeps dangerous input as inert text", async () => {
    const workbook = await openWorkbook(
      await staffXlsx([{ ...MEMBER, fullName: "=HYPERLINK(\"https://evil.test\")" }]),
    );
    const sheet = workbook.getWorksheet("Staff");

    expect(sheet?.getRow(1).values).toEqual([undefined, ...STAFF_CSV_COLUMNS]);
    expect(sheet?.getCell("A2").value).toBe(
      "\t=HYPERLINK(\"https://evil.test\")",
    );
    expect(sheet?.getCell("C2").value).toBe("Management");
    expect(sheet?.getCell("D2").value).toBe("Active");
  });
});

describe("parseExportFormat [OUR CHOICE]", () => {
  it("selects XLSX explicitly and safely defaults every other value to CSV", () => {
    expect(parseExportFormat("xlsx")).toBe("xlsx");
    expect(parseExportFormat("csv")).toBe("csv");
    expect(parseExportFormat("pdf")).toBe("csv");
    expect(parseExportFormat(null)).toBe("csv");
  });
});
