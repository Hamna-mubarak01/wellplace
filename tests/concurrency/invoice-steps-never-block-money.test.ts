import { performance } from "node:perf_hooks";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  claimDatabase,
  harnessIsUp,
  releaseDatabase,
  wipeUndocumentedBookings,
  withClient,
} from "./support/harness";
import {
  CHECKOUT_TAX_FILS,
  CHECKOUT_TOTAL_FILS,
  checkoutFixture,
  deskBooking,
  recordCash,
  requestRefund,
  type CheckoutFixture,
} from "./support/checkout";

const CONNECTION =
  process.env.WELLPLACE_TEST_DB_URL ??
  `postgres://postgres:postgres@127.0.0.1:${process.env.WELLPLACE_TEST_DB_PORT ?? "54329"}/postgres`;

const RECEPTION = "d0c50000-0000-4000-8000-000000000001";
const MANAGER = "d0c50000-0000-4000-8000-000000000002";

const DOCUMENT_STAFF = [
  { id: RECEPTION, email: "documents.desk@example.test", fullName: "Documents Desk", role: "reception" },
  { id: MANAGER, email: "documents.finance@example.test", fullName: "Documents Finance", role: "management" },
] as const;

const PARTIAL_REFUND_FILS = 10_000;
const PROBE_REFUND_FILS = 1_000;
const PARALLEL_PAYMENTS = 20;
const DEADLOCK_PROBE_ROUNDS = 20;
const DEADLOCK = "40P01";
const CALLER_LOCK_TIMEOUT = "5s";
const RETURN_MARGIN_MS = 1_000;
const PROOF_TIMEOUT_MS = 60_000;

const BOOKING_ROW_HOLDERS = [
  {
    label: "a booking edit (FOR NO KEY UPDATE) holds the booking row",
    statements: ["select 1 from public.bookings b where b.id = $1 for no key update"],
  },
  {
    label:
      "an invoice writer such as Issue now, Regenerate or Void holds the booking's payments FOR KEY SHARE and then the booking FOR NO KEY UPDATE",
    statements: [
      "select 1 from public.payments p where p.booking_id = $1 order by p.id for key share",
      "select 1 from public.bookings b where b.id = $1 for no key update",
    ],
  },
] as const;

const HARNESS_INVOICE_SETTINGS: Readonly<Record<string, string>> = {
  "invoice.issuer_legal_name": "Harness Issuer Trading L.L.C.",
  "invoice.issuer_trn": "100123456700003",
  "invoice.issuer_address": "Unit 1, Example Street, Dubai",
};

const PAY_IN_FULL_SQL =
  "select payment_id from public.record_booking_payment($1, 'cash'::public.payment_method, $2, '', '', 'Paid at the desk')";

const INVOICE_COUNTER_HOLD = "select n.last_sequence_no from internal.invoice_numbering n for update";
const CREDIT_NOTE_COUNTER_HOLD = "select n.last_sequence_no from internal.credit_note_numbering n for update";

const BALANCE_SQL = `
  with eligible as (
    select p.id, p.booking_id, p.amount_fils
      from public.payments p
     where p.booking_id = any($1::uuid[])
       and p.status in ('paid', 'partially_refunded', 'fully_refunded')
       and p.amount_fils > 0
       and not exists (
         select 1 from public.refunds r
          where r.payment_id = p.id and r.requested_by is null and r.withdrawn_at is null)
  )
  select b.id::text as booking_id,
         (coalesce((select sum(i.total_fils) from public.invoices i where i.booking_id = b.id and i.voided_at is null), 0)
          - coalesce((select sum(cn.amount_fils) from public.credit_notes cn where cn.booking_id = b.id and cn.voided_at is null), 0))::int as documents,
         (coalesce((select sum(e.amount_fils) from eligible e where e.booking_id = b.id), 0)
          - coalesce((select sum(r.amount_fils) from public.refunds r join eligible e on e.id = r.payment_id
                       where e.booking_id = b.id and r.settled_at is not null and r.withdrawn_at is null), 0))::int as money
    from public.bookings b
   where b.id = any($1::uuid[])
   order by b.id`;

type DocumentKind = "invoice" | "credit_note";

interface Outcome<T> {
  readonly value: T | null;
  readonly code: string | null;
  readonly error: string | null;
  readonly elapsedMs: number;
}

interface Timed<T> {
  readonly result: Promise<Outcome<T>>;
  readonly isDone: () => boolean;
}

interface LockWait {
  readonly blockedBy: number[];
  readonly waitEvent: string | null;
  readonly tupleLocks: string[];
}

interface HeldLockCall<T> {
  readonly outcome: Outcome<T>;
  readonly waitWhileHeld: LockWait | null;
  readonly waitAtDeadline: LockWait | null;
  readonly lockTimeoutAfter: string | null;
}

interface MissingInvoice {
  readonly reason: string;
  readonly uncovered_fils: number;
  readonly uncredited_refund_fils: number;
}

interface Balance {
  readonly booking_id: string;
  readonly documents: number;
  readonly money: number;
}

interface Numbering {
  readonly sequences: number[];
  readonly distinctNumbers: number;
  readonly counter: number;
}

interface QueueSnapshot {
  readonly waitingOnHolder: number;
  readonly queuedBehindAnotherPayment: number;
  readonly returned: number;
}

interface ProbeRound {
  readonly round: number;
  readonly confirmed: Outcome<unknown>;
  readonly regenerated: Outcome<unknown>;
  readonly creditedAtOnce: boolean;
}

let up = false;
let stepLockTimeoutMs = 0;
const deskBookings: string[] = [];
const checkouts: CheckoutFixture[] = [];

