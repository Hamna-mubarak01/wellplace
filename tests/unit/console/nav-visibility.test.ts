import { describe, expect, it } from "vitest";

import {
  CONSOLE_NAV,
  CONSOLE_NAV_GROUPS,
  activeNavHref,
  isNavItemActive,
  canSeeNavItem,
  consoleForPathname,
  consoleLabel,
  navEntriesForConsole,
  navForConsole,
  navGroupContaining,
  type ConsoleNavItem,
  type ConsoleViewer,
} from "@/components/console/console-nav";
import { canEnterPath } from "@/lib/auth/console";
import { ROLE_PERMISSIONS } from "@/lib/config/permissions";

const RECEPTIONIST: ConsoleViewer = { role: "reception", permissions: [] };
const MANAGER: ConsoleViewer = { role: "management", permissions: [] };

function hrefs(items: ReadonlyArray<ConsoleNavItem>): string[] {
  return items.map((item) => item.href);
}

describe("a receptionist sees the reception console and nothing else", () => {
  it("[OUR CHOICE; user direction] shows the three Reception workspaces", () => {
    expect(hrefs(navForConsole("reception", RECEPTIONIST))).toEqual([
      "/reception",
      "/reception/bookings",
      "/reception/tasks",
    ]);
  });

  it("keeps the Reception tablet navigation flat, with no sub-branches", () => {
    const entries = navEntriesForConsole("reception", RECEPTIONIST);
    expect(entries.map((entry) => entry.kind)).toEqual(["item", "item", "item"]);
    expect(
      entries.map((entry) => (entry.kind === "item" ? entry.item.label : null)),
    ).toEqual(["Front desk", "Bookings", "Tasks and handover"]);
  });

  it("shows no management item, in either console", () => {
    expect(navForConsole("manage", RECEPTIONIST)).toEqual([]);
    for (const item of navForConsole("reception", RECEPTIONIST)) {
      expect(item.href.startsWith("/manage")).toBe(false);
    }
  });

  it("is offered no way to cross into Management", () => {
    expect(navForConsole("manage", RECEPTIONIST)).toEqual([]);
  });
});

describe("a manager sees the Management console and only that", () => {
  it("[CLIENT] shows every Management item in sidebar order", () => {
    expect(hrefs(navForConsole("manage", MANAGER))).toEqual([
      "/manage/suites",
      "/manage/bookings",
      "/manage/customers",
      "/manage/customers/leads",
      "/manage/customers/blocked",
      "/manage/waitlist",
      "/manage/finance/payments",
      "/manage/finance/refunds",
      "/manage/finance/invoices",
      "/manage/pricing",
      "/manage/coupons",
      "/manage/staff",
      "/manage/tasks",
      "/manage/messages",
      "/manage/cms",
      "/manage/settings",
    ]);
  });

  it("[CLIENT] groups Management into five sub-branches, in order", () => {
    const entries = navEntriesForConsole("manage", MANAGER);

    expect(entries.every((entry) => entry.kind === "group")).toBe(true);
    expect(
      entries.map((entry) =>
        entry.kind === "group"
          ? { group: entry.group.label, items: entry.items.map((item) => item.label) }
          : null,
      ),
    ).toEqual([
      {
        group: "Suites & bookings",
        items: ["Suites", "Bookings"],
      },
      { group: "Customers", items: ["Customers", "Leads", "Blocked", "Waitlist"] },
      { group: "Finance", items: ["Payments", "Refunds", "Invoices"] },
      { group: "Pricing & discounts", items: ["Prices and add-ons", "Coupons"] },
      {
        group: "Administration",
        items: ["Staff", "Tasks", "Message templates", "Website content", "Settings"],
      },
    ]);
  });

  it("files every Management item under a group that exists", () => {
    const groupIds = new Set(CONSOLE_NAV_GROUPS.map((group) => group.id));
    for (const item of CONSOLE_NAV.filter((entry) => entry.section === "manage")) {
      expect(item.group !== null && groupIds.has(item.group), item.href).toBe(true);
    }
  });

  it("no longer lists the retired payments page, which now redirects to Finance", () => {
    expect(hrefs(navForConsole("manage", MANAGER))).not.toContain("/manage/payments");
  });

  it("does not mix reception items into the Management list", () => {
    for (const item of navForConsole("manage", MANAGER)) {
      expect(item.href.startsWith("/manage")).toBe(true);
    }
  });

  it("[CLIENT] is offered no Reception item at all", () => {
    expect(navForConsole("reception", MANAGER)).toEqual([]);
  });
});

