import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";

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

const CONNECTION =
  process.env.WELLPLACE_TEST_DB_URL ??
  `postgres://postgres:postgres@127.0.0.1:${process.env.WELLPLACE_TEST_DB_PORT ?? "54329"}/postgres`;

const BUFFER = requireSetting(EMPTY_SNAPSHOT, "cleaning.buffer_minutes");
const DURATION = requireSetting(EMPTY_SNAPSHOT, "booking.durations_hours")[0];

const MANAGER_ID = "9e2e0003-0000-4000-8000-000000000001";
const RECEPTION_ID = "9e2e0003-0000-4000-8000-000000000002";
const RECEPTION_EMAIL = "refund.reception@example.test";
const MANAGER_EMAIL = "refund.manager@example.test";

const PAYMENT_FILS = 40_000;
const START = new Date("2026-12-16T06:00:00.000Z");

let up = false;

async function asManager<T>(client: Client, run: () => Promise<T>): Promise<T> {
  await client.query("select set_config('request.jwt.claim.sub', $1, false)", [
    MANAGER_ID,
  ]);
  await client.query("select set_config('request.jwt.claim.email', $1, false)", [
    MANAGER_EMAIL,
  ]);
  return run();
}

async function seedPaidBooking(): Promise<string> {
  return withClient(async (client) =>
    (async () => {
      await client.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.email', $2, false)", [RECEPTION_ID, RECEPTION_EMAIL]);
      const { rows } = await client.query<{ booking_id: string }>(
        `select booking_id from public.create_reception_booking(
           'walk_in'::public.booking_source, 'ms'::public.salutation,
           'Refund', 'Ceiling', 'refund.ceiling@example.test', date '1990-01-01',
           '+971500000009', 'AE',
           $1::timestamptz, $2::int, $3::int,
           2, array[]::integer[], '[]'::jsonb, null, null,
           $4::jsonb, false, '[]'::jsonb, 'Refund ceiling harness')`,
        [
          START.toISOString(),
          DURATION,
          BUFFER,
          JSON.stringify({
            subtotal_fils: PAYMENT_FILS,
            discount_fils: 0,
            addons_fils: 0,
            service_fee_fils: 0,
            tax_fils: 0,
            total_fils: PAYMENT_FILS,
          }),
        ],
      );

      const bookingId = rows[0].booking_id;

      const payment = await client.query<{ payment_id: string }>(
        `select payment_id from public.record_booking_payment(
           $1::uuid, 'cash'::public.payment_method, $2::int, '', '', 'Paid at the desk')`,
        [bookingId, PAYMENT_FILS],
      );

      return payment.rows[0].payment_id;
    })(),
  );
}