function codeOf(cause: unknown): string | null {
  return typeof cause === "object" && cause !== null && "code" in cause && typeof cause.code === "string"
    ? cause.code
    : null;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function tally(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function timed<T>(pending: Promise<T>): Timed<T> {
  const startedAt = performance.now();
  let done = false;
  const result = pending
    .then(
      (value): Outcome<T> => ({ value, code: null, error: null, elapsedMs: performance.now() - startedAt }),
      (cause: unknown): Outcome<T> => ({
        value: null,
        code: codeOf(cause),
        error: messageOf(cause),
        elapsedMs: performance.now() - startedAt,
      }),
    )
    .finally(() => {
      done = true;
    });
  return { result, isDone: () => done };
}

function settledWithin(result: Promise<unknown>, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    void result.then(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function connect(): Promise<Client> {
  const client = new Client({ connectionString: CONNECTION });
  await client.connect();
  return client;
}

async function pidOf(client: Client): Promise<number> {
  return (await client.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0].pid;
}

async function actAs(db: Client, staffId: string): Promise<void> {
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: staffId, role: "authenticated" }),
  ]);
}

async function rolledBack<T>(run: (db: Client) => Promise<T>): Promise<T> {
  return withClient(async (db) => {
    await db.query("begin");
    try {
      return await run(db);
    } finally {
      await db.query("rollback").catch(() => {});
    }
  });
}

async function inStaffTransaction<T>(db: Client, staffId: string, run: () => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    await actAs(db, staffId);
    const value = await run();
    await db.query("commit");
    return value;
  } catch (cause) {
    await db.query("rollback").catch(() => {});
    throw cause;
  }
}

async function committedAs<T>(staffId: string, run: (db: Client) => Promise<T>): Promise<T> {
  return withClient((db) => inStaffTransaction(db, staffId, () => run(db)));
}

async function withInvoiceSettings<T>(run: () => Promise<T>): Promise<T> {
  const keys = Object.keys(HARNESS_INVOICE_SETTINGS);
  const saved = await withClient(
    async (db) =>
      (
        await db.query<{ key: string; value: string | null }>(
          "select key, value::text as value from public.settings where key = any($1::text[])",
          [keys],
        )
      ).rows,
  );
  expect(saved.map((row) => row.key).sort()).toEqual([...keys].sort());

  const write = (rows: ReadonlyArray<{ key: string; value: string | null }>) =>
    withClient(async (db) => {
      await db.query("begin");
      for (const row of rows) {
        await db.query("update public.settings set value = $2::text::jsonb where key = $1", [row.key, row.value]);
      }
      await db.query("commit");
    });

  await write(Object.entries(HARNESS_INVOICE_SETTINGS).map(([key, value]) => ({ key, value: JSON.stringify(value) })));
  try {
    return await run();
  } finally {
    await write(saved);
  }
}

async function newDeskBooking(): Promise<string> {
  const bookingId = await withClient((db) =>
    deskBooking(db, { totalFils: CHECKOUT_TOTAL_FILS, taxFils: CHECKOUT_TAX_FILS }),
  );
  deskBookings.push(bookingId);
  return bookingId;
}

async function newSettledCheckout(): Promise<CheckoutFixture> {
  return withClient(async (db) => {
    const fixture = await checkoutFixture(db);
    checkouts.push(fixture);
    const settled: unknown = (await fixture.settle()).rows[0].result;
    expect(settled).toMatchObject({ status: "confirmed" });
    return fixture;
  });
}

async function databaseDeadlocks(): Promise<number> {
  return withClient(
    async (db) =>
      Number(
        (
          await db.query<{ n: string }>(
            "select deadlocks::text as n from pg_stat_database where datname = current_database()",
          )
        ).rows[0].n,
      ),
  );
}

async function lockWaitOf(observer: Client, pid: number): Promise<LockWait> {
  const { rows } = await observer.query<{ blocked_by: number[]; wait_event: string | null; tuple_locks: string[] }>(
    `select pg_blocking_pids($1::int) as blocked_by,
            (select a.wait_event_type || ':' || a.wait_event from pg_stat_activity a where a.pid = $1::int) as wait_event,
            coalesce((
              select array_agg(n.nspname || '.' || c.relname || ':' || l.mode order by c.relname)
                from pg_locks l
                join pg_class c on c.oid = l.relation
                join pg_namespace n on n.oid = c.relnamespace
               where l.pid = $1::int and l.locktype = 'tuple'), '{}') as tuple_locks`,
    [pid],
  );
  return { blockedBy: rows[0].blocked_by, waitEvent: rows[0].wait_event, tupleLocks: rows[0].tuple_locks };
}

async function firstLockWait(
  observer: Client,
  pid: number,
  holderPid: number,
  isDone: () => boolean,
): Promise<LockWait | null> {
  while (!isDone()) {
    const wait = await lockWaitOf(observer, pid);
    if (wait.blockedBy.includes(holderPid)) return wait;
  }
  return null;
}

