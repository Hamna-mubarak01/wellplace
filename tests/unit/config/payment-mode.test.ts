import { describe, expect, it } from "vitest";

import { resolvePaymentMode } from "@/lib/config/payments";

describe("[§8; OUR CHOICE] how PAYMENT_MODE resolves in the demo", () => {
  it("defaults to the simulator when PAYMENT_MODE is not set", () => {
    expect(resolvePaymentMode({})).toBe("simulation");
  });

  it.each(["", "   "])("treats a blank PAYMENT_MODE %j as not set", (mode) => {
    expect(resolvePaymentMode({ PAYMENT_MODE: mode })).toBe("simulation");
  });

  it("keeps an explicit simulation", () => {
    expect(resolvePaymentMode({ PAYMENT_MODE: "simulation" })).toBe("simulation");
    expect(resolvePaymentMode({ PAYMENT_MODE: " simulation " })).toBe("simulation");
  });

  it("keeps an explicit disabled, so the site can run in waitlist mode", () => {
    expect(resolvePaymentMode({ PAYMENT_MODE: "disabled" })).toBe("disabled");
    expect(resolvePaymentMode({ PAYMENT_MODE: " disabled " })).toBe("disabled");
  });

  it.each(["stripe", "Simulation", "telr", "TELR", "live", "DISABLED"])(
    "falls back to the simulator for the unrecognised PAYMENT_MODE %j",
    (mode) => {
      expect(resolvePaymentMode({ PAYMENT_MODE: mode })).toBe("simulation");
    },
  );

  it("[Contract: no card acquirer ships with this demo; INV-08] never resolves to a live provider", () => {
    for (const mode of ["telr", "stripe", "checkout", "adyen"]) {
      expect(["simulation", "disabled"]).toContain(resolvePaymentMode({ PAYMENT_MODE: mode }));
    }
  });
});
