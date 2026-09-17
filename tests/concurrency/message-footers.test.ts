import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { claimDatabase, harnessIsUp, releaseDatabase, withClient } from "./support/harness";
import { defaultDocument, SYSTEM_MESSAGE_KEYS, MESSAGE_DOCUMENT_LIMITS } from "@/lib/config/message-documents";

let up = false;
beforeAll(async () => { up = await harnessIsUp(); if (up) await claimDatabase(); });
afterAll(async () => { if (up) await releaseDatabase(); });

it("[OUR CHOICE; owner request 12 September 2026] bulk footer changes preserve drafts, publications and delivery, and are audited", async (ctx) => {
  if (!up) return ctx.skip();
  await withClient(async (db) => {
    await db.query("begin");
    try {
      const manager = randomUUID();
      await db.query("insert into public.staff(id,email,full_name,role) values($1,$2,'Footer review','management')", [manager, `${manager}@example.test`]);
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [manager]);
      const published = { ...defaultDocument("waitlist_confirmation"), name: "Published name", footer: "Old footer", branding: false };
      const draft = { ...published, name: "Unpublished changes", footer: "Draft footer" };
      await db.query("select * from public.save_message_template_draft('waitlist_confirmation',$1,null,null)", [JSON.stringify(published)]);
      await db.query("select * from public.publish_message_template('waitlist_confirmation')");
      await db.query("select * from public.save_message_template_draft('waitlist_confirmation',$1,null,null)", [JSON.stringify(draft)]);
      await db.query("update public.message_templates set is_active=false,timing_minutes=27 where key='waitlist_confirmation'");
      await db.query("delete from public.message_templates where key='directions_and_parking'");
      await db.query("insert into public.message_templates(key,channel,is_active,is_marketing,body) values('payment_link','whatsapp',true,false,'Keep this wording') on conflict(key) do update set channel='whatsapp',subject=null,body='Keep this wording'");
      const whatsapp = (await db.query("select to_jsonb(t) value from public.message_templates t where key='payment_link'")).rows[0].value;
      const before = (await db.query("select to_jsonb(t) value from public.message_templates t where key='waitlist_confirmation'")).rows[0].value;
      await db.query("set local role authenticated");
      const result = (await db.query("select * from public.apply_email_footer_to_all($1,$2)", ["New footer\nContact the team", SYSTEM_MESSAGE_KEYS])).rows[0];
      expect(result.updated_count).toBe(SYSTEM_MESSAGE_KEYS.length - 1);
      await db.query("reset role");
      const after = (await db.query("select to_jsonb(t) value from public.message_templates t where key='waitlist_confirmation'")).rows[0].value;
      expect(after.document).toEqual({ ...published, footer: "New footer\nContact the team" });
      expect(after.draft_document).toEqual({ ...draft, footer: "New footer\nContact the team" });
      for (const field of ["subject", "body", "preheader", "is_active", "channel", "timing_minutes", "draft_subject", "draft_preheader"]) expect(after[field]).toEqual(before[field]);
      const builtin = (await db.query("select document,draft_document,is_active,footer from public.message_templates where key='directions_and_parking'")).rows[0];
      expect(builtin).toEqual({ document: null, draft_document: null, is_active: true, footer: "New footer\nContact the team" });
      expect((await db.query("select to_jsonb(t) value from public.message_templates t where key='payment_link'")).rows[0].value).toEqual(whatsapp);
      expect((await db.query("select count(*)::int count from audit.entries where actor_id=$1 and action='apply_email_footer_to_all'", [manager])).rows[0].count).toBe(result.updated_count);
      await db.query("set local role service_role");
      const sending = (await db.query("select * from public.message_document_for_send('waitlist_confirmation')")).rows[0];
      expect(sending.document.name).toBe("Published name");
      expect(sending.footer).toBe("New footer\nContact the team");
    } finally { await db.query("rollback"); }
  });
});

