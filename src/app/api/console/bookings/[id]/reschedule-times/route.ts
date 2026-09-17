import { headers } from "next/headers";
import { z } from "zod";

import { requireManagement } from "@/lib/auth/session";
import { RESCHEDULE_MINUTES } from "@/lib/config/console-limits";
import { createClient } from "@/lib/db/server";
import { loadSettingsSnapshot } from "@/lib/db/queries/settings";
import { isRealDate } from "@/lib/domain/age";
import { getDayAvailability } from "@/lib/services/availability-service";
import { checkConfiguredRateLimit } from "@/lib/services/configured-rate-limit";

const querySchema = z.object({
  bookingId: z.uuid(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.")
    .refine((value) => {
      const [year, month, day] = value.split("-").map(Number);
      return isRealDate({ day, month, year });
    }, "That date does not exist."),
  durationMinutes: z.coerce.number().int().min(RESCHEDULE_MINUTES.min).max(RESCHEDULE_MINUTES.max),
});

const NO_STORE = {
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
} as const;

async function callerKey(): Promise<string> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || store.get("x-real-ip") || "unknown";
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireManagement();
  const { id } = await params;
  const search = new URL(request.url).searchParams;

  const parsed = querySchema.safeParse({
    bookingId: id,
    date: search.get("date"),
    durationMinutes: search.get("durationMinutes"),
  });
  if (!parsed.success) {
    return Response.json({ status: "invalid", message: parsed.error.issues[0].message }, { status: 400, headers: NO_STORE });
  }

  const supabase = await createClient();
  const snapshot = await loadSettingsSnapshot(supabase);
  const verdict = checkConfiguredRateLimit(
    "availability",
    snapshot,
    `availability:${session.userId}:${await callerKey()}`,
  );
  if (!verdict.allowed) {
    return Response.json(
      { status: "rate_limited" },
      { status: 429, headers: { ...NO_STORE, "retry-after": String(verdict.retryAfterSeconds) } },
    );
  }

  const [year, month, day] = parsed.data.date.split("-").map(Number);
  const availability = await getDayAvailability(supabase, snapshot, {
    date: { year, month, day },
    durationHours: parsed.data.durationMinutes / 60,
    rescheduleBookingId: parsed.data.bookingId,
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
    { headers: NO_STORE },
  );
}
