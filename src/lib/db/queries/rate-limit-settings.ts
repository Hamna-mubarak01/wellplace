import { z } from "zod";
import { createAdminClient } from "@/lib/db/admin";
import { snapshotFromRows, type SettingsSnapshot } from "@/lib/config";
import { RATE_LIMIT_SETTINGS } from "@/lib/config/rate-limits";

export async function loadRateLimitSettings(): Promise<{ ok: true; snapshot: SettingsSnapshot } | { ok: false; message: string }> {
  try {
    const client = createAdminClient();
    const keys = Object.values(RATE_LIMIT_SETTINGS).flatMap((policy) => [policy.enabled, policy.count, policy.window]);
    const { data, error } = await client.from("settings_snapshot").select("key, value").in("key", keys);
    if (error) return { ok: false, message: error.message };
    const rows = z.array(z.object({ key: z.string(), value: z.unknown() })).safeParse(data);
    if (!rows.success) return { ok: false, message: "Website request limits have an unexpected format." };
    return { ok: true, snapshot: snapshotFromRows(rows.data) };
  } catch (cause) {
    console.error("[settings] website request limits could not be read:", cause);
    return { ok: false, message: "Website request limits could not be loaded." };
  }
}
