import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";
import { harnessIsUp, resetSuites, withClient,
  claimDatabase,
  releaseDatabase,
} from "./support/harness";


const HOLD_MINUTES = requireSetting(EMPTY_SNAPSHOT, "hold.minutes");
const BUFFER = requireSetting(EMPTY_SNAPSHOT, "cleaning.buffer_minutes");
const DURATION = requireSetting(EMPTY_SNAPSHOT, "booking.durations_hours")[0];

const SLOT = new Date("2026-12-02T06:00:00.000Z");

interface HoldRow {
  occupancy_id: string;
  suite_id: string;
  expires_at: Date;
}

async function hold(startsAt: Date = SLOT): Promise<HoldRow | null> {
  return withClient(async (client) => {
    const { rows } = await client.query<HoldRow>(
      `select occupancy_id, suite_id, expires_at
         from public.hold_suite($1::timestamptz, $2::int, $3::int, $4::int)`,
      [startsAt.toISOString(), DURATION, BUFFER, HOLD_MINUTES],
    );
    return rows[0] ?? null;
  });
}

let up = false;

beforeAll(async () => {
  up = await harnessIsUp();
  if (up) await claimDatabase();
});

beforeEach(async () => {
  if (up) await resetSuites();
});

afterAll(async () => {
  if (up) await resetSuites();
  await releaseDatabase();
});

describe("§16.1 — a hold reserves immediately, shows an accurate countdown and reliably releases availability on expiry", () => {
  it("reserves a suite immediately, inside the same transaction", async (ctx) => {
    if (!up) ctx.skip();

    const before = Date.now();
    const held = await hold();
    const after = Date.now();

    expect(held).not.toBeNull();

    const row = await withClient(async (client) => {
      const { rows } = await client.query<{
        is_active: boolean;
        status: string;
        kind: string;
        created_at: Date;
        cleaning_buffer_minutes: number;
      }>(
        `select is_active, status::text as status, kind::text as kind,
                created_at, cleaning_buffer_minutes
           from public.suite_occupancy where id = $1`,
        [held!.occupancy_id],
      );
      return rows[0];
    });

    expect(row.is_active).toBe(true);
    expect(row.status).toBe("active");
    expect(row.kind).toBe("hold");
    expect(row.created_at.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(row.created_at.getTime()).toBeLessThanOrEqual(after + 1000);
  });

  it("returns a countdown target exactly the configured hold length ahead", async (ctx) => {
    if (!up) ctx.skip();

    const held = await hold();
    expect(held).not.toBeNull();

    const createdAt = await withClient(async (client) => {
      const { rows } = await client.query<{ created_at: Date }>(
        "select created_at from public.suite_occupancy where id = $1",
        [held!.occupancy_id],
      );
      return rows[0].created_at;
    });

    const aheadMinutes =
      (held!.expires_at.getTime() - createdAt.getTime()) / 60_000;

    expect(aheadMinutes).toBeCloseTo(HOLD_MINUTES, 1);
    expect(HOLD_MINUTES).toBe(10);
  });

  it("releases availability on expiry with no cleanup job having run [INV-05]", async (ctx) => {
    if (!up) ctx.skip();

    await resetSuites({ available: 1 });
    const first = await hold();
    expect(first).not.toBeNull();

    expect(await hold()).toBeNull();

    await withClient(async (client) => {
      await client.query(
        "update public.suite_occupancy set expires_at = now() - interval '1 second' where id = $1",
        [first!.occupancy_id],
      );
    });

    const second = await hold();

    expect(second).not.toBeNull();
    expect(second!.suite_id).toBe(first!.suite_id);

    const previous = await withClient(async (client) => {
      const { rows } = await client.query<{ status: string; is_active: boolean }>(
        "select status::text as status, is_active from public.suite_occupancy where id = $1",
        [first!.occupancy_id],
      );
      return rows[0];
    });

    expect(previous).toBeDefined();
    expect(previous.status).toBe("expired");
    expect(previous.is_active).toBe(false);
  });
});
