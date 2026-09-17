import { beforeAll, afterAll, expect, it } from "vitest";
import { BACKGROUND_JOBS } from "@/lib/config/background-jobs";
import { claimDatabase, harnessIsUp, releaseDatabase, withClient } from "./support/harness";

let up = false;
beforeAll(async () => { up = await harnessIsUp(); if (up) await claimDatabase(); });
afterAll(async () => { if (up) await releaseDatabase(); });

it("[CLIENT, cost control] prunes only old completed runs of WellPlace jobs", async (ctx) => {
  if (!up) return ctx.skip();
  await withClient(async (db) => {
    await db.query("begin");
    try {
      const jobs = (await db.query("select jobid,jobname,schedule,command from cron.job where jobname = any($1)", [[BACKGROUND_JOBS.alertWorker, BACKGROUND_JOBS.logCleanup]])).rows;
      expect(jobs).toHaveLength(2);
      expect(jobs.find((j) => j.jobname === BACKGROUND_JOBS.logCleanup)).toMatchObject({ schedule: BACKGROUND_JOBS.cleanupSchedule, command: "select internal.prune_cron_run_history();" });
      const workerId = jobs.find((j) => j.jobname === BACKGROUND_JOBS.alertWorker).jobid;
      const inserted = (await db.query(`insert into cron.job_run_details(jobid,runid,job_pid,database,username,command,status,start_time,end_time)
        values($1,-901,0,'postgres','postgres','test','succeeded',now()-interval '9 days',now()-interval '8 days'),
              ($1,-902,0,'postgres','postgres','test','failed',now()-interval '9 days',now()-interval '8 days'),
              ($1,-903,0,'postgres','postgres','test','succeeded',now()-interval '1 day',now()-interval '1 day'),
              ($1,-904,0,'postgres','postgres','test','running',now()-interval '9 days',null),
              (-999,-905,0,'postgres','postgres','test','failed',now()-interval '9 days',now()-interval '8 days') returning runid`, [workerId])).rows.map((r) => r.runid);
      await db.query("select internal.prune_cron_run_history()");
      expect((await db.query("select runid from cron.job_run_details where runid=any($1) order by runid", [inserted])).rows.map((r) => Number(r.runid))).toEqual([-905, -904, -903]);
      for (const role of ["anon", "authenticated", "service_role"]) {
        expect((await db.query("select has_function_privilege($1,'internal.prune_cron_run_history()','execute') allowed", [role])).rows[0].allowed).toBe(false);
      }
      const body = (await db.query("select prosrc from pg_proc where oid='internal.prune_cron_run_history()'::regprocedure")).rows[0].prosrc;
      expect(body).toContain(`interval '${BACKGROUND_JOBS.logRetentionDays} days'`);
    } finally { await db.query("rollback"); }
  });
});
