import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";

import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";
import { ALERT_KINDS, ALERT_SEVERITY, scanForAlerts, type AlertScan } from "@/lib/domain/alerts";
import { thresholdsFrom } from "@/lib/services/alert-service";
import { claimDatabase, harnessIsUp, releaseDatabase, withClient } from "./support/harness";

let up = false;
let jobId: number;
let wasActive = false;

beforeAll(async () => {
  up = await harnessIsUp();
  if (!up) return;
  await claimDatabase();
  await withClient(async (db) => {
    const { rows } = await db.query("select jobid, active from cron.job where jobname = 'wellplace-alert-worker'");
    expect(rows).toHaveLength(1);
    jobId = rows[0].jobid;
    wasActive = rows[0].active;
    await db.query("update cron.job set active = false where jobid = $1", [jobId]);
  });
});

afterAll(async () => {
  if (!up) return;
  try {
    if (jobId !== undefined) await withClient((db) => db.query("update cron.job set active = $2 where jobid = $1", [jobId, wasActive]));
  } finally {
    await releaseDatabase();
  }
});

async function transaction(run: (db: Client) => Promise<void>) {
  await withClient(async (db) => {
    await db.query("begin");
    try {
      await db.query("select pg_advisory_xact_lock(hashtext('wellplace.alert_worker')::bigint)");
      await db.query("delete from internal.alert_refresh_events");
      await run(db);
    } finally {
      await db.query("rollback");
    }
  });
}

async function failedMessage(db: Client) {
  const { rows } = await db.query(`insert into public.messages
    (template_key, channel, status, to_address, is_marketing, failed_at)
    values ('booking_confirmation', 'email', 'failed', 'worker@example.test', false, now()) returning id`);
  return rows[0].id as string;
}

async function runWorker(db: Client) {
  const { rows } = await db.query("select internal.run_alert_worker() as report");
  return rows[0].report;
}

