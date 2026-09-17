import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { claimDatabase, harnessIsUp, releaseDatabase, withClient } from "./support/harness";
let up = false;
beforeAll(async () => { up = await harnessIsUp(); if (up) await claimDatabase(); });
afterAll(async () => { if (up) await releaseDatabase(); });

it("[CLIENT, §9.2, §10.6] booking history is isolated to one booking and active staff", async (ctx) => {
  if (!up) return ctx.skip();
  await withClient(async (db) => {
    await db.query("begin");
    try {
      const staff = randomUUID(), manager = randomUUID(), customer = randomUUID(), booking = randomUUID();
      await db.query("insert into public.staff(id,email,full_name,role,is_active) values($1,'history-reception@example.test','Reception Test','reception',true),($2,'history-manager@example.test','Manager Test','management',true)", [staff, manager]);
      await db.query("insert into public.customers(id,first_name,last_name,email,phone_e164,phone_country) values($1,'History','Guest','history-guest@example.test','+971500000001','AE')", [customer]);
      await db.query("insert into public.bookings(id,reference,customer_id,source,status,experience_period,cleaning_buffer_minutes) values($1,'WP-HISTORY-TEST',$2,'telephone','confirmed','[2040-04-01 06:00Z,2040-04-01 08:00Z)',20)", [booking, customer]);
      await db.query("insert into audit.entries(actor_id,action,entity,entity_id,new_value) values($1,'record_arrival','public.bookings',$2,'{\"status\":\"confirmed\",\"internal_note\":\"private note\"}'),($1,'set_manual_booking_price','public.bookings',$2,'{\"total_fils\":999}'),($1,'record_arrival','public.bookings',$3,'{}')", [staff, booking, randomUUID()]);
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [staff]);
      await db.query("set local role authenticated");
      const result = (await db.query("select * from public.reception_booking_activity($1)", [booking])).rows;
      expect(result).toHaveLength(1);
      expect(result[0].action).toBe("record_arrival");
      expect(result[0].actor_name).toBe("Reception Test");
      expect(Object.keys(result[0]).sort()).toEqual(["action", "actor_name", "event_id", "occurred_at", "status"]);
      await db.query("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [manager]);
      expect((await db.query("select * from public.reception_booking_activity($1)", [booking])).rows.map((row) => row.action)).toEqual(["record_arrival"]);
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [randomUUID()]);
      await db.query("savepoint refusal");
      await expect(db.query("select * from public.reception_booking_activity($1)", [booking])).rejects.toMatchObject({ code: "42501" });
      await db.query("rollback to savepoint refusal");
      expect((await db.query("select has_function_privilege('anon','public.reception_booking_activity(uuid)','execute') allowed")).rows[0].allowed).toBe(false);
    } finally { await db.query("rollback"); }
  });
});

it("[CLIENT, §9.2, §10.6] saved change reasons expose only the latest operational reasons for one booking", async (ctx) => {
  if (!up) return ctx.skip();
  await withClient(async (db) => {
    await db.query("begin");
    try {
      const staff = randomUUID(), manager = randomUUID(), customer = randomUUID(), booking = randomUUID();
      await db.query("insert into public.staff(id,email,full_name,role,is_active) values($1,'history-reception@example.test','Reception Test','reception',true),($2,'history-manager@example.test','Manager Test','management',true)", [staff, manager]);
      await db.query("insert into public.customers(id,first_name,last_name,email,phone_e164,phone_country) values($1,'History','Guest','history-guest@example.test','+971500000001','AE')", [customer]);
      await db.query("insert into public.bookings(id,reference,customer_id,source,status,experience_period,cleaning_buffer_minutes) values($1,'WP-HISTORY-TEST',$2,'telephone','confirmed','[2040-04-01 06:00Z,2040-04-01 08:00Z)',20)", [booking, customer]);
      await db.query("insert into audit.entries(actor_id,action,entity,entity_id,reason) values($1,'move_booking','public.bookings',$2,'First move'),($1,'move_booking','public.bookings',$2,'Guest requested a quieter suite'),($1,'extend_booking','public.bookings',$2,'Guest requested more time'),($1,'reschedule_booking','public.bookings',$2,'Later arrival'),($1,'set_manual_booking_price','public.bookings',$2,'Private pricing reason'),($1,'move_booking','public.bookings',$3,'Other booking')", [staff, booking, randomUUID()]);
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [staff]);
      await db.query("set local role authenticated");
      const result = (await db.query("select * from public.reception_booking_change_reasons($1)", [booking])).rows;
      expect(result).toHaveLength(3);
      expect(result.map((row) => row.reason).sort()).toEqual(["Guest requested a quieter suite", "Guest requested more time", "Later arrival"]);
      expect(result[0].actor_name).toBe("Reception Test");
      expect(Object.keys(result[0]).sort()).toEqual(["action", "actor_name", "event_id", "occurred_at", "reason"]);
      await db.query("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [manager]);
      expect((await db.query("select * from public.reception_booking_change_reasons($1)", [booking])).rows).toHaveLength(3);
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [randomUUID()]);
      await db.query("savepoint refusal");
      await expect(db.query("select * from public.reception_booking_change_reasons($1)", [booking])).rejects.toMatchObject({ code: "42501" });
      await db.query("rollback to savepoint refusal");
      await db.query("update public.staff set is_active = false where id = $1", [staff]);
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [staff]);
      await db.query("savepoint inactive");
      await expect(db.query("select * from public.reception_booking_change_reasons($1)", [booking])).rejects.toMatchObject({ code: "42501" });
      await db.query("rollback to savepoint inactive");
      expect((await db.query("select has_function_privilege('anon','public.reception_booking_change_reasons(uuid)','execute') allowed")).rows[0].allowed).toBe(false);
    } finally { await db.query("rollback"); }
  });
});
