import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, expect, it } from "vitest";
import {
  claimDatabase,
  harnessIsUp,
  releaseDatabase,
  withClient,
} from "./support/harness";
import {
  CHECKOUT_TAX_FILS,
  CHECKOUT_TOTAL_FILS,
  bookingState,
  checkoutBreakdown,
  checkoutConsent,
  checkoutFixture,
  detectedAlerts,
  refuses,
  settleEvent,
} from "./support/checkout";

const RECEIPT_VALID_DAYS = 90;

let up = false;
beforeAll(async () => {
  up = await harnessIsUp();
  if (up) await claimDatabase();
});
afterAll(async () => {
  if (up) await releaseDatabase();
});

it("[§8; CLIENT booking offers] payment replay creates one booking, exact VAT receipt and no duplicate refunds", async (ctx) => {
  if (!up) return ctx.skip();
  await withClient(async (db) => {
    await db.query("begin");
    try {
      const f = await checkoutFixture(db);
      expect(f.prepared.amountFils).toBe(CHECKOUT_TOTAL_FILS);
      expect((await f.prepare()).rows[0].result.paymentId).toBe(f.paymentId);
      await refuses(db, () => f.settle("success", 1), "WP065");
      await refuses(db, () => f.settle("success", CHECKOUT_TOTAL_FILS, "USD"), "WP065");
      const settled = (await f.settle()).rows[0].result;
      expect(settled).toMatchObject({ status: "confirmed", duplicate: false });
      expect((await f.settle()).rows[0].result).toEqual({ ...settled, duplicate: true });
      expect(
        (
          await db.query(
            "select count(*)::integer as n from public.bookings b join public.customers c on c.id=b.customer_id where c.email=$1",
            [f.progress.identity.email],
          )
        ).rows[0].n,
      ).toBe(1);
      const receipt = (
        await db.query("select public.guest_receipt($1,$2) as receipt", [
          settled.receiptToken,
          RECEIPT_VALID_DAYS,
        ])
      ).rows[0].receipt;
      expect(receipt.snapshot.breakdown).toMatchObject({
        totalFils: CHECKOUT_TOTAL_FILS,
        taxFils: CHECKOUT_TAX_FILS,
        taxIsIncluded: true,
      });
      expect(receipt.simulated).toBe(true);
      expect(receipt.checkoutResult).toBe("confirmed");
      const opaque = (
        await db.query("select internal.opaque_reference('SIM-',$1) as reference", [f.paymentId])
      ).rows[0].reference;
      expect(receipt.paymentReference).toBe(opaque);
      expect(receipt.paymentReference).toMatch(/^SIM-[A-Z]{32}$/);
      await db.query("update public.bookings set total_fils=99000 where id=$1", [f.bookingId]);
      const actor = randomUUID();
      await db.query(
        "insert into public.staff(id,email,full_name,role) values($1,$2,'Refund Reception','reception')",
        [actor, `${actor}@example.test`],
      );
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
      const key = randomUUID();
      const refund = () =>
        db.query(
          "select public.request_payment_refund($1,10000,'Guest requested partial refund',$2) as id",
          [f.paymentId, key],
        );
      const first = await refund();
      expect((await refund()).rows).toEqual(first.rows);
      await refuses(
        db,
        () =>
          db.query("select public.request_payment_refund($1,56001,'Too much',$2)", [
            f.paymentId,
            randomUUID(),
          ]),
        "WP066",
      );
      await db.query("select public.request_payment_refund($1,56000,'Remaining refund',$2)", [
        f.paymentId,
        randomUUID(),
      ]);
      expect(
        (await db.query("select status from public.payments where id=$1", [f.paymentId])).rows[0]
          .status,
      ).toBe("fully_refunded");
      expect(
        (
          await db.query("select count(*)::integer as n from public.refunds where payment_id=$1", [
            f.paymentId,
          ])
        ).rows[0].n,
      ).toBe(2);
      expect(
        (
          await db.query(
            "select sum(tax_fils)::integer as vat from public.refunds where payment_id=$1",
            [f.paymentId],
          )
        ).rows[0].vat,
      ).toBe(CHECKOUT_TAX_FILS);
    } finally {
      await db.query("rollback");
    }
  });
});