it("[OUR CHOICE; owner request 12 September 2026] footer bulk changes reject unauthorised and invalid writes atomically", async (ctx) => {
  if (!up) return ctx.skip();
  await withClient(async (db) => {
    await db.query("begin");
    try {
      const reception = randomUUID(), manager = randomUUID();
      await db.query("insert into public.staff(id,email,full_name,role) values($1,$3,'Reception','reception'),($2,$4,'Management','management')", [reception, manager, `${reception}@example.test`, `${manager}@example.test`]);
      const before = (await db.query("select jsonb_agg(to_jsonb(t) order by key) value from public.message_templates t")).rows[0].value;
      for (const [actor, footer, keys] of [[reception, "No access", SYSTEM_MESSAGE_KEYS], [manager, "x".repeat(MESSAGE_DOCUMENT_LIMITS.textMax + 1), SYSTEM_MESSAGE_KEYS], [manager, "Invalid key", ["waitlist_confirmation", "unknown_key"]]] as const) {
        await db.query("savepoint refused");
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
        await db.query("set local role authenticated");
        await expect(db.query("select * from public.apply_email_footer_to_all($1,$2)", [footer, keys])).rejects.toThrow();
        await db.query("rollback to savepoint refused");
        expect((await db.query("select jsonb_agg(to_jsonb(t) order by key) value from public.message_templates t")).rows[0].value).toEqual(before);
      }
      expect((await db.query("select has_function_privilege('anon','public.apply_email_footer_to_all(text,text[],jsonb)','execute') allowed")).rows[0].allowed).toBe(false);
      expect((await db.query("select has_function_privilege('authenticated','public.message_document_for_send(text)','execute') allowed")).rows[0].allowed).toBe(false);
    } finally { await db.query("rollback"); }
  });
});

it("[OUR CHOICE; owner request 12 September 2026] bulk rich footers update only published and draft footer designs atomically", async (ctx) => {
  if (!up) return ctx.skip();
  await withClient(async (db) => {
    await db.query("begin");
    try {
      const manager = randomUUID();
      await db.query("insert into public.staff(id,email,full_name,role) values($1,$2,'Rich footer review','management')", [manager, `${manager}@example.test`]);
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [manager]);
      const design = { label: "Connect", align: "right", iconStyle: "coloured", divider: true, links: [{ id: "site", icon: "website", label: "Visit WellPlace", href: "https://wellplace.example", enabled: true }] };
      const published = { ...defaultDocument("waitlist_confirmation"), name: "Published name", footer: "Old footer" };
      const draft = { ...published, name: "Unsaved body edits", footerDesign: { ...design, links: [] } };
      await db.query("select * from public.save_message_template_draft('waitlist_confirmation',$1,null,null)", [JSON.stringify(published)]);
      await db.query("select * from public.publish_message_template('waitlist_confirmation')");
      await db.query("select * from public.save_message_template_draft('waitlist_confirmation',$1,null,null)", [JSON.stringify(draft)]);
      await db.query("set local role authenticated");
      await db.query("select * from public.apply_email_footer_to_all($1,$2,$3)", ["New signature", ["waitlist_confirmation"], JSON.stringify(design)]);
      await db.query("reset role");
      const row = (await db.query("select document,draft_document,footer_design from public.message_templates where key='waitlist_confirmation'")).rows[0];
      expect(row.document).toEqual({ ...published, footer: "New signature", footerDesign: design });
      expect(row.draft_document).toEqual({ ...draft, footer: "New signature", footerDesign: design });
      expect(row.footer_design).toEqual(design);
      await db.query("select * from public.apply_email_footer_to_all($1,$2)", ["Text-only caller", ["waitlist_confirmation"]]);
      await db.query("set local role service_role");
      const sending = (await db.query("select * from public.message_document_for_send('waitlist_confirmation')")).rows[0];
      expect(sending.footer_design).toEqual(design);
      expect(sending.document.footerDesign).toEqual(design);
      expect(sending.document.name).toBe("Published name");
      expect(sending).not.toHaveProperty("draft_document");
    } finally { await db.query("rollback"); }
  });
});