async function callWhileLockHeld<T>(
  caller: Client,
  holdSql: string | readonly string[],
  call: () => Promise<T>,
  holdParams: readonly unknown[] = [],
): Promise<HeldLockCall<T>> {
  const [holder, observer] = await Promise.all([connect(), connect()]);
  let holding = false;
  try {
    await holder.query("begin");
    for (const statement of typeof holdSql === "string" ? [holdSql] : holdSql) {
      await holder.query(statement, [...holdParams]);
    }
    holding = true;
    const holderPid = await pidOf(holder);
    const callerPid = await pidOf(caller);
    await caller.query(`set local lock_timeout = '${CALLER_LOCK_TIMEOUT}'`);

    const startedAt = performance.now();
    const pending = timed(call());
    const waitWhileHeld = await firstLockWait(observer, callerPid, holderPid, pending.isDone);
    const inTime = await settledWithin(
      pending.result,
      Math.max(0, startedAt + stepLockTimeoutMs + RETURN_MARGIN_MS - performance.now()),
    );
    const waitAtDeadline = inTime ? null : await lockWaitOf(observer, callerPid);
    await holder.query("rollback");
    holding = false;

    const outcome = await pending.result;
    const lockTimeoutAfter =
      outcome.error === null
        ? (await caller.query<{ lock_timeout: string }>("show lock_timeout")).rows[0].lock_timeout
        : null;
    return { outcome, waitWhileHeld, waitAtDeadline, lockTimeoutAfter };
  } finally {
    if (holding) await holder.query("rollback").catch(() => {});
    await Promise.all([holder.end().catch(() => {}), observer.end().catch(() => {})]);
  }
}

function expectStepGaveUpWithinItsLockTimeout(run: HeldLockCall<unknown>, lockedRelation: string): void {
  const evidence = JSON.stringify({
    elapsedMs: Math.round(run.outcome.elapsedMs),
    code: run.outcome.code,
    error: run.outcome.error,
    waitWhileHeld: run.waitWhileHeld,
    waitAtDeadline: run.waitAtDeadline,
    lockTimeoutAfter: run.lockTimeoutAfter,
  });
  console.info(`[${lockedRelation} held] ${evidence}`);
  expect.soft(run.outcome.error, evidence).toBeNull();
  expect.soft(run.waitWhileHeld, evidence).not.toBeNull();
  expect.soft(run.outcome.elapsedMs, evidence).toBeGreaterThanOrEqual(stepLockTimeoutMs);
  expect.soft(run.outcome.elapsedMs, evidence).toBeLessThanOrEqual(stepLockTimeoutMs + RETURN_MARGIN_MS);
  expect.soft(run.lockTimeoutAfter, evidence).toBe(CALLER_LOCK_TIMEOUT);
}

async function counterValue(db: Client, kind: DocumentKind): Promise<number> {
  await db.query("reset role");
  const table = kind === "invoice" ? "internal.invoice_numbering" : "internal.credit_note_numbering";
  return (await db.query<{ n: number }>(`select last_sequence_no::int as n from ${table}`)).rows[0].n;
}

async function validInvoiceIds(db: Client, bookingId: string): Promise<string[]> {
  await db.query("reset role");
  const { rows } = await db.query<{ id: string }>(
    "select i.id::text as id from public.invoices i where i.booking_id = $1 and i.voided_at is null order by i.sequence_no",
    [bookingId],
  );
  return rows.map((row) => row.id);
}

async function paymentStatuses(db: Client, bookingIds: readonly string[]): Promise<string[]> {
  await db.query("reset role");
  const { rows } = await db.query<{ status: string }>(
    "select p.status::text as status from public.payments p where p.booking_id = any($1::uuid[]) order by p.id",
    [bookingIds],
  );
  return rows.map((row) => row.status);
}

async function refundState(db: Client, refundId: string) {
  await db.query("reset role");
  return (
    await db.query<{ is_pending: boolean; settled: boolean; payment_status: string }>(
      `select r.is_pending, r.settled_at is not null as settled, p.status::text as payment_status
         from public.refunds r join public.payments p on p.id = r.payment_id
        where r.id = $1`,
      [refundId],
    )
  ).rows[0];
}

async function creditNotesOf(db: Client, refundId: string) {
  await db.query("reset role");
  return (
    await db.query<{ sequence_no: number; invoice_id: string; amount_fils: number }>(
      `select cn.sequence_no::int as sequence_no, cn.invoice_id::text as invoice_id, cn.amount_fils
         from public.credit_notes cn
        where cn.refund_id = $1 and cn.voided_at is null
        order by cn.sequence_no`,
      [refundId],
    )
  ).rows;
}

async function missingInvoicesAsManager(db: Client, bookingIds: readonly string[]): Promise<Map<string, MissingInvoice>> {
  await actAs(db, MANAGER);
  const { rows } = await db.query<MissingInvoice & { booking_id: string }>(
    `select m.booking_id::text as booking_id, m.reason, m.uncovered_fils, m.uncredited_refund_fils
       from public.management_missing_invoices m
      where m.booking_id = any($1::uuid[])`,
    [bookingIds],
  );
  await db.query("reset role");
  return new Map(rows.map(({ booking_id, ...missing }) => [booking_id, missing]));
}

async function balancesOf(db: Client, bookingIds: readonly string[]): Promise<Balance[]> {
  await db.query("reset role");
  const { rows } = await db.query<Balance>(BALANCE_SQL, [bookingIds]);
  expect(rows).toHaveLength(bookingIds.length);
  return rows;
}

async function documentsStillOwed(db: Client, bookingIds: readonly string[]) {
  const balances = await balancesOf(db, bookingIds);
  const missing = await missingInvoicesAsManager(db, bookingIds);
  return balances
    .filter((row) => row.documents !== row.money || missing.has(row.booking_id))
    .map((row) => ({ ...row, missing: missing.get(row.booking_id) ?? null }));
}

async function unexplainedBalances(db: Client, bookingIds: readonly string[]) {
  const balances = await balancesOf(db, bookingIds);
  const missing = await missingInvoicesAsManager(db, bookingIds);
  return balances.filter((row) => row.documents !== row.money && !missing.has(row.booking_id));
}

