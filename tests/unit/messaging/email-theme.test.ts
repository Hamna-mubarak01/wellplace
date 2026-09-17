import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  EMAIL_THEME,
  EMAIL_THEME_TOKEN_SOURCE,
} from "@/lib/messaging/email-theme";


const PRIMITIVES = readFileSync(
  fileURLToPath(new URL("../../../src/styles/tokens/primitives.css", import.meta.url)),
  "utf8",
);

function primitive(token: string): string | null {
  const match = new RegExp(`${token}\\s*:\\s*(#[0-9a-fA-F]{3,8})\\s*;`).exec(
    PRIMITIVES,
  );
  return match ? match[1].toLowerCase() : null;
}

describe("the email palette mirrors primitives.css [9.1, R-20]", () => {
  it("every email colour names a token that actually exists", () => {
    for (const token of Object.values(EMAIL_THEME_TOKEN_SOURCE)) {
      expect(primitive(token), `${token} is not declared in primitives.css`).not.toBeNull();
    }
  });

  it("every email colour equals the token it claims to mirror", () => {
    for (const [key, token] of Object.entries(EMAIL_THEME_TOKEN_SOURCE)) {
      expect(
        EMAIL_THEME[key as keyof typeof EMAIL_THEME],
        `EMAIL_THEME.${key} has drifted from ${token}`,
      ).toBe(primitive(token));
    }
  });

  it("no email colour is left unmapped — adding one without its token fails here", () => {
    expect(Object.keys(EMAIL_THEME).sort()).toEqual(
      Object.keys(EMAIL_THEME_TOKEN_SOURCE).sort(),
    );
  });

  it("uses no pure white or pure black, the standing palette rule [9.2]", () => {
    for (const value of Object.values(EMAIL_THEME)) {
      expect(["#ffffff", "#fff", "#000000", "#000"]).not.toContain(value);
    }
  });
});