describe("[§9.3; OUR CHOICE] database alert worker", () => {
  it("registers a database-only job and keeps worker privileges private", async (ctx) => {
    if (!up) return ctx.skip();
    await withClient(async (db) => {
      const { rows } = await db.query("select schedule, command from cron.job where jobid = $1", [jobId]);
      expect(wasActive).toBe(true);
      expect(rows[0]).toEqual({ schedule: "10 seconds", command: "select internal.run_alert_worker();" });
      for (const role of ["anon", "authenticated", "service_role"]) {
        const result = await db.query(`select
          has_function_privilege($1, 'internal.run_alert_worker()', 'EXECUTE') as execute,
          has_table_privilege($1, 'internal.alert_refresh_events', 'INSERT,SELECT,DELETE') as queue`, [role]);
        expect(result.rows[0]).toEqual({ execute: false, queue: false });
      }
    });
  });

  it("matches registry defaults, overrides and invalid-value fallbacks", async (ctx) => {
    if (!up) return ctx.skip();
    await transaction(async (db) => {
      const keys = ["reception.arrival_overdue_minutes"] as const;
      for (const key of keys) {
        await db.query("delete from public.settings where key = $1", [key]);
        expect(Number((await db.query("select internal.alert_threshold($1) as value", [key])).rows[0].value))
          .toBe(requireSetting(EMPTY_SNAPSHOT, key));
        for (const value of [null, 0, 7, 720, 721, -1, 2.5, "invalid", {}, 1e20, Number.MAX_SAFE_INTEGER]) {
          await db.query(`insert into public.settings (key, value, value_type, description, source_tag)
            values ($1, $2::jsonb, 'integer', 'Alert worker test', '[§9.3]')
            on conflict (key) do update set value = excluded.value`, [key, JSON.stringify(value)]);
          const actual = await db.query("select internal.alert_threshold($1) as value", [key]);
          expect(Number(actual.rows[0].value), `${key}: ${JSON.stringify(value)}`)
            .toBe(requireSetting({ [key]: value }, key));
        }
      }
      for (const kind of ALERT_KINDS) {
        expect((await db.query("select internal.alert_severity($1) as value", [kind])).rows[0].value).toBe(ALERT_SEVERITY[kind]);
      }
    });
  });

  it("coalesces transactional events without scanning and discards rolled-back events", async (ctx) => {
    if (!up) return ctx.skip();
    await transaction(async (db) => {
      await db.query("savepoint business_change");
      const id = await failedMessage(db);
      await db.query("update public.messages set error = 'Provider unavailable' where id = $1", [id]);
      expect((await db.query("select count(*)::int as n from internal.alert_refresh_events")).rows[0].n).toBe(1);
      expect((await db.query("select count(*)::int as n from public.alerts where entity_id = $1", [id])).rows[0].n).toBe(0);
      await db.query("rollback to savepoint business_change");
      expect((await db.query("select count(*)::int as n from internal.alert_refresh_events")).rows[0].n).toBe(0);
    });
  });

  it("opens once, resolves cleared conditions and preserves history on recurrence", async (ctx) => {
    if (!up) return ctx.skip();
    await transaction(async (db) => {
      const id = await failedMessage(db);
      expect((await runWorker(db)).status).toBe("ok");
      expect((await runWorker(db)).status).toBe("idle");
      const count = () => db.query("select count(*)::int as total, count(*) filter (where resolved_at is null)::int as open from public.alerts where entity_id = $1", [id]);
      expect((await count()).rows[0]).toEqual({ total: 1, open: 1 });
      await db.query("update public.messages set status = 'queued', failed_at = null where id = $1", [id]);
      expect((await runWorker(db)).status).toBe("ok");
      expect((await count()).rows[0]).toEqual({ total: 1, open: 0 });
      await db.query("update public.messages set status = 'failed', failed_at = now() where id = $1", [id]);
      expect((await runWorker(db)).status).toBe("ok");
      expect((await count()).rows[0]).toEqual({ total: 2, open: 1 });
    });
  });

  it("retries failed reconciliation without losing the business write or event", async (ctx) => {
    if (!up) return ctx.skip();
    await transaction(async (db) => {
      await db.query(`create function internal.test_reject_alert() returns trigger language plpgsql as $$
        begin raise exception 'Injected alert failure' using errcode = 'P0001'; end $$;
        create trigger test_reject_alert before insert on public.alerts
        for each row execute function internal.test_reject_alert()`);
      const id = await failedMessage(db);
      expect(await runWorker(db)).toEqual({ status: "error", code: "P0001" });
      expect((await db.query("select count(*)::int as n from internal.alert_refresh_events")).rows[0].n).toBe(1);
      expect((await db.query("select status from public.messages where id = $1", [id])).rows[0].status).toBe("failed");
      expect((await db.query("select last_error_code from internal.alert_worker_state")).rows[0].last_error_code).toBe("P0001");
      await db.query("drop trigger test_reject_alert on public.alerts");
      expect((await runWorker(db)).status).toBe("ok");
      expect((await db.query("select count(*)::int as n from internal.alert_refresh_events")).rows[0].n).toBe(0);
      expect((await db.query("select last_error_code, consecutive_failures from internal.alert_worker_state")).rows[0])
        .toEqual({ last_error_code: null, consecutive_failures: 0 });
    });
  });

  it("[CLIENT] resolves retired cleaning reminders without changing the cleaning task", async (ctx) => {
    if (!up) return ctx.skip();
    await transaction(async (db) => {
      const { rows } = await db.query(`insert into public.cleaning_tasks (suite_id, due_from)
        select id, now() - interval '1 day' from public.suites limit 1 returning id`);
      await db.query("insert into public.alerts (kind, severity, entity, entity_id) values ('cleaning_unconfirmed', 'warning', 'public.cleaning_tasks', $1)", [rows[0].id]);
      await db.query("delete from internal.alert_refresh_events");
      await db.query("update internal.alert_worker_state set last_success_at = now() - interval '1 minute'");
      expect((await runWorker(db)).status).toBe("ok");
      const alerts = await db.query("select kind from public.alerts where entity_id = $1 and resolved_at is null", [rows[0].id]);
      expect(alerts.rows).toEqual([]);
      expect((await db.query("select confirmed_at from public.cleaning_tasks where id = $1", [rows[0].id])).rows[0].confirmed_at).toBeNull();
    });
  });

  it("skips overlapping workers without waiting on operational transactions", async (ctx) => {
    if (!up) return ctx.skip();
    await transaction(async () => {
      await withClient(async (other) => {
        await other.query("set statement_timeout = '1s'");
        expect(await runWorker(other)).toEqual({ status: "busy" });
        await other.query("begin");
        try {
          await failedMessage(other);
        } finally {
          await other.query("rollback");
        }
      });
    });
  });

  it("[CLIENT] matches active TypeScript detectors and excludes retired reminders at elapsed-time boundaries", async (ctx) => {
    if (!up) return ctx.skip();
    await transaction(async (db) => {
      const now = new Date("2035-02-01T12:00:00Z");
      const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
      const thresholds = thresholdsFrom(EMPTY_SNAPSHOT);
      await db.query("delete from public.settings where key like 'reception.%'");
      const suites = (await db.query("select id from public.suites order by suite_number limit 2")).rows;
      const customer = (await db.query(`insert into public.customers (first_name, last_name, email, phone_e164, phone_country)
        values ('Alert', 'Test', $1, '+971500000001', 'AE') returning id`, [`${randomUUID()}@example.test`])).rows[0].id;
      const bookings: AlertScan["bookings"][number][] = [];
      const payments: string[] = [];
      for (const [index, paymentStatus] of ["paid", "failed", "manual_review"].entries()) {
        const id = randomUUID();
        const arrivedAt = index === 1 ? at(-thresholds.checkinOverdueMinutes) : null;
        await db.query(`insert into public.bookings (id, reference, customer_id, source, status, experience_period, cleaning_buffer_minutes, arrived_at)
          values ($1, $2, $3, 'walk_in', 'confirmed', tstzrange($4,$5,'[)'), 0, $6)`,
        [id, `ALERT-${id.slice(0, 8).toUpperCase()}`, customer, at(-thresholds.arrivalOverdueMinutes), at(60), arrivedAt]);
        payments.push((await db.query(`insert into public.payments (booking_id, status, method, amount_fils)
          values ($1,$2,'cash',100) returning id`, [id, paymentStatus])).rows[0].id);
        bookings.push({ bookingId: id, status: "confirmed", startsAt: at(-thresholds.arrivalOverdueMinutes), endsAt: at(60),
          arrivedAt, checkedInAt: null, checkedOutAt: null, suiteId: null, paymentStatus });
      }
      const holdId = randomUUID();
      const conflictId = randomUUID();
      for (const [id, kind, suite] of [[holdId, "hold", suites[0].id], [conflictId, "maintenance", suites[1].id]]) {
        await db.query(`insert into public.suite_occupancy (id, suite_id, kind, experience_period, blocked_period, cleaning_buffer_minutes, expires_at)
          values ($1,$2,$3,tstzrange($4,$5,'[)'),tstzrange($4,$5,'[)'),0,$6)`,
        [id, suite, kind, now, at(60), at(thresholds.holdExpiryWarningMinutes)]);
      }
      const cleaningId = (await db.query(`insert into public.cleaning_tasks (suite_id, due_from) values ($1,$2) returning id`,
        [suites[0].id, at(-thresholds.cleaningConfirmMinutes)])).rows[0].id;
      const messageId = await failedMessage(db);
      const refundId = (await db.query(`insert into public.refunds (payment_id, booking_id, amount_fils, reason)
        values ($1,$2,100,'Test refund') returning id`, [payments[0], bookings[0].bookingId])).rows[0].id;
      const facts: Omit<AlertScan, "now"> = { thresholds, bookings,
        holds: [{ occupancyId: holdId, expiresAt: at(thresholds.holdExpiryWarningMinutes) }],
        cleaning: [{ cleaningTaskId: cleaningId, suiteId: suites[0].id, dueFrom: at(-thresholds.cleaningConfirmMinutes), confirmedAt: null }],
        messages: [{ messageId, bookingId: null, failedAt: now }],
        refunds: [{ refundId, bookingId: bookings[0].bookingId, isPending: true }],
        conflicts: [{ occupancyId: conflictId, suiteId: suites[1].id, bookingId: null, cause: "maintenance", startsAt: now }],
      };
      const ids = [holdId, conflictId, cleaningId, messageId, refundId, ...bookings.map((b) => b.bookingId)];
      for (const clock of [new Date(now.getTime() - 1), now, at(thresholds.holdExpiryWarningMinutes)]) {
        const actual = (await db.query(`select kind, severity, entity, entity_id as "entityId"
          from internal.detect_operational_alerts($1) where entity_id = any($2::text[])`, [clock, ids])).rows;
        const expected = scanForAlerts({ ...facts, now: clock });
        expect(actual).toHaveLength(expected.length);
        expect(actual).toEqual(expect.arrayContaining([...expected]));
        if (clock === now) expect(new Set(actual.map((a) => a.kind)).size).toBe(ALERT_KINDS.filter((kind) => !["hold_expiring", "checkin_overdue", "cleaning_unconfirmed"].includes(kind)).length);
      }
    });
  });
});
