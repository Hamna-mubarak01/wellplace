import type { TimeSlot } from "@/components/shared/time-tile";
import { guestClockLabel } from "@/components/booking/booking-date";
import { formatDubaiTime, todayInDubai } from "@/lib/domain/time";

interface Period {
  readonly id: string;
  readonly label: string;
  readonly until: number;
}

const HOURS_PER_DAY = 24;

const PERIODS: readonly Period[] = [
  { id: "morning", label: "Morning", until: 12 },
  { id: "afternoon", label: "Afternoon", until: 17 },
  { id: "evening", label: "Evening", until: HOURS_PER_DAY * 2 },
];

const UNGROUPED: Period = { id: "other", label: "Other", until: 0 };

export interface SlotPeriod {
  readonly id: string;
  readonly label: string;
  readonly range: string;
  readonly slots: readonly TimeSlot[];
}

function startHour(slot: TimeSlot, dateKey: string): number {
  const hour = Number(formatDubaiTime(slot.startsAt).slice(0, 2));
  return todayInDubai(new Date(slot.startsAt)) === dateKey ? hour : hour + HOURS_PER_DAY;
}

export function groupSlotsByPeriod(
  slots: readonly TimeSlot[],
  dateKey: string,
): readonly SlotPeriod[] {
  const grouped = new Map<string, TimeSlot[]>();

  for (const slot of slots) {
    const hour = startHour(slot, dateKey);
    let from = 0;
    let period = UNGROUPED;
    for (const candidate of PERIODS) {
      if (hour >= from && hour < candidate.until) {
        period = candidate;
        break;
      }
      from = candidate.until;
    }
    const bucket = grouped.get(period.id);
    if (bucket) bucket.push(slot);
    else grouped.set(period.id, [slot]);
  }

  return [...PERIODS, UNGROUPED]
    .map((period) => {
      const periodSlots = grouped.get(period.id) ?? [];
      const first = periodSlots[0];
      const last = periodSlots.at(-1);
      return {
        id: period.id,
        label: period.label,
        range:
          first && last
            ? first === last
              ? guestClockLabel(first.startsAt)
              : `${guestClockLabel(first.startsAt)} – ${guestClockLabel(last.startsAt)}`
            : "",
        slots: periodSlots,
      };
    })
    .filter((period) => period.slots.length > 0);
}
