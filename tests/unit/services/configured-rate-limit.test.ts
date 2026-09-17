import { beforeEach, describe, expect, it } from "vitest";
import { snapshotFromRows } from "@/lib/config";
import { RATE_LIMIT_SETTINGS } from "@/lib/config/rate-limits";
import { checkConfiguredRateLimit } from "@/lib/services/configured-rate-limit";
import { resetRateLimits, trackedKeyCount } from "@/lib/services/rate-limit";

beforeEach(resetRateLimits);
for (const scope of ["waitlist", "contact", "availability"] as const) {
  describe(`${scope} optional limit`, () => {
    const policy = RATE_LIMIT_SETTINGS[scope];
    const settings = (enabled: boolean) => snapshotFromRows([
      { key: policy.enabled, value: enabled }, { key: policy.count, value: 2 }, { key: policy.window, value: 3 },
    ]);
    it("enforces the saved count and window, not the default", () => {
      expect(checkConfiguredRateLimit(scope, settings(true), "guest", 0).allowed).toBe(true);
      expect(checkConfiguredRateLimit(scope, settings(true), "guest", 1).allowed).toBe(true);
      expect(checkConfiguredRateLimit(scope, settings(true), "guest", 2).allowed).toBe(false);
      expect(checkConfiguredRateLimit(scope, settings(true), "guest", 180_000).allowed).toBe(true);
    });
    it("bypasses an exhausted limit while off, then resumes with a new counter", () => {
      for (let attempt = 0; attempt < 3; attempt++) checkConfiguredRateLimit(scope, settings(true), "guest", 0);
      for (let attempt = 0; attempt < 10; attempt++) expect(checkConfiguredRateLimit(scope, settings(false), "guest", 1).allowed).toBe(true);
      expect(trackedKeyCount()).toBe(0);
      expect(checkConfiguredRateLimit(scope, settings(true), "guest", 2).allowed).toBe(true);
    });
  });
}
