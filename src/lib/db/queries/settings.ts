import { z } from "zod";

import { snapshotFromRows, type SettingsSnapshot } from "@/lib/config";
import type { WellPlaceClient } from "@/lib/db/types";
import type { Json } from "@/types/database.generated";
import type { SettingKey } from "@/lib/config/registry";

const settingRowSchema = z.object({
  key: z.string(),
  value: z.unknown(),
});

export type SettingsLoad =
  | { ok: true; snapshot: SettingsSnapshot }
  | { ok: false; message: string };

export async function readSettingsSnapshot(
  client: WellPlaceClient,
  keys?: readonly SettingKey[],
): Promise<SettingsLoad> {
  let query = client
    .from("settings_snapshot")
    .select("key, value");
  if (keys) query = query.in("key", [...keys]);
  const { data, error } = await query;

  if (error) {
    return { ok: false, message: error.message };
  }

  const parsed = z.array(settingRowSchema).safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      message: `Unexpected shape from settings_snapshot: ${parsed.error.message}`,
    };
  }

  return { ok: true, snapshot: snapshotFromRows(parsed.data) };
}

export async function loadSettingsSnapshot(
  client: WellPlaceClient,
): Promise<SettingsSnapshot> {
  const load = await readSettingsSnapshot(client);

  if (!load.ok) {
    throw new Error(
      `Settings could not be read, so no business rule can be trusted on this request: ${load.message}`,
    );
  }

  return load.snapshot;
}

export interface SettingRecord {
  key: string;
  value: Json;
  valueType: string;
  sourceTag: string;
  description: string;
  updatedAt: string;
  isConfigured: boolean;
}

const settingRecordSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  value_type: z.string(),
  source_tag: z.string(),
  description: z.string(),
  updated_at: z.string(),
});

export type SettingsListing =
  | { ok: true; settings: SettingRecord[] }
  | { ok: false; message: string };

export async function listSettings(
  client: WellPlaceClient,
): Promise<SettingsListing> {
  const { data, error } = await client
    .from("settings_snapshot")
    .select("key, value, value_type, source_tag, description, updated_at")
    .order("key", { ascending: true });

  if (error) {
    return { ok: false, message: error.message };
  }

  const parsed = z.array(settingRecordSchema).safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      message: `Unexpected shape from settings_snapshot: ${parsed.error.message}`,
    };
  }

  return {
    ok: true,
    settings: parsed.data.map((row) => ({
      key: row.key,
      value: (row.value ?? null) as Json,
      valueType: row.value_type,
      sourceTag: row.source_tag,
      description: row.description,
      updatedAt: row.updated_at,
      isConfigured: row.value !== null && row.value !== undefined,
    })),
  };
}
