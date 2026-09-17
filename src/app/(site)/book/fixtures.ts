import type { BookingDay } from "@/components/booking/booking-types";
import type { TimeSlot } from "@/components/shared/time-tile";
import { dayAvailabilityMessage, timeTileState, type UrgencyConfig } from "@/lib/domain/availability";
import { bookableStarts, type OpeningWindow } from "@/lib/domain/schedule";
import { DUBAI_TIME_ZONE, formatDubaiDayLong, formatDubaiTime } from "@/lib/domain/time";


const HORIZON_DAYS = 21;

const REGULAR: readonly OpeningWindow[] = [{ opens: "10:00", closes: "22:00" }];
const SHORT_DAY: readonly OpeningWindow[] = [{ opens: "10:00", closes: "14:00" }];

const CLOSED_DAY_OFFSET = 3;
const UNPUBLISHED_DAY_OFFSET = 5;
const SHORT_DAY_OFFSET = 7;

const HELD_DAY_OFFSET = 1;
const HELD_SLOT_INDEX = 4;

export interface FixtureOptions {
  now: Date;
  urgency: UrgencyConfig;
  durationsHours: readonly number[];
  startIntervalMinutes: number;
  holdMinutes: number;
  holdSeconds?: number;
  withHold?: boolean;
}

export interface Fixtures {
  days: BookingDay[];
  initialDate: string;
}

function dubaiParts(instant: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DUBAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return { year: get("year"), month: get("month"), day: get("day") };
}

function dateKey({ year, month, day }: { year: number; month: number; day: number }): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function remainingFor(index: number): { remaining: number; reducedByDemand: boolean } {
  if (index % 11 === 0) return { remaining: 0, reducedByDemand: true };
  if (index % 7 === 0) return { remaining: 2, reducedByDemand: true };
  if (index % 5 === 0) return { remaining: 4, reducedByDemand: true };
  if (index % 3 === 0) return { remaining: 7, reducedByDemand: false };
  return { remaining: 6, reducedByDemand: true };
}

export function buildFixtures(options: FixtureOptions): Fixtures {
  const { now, urgency, durationsHours, startIntervalMinutes, holdMinutes } = options;
  const holdSeconds = options.holdSeconds ?? holdMinutes * 60;
  const withHold = options.withHold ?? true;

  const today = dubaiParts(now);
  const days: BookingDay[] = [];
  let initialDate: string | null = null;
  let heldSlotPlaced = false;

  for (let offset = 1; offset <= HORIZON_DAYS; offset++) {
    const dayInstant = new Date(
      Date.UTC(today.year, today.month - 1, today.day + offset, 12),
    );
    const parts = dubaiParts(dayInstant);
    const key = dateKey(parts);

    if (offset === UNPUBLISHED_DAY_OFFSET) {
      days.push({
        date: key,
        label: formatDubaiDayLong(dayInstant),
        status: "hours-unpublished",
        slotsByDuration: {},
        messageByDuration: {},
      });
      continue;
    }

    if (offset === CLOSED_DAY_OFFSET) {
      days.push({
        date: key,
        label: formatDubaiDayLong(dayInstant),
        status: "closed",
        slotsByDuration: {},
        messageByDuration: {},
      });
      continue;
    }

    const windows = offset === SHORT_DAY_OFFSET ? SHORT_DAY : REGULAR;
    const slotsByDuration: Record<number, TimeSlot[]> = {};
    const messageByDuration: Record<number, string | null> = {};

    for (const durationHours of durationsHours) {
      const starts = bookableStarts({
        date: parts,
        windows,
        intervalMinutes: startIntervalMinutes,
        durationHours,
      });

      messageByDuration[durationHours] = dayAvailabilityMessage(
        starts.map((_, index) => remainingFor(index).remaining),
        urgency,
      );

      slotsByDuration[durationHours] = starts.map((start, index) => {
        const isHeld =
          withHold &&
          !heldSlotPlaced &&
          offset === HELD_DAY_OFFSET &&
          durationHours === durationsHours[0] &&
          index === HELD_SLOT_INDEX;
        if (isHeld) heldSlotPlaced = true;

        const { remaining, reducedByDemand } = remainingFor(index);

        return {
          startsAt: start.toISOString(),
          label: formatDubaiTime(start),
          tile: timeTileState({
            remaining,
            reducedByDemand,
            urgency,
            securedUntil: isHeld
              ? new Date(now.getTime() + holdSeconds * 1000)
              : null,
          }),
        };
      });
    }

    days.push({
      date: key,
      label: formatDubaiDayLong(dayInstant),
      status: "open",
      slotsByDuration,
      messageByDuration,
    });

    if (initialDate === null) initialDate = key;
  }

  return { days, initialDate: initialDate ?? days[0].date };
}

export function closedDate(fixtures: Fixtures): string {
  return (
    fixtures.days.find((day) => day.status === "closed")?.date ?? fixtures.initialDate
  );
}

export function unpublishedDate(fixtures: Fixtures): string {
  return (
    fixtures.days.find((day) => day.status === "hours-unpublished")?.date ??
    fixtures.initialDate
  );
}
