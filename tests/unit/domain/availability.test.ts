import { describe, expect, it } from "vitest";

import { EMPTY_SNAPSHOT, requireSetting } from "@/lib/config";
import { dayAvailabilityMessage, timeTileState, type UrgencyConfig } from "@/lib/domain/availability";

const config = (over: Partial<UrgencyConfig> = {}): UrgencyConfig => ({
  enabled: requireSetting(EMPTY_SNAPSHOT, "urgency.enabled"),
  thresholdFew: requireSetting(EMPTY_SNAPSHOT, "urgency.threshold_few"),
  thresholdLast: requireSetting(EMPTY_SNAPSHOT, "urgency.threshold_last"),
  textFew: requireSetting(EMPTY_SNAPSHOT, "urgency.text_few"),
  textLast: requireSetting(EMPTY_SNAPSHOT, "urgency.text_last"),
  textNone: requireSetting(EMPTY_SNAPSHOT, "urgency.text_none"),
  textFilling: requireSetting(EMPTY_SNAPSHOT, "urgency.text_filling"),
  ...over,
});

describe("§7.4 — the configured defaults are the contract's own words", () => {
  it("carries the four texts verbatim", () => {
    const defaults = config();
    expect(defaults.textFew).toBe("Only a few slots available");
    expect(defaults.textLast).toBe("Last availability for this time");
    expect(defaults.textNone).toBe("Fully booked");
    expect(defaults.textFilling).toBe("This time is booking up");
    expect(defaults.thresholdFew).toBe(5);
    expect(defaults.thresholdLast).toBe(3);
  });
});

describe("§7.4 — '0 available: disable the time and propose the next genuinely available times'", () => {
  it("disables the tile and shows 'Fully booked'", () => {
    const tile = timeTileState({ remaining: 0, reducedByDemand: true, urgency: config() });
    expect(tile.disabled).toBe(true);
    expect(tile.message).toBe("Fully booked");
  });

  it("still disables and still says 'Fully booked' when urgency is switched off", () => {
    const tile = timeTileState({
      remaining: 0,
      reducedByDemand: true,
      urgency: config({ enabled: false }),
    });
    expect(tile.disabled).toBe(true);
    expect(tile.message).toBe("Fully booked");
  });
});

describe("§7.4 — '3 available: Last availability for this time'", () => {
  it("shows the last-availability text at the threshold", () => {
    const tile = timeTileState({ remaining: 3, reducedByDemand: true, urgency: config() });
    expect(tile.disabled).toBe(false);
    expect(tile.message).toBe("Last availability for this time");
  });

  it("shows it below the threshold too", () => {
    for (const remaining of [1, 2]) {
      expect(timeTileState({ remaining, reducedByDemand: true, urgency: config() }).message).toBe(
        "Last availability for this time",
      );
    }
  });
});

describe("§7.4 — '5 available: Only a few slots available'", () => {
  it("shows the few-slots text at the threshold", () => {
    const tile = timeTileState({ remaining: 5, reducedByDemand: true, urgency: config() });
    expect(tile.disabled).toBe(false);
    expect(tile.message).toBe("Only a few slots available");
  });

  it("is outranked by the last-availability text when both would apply", () => {
    expect(timeTileState({ remaining: 3, reducedByDemand: true, urgency: config() }).message).toBe(
      "Last availability for this time",
    );
  });

  it("says nothing at all when capacity is comfortable", () => {
    const tile = timeTileState({ remaining: 7, reducedByDemand: false, urgency: config() });
    expect(tile.disabled).toBe(false);
    expect(tile.message).toBeNull();
  });

  it("reports a threshold message even when suites are out of service rather than booked", () => {
    const tile = timeTileState({ remaining: 4, reducedByDemand: false, urgency: config() });
    expect(tile.message).toBe("Only a few slots available");
  });
});

describe("§7.4 — 'This time is booking up' may appear ONLY when the reduced capacity is at least partly caused by confirmed bookings or active holds", () => {
  it("[CLIENT] retires the booking-up message even when demand reduced capacity", () => {
    const tile = timeTileState({ remaining: 6, reducedByDemand: true, urgency: config() });
    expect(tile.message).toBeNull();
  });

  it("never appears when capacity was reduced by maintenance or a block alone", () => {
    const tile = timeTileState({ remaining: 6, reducedByDemand: false, urgency: config() });
    expect(tile.message).toBeNull();
  });

  it("never appears at full capacity", () => {
    const tile = timeTileState({ remaining: 7, reducedByDemand: false, urgency: config() });
    expect(tile.message).toBeNull();
  });
});