describe("the nav cannot drift from the guard", () => {
  it("refuses a receptionist every management href in the nav", () => {
    const managementHrefs = CONSOLE_NAV.filter(
      (item) => item.section === "manage",
    ).map((item) => item.href);

    expect(managementHrefs.length).toBeGreaterThan(0);

    for (const href of managementHrefs) {
      expect(canEnterPath("reception", href)).toBe(false);
    }
  });

  it("[CLIENT] admits only a receptionist to every reception href in the nav", () => {
    for (const item of CONSOLE_NAV.filter((entry) => entry.section === "reception")) {
      expect(canEnterPath("reception", item.href)).toBe(true);
      expect(canEnterPath("management", item.href)).toBe(false);
    }
  });

  it("files every nav item under the console its href actually lives in", () => {
    for (const item of CONSOLE_NAV) {
      expect(canEnterPath("reception", item.href)).toBe(item.section === "reception");
      expect(canEnterPath("management", item.href)).toBe(item.section === "manage");
    }
  });
});

describe("canSeeNavItem honours the permissions fixed to each role", () => {
  it("shows an item only to the roles that hold its permission, whatever grants are stored", () => {
    for (const permission of ROLE_PERMISSIONS.management) {
      const item: ConsoleNavItem = {
        ...CONSOLE_NAV[0],
        requiresPermission: permission,
      };
      const receptionHolds = ROLE_PERMISSIONS.reception.includes(permission);

      expect(canSeeNavItem(item, MANAGER)).toBe(true);
      expect(canSeeNavItem(item, RECEPTIONIST)).toBe(receptionHolds);
      expect(
        canSeeNavItem(item, { role: "reception", permissions: [permission] }),
      ).toBe(receptionHolds);
    }
  });
});

describe("the sidebar reads its console from the current path", () => {
  it("follows the path, not the layout it was mounted from", () => {
    expect(consoleForPathname("/reception/board", "manage")).toBe("reception");
    expect(consoleForPathname("/manage/staff", "reception")).toBe("manage");
  });

  it("falls back to the mounting console for a path in neither", () => {
    expect(consoleForPathname("/no-access", "manage")).toBe("manage");
  });

  it("labels each console for the header and the group heading", () => {
    expect(consoleLabel("reception")).toBe("Reception console");
    expect(consoleLabel("manage")).toBe("Management console");
  });
});


describe("active navigation follows the current page", () => {
  it("does not highlight Today on every Reception page", () => {
    expect(isNavItemActive("/reception", "/reception")).toBe(true);
    expect(isNavItemActive("/reception/bookings", "/reception")).toBe(false);
  });
  it("keeps a parent tab selected for its detail pages", () => {
    expect(isNavItemActive("/reception/bookings/example", "/reception/bookings")).toBe(true);
    expect(isNavItemActive("/manage/cms/home", "/manage/cms")).toBe(true);
    expect(isNavItemActive("/manage/cms-other", "/manage/cms")).toBe(false);
  });

  it("highlights exactly one Management item for a detail page", () => {
    const items = navForConsole("manage", MANAGER);

    expect(activeNavHref("/manage/suites/abc", items)).toBe("/manage/suites");
    expect(activeNavHref("/manage/bookings/abc/receipt", items)).toBe("/manage/bookings");
    expect(activeNavHref("/manage/finance/refunds/abc", items)).toBe("/manage/finance/refunds");
    expect(activeNavHref("/manage/customers/abc", items)).toBe("/manage/customers");
    expect(activeNavHref("/manage/unknown", items)).toBeNull();
  });

  it("prefers the most specific item when two could match", () => {
    const items: ConsoleNavItem[] = [
      { ...CONSOLE_NAV[3], href: "/manage/finance" },
      { ...CONSOLE_NAV[3], href: "/manage/finance/payments" },
    ];

    expect(activeNavHref("/manage/finance/payments/abc", items)).toBe("/manage/finance/payments");
    expect(activeNavHref("/manage/finance/other", items)).toBe("/manage/finance");
  });

  it("opens the sub-branch that holds the current page", () => {
    const entries = navEntriesForConsole("manage", MANAGER);
    const items = navForConsole("manage", MANAGER);

    expect(navGroupContaining(entries, activeNavHref("/manage/suites/abc", items))).toBe("suites-bookings");
    expect(navGroupContaining(entries, activeNavHref("/manage/finance/invoices", items))).toBe("finance");
    expect(navGroupContaining(entries, activeNavHref("/manage/coupons", items))).toBe("pricing");
    expect(navGroupContaining(entries, activeNavHref("/manage/settings/hours", items))).toBe("administration");
    expect(navGroupContaining(entries, activeNavHref("/manage/unknown", items))).toBeNull();
  });
});
