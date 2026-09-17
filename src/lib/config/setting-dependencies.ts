import { requireSetting, type SettingsSnapshot } from "@/lib/config";
import { SETTINGS, type SettingKey } from "@/lib/config/registry";

export const SETTING_DEPENDENCIES: Readonly<Partial<Record<SettingKey, SettingKey>>> = {
  "security.waitlist_rate_limit_per_hour": "security.waitlist_rate_limit_enabled",
  "security.waitlist_rate_limit_window_minutes": "security.waitlist_rate_limit_enabled",
  "security.contact_rate_limit_per_hour": "security.contact_rate_limit_enabled",
  "security.contact_rate_limit_window_minutes": "security.contact_rate_limit_enabled",
  "security.availability_rate_limit_per_hour": "security.availability_rate_limit_enabled",
  "security.availability_rate_limit_window_minutes": "security.availability_rate_limit_enabled",
  "fees.tabby.percent": "fees.tabby.enabled",
  "fees.tabby.label": "fees.tabby.enabled",
  "urgency.threshold_few": "urgency.enabled",
  "urgency.threshold_last": "urgency.enabled",
  "urgency.text_few": "urgency.enabled",
  "urgency.text_last": "urgency.enabled",
  "urgency.text_filling": "urgency.enabled",
};

export function settingParent(key: string): SettingKey | undefined {
  return SETTING_DEPENDENCIES[key as SettingKey];
}

export function settingDisabledReason(key: string, snapshot: SettingsSnapshot): string | null {
  const parent = settingParent(key);
  return parent && requireSetting(snapshot, parent) === false
    ? `Turn on “${SETTINGS[parent].description}” to change this. Your saved value will be used when it is on.`
    : null;
}
