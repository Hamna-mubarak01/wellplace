import { expect, test, type Page } from "@playwright/test";

import {
  BREAKPOINTS,
  RECEPTION_ROUTES,
  STORAGE_STATE_FILE,
  THEME_STORAGE_KEY,
  environmentStatus,
} from "./support/environment";

const status = environmentStatus();

interface ThemeMutation {
  readonly value: string | null;
  readonly readyState: string;
}

interface ThemeTrace {
  readonly atDomContentLoaded: string | null;
  readonly atLoad: string | null;
  readonly mutations: readonly ThemeMutation[];
  readonly documentBackground: string;
  readonly bodyBackground: string;
  readonly bodyColor: string;
}

declare global {
  interface Window {
    __wellplaceThemeTrace?: {
      mutations: ThemeMutation[];
      atDomContentLoaded: string | null;
      atLoad: string | null;
    };
  }
}

async function installThemeRecorder(
  page: Page,
  stored: "light" | "dark" | null,
): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      try {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
      } catch {}

      const trace = {
        mutations: [] as { value: string | null; readyState: string }[],
        atDomContentLoaded: null as string | null,
        atLoad: null as string | null,
      };

      window.__wellplaceThemeTrace = trace;

      const record = () => {
        trace.mutations.push({
          value: document.documentElement?.getAttribute("data-theme") ?? null,
          readyState: document.readyState,
        });
      };

      new MutationObserver(record).observe(document, {
        subtree: true,
        attributes: true,
        attributeFilter: ["data-theme"],
      });

      document.addEventListener("DOMContentLoaded", () => {
        trace.atDomContentLoaded =
          document.documentElement?.getAttribute("data-theme") ?? null;
      });

      window.addEventListener("load", () => {
        trace.atLoad = document.documentElement?.getAttribute("data-theme") ?? null;
      });
    },
    { key: THEME_STORAGE_KEY, value: stored },
  );
}

async function readTrace(page: Page): Promise<ThemeTrace> {
  return page.evaluate(() => {
    const trace = window.__wellplaceThemeTrace;
    return {
      atDomContentLoaded: trace?.atDomContentLoaded ?? null,
      atLoad: trace?.atLoad ?? null,
      mutations: trace?.mutations ?? [],
      documentBackground: getComputedStyle(document.documentElement).backgroundColor,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      bodyColor: getComputedStyle(document.body).color,
    };
  });
}

function luminanceOf(rgb: string): number {
  const parts = rgb.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
  return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
}

const CONSOLE_ROUTES = ["/sign-in", ...RECEPTION_ROUTES, ...(status.role === "management" ? ["/manage/suites"] : [])];

function requiresSession(route: string): boolean {
  return route !== "/sign-in";
}

for (const breakpoint of BREAKPOINTS) {
  test.describe(`INV-23 — the console theme resolves before first paint at ${breakpoint.name}px [§4.2, R-24]`, () => {
    test.skip(!status.serverReachable, status.serverMessage);
    test.use({ viewport: { width: breakpoint.width, height: breakpoint.height } });

    for (const route of CONSOLE_ROUTES) {
      test.describe(route, () => {
        test.skip(
          requiresSession(route) && !status.signedIn,
          status.sessionMessage,
        );

        if (requiresSession(route)) test.use({ storageState: STORAGE_STATE_FILE });

        for (const choice of ["light", "dark"] as const) {
          test(`resolves the stored ${choice} theme while the document is still parsing`, async ({
            page,
          }) => {
            await installThemeRecorder(page, choice);
            await page.goto(route, { waitUntil: "load" });

            const trace = await readTrace(page);

            expect(
              trace.mutations.length,
              "nothing set data-theme at all, so the blocking script did not run",
            ).toBeGreaterThan(0);

            expect(
              trace.mutations[0],
              "the theme was applied after the document finished parsing, which is a flash",
            ).toEqual({ value: choice, readyState: "loading" });

            expect(trace.atDomContentLoaded).toBe(choice);
            expect(trace.atLoad).toBe(choice);

            expect(
              trace.mutations.map((mutation) => mutation.value),
              "data-theme changed again after the first paint, which is a flash",
            ).toEqual([choice]);
          });
        }

        test("paints a genuinely different surface in each theme, so the attribute is load-bearing", async ({
          page,
        }) => {
          await installThemeRecorder(page, "light");
          await page.goto(route, { waitUntil: "load" });
          const light = await readTrace(page);

          await installThemeRecorder(page, "dark");
          await page.goto(route, { waitUntil: "load" });
          const dark = await readTrace(page);

          expect(light.bodyBackground).not.toBe(dark.bodyBackground);
          expect(light.bodyColor).not.toBe(dark.bodyColor);
          expect(luminanceOf(dark.bodyBackground)).toBeLessThan(
            luminanceOf(light.bodyBackground),
          );
          expect(luminanceOf(dark.bodyColor)).toBeGreaterThan(
            luminanceOf(light.bodyColor),
          );
        });

        test.describe("System", () => {
          test.use({ colorScheme: "dark" });

          test("resolves to the dark palette with no attribute to set and nothing to correct", async ({
            page,
          }) => {
            await installThemeRecorder(page, null);
            await page.goto(route, { waitUntil: "load" });

            const trace = await readTrace(page);

            expect(
              trace.atLoad,
              "System must resolve through the media query, not by writing an attribute",
            ).toBeNull();
            expect(trace.mutations).toEqual([]);

            await installThemeRecorder(page, "dark");
            await page.goto(route, { waitUntil: "load" });
            const stored = await readTrace(page);

            expect(trace.bodyBackground).toBe(stored.bodyBackground);
            expect(trace.bodyColor).toBe(stored.bodyColor);
          });
        });

        test.describe("System, light", () => {
          test.use({ colorScheme: "light" });

          test("resolves to the light palette when the operating system is light", async ({
            page,
          }) => {
            await installThemeRecorder(page, null);
            await page.goto(route, { waitUntil: "load" });
            const trace = await readTrace(page);

            expect(trace.atLoad).toBeNull();
            expect(trace.mutations).toEqual([]);

            await installThemeRecorder(page, "light");
            await page.goto(route, { waitUntil: "load" });
            const stored = await readTrace(page);

            expect(trace.bodyBackground).toBe(stored.bodyBackground);
            expect(trace.bodyColor).toBe(stored.bodyColor);
          });
        });
      });
    }
  });
}
