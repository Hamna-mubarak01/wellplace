import { describe, expect, it, vi } from "vitest";
import { ACTION_UNCONFIRMED, databaseErrorMessage, readableActionMessage } from "@/lib/domain/action-errors";
import { rescheduleBooking } from "@/lib/db/rpc";
import type { WellPlaceClient } from "@/lib/db/types";

describe("[OUR CHOICE] plain English action failures", () => {
  it("explains rescheduling conflicts and the preserved booking without database details", () => {
    const message = databaseErrorMessage({ code: "WP016", message: "reschedule_booking: no suite is free for the new window [§7.6, INV-12]" });
    expect(message).toContain("whole visit and the cleaning time");
    expect(message).toContain("Choose a shorter visit");
    expect(message).toContain("original booking has been kept");
    expect(message).not.toMatch(/reschedule_booking|INV-|§/);
  });

  it.each([[6, 5], [9, 7]])("uses the database's current guest limit, not a hard-coded limit (%i/%i)", (count, maximum) => {
    const message = databaseErrorMessage({ code: "WP011", message: `create_reception_booking: ${count} guests is above booking.guests_max of ${maximum} [§6.1]` });
    expect(message).toContain(`${count} guests`);
    expect(message).toContain(`maximum is ${maximum}`);
    expect(message).toContain("Reduce the guest count");
  });

  it("distinguishes a changed customer profile from a blocked customer sharing the same code", () => {
    expect(databaseErrorMessage({ code: "WP012", message: "The selected customer has changed. Select the customer again." })).toContain("saved customer profile");
    expect(databaseErrorMessage({ code: "WP012", message: "create_reception_booking: this customer is blocked [§10.5]" })).toContain("blocked from booking");
  });

  it("keeps age requirements and missing acceptance actionable", () => {
    expect(databaseErrorMessage({ code: "WP011", message: "create_reception_booking: the booker is 17 and booking.booker_min_age is 21 [§6.2]" })).toContain("at least 21 years old");
    expect(databaseErrorMessage({ code: "WP011", message: "The guest must accept the current terms before booking." })).toContain("Confirm their acceptance");
  });

  it("does not claim nothing changed after an unknown response or transport error", () => {
    expect(databaseErrorMessage({ code: "XX000", message: "secret table details" })).toBe(ACTION_UNCONFIRMED);
    expect(ACTION_UNCONFIRMED).toContain("Check the latest booking or record before trying again");
    expect(ACTION_UNCONFIRMED).not.toMatch(/nothing was|original booking/i);
  });

  it.each([
    "duplicate key violates unique constraint staff_email_key",
    "permission denied for table bookings",
    "Could not find the function public.some_rpc in the schema cache",
    "create_reception_booking: p_adults must be positive [§6.2]",
    "Failed to fetch",
  ])("does not show technical diagnostics: %s", (message) => {
    expect(readableActionMessage(message)).toBe(ACTION_UNCONFIRMED);
  });

  it("preserves useful application text and translates a raw exclusion code", () => {
    expect(readableActionMessage("Enter a reason for changing the notes.")).toBe("Enter a reason for changing the notes.");
    expect(readableActionMessage("23P01 conflicting key suite_occupancy")).toContain("overlaps an existing reservation");
  });

  it("translates an actual RPC refusal without changing the exact requested duration", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "WP016", message: "reschedule_booking: no suite is free [INV-12]" } });
    const result = await rescheduleBooking({ rpc } as unknown as WellPlaceClient, {
      bookingId: "booking-id", startsAt: "2026-10-01T09:00:00Z", durationMinutes: 150, reason: "Guest requested a later start",
    });
    expect(rpc).toHaveBeenCalledWith("reschedule_booking", expect.objectContaining({ p_duration_minutes: 150 }));
    expect(rpc.mock.calls[0][1]).not.toHaveProperty("p_duration_hours");
    expect(result).toEqual({ outcome: "refused", code: "WP016", message: expect.stringContaining("original booking has been kept") });
  });
});
