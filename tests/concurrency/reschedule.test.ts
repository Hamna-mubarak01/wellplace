import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";

import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";
import {
  claimDatabase,
  harnessIsUp,
  releaseDatabase,
  removeHarnessStaff,
  resetSuites,
  upsertHarnessStaff,
  wipeUndocumentedBookings,
  withClient,
} from "./support/harness";

const BUFFER = requireSetting(EMPTY_SNAPSHOT, "cleaning.buffer_minutes");
const DURATION = requireSetting(EMPTY_SNAPSHOT, "booking.durations_hours")[0];

const STAFF_ID = "9e2e0001-0000-4000-8000-000000000001";
const STAFF_EMAIL = "reschedule.harness@example.test";

const QUORUM_ID = "9e2e0001-0000-4000-8000-000000000002";
const QUORUM_EMAIL = "reschedule.quorum@example.test";

const ORIGINAL = new Date("2026-12-09T06:00:00.000Z");
const TARGET = new Date("2026-12-09T14:00:00.000Z");

let up = false;

async function asStaff<T>(run: (client: Client) => Promise<T>): Promise<T> {
  return withClient(async (client) => {
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [
      STAFF_ID,
    ]);
    await client.query("select set_config('request.jwt.claim.email', $1, false)", [
      STAFF_EMAIL,
    ]);
    return run(client);
  });
}

interface BookingRow {
  booking_id: string;
  reference: string;
  suite_id: string;
  suite_number: number;
}

async function createBooking(
  client: Client,
  startsAt: Date,
  email: string,
): Promise<BookingRow> {
  const { rows } = await client.query<BookingRow>(
    `select booking_id, reference, suite_id, suite_number
       from public.create_reception_booking(
         'walk_in'::public.booking_source, 'ms'::public.salutation,
         'Reschedule', 'Harness', $1, date '1990-01-01',
         '+971500000001', 'AE',
         $2::timestamptz, $3::int, $4::int,
         2, array[]::integer[], '[]'::jsonb,
         null, null,
         '{"subtotal_fils":0,"discount_fils":0,"addons_fils":0,"service_fee_fils":0,"tax_fils":0,"total_fils":0}'::jsonb,
         false, '[]'::jsonb, 'Concurrency harness'
       )`,
    [email, startsAt.toISOString(), DURATION, BUFFER],
  );
  return rows[0];
}

interface Snapshot {
  status: string;
  suite_id: string | null;
  occupancy_id: string | null;
  experience_from: string;
  experience_to: string;
  active_claims: number;
}

async function snapshot(client: Client, bookingId: string): Promise<Snapshot> {
  const { rows } = await client.query<Snapshot>(
    `select b.status::text,
            b.suite_id::text,
            b.occupancy_id::text,
            lower(b.experience_period)::text as experience_from,
            upper(b.experience_period)::text as experience_to,
            (select count(*)::int from public.suite_occupancy o
              where o.booking_id = b.id and o.is_active) as active_claims
       from public.bookings b where b.id = $1`,
    [bookingId],
  );
  return rows[0];
}

beforeAll(async () => {
  up = await harnessIsUp();
  if (!up) {
    console.warn("reschedule: no local database — start it with npm run db:test:up");
    return;
  }

  await claimDatabase();
  await removeHarnessStaff();
  await upsertHarnessStaff([
    {
      id: QUORUM_ID,
      email: QUORUM_EMAIL,
      fullName: "Reschedule Quorum",
      role: "management",
    },
    {
      id: STAFF_ID,
      email: STAFF_EMAIL,
      fullName: "Reschedule Harness",
      role: "reception",
    },
  ]);
});

afterAll(async () => {
  if (!up) return;
  await wipeUndocumentedBookings();
  await removeHarnessStaff();
  await releaseDatabase();
});

beforeEach(async () => {
  if (!up) return;
  await wipeUndocumentedBookings();
  await resetSuites({ available: 1 });
});

