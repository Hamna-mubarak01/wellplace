import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { claimDatabase, harnessIsUp, releaseDatabase, withClient } from "./support/harness";

let up = false;
const MANAGER = "aaa80000-0000-4000-8000-000000000001";
const RECEPTION = "aaa80000-0000-4000-8000-000000000002";
const VISIT = "2040-02-01T16:00:00+04:00";
beforeAll(async () => { up = await harnessIsUp(); if (up) await claimDatabase(); });
afterAll(async () => { if (up) await releaseDatabase(); });

async function asRole(db: Client, role: "management" | "reception") {
  await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.email',$2,true)",
    [role === "management" ? MANAGER : RECEPTION, `${role}.inventory@example.test`]);
}
async function fixture(run: (db: Client, suites: string[]) => Promise<void>) {
  await withClient(async (db) => {
    await db.query("begin");
    try {
      await db.query(`insert into public.staff (id,email,full_name,role,is_active) values
        ($1,'management.inventory@example.test','Inventory Manager','management',true),
        ($2,'reception.inventory@example.test','Inventory Reception','reception',true)`, [MANAGER, RECEPTION]);
      await asRole(db, "management");
      await db.query("update public.settings set value='\"rotation\"'::jsonb where key='allocation.strategy'");
      await db.query("update public.suites set status = 'out_of_service'");
      const suites = [randomUUID(), randomUUID(), randomUUID()];
      for (const [i, id] of suites.entries()) await db.query("select * from public.save_suite_setup($1,$2,$3,true,'Inventory test',0,null)", [id, 8801 + i, `Test suite ${i}`]);
      await asRole(db, "reception");
      await run(db, suites);
    } finally { await db.query("rollback"); }
  });
}
async function hold(db: Client, start = VISIT) {
  return (await db.query("select * from public.hold_suite($1,2,20,15)", [start])).rows[0];
}
async function booking(db: Client, suite: string, status = "confirmed", start = "2040-02-01T10:00:00+04:00") {
  const customer = (await db.query(`insert into public.customers(first_name,last_name,email,phone_e164,phone_country)
    values('Inventory','Test',$1,'+971500000001','AE') returning id`, [`${randomUUID()}@example.test`])).rows[0].id;
  return (await db.query(`insert into public.bookings(reference,customer_id,suite_id,source,status,experience_period,cleaning_buffer_minutes)
    values($1,$2,$3,'walk_in',$4,tstzrange($5::timestamptz,$5::timestamptz+interval '2 hours','[)'),20) returning id`,
  [`TEST-${randomUUID().slice(0,8).toUpperCase()}`, customer, suite, status, start])).rows[0].id;
}

