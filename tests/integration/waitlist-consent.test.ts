import { execFileSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { WellPlaceClient } from "@/lib/db/types";
import { TERMS_ACCEPTANCE } from "@/lib/config/consent";
import { joinWaitlist } from "@/lib/services/waitlist-service";
import { waitlistSubmissionSchema } from "@/lib/validation/waitlist";

const REST_URL = process.env.WELLPLACE_TEST_REST_URL ?? "http://127.0.0.1:3001";

if (typeof globalThis.WebSocket === "undefined") {
  class UnusedWebSocket {
    constructor() {
      throw new Error("this test must not open a realtime connection");
    }
  }
  Object.assign(globalThis, { WebSocket: UnusedWebSocket });
}

let reachable = false;

beforeAll(async () => {
  try {
    const response = await fetch(`${REST_URL}/`, {
      signal: AbortSignal.timeout(1500),
    });
    reachable = response.ok;
  } catch {
    reachable = false;
  }
});

function client(): WellPlaceClient {
  return createClient(REST_URL, "local-harness") as unknown as WellPlaceClient;
}

function psql(sql: string): string {
  return execFileSync(
    "docker",
    [
      "exec",
      process.env.WELLPLACE_TEST_DB_NAME ?? "wellplace-test-db",
      "psql", "-U", "postgres", "-tAc", sql,
    ],
    { encoding: "utf8" },
  ).trim();
}

function readLead(column: string): string | null {
  const value = psql(
    `select coalesce(${column}::text, '<null>') from public.waitlist_leads ` +
      `where email = '${address}'`,
  );
  return value === "" ? null : value;
}

function latestConsent(): string | null {
  const value = psql(
    "select coalesce(e.granted::text, '<null>') " +
      "from public.marketing_consent_events e " +
      "join public.waitlist_entries w on w.id = e.waitlist_entry_id " +
      `where w.email = '${address}' order by e.seq desc limit 1`,
  );
  return value === "" ? null : value;
}

function consentEventCount(): number {
  return Number(
    psql(
      "select count(*) from public.marketing_consent_events e " +
        "join public.waitlist_entries w on w.id = e.waitlist_entry_id " +
        `where w.email = '${address}'`,
    ),
  );
}

const address = `consent.chain.${process.pid}.${Date.now()}@example.test`;

const base = {
  salutation: "ms" as const,
  firstName: "Consent",
  lastName: "Chain",
  email: address,
  dateOfBirth: { day: 4, month: 7, year: 1990 },
  phone: { e164: "+971500007777", countryIso2: "AE" },
};

afterAll(() => {
  if (!reachable) return;
  psql(`delete from public.waitlist_entries where email = '${address}'`);
});

describe("waitlist consent reaches the database [§5.2, §6.3, §11.4]", () => {
  it("a ticked box is stored as a grant, with the exact wording shown", async ({
    skip,
  }) => {
    if (!reachable) skip();

    const submission = waitlistSubmissionSchema.parse({
      ...base,
      termsAccepted: true,
    });
    expect(submission.termsAccepted).toBe(true);

    const result = await joinWaitlist(client(), submission);
    expect(result.outcome).toBe("joined");

    expect(result.entryId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isNaN(Date.parse(result.submittedAt ?? ""))).toBe(false);

    expect(latestConsent()).toBe("true");
    expect(consentEventCount()).toBe(1);

    expect(readLead("terms_acceptance_version")).toBe(TERMS_ACCEPTANCE.version);

    expect(
      psql(
        "select terms_acceptance_text from public.waitlist_entries " +
          `where email = '${address}'`,
      ),
    ).toBe(TERMS_ACCEPTANCE.text);
  });

  it("changing your mind on a second submission is recorded, not lost", async ({
    skip,
  }) => {
    if (!reachable) skip();

    const submission = waitlistSubmissionSchema.parse({
      ...base,
      termsAccepted: true,
      marketingConsent: false,
    });

    const result = await joinWaitlist(client(), submission);
    expect(result.outcome).toBe("already_on_list");

    expect(result.entryId).toBeUndefined();
    expect(result.submittedAt).toBeUndefined();

    expect(latestConsent()).toBe("true");
    expect(consentEventCount()).toBe(1);
  });

  it("deleting the entry takes its consent history with it [R-46, INV-28]", ({
    skip,
  }) => {
    if (!reachable) skip();

    const entryId = psql(
      `select id from public.waitlist_entries where email = '${address}'`,
    );
    expect(entryId).not.toBe("");

    psql(`delete from public.waitlist_entries where id = '${entryId}'`);

    expect(
      psql(
        "select count(*) from public.marketing_consent_events " +
          `where waitlist_entry_id = '${entryId}'`,
      ),
    ).toBe("0");
  });

  it("the wording the service sends is the constant the form renders", () => {
    expect(TERMS_ACCEPTANCE.text).toBe(
      TERMS_ACCEPTANCE.segments.map((segment) => segment.text).join(""),
    );
    expect(TERMS_ACCEPTANCE.version).not.toBe("");
  });
});
