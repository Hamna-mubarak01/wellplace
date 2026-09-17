import { getSetting, requireSetting, type SettingsSnapshot } from "@/lib/config";
import { windowsForDate } from "@/lib/services/opening-hours-service";
export { windowsForDate } from "@/lib/services/opening-hours-service";
import { countAvailableSuites } from "@/lib/db/rpc";
import type { WellPlaceClient } from "@/lib/db/types";
import { dayAvailabilityMessage, timeTileState, type TileState, type UrgencyConfig } from "@/lib/domain/availability";
import { bookableStarts, type CalendarDate } from "@/lib/domain/schedule";
import { formatDubaiTime, todayInDubai } from "@/lib/domain/time";


export function urgencyFrom(snapshot: SettingsSnapshot): UrgencyConfig {
  return {
    enabled: requireSetting(snapshot, "urgency.enabled"),
    fewEnabled: requireSetting(snapshot, "urgency.few_enabled"),
    lastEnabled: requireSetting(snapshot, "urgency.last_enabled"),
    noneEnabled: requireSetting(snapshot, "urgency.none_enabled"),
    mode: requireSetting(snapshot, "urgency.mode"),
    textGeneral: requireSetting(snapshot, "urgency.text_general"),
    thresholdFew: requireSetting(snapshot, "urgency.threshold_few"),
    thresholdLast: requireSetting(snapshot, "urgency.threshold_last"),
    textFew: requireSetting(snapshot, "urgency.text_few"),
    textLast: requireSetting(snapshot, "urgency.text_last"),
    textNone: requireSetting(snapshot, "urgency.text_none"),
    textFilling: requireSetting(snapshot, "urgency.text_filling"),
  };
}

export interface TimeSlotView {
  startsAt: string;
  label: string;
  tile: TileState;
}

export type DayAvailability =
  | { status: "open"; slots: TimeSlotView[] }
  | { status: "closed"; slots: [] }
  | { status: "hours_unconfigured"; slots: [] }
  | { status: "error"; slots: []; message: string };

export async function getDayAvailability(
  client: WellPlaceClient,
  snapshot: SettingsSnapshot,
  input: {
    date: CalendarDate;
    durationHours: number;
    guestCount?: number;
    rescheduleBookingId?: string;
    securedStartsAt?: string | null;
    securedUntil?: Date | null;
    now?: Date;
  },
): Promise<DayAvailability> {
  const windows = windowsForDate(snapshot, input.date);
  if (windows === null) return { status: "hours_unconfigured", slots: [] };

  const starts = bookableStarts({
    date: input.date,
    windows,
    intervalMinutes: requireSetting(snapshot, "booking.start_interval_minutes"),
    durationHours: input.durationHours,
    now: input.now ?? new Date(),
    maxHorizonDays: getSetting(snapshot, "booking.max_horizon_days"),
    sameDayCutoff: getSetting(snapshot, "booking.same_day_cutoff"),
  });

  if (starts.length === 0) return { status: "closed", slots: [] };

  const bufferMinutes = requireSetting(snapshot, "cleaning.buffer_minutes");

  const batches = await Promise.all(chunk(starts.map((start) => start.toISOString()), MAX_INSTANTS_PER_CALL).map((startsAt) => countAvailableSuites(client, {
    startsAt,
    durationHours: input.durationHours,
    bufferMinutes,
    rescheduleBookingId: input.rescheduleBookingId,
  })));
  const failed = batches.find((result) => !result.ok);
  if (failed && !failed.ok) {
    console.error("[booking] availability lookup failed:", failed.message);
    return { status: "error", slots: [], message: "We could not load available times just now. Please try again." };
  }
  const countedSlots = batches.flatMap((result) => result.ok ? result.slots : []);

  const urgency = urgencyFrom(snapshot);

  const bySlot = new Map(countedSlots.map((slot) => [Date.parse(slot.startsAt), slot]));

  const slots: TimeSlotView[] = starts.map((start) => {
    const startsAt = start.toISOString();
    const counts = bySlot.get(start.getTime());

    const remaining = counts?.remaining ?? 0;
    const reducedByDemand = counts?.reducedByDemand ?? false;

    const isSecured =
      input.securedStartsAt != null && Date.parse(input.securedStartsAt) === start.getTime();

    return {
      startsAt,
      label: `${formatDubaiTime(start)}${todayInDubai(start) !== isoDate(input.date) ? " (+1 day)" : ""}`,
      tile: timeTileState({
        remaining,
        reducedByDemand,
        urgency,
        securedUntil: isSecured ? (input.securedUntil ?? null) : null,
      }),
    };
  });

  return { status: "open", slots };
}