describe("[CLIENT] suite setup and least-booked allocation", () => {
  it("[§7.2] honours fixed priority and optional least-recent allocation", async (ctx) => {
    if (!up) return ctx.skip();
    await fixture(async (db, suites) => {
      await booking(db, suites[0]);
      await db.query("update public.suites set priority=case when id=$1 then 0 else 10 end", [suites[0]]);
      await db.query("update public.settings set value='\"fixed_priority\"'::jsonb where key='allocation.strategy'");
      expect((await hold(db)).suite_id).toBe(suites[0]);
      await db.query("update public.settings set value='\"lru\"'::jsonb where key='allocation.strategy'");
      expect((await hold(db, "2040-02-01T20:00:00+04:00")).suite_id).toBe(suites[1]);
    });
  });
  it("[§10.3] saves configuration, priority and notes together and rejects invalid changes", async (ctx) => {
    if (!up) return ctx.skip();
    await fixture(async (db, suites) => {
      await asRole(db, "management");
      await db.query("select * from public.save_suite_setup($1,8801,'Garden',false,'Management setup',4,'Door inspection')", [suites[0]]);
      expect((await db.query("select display_name,priority,internal_note from public.management_suite_inventory where id=$1", [suites[0]])).rows[0])
        .toEqual({display_name:"Garden",priority:4,internal_note:"Door inspection"});
      await db.query("savepoint invalid_configuration");
      await expect(db.query("select * from public.save_suite_setup($1,8801,'Changed',false,'Invalid setup',-1,'Changed')", [suites[0]])).rejects.toMatchObject({code:"WP058"});
      await db.query("rollback to savepoint invalid_configuration");
      expect((await db.query("select display_name,is_active,priority,internal_note from public.management_suite_inventory where id=$1", [suites[0]])).rows[0])
        .toEqual({display_name:"Garden",is_active:true,priority:4,internal_note:"Door inspection"});
    });
  });
  it("offers the least booked suite even when busier suites are free at the requested time", async (ctx) => {
    if (!up) return ctx.skip();
    await fixture(async (db, suites) => {
      await booking(db, suites[0]); await booking(db, suites[1]);
      await db.query("update public.suites set priority = 99999 where id = $1", [suites[2]]);
      expect((await hold(db)).suite_id).toBe(suites[2]);
    });
  });
  it("counts completed morning bookings but ignores cancellations and other dates", async (ctx) => {
    if (!up) return ctx.skip();
    await fixture(async (db, suites) => {
      await booking(db, suites[0], "completed");
      await booking(db, suites[1], "cancelled");
      await booking(db, suites[1], "confirmed", "2040-02-02T10:00:00+04:00");
      expect(Number((await db.query("select internal.suite_allocation_load($1,$2) as n", [suites[0], VISIT])).rows[0].n)).toBe(1);
      expect(Number((await db.query("select internal.suite_allocation_load($1,$2) as n", [suites[1], VISIT])).rows[0].n)).toBe(0);
      expect((await hold(db)).suite_id).toBe(suites[1]);
    });
  });
  it("balances live holds for different time slots and rotates equal loads", async (ctx) => {
    if (!up) return ctx.skip();
    await fixture(async (db, suites) => {
      const first = await hold(db, "2040-02-01T06:00:00+04:00");
      const second = await hold(db, "2040-02-01T10:00:00+04:00");
      const third = await hold(db, VISIT);
      expect([first.suite_id, second.suite_id, third.suite_id]).toEqual(suites);
      await db.query("update public.suite_occupancy set expires_at = now()-interval '1 minute' where id = any($1::uuid[])", [[first.occupancy_id,second.occupancy_id,third.occupancy_id]]);
      expect((await hold(db)).suite_id).toBe(suites[0]);
    });
  });
  it("skips unavailable suites and still prevents overlap when load is lowest", async (ctx) => {
    if (!up) return ctx.skip();
    await fixture(async (db, suites) => {
      await db.query("select public.set_suite_status($1,'maintenance','Repair')", [suites[0]]);
      expect((await hold(db)).suite_id).toBe(suites[1]);
      expect((await hold(db)).suite_id).toBe(suites[2]);
      expect(await hold(db)).toBeUndefined();
    });
  });
  it("adds more than seven suites, retries creates safely, and preserves bookings and unavailability when editing an out-of-service suite", async (ctx) => {
    if (!up) return ctx.skip();
    await fixture(async (db, suites) => {
      const id = await booking(db, suites[0]);
      await asRole(db, "management");
      expect((await db.query("select count(*)::int as n from public.management_suite_inventory")).rows[0].n).toBeGreaterThan(7);
      await db.query("select * from public.save_suite_setup($1,8801,'Test suite 0',true,'Retry test',0,null)", [suites[0]]);
      expect((await db.query("select count(*)::int as n from audit.entries where action='create_suite' and entity_id=$1", [suites[0]])).rows[0].n).toBe(1);
      await db.query("select public.set_suite_status($1,'out_of_service','Closed for repairs')", [suites[0]]);
      await db.query("select * from public.save_suite_setup($1,8801,'Garden',false,'Setup change',0,null)", [suites[0]]);
      expect((await db.query("select status,suite_id from public.bookings where id=$1", [id])).rows[0]).toEqual({ status: "confirmed", suite_id: suites[0] });
      expect((await db.query("select display_name,is_active,status from public.management_suite_inventory where id=$1", [suites[0]])).rows[0]).toEqual({ display_name: "Garden", is_active: true, status: "out_of_service" });
      await asRole(db, "reception");
      expect((await hold(db)).suite_id).toBe(suites[1]);
    });
  });
  it("[OUR CHOICE] exposes setup without a booking toggle and status alone reopens a suite", async (ctx) => {
    if (!up) return ctx.skip();
    await fixture(async (db, suites) => {
      const grants = (await db.query(`select
        has_function_privilege('authenticated','public.save_suite_setup(uuid,integer,text,boolean,text,integer,text)','execute') as setup,
        has_function_privilege('authenticated','public.configure_suite(uuid,integer,text,boolean,boolean,text,integer,text)','execute') as legacy,
        has_function_privilege('service_role','public.save_suite_configuration(uuid,integer,text,boolean,boolean,text)','execute') as toggle`)).rows[0];
      expect(grants).toEqual({setup:true,legacy:false,toggle:false});
      expect((await db.query("select is_active,status from public.suites where id=$1", [suites[0]])).rows[0]).toEqual({is_active:true,status:"available"});
      await db.query("update public.suites set status='out_of_service'");
      expect(await hold(db)).toBeUndefined();
      await asRole(db, "management");
      await db.query("select public.set_suite_status($1,'available','Ready for guests')", [suites[0]]);
      expect((await hold(db)).suite_id).toBe(suites[0]);
    });
  });
  it("refuses duplicate suite numbers and Reception attempts to add suites", async (ctx) => {
    if (!up) return ctx.skip();
    await fixture(async (db) => {
      await db.query("savepoint refused");
      await expect(db.query("select * from public.save_suite_setup($1,8888,'Unauthorized',true,'Test',0,null)", [randomUUID()])).rejects.toMatchObject({ code: "42501" });
      await db.query("rollback to savepoint refused");
      await asRole(db, "management");
      await db.query("savepoint duplicate");
      await expect(db.query("select * from public.save_suite_setup($1,8801,'Duplicate',true,'Test',0,null)", [randomUUID()])).rejects.toMatchObject({ code: "WP059" });
      await db.query("rollback to savepoint duplicate");
    });
  });
  it("keeps the normal booking, cancellation and reallocation lifecycle for a newly added suite", async (ctx) => {
    if (!up) return ctx.skip();
    await fixture(async (db, suites) => {
      await db.query("update public.suites set status = case when id = $1 then 'available'::public.suite_status else 'out_of_service'::public.suite_status end", [suites[2]]);
      const price = JSON.stringify({subtotal_fils:10000,discount_fils:0,addons_fils:0,service_fee_fils:0,tax_fils:0,total_fils:10000});
      const created = (await db.query(`select * from public.create_reception_booking(
        'walk_in','ms','New','Suite','new.suite@example.test',date '1990-01-01','+971500000010','AE',
        $1::timestamptz,2,20,2,array[]::integer[],'[]'::jsonb,null,null,$2::jsonb,false,'[]'::jsonb,'New suite test')`, [VISIT,price])).rows[0];
      expect(created.suite_id).toBe(suites[2]);
      await db.query("select * from public.cancel_booking($1,'Guest cancelled')", [created.booking_id]);
      expect((await hold(db)).suite_id).toBe(suites[2]);
    });
  });
});
