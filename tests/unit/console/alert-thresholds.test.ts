import { describe, expect, it } from "vitest";

import { EMPTY_SNAPSHOT } from "@/lib/config";
import { thresholdsFrom } from "@/lib/services/alert-service";
import { ALERT_KINDS, ALERT_SEVERITY } from "@/lib/domain/alerts";
import { ALERT_LABEL } from "@/components/console/reception/alert-list";

describe("§9.3 — the alert sweep reads its thresholds from configuration", () => {
  it("resolves all four from the registry, never a literal", () => {
    expect(thresholdsFrom(EMPTY_SNAPSHOT)).toEqual({
      holdExpiryWarningMinutes: 3,
      arrivalOverdueMinutes: 10,
      checkinOverdueMinutes: 15,
      cleaningConfirmMinutes: 30,
    });
  });

  it("labels every alert kind the console can render", () => {
    for (const kind of ALERT_KINDS) {
      expect(ALERT_LABEL[kind], kind).toBeTruthy();
      expect(ALERT_SEVERITY[kind], kind).toBeTruthy();
    }
  });

  it("keeps the label map to exactly the kinds the database knows", () => {
    expect(Object.keys(ALERT_LABEL).toSorted()).toEqual([...ALERT_KINDS].toSorted());
  });
});
