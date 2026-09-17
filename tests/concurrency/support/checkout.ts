import { randomUUID } from "node:crypto";
import type { Client, QueryResult } from "pg";
import { expect } from "vitest";

import { TERMS_ACCEPTANCE } from "@/lib/config/consent";
import { LAUNCH_PRICE_TIERS } from "@/lib/config/pricing";
import { priceBooking } from "@/lib/domain/pricing";

export type SettlementOutcome = "success" | "failed" | "cancelled";

export const CHECKOUT_TOTAL_FILS = 66000;
export const CHECKOUT_TAX_FILS = 3143;
export const CHECKOUT_STARTS_AT = "2040-04-01T06:00:00.000Z";

const HOLD_EXPERIENCE = "[2040-04-01 06:00Z,2040-04-01 08:00Z)";
const HOLD_BLOCKED = "[2040-04-01 06:00Z,2040-04-01 08:20Z)";
const HOLD_BUFFER_MINUTES = 20;
const ABANDONED_MINUTES = 30;

export function checkoutConsent() {
  return TERMS_ACCEPTANCE.documents.map((document_slug) => ({
    document_slug,
    document_version: TERMS_ACCEPTANCE.version,
    checkbox_text: TERMS_ACCEPTANCE.text,
  }));
}

export function checkoutBreakdown(adults: number) {
  return priceBooking({
    context: {
      isoDate: "2040-04-01",
      weekday: 0,
      startMinutes: 600,
      durationHours: 2,
    },
    tiers: LAUNCH_PRICE_TIERS,
    guests: { adults, childAges: [] },
    addons: [],
    promotion: null,
    serviceFee: null,
    tax: { percent: 5, inclusive: true, label: "VAT" },
    roundingFils: 50,
    manualTotalFils: null,
  });
}

export function settleEvent(
  db: Client,
  paymentId: string,
  outcome: SettlementOutcome = "success",
  amount = CHECKOUT_TOTAL_FILS,
  currency = "AED",
): Promise<QueryResult> {
  return db.query(
    "select public.settle_payment_event('simulation',$1,$2,$3,$4,$5,true,'{}'::jsonb) as result",
    [`SIM-${paymentId}-${outcome}`, paymentId, outcome, amount, currency],
  );
}

export async function checkoutFixture(db: Client, code = "") {
  const token = randomUUID(),
    suite = randomUUID(),
    hold = randomUUID();
  const progress = {
    identity: {
      salutation: "mr",
      firstName: "Checkout",
      lastName: "Guest",
      email: `${token}@example.test`,
      dateOfBirth: "1990-01-01",
      phoneE164: "+971500000001",
      phoneCountry: "AE",
    },
    selection: {
      startsAt: CHECKOUT_STARTS_AT,
      durationHours: 2,
      adults: 2,
      childAges: [],
      addonQuantities: {},
      voucherCode: code,
      personalRequest: "",
      paymentOption: "card",
    },
    acceptedTerms: true,
    lastCompletedStep: "confirm",
  };
  await db.query(
    "insert into public.suites(id,suite_number,status,priority) values($1,(select coalesce(max(suite_number),0)+1 from public.suites),'available',999)",
    [suite],
  );
  await db.query(
    "insert into public.suite_occupancy(id,suite_id,kind,experience_period,blocked_period,cleaning_buffer_minutes,expires_at) values($1,$2,'hold',$3,$4,$5,now()+interval '10 minutes')",
    [hold, suite, HOLD_EXPERIENCE, HOLD_BLOCKED, HOLD_BUFFER_MINUTES],
  );
  await db.query(
    "insert into internal.guest_checkout_holds(token,occupancy_id) values($1,$2)",
    [token, hold],
  );
  await db.query("select public.save_checkout_progress($1,$2,$3,$4)", [
    token,
    progress,
    JSON.stringify(checkoutConsent()),
    ABANDONED_MINUTES,
  ]);
  const quote = {
    breakdown: checkoutBreakdown(2),
    cart: [],
    taxLabel: "VAT",
    offerLabel: "Special offer",
    progress,
  };
  const revision: string = (
    await db.query("select public.checkout_revision() as revision")
  ).rows[0].revision;
  const requestId = randomUUID();
  const prepare = () =>
    db.query(
      "select public.prepare_guest_payment($1,$2,$3,$4,'AED',true) as result",
      [token, requestId, quote, revision],
    );
  const prepared = (await prepare()).rows[0].result;
  const paymentId: string = prepared.paymentId;
  const bookingId: string = (
    await db.query("select booking_id from public.payments where id=$1", [paymentId])
  ).rows[0].booking_id;
  const retry = () =>
    db.query(
      "select public.prepare_guest_payment($1,$2,$3,$4,'AED',true) as result",
      [token, randomUUID(), quote, revision],
    );
  const settle = (
    outcome: SettlementOutcome = "success",
    amount = CHECKOUT_TOTAL_FILS,
    currency = "AED",
  ) => settleEvent(db, paymentId, outcome, amount, currency);
  return {
    token,
    suite,
    hold,
    quote,
    revision,
    progress,
    prepared,
    paymentId,
    bookingId,
    prepare,
    retry,
    settle,
  };
}

export type CheckoutFixture = Awaited<ReturnType<typeof checkoutFixture>>;

