import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { Client } from "pg";
import { DUBAI_TIME_ZONE } from "@/lib/domain/time";
import {
  claimDatabase,
  harnessIsUp,
  releaseDatabase,
  withClient,
} from "./support/harness";
let up = false;
beforeAll(async () => {
  up = await harnessIsUp();
  if (up) await claimDatabase();
});
afterAll(async () => {
  if (up) await releaseDatabase();
});
const OVERDUE_VISIT_STARTED_MINUTES_AGO = 150;
const EXTENDED_CLEANING_ENDS_MINUTES_AHEAD = 15;
const ALL_DAY_CLOSES_AT_MINUTE = 23 * 60 + 59;

function dubaiMinuteOfDay(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DUBAI_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value ?? 0);
  return part("hour") * 60 + part("minute");
}

function overdueScenarioFitsOneDubaiDay(at: Date): boolean {
  const minute = dubaiMinuteOfDay(at);
  return (
    minute >= OVERDUE_VISIT_STARTED_MINUTES_AGO &&
    minute + EXTENDED_CLEANING_ENDS_MINUTES_AHEAD <= ALL_DAY_CLOSES_AT_MINUTE
  );
}

async function fixture(db: Client) {
  const actor = randomUUID(),
    customer = randomUUID(),
    suite = randomUUID(),
    booking = randomUUID(),
    claim = randomUUID();
  const week = Object.fromEntries(
    ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((day) => [
      day,
      [{ opens: "10:00", closes: "22:00" }],
    ]),
  );
  await db.query(
    "update public.settings set value=$1 where key='hours.regular'",
    [week],
  );
  await db.query(
    "update public.settings set value='null'::jsonb where key in ('hours.seasonal','hours.exceptions','hours.closures')",
  );
  await db.query(
    "insert into public.staff(id,email,full_name,role) values($1,$2,'Buffer Reception','reception')",
    [actor, `${actor}@example.test`],
  );
  await db.query(
    "insert into public.customers(id,first_name,last_name,email,phone_e164,phone_country) values($1,'Buffer','Guest',$2,'+971500000001','AE')",
    [customer, `${customer}@example.test`],
  );
  await db.query(
    "insert into public.suites(id,suite_number,status,priority) values($1,(select max(suite_number)+1 from public.suites),'cleaning',998)",
    [suite],
  );
  await db.query(
    "insert into public.bookings(id,reference,customer_id,suite_id,source,status,experience_period,cleaning_buffer_minutes) values($1,$2,$3,$4,'manual','completed','[2040-04-01 08:00Z,2040-04-01 10:00Z)',20)",
    [booking, `WP-${booking.slice(0, 8).toUpperCase()}`, customer, suite],
  );
  await db.query(
    "insert into public.suite_occupancy(id,suite_id,kind,experience_period,blocked_period,booking_id,cleaning_buffer_minutes) values($1,$2,'booking','[2040-04-01 08:00Z,2040-04-01 10:00Z)','[2040-04-01 08:00Z,2040-04-01 10:20Z)',$3,20)",
    [claim, suite, booking],
  );
  await db.query("update public.bookings set occupancy_id=$2 where id=$1", [
    booking,
    claim,
  ]);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
  const options = async () =>
    (
      await db.query("select public.booking_buffer_options($1) as value", [
        booking,
      ])
    ).rows[0].value;
  const change = (minutes: number, reason = "Cleaning needs more time") =>
    db.query("select * from public.override_booking_buffer($1,$2,$3)", [
      booking,
      minutes,
      reason,
    ]);
  return { actor, suite, booking, claim, options, change };
}
async function transaction(run: (db: Client) => Promise<void>) {
  await withClient(async (db) => {
    await db.query("begin");
    try {
      await run(db);
    } finally {
      await db.query("rollback");
    }
  });
}
async function refuses(db: Client, run: () => Promise<unknown>, code: string) {
  await db.query("savepoint refused_change");
  await expect(run()).rejects.toMatchObject({ code });
  await db.query("rollback to savepoint refused_change");
}
it("[CLIENT buffer instruction] Reception extends beyond four hours to closing, with an audited reason", async (ctx) => {
  if (!up) return ctx.skip();
  await transaction(async (db) => {
    const f = await fixture(db);
    expect(await f.options()).toMatchObject({
      canEdit: true,
      canShorten: true,
      maxMinutes: 480,
      limitKind: "closing",
    });
    await refuses(db, () => f.change(300, ""), "22023");
    expect((await f.change(480)).rows[0].cleaning_buffer_minutes).toBe(480);
    await refuses(db, () => f.change(481), "WP068");
    await refuses(db, () => f.change(-1), "WP006");
    const saved = (
      await db.query(
        "select cleaning_buffer_minutes,upper(blocked_period) as finish from public.suite_occupancy where id=$1",
        [f.claim],
      )
    ).rows[0];
    expect(saved.cleaning_buffer_minutes).toBe(480);
    expect(saved.finish.toISOString()).toBe("2040-04-01T18:00:00.000Z");
    expect(
      (
        await db.query(
          "select count(*)::integer as n from audit.entries where entity_id=$1 and reason='Cleaning needs more time'",
          [f.claim],
        )
      ).rows[0].n,
    ).toBe(1);
  });
});
it("[CLIENT buffer instruction] moving the next reservation frees more cleaning time; exact adjacency is allowed", async (ctx) => {
  if (!up) return ctx.skip();
  await transaction(async (db) => {
    const f = await fixture(db);
    const next = randomUUID();
    await db.query(
      "insert into public.suite_occupancy(id,suite_id,kind,experience_period,blocked_period,cleaning_buffer_minutes,reason) values($1,$2,'block','[2040-04-01 12:00Z,2040-04-01 13:00Z)','[2040-04-01 12:00Z,2040-04-01 13:00Z)',0,'Next reservation')",
      [next, f.suite],
    );
    expect(await f.options()).toMatchObject({
      maxMinutes: 120,
      limitKind: "next_reservation",
    });
    await f.change(120);
    await refuses(db, () => f.change(121), "WP068");
    await db.query(
      "update public.suite_occupancy set experience_period='[2040-04-01 16:00Z,2040-04-01 17:00Z)',blocked_period='[2040-04-01 16:00Z,2040-04-01 17:00Z)' where id=$1",
      [next],
    );
    expect(await f.options()).toMatchObject({ maxMinutes: 360 });
    await f.change(360);
  });
});
it("[§7.1; CLIENT buffer instruction; Project owner's direction 17 September 2026] Reception shortens a buffer because the suite override is fixed to its role", async (ctx) => {
  if (!up) return ctx.skip();
  await transaction(async (db) => {
    const f = await fixture(db);
    await f.change(30);
    await f.change(20);
    await f.change(10);
    expect(await f.options()).toMatchObject({
      currentMinutes: 10,
      canShorten: true,
    });
  });
});
it("[§7.3; CLIENT buffer instruction] expired holds do not reduce available cleaning time", async (ctx) => {
  if (!up) return ctx.skip();
  await transaction(async (db) => {
    const f = await fixture(db);
    await db.query(
      "insert into public.suite_occupancy(suite_id,kind,experience_period,blocked_period,cleaning_buffer_minutes,expires_at) values($1,'hold','[2040-04-01 12:00Z,2040-04-01 13:00Z)','[2040-04-01 12:00Z,2040-04-01 13:00Z)',0,now()-interval '1 second')",
      [f.suite],
    );
    expect(await f.options()).toMatchObject({ maxMinutes: 480 });
    await f.change(480);
  });
});
it("[§10.2; CLIENT buffer instruction] exceptions and full closures override the regular closing time", async (ctx) => {
  if (!up) return ctx.skip();
  await transaction(async (db) => {
    const f = await fixture(db);
    await db.query(
      "update public.settings set value=$1 where key='hours.exceptions'",
      [
        JSON.stringify([
          {
            date: "2040-04-01",
            windows: [{ opens: "10:00", closes: "18:00" }],
          },
        ]),
      ],
    );
    expect(await f.options()).toMatchObject({ maxMinutes: 240 });
    await refuses(db, () => f.change(241), "WP068");
    await db.query(
      "update public.settings set value=$1 where key='hours.closures'",
      [JSON.stringify([{ from: "2040-04-01", to: "2040-04-01" }])],
    );
    expect(await f.options()).toMatchObject({ canEdit: false, maxMinutes: 0 });
    await refuses(db, () => f.change(60), "WP069");
  });
});
it("[CLIENT buffer instruction] overdue completed cleaning can be extended until release", async (ctx) => {
  if (!up || !overdueScenarioFitsOneDubaiDay(new Date())) return ctx.skip();
  await transaction(async (db) => {
    const f = await fixture(db);
    const week = Object.fromEntries(
      ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((day) => [
        day,
        [{ opens: "00:00", closes: "23:59" }],
      ]),
    );
    await db.query(
      "update public.settings set value=$1 where key='hours.regular'",
      [week],
    );
    await db.query(
      "update public.bookings set experience_period=tstzrange(now()-interval '2 hours 30 minutes',now()-interval '30 minutes','[)') where id=$1",
      [f.booking],
    );
    await db.query(
      "update public.suite_occupancy set experience_period=tstzrange(now()-interval '2 hours 30 minutes',now()-interval '30 minutes','[)'),blocked_period=tstzrange(now()-interval '2 hours 30 minutes',now()-interval '10 minutes','[)') where id=$1",
      [f.claim],
    );
    expect(await f.options()).toMatchObject({ canEdit: true });
    await refuses(db, () => f.change(25), "WP070");
    await f.change(45);
    await db.query(
      "update public.suite_occupancy set is_active=false,status='released' where id=$1",
      [f.claim],
    );
    await db.query("update public.suites set status='available' where id=$1", [
      f.suite,
    ]);
    expect(await f.options()).toMatchObject({ canEdit: false });
    await refuses(db, () => f.change(60), "WP069");
  });
});
it("[§9.2] anonymous callers cannot read or edit a cleaning buffer", async (ctx) => {
  if (!up) return ctx.skip();
  await transaction(async (db) => {
    const f = await fixture(db);
    await db.query("set local role anon");
    await refuses(db, () => f.options(), "42501");
    await refuses(db, () => f.change(45), "42501");
  });
});
