import { beforeEach, describe, expect, it, vi } from "vitest";
import { snapshotFromRows } from "@/lib/config";
import { submitContactEnquiry } from "@/app/(site)/contact/actions";
import { submitWaitlistEntry } from "@/app/(site)/waitlist/actions";
import { loadRateLimitSettings } from "@/lib/db/queries/rate-limit-settings";
import { resetRateLimits } from "@/lib/services/rate-limit";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "192.0.2.40" }) }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock("@/lib/db/queries/rate-limit-settings", () => ({ loadRateLimitSettings: vi.fn() }));
vi.mock("@/lib/services/contact-notifications", () => ({ sendContactNotification: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/services/waitlist-service", () => ({ joinWaitlist: vi.fn(async () => ({ outcome: "joined" })) }));
vi.mock("@/lib/services/waitlist-notifications", () => ({ sendWaitlistEmails: vi.fn() }));
const guest = { salutation: "ms", firstName: "Fixture", lastName: "Guest", email: "fixture@example.test", dateOfBirth: { day: 1, month: 1, year: 1990 }, phone: { e164: "+971501234567", countryIso2: "AE" }, termsAccepted: true, message: "Please help me arrange a visit.", website: "" };

beforeEach(() => { resetRateLimits(); vi.clearAllMocks(); });
for (const scope of ["contact", "waitlist"] as const) {
  const submit = scope === "contact" ? submitContactEnquiry : submitWaitlistEntry;
  const success = scope === "contact" ? "sent" : "joined";
  const saved = (enabled: boolean) => vi.mocked(loadRateLimitSettings).mockResolvedValue({ ok: true, snapshot: snapshotFromRows([
    { key: `security.${scope}_rate_limit_enabled`, value: enabled },
    { key: `security.${scope}_rate_limit_per_hour`, value: 1 },
    { key: `security.${scope}_rate_limit_window_minutes`, value: 2 },
  ]) });
  describe(`${scope} action uses the manager's saved policy`, () => {
    it("enforces a saved limit, then stops limiting after the manager turns it off", async () => {
      saved(true);
      expect((await submit(guest)).status).toBe(success);
      expect((await submit(guest)).status).toBe("rate_limited");
      saved(false);
      expect((await submit(guest)).status).toBe(success);
      expect((await submit(guest)).status).toBe(success);
    });
    it("keeps validation when the limit is off", async () => {
      saved(false);
      expect((await submit({ ...guest, termsAccepted: false })).status).toBe("invalid");
    });
  });
}
