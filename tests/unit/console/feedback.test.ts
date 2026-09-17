import { describe, expect, it, vi } from "vitest";

const notifications = vi.hoisted(() => ({ error: vi.fn(() => "notification-id"), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: notifications }));
import { toast } from "@/lib/console/feedback";
import { ACTION_UNCONFIRMED } from "@/lib/domain/action-errors";

describe("[CLIENT] console errors use the standard toaster", () => {
  it("sends the explanation to Sonner and returns its notification identifier", () => {
    expect(toast.error("Booking could not be moved", { description: "Another booking overlaps this time." })).toBe("notification-id");
    expect(notifications.error).toHaveBeenCalledWith("Booking could not be moved", expect.objectContaining({ description: "Another booking overlaps this time." }));
  });

  it("updates one toast for duplicate reports and avoids an unjustified nothing-changed title", () => {
    toast.error("Nothing was changed", { description: ACTION_UNCONFIRMED });
    toast.error(ACTION_UNCONFIRMED);
    const [first, second] = notifications.error.mock.calls.slice(-2) as unknown as [string, { id: string; description: string }][];
    expect(first[0]).toBe("Check whether your change was saved");
    expect(first[1].description).toBe(ACTION_UNCONFIRMED);
    expect(second[1].id).toBe(first[1].id);
  });

  it.each(["The task was not created", "Booking could not be moved", "Not everything was blocked"])("does not claim a definite failure after a lost response: %s", (title) => {
    toast.error(title, { description: `The connection was interrupted. ${ACTION_UNCONFIRMED}` });
    expect(notifications.error).toHaveBeenLastCalledWith("Check whether your change was saved", expect.objectContaining({ description: expect.stringContaining("before trying again") }));
  });

  it("sanitizes database diagnostics before showing them", () => {
    toast.error("23505 duplicate key violates unique constraint bookings_pkey");
    expect(notifications.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ description: expect.stringContaining("already exists") }));
    expect(JSON.stringify(notifications.error.mock.calls.at(-1))).not.toContain("bookings_pkey");
  });

  it("preserves explicit toast options and normal success notifications", () => {
    toast.error("Choose a date.", { id: "booking-validation", duration: 8000 });
    expect(notifications.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ id: "booking-validation", duration: 8000 }));
    toast.success("Booking moved");
    expect(notifications.success).toHaveBeenCalledWith("Booking moved");
  });
});