beforeAll(async () => {
  up = await harnessIsUp();
  if (!up) {
    console.warn("refund ceiling: no local database — npm run db:test:up");
    return;
  }

  await claimDatabase();
  await removeHarnessStaff();
  await upsertHarnessStaff([
    { id: RECEPTION_ID, email: RECEPTION_EMAIL, fullName: "Refund Reception", role: "reception" },
    {
      id: MANAGER_ID,
      email: MANAGER_EMAIL,
      fullName: "Refund Manager",
      role: "management",
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
  await resetSuites({ available: 7 });
});

describe("§8 / §11.2 — the refund ceiling holds under concurrency", () => {
  it("refuses two partial refunds that would together exceed the payment", async ({
    skip,
  }) => {
    if (!up) skip();

    const paymentId = await seedPaidBooking();

    const attempt = async (amountFils: number) => {
      const client = new Client({ connectionString: CONNECTION });
      await client.connect();

      try {
        return await asManager(client, async () => {
          await client.query(
            `select * from public.record_refund($1::uuid, $2::int, 'Partial refund')`,
            [paymentId, amountFils],
          );
          return { ok: true as const, error: null };
        });
      } catch (cause) {
        return {
          ok: false as const,
          error: cause instanceof Error ? cause.message : String(cause),
        };
      } finally {
        await client.end().catch(() => {});
      }
    };

    const [first, second] = await Promise.all([attempt(25_000), attempt(25_000)]);

    const succeeded = [first, second].filter((result) => result.ok);
    const refused = [first, second].filter((result) => !result.ok);

    expect(succeeded).toHaveLength(1);
    expect(refused).toHaveLength(1);
    expect(refused[0].error).toMatch(/exceed/i);

    const total = await withClient(async (client) => {
      const { rows } = await client.query<{ total: string }>(
        `select coalesce(sum(amount_fils), 0)::text as total
           from public.refunds where payment_id = $1`,
        [paymentId],
      );
      return Number(rows[0].total);
    });

    expect(total).toBe(25_000);
    expect(total).toBeLessThanOrEqual(PAYMENT_FILS);
  });

  it("lets two partial refunds through when together they fit", async ({ skip }) => {
    if (!up) skip();

    const paymentId = await seedPaidBooking();

    const attempt = async (amountFils: number) => {
      const client = new Client({ connectionString: CONNECTION });
      await client.connect();
      try {
        return await asManager(client, async () => {
          await client.query(
            `select * from public.record_refund($1::uuid, $2::int, 'Partial refund')`,
            [paymentId, amountFils],
          );
          return true;
        });
      } catch {
        return false;
      } finally {
        await client.end().catch(() => {});
      }
    };

    const results = await Promise.all([attempt(15_000), attempt(15_000)]);

    expect(results.filter(Boolean)).toHaveLength(2);

    const { total, status } = await withClient(async (client) => {
      const { rows } = await client.query<{ total: string; status: string }>(
        `select coalesce(sum(r.amount_fils), 0)::text as total,
                max(p.status::text) as status
           from public.payments p
           left join public.refunds r on r.payment_id = p.id
          where p.id = $1
          group by p.id`,
        [paymentId],
      );
      return { total: Number(rows[0].total), status: rows[0].status };
    });

    expect(total).toBe(30_000);
    expect(status).toBe("partially_refunded");
  });

  it("never lets the refunded total exceed the payment, whatever the order", async ({
    skip,
  }) => {
    if (!up) skip();

    const paymentId = await seedPaidBooking();

    const amounts = [30_000, 20_000, 15_000, 10_000, 5_000];

    await Promise.all(
      amounts.map(async (amountFils) => {
        const client = new Client({ connectionString: CONNECTION });
        await client.connect();
        try {
          await asManager(client, async () => {
            await client.query(
              `select * from public.record_refund($1::uuid, $2::int, 'Racing refund')`,
              [paymentId, amountFils],
            );
          });
        } catch {
          return;
        } finally {
          await client.end().catch(() => {});
        }
      }),
    );

    const total = await withClient(async (client) => {
      const { rows } = await client.query<{ total: string }>(
        `select coalesce(sum(amount_fils), 0)::text as total
           from public.refunds where payment_id = $1`,
        [paymentId],
      );
      return Number(rows[0].total);
    });

    expect(total).toBeLessThanOrEqual(PAYMENT_FILS);
  });
});

it("[§8, §11.2] only Management can confirm an external refund, and repeat confirmation is idempotent", async ({ skip }) => {
  if (!up) skip();
  const paymentId = await seedPaidBooking();
  await withClient(async (client) => {
    const refundId = await asManager(client, async () => (await client.query("select refund_id from public.record_refund($1, 10000, 'Guest requested a partial return')", [paymentId])).rows[0].refund_id as string);
    await client.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.email', $2, false)", [RECEPTION_ID, RECEPTION_EMAIL]);
    await expect(client.query("select * from public.confirm_refund_return($1, 'RECEIPT-1', 'Returned in cash')", [refundId])).rejects.toThrow();
    await asManager(client, async () => {
      await expect(client.query("select * from public.confirm_refund_return($1, '', 'Returned in cash')", [refundId])).rejects.toThrow();
      await client.query("select * from public.confirm_refund_return($1, 'RECEIPT-1', 'Returned in cash')", [refundId]);
      const before = (await client.query('select is_pending, settled_at, provider_reference, amount_fils from public.refunds where id=$1', [refundId])).rows[0];
      expect(before).toMatchObject({ is_pending: false, provider_reference: 'RECEIPT-1', amount_fils: 10000 });
      expect(before.settled_at).toBeInstanceOf(Date);
      await client.query("select * from public.confirm_refund_return($1, 'RECEIPT-2', 'Repeated confirmation')", [refundId]);
      expect((await client.query('select is_pending, settled_at, provider_reference, amount_fils from public.refunds where id=$1', [refundId])).rows[0]).toEqual(before);
      expect(Number((await client.query("select count(*) as n from audit.entries where entity_id=$1 and action='confirm_refund_return'", [refundId])).rows[0].n)).toBe(1);
    });
  });
});