it("[§8, §16.1] a reviewed guest change keeps the booking and earlier payment evidence", async (ctx) => {
  if (!up) return ctx.skip();
  await withClient(async (db) => {
    await db.query("begin");
    try {
      const f = await checkoutFixture(db);
      const accepted = (
        await db.query(
          "select id,accepted_at from public.acceptance_records where booking_id=$1 order by id",
          [f.bookingId],
        )
      ).rows;
      await f.settle("failed");
      const progress = {
        ...f.progress,
        selection: { ...f.progress.selection, adults: 3 },
      };
      await db.query("select public.save_checkout_progress($1,$2,$3,30)", [
        f.token,
        progress,
        JSON.stringify(checkoutConsent()),
      ]);
      const retried = (
        await db.query(
          "select public.prepare_guest_payment($1,$2,$3,$4,'AED',true) as result",
          [f.token, randomUUID(), { ...f.quote, progress, breakdown: checkoutBreakdown(3) }, f.revision],
        )
      ).rows[0].result;
      expect(retried.amountFils).toBe(99000);
      expect(
        (await db.query("select booking_id from public.payments where id=$1", [retried.paymentId]))
          .rows[0].booking_id,
      ).toBe(f.bookingId);
      expect(
        (
          await db.query("select amount_fils,status from public.payments where id=$1", [
            f.paymentId,
          ])
        ).rows[0],
      ).toEqual({ amount_fils: CHECKOUT_TOTAL_FILS, status: "failed" });
      expect(
        (
          await db.query(
            "select count(*)::integer as n from public.booking_guests where booking_id=$1",
            [f.bookingId],
          )
        ).rows[0].n,
      ).toBe(3);
      expect(
        (
          await db.query(
            "select id,accepted_at from public.acceptance_records where booking_id=$1 order by id",
            [f.bookingId],
          )
        ).rows,
      ).toEqual(accepted);
      expect(
        (await settleEvent(db, retried.paymentId, "success", 99000)).rows[0].result.status,
      ).toBe("confirmed");
    } finally {
      await db.query("rollback");
    }
  });
});

it("[§8.2] an expired hold is recovered on the same suite before another suite", async (ctx) => {
  if (!up) return ctx.skip();
  await withClient(async (db) => {
    await db.query("begin");
    try {
      const f = await checkoutFixture(db);
      await db.query(
        "update public.suite_occupancy set expires_at=now()-interval '1 second' where id=$1",
        [f.hold],
      );
      const result = (await f.settle()).rows[0].result;
      expect(result.status).toBe("confirmed");
      expect(
        (await db.query("select suite_id from public.bookings where reference=$1", [result.reference]))
          .rows[0].suite_id,
      ).toBe(f.suite);
    } finally {
      await db.query("rollback");
    }
  });
});

it("[§8.2; INV-11] unavailable late payment is refunded instead of confirming an unallocated visit", async (ctx) => {
  if (!up) return ctx.skip();
  await withClient(async (db) => {
    await db.query("begin");
    try {
      const f = await checkoutFixture(db);
      await db.query(
        "update public.suite_occupancy set expires_at=now()-interval '1 second' where id=$1",
        [f.hold],
      );
      await db.query("update public.suites set is_active=false");
      const result = (await f.settle()).rows[0].result;
      expect(result).toMatchObject({ status: "refunded", duplicate: false });
      expect(await bookingState(db, f.bookingId)).toEqual({
        status: "awaiting_recovery",
        suite_id: null,
        occupancy_id: null,
      });
      const receipt = (
        await db.query("select public.guest_receipt($1,$2) as receipt", [
          result.receiptToken,
          RECEIPT_VALID_DAYS,
        ])
      ).rows[0].receipt;
      expect(receipt.paymentStatus).toBe("paid");
      expect(receipt.refunds).toHaveLength(1);
      expect(receipt.refunds[0]).toMatchObject({
        amountFils: CHECKOUT_TOTAL_FILS,
        taxFils: CHECKOUT_TAX_FILS,
        pending: true,
        settledAt: null,
      });
      expect(await detectedAlerts(db, [f.bookingId, receipt.refunds[0].id])).toEqual([
        `payment_without_suite:${f.bookingId}`,
        `refund_pending:${receipt.refunds[0].id}`,
      ]);
    } finally {
      await db.query("rollback");
    }
  });
});

