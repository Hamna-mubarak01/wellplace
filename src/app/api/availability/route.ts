import { RESCHEDULE_MINUTES } from "@/lib/config/console-limits";
import { headers } from "next/headers";
import { z } from "zod";

import { readStaffSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { loadSettingsSnapshot } from "@/lib/db/queries/settings";
import { getDayAvailability } from "@/lib/services/availability-service";
import { checkConfiguredRateLimit } from "@/lib/services/configured-rate-limit";
import { isRealDate } from "@/lib/domain/age";

const querySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.")
    .refine((value) => {
      const [year, month, day] = value.split("-").map(Number);
      return isRealDate({ day, month, year });
    }, "That date does not exist."),
  durationHours: z.coerce.number().int().positive().max(24).optional(),
  durationMinutes: z.coerce.number().int().positive().max(RESCHEDULE_MINUTES.max).optional(),
  bookingId: z.uuid().optional(),
  guestCount: z.coerce.number().int().positive().max(64).optional(),
});

async function callerKey(): Promise<string> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || store.get("x-real-ip") || "unknown";
}

export async function GET(request: Request) {
  const session = await readStaffSession();
  if (session === null) {
    return Response.json({ status: "unauthorised" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;

  const parsed = querySchema.safeParse({
    date: params.get("date"),
    durationHours: params.get("durationHours") ?? undefined,
    durationMinutes: params.get("durationMinutes") ?? undefined,
    bookingId: params.get("bookingId") ?? undefined,
    guestCount: params.get("guestCount") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json(
      { status: "invalid", message: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  if ((parsed.data.bookingId && (session.role !== "reception" || !parsed.data.durationMinutes)) || (!parsed.data.bookingId && !parsed.data.durationHours)) {
    return Response.json({ status: "invalid", message: "Choose a booking and its duration before checking new times." }, { status: 400 });
  }

  const supabase = await createClient();
  const snapshot = await loadSettingsSnapshot(supabase);

  const verdict = checkConfiguredRateLimit("availability", snapshot,
    `availability:${session.userId}:${await callerKey()}`,
  );

  if (!verdict.allowed) {
    return Response.json(
      { status: "rate_limited" },
      { status: 429, headers: { "retry-after": String(verdict.retryAfterSeconds) } },
    );
  }

  const [year, month, day] = parsed.data.date.split("-").map(Number);

  const availability = await getDayAvailability(supabase, snapshot, {
    date: { year, month, day },
    durationHours: parsed.data.bookingId ? (parsed.data.durationMinutes ?? 0) / 60 : (parsed.data.durationHours ?? 0),
    rescheduleBookingId: parsed.data.bookingId,
    guestCount: parsed.data.guestCount,
  });

  return Response.json(
    {
      status: availability.status,
      slots: availability.slots.map((slot) => ({
        startsAt: slot.startsAt,
        label: slot.label,
        disabled: slot.tile.disabled,
        message: slot.tile.message,
        kind: slot.tile.kind,
      })),
    },
    {
      headers: {
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    },
  );
}
