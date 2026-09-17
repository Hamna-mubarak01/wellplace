"use server";

import { assignmentInput, bookingReasonInput, quoteReceptionInput, stayInput, rescheduleInput, alertResolutionInput, bookingNotesInput, cleaningBufferInput, cleaningConfirmationInput, customerWarningInput, extensionInput, lateArrivalInput, newTaskInput, overrunInput, shiftNoteInput, taskStatusInput } from "@/lib/validation/reception-action-inputs";

import { ACTION_UNCONFIRMED, NO_SUITE_MESSAGE, SUITE_CONFLICT_MESSAGE } from "@/lib/domain/action-errors";
import { moveStartRefusal } from "@/lib/domain/booking";

import { openingHoursRefusal } from "@/lib/services/opening-hours-service";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { consoleEdit, reasonSchema } from "@/lib/validation/audit-reason";
import { suiteStatusChangeSchema } from "@/lib/validation/suite-status";
import {
  filsSchema,
  idSchema,
  instantSchema,
} from "@/lib/validation/console-inputs";

import { hasPermission, requireManagement, requireReception } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { getSetting, requireSetting } from "@/lib/config";
import { loadSettingsSnapshot } from "@/lib/db/queries/settings";
import { findBooking } from "@/lib/db/queries/bookings";
import { listPriceTiers } from "@/lib/db/queries/pricing";
import {
  continuationHourOf,
  overrunRatePerIncrementFils,
} from "@/lib/domain/overrun";
import { createBookingAtReception } from "@/lib/services/reception-booking-service";
import { receptionBookingSchema } from "@/lib/validation/reception-booking";
import { quoteBooking } from "@/lib/services/pricing-service";
import type { AddonCatalogueItem } from "@/lib/db/queries/pricing";
import type { PricedBreakdown } from "@/lib/domain/pricing";
import type { CartLine } from "@/lib/domain/vouchers";
import {
  cancelBooking as cancelBookingRpc,
  extendBooking as extendBookingRpc,
  rescheduleBooking as rescheduleBookingRpc,
  moveBooking as moveBookingRpc,
  updateBookingDetails as updateBookingDetailsRpc,
  addShiftNote as addShiftNoteRpc,
  assignCleaningTask as assignCleaningTaskRpc,
  confirmCleaningTask as confirmCleaningTaskRpc,
  recordStay,
  resolveAlert as resolveAlertRpc,
  startCleaningTask as startCleaningTaskRpc,
  updateTaskStatus as updateTaskStatusRpc,
  setSuiteStatus as setSuiteStatusRpc,
  recordOverrun as recordOverrunRpc,
  markLateArrival as markLateArrivalRpc,
  assignTask as assignTaskRpc,
  handOverShift as handOverShiftRpc,
  setCustomerWarning as setCustomerWarningRpc,
  voidBookingPayment as voidBookingPaymentRpc,
  overrideBookingBuffer as overrideBookingBufferRpc,
  setManualBookingPrice as setManualBookingPriceRpc,
  createTask as createTaskRpc,
  type BookingMutation,
} from "@/lib/db/rpc";
import type { Database } from "@/types/database.generated";

export type CreateBookingResult =
  | { status: "created"; reference: string; suiteNumber: number }
  | { status: "no_suite" }
  | { status: "refused"; message: string }
  | { status: "error"; message: string };

export async function createBooking(
  input: unknown,
): Promise<CreateBookingResult> {
  const session = await requireReception();

  const parsed = receptionBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "refused", message: parsed.error.issues[0].message };
  }

  try {
    const supabase = await createClient();
    const snapshot = await loadSettingsSnapshot(supabase);
    const outcome = await createBookingAtReception(supabase, snapshot, parsed.data, {
      canOverridePrice: hasPermission(session, "manual_price_change"),
    });

    if (outcome.status === "created") {
      revalidatePath("/reception");
      revalidatePath("/reception/board");
      revalidatePath("/reception/bookings");

      return {
        status: "created",
        reference: outcome.booking.reference,
        suiteNumber: outcome.booking.suiteNumber,
      };
    }

    return outcome;
  } catch (cause) {
    console.error("[reception] createBooking fault:", cause);
    return {
      status: "error",
      message: ACTION_UNCONFIRMED,
    };
  }
}