it("[§8] declined payment preserves the original hold and has no receipt", async (ctx) => {
  if (!up) return ctx.skip();
  await withClient(async (db) => {
    await db.query("begin");
    try {
      const f = await checkoutFixture(db);
      const before = (
        await db.query("select expires_at from public.suite_occupancy where id=$1", [f.hold])
      ).rows[0];
      expect((await f.settle("failed")).rows[0].result).toMatchObject({
        status: "failed",
        duplicate: false,
        receiptToken: null,
      });
      expect(
        (
          await db.query(
            "select expires_at from public.suite_occupancy where id=$1 and is_active",
            [f.hold],
          )
        ).rows[0],
      ).toEqual(before);
    } finally {
      await db.query("rollback");
    }
  });
});

it("[§8; CLIENT coupons] a final-use coupon is reserved before payment", async (ctx) => {
  if (!up) return ctx.skip();
  await withClient(async (db) => {
    await db.query("begin");
    try {
      const code = `QA-${randomUUID().slice(0, 8).toUpperCase()}`;
      await db.query(
        "insert into public.promo_codes(code,kind,percent,max_uses) values($1,'percent',10,1)",
        [code],
      );
      const f = await checkoutFixture(db, code);
      await refuses(db, () => checkoutFixture(db, code), "WP064");
      expect((await f.settle()).rows[0].result.status).toBe("confirmed");
      expect(
        (await db.query("select used_count from public.promo_codes where code=$1", [code])).rows[0]
          .used_count,
      ).toBe(1);
    } finally {
      await db.query("rollback");
    }
  });
});

it("[§8; INV-01] anonymous clients cannot settle payments or read private checkout records", async (ctx) => {
  if (!up) return ctx.skip();
  await withClient(async (db) => {
    await db.query("begin");
    try {
      const f = await checkoutFixture(db);
      await db.query("set local role anon");
      await refuses(db, () => f.settle(), "42501");
      await refuses(
        db,
        () => db.query("select public.load_checkout_progress($1)", [f.token]),
        "42501",
      );
      await refuses(db, () => db.query("select * from internal.checkout_sessions"), "42501");
      await db.query("reset role");
      expect(
        (
          await db.query("select status::text as status from public.payments where id=$1", [
            f.paymentId,
          ])
        ).rows[0].status,
      ).toBe("pending");
    } finally {
      await db.query("rollback");
    }
  });
});

it("[§8, §16.1] a declined payment retries on one booking without extending the hold", async (ctx) => {
  if (!up) return ctx.skip();
  await withClient(async (db) => {
    await db.query("begin");
    try {
      const f = await checkoutFixture(db);
      const expires = (
        await db.query("select expires_at from public.suite_occupancy where id=$1", [f.hold])
      ).rows[0].expires_at;
      await f.settle("failed");
      const retried = (await f.retry()).rows[0].result;
      expect(retried.paymentId).not.toBe(f.paymentId);
      expect(
        (await db.query("select booking_id from public.payments where id=$1", [retried.paymentId]))
          .rows[0].booking_id,
      ).toBe(f.bookingId);
      expect(
        (
          await db.query("select count(*)::integer as n from public.payments where booking_id=$1", [
            f.bookingId,
          ])
        ).rows[0].n,
      ).toBe(2);
      expect(
        (await db.query("select expires_at from public.suite_occupancy where id=$1", [f.hold]))
          .rows[0].expires_at,
      ).toEqual(expires);
    } finally {
      await db.query("rollback");
    }
  });
});
