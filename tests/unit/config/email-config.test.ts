import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { emailConfig, formatSender, resetEmailConfigCache } from "@/lib/config/email";

const KEYS = [
  "EMAIL_GUEST_FROM",
  "EMAIL_GUEST_FROM_NAME",
  "EMAIL_OPERATIONS_FROM",
  "EMAIL_OPERATIONS_TO",
  "EMAIL_ASSET_BASE_URL",
  "EMAIL_CONSOLE_URL",
] as const;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) delete process.env[key];
  resetEmailConfigCache();
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  resetEmailConfigCache();
});

describe("operationsTo", () => {
  it("is a list even when one address is configured", () => {
    process.env.EMAIL_OPERATIONS_TO = "hello@wellplace.example";
    expect(emailConfig().operationsTo).toEqual(["hello@wellplace.example"]);
  });

  it("splits a comma-separated list and trims the spaces around it", () => {
    process.env.EMAIL_OPERATIONS_TO = "hello@wellplace.example, ops@example.com";
    expect(emailConfig().operationsTo).toEqual([
      "hello@wellplace.example",
      "ops@example.com",
    ]);
  });

  it("ignores an empty entry from a trailing comma rather than failing on it", () => {
    process.env.EMAIL_OPERATIONS_TO = "hello@wellplace.example,";
    expect(emailConfig().operationsTo).toEqual(["hello@wellplace.example"]);
  });

  it("refuses a malformed address instead of silently dropping it", () => {
    process.env.EMAIL_OPERATIONS_TO = "hello@wellplace.example, not-an-address";
    expect(() => emailConfig()).toThrow(/Email configuration is invalid/);
  });

  it("falls back to the venue mailbox when nothing is configured", () => {
    expect(emailConfig().operationsTo).toEqual(["hello@wellplace.example"]);
  });
});

describe("formatSender", () => {
  it("puts the display name in front of the address", () => {
    expect(formatSender("WellPlace", "hello@wellplace.example")).toBe(
      "WellPlace <hello@wellplace.example>",
    );
  });

  it("keeps the client's name unquoted — an en dash needs no quoting", () => {
    expect(
      formatSender("WellPlace \u2013 Wellness Made Private", "hello@wellplace.example"),
    ).toBe("WellPlace \u2013 Wellness Made Private <hello@wellplace.example>");
  });

  it("quotes a name containing an RFC 5322 special, so the header cannot break", () => {
    expect(formatSender("WellPlace, Dubai", "hello@wellplace.example")).toBe(
      '"WellPlace, Dubai" <hello@wellplace.example>',
    );
    expect(formatSender("Well.Place", "hello@wellplace.example")).toBe(
      '"Well.Place" <hello@wellplace.example>',
    );
  });

  it("strips CR and LF, so a display name cannot forge a second header", () => {
    const forged = formatSender(
      'Well\r\nBcc: attacker@example.com"\\',
      "hello@wellplace.example",
    );

    expect(forged).not.toMatch(/[\r\n]/);
    expect(forged).toBe('"WellBcc: attacker@example.com" <hello@wellplace.example>');
    expect(forged.endsWith("<hello@wellplace.example>")).toBe(true);
  });

  it("falls back to a bare address when no name is configured", () => {
    expect(formatSender(undefined, "hello@wellplace.example")).toBe("hello@wellplace.example");
    expect(formatSender("   ", "hello@wellplace.example")).toBe("hello@wellplace.example");
  });

  it("defaults to the client's approved sender name", () => {
    expect(emailConfig().guestFromName).toBe("WellPlace \u2013 Wellness Made Private");
  });
});

describe("consoleUrl — the target of the internal 'Open the waitlist' button", () => {
  it("defaults to a host that is actually serving the console", () => {
    expect(emailConfig().consoleUrl).toBe(
      "http://localhost:3000/manage/waitlist",
    );
  });

  it("points at the console route, not the marketing root", () => {
    expect(new URL(emailConfig().consoleUrl).pathname).toBe("/manage/waitlist");
  });

  it("does not point at wellplace.example, which does not resolve yet", () => {
    expect(emailConfig().consoleUrl).not.toContain("wellplace.example/manage");
  });

  it("an explicit value still wins, so launch day is one variable", () => {
    process.env.EMAIL_CONSOLE_URL = "https://wellplace.example/manage/waitlist";
    resetEmailConfigCache();
    expect(emailConfig().consoleUrl).toBe("https://wellplace.example/manage/waitlist");
  });
});