export type BookingActionResult =
  | { ok: true }
  | { ok: false; message: string };

function refreshReception(): void {
  revalidatePath("/reception");
  revalidatePath("/reception/board");
  revalidatePath("/reception/bookings");
}

function toActionResult<T>(result: BookingMutation<T>): BookingActionResult {
  switch (result.outcome) {
    case "ok":
      refreshReception();
      return { ok: true };
    case "no_suite":
      return {
        ok: false,
        message: NO_SUITE_MESSAGE,
      };
    case "refused":
      return { ok: false, message: result.message };
    case "failed":
      return { ok: false, message: result.message };
  }
}

export async function cancelBooking(
  bookingId: string,
  reason: string,
): Promise<BookingActionResult> {
  await requireReception();

  const parsed = bookingReasonInput.safeParse({ bookingId, reason });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const result = await cancelBookingRpc(supabase, bookingId, parsed.data.reason);

  if (result.outcome === "ok") revalidatePath(`/reception/bookings/${bookingId}`);
  return toActionResult(result);
}

export async function rescheduleBooking(input: {
  bookingId: string;
  startsAt: string;
  durationMinutes?: number;
  durationHours?: number;
  reason: string;
}): Promise<BookingActionResult> {
  await requireReception();

  const parsed = rescheduleInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const [schedule, current] = await Promise.all([loadSettingsSnapshot(supabase), findBooking(supabase, input.bookingId)]);
  if (current.outcome !== "found") return { ok: false, message: "That booking could not be read." };
  const moveRefusal = moveStartRefusal(current.booking.startsAt, parsed.data.startsAt, Date.now());
  if (moveRefusal) return { ok: false, message: moveRefusal };
  const duration = input.durationMinutes ?? (input.durationHours === undefined
    ? (Date.parse(current.booking.endsAt) - Date.parse(current.booking.startsAt)) / 60_000 : input.durationHours * 60);
  const hoursRefusal = openingHoursRefusal(schedule, input.startsAt, duration);
  if (hoursRefusal) return { ok: false, message: hoursRefusal };
  const result = await rescheduleBookingRpc(supabase, {
    ...input,
    reason: parsed.data.reason,
  });

  if (result.outcome === "ok") {
    revalidatePath(`/reception/bookings/${input.bookingId}`);
  }
  return toActionResult(result);
}

export async function extendBooking(input: {
  bookingId: string;
  extraMinutes: number;
  reason: string;
}): Promise<BookingActionResult> {
  await requireReception();

  const parsed = extensionInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const [schedule, current] = await Promise.all([loadSettingsSnapshot(supabase), findBooking(supabase, input.bookingId)]);
  if (current.outcome !== "found") return { ok: false, message: "That booking could not be read." };
  const duration = (Date.parse(current.booking.endsAt) - Date.parse(current.booking.startsAt)) / 60_000 + input.extraMinutes;
  const hoursRefusal = openingHoursRefusal(schedule, current.booking.startsAt, duration);
  if (hoursRefusal) return { ok: false, message: hoursRefusal };
  const result = await extendBookingRpc(supabase, {
    ...input,
    reason: parsed.data.reason,
  });

  if (result.outcome === "ok") {
    revalidatePath(`/reception/bookings/${input.bookingId}`);
  }
  return toActionResult(result);
}

const moveBookingSchema = z.object({
  bookingId: idSchema,
  suiteId: idSchema,
  startsAt: instantSchema,
  reason: reasonSchema,
});

const manualPriceSchema = z.object({
  bookingId: idSchema,
  totalFils: filsSchema,
  reason: reasonSchema,
});

const bufferOverrideSchema = cleaningBufferInput;

