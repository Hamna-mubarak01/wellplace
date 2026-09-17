import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { Client } from "pg";
import { TERMS_ACCEPTANCE } from "@/lib/config/consent";
import { claimDatabase, harnessIsUp, releaseDatabase, withClient } from "./support/harness";

let up = false;
beforeAll(async () => { up = await harnessIsUp(); if (up) await claimDatabase(); });
afterAll(async () => { if (up) await releaseDatabase(); });

async function fixture(db: Client) {
  const staff = randomUUID();
  await db.query("insert into public.staff(id,email,full_name,role,is_active) values($1,$2,'Booking Reception','reception',true)", [staff, `${staff}@example.test`]);
  const suites = (await db.query("select id from public.suites order by suite_number limit 2")).rows.map((row) => row.id as string);
  await db.query("update public.suites set status='available',is_active=true where id=any($1::uuid[])", [suites]);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [staff]);
  const settings = Object.fromEntries((await db.query("select key,value from public.settings where key=any($1::text[])", [["booking.durations_hours", "cleaning.buffer_minutes", "booking.guests_min"]])).rows.map((row) => [row.key, row.value]));
  return { staff, suites, settings };
}

async function create(db: Client, settings: Record<string, unknown>, suite: string, email: string, customer: string | null = null, acceptance = true, startsAt = "2049-04-01T06:00:00Z") {
  return (await db.query(
    `select * from public.create_reception_booking_selected(
      'complimentary','ms','Selected','Guest',$1,'1990-01-01','+971500000002','AE',
      $2,$3,$4,$5,array[]::int[],'[]',null,null,
      '{"subtotal_fils":0,"discount_fils":0,"addons_fils":0,"service_fee_fils":0,"tax_fils":0,"total_fils":0}',
      true,$6,'Guest requested this suite',$7,$8)`,
    [email, startsAt, (settings["booking.durations_hours"] as number[])[0], settings["cleaning.buffer_minutes"], settings["booking.guests_min"],
      JSON.stringify(acceptance ? TERMS_ACCEPTANCE.documents.map((slug) => ({ document_slug: slug, document_version: TERMS_ACCEPTANCE.version, checkbox_text: TERMS_ACCEPTANCE.text })) : []), customer, suite],
  )).rows[0];
}

it("[CLIENT, §7.2, §9.2] exact suite selection, rebooking and conflicts remain atomic", async (ctx) => {
  if (!up) return ctx.skip();
  await withClient(async (db) => {
    await db.query("begin");
    try {
      const { suites, settings } = await fixture(db);
      const email = `${randomUUID()}@example.test`;
      await db.query("set local role authenticated");
      const first = await create(db, settings, suites[1], email);
      expect(first.suite_id).toBe(suites[1]);
      const customers = (await db.query("select * from public.reception_customers($1)", [email])).rows;
      expect(customers).toHaveLength(1);
      const choices = (await db.query("select * from public.reception_booking_suites($1,$2)", ["2049-04-01T06:00:00Z", (settings["booking.durations_hours"] as number[])[0]])).rows;
      expect(choices.find((row) => row.id === suites[1]).available).toBe(false);
      expect(choices.find((row) => row.id === suites[0]).available).toBe(true);
      const visitEnd = new Date(Date.parse("2049-04-01T06:00:00Z") + (settings["booking.durations_hours"] as number[])[0] * 3_600_000);
      const cleaningEnd = new Date(visitEnd.getTime() + Number(settings["cleaning.buffer_minutes"]) * 60_000);
      const duringCleaning = (await db.query("select * from public.reception_booking_suites($1,$2)", [visitEnd.toISOString(), (settings["booking.durations_hours"] as number[])[0]])).rows;
      expect(duringCleaning.find((row) => row.id === suites[1]).available).toBe(Number(settings["cleaning.buffer_minutes"]) === 0);
      const afterCleaning = (await db.query("select * from public.reception_booking_suites($1,$2)", [cleaningEnd.toISOString(), (settings["booking.durations_hours"] as number[])[0]])).rows;
      expect(afterCleaning.find((row) => row.id === suites[1]).available).toBe(true);
      const conflictEmail = `${randomUUID()}@example.test`;
      await db.query("savepoint conflict");
      await expect(create(db, settings, suites[1], conflictEmail)).rejects.toMatchObject({ code: "WP010" });
      await db.query("rollback to savepoint conflict");
      expect((await db.query("select * from public.reception_customers($1)", [conflictEmail])).rows).toHaveLength(0);
      const again = await create(db, settings, suites[0], email, customers[0].id, true, "2049-04-02T06:00:00Z");
      expect(again.booking_id).not.toBe(first.booking_id);
      expect((await db.query("select * from public.reception_customers($1)", [email])).rows).toHaveLength(1);
      const events = (await db.query("select * from public.reception_booking_audit($1)", [again.booking_id])).rows;
      expect(events.some((event) => event.action === "create_reception_booking" && event.reason === "Guest requested this suite" && event.actor_name === "Booking Reception")).toBe(true);
      await db.query("savepoint wrong_customer");
      await expect(create(db, settings, suites[0], email, randomUUID(), true, "2049-04-03T06:00:00Z")).rejects.toMatchObject({ code: "WP062" });
      await db.query("rollback to savepoint wrong_customer");
      await db.query("savepoint terms");
      await expect(create(db, settings, suites[0], email, customers[0].id, false, "2049-04-03T06:00:00Z")).rejects.toMatchObject({ code: "WP063" });
      await db.query("rollback to savepoint terms");
      await db.query("reset role");
      await db.query("savepoint profile");
      await db.query("update public.customers set first_name='Corrected' where id=$1", [customers[0].id]);
      await expect(create(db, settings, suites[0], email, customers[0].id, true, "2049-04-03T06:00:00Z")).rejects.toMatchObject({ code: "WP062" });
      await db.query("rollback to savepoint profile");
      await db.query("update public.suites set status='maintenance' where id=$1", [suites[0]]);
      await db.query("savepoint maintenance");
      await expect(create(db, settings, suites[0], email, customers[0].id, true, "2049-04-03T06:00:00Z")).rejects.toMatchObject({ code: "WP010" });
      await db.query("rollback to savepoint maintenance");
    } finally { await db.query("rollback"); }
  });
});

