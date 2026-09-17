import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  client: vi.fn(),
  find: vi.fn(),
  changes: vi.fn(),
  permission: vi.fn(),
  settings: vi.fn(),
  buffer: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  requireReception: mocks.guard,
  hasPermission: mocks.permission,
}));
vi.mock("@/lib/db/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/db/queries/bookings", () => ({ findBooking: mocks.find }));
vi.mock("@/lib/db/queries/booking-activity", () => ({
  readBookingChangeReasons: mocks.changes,
}));
vi.mock("@/lib/db/queries/cleaning-buffer", () => ({
  readCleaningBufferOptions: mocks.buffer,
}));
vi.mock("@/lib/db/queries/settings", () => ({
  loadSettingsSnapshot: mocks.settings,
}));
import {
  loadScheduleBooking,
  loadScheduleBuffer,
} from "@/app/(console)/reception/schedule-details";
const id = "00000000-0000-4000-8000-000000000001";

describe("[§9.2, §13] Reception quick booking details", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.guard.mockResolvedValue({ role: "reception" });
    mocks.client.mockResolvedValue({});
    mocks.changes.mockResolvedValue({ ok: true, events: [] });
  });
  it("checks reception access before reading guest data", async () => {
    mocks.guard.mockRejectedValue(new Error("Access denied"));
    await expect(loadScheduleBooking(id)).rejects.toThrow("Access denied");
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.changes).not.toHaveBeenCalled();
  });
  it("refuses an invalid booking identifier without a database call", async () => {
    expect((await loadScheduleBooking("bad-id")).outcome).toBe("failed");
    expect(mocks.find).not.toHaveBeenCalled();
  });
  it("does not turn a failed lookup into a blank booking", async () => {
    mocks.find.mockResolvedValue({
      outcome: "failed",
      message: "Database failure",
    });
    expect(await loadScheduleBooking(id)).toEqual({
      outcome: "failed",
      message: "Booking details could not be loaded. Please try again.",
    });
  });
  it("projects the operational details without unrelated customer IDs or acceptance records", async () => {
    mocks.find.mockResolvedValue({
      outcome: "found",
      booking: {
        guestEmail: "guest@example.test",
        guestPhone: "+971500000000",
        adults: 2,
        children: 0,
        totalFils: 66000,
        source: "online",
        addons: [],
        personalRequest: "Extra towel",
        internalNote: null,
        warningNote: null,
        guests: [],
        isComplimentary: false,
        customerId: "private-id",
        acceptance: [{}],
      },
    });
    mocks.changes.mockResolvedValue({
      ok: true,
      events: [
        { event_id: 1, action: "move_booking", reason: "Guest request" },
      ],
    });
    const result = await loadScheduleBooking(id);
    expect(result.outcome).toBe("found");
    if (result.outcome === "found") {
      expect(result.changes).toEqual({
        ok: true,
        events: [
          { event_id: 1, action: "move_booking", reason: "Guest request" },
        ],
      });
      expect(result.booking.guestEmail).toBe("guest@example.test");
      expect(result.booking.personalRequest).toBe("Extra towel");
      expect(result.booking).not.toHaveProperty("customerId");
      expect(result.booking).not.toHaveProperty("acceptance");
    }
  });
});

describe("[CLIENT] Cleaning buffer opened from the schedule", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.guard.mockResolvedValue({ role: "reception" });
    mocks.client.mockResolvedValue({});
    mocks.buffer.mockResolvedValue({
      bookingId: id,
      currentMinutes: 45,
      defaultMinutes: 30,
      maxMinutes: 480,
      limitKind: "closing",
      limitAt: "2026-09-11T18:00:00.000Z",
      endsAt: "2026-09-11T10:00:00.000Z",
      canEdit: true,
      canShorten: false,
      message: null,
    });
    mocks.find.mockResolvedValue({
      outcome: "found",
      booking: {
        id,
        status: "confirmed",
        cleaningBufferMinutes: 45,
        endsAt: "2026-09-11T08:00:00.000Z",
        guestEmail: "private@example.test",
      },
    });
  });
  it("requires Reception access before reading the buffer", async () => {
    mocks.guard.mockRejectedValue(new Error("Access denied"));
    await expect(loadScheduleBuffer(id)).rejects.toThrow("Access denied");
    expect(mocks.find).not.toHaveBeenCalled();
  });
  it("returns live available minutes without unrelated guest information", async () => {
    const result = await loadScheduleBuffer(id);
    expect(result).toMatchObject({
      outcome: "found",
      options: {
        currentMinutes: 45,
        defaultMinutes: 30,
        maxMinutes: 480,
        canEdit: true,
        canShorten: false,
      },
    });
    expect(mocks.buffer).toHaveBeenCalledWith({}, id);
    expect(mocks.find).not.toHaveBeenCalled();
  });
  it("does not invent an editable buffer when its limits could not be read", async () => {
    mocks.buffer.mockRejectedValue(new Error("Database unavailable"));
    expect(await loadScheduleBuffer(id)).toMatchObject({ outcome: "failed" });
  });
});
