"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasPermission, requireManagement } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { requireSetting } from "@/lib/config";
import { loadSettingsSnapshot } from "@/lib/db/queries/settings";
import { findBooking } from "@/lib/db/queries/bookings";
import { readSuiteNextClaim } from "@/lib/db/queries/bookings-page";
import { readBookingMoveOptions } from "@/lib/db/queries/management-bookings";
import { NEVER_AUTO_ALLOCATED } from "@/lib/config/suite-status";
import {
  extendBooking as extendBookingRpc,
  moveBooking as moveBookingRpc,
  rescheduleBooking as rescheduleBookingRpc,
  updateBookingDetails as updateBookingDetailsRpc,
  type BookingMutation,
} from "@/lib/db/rpc";
import { openingHoursRefusal } from "@/lib/services/opening-hours-service";
import { ACTION_UNCONFIRMED, NO_SUITE_MESSAGE, SUITE_CONFLICT_MESSAGE } from "@/lib/domain/action-errors";
import { moveStartRefusal } from "@/lib/domain/booking";
import { consoleEdit, reasonSchema } from "@/lib/validation/audit-reason";
import { idSchema, instantSchema } from "@/lib/validation/console-inputs";
import {
  bookingNotesInput,
  extensionInput,
  rescheduleInput,
} from "@/lib/validation/reception-action-inputs";
import {
  extensionVerdict,
  type ExtensionVerdict,
} from "@/components/console/manage/bookings/booking-model";

export type ManageBookingResult = { ok: true } | { ok: false; message: string };

const BOOKING_UNREADABLE = "That booking could not be read. Refresh the page and try again.";

function refreshBookingPages(bookingId: string): void {
  revalidatePath("/manage/bookings");
  revalidatePath(`/manage/bookings/${bookingId}`);
  revalidatePath(`/manage/bookings/${bookingId}/receipt`);
  revalidatePath("/manage/suites", "layout");
  revalidatePath("/manage/customers", "layout");
  revalidatePath("/reception", "layout");
}

function toResult<T>(
  result: BookingMutation<T>,
  bookingId: string,
  noSuiteMessage: string = NO_SUITE_MESSAGE,
): ManageBookingResult {
  switch (result.outcome) {
    case "ok":
      refreshBookingPages(bookingId);
      return { ok: true };
    case "no_suite":
      return { ok: false, message: noSuiteMessage };
    case "refused":
    case "failed":
      return { ok: false, message: result.message };
  }
}

function minutesBetween(startsAt: string, endsAt: string): number {
  return (Date.parse(endsAt) - Date.parse(startsAt)) / 60_000;
}

export async function extendManagedBooking(input: {
  bookingId: string;
  extraMinutes: number;
  reason: string;
}): Promise<ManageBookingResult> {
  await requireManagement();

  const parsed = extensionInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  try {
    const supabase = await createClient();
    const [schedule, current] = await Promise.all([
      loadSettingsSnapshot(supabase),
      findBooking(supabase, parsed.data.bookingId),
    ]);
    if (current.outcome !== "found") return { ok: false, message: BOOKING_UNREADABLE };

    const duration = minutesBetween(current.booking.startsAt, current.booking.endsAt) + parsed.data.extraMinutes;
    const hoursRefusal = openingHoursRefusal(schedule, current.booking.startsAt, duration);
    if (hoursRefusal) return { ok: false, message: hoursRefusal };

    const result = await extendBookingRpc(supabase, parsed.data);
    return toResult(result, parsed.data.bookingId);
  } catch (cause) {
    console.error("[manage] extendManagedBooking fault:", cause);
    return { ok: false, message: ACTION_UNCONFIRMED };
  }
}

const extensionCheckSchema = extensionInput.pick({ bookingId: true, extraMinutes: true });

export async function checkManagedExtension(input: {
  bookingId: string;
  extraMinutes: number;
}): Promise<ExtensionVerdict> {
  await requireManagement();

  const parsed = extensionCheckSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };

  try {
    const supabase = await createClient();
    const [schedule, current] = await Promise.all([
      loadSettingsSnapshot(supabase),
      findBooking(supabase, parsed.data.bookingId),
    ]);
    if (current.outcome !== "found") return { status: "error", message: BOOKING_UNREADABLE };
    if (current.booking.suiteId === null) {
      return { status: "error", message: "This booking has no suite, so it cannot be extended." };
    }

    const duration = minutesBetween(current.booking.startsAt, current.booking.endsAt) + parsed.data.extraMinutes;
    const next = await readSuiteNextClaim(supabase, {
      suiteId: current.booking.suiteId,
      bookingId: current.booking.id,
      startsAt: current.booking.startsAt,
    });
    if (!next.ok) return { status: "error", message: next.message };

    return extensionVerdict({
      endsAt: current.booking.endsAt,
      extraMinutes: parsed.data.extraMinutes,
      bufferMinutes: current.booking.cleaningBufferMinutes,
      nextClaimAt: next.nextClaimAt,
      hoursRefusal: openingHoursRefusal(schedule, current.booking.startsAt, duration),
    });
  } catch (cause) {
    console.error("[manage] checkManagedExtension fault:", cause);
    return { status: "error", message: "The suite schedule could not be checked. Try again in a moment." };
  }
}

