import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  claimDatabase,
  harnessIsUp,
  releaseDatabase,
  withClient,
} from "./support/harness";
import {
  CHECKOUT_TAX_FILS,
  CHECKOUT_TOTAL_FILS,
  actAs,
  activeClaimsOf,
  addStaff,
  bookingState,
  checkoutFixture,
  deskBooking,
  detectedAlerts,
  discardCheckout,
  paymentState,
  recordCash,
  refundsOf,
  refuses,
  requestRefund,
  settleEvent,
  type CheckoutFixture,
  type SettlementOutcome,
} from "./support/checkout";

const CONNECTION =
  process.env.WELLPLACE_TEST_DB_URL ??
  `postgres://postgres:postgres@127.0.0.1:${process.env.WELLPLACE_TEST_DB_PORT ?? "54329"}/postgres`;

const RECEPTION = "9e2e0011-0000-4000-8000-000000000001";
const MANAGER = "9e2e0011-0000-4000-8000-000000000002";
const PRICE_CHANGER = "9e2e0011-0000-4000-8000-000000000003";
const CARD_SHAPED_PAYMENT_ID = "e7fe6883-4988-4060-9278-705cc0f25ffd";
const RECEIPT_VALID_DAYS = 90;
const UNUSABLE_SUITE_STATUSES = ["blocked", "maintenance", "not_ready", "out_of_service"] as const;
const PARALLEL_DELIVERIES = 20;

let up = false;
beforeAll(async () => {
  up = await harnessIsUp();
  if (up) await claimDatabase();
});
afterAll(async () => {
  if (up) await releaseDatabase();
});

async function rolledBack(run: (db: Client) => Promise<void>) {
  await withClient(async (db) => {
    await db.query("begin");
    try {
      await run(db);
    } finally {
      await db.query("rollback");
    }
  });
}

async function onlySuitesActive(db: Client, suiteIds: readonly string[]) {
  await db.query("update public.suites set is_active = (id = any($1::uuid[]))", [suiteIds]);
}

async function addSpareSuite(db: Client) {
  const spare = randomUUID();
  await db.query(
    "insert into public.suites(id,suite_number,status,priority) values($1,(select coalesce(max(suite_number),0)+1 from public.suites),'available',998)",
    [spare],
  );
  return spare;
}

async function expireHold(db: Client, hold: string) {
  await db.query(
    "update public.suite_occupancy set expires_at=now()-interval '1 second' where id=$1",
    [hold],
  );
}

async function holdRow(db: Client, hold: string) {
  return (
    await db.query(
      "select is_active, status::text as status, kind::text as kind from public.suite_occupancy where id=$1",
      [hold],
    )
  ).rows[0];
}

async function eventCount(db: Client, paymentId: string) {
  return (
    await db.query("select count(*)::integer as n from public.payment_events where payment_id=$1", [
      paymentId,
    ])
  ).rows[0].n as number;
}