export async function refuses(db: Client, run: () => Promise<unknown>, code: string) {
  await db.query("savepoint refusal");
  await expect(run()).rejects.toMatchObject({ code });
  await db.query("rollback to savepoint refusal");
}

export async function addStaff(
  db: Client,
  id: string,
  role: "reception" | "management",
  permissions: readonly string[] = [],
) {
  await db.query(
    "insert into public.staff(id,email,full_name,role) values($1,$2,$3,$4) on conflict (id) do update set role=excluded.role, is_active=true",
    [id, `${id}@example.test`, `Harness ${role}`, role],
  );
  for (const permission of permissions) {
    await db.query(
      "insert into public.staff_permissions(staff_id,permission,reason) values($1,$2::public.named_permission,'Concurrency harness grant') on conflict do nothing",
      [id, permission],
    );
  }
}

export async function actAs(db: Client, staffId: string) {
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [staffId]);
}

export async function detectedAlerts(db: Client, entityIds: readonly string[]) {
  const { rows } = await db.query(
    "select kind::text as kind, entity_id from internal.detect_operational_alerts(now()) where entity_id = any($1::text[]) order by kind, entity_id",
    [entityIds],
  );
  return rows.map((row) => `${row.kind}:${row.entity_id}`);
}

export async function bookingState(db: Client, bookingId: string) {
  const { rows } = await db.query(
    "select status::text as status, suite_id, occupancy_id from public.bookings where id=$1",
    [bookingId],
  );
  return rows[0];
}

export async function paymentState(db: Client, paymentId: string) {
  const { rows } = await db.query(
    "select status::text as status, tax_fils, provider_reference from public.payments where id=$1",
    [paymentId],
  );
  return rows[0];
}

export async function refundsOf(db: Client, paymentId: string) {
  const { rows } = await db.query(
    "select id, amount_fils, tax_fils, is_pending, settled_at, withdrawn_at from public.refunds where payment_id=$1 order by requested_at, id",
    [paymentId],
  );
  return rows;
}

export async function activeClaimsOf(db: Client, bookingId: string, hold: string) {
  const { rows } = await db.query(
    "select id, suite_id, kind::text as kind from public.suite_occupancy where is_active and (booking_id=$1 or id=$2) order by id",
    [bookingId, hold],
  );
  return rows;
}

export async function deskBooking(
  db: Client,
  totals: { readonly totalFils: number; readonly taxFils: number },
) {
  const customer = randomUUID();
  await db.query(
    "insert into public.customers(id,first_name,last_name,email,phone_e164,phone_country,date_of_birth) values($1,'Desk','Guest',$2,'+971500000002','AE',date '1990-01-01')",
    [customer, `${customer}@example.test`],
  );
  const { rows } = await db.query(
    "insert into public.bookings(reference,customer_id,source,status,experience_period,cleaning_buffer_minutes,subtotal_fils,tax_fils,total_fils) values(internal.next_booking_reference(),$1,'walk_in','confirmed','[2040-05-01 06:00Z,2040-05-01 08:00Z)',20,$2,$3,$2) returning id",
    [customer, totals.totalFils, totals.taxFils],
  );
  return rows[0].id as string;
}

export async function recordCash(db: Client, bookingId: string, amountFils: number) {
  const { rows } = await db.query(
    "select payment_id from public.record_booking_payment($1,'cash'::public.payment_method,$2,'','','Paid at the desk')",
    [bookingId, amountFils],
  );
  return rows[0].payment_id as string;
}

export async function requestRefund(
  db: Client,
  paymentId: string,
  amountFils: number,
  reason = "Guest asked for the money back",
) {
  const { rows } = await db.query(
    "select public.request_payment_refund($1,$2,$3,$4) as id",
    [paymentId, amountFils, reason, randomUUID()],
  );
  return rows[0].id as string;
}

export async function discardCheckout(db: Client, fixture: CheckoutFixture, promoCode = "") {
  await db.query("delete from public.promo_code_redemptions where booking_id=$1", [fixture.bookingId]);
  await db.query("delete from public.refunds where booking_id=$1", [fixture.bookingId]);
  await db.query("delete from public.payment_events where booking_id=$1", [fixture.bookingId]);
  await db.query("delete from internal.checkout_attempts where booking_id=$1", [fixture.bookingId]);
  await db.query("update public.bookings set occupancy_id=null, suite_id=null where id=$1", [fixture.bookingId]);
  await db.query("delete from internal.guest_checkout_holds where token=$1", [fixture.token]);
  await db.query("delete from public.suite_occupancy where suite_id=$1 or booking_id=$2", [fixture.suite, fixture.bookingId]);
  await db.query("delete from public.payments where booking_id=$1", [fixture.bookingId]);
  await db.query("delete from public.acceptance_records where booking_id=$1", [fixture.bookingId]);
  const customer = (
    await db.query("select customer_id from public.bookings where id=$1", [fixture.bookingId])
  ).rows[0]?.customer_id;
  await db.query("delete from public.bookings where id=$1", [fixture.bookingId]);
  await db.query("delete from internal.checkout_sessions where token=$1", [fixture.token]);
  if (customer) await db.query("delete from public.customers where id=$1", [customer]);
  await db.query("delete from public.suites where id=$1", [fixture.suite]);
  if (promoCode) await db.query("delete from public.promo_codes where code=$1", [promoCode]);
}
