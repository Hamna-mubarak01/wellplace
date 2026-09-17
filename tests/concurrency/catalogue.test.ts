import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { claimDatabase, harnessIsUp, releaseDatabase, withClient } from "./support/harness";
import { NEW_PRICE, NEW_ADDON } from "@/lib/config/catalogue";

let up = false;
beforeAll(async () => { up = await harnessIsUp(); if (up) await claimDatabase(); });
afterAll(async () => { if (up) await releaseDatabase(); });

describe("[§10.4; CLIENT pricing specification §7–8] Management catalogue", () => {
  it("initializes only an empty catalogue with the approved prices and preserves later edits", async (ctx) => {
    if (!up) return ctx.skip();
    const migration = readFileSync("supabase/migrations/20260910110000_connect_management_catalogue.sql", "utf8");
    const bootstrap = migration.slice(migration.indexOf("do $$"));
    await withClient(async (db) => {
      await db.query("begin");
      try {
        await db.query("delete from public.price_rules");
        await db.query(bootstrap);
        const rates = (await db.query("select code,regular_fils_per_hour,offer_fils_per_hour from public.price_rules order by code")).rows;
        expect(rates).toEqual([
          { code: "adult-additional", regular_fils_per_hour: 22000, offer_fils_per_hour: 14000 },
          { code: "adult-first-two", regular_fils_per_hour: 22000, offer_fils_per_hour: 16500 },
          { code: "child-additional", regular_fils_per_hour: 17000, offer_fils_per_hour: 11000 },
          { code: "child-first-two", regular_fils_per_hour: 17000, offer_fils_per_hour: 12750 },
        ]);
        await db.query("update public.price_rules set offer_fils_per_hour=16000 where code='adult-first-two'");
        await db.query(bootstrap);
        expect((await db.query("select offer_fils_per_hour from public.price_rules where code='adult-first-two'")).rows[0].offer_fils_per_hour).toBe(16000);
        expect((await db.query("select count(*)::integer n from public.price_rules")).rows[0].n).toBe(4);
        expect((await db.query("select count(*)::integer n from public.public_price_rules")).rows[0].n).toBe(4);
      } finally { await db.query("rollback"); }
    });
  });
  it("publishes edited rates, detects stale edits and records an audit trail", async (ctx) => {
    if (!up) return ctx.skip();
    await withClient(async (db) => {
      await db.query("begin");
      try {
        const manager = randomUUID();
        await db.query("insert into public.staff(id,email,full_name,role,is_active) values($1,'catalogue-test@example.test','Catalogue Test','management',true)", [manager]);
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [manager]);
        const input = { ...NEW_PRICE, regular_fils_per_hour: 22000, offer_fils_per_hour: 16500 };
        const id = (await db.query("select public.save_catalogue_item('price',$1,'null') id", [JSON.stringify(input)])).rows[0].id;
        expect((await db.query("select count(*)::integer n from public.public_price_rules where id=$1", [id])).rows[0].n).toBe(0);
        const row = (await db.query("select * from public.management_price_rules where id=$1", [id])).rows[0];
        await db.query("select public.save_catalogue_item('price',$1,$2)", [JSON.stringify({ ...row, is_active: true, offer_fils_per_hour: 15000 }), JSON.stringify(row)]);
        expect((await db.query("select offer_fils_per_hour from public.public_price_rules where id=$1", [id])).rows[0].offer_fils_per_hour).toBe(15000);
        await db.query("savepoint stale_edit");
        await expect(db.query("select public.save_catalogue_item('price',$1,$2)", [JSON.stringify(row), JSON.stringify(row)])).rejects.toMatchObject({ code: "WP060" });
        await db.query("rollback to savepoint stale_edit");
        expect((await db.query("select count(*)::integer n from audit.entries where entity_id=$1", [id])).rows[0].n).toBeGreaterThanOrEqual(2);
      } finally { await db.query("rollback"); }
    });
  });
  it("publishes addon quantity, VAT and sold-out changes to guest and Reception views", async (ctx) => {
    if (!up) return ctx.skip();
    await withClient(async (db) => {
      await db.query("begin");
      try {
        const manager = randomUUID();
        await db.query("insert into public.staff(id,email,full_name,role,is_active) values($1,'addon-test@example.test','Addon Test','management',true)", [manager]);
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [manager]);
        const values = { ...NEW_ADDON, name: "Test rental", regular_price_fils: 2500, offer_price_fils: 0, max_quantity: 3, inventory: 0, is_taxable: false, is_active: true, reception_note: "Prepare one item" };
        const id = (await db.query("select public.save_catalogue_item('addon',$1,'null') id", [JSON.stringify(values)])).rows[0].id;
        const guest = (await db.query("select * from public.public_addons where id=$1", [id])).rows[0];
        expect(guest).toMatchObject({ offer_price_fils: 0, default_quantity: 0, max_quantity: 0, is_sold_out: true, is_taxable: false });
        expect(guest).not.toHaveProperty("reception_note");
        expect((await db.query("select reception_note,is_taxable from public.staff_addons where id=$1", [id])).rows[0]).toEqual({ reception_note: "Prepare one item", is_taxable: false });
        const row = (await db.query("select * from public.management_addons where id=$1", [id])).rows[0];
        expect(row.max_quantity).toBe(3);
        await db.query("select public.save_catalogue_item('addon',$1,$2)", [JSON.stringify({ ...row, is_active: false }), JSON.stringify(row)]);
        expect((await db.query("select count(*)::integer n from public.public_addons where id=$1", [id])).rows[0].n).toBe(0);
      } finally { await db.query("rollback"); }
    });
  });
  it("refuses catalogue writes from Reception and public guests", async (ctx) => {
    if (!up) return ctx.skip();
    await withClient(async (db) => {
      await db.query("begin");
      try {
        const staff = randomUUID();
        await db.query("insert into public.staff(id,email,full_name,role,is_active) values($1,'catalogue-reception@example.test','Reception Test','reception',true)", [staff]);
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [staff]);
        expect((await db.query("select count(*)::integer n from public.management_addons")).rows[0].n).toBe(0);
        expect((await db.query("select count(*)::integer n from public.management_price_rules")).rows[0].n).toBe(0);
        await db.query("savepoint role_check");
        await expect(db.query("select public.save_catalogue_item('price',$1,'null')", [JSON.stringify(NEW_PRICE)])).rejects.toMatchObject({ code: "42501" });
        await db.query("rollback to savepoint role_check");
        await db.query("set local role anon");
        await expect(db.query("select public.save_catalogue_item('price',$1,'null')", [JSON.stringify(NEW_PRICE)])).rejects.toMatchObject({ code: "42501" });
      } finally { await db.query("rollback"); }
    });
  });
});