describe("§8.2 late and unusable payments — a success never revives a closed booking", () => {
  it("[§8.2; §16.1 a late payment confirmation follows the defined recovery flow; INV-11] a payment for a booking Reception already cancelled leaves it cancelled and goes to one pending full refund", async (ctx) => {
    if (!up) return ctx.skip();
    await rolledBack(async (db) => {
      const f = await checkoutFixture(db);
      await addStaff(db, RECEPTION, "reception");
      await actAs(db, RECEPTION);
      await db.query("select * from public.cancel_booking($1,'Guest phoned to cancel before paying')", [
        f.bookingId,
      ]);
      expect(await activeClaimsOf(db, f.bookingId, f.hold)).toEqual([]);

      const result = (await f.settle()).rows[0].result;

      expect(result).toMatchObject({ status: "refunded", duplicate: false, bookingId: f.bookingId });
      expect((await bookingState(db, f.bookingId)).status).toBe("cancelled");
      expect(await activeClaimsOf(db, f.bookingId, f.hold)).toEqual([]);
      expect((await paymentState(db, f.paymentId)).status).toBe("paid");
      const refunds = await refundsOf(db, f.paymentId);
      expect(refunds).toHaveLength(1);
      expect(refunds[0]).toMatchObject({
        amount_fils: CHECKOUT_TOTAL_FILS,
        tax_fils: CHECKOUT_TAX_FILS,
        is_pending: true,
        settled_at: null,
        withdrawn_at: null,
      });
      expect(await detectedAlerts(db, [f.bookingId, refunds[0].id])).toEqual([
        `refund_pending:${refunds[0].id}`,
      ]);
    });
  });

  it("[§8.2; INV-11] a payment Reception voided before the money arrived is not revived into a confirmed booking — the booking waits for recovery with a pending full refund", async (ctx) => {
    if (!up) return ctx.skip();
    await rolledBack(async (db) => {
      const f = await checkoutFixture(db);
      await addStaff(db, RECEPTION, "reception");
      await actAs(db, RECEPTION);
      await db.query("select * from public.void_booking_payment($1,'Guest will pay at the desk instead')", [
        f.paymentId,
      ]);
      expect((await paymentState(db, f.paymentId)).status).toBe("cancelled");

      const result = (await f.settle()).rows[0].result;

      expect(result).toMatchObject({ status: "refunded", duplicate: false });
      expect(await bookingState(db, f.bookingId)).toEqual({
        status: "awaiting_recovery",
        suite_id: null,
        occupancy_id: null,
      });
      expect(await activeClaimsOf(db, f.bookingId, f.hold)).toEqual([]);
      expect((await paymentState(db, f.paymentId)).status).toBe("paid");
      const refunds = await refundsOf(db, f.paymentId);
      expect(refunds).toHaveLength(1);
      expect(refunds[0]).toMatchObject({ amount_fils: CHECKOUT_TOTAL_FILS, is_pending: true, settled_at: null });
      expect(await detectedAlerts(db, [f.bookingId, refunds[0].id])).toEqual([
        `payment_without_suite:${f.bookingId}`,
        `refund_pending:${refunds[0].id}`,
      ]);
    });
  });

  it.for(UNUSABLE_SUITE_STATUSES)(
    "[§7.2; §16.1 a blocked, maintenance, not-ready or out-of-service suite is never allocated; INV-07] a held suite set to %s before payment is not confirmed — the booking lands on a different free suite",
    async (status, ctx) => {
      if (!up) return ctx.skip();
      await rolledBack(async (db) => {
        const f = await checkoutFixture(db);
        const spare = await addSpareSuite(db);
        await onlySuitesActive(db, [f.suite, spare]);
        await db.query("update public.suites set status=$2::public.suite_status where id=$1", [
          f.suite,
          status,
        ]);

        const result = (await f.settle()).rows[0].result;

        expect(result).toMatchObject({ status: "confirmed", duplicate: false });
        const booking = await bookingState(db, f.bookingId);
        expect(booking.status).toBe("confirmed");
        expect(booking.suite_id).toBe(spare);
        expect(booking.suite_id).not.toBe(f.suite);
        const claims = await activeClaimsOf(db, f.bookingId, f.hold);
        expect(claims).toEqual([{ id: booking.occupancy_id, suite_id: spare, kind: "booking" }]);
        expect(await holdRow(db, f.hold)).toEqual({ is_active: false, status: "released", kind: "hold" });
        expect(await refundsOf(db, f.paymentId)).toEqual([]);
      });
    },
  );

  it("[§7.2, §8.2; INV-07, INV-11] a held suite taken out of service with no other suite free ends in recovery — no allocation, a pending full refund and both alerts", async (ctx) => {
    if (!up) return ctx.skip();
    await rolledBack(async (db) => {
      const f = await checkoutFixture(db);
      await onlySuitesActive(db, [f.suite]);
      await db.query("update public.suites set status='out_of_service' where id=$1", [f.suite]);

      const result = (await f.settle()).rows[0].result;

      expect(result).toMatchObject({ status: "refunded", duplicate: false });
      expect(await bookingState(db, f.bookingId)).toEqual({
        status: "awaiting_recovery",
        suite_id: null,
        occupancy_id: null,
      });
      expect(await activeClaimsOf(db, f.bookingId, f.hold)).toEqual([]);
      expect(await holdRow(db, f.hold)).toEqual({ is_active: false, status: "released", kind: "hold" });
      const refunds = await refundsOf(db, f.paymentId);
      expect(refunds).toHaveLength(1);
      expect(refunds[0]).toMatchObject({
        amount_fils: CHECKOUT_TOTAL_FILS,
        tax_fils: CHECKOUT_TAX_FILS,
        is_pending: true,
        settled_at: null,
      });
      expect(await detectedAlerts(db, [f.bookingId, refunds[0].id])).toEqual([
        `payment_without_suite:${f.bookingId}`,
        `refund_pending:${refunds[0].id}`,
      ]);
    });
  });

  it("[§8.2; §16.1 a late payment confirmation follows the defined recovery flow; INV-11] a late payment with no suite at all waits for recovery, and Management confirming the refund closes the booking and both alerts", async (ctx) => {
    if (!up) return ctx.skip();
    await rolledBack(async (db) => {
      const f = await checkoutFixture(db);
      await expireHold(db, f.hold);
      await db.query("update public.suites set is_active=false");

      const result = (await f.settle()).rows[0].result;

      expect(result).toMatchObject({ status: "refunded", duplicate: false });
      expect(await bookingState(db, f.bookingId)).toEqual({
        status: "awaiting_recovery",
        suite_id: null,
        occupancy_id: null,
      });
      expect((await paymentState(db, f.paymentId)).status).toBe("paid");
      const [refund] = await refundsOf(db, f.paymentId);
      expect(refund).toMatchObject({ amount_fils: CHECKOUT_TOTAL_FILS, is_pending: true, settled_at: null });
      expect(await detectedAlerts(db, [f.bookingId, refund.id])).toEqual([
        `payment_without_suite:${f.bookingId}`,
        `refund_pending:${refund.id}`,
      ]);

      await addStaff(db, MANAGER, "management");
      await actAs(db, MANAGER);
      await db.query("select * from public.confirm_refund_return($1,'CARD-RETURN-A','Returned to the guest card')", [
        refund.id,
      ]);

      expect((await paymentState(db, f.paymentId)).status).toBe("fully_refunded");
      expect(await bookingState(db, f.bookingId)).toEqual({
        status: "cancelled",
        suite_id: null,
        occupancy_id: null,
      });
      const [settled] = await refundsOf(db, f.paymentId);
      expect(settled.is_pending).toBe(false);
      expect(settled.settled_at).toBeInstanceOf(Date);
      expect(await detectedAlerts(db, [f.bookingId, refund.id])).toEqual([]);
      expect(
        (
          await db.query(
            "select count(*)::integer as n from audit.entries where action='close_recovered_booking' and entity_id=$1",
            [f.bookingId],
          )
        ).rows[0].n,
      ).toBe(1);
    });
  });
});

