import { expect, test, type Page } from "@playwright/test";
import { canEnterPath, homeForRole } from "@/lib/auth/console";

import {
  CONSOLE_DIALOGS,
  OPEN_DIALOG,
  dialogsFor,
} from "./support/console-dialogs";
import {
  BREAKPOINTS,
  CONSOLE_SURFACES,
  STORAGE_STATE_FILE,
  environmentStatus,
} from "./support/environment";

const status = environmentStatus();

const INTERACTIVE = [
  "a[href]",
  "button",
  "input:not([type=hidden])",
  "select",
  "textarea",
  "summary",
  "[role=button]",
  "[role=link]",
  "[role=switch]",
  "[role=tab]",
  "[role=checkbox]",
  "[role=radio]",
  "[role=menuitem]",
  "[role=option]",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

interface UndersizedControl {
  readonly description: string;
  readonly width: number;
  readonly height: number;
  readonly measuredTapArea: boolean;
}

async function requiredTapSize(page: Page): Promise<number> {
  return page.evaluate(() =>
    Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--tap-min"),
    ),
  );
}

async function undersizedControls(
  page: Page,
  selector: string,
  minimum: number,
): Promise<UndersizedControl[]> {
  return page.evaluate(
    ({ selector: query, minimum: floor }) => {
      const failures: {
        description: string;
        width: number;
        height: number;
        measuredTapArea: boolean;
      }[] = [];

      const describe = (element: Element): string => {
        const tag = element.tagName.toLowerCase();
        const role = element.getAttribute("role");
        const name =
          element.getAttribute("aria-label") ??
          element.getAttribute("title") ??
          (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
        const href = element.getAttribute("href");

        return [
          `<${tag}${role === null ? "" : ` role="${role}"`}>`,
          name === "" ? "(no accessible name)" : `"${name}"`,
          href === null ? "" : `→ ${href}`,
        ]
          .filter((part) => part !== "")
          .join(" ");
      };

      for (const element of Array.from(document.querySelectorAll(query))) {
        if (element.closest("[aria-hidden='true']") !== null) continue;
        if (element.hasAttribute("disabled")) continue;
        if (element.getAttribute("aria-disabled") === "true") continue;

        const style = getComputedStyle(element);
        if (style.visibility === "hidden" || style.display === "none") continue;
        if (Number.parseFloat(style.opacity) === 0) continue;

        const box = element.getBoundingClientRect();
        if (box.width === 0 && box.height === 0) continue;

        const owner = element.closest("[data-tap-area]");
        const measuredTapArea = owner !== null && owner !== element;
        const area = measuredTapArea
          ? owner.getBoundingClientRect()
          : { width: 0, height: 0 };

        const width = Math.max(box.width, area.width);
        const height = Math.max(box.height, area.height);

        if (width + 0.5 < floor || height + 0.5 < floor) {
          failures.push({
            description: describe(element),
            width: Math.round(width * 10) / 10,
            height: Math.round(height * 10) / 10,
            measuredTapArea,
          });
        }
      }

      return failures;
    },
    { selector, minimum },
  );
}

function report(where: string, failures: readonly UndersizedControl[]): string {
  return [
    `${failures.length} control${failures.length === 1 ? "" : "s"} on ${where} ` +
      "are smaller than the console tap target [R-27, SYSTEM.md 9.4]:",
    ...failures.map(
      (failure) =>
        `  ${failure.width}×${failure.height} — ${failure.description}` +
        (failure.measuredTapArea
          ? " (measured across its [data-tap-area] owner)"
          : ""),
    ),
  ].join("\n");
}

for (const breakpoint of BREAKPOINTS) {
  test.describe(`R-27 — every interactive control in the console is at least one tap target at ${breakpoint.name}px`, () => {
    test.skip(!status.serverReachable, status.serverMessage);
    test.skip(!status.signedIn, status.sessionMessage);
    test.use({
      storageState: STORAGE_STATE_FILE,
      viewport: { width: breakpoint.width, height: breakpoint.height },
    });

    for (const route of CONSOLE_SURFACES) {
      test(`sweeps ${route}`, async ({ page }) => {
        test.skip(status.role !== null && !canEnterPath(status.role as "management" | "reception", route), "This surface belongs to the other staff role.");
        await page.goto(route, { waitUntil: "load" });
        await expect(page.locator("main")).toBeVisible();

        const minimum = await requiredTapSize(page);

        expect(
          minimum,
          "--tap-min could not be read, so nothing was measured against anything",
        ).toBeGreaterThan(0);

        const failures = await undersizedControls(page, INTERACTIVE, minimum);

        expect(failures, report(route, failures)).toEqual([]);
      });

      for (const probe of dialogsFor(route)) {
        test(`sweeps ${route} with "${probe.name}" open`, async ({ page }) => {
          test.skip(status.role !== null && !canEnterPath(status.role as "management" | "reception", route), "This surface belongs to the other staff role.");
          await page.goto(route, { waitUntil: "load" });
          await expect(page.locator("main")).toBeVisible();

          const opened = await probe.open(page);

          test.skip(
            !opened,
            `"${probe.name}" could not be opened on ${route} because ` +
              `${probe.reachOnlyWhenSeeded}. Seed the console and run this again — ` +
              "R-27 is unproven inside this dialog until it does.",
          );

          const dialog = page.locator(OPEN_DIALOG);
          await expect(dialog.first()).toBeVisible();

          const minimum = await requiredTapSize(page);
          const failures = await undersizedControls(
            page,
            `${OPEN_DIALOG} :is(${INTERACTIVE})`,
            minimum,
          );

          expect(
            failures,
            report(`${route} → "${probe.name}"`, failures),
          ).toEqual([]);
        });
      }
    }
  });
}

test.describe("R-27 — the sweep can tell an undersized control from a compliant one", () => {
  test.skip(!status.serverReachable, status.serverMessage);
  test.skip(!status.signedIn, status.sessionMessage);
  test.use({ storageState: STORAGE_STATE_FILE });

  test("finds a control it has been told to shrink, so a clean sweep means something", async ({
    page,
  }) => {
    await page.goto(homeForRole(status.role as "management" | "reception"), { waitUntil: "load" });

    const minimum = await requiredTapSize(page);

    await page.evaluate(() => {
      const probe = document.createElement("button");
      probe.id = "wellplace-tap-probe";
      probe.textContent = "probe";
      probe.setAttribute(
        "style",
        "width:20px;height:20px;position:fixed;top:0;left:0",
      );
      document.body.append(probe);
    });

    const failures = await undersizedControls(
      page,
      "#wellplace-tap-probe",
      minimum,
    );

    expect(failures).toHaveLength(1);
    expect(failures[0].width).toBe(20);
    expect(failures[0].height).toBe(20);
  });

  test("still fails a small control whose tap-area owner is itself too small", async ({
    page,
  }) => {
    await page.goto(homeForRole(status.role as "management" | "reception"), { waitUntil: "load" });

    const minimum = await requiredTapSize(page);

    await page.evaluate(() => {
      const owner = document.createElement("span");
      owner.id = "wellplace-tap-area-probe";
      owner.setAttribute("data-tap-area", "probe");
      owner.setAttribute(
        "style",
        "display:inline-flex;width:30px;height:30px;position:fixed;top:0;left:0",
      );

      const control = document.createElement("button");
      control.textContent = "probe";
      control.setAttribute("style", "width:20px;height:20px");

      owner.append(control);
      document.body.append(owner);
    });

    const failures = await undersizedControls(
      page,
      "#wellplace-tap-area-probe button",
      minimum,
    );

    expect(failures).toHaveLength(1);
    expect(failures[0].width).toBe(30);
    expect(failures[0].height).toBe(30);
    expect(failures[0].measuredTapArea).toBe(true);
  });
});

test.describe("R-27 — every console dialog this build ships is covered by the sweep", () => {
  test("names a surface for each dialog probe, and every probe route is swept", () => {
    for (const probe of CONSOLE_DIALOGS) {
      expect(
        CONSOLE_SURFACES,
        `${probe.route} carries the "${probe.name}" dialog but is not in CONSOLE_SURFACES`,
      ).toContain(probe.route);
    }
  });
});
