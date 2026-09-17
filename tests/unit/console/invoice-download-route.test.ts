import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireManagement: vi.fn(),
  createClient: vi.fn(),
  findInvoice: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireManagement: mocks.requireManagement }));
vi.mock("@/lib/db/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/db/queries/invoices", () => ({ findInvoice: mocks.findInvoice }));

import { GET } from "@/app/api/console/invoices/[id]/route";
import { taxDocumentPdfFilename } from "@/lib/documents/tax-document-pdf";
import { SAMPLE_INVOICE_ID, SUITE_WITH_NUMBER, sampleInvoice } from "../support/invoice";

function call(id: string) {
  return GET(new Request(`https://wellplace.test/api/console/invoices/${id}`), { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireManagement.mockResolvedValue({ role: "management" });
  mocks.createClient.mockResolvedValue({});
  mocks.findInvoice.mockResolvedValue({ outcome: "found", invoice: sampleInvoice() });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("[Project owner's direction 2026-09-11] downloading a tax invoice from the console", () => {
  it("checks the Management session before reading anything", async () => {
    mocks.requireManagement.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

    await expect(call(SAMPLE_INVOICE_ID)).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.findInvoice).not.toHaveBeenCalled();
  });

  it("returns the invoice as a private, never-indexed PDF attachment", async () => {
    const response = await call(SAMPLE_INVOICE_ID);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="${taxDocumentPdfFilename("INV-2026-000042")}"`,
    );
    expect(taxDocumentPdfFilename("INV-2026-000042")).toMatch(/INV-2026-000042\.pdf$/);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(new TextDecoder().decode((await response.arrayBuffer()).slice(0, 4))).toBe("%PDF");
  });

  it("[INV-01] never puts the suite in the downloaded file", async () => {
    const body = await (await call(SAMPLE_INVOICE_ID)).text();

    expect(body).toContain("INV-2026-000042");
    expect(body).not.toMatch(/suite/i);
    expect(body).not.toMatch(SUITE_WITH_NUMBER);
  });

  it("answers 404 for an unknown or malformed id and 503 when the invoice cannot be read", async () => {
    expect((await call("not-a-uuid")).status).toBe(404);
    expect(mocks.findInvoice).not.toHaveBeenCalled();

    mocks.findInvoice.mockResolvedValueOnce({ outcome: "not_found" });
    expect((await call(SAMPLE_INVOICE_ID)).status).toBe(404);

    mocks.findInvoice.mockResolvedValueOnce({ outcome: "failed", message: "unavailable" });
    const failed = await call(SAMPLE_INVOICE_ID);
    expect(failed.status).toBe(503);
    expect(failed.headers.get("cache-control")).toBe("private, no-store");
  });
});