describe("§8 repeated and out-of-order provider events — INV-09", () => {
  it("[§8; §16.1 a repeated payment webhook causes no duplicate booking, message or payment; INV-09] the same event delivered twice is reported as a duplicate and records one event, one booking and one coupon redemption", async (ctx) => {
    if (!up) return ctx.skip();
    await rolledBack(async (db) => {
      const code = `QA-${randomUUID().slice(0, 8).toUpperCase()}`;
      await db.query("insert into public.promo_codes(code,kind,percent,max_uses) values($1,'percent',10,5)", [code]);
      const f = await checkoutFixture(db, code);

      const first = (await f.settle()).rows[0].result;
      const second = (await f.settle()).rows[0].result;

      expect(first).toMatchObject({ status: "confirmed", duplicate: false });
      expect(second).toEqual({ ...first, duplicate: true });
      expect(await eventCount(db, f.paymentId)).toBe(1);
      expect(
        (
          await db.query(
            "select count(*)::integer as n from public.bookings b join public.customers c on c.id=b.customer_id where c.email=$1 and b.status='confirmed'",
            [f.progress.identity.email],
          )
        ).rows[0].n,
      ).toBe(1);
      expect(await activeClaimsOf(db, f.bookingId, f.hold)).toHaveLength(1);
      expect(
        (
          await db.query("select count(*)::integer as n from public.payments where booking_id=$1", [
            f.bookingId,
          ])
        ).rows[0].n,
      ).toBe(1);
      expect(
        (
          await db.query(
            "select count(*)::integer as n from public.promo_code_redemptions where booking_id=$1",
            [f.bookingId],
          )
        ).rows[0].n,
      ).toBe(1);
      expect(
        (await db.query("select used_count from public.promo_codes where code=$1", [code])).rows[0]
          .used_count,
      ).toBe(1);
      expect(await refundsOf(db, f.paymentId)).toEqual([]);
    });
  });

  it("[§8; INV-09] out of order — a decline delivered after the success changes nothing", async (ctx) => {
    if (!up) return ctx.skip();
    await rolledBack(async (db) => {
      const f = await checkoutFixture(db);
      const confirmed = (await f.settle("success")).rows[0].result;
      const before = {
        booking: await bookingState(db, f.bookingId),
        payment: await paymentState(db, f.paymentId),
        claims: await activeClaimsOf(db, f.bookingId, f.hold),
      };

      const late = (await f.settle("failed")).rows[0].result;

      expect(late).toEqual({ ...confirmed, duplicate: true });
      expect({
        booking: await bookingState(db, f.bookingId),
        payment: await paymentState(db, f.paymentId),
        claims: await activeClaimsOf(db, f.bookingId, f.hold),
      }).toEqual(before);
      expect(before.booking.status).toBe("confirmed");
      expect(before.payment.status).toBe("paid");
      expect(await refundsOf(db, f.paymentId)).toEqual([]);
    });
  });

  it("[§8.2; INV-09] replayed after the hold expired — a recovered late payment is allocated once and refunded never, and a refunded one is refunded once", async (ctx) => {
    if (!up) return ctx.skip();
    await rolledBack(async (db) => {
      const recovered = await checkoutFixture(db);
      await expireHold(db, recovered.hold);
      const first = (await recovered.settle()).rows[0].result;
      expect(first.status).toBe("confirmed");
      expect((await recovered.settle()).rows[0].result).toEqual({ ...first, duplicate: true });
      expect(
        (
          await db.query(
            "select count(*)::integer as n from public.suite_occupancy where is_active and booking_id=$1",
            [recovered.bookingId],
          )
        ).rows[0].n,
      ).toBe(1);
      expect(await eventCount(db, recovered.paymentId)).toBe(1);

      const stranded = await checkoutFixture(db);
      await expireHold(db, stranded.hold);
      await onlySuitesActive(db, []);
      const refunded = (await stranded.settle()).rows[0].result;
      expect(refunded.status).toBe("refunded");
      expect((await stranded.settle()).rows[0].result).toEqual({ ...refunded, duplicate: true });
      expect(await refundsOf(db, stranded.paymentId)).toHaveLength(1);
      expect(await eventCount(db, stranded.paymentId)).toBe(1);
      expect((await bookingState(db, stranded.bookingId)).status).toBe("awaiting_recovery");
    });
  });

  it("[§8; §16.1 a failed payment can be retried until the hold expires; INV-10] a success that follows a decline on the same payment is processed as a success while the hold lives", async (ctx) => {
    if (!up) return ctx.skip();
    await rolledBack(async (db) => {
      const f = await checkoutFixture(db);
      expect((await f.settle("failed")).rows[0].result).toMatchObject({ status: "failed", duplicate: false });
      expect((await bookingState(db, f.bookingId)).status).toBe("payment_failed");

      const result = (await f.settle("success")).rows[0].result;

      expect(result).toMatchObject({ status: "confirmed", duplicate: false });
      expect(await bookingState(db, f.bookingId)).toEqual({
        status: "confirmed",
        suite_id: f.suite,
        occupancy_id: f.hold,
      });
      expect(await paymentState(db, f.paymentId)).toMatchObject({ status: "paid", tax_fils: CHECKOUT_TAX_FILS });
      expect(await holdRow(db, f.hold)).toEqual({ is_active: true, status: "active", kind: "booking" });
      expect(await detectedAlerts(db, [f.bookingId])).toEqual([]);
    });
  });

  it("[§8; INV-09, INV-11] a guest who pays twice for one booking keeps one suite and the second payment goes to a pending refund carrying no VAT", async (ctx) => {
    if (!up) return ctx.skip();
    await rolledBack(async (db) => {
      const f = await checkoutFixture(db);
      await f.settle("failed");
      const retried = (await f.retry()).rows[0].result;
      expect((await settleEvent(db, retried.paymentId, "success")).rows[0].result.status).toBe("confirmed");

      const late = (await f.settle("success")).rows[0].result;

      expect(late).toMatchObject({ status: "refunded", duplicate: false });
      expect(await bookingState(db, f.bookingId)).toEqual({
        status: "confirmed",
        suite_id: f.suite,
        occupancy_id: f.hold,
      });
      expect(await activeClaimsOf(db, f.bookingId, f.hold)).toHaveLength(1);
      expect(await paymentState(db, retried.paymentId)).toMatchObject({ status: "paid", tax_fils: CHECKOUT_TAX_FILS });
      expect(await paymentState(db, f.paymentId)).toMatchObject({ status: "paid", tax_fils: 0 });
      const refunds = await refundsOf(db, f.paymentId);
      expect(refunds).toHaveLength(1);
      expect(refunds[0]).toMatchObject({ amount_fils: CHECKOUT_TOTAL_FILS, tax_fils: 0, is_pending: true });
      expect(await refundsOf(db, retried.paymentId)).toEqual([]);
      expect(await detectedAlerts(db, [f.bookingId, refunds[0].id])).toEqual([
        `refund_pending:${refunds[0].id}`,
      ]);
    });
  });

  it("[§13 no card data; OUR CHOICE] a payment whose id reads like a card number still settles — the provider reference is letters only", async (ctx) => {
    if (!up) return ctx.skip();
    await rolledBack(async (db) => {
      const f = await checkoutFixture(db);
      await db.query(
        "insert into public.payments(id,booking_id,status,method,amount_fils,service_fee_fils,is_simulated,note) select $2,booking_id,status,method,amount_fils,service_fee_fils,is_simulated,note from public.payments where id=$1",
        [f.paymentId, CARD_SHAPED_PAYMENT_ID],
      );
      await db.query("update internal.checkout_attempts set payment_id=$2 where payment_id=$1", [
        f.paymentId,
        CARD_SHAPED_PAYMENT_ID,
      ]);
      await db.query("delete from public.payments where id=$1", [f.paymentId]);
      expect(
        (
          await db.query(
            "select ('SIM-' || $1::text) ~ '[0-9]{4}[ -][0-9]{4}[ -][0-9]{4}[ -][0-9]{2,4}' as card_shaped",
            [CARD_SHAPED_PAYMENT_ID],
          )
        ).rows[0].card_shaped,
      ).toBe(true);

      const result = (await settleEvent(db, CARD_SHAPED_PAYMENT_ID, "success")).rows[0].result;

      expect(result).toMatchObject({ status: "confirmed", paymentId: CARD_SHAPED_PAYMENT_ID });
      const reference: string = (await paymentState(db, CARD_SHAPED_PAYMENT_ID)).provider_reference;
      expect(reference).toBe("SIM-EPFENQQKLRQQLGNGRJPQPGMCCGFJMFFD");
      expect(reference).not.toMatch(/[0-9]/);
    });
  });

  it("[§8; §16.1 a failed payment can be retried until the hold expires; INV-10] a declined guest can retry after an unrelated setting changes, the price fingerprint does not move, and the paid retry raises no payment_failed alert", async (ctx) => {
    if (!up) return ctx.skip();
    await rolledBack(async (db) => {
      const f = await checkoutFixture(db);
      const revision = async () =>
        (await db.query("select public.checkout_revision() as revision")).rows[0].revision as string;
      await f.settle("failed");
      await db.query("update public.settings set value='25'::jsonb where key='cleaning.buffer_minutes'");
      await db.query("update public.settings set value='\"+971500009999\"'::jsonb where key='contact.whatsapp_e164'");
      expect(await revision()).toBe(f.revision);

      const retried = (await f.retry()).rows[0].result;

      expect(retried.paymentId).not.toBe(f.paymentId);
      expect(
        (await db.query("select cleaning_buffer_minutes from public.bookings where id=$1", [f.bookingId]))
          .rows[0].cleaning_buffer_minutes,
      ).toBe(20);
      expect((await settleEvent(db, retried.paymentId, "success")).rows[0].result.status).toBe("confirmed");
      expect(await detectedAlerts(db, [f.bookingId])).toEqual([]);

      await db.query("savepoint price_change");
      await db.query("update public.settings set value='6'::jsonb where key='tax.vat_percent'");
      expect(await revision()).not.toBe(f.revision);
      await db.query("rollback to savepoint price_change");
    });
  });
});

