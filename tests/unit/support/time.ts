
export function withTimeZone<T>(timeZone: string, body: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    return body();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

export const TIME_ZONES = [
  "UTC",
  "Asia/Dubai",
  "Pacific/Kiritimati",
  "America/Los_Angeles",
  "Pacific/Niue",
] as const;
