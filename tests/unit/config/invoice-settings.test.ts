import { describe, expect, it } from "vitest";

import {
  INVOICE_COPY,
  INVOICE_SETTING_KEY,
  INVOICE_SETTING_KEYS,
  describeMissingIssuerDetails,
  invoiceIssuerReadiness,
  invoiceNumberExample,
  invoiceReadinessMessage,
  invoiceSettingInput,
  invoiceSettingsProblem,
  isInvoiceSettingKey,
} from "@/lib/config/invoice";
import { SETTINGS_PANELS } from "@/lib/config/settings-panels";

const COMPLETE = {
  [INVOICE_SETTING_KEY.legalName]: "  Example Test Trading Co  ",
  [INVOICE_SETTING_KEY.trn]: "100000000000003",
  [INVOICE_SETTING_KEY.address]: "1 Example Street, Test City",
};

describe("[Project owner's direction 2026-09-11] invoices wait for the issuer details WellPlace types in", () => {
  it("is not ready until the legal name, TRN and address are all entered", () => {
    const readiness = invoiceIssuerReadiness({});

    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toEqual(["legalName", "trn", "address"]);
    expect(readiness.prefix).toBe("INV");
    expect(readiness.prefixValid).toBe(true);
    expect(invoiceReadinessMessage(readiness)).toBe(
      "Invoices cannot be issued until the legal name, TRN and address are entered.",
    );
  });

  it("treats blank text and a TRN that is not 15 digits as missing", () => {
    const readiness = invoiceIssuerReadiness({ ...COMPLETE, [INVOICE_SETTING_KEY.legalName]: "   ", [INVOICE_SETTING_KEY.trn]: "10000000000000" });

    expect(readiness.missing).toEqual(["legalName", "trn"]);
    expect(invoiceReadinessMessage(invoiceIssuerReadiness({ ...COMPLETE, [INVOICE_SETTING_KEY.trn]: null }))).toBe(
      "Invoices cannot be issued until the TRN is entered.",
    );
  });

  it("is ready once all three are entered, reading the trimmed values", () => {
    const readiness = invoiceIssuerReadiness(COMPLETE);

    expect(readiness.ready).toBe(true);
    expect(readiness.legalName).toBe("Example Test Trading Co");
    expect(readiness.trn).toBe("100000000000003");
    expect(invoiceReadinessMessage(readiness)).toBe(INVOICE_COPY.settings.ready);
  });

  it("upper-cases the number prefix and refuses one with other characters", () => {
    expect(invoiceIssuerReadiness({ ...COMPLETE, [INVOICE_SETTING_KEY.prefix]: "wp" }).prefix).toBe("WP");
    const broken = invoiceIssuerReadiness({ ...COMPLETE, [INVOICE_SETTING_KEY.prefix]: "W-P" });
    expect(broken.ready).toBe(false);
    expect(broken.missing).toEqual([]);
    expect(invoiceReadinessMessage(broken)).toBe(INVOICE_COPY.settings.prefixInvalid);
  });

  it("describes what is missing in plain words", () => {
    expect(describeMissingIssuerDetails([])).toBe("");
    expect(describeMissingIssuerDetails(["address"])).toBe("the address");
    expect(describeMissingIssuerDetails(["legalName", "trn"])).toBe("the legal name and TRN");
  });
});

describe("[CLIENT console redesign brief 2026-09-11] the Tax invoices settings editor", () => {
  it("lives in the Prices section with all four invoice settings", () => {
    const panel = SETTINGS_PANELS.find((item) => item.id === "invoices");

    expect(panel?.section).toBe("Prices");
    expect(panel?.keys).toEqual(INVOICE_SETTING_KEYS);
    expect(INVOICE_SETTING_KEYS.every(isInvoiceSettingKey)).toBe(true);
    expect(isInvoiceSettingKey("tax.label")).toBe(false);
  });

  it("stores a cleared field as not set rather than as empty text", () => {
    expect(invoiceSettingInput(INVOICE_SETTING_KEY.legalName, "   ")).toBeNull();
    expect(invoiceSettingInput(INVOICE_SETTING_KEY.address, "")).toBeNull();
    expect(invoiceSettingInput(INVOICE_SETTING_KEY.trn, "  ")).toBeNull();
    expect(invoiceSettingInput(INVOICE_SETTING_KEY.prefix, " ")).toBeNull();
  });

  it("keeps typed spaces in names, strips TRN separators and upper-cases the prefix", () => {
    expect(invoiceSettingInput(INVOICE_SETTING_KEY.legalName, "Example Test ")).toBe("Example Test ");
    expect(invoiceSettingInput(INVOICE_SETTING_KEY.trn, "100 0000-0000 0003")).toBe("100000000000003");
    expect(invoiceSettingInput(INVOICE_SETTING_KEY.prefix, " wp ")).toBe("WP");
  });

  it("stops a save with a short TRN or an unusable prefix, and allows unset values", () => {
    expect(invoiceSettingsProblem({})).toBeNull();
    expect(invoiceSettingsProblem(COMPLETE)).toBeNull();
    expect(invoiceSettingsProblem({ [INVOICE_SETTING_KEY.trn]: "12345" })).toBe(INVOICE_COPY.settings.trnInvalid);
    expect(invoiceSettingsProblem({ [INVOICE_SETTING_KEY.prefix]: "IN V" })).toBe(INVOICE_COPY.settings.prefixInvalid);
  });

  it("shows how new invoice numbers will look", () => {
    expect(invoiceNumberExample("WP", "2026")).toBe("New invoices are numbered like WP-2026-000001.");
  });
});
