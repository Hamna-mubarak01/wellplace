export const BACKGROUND_JOBS = {
  alertWorker: "wellplace-alert-worker",
  logCleanup: "wellplace-cron-log-cleanup",
  logRetentionDays: 7,
  cleanupSchedule: "17 3 * * *",
} as const;