it("[CLIENT, §9.2, §10.6] audit dialogs include customer reasons but exclude other bookings and raw payloads", async (ctx) => {
  if (!up) return ctx.skip();
  await withClient(async (db) => {
    await db.query("begin");
    try {
      const { staff, suites, settings } = await fixture(db);
      const email = `${randomUUID()}@example.test`;
      const first = await create(db, settings, suites[0], email);
      const customer = (await db.query("select customer_id from public.bookings where id=$1", [first.booking_id])).rows[0].customer_id;
      await db.query("insert into audit.entries(actor_id,action,entity,entity_id,reason,new_value) values($1,'update_booking_details','public.bookings',$2,'Guest requested a birthday visit','{\"internal_note\":\"private payload\"}'),($1,'set_customer_warning','public.customers',$3,'Guest asked us to record this','{}'),($1,'move_booking','public.bookings',$4,'Another visit','{}')", [staff, first.booking_id, customer, randomUUID()]);
      await db.query("set local role authenticated");
      const events = (await db.query("select * from public.reception_booking_audit($1)", [first.booking_id])).rows;
      expect(events.map((event) => event.reason)).toContain("Guest requested a birthday visit");
      expect(events.map((event) => event.reason)).toContain("Guest asked us to record this");
      expect(events.map((event) => event.reason)).not.toContain("Another visit");
      expect(Object.keys(events[0]).sort()).toEqual(["action", "actor_name", "event_id", "occurred_at", "reason"]);
      await db.query("reset role");
      await db.query("update public.staff set is_active=false where id=$1", [staff]);
      for (const sql of ["select * from public.reception_customers('')", "select * from public.reception_booking_suites('2049-04-01T06:00:00Z',2)", `select * from public.reception_booking_audit('${first.booking_id}')`]) {
        await db.query("savepoint inactive");
        await expect(db.query(sql)).rejects.toMatchObject({ code: "42501" });
        await db.query("rollback to savepoint inactive");
      }
      for (const signature of ["reception_customers(text,uuid)", "reception_booking_suites(timestamptz,integer)", "reception_booking_audit(uuid)"]) {
        expect((await db.query("select has_function_privilege('anon',$1,'execute') allowed", [`public.${signature}`])).rows[0].allowed).toBe(false);
      }
      await db.query("update public.staff set is_active=true,role='management' where id=$1", [staff]);
      await db.query("savepoint manager");
      await expect(db.query("select * from public.reception_customers('')")).rejects.toMatchObject({ code: "WP057" });
      await db.query("rollback to savepoint manager");
      expect((await db.query("select * from public.reception_booking_suites('2049-04-01T06:00:00Z',2)")).rows.length).toBeGreaterThan(0);
      expect((await db.query(`select * from public.reception_booking_audit('${first.booking_id}')`)).rows.map((event) => event.reason)).toContain("Guest requested a birthday visit");
    } finally { await db.query("rollback"); }
  });
});