export async function moveBooking(input: {
  bookingId: string;
  suiteId: string;
  startsAt: string;
  reason: string;
}): Promise<BookingActionResult> {
  const session = await requireReception();

  const parsed = moveBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const [schedule, current] = await Promise.all([loadSettingsSnapshot(supabase), findBooking(supabase, parsed.data.bookingId)]);
  if (current.outcome !== "found") return { ok: false, message: "That booking could not be read." };
  const moveRefusal = moveStartRefusal(current.booking.startsAt, parsed.data.startsAt, Date.now());
  if (moveRefusal) return { ok: false, message: moveRefusal };
  const duration = (Date.parse(current.booking.endsAt) - Date.parse(current.booking.startsAt)) / 60_000;
  const hoursRefusal = openingHoursRefusal(schedule, parsed.data.startsAt, duration);
  if (hoursRefusal) return { ok: false, message: hoursRefusal };
  const result = await moveBookingRpc(supabase, {
    bookingId: parsed.data.bookingId,
    suiteId: parsed.data.suiteId,
    startsAt: parsed.data.startsAt,
    allowUnavailable: hasPermission(session, "override_suite_allocation"),
    reason: parsed.data.reason,
  });

  if (result.outcome === "ok") {
    revalidatePath(`/reception/bookings/${input.bookingId}`);
  }
  if (result.outcome === "no_suite") return { ok: false, message: `${SUITE_CONFLICT_MESSAGE} The original booking has been kept.` };
  return toActionResult(result);
}

export async function updateBookingDetails(input: {
  bookingId: string;
  personalRequest: string;
  internalNote: string;
  reason: string;
}): Promise<BookingActionResult> {
  await requireReception();

  const parsed = bookingNotesInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await createClient();
  const settings = await loadSettingsSnapshot(supabase);
  const maximum = requireSetting(settings, "booking.personal_request_max_length");
  if (parsed.data.personalRequest.length > maximum) return { ok: false, message: `Keep the special request to ${maximum} characters or fewer.` };
  const result = await updateBookingDetailsRpc(supabase, {
    ...input,
    reason: input.reason.trim(),
  });

  if (result.outcome === "ok") {
    revalidatePath(`/reception/bookings/${input.bookingId}`);
  }
  return toActionResult(result);
}

export async function updateInternalNote(input: {
  bookingId: string;
  internalNote: string;
}): Promise<BookingActionResult> {
  await requireReception();

  const parsed = bookingNotesInput.pick({ bookingId: true, internalNote: true }).safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await createClient();
  const current = await findBooking(supabase, parsed.data.bookingId);
  if (current.outcome !== "found") return { ok: false, message: "That booking could not be read." };

  const result = await updateBookingDetailsRpc(supabase, {
    bookingId: parsed.data.bookingId,
    personalRequest: current.booking.personalRequest ?? "",
    internalNote: parsed.data.internalNote,
    reason: "Internal note updated at Reception",
  });

  if (result.outcome === "ok") revalidatePath(`/reception/bookings/${parsed.data.bookingId}`);
  return toActionResult(result);
}

export async function recordArrival(
  bookingId: string,
  reason: string,
): Promise<BookingActionResult> {
  await requireReception();
  const parsed = stayInput.safeParse({ bookingId, reason });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const supabase = await createClient();
  const result = await recordStay(
    supabase,
    bookingId,
    { kind: "arrival", at: new Date().toISOString() },
    parsed.data.reason || "Guest arrived at the desk",
  );
  if (result.outcome === "ok") revalidatePath(`/reception/bookings/${bookingId}`);
  return toActionResult(result);
}

export async function checkIn(
  bookingId: string,
  reason: string,
): Promise<BookingActionResult> {
  await requireReception();
  const parsed = stayInput.safeParse({ bookingId, reason });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const supabase = await createClient();
  const result = await recordStay(
    supabase,
    bookingId,
    { kind: "check_in", at: new Date().toISOString() },
    parsed.data.reason || "Checked in at the desk",
  );
  if (result.outcome === "ok") revalidatePath(`/reception/bookings/${bookingId}`);
  return toActionResult(result);
}

