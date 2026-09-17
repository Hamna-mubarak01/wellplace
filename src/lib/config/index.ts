import { FIXED_SETTING_KEYS } from "@/lib/config/fixed-settings";
import { SETTINGS, SETTING_KEYS, isSettingKey } from "@/lib/config/registry";
import type { SettingKey, SettingValue } from "@/lib/config/registry";

export { SETTINGS, SETTING_KEYS, isSettingKey };
export type { SettingKey, SettingValue };

export type SettingsSnapshot = Readonly<Record<string, unknown>>;

export const EMPTY_SNAPSHOT: SettingsSnapshot = Object.freeze({});

export function getSetting<K extends SettingKey>(
  snapshot: SettingsSnapshot,
  key: K,
  onInvalid?: (key: K, raw: unknown, message: string) => void,
): SettingValue<K> | null {
  const definition = SETTINGS[key];
  const raw = FIXED_SETTING_KEYS.some((fixed) => fixed === key) ? undefined : snapshot[key];

  if (raw === undefined || raw === null) {
    return (definition.defaultValue ?? null) as SettingValue<K> | null;
  }

  const parsed = definition.schema.safeParse(raw);
  if (parsed.success) return parsed.data as SettingValue<K>;

  onInvalid?.(key, raw, parsed.error.issues.map((i) => i.message).join("; "));
  return (definition.defaultValue ?? null) as SettingValue<K> | null;
}

export function requireSetting<K extends SettingKey>(
  snapshot: SettingsSnapshot,
  key: K,
): NonNullable<SettingValue<K>> {
  const value = getSetting(snapshot, key);
  if (value === null || value === undefined) {
    throw new Error(
      `Setting "${key}" has no value and no default. ` +
        `It is sourced from ${SETTINGS[key].source} and must be supplied before this path runs.`,
    );
  }
  return value as NonNullable<SettingValue<K>>;
}

export function unsetKeys(snapshot: SettingsSnapshot): SettingKey[] {
  return SETTING_KEYS.filter((key) => getSetting(snapshot, key) === null);
}

export function snapshotFromRows(
  rows: ReadonlyArray<{ key: string; value: unknown }>,
): SettingsSnapshot {
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    if (isSettingKey(row.key)) out[row.key] = row.value;
  }
  return Object.freeze(out);
}
