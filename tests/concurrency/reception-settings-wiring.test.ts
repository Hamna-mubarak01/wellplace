import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { claimDatabase, harnessIsUp, releaseDatabase, withClient } from "./support/harness";
import { requireSetting, snapshotFromRows } from "@/lib/config";
import { WEEKDAY_KEYS } from "@/lib/config/opening-hours";
import { dayWindow } from "@/lib/services/board-service";
import { guestBookingRefusal } from "@/lib/services/guest-booking-rules";

let up = false;
beforeAll(async () => { up = await harnessIsUp(); if (up) await claimDatabase(); });
afterAll(async () => { if (up) await releaseDatabase(); });

it("[CLIENT, §10.2] saved durations and hours reach Reception and customer booking rules", async (ctx) => {
  if (!up) return ctx.skip();
  await withClient(async (db) => {
    await db.query("begin");
    try {
      const manager = randomUUID();
      await db.query("insert into public.staff(id,email,full_name,role,is_active) values($1,'reception-settings@example.test','Settings Test','management',true)", [manager]);
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [manager]);
      for (const durations of [[2, 4, 6], [3, 5]]) {
        const opens = durations[0] === 2 ? "10:00" : "09:00";
        const updates = {
          "booking.durations_hours": durations,
          "hours.regular": Object.fromEntries(WEEKDAY_KEYS.map((day) => [day, [{ opens, closes: "22:00" }]])),
          "hours.seasonal": null, "hours.exceptions": null, "hours.closures": null,
        };
        const stored = (await db.query("select key,value from public.settings where key=any($1::text[])", [Object.keys(updates)])).rows;
        await db.query("select * from public.set_settings_group($1,'Reception settings wiring verification')", [JSON.stringify(stored.map((row) => ({ key: row.key, expected: row.value, value: updates[row.key as keyof typeof updates] })))]);
        const staff = snapshotFromRows((await db.query("select key,value from public.settings_snapshot")).rows);
        const guest = snapshotFromRows((await db.query("select key,value from public.public_booking_settings")).rows);
        expect(requireSetting(staff, "booking.durations_hours")).toEqual(durations);
        expect(requireSetting(guest, "booking.durations_hours")).toEqual(durations);
        const date = { year: 2040, month: 4, day: 2 };
        expect(dayWindow(staff, date)).toEqual(dayWindow(guest, date));
        expect(dayWindow(staff, date).window?.start).toBe(new Date(`2040-04-02T${opens}:00+04:00`).toISOString());
        const visit = { startsAt: `2040-04-02T${opens}:00+04:00`, durationHours: durations[0], adults: requireSetting(guest, "booking.guests_min"), childAges: [] };
        expect(guestBookingRefusal(guest, visit, new Date("2040-04-01T04:00:00Z"))).toBeNull();
        expect(guestBookingRefusal(guest, { ...visit, durationHours: durations[0] === 2 ? 3 : 2 }, new Date("2040-04-01T04:00:00Z"))).toContain("no longer offered");
      }
    } finally { await db.query("rollback"); }
  });
});