export async function checkOut(
  bookingId: string,
  reason: string,
): Promise<BookingActionResult> {
  await requireReception();
  const parsed = stayInput.safeParse({ bookingId, reason });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const supabase = await createClient();
  const result = await recordStay(
    supabase,
    bookingId,
    { kind: "check_out", at: new Date().toISOString() },
    parsed.data.reason || "Checked out at the desk",
  );
  if (result.outcome === "ok") {
    revalidatePath(`/reception/bookings/${bookingId}`);
    revalidatePath("/reception");
  }
  return toActionResult(result);
}

export async function markNoShow(
  bookingId: string,
  reason: string,
): Promise<BookingActionResult> {
  await requireReception();

  const parsed = bookingReasonInput.safeParse({ bookingId, reason });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const result = await recordStay(
    supabase,
    bookingId,
    { kind: "no_show" },
    parsed.data.reason,
  );
  if (result.outcome === "ok") revalidatePath(`/reception/bookings/${bookingId}`);
  return toActionResult(result);
}

export async function recordOverrun(input: {
  bookingId: string;
  actualEnd: string;
  reason: string;
}): Promise<BookingActionResult> {
  await requireReception();

  const parsed = overrunInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const [snapshot, lookup] = await Promise.all([
    loadSettingsSnapshot(supabase),
    findBooking(supabase, input.bookingId),
  ]);

  if (lookup.outcome !== "found") {
    return { ok: false, message: "That booking could not be read." };
  }

  const booking = lookup.booking;
  const bookedMinutes =
    (new Date(booking.endsAt).getTime() - new Date(booking.startsAt).getTime()) /
    60_000;

  const tiers = await listPriceTiers(supabase);
  const rateSource = requireSetting(snapshot, "overrun.rate_source");
  const rateFor = (guestKind: "adult" | "child") =>
    tiers.ok
      ? overrunRatePerIncrementFils({
          tiers: tiers.tiers,
          guestKind,
          continuationHour: continuationHourOf(bookedMinutes),
          rateSource,
          incrementMinutes: requireSetting(snapshot, "overrun.increment_minutes"),
          fixedFilsPerIncrement: getSetting(
            snapshot,
            "overrun.fixed_fils_per_increment",
          ),
          roundingFils: requireSetting(snapshot, "pricing.rounding_fils"),
        })
      : null;

  const adultRateFils = rateFor("adult");
  const childRateFils = rateFor("child");

  const result = await recordOverrunRpc(
    supabase,
    input.bookingId,
    {
      actualEnd: input.actualEnd,
      adultRateFils,
      childRateFils,
      rateSource: adultRateFils === null && childRateFils === null ? null : rateSource,
    },
    parsed.data.reason,
  );

  if (result.outcome === "ok") {
    revalidatePath(`/reception/bookings/${input.bookingId}`);
  }
  return toActionResult(result);
}

export async function startCleaning(taskId: string): Promise<BookingActionResult> {
  await requireReception();
  const parsed = idSchema.safeParse(taskId);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const supabase = await createClient();
  const result = await startCleaningTaskRpc(supabase, taskId);
  if (result.outcome === "ok") revalidatePath("/reception");
  return toActionResult(result);
}

export async function assignCleaning(
  taskId: string,
  staffId: string,
): Promise<BookingActionResult> {
  await requireReception();
  const parsed = assignmentInput.extend({ staffId: idSchema }).safeParse({ taskId, staffId });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const supabase = await createClient();
  const result = await assignCleaningTaskRpc(supabase, taskId, staffId);
  if (result.outcome === "ok") revalidatePath("/reception");
  return toActionResult(result);
}

export async function confirmCleaning(
  taskId: string,
  note: string,
): Promise<BookingActionResult> {
  await requireReception();
  const parsed = cleaningConfirmationInput.safeParse({ taskId, note });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const supabase = await createClient();
  const result = await confirmCleaningTaskRpc(supabase, taskId, note);
  if (result.outcome === "ok") {
    revalidatePath("/reception");
  }
  return toActionResult(result);
}

export async function resolveAlert(
  alertId: string,
  note: string,
): Promise<BookingActionResult> {
  await requireReception();
  const parsed = alertResolutionInput.safeParse({ alertId, note });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const supabase = await createClient();
  const result = await resolveAlertRpc(supabase, alertId, note);
  if (result.outcome === "ok") {
    revalidatePath("/reception/alerts");
    revalidatePath("/reception");
  }
  return toActionResult(result);
}