describe("§8, §11.2 refunds — withdrawal, frozen VAT and the confidential ledger", () => {
  it("[§8, §11.2; OUR CHOICE] a withdrawn refund request frees its amount, stops alerting and stays on record", async (ctx) => {
    if (!up) return ctx.skip();
    await rolledBack(async (db) => {
      await addStaff(db, RECEPTION, "reception");
      await addStaff(db, MANAGER, "management");
      await actAs(db, RECEPTION);
      const booking = await deskBooking(db, { totalFils: CHECKOUT_TOTAL_FILS, taxFils: CHECKOUT_TAX_FILS });
      const payment = await recordCash(db, booking, CHECKOUT_TOTAL_FILS);
      const mistaken = await requestRefund(db, payment, CHECKOUT_TOTAL_FILS);
      expect((await refundsOf(db, payment))[0]).toMatchObject({ is_pending: true, settled_at: null });
      expect(await detectedAlerts(db, [mistaken])).toEqual([`refund_pending:${mistaken}`]);
      await refuses(db, () => requestRefund(db, payment, 1), "WP066");

      const withdrawn = (
        await db.query("select * from public.withdraw_refund_request($1,'Guest re-accommodated instead')", [
          mistaken,
        ])
      ).rows[0];

      expect(withdrawn).toEqual({ refund_id: mistaken, payment_id: payment, booking_id: booking });
      const [kept] = await refundsOf(db, payment);
      expect(kept).toMatchObject({ id: mistaken, is_pending: false, settled_at: null });
      expect(kept.withdrawn_at).toBeInstanceOf(Date);
      expect(await detectedAlerts(db, [mistaken])).toEqual([]);
      await refuses(
        db,
        () => db.query("select * from public.withdraw_refund_request($1,'Again')", [mistaken]),
        "WP066",
      );

      const replacement = await requestRefund(db, payment, CHECKOUT_TOTAL_FILS);

      const refunds = new Map((await refundsOf(db, payment)).map((row) => [row.id, row]));
      expect([...refunds.keys()].sort()).toEqual([mistaken, replacement].sort());
      expect(refunds.get(mistaken)).toMatchObject({ is_pending: false, settled_at: null });
      expect(refunds.get(replacement)).toMatchObject({
        amount_fils: CHECKOUT_TOTAL_FILS,
        tax_fils: CHECKOUT_TAX_FILS,
        is_pending: true,
        withdrawn_at: null,
      });
      expect((await paymentState(db, payment)).status).toBe("paid");
      expect(
        (await db.query("select count(*)::integer as n from public.booking_refunds($1)", [booking])).rows[0].n,
      ).toBe(2);

      await actAs(db, MANAGER);
      await db.query("savepoint confirm_withdrawn");
      await expect(
        db.query("select * from public.confirm_refund_return($1,'CARD-RETURN-B','Returned')", [mistaken]),
      ).rejects.toHaveProperty("code");
      await db.query("rollback to savepoint confirm_withdrawn");
      expect((await refundsOf(db, payment)).find((row) => row.id === mistaken)).toMatchObject({
        is_pending: false,
        settled_at: null,
      });
      expect((await paymentState(db, payment)).status).toBe("paid");
    });
  });

  it("[CLIENT pricing specification: 5% VAT included; INV-21] a full refund after a manual reprice credits exactly the VAT the payment carried", async (ctx) => {
    if (!up) return ctx.skip();
    await rolledBack(async (db) => {
      await addStaff(db, RECEPTION, "reception");
      await addStaff(db, PRICE_CHANGER, "management");
      await actAs(db, RECEPTION);
      const booking = await deskBooking(db, { totalFils: CHECKOUT_TOTAL_FILS, taxFils: CHECKOUT_TAX_FILS });
      const payment = await recordCash(db, booking, CHECKOUT_TOTAL_FILS);
      expect((await paymentState(db, payment)).tax_fils).toBe(CHECKOUT_TAX_FILS);

      await actAs(db, PRICE_CHANGER);

      await db.query("select * from public.set_manual_booking_price($1,50000,'Goodwill after a late start')", [booking]);
      const rate = Number((await db.query("select (value #>> '{}')::numeric as rate from public.settings where key='tax.vat_percent'")).rows[0].rate);
      expect(
        (await db.query("select total_fils, tax_fils from public.bookings where id=$1", [booking])).rows[0],
      ).toEqual({ total_fils: 50000, tax_fils: 50000 - Math.round(50000 / (1 + rate / 100)) });

      await requestRefund(db, payment, CHECKOUT_TOTAL_FILS);

      expect((await paymentState(db, payment)).tax_fils).toBe(CHECKOUT_TAX_FILS);
      const refunds = await refundsOf(db, payment);
      expect(refunds).toHaveLength(1);
      expect(refunds[0]).toMatchObject({ amount_fils: CHECKOUT_TOTAL_FILS, tax_fils: CHECKOUT_TAX_FILS });
    });
  });

  it("[CLIENT pricing specification: 5% VAT included; INV-21] a booking paid in two halves carries its VAT exactly once across both payments and both refunds", async (ctx) => {
    if (!up) return ctx.skip();
    await rolledBack(async (db) => {
      await addStaff(db, RECEPTION, "reception");
      await actAs(db, RECEPTION);
      const half = CHECKOUT_TOTAL_FILS / 2;
      const booking = await deskBooking(db, { totalFils: CHECKOUT_TOTAL_FILS, taxFils: CHECKOUT_TAX_FILS });
      const first = await recordCash(db, booking, half);
      const second = await recordCash(db, booking, half);

      const taxes = [(await paymentState(db, first)).tax_fils, (await paymentState(db, second)).tax_fils];
      expect(taxes[0] + taxes[1]).toBe(CHECKOUT_TAX_FILS);
      expect(Math.abs(taxes[0] - taxes[1])).toBeLessThanOrEqual(1);

      await requestRefund(db, first, half);
      await requestRefund(db, second, half);

      const credited = (
        await db.query("select sum(tax_fils)::integer as vat from public.refunds where booking_id=$1", [booking])
      ).rows[0].vat;
      expect(credited).toBe(CHECKOUT_TAX_FILS);
      expect((await refundsOf(db, first))[0].tax_fils).toBe(taxes[0]);
      expect((await refundsOf(db, second))[0].tax_fils).toBe(taxes[1]);
    });
  });

  it("[§10.6; §16.1 roles prevent unauthorised Management actions; INV-15] Reception without view_confidential_figures reads no refund ledger, yet sees the refunds of the booking in front of it", async (ctx) => {
    if (!up) return ctx.skip();
    await rolledBack(async (db) => {
      const f = await checkoutFixture(db);
      await expireHold(db, f.hold);
      await onlySuitesActive(db, []);
      expect((await f.settle()).rows[0].result.status).toBe("refunded");
      const [refund] = await refundsOf(db, f.paymentId);
      await addStaff(db, RECEPTION, "reception");
      await actAs(db, RECEPTION);

      await db.query("set local role authenticated");
      const ledger = (await db.query("select count(*)::integer as n from public.refunds")).rows[0].n;
      const own = (await db.query("select refund_id, amount_fils, is_pending from public.booking_refunds($1)", [f.bookingId])).rows;
      await db.query("reset role");

      expect(ledger).toBe(0);
      expect(own).toEqual([{ refund_id: refund.id, amount_fils: CHECKOUT_TOTAL_FILS, is_pending: true }]);

      await db.query(
        "insert into public.staff_permissions(staff_id,permission,reason) values($1,'view_confidential_figures','Harness contrast grant')",
        [RECEPTION],
      );
      await db.query("set local role authenticated");
      const granted = (
        await db.query("select count(*)::integer as n from public.refunds where booking_id=$1", [f.bookingId])
      ).rows[0].n;
      await db.query("reset role");
      expect(granted).toBe(0);
    });
  });

  it("[§13; INV-25 opaque, expiring, revocable guest links] a revoked receipt link stops opening, and so does one past its days after the visit", async (ctx) => {
    if (!up) return ctx.skip();
    await rolledBack(async (db) => {
      const f = await checkoutFixture(db);
      const token = (await f.settle()).rows[0].result.receiptToken as string;
      const receipt = async (days: number) =>
        (await db.query("select public.guest_receipt($1,$2) as receipt", [token, days])).rows[0].receipt;
      expect(await receipt(RECEIPT_VALID_DAYS)).not.toBeNull();
      expect(await receipt(0)).toBeNull();

      await db.query(
        "update public.bookings set experience_period=tstzrange(now()-interval '3 days', now()-interval '2 days','[)') where id=$1",
        [f.bookingId],
      );
      expect(await receipt(1)).toBeNull();
      expect(await receipt(3)).not.toBeNull();

      await addStaff(db, RECEPTION, "reception");
      await actAs(db, RECEPTION);
      expect(
        (await db.query("select public.revoke_receipt_link($1,'Forwarded to the wrong person') as n", [f.bookingId]))
          .rows[0].n,
      ).toBe(1);

      expect(await receipt(3)).toBeNull();
      expect(await receipt(RECEIPT_VALID_DAYS)).toBeNull();
      await refuses(
        db,
        () => db.query("select public.revoke_receipt_link($1,'Again')", [f.bookingId]),
        "P0002",
      );
    });
  });
});

