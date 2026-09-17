import { unstable_rethrow } from "next/navigation";

import { getSetting, requireSetting, type SettingsSnapshot } from "@/lib/config";
import { TODAY_BOOKING_CACHE_MS } from "@/lib/config/today-booking";
import { loadPublicBookingSettings } from "@/lib/db/queries/public-settings";
import { createClient } from "@/lib/db/server";
import type { WellPlaceClient } from "@/lib/db/types";
import { dubaiWallTimeToInstant } from "@/lib/domain/schedule";
import { toCalendarDate, todayInDubai } from "@/lib/domain/time";
import { getAvailabilityWindow } from "@/lib/services/availability-service";

export type TodayBookingStatus =
  | { kind: "open"; closesAt: string; serverNow: string; tag: string | null }
  | { kind: "fully_booked"; serverNow: string; tag: string | null }
  | { kind: "closed"; serverNow: string };

type TodayBookingState =
  | { kind: "open"; closesAt: string; tag: string | null }
  | { kind: "fully_booked"; tag: string | null }
  | { kind: "closed" };

export interface TodayBookingDay {
  readonly date: string;
  readonly status: string;
  readonly slots: readonly { readonly startsAt: string; readonly tile: { readonly disabled: boolean } }[];
  readonly message: string | null;
}

function todayBookingState(input: {
  day: TodayBookingDay | undefined;
  sameDayCutoff: string | null;
  textNone: string | null;
  now: Date;
}): TodayBookingState {
  const { day, now } = input;
  if (!day || day.status !== "open" || day.date !== todayInDubai(now)) return { kind: "closed" };

  const upcoming = day.slots.filter((slot) => Date.parse(slot.startsAt) > now.getTime());
  if (upcoming.length === 0) return { kind: "closed" };

  const open = upcoming.filter((slot) => !slot.tile.disabled);
  if (open.length === 0) return { kind: "fully_booked", tag: input.textNone?.trim() || null };

  const lastStart = Math.max(...open.map((slot) => Date.parse(slot.startsAt)));
  const cutoff = input.sameDayCutoff
    ? dubaiWallTimeToInstant(toCalendarDate(day.date), input.sameDayCutoff).getTime()
    : Number.POSITIVE_INFINITY;
  const closesAt = Math.min(lastStart, cutoff);
  if (closesAt <= now.getTime()) return { kind: "closed" };

  return { kind: "open", closesAt: new Date(closesAt).toISOString(), tag: day.message };
}

function stamp(state: TodayBookingState, now: Date): TodayBookingStatus {
  return { ...state, serverNow: now.toISOString() };
}

export function todayBookingStatus(input: {
  day: TodayBookingDay | undefined;
  snapshot: SettingsSnapshot;
  now: Date;
}): TodayBookingStatus {
  const state = todayBookingState({
    day: input.day,
    sameDayCutoff: getSetting(input.snapshot, "booking.same_day_cutoff"),
    textNone: getSetting(input.snapshot, "urgency.text_none"),
    now: input.now,
  });
  return stamp(state, input.now);
}

async function computeTodayState(client: WellPlaceClient, now: Date): Promise<TodayBookingState | null> {
  const loaded = await loadPublicBookingSettings(client);
  if (!loaded.ok) {
    console.error("[today-booking] public settings unavailable:", loaded.message);
    return null;
  }
  const snapshot = loaded.snapshot;
  const shortest = Math.min(...requireSetting(snapshot, "booking.durations_hours"));
  const today = todayInDubai(now);

  const window = await getAvailabilityWindow(client, snapshot, {
    dates: [toCalendarDate(today)],
    durationsHours: [shortest],
    now,
  });
  if (!window.ok) return null;

  const view = window.days[0];
  return todayBookingState({
    day: view
      ? {
          date: view.date,
          status: view.status,
          slots: view.slotsByDuration[shortest] ?? [],
          message: view.messageByDuration[shortest] ?? null,
        }
      : undefined,
    sameDayCutoff: getSetting(snapshot, "booking.same_day_cutoff"),
    textNone: getSetting(snapshot, "urgency.text_none"),
    now,
  });
}

let cached: { expiresAt: number; state: TodayBookingState } | null = null;

export async function loadTodayBookingStatus(now: Date = new Date()): Promise<TodayBookingStatus | null> {
  if (!cached || cached.expiresAt <= now.getTime()) {
    try {
      const state = await computeTodayState(await createClient(), now);
      if (!state) return null;
      cached = { expiresAt: now.getTime() + TODAY_BOOKING_CACHE_MS, state };
    } catch (cause) {
      unstable_rethrow(cause);
      console.error(
        "[today-booking] status unavailable:",
        cause instanceof Error ? cause.message : "Unknown failure",
      );
      return null;
    }
  }

  const state = cached.state;
  if (state.kind === "open" && Date.parse(state.closesAt) <= now.getTime()) return stamp({ kind: "closed" }, now);
  return stamp(state, now);
}