async function numbering(db: Client, kind: DocumentKind, after: number): Promise<Numbering> {
  await db.query("reset role");
  const sql =
    kind === "invoice"
      ? `select coalesce(array_agg(d.sequence_no::int order by d.sequence_no), '{}') as sequences,
                count(distinct d.invoice_number)::int as distinct_numbers,
                (select n.last_sequence_no::int from internal.invoice_numbering n) as counter
           from public.invoices d where d.sequence_no > $1`
      : `select coalesce(array_agg(d.sequence_no::int order by d.sequence_no), '{}') as sequences,
                count(distinct d.credit_note_number)::int as distinct_numbers,
                (select n.last_sequence_no::int from internal.credit_note_numbering n) as counter
           from public.credit_notes d where d.sequence_no > $1`;
  const row = (await db.query<{ sequences: number[]; distinct_numbers: number; counter: number }>(sql, [after]))
    .rows[0];
  return { sequences: row.sequences, distinctNumbers: row.distinct_numbers, counter: row.counter };
}

function expectGapless(found: Numbering, after: number): void {
  const evidence = JSON.stringify({ after, ...found });
  expect.soft(found.sequences, evidence).toEqual(
    Array.from({ length: found.counter - after }, (_, index) => after + 1 + index),
  );
  expect.soft(found.distinctNumbers, evidence).toBe(found.sequences.length);
}

async function waitUntilEveryPaymentIsQueued(
  observer: Client,
  holderPid: number,
  pids: readonly number[],
  calls: ReadonlyArray<Timed<unknown>>,
): Promise<QueueSnapshot> {
  for (;;) {
    const { rows } = await observer.query<{ pid: number; blocked_by: number[] }>(
      "select p.pid, pg_blocking_pids(p.pid) as blocked_by from unnest($1::int[]) as p(pid)",
      [pids],
    );
    const blockers = new Map(rows.map((row) => [row.pid, row.blocked_by]));
    const states = pids.map((pid, index) => {
      if (calls[index].isDone()) return "returned";
      const blockedBy = blockers.get(pid) ?? [];
      if (blockedBy.includes(holderPid)) return "holder";
      return blockedBy.some((blocker) => pids.includes(blocker)) ? "payment" : "running";
    });
    if (!states.includes("running")) {
      return {
        waitingOnHolder: states.filter((state) => state === "holder").length,
        queuedBehindAnotherPayment: states.filter((state) => state === "payment").length,
        returned: states.filter((state) => state === "returned").length,
      };
    }
  }
}

beforeAll(async () => {
  up = await harnessIsUp();
  if (!up) {
    console.warn("invoice steps never block money: no local database — npm run db:test:up");
    return;
  }
  await claimDatabase();
  await withClient(async (db) => {
    for (const staff of DOCUMENT_STAFF) {
      await db.query(
        `insert into public.staff (id, email, full_name, role, is_active)
         values ($1::uuid, $2, $3, $4::public.staff_role, true)
         on conflict (id) do update
            set is_active = true, role = excluded.role, email = excluded.email, full_name = excluded.full_name`,
        [staff.id, staff.email, staff.fullName, staff.role],
      );
    }
  });
  stepLockTimeoutMs = await withClient(
    async (db) =>
      Number(
        (
          await db.query<{ ms: string }>(
            "select extract(epoch from internal.document_step_lock_timeout()::interval) * 1000 as ms",
          )
        ).rows[0].ms,
      ),
  );
});

afterAll(async () => {
  if (!up) return;
  try {
    await withClient(async (db) => {
      for (const fixture of checkouts) {
        await db.query("update public.bookings set occupancy_id = null, suite_id = null where id = $1", [
          fixture.bookingId,
        ]);
        await db.query("delete from internal.guest_checkout_holds where token = $1", [fixture.token]);
        await db.query("delete from public.suite_occupancy where suite_id = $1 or booking_id = $2", [
          fixture.suite,
          fixture.bookingId,
        ]);
      }
    });
    await wipeUndocumentedBookings();
    await withClient(async (db) => {
      await db.query("delete from internal.checkout_sessions where token = any($1::uuid[])", [
        checkouts.map((fixture) => fixture.token),
      ]);
      await db.query("delete from public.suites where id = any($1::uuid[])", [
        checkouts.map((fixture) => fixture.suite),
      ]);
    });
  } finally {
    await releaseDatabase();
  }
});