export async function setTaskStatus(
  taskId: string,
  status: Database["public"]["Enums"]["task_status"],
  note: string,
): Promise<BookingActionResult> {
  await requireReception();
  const parsed = taskStatusInput.safeParse({ taskId, status, note });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const supabase = await createClient();
  const result = await updateTaskStatusRpc(supabase, { taskId, status, note });
  if (result.outcome === "ok") {
    revalidatePath("/reception/tasks");
    revalidatePath("/reception");
  }
  return toActionResult(result);
}

export async function addShiftNote(
  shiftOn: string,
  body: string,
): Promise<BookingActionResult> {
  await requireReception();

  const parsed = shiftNoteInput.safeParse({ shiftOn, body });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const result = await addShiftNoteRpc(supabase, parsed.data.shiftOn, parsed.data.body);
  if (result.outcome === "ok") { revalidatePath("/reception/tasks"); revalidatePath("/reception"); }
  return toActionResult(result);
}

export async function setSuiteStatus(input: {
  suiteId: string;
  status: Database["public"]["Enums"]["suite_status"];
  reason?: string;
}): Promise<BookingActionResult> {
  await requireReception();
  const parsed = suiteStatusChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await createClient();
  const result = await setSuiteStatusRpc(supabase, {
    ...parsed.data,
    reason: parsed.data.reason ?? consoleEdit("Suite status"),
  });
  if (result.outcome === "ok") {
    revalidatePath("/book");
    revalidatePath("/manage/suites");
    revalidatePath("/reception");
  }
  return toActionResult(result);
}

export async function setManualPrice(input: {
  bookingId: string;
  totalFils: number;
  reason: string;
}): Promise<BookingActionResult> {
  const session = await requireReception();

  if (!hasPermission(session, "manual_price_change")) {
    return {
      ok: false,
      message:
        "You do not have permission to change a price. Ask Management to grant it.",
    };
  }

  const parsed = manualPriceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const result = await setManualBookingPriceRpc(supabase, parsed.data);

  if (result.outcome === "ok") {
    revalidatePath(`/reception/bookings/${input.bookingId}`);
  }
  return toActionResult(result);
}

export async function markLateArrival(input: {
  bookingId: string;
  minutes: number;
  reason: string;
}): Promise<BookingActionResult> {
  await requireReception();

  const parsed = lateArrivalInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  if (!Number.isInteger(input.minutes) || input.minutes < 0) {
    return { ok: false, message: "Enter how many minutes late, as a whole number." };
  }

  const supabase = await createClient();
  const result = await markLateArrivalRpc(supabase, {
    bookingId: input.bookingId,
    minutes: input.minutes,
    reason: parsed.data.reason,
  });

  if (result.outcome === "ok") {
    revalidatePath(`/reception/bookings/${input.bookingId}`);
  }
  return toActionResult(result);
}

export async function overrideBookingBuffer(input: {
  bookingId: string;
  bufferMinutes: number;
  reason: string;
}): Promise<BookingActionResult> {
  await requireReception();

  const parsed = bufferOverrideSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const result = await overrideBookingBufferRpc(supabase, parsed.data);

  if (result.outcome === "ok") {
    revalidatePath(`/reception/bookings/${input.bookingId}`);
    revalidatePath("/reception");
  }
  return toActionResult(result);
}

export async function assignTask(
  taskId: string,
  staffId: string | null,
): Promise<BookingActionResult> {
  await requireReception();
  const parsed = assignmentInput.safeParse({ taskId, staffId });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const supabase = await createClient();
  const result = await assignTaskRpc(supabase, { taskId, staffId });
  if (result.outcome === "ok") { revalidatePath("/reception/tasks"); revalidatePath("/reception"); }
  return toActionResult(result);
}

