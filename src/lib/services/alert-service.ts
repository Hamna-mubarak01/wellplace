import { requireSetting, type SettingsSnapshot } from "@/lib/config";
import type { AlertThresholds } from "@/lib/domain/alerts";

export function thresholdsFrom(snapshot: SettingsSnapshot): AlertThresholds {
  return {
    holdExpiryWarningMinutes: requireSetting(
      snapshot,
      "reception.hold_expiry_warning_minutes",
    ),
    arrivalOverdueMinutes: requireSetting(
      snapshot,
      "reception.arrival_overdue_minutes",
    ),
    checkinOverdueMinutes: requireSetting(
      snapshot,
      "reception.checkin_overdue_minutes",
    ),
    cleaningConfirmMinutes: requireSetting(
      snapshot,
      "reception.cleaning_confirm_minutes",
    ),
  };
}