describe("rule 4, finding 5 — the automatic invoice and credit note steps never block or fail money", () => {
  it(
    "[§8; rule 4, finding 5] a Reception payment that makes a confirmed booking fully paid settles within the step lock_timeout while another issue holds the invoice counter, consumes no invoice number, restores the caller's lock_timeout, leaves the booking under Missing invoices, and Issue now then takes the next gapless number",
    { timeout: PROOF_TIMEOUT_MS },
    async (ctx) => {
      if (!up) return ctx.skip();
      const bookingId = await newDeskBooking();

      await withInvoiceSettings(async () => {
        const counterBefore = await rolledBack((db) => counterValue(db, "invoice"));

        const { run, invoicesSeenBeforeCommit } = await withClient(async (caller) => {
          await caller.query("begin");
          await actAs(caller, RECEPTION);
          const run = await callWhileLockHeld(caller, INVOICE_COUNTER_HOLD, async () =>
            (await caller.query<{ payment_id: string }>(PAY_IN_FULL_SQL, [bookingId, CHECKOUT_TOTAL_FILS])).rows[0]
              .payment_id,
          );
          const invoicesSeenBeforeCommit =
            run.outcome.error === null ? (await validInvoiceIds(caller, bookingId)).length : null;
          await caller.query(invoicesSeenBeforeCommit === 0 ? "commit" : "rollback");
          return { run, invoicesSeenBeforeCommit };
        });

        expectStepGaveUpWithinItsLockTimeout(run, "internal.invoice_numbering");
        expect.soft(invoicesSeenBeforeCommit).toBe(0);
        expect(run.outcome.value).not.toBeNull();

        await rolledBack(async (db) => {
          expect.soft(await paymentStatuses(db, [bookingId])).toEqual(["paid"]);
          expect.soft(await validInvoiceIds(db, bookingId)).toEqual([]);
          expect.soft(await counterValue(db, "invoice")).toBe(counterBefore);
          expect.soft((await missingInvoicesAsManager(db, [bookingId])).get(bookingId)).toEqual({
            reason: "payment_not_invoiced",
            uncovered_fils: CHECKOUT_TOTAL_FILS,
            uncredited_refund_fils: 0,
          });
        });

        await rolledBack(async (db) => {
          await actAs(db, MANAGER);
          const issued = (
            await db.query<{ sequence_no: string; total_fils: number }>(
              "select sequence_no, total_fils from public.issue_invoice($1)",
              [bookingId],
            )
          ).rows[0];
          expect.soft({ sequence: Number(issued.sequence_no), total: issued.total_fils }).toEqual({
            sequence: counterBefore + 1,
            total: CHECKOUT_TOTAL_FILS,
          });
          expect.soft(await documentsStillOwed(db, [bookingId])).toEqual([]);
          expectGapless(await numbering(db, "invoice", counterBefore), counterBefore);
        });
      });
    },
  );

  it(
    "[§8; rule 4, rule 5, finding 5] Management confirming a refund's return on an invoiced payment settles it within the step lock_timeout while another issue holds the credit note counter, consumes no credit note number, lists the booking as a refund not credited, and Issue now then adds the credit note with the next gapless number",
    { timeout: PROOF_TIMEOUT_MS },
    async (ctx) => {
      if (!up) return ctx.skip();
      const bookingId = await newDeskBooking();

      await withInvoiceSettings(() =>
        withClient(async (caller) => {
          await caller.query("begin");
          try {
            await actAs(caller, RECEPTION);
            const paymentId = await recordCash(caller, bookingId, CHECKOUT_TOTAL_FILS);
            const invoices = await validInvoiceIds(caller, bookingId);
            expect(invoices).toHaveLength(1);
            await actAs(caller, MANAGER);
            const refundId = await requestRefund(caller, paymentId, PARTIAL_REFUND_FILS);
            const counterBefore = await counterValue(caller, "credit_note");
            await actAs(caller, MANAGER);

            const run = await callWhileLockHeld(caller, CREDIT_NOTE_COUNTER_HOLD, async () =>
              (
                await caller.query<{ refund_id: string }>(
                  "select refund_id from public.confirm_refund_return($1, 'BANK-HARNESS-RETURN', 'Returned by bank transfer')",
                  [refundId],
                )
              ).rows[0].refund_id,
            );

            expectStepGaveUpWithinItsLockTimeout(run, "internal.credit_note_numbering");
            expect(run.outcome.value).toBe(refundId);
            expect.soft(await refundState(caller, refundId)).toEqual({
              is_pending: false,
              settled: true,
              payment_status: "partially_refunded",
            });
            expect.soft(await creditNotesOf(caller, refundId)).toEqual([]);
            expect.soft(await counterValue(caller, "credit_note")).toBe(counterBefore);
            expect.soft((await missingInvoicesAsManager(caller, [bookingId])).get(bookingId)).toEqual({
              reason: "refund_not_credited",
              uncovered_fils: 0,
              uncredited_refund_fils: PARTIAL_REFUND_FILS,
            });

            await actAs(caller, MANAGER);
            const issued = (await caller.query<{ id: string }>("select id::text as id from public.issue_invoice($1)", [bookingId]))
              .rows[0];
            expect.soft(issued.id).toBe(invoices[0]);
            expect.soft(await creditNotesOf(caller, refundId)).toEqual([
              { sequence_no: counterBefore + 1, invoice_id: invoices[0], amount_fils: PARTIAL_REFUND_FILS },
            ]);
            expect.soft(await documentsStillOwed(caller, [bookingId])).toEqual([]);
            expectGapless(await numbering(caller, "credit_note", counterBefore), counterBefore);
          } finally {
            await caller.query("rollback").catch(() => {});
          }
        }),
      );
    },
  );

  it(
    `[§8, §17.4 higher load; rule 3, rule 4] ${PARALLEL_PAYMENTS} Reception payments that each make a confirmed booking fully paid, sent at once while another issue holds the invoice counter until every one has returned, are all paid within the step lock_timeout with no invoice number consumed, every booking balances or is listed under Missing invoices, and Issue now then numbers them gapless and unique`,
    { timeout: PROOF_TIMEOUT_MS },
    async (ctx) => {
      if (!up) return ctx.skip();
      const bookingIds: string[] = [];
      for (let index = 0; index < PARALLEL_PAYMENTS; index++) bookingIds.push(await newDeskBooking());

      await withInvoiceSettings(async () => {
        const counterBefore = await rolledBack((db) => counterValue(db, "invoice"));
        const payers = await Promise.all(bookingIds.map(() => connect()));
        const [holder, observer] = await Promise.all([connect(), connect()]);
        let holding = false;

        const wave = await (async () => {
          try {
            for (const payer of payers) {
              await payer.query("begin");
              await actAs(payer, RECEPTION);
              await payer.query(`set local lock_timeout = '${CALLER_LOCK_TIMEOUT}'`);
            }
            const payerPids = await Promise.all(payers.map(pidOf));
            await holder.query("begin");
            await holder.query(INVOICE_COUNTER_HOLD);
            holding = true;
            const holderPid = await pidOf(holder);

            const calls = payers.map((payer, index) =>
              timed(
                payer
                  .query<{ payment_id: string }>(PAY_IN_FULL_SQL, [bookingIds[index], CHECKOUT_TOTAL_FILS])
                  .then((result) => result.rows[0].payment_id),
              ),
            );
            const queue = await waitUntilEveryPaymentIsQueued(observer, holderPid, payerPids, calls);
            const outcomes = await Promise.all(calls.map((call) => call.result));

            const lockTimeoutsAfter: Array<string | null> = [];
            const invoicesSeenBeforeCommit: Array<number | null> = [];
            for (const [index, payer] of payers.entries()) {
              const ok = outcomes[index].error === null;
              lockTimeoutsAfter.push(
                ok ? (await payer.query<{ lock_timeout: string }>("show lock_timeout")).rows[0].lock_timeout : null,
              );
              const seen = ok ? (await validInvoiceIds(payer, bookingIds[index])).length : null;
              invoicesSeenBeforeCommit.push(seen);
              await payer.query(seen === 0 ? "commit" : "rollback");
            }

            await holder.query("rollback");
            holding = false;
            return { queue, outcomes, lockTimeoutsAfter, invoicesSeenBeforeCommit };
          } finally {
            if (holding) await holder.query("rollback").catch(() => {});
            await Promise.all([holder, observer, ...payers].map((client) => client.end().catch(() => {})));
          }
        })();

        const latencies = wave.outcomes.map((outcome) => Math.round(outcome.elapsedMs));
        console.info(
          `[invoice counter held until ${PARALLEL_PAYMENTS} parallel payments returned] ${JSON.stringify({
            queue: wave.queue,
            failed: wave.outcomes.filter((outcome) => outcome.error !== null).length,
            latencyMs: { min: Math.min(...latencies), max: Math.max(...latencies) },
            sortedLatenciesMs: [...latencies].sort((left, right) => left - right),
          })}`,
        );

        expect
          .soft(wave.outcomes.filter((outcome) => outcome.error !== null).map((outcome) => `${outcome.code} ${outcome.error}`))
          .toEqual([]);
        expect.soft(Math.min(...latencies)).toBeGreaterThanOrEqual(stepLockTimeoutMs);
        expect.soft(Math.max(...latencies)).toBeLessThanOrEqual(stepLockTimeoutMs + RETURN_MARGIN_MS);
        expect.soft(wave.lockTimeoutsAfter).toEqual(bookingIds.map(() => CALLER_LOCK_TIMEOUT));
        expect.soft(wave.invoicesSeenBeforeCommit).toEqual(bookingIds.map(() => 0));

        await rolledBack(async (db) => {
          expect.soft(await paymentStatuses(db, bookingIds)).toEqual(bookingIds.map(() => "paid"));
          expect.soft(await counterValue(db, "invoice")).toBe(counterBefore);
          expectGapless(await numbering(db, "invoice", counterBefore), counterBefore);
          expect.soft(await unexplainedBalances(db, bookingIds)).toEqual([]);
          const missing = await missingInvoicesAsManager(db, bookingIds);
          expect.soft([...missing.keys()].sort()).toEqual([...bookingIds].sort());
          expect
            .soft(
              [...missing.values()].filter(
                (row) => row.reason !== "payment_not_invoiced" || row.uncovered_fils !== CHECKOUT_TOTAL_FILS,
              ),
            )
            .toEqual([]);
        });

        await rolledBack(async (db) => {
          for (const bookingId of bookingIds) {
            await actAs(db, MANAGER);
            await db.query("select id from public.issue_invoice($1)", [bookingId]);
          }
          expect.soft(await documentsStillOwed(db, bookingIds)).toEqual([]);
          const issued = await numbering(db, "invoice", counterBefore);
          expect.soft(issued.sequences).toHaveLength(PARALLEL_PAYMENTS);
          expectGapless(issued, counterBefore);
        });
      });
    },
  );

  for (const { label, statements } of BOOKING_ROW_HOLDERS) {
    it(
      `[§8; rule 4, rule 5, finding 5] a simulated refund is recorded as returned within the step lock_timeout while ${label}, the booking is listed as a refund not credited, and Issue now then adds the credit note`,
      { timeout: PROOF_TIMEOUT_MS },
      async (ctx) => {
        if (!up) return ctx.skip();

        await withInvoiceSettings(async () => {
          const fixture = await newSettledCheckout();
          const invoices = await rolledBack((db) => validInvoiceIds(db, fixture.bookingId));
          expect(invoices).toHaveLength(1);
          const counterBefore = await rolledBack((db) => counterValue(db, "credit_note"));

          const run = await withClient(async (caller) => {
            await caller.query("begin");
            await actAs(caller, RECEPTION);
            const held = await callWhileLockHeld(
              caller,
              statements,
              () => requestRefund(caller, fixture.paymentId, PARTIAL_REFUND_FILS),
              [fixture.bookingId],
            );
            await caller.query(held.outcome.error === null ? "commit" : "rollback");
            return held;
          });

          expectStepGaveUpWithinItsLockTimeout(run, "public.bookings");
          const refundId = run.outcome.value;
          if (refundId === null) {
            throw new Error(`request_payment_refund failed: ${run.outcome.code} ${run.outcome.error}`);
          }

          await rolledBack(async (db) => {
            expect.soft(await refundState(db, refundId)).toEqual({
              is_pending: false,
              settled: true,
              payment_status: "partially_refunded",
            });
            expect.soft(await creditNotesOf(db, refundId)).toEqual([]);
            expect.soft(await counterValue(db, "credit_note")).toBe(counterBefore);
            expect.soft((await missingInvoicesAsManager(db, [fixture.bookingId])).get(fixture.bookingId)).toEqual({
              reason: "refund_not_credited",
              uncovered_fils: 0,
              uncredited_refund_fils: PARTIAL_REFUND_FILS,
            });
          });

          await committedAs(MANAGER, (db) => db.query("select id from public.issue_invoice($1)", [fixture.bookingId]));

          await rolledBack(async (db) => {
            expect.soft((await creditNotesOf(db, refundId)).map((note) => note.invoice_id)).toEqual(invoices);
            expect.soft(await documentsStillOwed(db, [fixture.bookingId])).toEqual([]);
            expectGapless(await numbering(db, "credit_note", counterBefore), counterBefore);
          });
        });
      },
    );
  }

  it(
    `[§8, §17.4 higher load; rule 3, rule 4] ${PARALLEL_PAYMENTS} Reception payments that each make a confirmed booking fully paid, sent at once while another issue holds the invoice counter until every one is queued behind it, are all paid within the step lock_timeout, committed invoice numbers stay gapless and unique, and every booking balances or is listed under Missing invoices until Issue now issues it`,
    { timeout: PROOF_TIMEOUT_MS },
    async (ctx) => {
      if (!up) return ctx.skip();
      const bookingIds: string[] = [];
      for (let index = 0; index < PARALLEL_PAYMENTS; index++) bookingIds.push(await newDeskBooking());

      await withInvoiceSettings(async () => {
        const counterBefore = await rolledBack((db) => counterValue(db, "invoice"));
        const payers = await Promise.all(bookingIds.map(() => connect()));
        const [holder, observer] = await Promise.all([connect(), connect()]);
        let holding = false;

        const wave = await (async () => {
          try {
            for (const payer of payers) {
              await payer.query("begin");
              await actAs(payer, RECEPTION);
              await payer.query(`set local lock_timeout = '${CALLER_LOCK_TIMEOUT}'`);
            }
            const payerPids = await Promise.all(payers.map(pidOf));
            await holder.query("begin");
            await holder.query(INVOICE_COUNTER_HOLD);
            holding = true;
            const holderPid = await pidOf(holder);

            const calls = payers.map((payer, index) =>
              timed(
                payer
                  .query<{ payment_id: string }>(PAY_IN_FULL_SQL, [bookingIds[index], CHECKOUT_TOTAL_FILS])
                  .then((result) => result.rows[0].payment_id),
              ),
            );
            const committed = payers.map(async (payer, index) => {
              const outcome = await calls[index].result;
              const lockTimeoutAfter =
                outcome.error === null
                  ? (await payer.query<{ lock_timeout: string }>("show lock_timeout")).rows[0].lock_timeout
                  : null;
              await payer.query(outcome.error === null ? "commit" : "rollback");
              return { outcome, lockTimeoutAfter };
            });
            const queue = await waitUntilEveryPaymentIsQueued(observer, holderPid, payerPids, calls);
            await holder.query("rollback");
            holding = false;
            return { queue, results: await Promise.all(committed) };
          } finally {
            if (holding) await holder.query("rollback").catch(() => {});
            await Promise.all([holder, observer, ...payers].map((client) => client.end().catch(() => {})));
          }
        })();

        const outcomes = wave.results.map((result) => result.outcome);
        const latencies = outcomes.map((outcome) => Math.round(outcome.elapsedMs));
        const missing = await rolledBack((db) => missingInvoicesAsManager(db, bookingIds));
        const invoiced = await rolledBack(async (db) => {
          await db.query("reset role");
          return (
            await db.query<{ n: number }>(
              "select count(distinct i.booking_id)::int as n from public.invoices i where i.booking_id = any($1::uuid[]) and i.voided_at is null",
              [bookingIds],
            )
          ).rows[0].n;
        });
        console.info(
          `[invoice counter released once ${PARALLEL_PAYMENTS} parallel payments queued] ${JSON.stringify({
            queue: wave.queue,
            failed: outcomes.filter((outcome) => outcome.error !== null).length,
            invoicedAutomatically: invoiced,
            listedUnderMissingInvoices: missing.size,
            sortedLatenciesMs: [...latencies].sort((left, right) => left - right),
          })}`,
        );

        expect
          .soft(outcomes.filter((outcome) => outcome.error !== null).map((outcome) => `${outcome.code} ${outcome.error}`))
          .toEqual([]);
        expect.soft(Math.max(...latencies)).toBeLessThanOrEqual(stepLockTimeoutMs + RETURN_MARGIN_MS);
        expect.soft(wave.results.map((result) => result.lockTimeoutAfter)).toEqual(bookingIds.map(() => CALLER_LOCK_TIMEOUT));
        expect.soft(invoiced + missing.size).toBe(PARALLEL_PAYMENTS);
        expect
          .soft(
            [...missing.values()].filter(
              (row) => row.reason !== "payment_not_invoiced" || row.uncovered_fils !== CHECKOUT_TOTAL_FILS,
            ),
          )
          .toEqual([]);
        await rolledBack(async (db) => {
          expect.soft(await paymentStatuses(db, bookingIds)).toEqual(bookingIds.map(() => "paid"));
          expectGapless(await numbering(db, "invoice", counterBefore), counterBefore);
          expect.soft(await unexplainedBalances(db, bookingIds)).toEqual([]);
        });

        const repairs = await Promise.all(
          [...missing.keys()].map(
            (bookingId) =>
              timed(committedAs(MANAGER, (db) => db.query("select id from public.issue_invoice($1)", [bookingId]))).result,
          ),
        );
        expect.soft(repairs.filter((repair) => repair.error !== null).map((repair) => `${repair.code} ${repair.error}`)).toEqual([]);
        await rolledBack(async (db) => {
          expect.soft(await documentsStillOwed(db, bookingIds)).toEqual([]);
          expectGapless(await numbering(db, "invoice", counterBefore), counterBefore);
        });
      });
    },
  );

  it(
    `[§8; rule 4, rule 5, rule 6] ${DEADLOCK_PROBE_ROUNDS} refund confirmations raced one by one against Regenerate on the same invoiced booking never fail, and the booking ends with at most one valid credit note per refund`,
    { timeout: PROOF_TIMEOUT_MS },
    async (ctx) => {
      if (!up) return ctx.skip();
      const bookingId = await newDeskBooking();

      await withInvoiceSettings(async () => {
        const paymentId = await committedAs(RECEPTION, (db) => recordCash(db, bookingId, CHECKOUT_TOTAL_FILS));
        expect(await rolledBack((db) => validInvoiceIds(db, bookingId))).toHaveLength(1);
        const deadlocksBefore = await databaseDeadlocks();
        const [confirmer, regenerator] = await Promise.all([connect(), connect()]);

        const rounds = await (async () => {
          try {
            const played: ProbeRound[] = [];
            for (let round = 1; round <= DEADLOCK_PROBE_ROUNDS; round++) {
              const refundId = await committedAs(MANAGER, (db) =>
                requestRefund(db, paymentId, PROBE_REFUND_FILS, `Deadlock probe round ${round}`),
              );
              const [invoiceId] = await rolledBack((db) => validInvoiceIds(db, bookingId));
              const [confirmed, regenerated] = await Promise.all([
                timed(
                  inStaffTransaction(confirmer, MANAGER, () =>
                    confirmer.query("select refund_id from public.confirm_refund_return($1, $2, 'Returned by bank transfer')", [
                      refundId,
                      `PROBE-RETURN-${round}`,
                    ]),
                  ),
                ).result,
                timed(
                  inStaffTransaction(regenerator, MANAGER, () =>
                    regenerator.query("select id from public.regenerate_invoice($1, 'Deadlock probe regenerate', null)", [
                      invoiceId,
                    ]),
                  ),
                ).result,
              ]);
              const creditedAtOnce = (await rolledBack((db) => creditNotesOf(db, refundId))).length === 1;
              played.push({ round, confirmed, regenerated, creditedAtOnce });
            }
            for (const client of [confirmer, regenerator]) await client.query("select pg_stat_force_next_flush()");
            return played;
          } finally {
            await Promise.all([confirmer.end().catch(() => {}), regenerator.end().catch(() => {})]);
          }
        })();

        const deadlocksDetected = (await databaseDeadlocks()) - deadlocksBefore;
        const confirmDeadlocks = rounds.filter((round) => round.confirmed.code === DEADLOCK).length;
        const regenerateDeadlocks = rounds.filter((round) => round.regenerated.code === DEADLOCK).length;
        const duplicates = await rolledBack(async (db) => {
          await db.query("reset role");
          return (
            await db.query<{ refund_id: string; valid_credit_notes: number }>(
              `select cn.refund_id::text as refund_id, count(*)::int as valid_credit_notes
                 from public.credit_notes cn
                where cn.booking_id = $1 and cn.voided_at is null
                group by cn.refund_id
               having count(*) > 1`,
              [bookingId],
            )
          ).rows;
        });
        const onVoidedInvoices = await rolledBack(async (db) => {
          await db.query("reset role");
          return (
            await db.query<{ n: number }>(
              `select count(*)::int as n
                 from public.credit_notes cn join public.invoices i on i.id = cn.invoice_id
                where cn.booking_id = $1 and cn.voided_at is null and i.voided_at is not null`,
              [bookingId],
            )
          ).rows[0].n;
        });

        console.info(
          `[deadlock probe: confirm_refund_return vs regenerate_invoice, ${DEADLOCK_PROBE_ROUNDS} rounds] ${JSON.stringify({
            confirmRefundReturn: {
              outcomes: tally(rounds.map((round) => round.confirmed.code ?? "ok")),
              surfaced40P01: confirmDeadlocks,
              maxLatencyMs: Math.round(Math.max(...rounds.map((round) => round.confirmed.elapsedMs))),
            },
            regenerateInvoice: {
              outcomes: tally(rounds.map((round) => round.regenerated.code ?? "ok")),
              surfaced40P01: regenerateDeadlocks,
              maxLatencyMs: Math.round(Math.max(...rounds.map((round) => round.regenerated.elapsedMs))),
            },
            deadlocksDetectedByDatabase: deadlocksDetected,
            deadlocksDetectedButNotSurfacedToEitherCaller: deadlocksDetected - confirmDeadlocks - regenerateDeadlocks,
            roundsWhereTheCreditNoteWaitedForALaterIssue: rounds.filter((round) => !round.creditedAtOnce).length,
            validCreditNotesOnVoidedInvoices: onVoidedInvoices,
            errors: rounds
              .flatMap((round) => [
                round.confirmed.error === null ? null : { round: round.round, side: "confirm", code: round.confirmed.code, error: round.confirmed.error },
                round.regenerated.error === null ? null : { round: round.round, side: "regenerate", code: round.regenerated.code, error: round.regenerated.error },
              ])
              .filter((entry) => entry !== null),
          })}`,
        );

        expect
          .soft(
            rounds
              .filter((round) => round.confirmed.error !== null)
              .map((round) => ({ round: round.round, code: round.confirmed.code, error: round.confirmed.error })),
          )
          .toEqual([]);
        expect.soft(duplicates).toEqual([]);
      });
    },
  );
});
