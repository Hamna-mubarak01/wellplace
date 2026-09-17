import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";

import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";
import {
  claimDatabase,
  clearCleaningTasks,
  harnessIsUp,
  releaseDatabase,
  removeHarnessStaff,
  requireSeededReferenceData,
  resetSuites,
  upsertHarnessStaff,
  wipeUndocumentedBookings,
  withClient,
} from "../concurrency/support/harness";

const BUFFER = requireSetting(EMPTY_SNAPSHOT, "cleaning.buffer_minutes");
const DURATION = requireSetting(EMPTY_SNAPSHOT, "booking.durations_hours")[0];

const DESK_ID = "9e2e0002-0000-4000-8000-000000000001";
const DESK_EMAIL = "payments.desk@example.test";

const MANAGER_ID = "9e2e0002-0000-4000-8000-000000000002";
const MANAGER_EMAIL = "payments.manager@example.test";

const REASON = "Reception payment-method acceptance test";

const CASH_FILS = 66_000;
const TERMINAL_FILS = 94_000;
const LINK_FILS = 122_000;

interface BookingRow {
  booking_id: string;
  reference: string;
  suite_id: string;
  suite_number: number;
}

interface RecordedPayment {
  payment_id: string;
  payment_status: string;
  payment_method: string;
  amount_fils: number;
  booking_comped: boolean;
}

let up = false;

async function asStaff<T>(
  staffId: string,
  email: string,
  run: (client: Client) => Promise<T>,
): Promise<T> {
  return withClient(async (client) => {
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [
      staffId,
    ]);
    await client.query("select set_config('request.jwt.claim.email', $1, false)", [
      email,
    ]);
    return run(client);
  });
}

const asDesk = <T>(run: (client: Client) => Promise<T>) =>
  asStaff(DESK_ID, DESK_EMAIL, run);

const asManager = <T>(run: (client: Client) => Promise<T>) =>
  asStaff(MANAGER_ID, MANAGER_EMAIL, run);

async function createBooking(
  client: Client,
  source: string,
  startsAt: Date,
  email: string,
  totalFils: number,
  isComplimentary: boolean,
): Promise<BookingRow> {
  const price = JSON.stringify({
    subtotal_fils: totalFils,
    discount_fils: 0,
    addons_fils: 0,
    service_fee_fils: 0,
    tax_fils: 0,
    total_fils: totalFils,
  });

  const { rows } = await client.query<BookingRow>(
    `select booking_id, reference, suite_id, suite_number
       from public.create_reception_booking(
         $1::public.booking_source, 'ms'::public.salutation,
         'Reconciliation', 'Fixture', $2, date '1990-01-01',
         '+971500000002', 'AE',
         $3::timestamptz, $4::int, $5::int,
         2, array[]::integer[], '[]'::jsonb,
         null, null,
         $6::jsonb,
         $7::boolean, '[]'::jsonb, $8
       )`,
    [
      source,
      email,
      startsAt.toISOString(),
      DURATION,
      BUFFER,
      price,
      isComplimentary,
      REASON,
    ],
  );

  return rows[0];
}

async function recordPayment(
  client: Client,
  bookingId: string,
  method: string,
  amountFils: number,
  providerReference: string | null,
): Promise<RecordedPayment> {
  const { rows } = await client.query<RecordedPayment>(
    `select payment_id::text as payment_id,
            payment_status::text as payment_status,
            payment_method::text as payment_method,
            amount_fils,
            booking_comped
       from public.record_booking_payment(
         $1::uuid, $2::public.payment_method, $3::int, $4, null, $5
       )`,
    [bookingId, method, amountFils, providerReference, REASON],
  );
  return rows[0];
}

async function wipe(): Promise<void> {
  await clearCleaningTasks();
  await wipeUndocumentedBookings();
}

