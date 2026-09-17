import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guestDocument: vi.fn() }));

vi.mock("@/lib/db/guest-checkout", () => ({ guestDocument: mocks.guestDocument }));

import { GET } from "@/app/api/booking/receipt/[token]/documents/[id]/route";
import { sampleCreditNote } from "../support/credit-note";
import { SAMPLE_INVOICE_ID, sampleInvoice } from "../support/invoice";

const TOKEN = "4d3c2b1a-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const RENDER_TIMEOUT_MS = 30_000;

function call(token: string, id: string) {
  return GET(new Request(`https://wellplace.test/api/booking/receipt/${token}/documents/${id}`), {
    params: Promise.resolve({ token, id }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("[OUR CHOICE — project owner's direction, 14 September 2026; §6.5; INV-25] guest tax document download", () => {
  it("answers 404 for a malformed token or id without reading anything", async () => {
    expect((await call("not-a-token", SAMPLE_INVOICE_ID)).status).toBe(404);
    expect((await call(TOKEN, "not-an-id")).status).toBe(404);
    expect(mocks.guestDocument).not.toHaveBeenCalled();
  });

  it("answers 404 when the document does not belong to the token, or the token is unknown, expired or revoked", async () => {
    mocks.guestDocument.mockResolvedValueOnce(null);

    const response = await call(TOKEN, SAMPLE_INVOICE_ID);

    expect(response.status).toBe(404);
    expect(mocks.guestDocument).toHaveBeenCalledWith(TOKEN, SAMPLE_INVOICE_ID);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it(
    "returns a stored invoice as a private, never-indexed PDF attachment",
    async () => {
      mocks.guestDocument.mockResolvedValueOnce({ type: "invoice", bookingReference: "WP-B1042", invoice: sampleInvoice() });

      const response = await call(TOKEN, SAMPLE_INVOICE_ID);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/pdf");
      expect(response.headers.get("content-disposition")).toBe('attachment; filename="INV-2026-000042.pdf"');
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(Buffer.from(await response.arrayBuffer()).subarray(0, 4).toString("latin1")).toBe("%PDF");
    },
    RENDER_TIMEOUT_MS,
  );

  it(
    "returns a credit note under its own number",
    async () => {
      mocks.guestDocument.mockResolvedValueOnce({ type: "credit_note", bookingReference: "WP-B1042", creditNote: sampleCreditNote() });

      const response = await call(TOKEN, SAMPLE_INVOICE_ID);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-disposition")).toBe('attachment; filename="CN-2026-000007.pdf"');
    },
    RENDER_TIMEOUT_MS,
  );

  it("answers 503 without caching when the document cannot be read", async () => {
    mocks.guestDocument.mockRejectedValueOnce(new Error("Your document could not be loaded."));

    const response = await call(TOKEN, SAMPLE_INVOICE_ID);

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