export async function rescheduleManagedBooking(input: {
  bookingId: string;
  startsAt: string;
  durationMinutes: number;
  reason: string;
}): Promise<ManageBookingResult> {
  await requireManagement();

  const parsed = rescheduleInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  try {
    const supabase = await createClient();
    const [schedule, current] = await Promise.all([
      loadSettingsSnapshot(supabase),
      findBooking(supabase, parsed.data.bookingId),
    ]);
    if (current.outcome !== "found") return { ok: false, message: BOOKING_UNREADABLE };
    const moveRefusal = moveStartRefusal(current.booking.startsAt, parsed.data.startsAt, Date.now());
    if (moveRefusal) return { ok: false, message: moveRefusal };

    const duration = parsed.data.durationMinutes ?? minutesBetween(current.booking.startsAt, current.booking.endsAt);
    const hoursRefusal = openingHoursRefusal(schedule, parsed.data.startsAt, duration);
    if (hoursRefusal) return { ok: false, message: hoursRefusal };

    const result = await rescheduleBookingRpc(supabase, {
      bookingId: parsed.data.bookingId,
      startsAt: parsed.data.startsAt,
      durationMinutes: duration,
      reason: parsed.data.reason,
    });
    return toResult(result, parsed.data.bookingId, `${NO_SUITE_MESSAGE} The original booking has been kept.`);
  } catch (cause) {
    console.error("[manage] rescheduleManagedBooking fault:", cause);
    return { ok: false, message: ACTION_UNCONFIRMED };
  }
}

const moveSchema = z.object({
  bookingId: idSchema,
  suiteId: idSchema,
  startsAt: instantSchema,
  reason: reasonSchema,
});

export async function moveManagedBooking(input: {
  bookingId: string;
  suiteId: string;
  startsAt: string;
  reason: string;
}): Promise<ManageBookingResult> {
  const session = await requireManagement();

  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  try {
    const supabase = await createClient();
    const [schedule, current] = await Promise.all([
      loadSettingsSnapshot(supabase),
      findBooking(supabase, parsed.data.bookingId),
    ]);
    if (current.outcome !== "found") return { ok: false, message: BOOKING_UNREADABLE };
    const moveRefusal = moveStartRefusal(current.booking.startsAt, parsed.data.startsAt, Date.now());
    if (moveRefusal) return { ok: false, message: moveRefusal };

    const duration = minutesBetween(current.booking.startsAt, current.booking.endsAt);
    const hoursRefusal = openingHoursRefusal(schedule, parsed.data.startsAt, duration);
    if (hoursRefusal) return { ok: false, message: hoursRefusal };

    const canOverride = hasPermission(session, "override_suite_allocation");
    const targetOnHold = canOverride
      ? false
      : await readBookingMoveOptions(supabase, parsed.data.bookingId, parsed.data.startsAt).then(
          (options) =>
            options.ok &&
            options.suites.some(
              (suite) => suite.suiteId === parsed.data.suiteId && NEVER_AUTO_ALLOCATED.includes(suite.status),
            ),
        );

    const result = await moveBookingRpc(supabase, {
      bookingId: parsed.data.bookingId,
      suiteId: parsed.data.suiteId,
      startsAt: parsed.data.startsAt,
      allowUnavailable: canOverride || targetOnHold,
      reason: parsed.data.reason,
    });
    return toResult(result, parsed.data.bookingId, `${SUITE_CONFLICT_MESSAGE} The original booking has been kept.`);
  } catch (cause) {
    console.error("[manage] moveManagedBooking fault:", cause);
    return { ok: false, message: ACTION_UNCONFIRMED };
  }
}

const detailsSchema = bookingNotesInput.omit({ reason: true });

export async function updateManagedBookingDetails(input: {
  bookingId: string;
  personalRequest: string;
  internalNote: string;
}): Promise<ManageBookingResult> {
  await requireManagement();

  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  try {
    const supabase = await createClient();
    const settings = await loadSettingsSnapshot(supabase);
    const maximum = requireSetting(settings, "booking.personal_request_max_length");
    if (parsed.data.personalRequest.length > maximum) {
      return { ok: false, message: `Keep the special request to ${maximum} characters or fewer.` };
    }

    const result = await updateBookingDetailsRpc(supabase, {
      bookingId: parsed.data.bookingId,
      personalRequest: parsed.data.personalRequest,
      internalNote: parsed.data.internalNote,
      reason: consoleEdit("Booking details"),
    });
    return toResult(result, parsed.data.bookingId);
  } catch (cause) {
    console.error("[manage] updateManagedBookingDetails fault:", cause);
    return { ok: false, message: ACTION_UNCONFIRMED };
  }
}