const MAX_INSTANTS_PER_CALL = 200;

export interface DayView {
  date: string;
  status: "open" | "closed" | "hours-unpublished";
  slotsByDuration: Record<number, TimeSlotView[]>;
  messageByDuration: Record<number, string | null>;
}

function isoDate(date: CalendarDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function getAvailabilityWindow(
  client: WellPlaceClient,
  snapshot: SettingsSnapshot,
  input: {
    dates: readonly CalendarDate[];
    durationsHours: readonly number[];
    securedStartsAt?: string | null;
    securedUntil?: Date | null;
    now?: Date;
  },
): Promise<{ ok: true; days: DayView[] } | { ok: false; message: string }> {
  const now = input.now ?? new Date();
  const intervalMinutes = requireSetting(snapshot, "booking.start_interval_minutes");
  const bufferMinutes = requireSetting(snapshot, "cleaning.buffer_minutes");

  const wanted = new Map<string, Map<number, Date[]>>();
  const statuses = new Map<string, DayView["status"]>();

  for (const date of input.dates) {
    const key = isoDate(date);
    const windows = windowsForDate(snapshot, date);

    if (windows === null) {
      statuses.set(key, "hours-unpublished");
      wanted.set(key, new Map());
      continue;
    }

    const perDuration = new Map<number, Date[]>();
    for (const durationHours of input.durationsHours) {
      perDuration.set(
        durationHours,
        bookableStarts({
          date,
          windows,
          intervalMinutes,
          durationHours,
          now,
          maxHorizonDays: getSetting(snapshot, "booking.max_horizon_days"),
          sameDayCutoff: getSetting(snapshot, "booking.same_day_cutoff"),
        }),
      );
    }

    const anyStarts = [...perDuration.values()].some((starts) => starts.length > 0);
    statuses.set(key, anyStarts ? "open" : "closed");
    wanted.set(key, perDuration);
  }

  const counts = new Map<string, { remaining: number; reducedByDemand: boolean }>();

  const batches = input.durationsHours.flatMap((durationHours) => {
    const instants = [...wanted.values()]
      .flatMap((perDuration) => perDuration.get(durationHours) ?? [])
      .map((start) => start.toISOString());

    return chunk(instants, MAX_INSTANTS_PER_CALL).map((startsAt) => ({ durationHours, startsAt }));
  });

  const results = await Promise.all(
    batches.map(async (batch) => ({
      batch,
      result: await countAvailableSuites(client, {
        startsAt: batch.startsAt,
        durationHours: batch.durationHours,
        bufferMinutes,
      }),
    })),
  );

  for (const { batch, result } of results) {
    if (!result.ok) {
      console.error("[booking] availability window failed:", result.message);
      return { ok: false, message: result.message };
    }
    for (const slot of result.slots) {
      counts.set(`${batch.durationHours}@${Date.parse(slot.startsAt)}`, {
        remaining: slot.remaining,
        reducedByDemand: slot.reducedByDemand,
      });
    }
  }

  const urgency = urgencyFrom(snapshot);

  const days: DayView[] = input.dates.map((date) => {
    const key = isoDate(date);
    const perDuration = wanted.get(key) ?? new Map<number, Date[]>();
    const slotsByDuration: Record<number, TimeSlotView[]> = {};
    const messageByDuration: Record<number, string | null> = {};

    for (const durationHours of input.durationsHours) {
      const starts = perDuration.get(durationHours) ?? [];
      messageByDuration[durationHours] = dayAvailabilityMessage(
        starts.map((start) => counts.get(`${durationHours}@${start.getTime()}`)?.remaining ?? 0),
        urgency,
      );
      slotsByDuration[durationHours] = starts.map((start) => {
        const counted = counts.get(`${durationHours}@${start.getTime()}`);
        const isSecured =
          input.securedStartsAt != null && Date.parse(input.securedStartsAt) === start.getTime();

        return {
          startsAt: start.toISOString(),
          label: `${formatDubaiTime(start)}${todayInDubai(start) !== key ? " (+1 day)" : ""}`,
          tile: timeTileState({
            remaining: counted?.remaining ?? 0,
            reducedByDemand: counted?.reducedByDemand ?? false,
            urgency,
            securedUntil: isSecured ? (input.securedUntil ?? null) : null,
          }),
        };
      });
    }

    return { date: key, status: statuses.get(key) ?? "closed", slotsByDuration, messageByDuration };
  });

  return { ok: true, days };
}
