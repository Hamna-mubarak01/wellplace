import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { claimDatabase, harnessIsUp, releaseDatabase, withClient } from "./support/harness";
import { NEW_ADDON } from "@/lib/config/catalogue";
let up = false;
beforeAll(async () => { up = await harnessIsUp();if (up) await claimDatabase(); });
afterAll(async () => { if (up) await releaseDatabase(); });
describe("[CLIENT pricing §8] Add-on limits survive the database boundary", () => {
  it("saves eligibility, caps available quantities and rejects an incompatible booking", async (ctx) => {
    if (!up) return ctx.skip();
    await withClient(async (db) => {
      await db.query("begin");
      try {
        const manager = randomUUID(), customer = randomUUID(), booking = randomUUID();
        await db.query("insert into public.staff(id,email,full_name,role,is_active) values($1,$2,'Addon QA','management',true)", [manager,manager+'@example.test']);
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [manager]);
        const value = { ...NEW_ADDON, name: "QA Towel", regular_price_fils: 3000, default_quantity: 3, max_quantity: 5, inventory: 2, is_active: true, eligible_min_guests: 2, eligible_min_hours: 3 };
        const addon = (await db.query("select public.save_catalogue_item('addon',$1,'null') as id", [JSON.stringify(value)])).rows[0].id;
        expect((await db.query("select default_quantity,max_quantity,is_sold_out,eligible_min_hours from public.public_addons where id=$1", [addon])).rows[0]).toEqual({ default_quantity: 2, max_quantity: 2, is_sold_out: false, eligible_min_hours: 3 });
        const suite = (await db.query("select id from public.suites limit 1")).rows[0].id;
        await db.query("insert into public.customers(id,first_name,last_name,email,phone_e164,phone_country) values($1,'Addon','QA',$2,'+971500000001','AE')", [customer,customer+'@example.test']);
        await db.query("insert into public.bookings(id,reference,customer_id,suite_id,source,status,experience_period,cleaning_buffer_minutes) values($1,$2,$3,$4,'manual','confirmed',tstzrange('2026-12-10 10:00+04','2026-12-10 12:00+04','[)'),20)", [booking,'WP-123456-'+booking.replaceAll('-','').slice(0,4).toUpperCase(),customer,suite]);
        await db.query("insert into public.booking_guests(booking_id,kind) values($1,'adult'),($1,'adult')", [booking]);
        const insert = "insert into public.booking_addons(booking_id,addon_id,name_snapshot,unit_price_fils,quantity,regular_price_fils,is_included,is_locked) values($1,$2,'QA Towel',0,$3,3000,true,true)";
        await db.query("savepoint eligibility");
        await expect(db.query(insert,[booking,addon,1])).rejects.toMatchObject({ code: "WP038" });
        await db.query("rollback to savepoint eligibility");
        await db.query("update public.bookings set experience_period=tstzrange('2026-12-10 10:00+04','2026-12-10 13:00+04','[)') where id=$1", [booking]);
        await db.query("savepoint quantity");
        await expect(db.query(insert,[booking,addon,3])).rejects.toMatchObject({ code: "WP037" });
        await db.query("rollback to savepoint quantity");
        await db.query(insert,[booking,addon,2]);
        expect((await db.query("select quantity,is_included from public.booking_addons where booking_id=$1",[booking])).rows[0]).toEqual({quantity:2,is_included:true});
        await db.query("update public.addons set inventory=0 where id=$1",[addon]);
        expect((await db.query("select is_sold_out from public.public_addons where id=$1",[addon])).rows[0].is_sold_out).toBe(true);
      } finally { await db.query("rollback"); }
    });
  });
});