export async function handOverShift(noteId: string): Promise<BookingActionResult> {
  await requireReception();
  const parsed = idSchema.safeParse(noteId);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const supabase = await createClient();
  const result = await handOverShiftRpc(supabase, noteId);
  if (result.outcome === "ok") { revalidatePath("/reception/tasks"); revalidatePath("/reception"); }
  return toActionResult(result);
}

export async function setCustomerWarning(input: {
  bookingId: string;
  customerId: string;
  warningNote: string | null;
  isBlocked: boolean;
  reason: string;
}): Promise<BookingActionResult> {
  const session = await requireReception();

  if (!hasPermission(session, "correct_customer_record")) {
    return {
      ok: false,
      message:
        "You do not have permission to change a customer record. Ask Management to grant it.",
    };
  }

  const parsed = customerWarningInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const result = await setCustomerWarningRpc(supabase, {
    customerId: input.customerId,
    warningNote: input.warningNote,
    isBlocked: input.isBlocked,
    reason: parsed.data.reason,
  });

  if (result.outcome === "ok") {
    revalidatePath(`/reception/bookings/${input.bookingId}`);
  }
  return toActionResult(result);
}

export async function voidPayment(input: {
  bookingId: string;
  paymentId: string;
  reason: string;
}): Promise<BookingActionResult> {
  await requireManagement();

  const parsed = bookingReasonInput.extend({ paymentId: idSchema }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const result = await voidBookingPaymentRpc(supabase, {
    paymentId: input.paymentId,
    reason: parsed.data.reason,
  });

  if (result.outcome === "ok") {
    revalidatePath(`/reception/bookings/${input.bookingId}`);
  }
  return toActionResult(result);
}

export async function createTask(input: {
  title: string;
  note: string;
  assignedTo: string | null;
  dueOn: string | null;
  priority: Database["public"]["Enums"]["task_priority"];
}): Promise<BookingActionResult> {
  await requireReception();

  const parsed = newTaskInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const result = await createTaskRpc(supabase, {
    title: parsed.data.title,
    note: input.note.trim(),
    assignedTo: input.assignedTo,
    dueOn: input.dueOn,
    priority: input.priority,
  });

  if (result.outcome === "ok") {
    revalidatePath("/reception/tasks");
    revalidatePath("/reception");
  }
  return toActionResult(result);
}

export async function takeCleaningTask(
  taskId: string,
): Promise<BookingActionResult> {
  const session = await requireReception();
  const parsed = idSchema.safeParse(taskId);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const supabase = await createClient();
  const result = await assignCleaningTaskRpc(supabase, taskId, session.userId);
  if (result.outcome === "ok") revalidatePath("/reception");
  return toActionResult(result);
}

export interface WalkInQuoteRequest {
  customerId?: string | null;
  startsAt: string;
  durationHours: number;
  adults: number;
  childAges: number[];
  addonQuantities: Record<string, number>;
  voucherCode: string | null;
}

export type WalkInQuoteResult =
  | {
      ok: true;
      breakdown: PricedBreakdown;
      cart: CartLine[];
      catalogue: AddonCatalogueItem[];
      voucherMessage: string | null;
    }
  | { ok: false; message: string };

export async function quoteWalkIn(
  request: WalkInQuoteRequest,
): Promise<WalkInQuoteResult> {
  await requireReception();

  const parsed = quoteReceptionInput.safeParse(request);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  request = { ...request, ...parsed.data };

  try {
    const supabase = await createClient();
    const snapshot = await loadSettingsSnapshot(supabase);

    const quote = await quoteBooking(supabase, snapshot, {
      startsAt: request.startsAt,
      durationHours: request.durationHours,
      adults: request.adults,
      childAges: request.childAges,
      addonQuantities: request.addonQuantities,
      voucherCode: request.voucherCode,
      customerId: request.customerId ?? null,
      manualTotalFils: null,
    });

    return {
      ok: true,
      breakdown: quote.breakdown,
      cart: [...quote.cart],
      catalogue: [...quote.catalogue],
      voucherMessage: quote.voucherMessage,
    };
  } catch (cause) {
    console.error("[reception] quoteWalkIn fault:", cause);
    return { ok: false, message: "The price could not be calculated." };
  }
}