describe("§7.4 — 'Management may configure the activation status, thresholds and text'", () => {
  it("suppresses every urgency message when switched off, leaving the tile bookable", () => {
    for (const remaining of [1, 3, 5, 6]) {
      const tile = timeTileState({
        remaining,
        reducedByDemand: true,
        urgency: config({ enabled: false }),
      });
      expect(tile.disabled).toBe(false);
      expect(tile.message).toBeNull();
    }
  });

  it("honours retuned thresholds", () => {
    const retuned = config({ thresholdFew: 3, thresholdLast: 1 });
    expect(timeTileState({ remaining: 3, reducedByDemand: true, urgency: retuned }).message).toBe(
      "Only a few slots available",
    );
    expect(timeTileState({ remaining: 1, reducedByDemand: true, urgency: retuned }).message).toBe(
      "Last availability for this time",
    );
  });

  it("honours rewritten text", () => {
    const rewritten = config({ textLast: "Almost gone" });
    expect(timeTileState({ remaining: 2, reducedByDemand: true, urgency: rewritten }).message).toBe(
      "Almost gone",
    );
  });

  it("survives thresholds Management has set the wrong way round", () => {
    const rank = { null: 0, "This time is booking up": 1, "Only a few slots available": 2, "Last availability for this time": 3, "Fully booked": 4 } as const;
    const severity = (message: string | null) => rank[String(message) as keyof typeof rank];

    for (const urgency of [config(), config({ thresholdFew: 2, thresholdLast: 5 })]) {
      const ladder = [7, 6, 5, 4, 3, 2, 1, 0].map((remaining) =>
        severity(timeTileState({ remaining, reducedByDemand: true, urgency }).message),
      );

      for (let i = 1; i < ladder.length; i++) {
        expect(ladder[i]).toBeGreaterThanOrEqual(ladder[i - 1]);
      }
    }
  });
});

describe("§7.4 — 'After a time has been selected and secured, the ten-minute hold countdown must be displayed clearly instead'", () => {
  const securedUntil = new Date("2026-09-01T07:10:00.000Z");

  it("replaces the urgency message with the countdown", () => {
    const tile = timeTileState({
      remaining: 2,
      reducedByDemand: true,
      urgency: config(),
      securedUntil,
    });
    expect(tile.kind).toBe("secured");
    expect(tile.message).toBeNull();
    expect(tile.securedUntil).toEqual(securedUntil);
    expect(tile.disabled).toBe(false);
  });

  it("holds the tile open even though this guest took the last suite", () => {
    const tile = timeTileState({
      remaining: 0,
      reducedByDemand: true,
      urgency: config(),
      securedUntil,
    });
    expect(tile.kind).toBe("secured");
    expect(tile.disabled).toBe(false);
  });
});

describe("INV-01 — guests never see suite numbers or total capacity", () => {
  it("returns no count, no capacity and no suite identity", () => {
    const tile = timeTileState({ remaining: 3, reducedByDemand: true, urgency: config() });
    const serialised = JSON.stringify(tile);

    expect(Object.keys(tile).sort()).toEqual(["disabled", "kind", "message", "securedUntil"]);
    expect(serialised).not.toMatch(/remaining|capacity|suite/i);
    expect(serialised).not.toMatch(/\b[0-9]+\b/);
  });
});


describe("[CLIENT] Independent notices", () => {
  it("keeps sold-out times disabled when their label is off", () => {
    const result = timeTileState({ remaining: 0, reducedByDemand: false, urgency: config({ noneEnabled: false, mode: "general", textGeneral: "Choose your time" }) });
    expect(result.disabled).toBe(true);
    expect(result.message).toBeNull();
  });
  it("disables messages independently and falls back to the enabled threshold", () => {
    const tile = (remaining: number, options: Partial<UrgencyConfig>) => timeTileState({ remaining, reducedByDemand: true, urgency: config(options) }).message;
    expect(tile(2, { lastEnabled: false })).toBe("Only a few slots available");
    expect(tile(4, { fewEnabled: false })).toBeNull();
    expect(tile(2, { fewEnabled: false })).toBe("Last availability for this time");
    expect(tile(1, { lastEnabled: false, fewEnabled: false })).toBeNull();
  });
  it("uses general wording independently of capacity without changing availability", () => {
    for (const remaining of [1, 3, 7]) {
      const result = timeTileState({ remaining, reducedByDemand: false, urgency: config({ mode: "general", textGeneral: "Choose your preferred time" }) });
      expect(result.message).toBe("Choose your preferred time");
      expect(result.disabled).toBe(false);
    }
  });
});

describe("[Project owner's direction 2026-09-12] the booking page shows an availability tagline before a time is chosen", () => {
  it("says only a few slots are available when the scarcest bookable time on the date has few suites left", () => {
    expect(dayAvailabilityMessage([7, 7, 4, 6], config())).toBe("Only a few slots available");
    expect(dayAvailabilityMessage([7, 2, 7], config())).toBe("Only a few slots available");
  });

  it("stays silent when every bookable time on the date has plenty of suites, because the message must reflect real capacity", () => {
    expect(dayAvailabilityMessage([7, 6, 7], config())).toBeNull();
  });

  it("ignores fully booked times and says nothing for a date with no bookable time", () => {
    expect(dayAvailabilityMessage([0, 7, 0], config())).toBeNull();
    expect(dayAvailabilityMessage([0, 0], config())).toBeNull();
    expect(dayAvailabilityMessage([], config())).toBeNull();
  });

  it("follows the manager's switches and wording", () => {
    expect(dayAvailabilityMessage([4], config({ enabled: false }))).toBeNull();
    expect(dayAvailabilityMessage([4], config({ fewEnabled: false }))).toBeNull();
    expect(dayAvailabilityMessage([2], config({ fewEnabled: false }))).toBe("Last availability for this time");
    expect(dayAvailabilityMessage([4], config({ textFew: "Filling fast" }))).toBe("Filling fast");
  });

  it("shows the general message on any date with a bookable time when the manager chose one message for every time", () => {
    const general = config({ mode: "general", textGeneral: "Choose your preferred time" });
    expect(dayAvailabilityMessage([7, 7], general)).toBe("Choose your preferred time");
    expect(dayAvailabilityMessage([0], general)).toBeNull();
    expect(dayAvailabilityMessage([7], config({ mode: "general", textGeneral: "  " }))).toBeNull();
  });
});
