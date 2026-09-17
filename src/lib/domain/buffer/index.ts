
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

export interface Period {
  readonly start: Date;
  readonly end: Date;
}

export function experiencePeriod(start: Date, durationHours: number): Period {
  if (!Number.isFinite(durationHours) || durationHours <= 0) {
    throw new RangeError(
      `A booking duration must be a positive number of hours, received ${durationHours}. ` +
        `§6.1 offers 2, 3, 4, 5 or 6.`,
    );
  }

  return {
    start: new Date(start.getTime()),
    end: new Date(start.getTime() + durationHours * HOUR_MS),
  };
}

export function blockedPeriod(experience: Period, bufferMinutes: number): Period {
  if (!Number.isFinite(bufferMinutes) || bufferMinutes < 0) {
    throw new RangeError(
      `A cleaning buffer cannot be negative, received ${bufferMinutes}. ` +
        `A negative buffer would shorten the block and let the next booking start inside the previous one.`,
    );
  }

  return {
    start: new Date(experience.start.getTime()),
    end: new Date(experience.end.getTime() + bufferMinutes * MINUTE_MS),
  };
}

export function nextStartOnGrid(after: Date, intervalMinutes: number): Date {
  if (!Number.isInteger(intervalMinutes) || intervalMinutes <= 0) {
    throw new RangeError(
      `A start interval must be a positive whole number of minutes, received ${intervalMinutes}.`,
    );
  }

  const step = intervalMinutes * MINUTE_MS;
  const instant = after.getTime();

  const hourStart = Math.floor(instant / HOUR_MS) * HOUR_MS;
  const nextHour = hourStart + HOUR_MS;

  const steps = Math.ceil((instant - hourStart) / step);
  const candidate = hourStart + steps * step;

  return new Date(Math.min(candidate, nextHour));
}
