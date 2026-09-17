const RETIRED_SETTINGS = new Set(["cleaning.confirm_gates_availability", "booking.min_notice_minutes"]);
export function isRetiredSetting(key: string): boolean {
  return RETIRED_SETTINGS.has(key);
}
