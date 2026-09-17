-- [CLIENT, cost control; OUR CHOICE] Match src/lib/config/background-jobs.ts.
-- pg_cron retains run history indefinitely unless an operator removes it.
-- Only old, completed runs of these two application jobs are eligible.
create or replace function internal.prune_cron_run_history()
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare removed bigint;
begin
  delete from cron.job_run_details runs
  using cron.job jobs
  where runs.jobid = jobs.jobid
    and jobs.jobname in ('wellplace-alert-worker', 'wellplace-cron-log-cleanup')
    and runs.end_time < now() - interval '7 days'
    and runs.status in ('succeeded', 'failed');
  get diagnostics removed = row_count;
  return removed;
end
$$;
revoke all on function internal.prune_cron_run_history() from public, anon, authenticated, service_role;
comment on function internal.prune_cron_run_history() is
  '[CLIENT; OUR CHOICE] Bound diagnostic storage to seven days for the WellPlace jobs. Daily SQL-only maintenance. Preserves running jobs, other jobs, booking records, worker health and audit history.';

select cron.schedule('wellplace-cron-log-cleanup', '17 3 * * *', 'select internal.prune_cron_run_history();');
