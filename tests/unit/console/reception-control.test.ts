import { describe, expect, it } from "vitest";
import { receptionControlError } from "@/lib/validation/reception-control";
import { CLEANING_BUFFER_MINUTES, CONSOLE_MONEY_AED, EXTENSION_MINUTES, REASON_MAX_LENGTH } from "@/lib/config/console-limits";

describe("[OUR CHOICE] Reception input limits for typing and pasted values", () => {
  it("accepts both cleaning limits and exact whole minutes between stepper increments", () => {
    const rules = { numeric: true, required: true, ...CLEANING_BUFFER_MINUTES };
    for (const value of [rules.min, rules.max, rules.step + 1]) expect(receptionControlError(String(value), rules, true)).toBeNull();
    expect(receptionControlError(String(rules.max + 1), rules)).toContain("maximum");
    expect(receptionControlError(String(rules.min - 1), rules)).toContain("minimum");
    for (const value of ["12.5", "1e2", "12 minutes", "0x10"]) expect(receptionControlError(value, rules)).toContain("whole number");
  });
  it("allows clearing and intermediate digits while editing, then checks the minimum on leaving", () => {
    const rules = { numeric: true, required: true, ...EXTENSION_MINUTES };
    expect(receptionControlError("", rules)).toBeNull();
    expect(receptionControlError("", rules, true)).toContain("required");
    expect(receptionControlError("0", rules)).toBeNull();
    expect(receptionControlError("0", rules, true)).toContain("minimum");
    expect(receptionControlError("-", rules, true)).toContain("number");
  });
  it("accepts money boundaries and rejects fractional fils and malformed pasted amounts", () => {
    const rules = { numeric: true, ...CONSOLE_MONEY_AED };
    for (const value of ["0", "0.01", "12.", "12.50", String(rules.max)]) expect(receptionControlError(value, rules, true)).toBeNull();
    expect(receptionControlError("12.345", rules)).toContain("decimal places");
    for (const value of ["AED 12", "1,200", "1e2", "Infinity"]) expect(receptionControlError(value, rules)).toContain("amount");
    expect(receptionControlError(String(rules.max + 1), rules)).toContain("maximum");
  });
  it("rejects overlong pasted notes without silently truncating and permits optional blank notes", () => {
    expect(receptionControlError("x".repeat(REASON_MAX_LENGTH), { maxLength: REASON_MAX_LENGTH })).toBeNull();
    expect(receptionControlError("x".repeat(REASON_MAX_LENGTH + 1), { maxLength: REASON_MAX_LENGTH })).toContain("characters");
    expect(receptionControlError("   ", { required: true }, true)).toContain("required");
    expect(receptionControlError("", {}, true)).toBeNull();
  });
});
