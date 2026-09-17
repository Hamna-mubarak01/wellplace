import { beforeAll, describe, expect, it } from "vitest";

const REST_URL = process.env.WELLPLACE_TEST_REST_URL ?? "http://127.0.0.1:3001";

let reachable = false;

beforeAll(async () => {
  try {
    const response = await fetch(`${REST_URL}/`, { signal: AbortSignal.timeout(1500) });
    reachable = response.ok;
  } catch {
    reachable = false;
  }
});

async function probe(path: string): Promise<{ status: number; code: string | null }> {
  const response = await fetch(`${REST_URL}/rest/v1/${path}`);
  const body = (await response.json().catch(() => null)) as { code?: string } | null;
  return { status: response.status, code: body?.code ?? null };
}

const SELECTS: ReadonlyArray<{ name: string; path: string }> = [
  {
    name: "the board view carries every column the console reads",
    path:
      "reception_board?select=occupancy_id,suite_id,kind,experience_from," +
      "experience_to,blocked_to,cleaning_buffer_minutes,expires_at,reason," +
      "booking_id,booking_reference,booking_status,guest_name,board_state",
  },
  {
    name: "booking detail reads guests, add-ons and acceptance",
    path:
      "bookings?select=id,reference,customers(first_name),suites(suite_number)," +
      "booking_guests(kind,age),booking_addons(name_snapshot),acceptance_records(document_slug)",
  },
  {
    name: "the cleaning board names its assignee",
    path:
      "cleaning_tasks?select=id,suites(suite_number)," +
      "staff!cleaning_tasks_assigned_to_fkey(full_name)",
  },
  {
    name: "the task list names its assignee",
    path: "tasks?select=id,staff!tasks_assigned_to_fkey(full_name)",
  },
  {
    name: "shift notes name their author",
    path: "shift_notes?select=id,staff(full_name)",
  },
  {
    name: "the payment-status filter joins payments",
    path: "bookings?select=id,payments!inner(status)",
  },
];

describe("every Reception embed resolves against the live schema", () => {
  it("proves the probe can tell a bad embed from a denied table", async ({ skip }) => {
    if (!reachable) skip();

    const missingTable = await probe("bookings?select=id,nonexistent_table(x)");
    expect(missingTable.code).toBe("PGRST200");

    const wrongHint = await probe(
      "cleaning_tasks?select=id,staff!wrong_fkey_name(full_name)",
    );
    expect(wrongHint.code).toBe("PGRST200");
  });

  for (const { name, path } of SELECTS) {
    it(name, async ({ skip }) => {
      if (!reachable) skip();

      const result = await probe(path);

      expect(
        result.code,
        "PGRST200 means the relationship or foreign-key hint does not exist",
      ).not.toBe("PGRST200");
    });
  }
});

describe("INV-01 — no Reception table is reachable without a staff session", () => {
  const TABLES = [
    "reception_board",
    "booking_search",
    "booking_detail",
    "bookings",
    "customers",
    "suite_occupancy",
    "suites",
    "payments",
    "cleaning_tasks",
    "tasks",
    "alerts",
    "shift_notes",
    "messages",
  ];

  for (const table of TABLES) {
    it(`anon is refused ${table}`, async ({ skip }) => {
      if (!reachable) skip();

      const result = await probe(`${table}?select=*`);
      expect(result.status).toBe(401);
      expect(result.code).toBe("42501");
    });
  }

  it("but the public booking settings view stays readable", async ({ skip }) => {
    if (!reachable) skip();

    const response = await fetch(`${REST_URL}/rest/v1/public_booking_settings?select=*`);
    expect(response.status).toBe(200);
  });
});

describe("the guest prices a booking without a session, and learns nothing about suites", () => {
  const PUBLIC = ["public_price_rules", "public_addons", "public_booking_settings"];

  for (const view of PUBLIC) {
    it(`anon can read ${view}`, async ({ skip }) => {
      if (!reachable) skip();

      const response = await fetch(`${REST_URL}/rest/v1/${view}?select=*`);
      expect(response.status).toBe(200);
    });
  }

  it("INV-01 — no public pricing view carries a suite identifier or a capacity", async ({
    skip,
  }) => {
    if (!reachable) skip();

    const forbidden = /suite|capacity|occupanc|inventory|reception_note/i;

    for (const view of PUBLIC) {
      const response = await fetch(`${REST_URL}/rest/v1/${view}?select=*`);
      const rows = (await response.json()) as unknown[];

      expect(Array.isArray(rows), view).toBe(true);

      for (const row of rows) {
        for (const key of Object.keys(row as Record<string, unknown>)) {
          expect(forbidden.test(key), `${view}.${key}`).toBe(false);
        }
      }
    }
  });

  it("the four launch price tiers reach the guest exactly as configured", async ({
    skip,
  }) => {
    if (!reachable) skip();

    const response = await fetch(`${REST_URL}/rest/v1/public_price_rules?select=*`);
    const rows = (await response.json()) as {
      guest_kind: string;
      from_hour: number;
      to_hour: number | null;
      regular_fils_per_hour: number;
      offer_fils_per_hour: number | null;
    }[];

    const shape = rows
      .map(
        (row) =>
          `${row.guest_kind}:${row.from_hour}-${row.to_hour ?? "x"}:${row.regular_fils_per_hour}/${row.offer_fils_per_hour}`,
      )
      .toSorted();

    expect(shape).toEqual([
      "adult:1-2:22000/16500",
      "adult:3-x:22000/14000",
      "child:1-2:17000/12750",
      "child:3-x:17000/11000",
    ]);
  });

  it("anon cannot read the price rules table, the add-ons table or the promo codes", async ({
    skip,
  }) => {
    if (!reachable) skip();

    for (const table of ["price_rules", "addons", "promo_codes", "promo_code_redemptions"]) {
      const result = await probe(`${table}?select=*`);
      expect(result.status, table).toBe(401);
      expect(result.code, table).toBe("42501");
    }
  });
});
