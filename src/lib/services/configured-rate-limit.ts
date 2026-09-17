import { requireSetting, type SettingsSnapshot } from "@/lib/config";
import { RATE_LIMIT_SETTINGS, type RateLimitScope } from "@/lib/config/rate-limits";
import { checkRateLimit } from "@/lib/services/rate-limit";

export function checkConfiguredRateLimit(scope: RateLimitScope, snapshot: SettingsSnapshot, key: string, now = Date.now()) {
  const policy = RATE_LIMIT_SETTINGS[scope];
  return checkRateLimit(key, requireSetting(snapshot, policy.count), requireSetting(snapshot, policy.window), now, requireSetting(snapshot, policy.enabled));
}