describe("§17.4 higher load — simultaneous deliveries of one payment", () => {
  it(`[§8; §16.1 a repeated payment webhook causes no duplicate booking, message or payment; INV-09] ${PARALLEL_DELIVERIES} simultaneous deliveries of one payment's success and decline confirm exactly one booking`, async (ctx) => {
    if (!up) return ctx.skip();
    const code = `QA-${randomUUID().slice(0, 8).toUpperCase()}`;
    await withClient(async (db) => {
      await db.query("insert into public.promo_codes(code,kind,percent,max_uses) values($1,'percent',10,5)", [code]);
      let f: CheckoutFixture | null = null;
      try {
        f = await checkoutFixture(db, code);
        const fixture = f;
        const outcomes: SettlementOutcome[] = Array.from({ length: PARALLEL_DELIVERIES }, (_, index) =>
          index % 2 === 0 ? "success" : "failed",
        );
        const clients = outcomes.map(() => new Client({ connectionString: CONNECTION }));
        await Promise.all(clients.map((client) => client.connect()));
        const results = await Promise.all(
          clients.map(async (client, index) => {
            try {
              return (await settleEvent(client, fixture.paymentId, outcomes[index])).rows[0].result;
            } catch (cause) {
              return { error: cause instanceof Error ? cause.message : String(cause) };
            } finally {
              await client.end().catch(() => {});
            }
          }),
        );

        expect(results.filter((result) => "error" in result)).toEqual([]);
        expect(results.every((result) => typeof result.duplicate === "boolean")).toBe(true);
        expect(results.every((result) => result.status === "confirmed" || result.status === "failed")).toBe(true);
        const processed = results.filter((result) => result.duplicate === false);
        expect(processed.filter((result) => result.status === "confirmed")).toHaveLength(1);
        expect(processed.filter((result) => result.status === "failed").length).toBeLessThanOrEqual(1);
        expect(results.filter((result) => result.duplicate === true).length).toBeGreaterThanOrEqual(
          PARALLEL_DELIVERIES - 2,
        );
        expect(await bookingState(db, fixture.bookingId)).toEqual({
          status: "confirmed",
          suite_id: fixture.suite,
          occupancy_id: fixture.hold,
        });
        expect((await paymentState(db, fixture.paymentId)).status).toBe("paid");
        expect(await eventCount(db, fixture.paymentId)).toBe(2);
        expect(await activeClaimsOf(db, fixture.bookingId, fixture.hold)).toHaveLength(1);
        expect(await refundsOf(db, fixture.paymentId)).toEqual([]);
        expect(
          (
            await db.query(
              "select count(*)::integer as n from public.promo_code_redemptions where booking_id=$1",
              [fixture.bookingId],
            )
          ).rows[0].n,
        ).toBe(1);
      } finally {
        if (f !== null) await discardCheckout(db, f, code);
        else await db.query("delete from public.promo_codes where code=$1", [code]);
      }
    });
  });
});
