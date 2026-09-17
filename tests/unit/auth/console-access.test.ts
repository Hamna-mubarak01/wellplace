import { describe, expect, it } from "vitest";

import {
  CONSOLE_HOME,
  CONSOLE_IDS,
  canEnterConsole,
  canEnterPath,
  consoleForPath,
  consolesForRole,
  homeForRole,
  isConsoleId,
} from "@/lib/auth/console";
import { DEFAULT_AFTER_SIGN_IN, safePath, safeReturnPath } from "@/lib/auth/return-to";

describe("consoleForPath names the console a path belongs to", () => {
  it("places every reception route in the reception console", () => {
    for (const path of [
      "/reception",
      "/reception/board",
      "/reception/bookings",
      "/reception/bookings/abc-123",
      "/reception/cleaning",
      "/reception/alerts",
      "/reception/tasks",
      "/reception/handover",
    ]) {
      expect(consoleForPath(path)).toBe("reception");
    }
  });

  it("places every management route in the manage console", () => {
    for (const path of [
      "/manage",
      "/manage/settings",
      "/manage/suites",
      "/manage/messages",
      "/manage/waitlist",
      "/manage/staff",
      "/manage/cms",
      "/manage/cms/home",
    ]) {
      expect(consoleForPath(path)).toBe("manage");
    }
  });

  it("claims nothing outside the two consoles", () => {
    for (const path of ["/sign-in", "/set-password", "/no-access", "/", "/book"]) {
      expect(consoleForPath(path)).toBeNull();
    }
  });

  it("does not match a path that merely starts with the same letters", () => {
    expect(consoleForPath("/receptionist")).toBeNull();
    expect(consoleForPath("/manager")).toBeNull();
  });
});

describe("which consoles a role may enter", () => {
  it("gives reception only the reception console", () => {
    expect(consolesForRole("reception")).toEqual(["reception"]);
    expect(canEnterConsole("reception", "reception")).toBe(true);
    expect(canEnterConsole("reception", "manage")).toBe(false);
  });

  it("[CLIENT] gives management the management console and nothing else", () => {
    expect(consolesForRole("management")).toEqual(["manage"]);
    expect(canEnterConsole("management", "manage")).toBe(true);
    expect(canEnterConsole("management", "reception")).toBe(false);
  });

  it("refuses a receptionist every management path", () => {
    expect(canEnterPath("reception", "/manage/staff")).toBe(false);
    expect(canEnterPath("reception", "/manage/cms/home")).toBe(false);
    expect(canEnterPath("reception", "/reception/board")).toBe(true);
  });

  it("[CLIENT] refuses a manager every reception path", () => {
    expect(canEnterPath("management", "/reception")).toBe(false);
    expect(canEnterPath("management", "/reception/board")).toBe(false);
    expect(canEnterPath("management", "/reception/bookings/abc-123")).toBe(false);
    expect(canEnterPath("management", "/manage/settings")).toBe(true);
  });

  it("does not gate a path outside both consoles", () => {
    expect(canEnterPath("reception", "/sign-in")).toBe(true);
    expect(canEnterPath("reception", "/no-access")).toBe(true);
  });
});

describe("homeForRole lands each role in its own console", () => {
  it("sends reception to Today and management to Suites and blocks", () => {
    expect(homeForRole("reception")).toBe("/reception");
    expect(homeForRole("management")).toBe("/manage/suites");
  });

  it("agrees with the console home map", () => {
    expect(homeForRole("reception")).toBe(CONSOLE_HOME.reception);
    expect(homeForRole("management")).toBe(CONSOLE_HOME.manage);
  });

  it("gives every role a home it may actually enter", () => {
    for (const role of ["reception", "management"] as const) {
      expect(canEnterPath(role, homeForRole(role))).toBe(true);
    }
  });

  it("defaults an unknown account to the reception door", () => {
    expect(DEFAULT_AFTER_SIGN_IN).toBe(CONSOLE_HOME.reception);
  });
});

describe("safeReturnPath drops a return path the role cannot enter", () => {
  it("keeps a path inside the role's own console", () => {
    expect(safeReturnPath("/reception/bookings", "reception")).toBe(
      "/reception/bookings",
    );
    expect(safeReturnPath("/manage/staff", "management")).toBe("/manage/staff");
  });

  it("replaces a cross-console path with the role's home", () => {
    expect(safeReturnPath("/manage/staff", "reception")).toBe("/reception");
    expect(safeReturnPath("/manage/cms/home?tab=hero", "reception")).toBe(
      "/reception",
    );
  });

  it("[CLIENT] sends a manager holding a reception path to their own home", () => {
    expect(safeReturnPath("/reception/board", "management")).toBe(
      "/manage/suites",
    );
  });

  it("still rejects an off-site or malformed value", () => {
    expect(safeReturnPath("//evil.example", "reception")).toBe("/reception");
    expect(safeReturnPath("https://evil.example", "management")).toBe(
      "/manage/suites",
    );
    expect(safeReturnPath(undefined, "management")).toBe("/manage/suites");
    expect(safeReturnPath("", "reception")).toBe("/reception");
  });

  it("falls back to the sign-in default when no staff row resolved a role", () => {
    expect(safeReturnPath(undefined, null)).toBe(DEFAULT_AFTER_SIGN_IN);
    expect(safeReturnPath("//evil.example", null)).toBe(DEFAULT_AFTER_SIGN_IN);
  });

  it("never widens what safePath already refused", () => {
    for (const value of ["//evil.example", "https://evil.example", "manage"]) {
      expect(safePath(value, "/fallback")).toBe("/fallback");
      expect(safeReturnPath(value, "reception")).toBe("/reception");
    }
  });
});

describe("the console map itself", () => {
  it("names exactly two consoles", () => {
    expect([...CONSOLE_IDS].toSorted()).toEqual(["manage", "reception"]);
  });

  it("recognises only its own two identifiers", () => {
    expect(isConsoleId("manage")).toBe(true);
    expect(isConsoleId("reception")).toBe(true);
    expect(isConsoleId("management")).toBe(false);
    expect(isConsoleId(undefined)).toBe(false);
    expect(isConsoleId("")).toBe(false);
  });
});
