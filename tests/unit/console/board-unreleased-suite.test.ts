import { describe, expect, it } from "vitest";

import {
  isCleaningOverdue,
  isSuiteUnreleased,
  overdueCleaningMinutes,
  overdueBufferForSuite,
  type BoardEntry,
  type BoardSuite,
} from "@/components/console/reception/board-types";

const BLOCKED_END = "2026-09-11T12:20:00.000Z";
const NOW = Date.parse("2026-09-11T12:35:00.000Z");

const entry = (over: Partial<BoardEntry> = {}): BoardEntry => ({
  id: "e1",
  suiteId: "s1",
  bookingId: "b1",
  bookingReference: "WP-0001",
  guestName: "A. Guest",
  state: "completed",
  experienceStart: "2026-09-11T09:00:00.000Z",
  experienceEnd: "2026-09-11T12:00:00.000Z",
  blockedEnd: BLOCKED_END,
  holdExpiresAt: null,
  reason: null,
  ...over,
});

const suite = (over: Partial<BoardSuite> = {}): BoardSuite => ({
  id: "s1",
  suiteNumber: 2,
  status: "cleaning",
  internalNote: null,
  ...over,
});

describe("[CLIENT] a suite that was not released when its cleaning time ended", () => {
  it("is overdue once the reserved cleaning time has passed and the suite is still cleaning", () => {
    expect(isCleaningOverdue(entry(), suite(), NOW)).toBe(true);
  });

  it("counts the minutes the desk is over, so the warning can say how late it is", () => {
    expect(overdueCleaningMinutes(entry(), NOW)).toBe(15);
  });

  it("is not overdue while the reserved cleaning time is still running", () => {
    expect(
      isCleaningOverdue(
        entry(),
        suite(),
        Date.parse("2026-09-11T12:10:00.000Z"),
      ),
    ).toBe(false);
  });

  it("is not overdue once the suite has been released, however late the release was", () => {
    expect(
      isCleaningOverdue(entry(), suite({ status: "available" }), NOW),
    ).toBe(false);
    expect(isCleaningOverdue(entry(), suite({ status: "booked" }), NOW)).toBe(
      false,
    );
  });

  it("treats a manual Not ready hold as unreleased too", () => {
    expect(
      isCleaningOverdue(entry(), suite({ status: "not_ready" }), NOW),
    ).toBe(true);
    expect(isSuiteUnreleased(suite({ status: "not_ready" }))).toBe(true);
    expect(isSuiteUnreleased(suite({ status: "maintenance" }))).toBe(false);
  });

  it("clears the moment an extended buffer reaches past now", () => {
    const extended = entry({ blockedEnd: "2026-09-11T12:50:00.000Z" });
    expect(isCleaningOverdue(extended, suite(), NOW)).toBe(false);
    expect(overdueCleaningMinutes(extended, NOW)).toBe(0);
  });

  it("ignores old buffers when a newer booking is using the suite", () => {
    const newer = entry({
      id: "new",
      experienceStart: "2026-09-11T12:30:00.000Z",
      experienceEnd: "2026-09-11T14:30:00.000Z",
      blockedEnd: "2026-09-11T14:50:00.000Z",
      state: "checked_in",
    });
    expect(
      overdueBufferForSuite([entry(), newer], suite(), NOW),
    ).toBeUndefined();
  });
  it("does not mark a closure or checkout hold as overdue cleaning", () => {
    expect(
      isCleaningOverdue(
        entry({ bookingId: null, state: "block" }),
        suite(),
        NOW,
      ),
    ).toBe(false);
    expect(isCleaningOverdue(entry({ state: "hold" }), suite(), NOW)).toBe(
      false,
    );
  });
  it("never reports overdue for a suite the board does not know", () => {
    expect(isCleaningOverdue(entry(), undefined, NOW)).toBe(false);
    expect(isSuiteUnreleased(undefined)).toBe(false);
  });
});