describe("§16.1 — failed atomic rescheduling does not lose the old booking [INV-12]", () => {
  it("keeps the old booking, its suite and its live claim when the new slot cannot be secured", async ({
    skip,
  }) => {
    if (!up) skip();

    await asStaff(async (client) => {
      const booking = await createBooking(client, ORIGINAL, "keeper@example.test");
      const before = await snapshot(client, booking.booking_id);

      expect(before.status).toBe("confirmed");
      expect(before.active_claims).toBe(1);

      await client.query(
        `insert into public.suite_occupancy (
           suite_id, kind, status, experience_period, blocked_period,
           cleaning_buffer_minutes, is_active, reason
         ) values (
           $1::uuid, 'block', 'active',
           tstzrange($2::timestamptz, $2::timestamptz + interval '3 hours', '[)'),
           tstzrange(
             $2::timestamptz,
             $2::timestamptz + interval '3 hours' + make_interval(mins => $3::int),
             '[)'
           ),
           $3::int, true, 'Harness block'
         )`,
        [booking.suite_id, TARGET.toISOString(), BUFFER],
      );

      await expect(
        client.query(
          `select * from public.reschedule_booking(
           p_booking_id => $1,
           p_starts_at => $2::timestamptz,
           p_reason => $4,
           p_duration_hours => $3::int)`,
          [booking.booking_id, TARGET.toISOString(), DURATION, "Guest asked to move"],
        ),
      ).rejects.toThrow();

      const after = await snapshot(client, booking.booking_id);

      expect(after.status).toBe(before.status);
      expect(after.suite_id).toBe(before.suite_id);
      expect(after.occupancy_id).toBe(before.occupancy_id);
      expect(after.experience_from).toBe(before.experience_from);
      expect(after.experience_to).toBe(before.experience_to);
      expect(after.active_claims).toBe(1);
    });
  });

  it("moves the booking and releases exactly one old claim when the new slot is free", async ({
    skip,
  }) => {
    if (!up) skip();

    await asStaff(async (client) => {
      const booking = await createBooking(client, ORIGINAL, "mover@example.test");
      const before = await snapshot(client, booking.booking_id);

      await client.query(
        `select * from public.reschedule_booking(
           p_booking_id => $1,
           p_starts_at => $2::timestamptz,
           p_reason => $4,
           p_duration_hours => $3::int)`,
        [booking.booking_id, TARGET.toISOString(), DURATION, "Guest asked to move"],
      );

      const after = await snapshot(client, booking.booking_id);

      expect(after.experience_from).not.toBe(before.experience_from);
      expect(after.active_claims).toBe(1);
      expect(after.occupancy_id).not.toBe(before.occupancy_id);

      const { rows } = await client.query<{ released: string }>(
        `select count(*)::text as released from public.suite_occupancy
          where booking_id = $1 and not is_active`,
        [booking.booking_id],
      );

      expect(Number(rows[0].released)).toBeGreaterThanOrEqual(1);
    });
  });

  it("R-17 — the old claim is released by status, never deleted", async ({ skip }) => {
    if (!up) skip();

    await asStaff(async (client) => {
      const booking = await createBooking(client, ORIGINAL, "keeper2@example.test");

      await client.query(
        `select * from public.reschedule_booking(
           p_booking_id => $1,
           p_starts_at => $2::timestamptz,
           p_reason => $4,
           p_duration_hours => $3::int)`,
        [booking.booking_id, TARGET.toISOString(), DURATION, "Guest asked to move"],
      );

      const { rows } = await client.query<{ status: string; is_active: boolean }>(
        `select status::text, is_active from public.suite_occupancy
          where booking_id = $1 order by is_active`,
        [booking.booking_id],
      );

      expect(rows).toHaveLength(2);
      expect(rows[0].is_active).toBe(false);
      expect(rows[0].status).toBe("released");
      expect(rows[1].is_active).toBe(true);
    });
  });
});

it("[§7.6] rescheduling availability excludes its own claim, keeps exact minutes and the saved buffer", async ({ skip }) => {
  if (!up) skip();
  await asStaff(async (client) => {
    const booking = await createBooking(client, ORIGINAL, "preview@example.test");
    const before = await snapshot(client, booking.booking_id);
    const ordinary = await client.query("select * from public.count_available_suites($1::timestamptz[], $2, $3)", [[ORIGINAL.toISOString()], DURATION, BUFFER]);
    expect(ordinary.rows[0].remaining).toBe(0);
    const own = await client.query("select * from public.count_reschedule_suites($1, $2::timestamptz[], $3)", [booking.booking_id, [ORIGINAL.toISOString()], DURATION * 60]);
    expect(own.rows[0].remaining).toBe(1);
    expect(own.rows[0].reduced_by_demand).toBe(false);
    await createBooking(client, new Date(TARGET.getTime() + (150 + BUFFER) * 60_000), "next-preview@example.test");
    const exact = await client.query("select * from public.count_reschedule_suites($1, $2::timestamptz[], 150)", [booking.booking_id, [TARGET.toISOString()]]);
    expect(exact.rows[0].remaining).toBe(1);
    const longer = await client.query("select * from public.count_reschedule_suites($1, $2::timestamptz[], 151)", [booking.booking_id, [TARGET.toISOString()]]);
    expect(longer.rows[0].remaining).toBe(0);
    expect(longer.rows[0].reduced_by_demand).toBe(true);
    expect(await snapshot(client, booking.booking_id)).toEqual(before);
    const grants = await client.query("select has_function_privilege('anon', 'public.count_reschedule_suites(uuid,timestamptz[],integer)', 'EXECUTE') as anon, has_function_privilege('authenticated', 'internal.count_available_suite_windows(timestamptz[],integer,integer,uuid)', 'EXECUTE') as internal");
    expect(grants.rows[0]).toEqual({ anon: false, internal: false });
  });
});
