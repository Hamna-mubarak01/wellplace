import { z } from "zod";
import {
  ALERT_NOTE_MAX_LENGTH, BOOKING_NOTE_MAX_LENGTH, CLEANING_BUFFER_MINUTES,
  CLEANING_NOTE_MAX_LENGTH, EXTENSION_MINUTES, GUEST_WARNING_MAX_LENGTH,
  LATE_ARRIVAL_MINUTES, PAYMENT_NOTE_MAX_LENGTH, PAYMENT_REFERENCE_MAX_LENGTH,
  REASON_MAX_LENGTH, RESCHEDULE_MINUTES, SHIFT_NOTE_MAX_LENGTH, SPECIAL_REQUEST_MAX_LENGTH,
  TASK_NOTE_MAX_LENGTH, TASK_TITLE_MAX_LENGTH,
} from "@/lib/config/console-limits";
import { idSchema, instantSchema } from "@/lib/validation/console-inputs";
import { reasonSchema } from "@/lib/validation/audit-reason";
import { receptionBookingSchema } from "@/lib/validation/reception-booking";

export const limitedNote = (label: string, maximum: number) => z.string().trim().max(maximum, `Keep ${label.toLowerCase()} to ${maximum} characters or fewer.`);
const minutes = (label: string, bounds: { min: number; max: number }) => z.number({ error: `Enter ${label.toLowerCase()} as a number.` }).int(`Enter ${label.toLowerCase()} in whole minutes.`).min(bounds.min, `${label} must be at least ${bounds.min} minute${bounds.min === 1 ? "" : "s"}.`).max(bounds.max, `${label} cannot exceed ${bounds.max} minutes.`);

export const extensionInput = z.object({ bookingId: idSchema, extraMinutes: minutes("Extra time", EXTENSION_MINUTES), reason: reasonSchema });
export const lateArrivalInput = z.object({ bookingId: idSchema, minutes: minutes("Late arrival", LATE_ARRIVAL_MINUTES), reason: reasonSchema });
export const cleaningBufferInput = z.object({ bookingId: idSchema, bufferMinutes: minutes("Cleaning time", CLEANING_BUFFER_MINUTES), reason: reasonSchema });
export const bookingNotesInput = z.object({ bookingId: idSchema, personalRequest: limitedNote("Special requests", SPECIAL_REQUEST_MAX_LENGTH), internalNote: limitedNote("Booking notes", BOOKING_NOTE_MAX_LENGTH), reason: reasonSchema });
export const cleaningConfirmationInput = z.object({ taskId: idSchema, note: limitedNote("Cleaning notes", CLEANING_NOTE_MAX_LENGTH) });
export const alertResolutionInput = z.object({ alertId: idSchema, note: limitedNote("Alert notes", ALERT_NOTE_MAX_LENGTH) });
export const taskStatusInput = z.object({ taskId: idSchema, status: z.enum(["open", "in_progress", "done", "cancelled"]), note: limitedNote("Task notes", TASK_NOTE_MAX_LENGTH) });
export const shiftNoteInput = z.object({ shiftOn: z.iso.date("Choose a valid shift date."), body: limitedNote("Shift notes", SHIFT_NOTE_MAX_LENGTH).min(1, "Write the note before saving it.") });
export const newTaskInput = z.object({
  title: limitedNote("Task titles", TASK_TITLE_MAX_LENGTH).min(1, "Give the task a title."),
  note: limitedNote("Task notes", TASK_NOTE_MAX_LENGTH), assignedTo: idSchema.nullable(),
  dueOn: z.iso.date("Choose a valid due date.").nullable(), priority: z.enum(["low", "normal", "high", "urgent"]),
});
export const customerWarningInput = z.object({ bookingId: idSchema, customerId: idSchema, warningNote: limitedNote("Customer warnings", GUEST_WARNING_MAX_LENGTH).nullable(), isBlocked: z.boolean(), reason: reasonSchema });
export const overrunInput = z.object({ bookingId: idSchema, actualEnd: instantSchema, reason: reasonSchema });
export const paymentReferenceInput = limitedNote("Payment references", PAYMENT_REFERENCE_MAX_LENGTH);
export const paymentNoteInput = limitedNote("Payment notes", PAYMENT_NOTE_MAX_LENGTH);
export const optionalReasonInput = limitedNote("Reasons", REASON_MAX_LENGTH);

export const rescheduleInput = z.object({ bookingId: idSchema, startsAt: instantSchema, durationMinutes: minutes("Visit length", RESCHEDULE_MINUTES).optional(), durationHours: z.number().int().positive().max(RESCHEDULE_MINUTES.max / 60).optional(), reason: reasonSchema }).refine((input) => input.durationMinutes === undefined || input.durationHours === undefined || input.durationMinutes === input.durationHours * 60, "The two visit lengths do not match. Select the duration again.");
export const bookingReasonInput = z.object({ bookingId: idSchema, reason: reasonSchema });
export const stayInput = z.object({ bookingId: idSchema, reason: optionalReasonInput });
export const assignmentInput = z.object({ taskId: idSchema, staffId: idSchema.nullable() });
export const quoteReceptionInput = receptionBookingSchema.pick({ startsAt: true, durationHours: true, adults: true, customerId: true }).extend({
  childAges: z.array(receptionBookingSchema.shape.children.element.shape.age),
  addonQuantities: z.record(idSchema, z.number().int().nonnegative()),
  voucherCode: receptionBookingSchema.shape.voucherCode.nullable(),
});
