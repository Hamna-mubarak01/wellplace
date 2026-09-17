import { describe, expect, it } from "vitest";

import {
  BOOKING_STATUSES,
  allowedActions,
  canPerform,
  canTransition,
  isActiveClaim,
  isTerminal,
  nextStatuses,
  statusAfter,
  type BookingStatus,
} from "@/lib/domain/booking";

describe("SYSTEM.md 4.4 — the booking state machine", () => {
  it("never lets a terminal booking move again", () => {
    const terminal: BookingStatus[] = [
      "completed",
      "rescheduled",
      "cancelled",
      "no_show",
      "abandoned",
    ];

    for (const status of terminal) {
      expect(isTerminal(status)).toBe(true);
      expect(nextStatuses(status)).toHaveLength(0);

      for (const action of allowedActions(status)) {
        expect(statusAfter(action, status)).toBe(status);
      }
    }
  });

  it("still records an overrun against a completed booking, which changes no status", () => {
    expect(allowedActions("completed")).toEqual(["record_overrun"]);
    expect(statusAfter("record_overrun", "completed")).toBe("completed");
  });

  it("names a transition table entry for every status", () => {
    for (const status of BOOKING_STATUSES) {
      expect(() => nextStatuses(status)).not.toThrow();
    }
  });

  it("walks the happy path draft to completed", () => {
    expect(canTransition("draft", "held")).toBe(true);
    expect(canTransition("held", "awaiting_payment")).toBe(true);
    expect(canTransition("awaiting_payment", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "checked_in")).toBe(true);
    expect(canTransition("checked_in", "completed")).toBe(true);
  });

  it("refuses to skip a step", () => {
    expect(canTransition("draft", "confirmed")).toBe(false);
    expect(canTransition("held", "checked_in")).toBe(false);
    expect(canTransition("confirmed", "completed")).toBe(false);
  });
});

describe("§16.1 — a failed payment can be retried until the hold expires", () => {
  it("returns a failed payment to awaiting payment", () => {
    expect(canPerform("request_payment", "payment_failed")).toBe(true);
    expect(statusAfter("request_payment", "payment_failed")).toBe("awaiting_payment");
  });

  it("still allows the hold to expire out from under a retry", () => {
    expect(statusAfter("expire_hold", "payment_failed")).toBe("hold_expired");
  });

  it("does not allow a retry once the hold has expired", () => {
    expect(canPerform("request_payment", "hold_expired")).toBe(false);
  });
});

describe("§8.2 — a paying guest is never left silently without a suite", () => {
  it("routes an expired hold into recovery and out again to confirmed", () => {
    expect(statusAfter("recover", "hold_expired")).toBe("awaiting_recovery");
    expect(statusAfter("confirm", "awaiting_recovery")).toBe("confirmed");
  });

  it("[§8.2] moves a paid booking that lost its suite straight into recovery", () => {
    expect(statusAfter("recover", "awaiting_payment")).toBe("awaiting_recovery");
    expect(statusAfter("recover", "payment_failed")).toBe("awaiting_recovery");
    expect(canTransition("awaiting_payment", "awaiting_recovery")).toBe(true);
    expect(canTransition("payment_failed", "awaiting_recovery")).toBe(true);
  });

  it("allows recovery to end in a cancellation when no suite exists", () => {
    expect(canTransition("awaiting_recovery", "cancelled")).toBe(true);
  });
});

describe("§9.2 — the Reception actions each have a legal starting state", () => {
  it("checks in only a confirmed booking", () => {
    expect(canPerform("check_in", "confirmed")).toBe(true);
    expect(canPerform("check_in", "checked_in")).toBe(false);
    expect(canPerform("check_in", "cancelled")).toBe(false);
  });

  it("checks out only a checked-in booking", () => {
    expect(canPerform("check_out", "checked_in")).toBe(true);
    expect(canPerform("check_out", "confirmed")).toBe(false);
  });

  it("marks a no-show only before check-in", () => {
    expect(canPerform("mark_no_show", "confirmed")).toBe(true);
    expect(canPerform("mark_no_show", "checked_in")).toBe(false);
  });

  it("extends a booking that is confirmed or already in the suite, without changing status", () => {
    expect(statusAfter("extend", "confirmed")).toBe("confirmed");
    expect(statusAfter("extend", "checked_in")).toBe("checked_in");
    expect(canPerform("extend", "completed")).toBe(false);
  });

  it("records an arrival without moving the booking on", () => {
    expect(statusAfter("record_arrival", "confirmed")).toBe("confirmed");
  });

  it("records an overrun while in the suite or after checkout", () => {
    expect(canPerform("record_overrun", "checked_in")).toBe(true);
    expect(canPerform("record_overrun", "completed")).toBe(true);
    expect(canPerform("record_overrun", "confirmed")).toBe(false);
  });

  it("returns null for an action that is illegal from the current status", () => {
    expect(statusAfter("check_out", "confirmed")).toBeNull();
  });

  it("cancels from every live state but never from a terminal one", () => {
    expect(canPerform("cancel", "confirmed")).toBe(true);
    expect(canPerform("cancel", "held")).toBe(true);
    expect(canPerform("cancel", "completed")).toBe(false);
    expect(canPerform("cancel", "no_show")).toBe(false);
  });
});

describe("INV-02 — only a live booking claims a suite", () => {
  it("counts held, awaiting payment, failed payment, confirmed and checked in as claims", () => {
    expect(isActiveClaim("held")).toBe(true);
    expect(isActiveClaim("awaiting_payment")).toBe(true);
    expect(isActiveClaim("payment_failed")).toBe(true);
    expect(isActiveClaim("confirmed")).toBe(true);
    expect(isActiveClaim("checked_in")).toBe(true);
  });

  it("releases the suite for every other status", () => {
    expect(isActiveClaim("hold_expired")).toBe(false);
    expect(isActiveClaim("cancelled")).toBe(false);
    expect(isActiveClaim("no_show")).toBe(false);
    expect(isActiveClaim("completed")).toBe(false);
    expect(isActiveClaim("abandoned")).toBe(false);
  });
});