beforeAll(async () => {
  up = await harnessIsUp();

  if (!up) {
    console.warn(
      "\n  ⚠ tests/integration/reception-payment-methods skipped — no local Postgres.\n" +
        "    Start it first: npm run db:test:up && npm run db:migrate && npm run db:seed\n",
    );
    return;
  }

  await claimDatabase();
  await requireSeededReferenceData();

  await removeHarnessStaff();
  await upsertHarnessStaff([
    {
      id: DESK_ID,
      email: DESK_EMAIL,
      fullName: "Payments Desk",
      role: "reception",
    },
    {
      id: MANAGER_ID,
      email: MANAGER_EMAIL,
      fullName: "Payments Manager",
      role: "management",
    },
  ]);
});

beforeEach(async () => {
  if (!up) return;
  await wipe();
  await resetSuites();
});

afterAll(async () => {
  if (up) {
    await wipe();
    await resetSuites();
    await removeHarnessStaff();
  }
  await releaseDatabase();
});

describe("§16.1 — walk-in, cash, terminal, payment-link and complimentary transactions appear correctly in Reporting and reconciliation", () => {
  it("records each creation source and each payment method as its own distinct row [§8, §9.2]", async ({
    skip,
  }) => {
    if (!up) skip();

    await asDesk(async (client) => {
      const walkIn = await createBooking(
        client,
        "walk_in",
        new Date("2026-12-20T06:00:00.000Z"),
        "walkin@example.test",
        CASH_FILS,
        false,
      );
      const telephone = await createBooking(
        client,
        "telephone",
        new Date("2026-12-20T10:00:00.000Z"),
        "telephone@example.test",
        TERMINAL_FILS,
        false,
      );
      const manual = await createBooking(
        client,
        "manual",
        new Date("2026-12-20T14:00:00.000Z"),
        "manual@example.test",
        LINK_FILS,
        false,
      );
      const comped = await createBooking(
        client,
        "complimentary",
        new Date("2026-12-20T18:00:00.000Z"),
        "comped@example.test",
        0,
        true,
      );

      const cash = await recordPayment(client, walkIn.booking_id, "cash", CASH_FILS, null);
      const terminal = await recordPayment(
        client,
        telephone.booking_id,
        "card_terminal",
        TERMINAL_FILS,
        "TERM-0001",
      );
      const link = await recordPayment(
        client,
        manual.booking_id,
        "payment_link",
        LINK_FILS,
        "LINK-0001",
      );
      const free = await recordPayment(
        client,
        comped.booking_id,
        "complimentary",
        0,
        null,
      );

      expect(cash.payment_method).toBe("cash");
      expect(cash.amount_fils).toBe(CASH_FILS);
      expect(terminal.payment_method).toBe("card_terminal");
      expect(terminal.amount_fils).toBe(TERMINAL_FILS);
      expect(link.payment_method).toBe("payment_link");
      expect(link.amount_fils).toBe(LINK_FILS);
      expect(free.payment_method).toBe("complimentary");
      expect(free.amount_fils).toBe(0);
      expect(free.booking_comped).toBe(true);

      for (const payment of [cash, terminal, link, free]) {
        expect(payment.payment_status).toBe("paid");
      }

      expect(
        new Set([cash.payment_id, terminal.payment_id, link.payment_id, free.payment_id])
          .size,
      ).toBe(4);

      const { rows: sources } = await client.query<{ source: string; count: string }>(
        `select source::text as source, count(*)::text as count
           from public.booking_search
          where booking_id = any($1::uuid[])
          group by source
          order by source`,
        [[walkIn.booking_id, telephone.booking_id, manual.booking_id, comped.booking_id]],
      );

      expect(sources.map((row) => `${row.source}:${row.count}`)).toEqual([
        "complimentary:1",
        "manual:1",
        "telephone:1",
        "walk_in:1",
      ]);
    });
  });

  it("reconciles the takings by method, and the complimentary booking adds nothing to them [§11.2, INV-20]", async ({
    skip,
  }) => {
    if (!up) skip();

    await asDesk(async (client) => {
      const paid = await createBooking(
        client,
        "walk_in",
        new Date("2026-12-21T06:00:00.000Z"),
        "paying@example.test",
        CASH_FILS,
        false,
      );
      const comped = await createBooking(
        client,
        "complimentary",
        new Date("2026-12-21T10:00:00.000Z"),
        "free@example.test",
        0,
        true,
      );

      await recordPayment(client, paid.booking_id, "cash", CASH_FILS, null);
      await recordPayment(client, comped.booking_id, "complimentary", 0, null);

      const { rows } = await client.query<{
        method: string;
        taken_fils: string;
        bookings: string;
      }>(
        `select p.method::text as method,
                sum(p.amount_fils)::text as taken_fils,
                count(distinct p.booking_id)::text as bookings
           from public.payments p
          where p.status = 'paid'
            and p.booking_id = any($1::uuid[])
          group by p.method
          order by p.method`,
        [[paid.booking_id, comped.booking_id]],
      );

      const byMethod = new Map(rows.map((row) => [row.method, Number(row.taken_fils)]));

      expect(byMethod.get("cash")).toBe(CASH_FILS);
      expect(byMethod.get("complimentary")).toBe(0);

      const revenueFils = rows
        .filter((row) => row.method !== "complimentary")
        .reduce((sum, row) => sum + Number(row.taken_fils), 0);

      expect(revenueFils).toBe(CASH_FILS);

      const { rows: flagged } = await client.query<{
        reference: string;
        is_complimentary: boolean;
        total_fils: number | null;
      }>(
        `select reference, is_complimentary, total_fils
           from public.bookings
          order by reference`,
      );

      const compedRow = flagged.find((row) => row.reference === comped.reference);
      expect(compedRow?.is_complimentary).toBe(true);
      expect(compedRow?.total_fils).toBe(0);

      const payingRow = flagged.find((row) => row.reference === paid.reference);
      expect(payingRow?.is_complimentary).toBe(false);
      expect(payingRow?.total_fils).toBe(CASH_FILS);
    });
  });

  it("refuses money against a complimentary booking rather than quietly counting it [WP033, INV-20]", async ({
    skip,
  }) => {
    if (!up) skip();

    await asDesk(async (client) => {
      const comped = await createBooking(
        client,
        "complimentary",
        new Date("2026-12-22T06:00:00.000Z"),
        "nomoney@example.test",
        0,
        true,
      );

      await expect(
        recordPayment(client, comped.booking_id, "cash", CASH_FILS, null),
      ).rejects.toThrow(/complimentary/i);

      const { rows } = await client.query<{ count: string }>(
        "select count(*)::text as count from public.payments where booking_id = $1 or recorded_by = $2",
        [comped.booking_id, DESK_ID],
      );
      expect(rows[0].count).toBe("0");
    });
  });

  it("refuses to mark an online payment paid by hand, because that is the webhook's word [§3, §8, INV-08]", async ({
    skip,
  }) => {
    if (!up) skip();

    await asDesk(async (client) => {
      const booking = await createBooking(
        client,
        "walk_in",
        new Date("2026-12-23T06:00:00.000Z"),
        "online@example.test",
        CASH_FILS,
        false,
      );

      await expect(
        recordPayment(client, booking.booking_id, "online", CASH_FILS, "SIM-1"),
      ).rejects.toThrow(/webhook/i);
    });
  });

  it("shows a booking's own reconciled total to a desk with no confidential-figures permission [§9.2, §10.6, Q-10]", async ({
    skip,
  }) => {
    if (!up) skip();

    const reference = await asDesk(async (client) => {
      const booking = await createBooking(
        client,
        "walk_in",
        new Date("2026-12-24T06:00:00.000Z"),
        "gated@example.test",
        CASH_FILS,
        false,
      );
      await recordPayment(client, booking.booking_id, "cash", CASH_FILS, null);
      return booking.reference;
    });

    const deskTotal = await asDesk(async (client) => {
      const { rows } = await client.query<{ total_fils: number | null }>(
        "select total_fils from public.booking_search where reference = $1",
        [reference],
      );
      return rows[0].total_fils;
    });

    const managerTotal = await asManager(async (client) => {
      const { rows } = await client.query<{ total_fils: number | null }>(
        "select total_fils from public.booking_search where reference = $1",
        [reference],
      );
      return rows[0].total_fils;
    });

    expect(deskTotal).toBe(CASH_FILS);
    expect(managerTotal).toBe(CASH_FILS);
  });
});
