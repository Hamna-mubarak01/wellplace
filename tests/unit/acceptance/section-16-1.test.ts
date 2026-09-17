import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");

interface Criterion {
  readonly criterion: string;
  readonly evidence: readonly string[];
  readonly outstanding?: string;
}

const SECTION_16_1: readonly Criterion[] = [
  {
    criterion:
      "8 and 20 concurrent booking attempts produce no more than seven non-overlapping confirmations when seven suites are free",
    evidence: ["tests/concurrency/allocation.test.ts", "supabase/tests/hold-suite.sql"],
  },
  {
    criterion:
      "one free suite and multiple concurrent requests produce no more than one confirmation",
    evidence: ["tests/concurrency/allocation.test.ts"],
  },
  {
    criterion:
      "a hold reserves immediately, shows an accurate countdown and reliably releases availability on expiry",
    evidence: ["tests/concurrency/hold-lifecycle.test.ts"],
  },
  {
    criterion:
      "the 20-minute buffer prevents a following booking; after an 11:00 end, the next start in the 15-minute grid is 11:30",
    evidence: ["tests/unit/domain/buffer.test.ts", "supabase/tests/hold-suite.sql"],
  },
  {
    criterion:
      "a blocked, maintenance, not-ready or out-of-service suite is never allocated",
    evidence: ["tests/concurrency/allocation.test.ts", "supabase/tests/hold-suite.sql"],
  },
  {
    criterion: "a repeated payment webhook causes no duplicate booking, message or payment",
    evidence: [
      "tests/concurrency/guest-payment.test.ts",
      "tests/unit/services/payment-callback.test.ts",
      "supabase/tests/payments.sql",
    ],
    outstanding:
      "proved through the simulated provider, which is the only payment provider this demo ships",
  },
  {
    criterion: "a failed payment can be retried until the hold expires",
    evidence: [
      "tests/unit/domain/booking-state.test.ts",
      "tests/concurrency/hold-lifecycle.test.ts",
      "tests/concurrency/guest-payment.test.ts",
      "supabase/tests/payment-integrity.sql",
    ],
    outstanding:
      "proved through the simulated provider, which is the only payment provider this demo ships",
  },
  {
    criterion: "a late payment confirmation follows the defined recovery flow",
    evidence: [
      "tests/unit/domain/booking-state.test.ts",
      "tests/concurrency/guest-payment.test.ts",
      "tests/concurrency/payment-hardening.test.ts",
      "supabase/tests/payment-integrity.sql",
    ],
    outstanding:
      "proved through the simulated provider, which is the only payment provider this demo ships",
  },
  {
    criterion: "failed atomic rescheduling does not lose the old booking",
    evidence: [
      "tests/concurrency/reschedule.test.ts",
      "supabase/tests/booking-rpcs.sql",
    ],
  },
  {
    criterion:
      "walk-in, cash, terminal, payment-link and complimentary transactions appear correctly in Reporting and reconciliation",
    evidence: [
      "supabase/tests/payment-rpcs.sql",
      "tests/concurrency/refund-ceiling.test.ts",
    ],
    outstanding:
      "recording is proved; the Reporting half is §11 and is not built, so reconciliation itself is unproved",
  },
  {
    criterion:
      "service-fee activation, deactivation, percentage, label, payment, refund and Reporting are calculated correctly",
    evidence: ["tests/unit/domain/pricing.test.ts"],
  },
  {
    criterion: "disabling marketing communication does not stop required booking messages",
    evidence: ["tests/unit/domain/messaging-policy.test.ts"],
  },
  {
    criterion: "roles prevent unauthorised Management actions",
    evidence: [
      "supabase/tests/roles.sql",
      "supabase/tests/customers.sql",
      "supabase/tests/payment-rpcs.sql",
      "supabase/tests/reception-views.sql",
      "tests/integration/reception-embeds.test.ts",
    ],
  },
  {
    criterion: "reports reconcile to underlying bookings and provider references",
    evidence: [],
    outstanding:
      "§11 Reporting is not built; the priced breakdown is stored per booking so reporting sums rather than recomputes (INV-21)",
  },
  {
    criterion: "Light/Dark/System and mobile, tablet and desktop flows work completely",
    evidence: ["tests/unit/config/browser-theme.test.ts"],
    outstanding: "the Playwright suite is not installed yet; tests/e2e is empty",
  },
  {
    criterion:
      "SEO, pixels, UTM, email and WhatsApp delivery are verified with test evidence",
    evidence: ["tests/unit/config/seo.test.ts", "tests/unit/messaging/mailer.test.ts"],
    outstanding: "WhatsApp delivery is blocked on Q-8 Meta verification",
  },
];

describe("§16.1 — the client's mandatory acceptance list", () => {
  it("names all sixteen criteria", () => {
    expect(SECTION_16_1).toHaveLength(16);
  });

  it.each(SECTION_16_1.filter((entry) => entry.evidence.length > 0))(
    "keeps the evidence on disk for: $criterion",
    ({ evidence }) => {
      for (const file of evidence) {
        expect(existsSync(resolve(root, file)), `${file} is missing`).toBe(true);
      }
    },
  );

  it("records why every criterion without evidence is still outstanding", () => {
    const unproved = SECTION_16_1.filter((entry) => entry.evidence.length === 0);

    for (const entry of unproved) {
      expect(entry.outstanding, entry.criterion).toBeTruthy();
    }

    expect(unproved.map((entry) => entry.criterion)).toEqual([
      "reports reconcile to underlying bookings and provider references",
    ]);
  });
});
