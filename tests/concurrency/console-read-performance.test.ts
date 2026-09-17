import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { claimDatabase, harnessIsUp, releaseDatabase, withClient } from "./support/harness";

let up = false;
beforeAll(async () => { up = await harnessIsUp(); if (up) await claimDatabase(); });
afterAll(async () => { if (up) await releaseDatabase(); });

it("[§9.1, §10.6] combined schedule preserves rows, summaries and role isolation", async (ctx) => {
  if (!up) return ctx.skip();
  await withClient(async (db) => {
    await db.query("begin");
    try {
      const receptionist = randomUUID(), manager = randomUUID();
      await db.query("insert into public.staff(id,email,full_name,role) values($1,$3,'Reception','reception'),($2,$4,'Management','management')",
        [receptionist, manager, `${receptionist}@example.test`, `${manager}@example.test`]);
      const customer = randomUUID(), booking = randomUUID(), suite = randomUUID(), claim = randomUUID(), block = randomUUID();
      await db.query("insert into public.suites(id,suite_number,status,priority) values($1,999,'available',999)", [suite]);
      await db.query("insert into public.customers(id,first_name,last_name,email,phone_e164,phone_country) values($1,'Read','Guest','read-guest@example.test','+971500000001','AE')", [customer]);
      await db.query("insert into public.bookings(id,reference,customer_id,suite_id,source,status,experience_period,cleaning_buffer_minutes) values($1,$2,$3,$4,'telephone','confirmed','[2040-04-01 06:00Z,2040-04-01 08:00Z)',20)", [booking, `WP-${booking.slice(0, 8).toUpperCase()}`, customer, suite]);
      await db.query("insert into public.booking_guests(booking_id,kind) values($1,'adult'),($1,'adult')", [booking]);
      await db.query("insert into public.suite_occupancy(id,suite_id,kind,experience_period,blocked_period,booking_id,cleaning_buffer_minutes,reason) values($1,$2,'booking','[2040-04-01 06:00Z,2040-04-01 08:00Z)','[2040-04-01 06:00Z,2040-04-01 08:20Z)',$3,20,null),($4,$2,'block','[2040-04-02 06:00Z,2040-04-02 08:00Z)','[2040-04-02 06:00Z,2040-04-02 08:00Z)',null,0,'Maintenance review')", [claim, suite, booking, block]);
      for (const actor of [receptionist, manager]) {
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
        await db.query("set local role authenticated");
        const rows = (await db.query("select * from public.reception_schedule where suite_id=$1 order by experience_from", [suite])).rows;
        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({ booking_id: booking, guest_email: "read-guest@example.test", adults: 2, children: 0, details_unavailable: false });
        expect(rows[1]).toMatchObject({ kind: "block", booking_id: null, guest_email: null, details_unavailable: false });
        if (actor === receptionist) {
          expect((await db.query("select id from public.staff")).rows).toEqual([{ id: receptionist }]);
        }
        await db.query("reset role");
      }
      await db.query("update public.staff set is_active=false where id=$1", [receptionist]);
      for (const actor of [receptionist, randomUUID()]) {
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
        await db.query("set local role authenticated");
        expect((await db.query("select * from public.reception_schedule")).rows).toHaveLength(0);
        expect((await db.query("select * from public.settings_snapshot")).rows).toHaveLength(0);
        await db.query("reset role");
      }
      expect((await db.query("select has_table_privilege('anon','public.reception_schedule','select') allowed")).rows[0].allowed).toBe(false);
    } finally { await db.query("rollback"); }
  });
});
