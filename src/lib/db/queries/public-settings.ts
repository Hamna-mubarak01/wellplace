import { z } from "zod";

import { snapshotFromRows, type SettingsSnapshot } from "@/lib/config";
import type { WellPlaceClient } from "@/lib/db/types";


const rowSchema = z.object({ key: z.string(), value: z.unknown() });

export type PublicSettingsLoad =
  | { ok: true; snapshot: SettingsSnapshot }
  | { ok: false; message: string };

export async function loadPublicBookingSettings(
  client: WellPlaceClient,
): Promise<PublicSettingsLoad> {
  const { data, error } = await client
    .from("public_booking_settings")
    .select("key, value");

  if (error) return { ok: false, message: error.message };

  const parsed = z.array(rowSchema).safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      message: `Unexpected shape from public_booking_settings: ${parsed.error.message}`,
    };
  }

  return { ok: true, snapshot: snapshotFromRows(parsed.data) };
}
