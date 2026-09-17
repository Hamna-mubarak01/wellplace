import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { claimDatabase, harnessIsUp, releaseDatabase, resetSuites, withClient } from "./support/harness";
import { GUEST_HOLD_SETTING_KEYS } from "@/lib/config/guest-checkout";
import { SETTINGS_PANELS } from "@/lib/config/settings-panels";
import { SETTINGS } from "@/lib/config/registry";

let up = false;
beforeAll(async () => { up = await harnessIsUp(); if (up) await claimDatabase(); });
afterAll(async () => { if (up) await releaseDatabase(); });

async function expectedSettings() {
  return withClient(async (db) => (await db.query("select jsonb_object_agg(key,value) value from public.settings where key=any($1::text[])", [[...GUEST_HOLD_SETTING_KEYS]])).rows[0].value);
}

describe("[§7.3, §10.2] guest holds and management settings", () => {
  it("limits twenty simultaneous guest attempts to seven allocations", async (ctx) => {
    if (!up) return ctx.skip();
    await resetSuites();
    const tokens = Array.from({ length: 20 }, () => randomUUID());
    const expected = await expectedSettings();
    try {
      const results = await Promise.all(tokens.map((token) => withClient(async (db) => {
        try {
          await db.query("select public.reserve_guest_hold($1,'2040-04-01T10:00:00+04',2,20,10,$2)", [token, expected]);
          return "held";
        } catch (cause) { return cause && typeof cause === "object" && "code" in cause ? cause.code : "unexpected"; }
      })));
      expect(results.filter((value) => value === "held")).toHaveLength(7);
      expect(results.filter((value) => value === "WP061")).toHaveLength(13);
    } finally {
      await withClient(async (db) => { await db.query("delete from internal.guest_checkout_holds where token=any($1::uuid[])", [tokens]); });
      await resetSuites();
    }
  });
  it("replays a checkout token concurrently without duplicating or extending its hold", async (ctx) => {
    if (!up) return ctx.skip();
    await resetSuites();
    const token = randomUUID();
    const expected = await expectedSettings();
    try {
      const results = await Promise.all(Array.from({ length: 20 }, () => withClient(async (db) =>
        (await db.query("select public.reserve_guest_hold($1,'2040-04-01T10:00:00+04',2,20,10,$2) expires_at", [token, expected])).rows[0].expires_at.toISOString())));
      expect(new Set(results).size).toBe(1);
      expect(await withClient(async (db) => (await db.query("select count(*)::integer count from public.suite_occupancy where is_active")).rows[0].count)).toBe(1);
    } finally {
      await withClient(async (db) => { await db.query("delete from internal.guest_checkout_holds where token=$1", [token]); });
      await resetSuites();
    }
  });
  it("saves every visible settings panel through the audited RPC and reads it back", async (ctx) => {
    if (!up) return ctx.skip();
    await withClient(async (db) => {
      await db.query("begin");
      try {
        const manager = randomUUID();
        await db.query("insert into public.staff(id,email,full_name,role,is_active) values($1,'settings-wiring@example.test','Settings Test','management',true)", [manager]);
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [manager]);
        for (const panel of SETTINGS_PANELS) {
          const rows = (await db.query("select key,value from public.settings where key=any($1::text[])", [panel.keys])).rows;
          expect(rows).toHaveLength(panel.keys.length);
          const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
          const changes = panel.keys.map((key) => ({ key, expected: stored[key], value: SETTINGS[key].defaultValue }));
          await db.query("select * from public.set_settings_group($1,'Settings wiring verification')", [JSON.stringify(changes)]);
          const saved = (await db.query("select key,value from public.settings_snapshot where key=any($1::text[])", [panel.keys])).rows;
          for (const row of saved) expect(row.value).toEqual(changes.find((change) => change.key === row.key)?.value);
          const published = (await db.query("select key,value from public.public_booking_settings where key=any($1::text[])", [panel.keys])).rows;
          for (const row of published) expect(row.value).toEqual(changes.find((change) => change.key === row.key)?.value);
        }
      } finally { await db.query("rollback"); }
    });
  });
});
