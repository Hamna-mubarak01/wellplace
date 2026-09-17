import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BROWSER_THEME,
  BROWSER_THEME_TOKEN_SOURCE,
} from "@/lib/config/browser-theme";

const PRIMITIVES = readFileSync(
  fileURLToPath(new URL("../../../src/styles/tokens/primitives.css", import.meta.url)),
  "utf8",
);

function primitive(token: string): string | null {
  const match = new RegExp(`${token}\\s*:\\s*(#[0-9a-fA-F]{3,8})\\s*;`).exec(PRIMITIVES);
  return match ? match[1].toLowerCase() : null;
}

describe("browser chrome colour mirrors primitives.css [9.1, R-20]", () => {
  it("names tokens that exist", () => {
    for (const token of Object.values(BROWSER_THEME_TOKEN_SOURCE)) {
      expect(primitive(token), `${token} is not declared in primitives.css`).not.toBeNull();
    }
  });

  it("has not drifted from the surface each theme actually paints", () => {
    for (const [theme, token] of Object.entries(BROWSER_THEME_TOKEN_SOURCE)) {
      expect(
        BROWSER_THEME[theme as keyof typeof BROWSER_THEME],
        `theme-color for ${theme} no longer matches ${token}`,
      ).toBe(primitive(token));
    }
  });
});
