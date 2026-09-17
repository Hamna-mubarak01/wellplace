import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MANAGE_ROOT = "src/app/(console)/manage";
const RECEPTION_ROOT = "src/app/(console)/reception";

function filesUnder(root: string, names: readonly string[]): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      found.push(...filesUnder(path, names));
    } else if (names.includes(entry.name)) {
      found.push(path);
    }
  }

  return found.toSorted();
}

function serverModulesUnder(root: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      found.push(...serverModulesUnder(path));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      found.push(path);
    }
  }

  return found.toSorted();
}

describe("the Management console fails closed", () => {
  const layout = readFileSync(join(MANAGE_ROOT, "layout.tsx"), "utf8");

  it("guards the whole console at the layout, not page by page", () => {
    expect(layout).toContain("requireManagement()");
    expect(layout).not.toContain("requireStaff");
  });

  it("still guards every management page and action in its own right", () => {
    const guarded = filesUnder(MANAGE_ROOT, ["page.tsx", "actions.ts", "route.ts"]);

    expect(guarded.length).toBeGreaterThan(0);

    for (const file of guarded) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} must call requireManagement`).toContain(
        "requireManagement",
      );
    }
  });

  it("[CLIENT] sends the retired payments page to Finance, behind the same guard", () => {
    const source = readFileSync(join(MANAGE_ROOT, "payments", "page.tsx"), "utf8");

    expect(source).toContain("requireManagement()");
    expect(source).toContain("redirect(");
    expect(source).toContain('"/manage/finance/payments"');
    expect(source.indexOf("requireManagement()")).toBeLessThan(source.indexOf("redirect("));
  });

  it("never leaves requireStaff as the only guard on a management surface", () => {
    for (const file of filesUnder(MANAGE_ROOT, [
      "page.tsx",
      "actions.ts",
      "route.ts",
      "layout.tsx",
    ])) {
      const source = readFileSync(file, "utf8");
      if (!source.includes("requireStaff")) continue;

      expect(source, `${file} uses requireStaff without requireManagement`).toContain(
        "requireManagement",
      );
    }
  });
});

describe("[CLIENT] the Reception console belongs to Reception alone", () => {
  it("guards the whole console at the layout, not page by page", () => {
    const layout = readFileSync(join(RECEPTION_ROOT, "layout.tsx"), "utf8");

    expect(layout).toContain("requireReception()");
    expect(layout).not.toContain("requireStaff");
  });

  it("still guards every reception page and action in its own right", () => {
    const guarded = filesUnder(RECEPTION_ROOT, ["page.tsx", "actions.ts", "route.ts"]);

    expect(guarded.length).toBeGreaterThan(0);

    for (const file of guarded) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} must call requireReception`).toContain(
        "requireReception",
      );
    }
  });

  it("never leaves requireStaff as the only guard on a reception surface", () => {
    for (const file of serverModulesUnder(RECEPTION_ROOT)) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} must not fall back to requireStaff`).not.toContain(
        "requireStaff",
      );
    }
  });

  it("[CLIENT] keeps manual pricing Management-only; refunds use the shared staff action", () => {
    const stranded = serverModulesUnder(RECEPTION_ROOT)
      .flatMap((file) => {
        const source = readFileSync(file, "utf8");
        const count = source.split("requireManagement(").length - 1;
        return count > 0 ? [`${file}:${count}`] : [];
      })
      .toSorted();

    expect(stranded).toEqual(["src/app/(console)/reception/actions.ts:1"]);
  });
});
