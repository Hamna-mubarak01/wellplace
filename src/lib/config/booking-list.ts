export const BOOKING_LIST = { pageSize: 25, searchDelayMs: 300 } as const;
export const BOOKING_PERIODS = ["all", "today"] as const;
export type BookingPeriod = (typeof BOOKING_PERIODS)[number];
export const BOOKING_PERIOD_LABEL = { all: "All bookings", today: "Today’s bookings" } as const;
export const ARRIVAL_FILTERS = ["expected", "arrived", "checked_in", "checked_out", "overdue"] as const;
export type ArrivalFilter = (typeof ARRIVAL_FILTERS)[number];
export const ARRIVAL_FILTER_LABEL = { expected: "Awaiting arrival", arrived: "Arrived · awaiting check-in", checked_in: "Checked in", checked_out: "Checked out", overdue: "Arrival overdue" } as const;
export function validBookingDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? value : undefined;
}

export const BOOKING_ACTIVITY_LABEL: Readonly<Record<string, string>> = {
  create_customer: "Customer created", complete_customer: "Customer details completed", correct_customer_record: "Customer profile corrected", set_customer_warning: "Customer warning updated",
  record_booking_payment: "Payment recorded", set_manual_booking_price: "Booking price changed", record_refund: "Refund recorded", confirm_refund_return: "Refund returned", request_refund: "Refund requested", resend_message: "Message requested again", queue_message: "Message queued",
  create_reception_booking: "Booking created", confirm_booking: "Booking confirmed",
  record_arrival: "Guest arrived", check_in_booking: "Checked in", check_out_booking: "Checked out",
  cancel_booking: "Booking cancelled", reschedule_booking: "Visit rescheduled", move_booking: "Suite or time changed",
  extend_booking: "Visit extended", mark_no_show: "Marked as no show", mark_late_arrival: "Late arrival recorded",
  record_overrun: "Overstay recorded", update_booking_details: "Booking details updated", override_booking_buffer: "Cleaning time changed",
};
