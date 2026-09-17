"use server";

import { validateSettingsPanel } from "@/lib/validation/settings-panel";
import { setSettingsGroup } from "@/lib/db/rpc";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { settingParent, settingDisabledReason } from "@/lib/config/setting-dependencies";
import { readSettingsSnapshot } from "@/lib/db/queries/settings";
import { consoleEdit } from "@/lib/validation/audit-reason";

import { requireManagement } from "@/lib/auth/session";
import { SETTINGS, isSettingKey } from "@/lib/config/registry";
import { isRetiredSetting } from "@/lib/config/retired-settings";
import { isManagerSetting } from "@/lib/config/settings-presentation";
import { overstayFormSchema } from "@/lib/config/overstay";
import { createClient } from "@/lib/db/server";
import {
  MANAGEMENT_SETTING_TYPE_MISMATCH,
  MANAGEMENT_UNKNOWN_SETTING,
  setSetting,
  setOverstayCharges,
  type BookingMutation,
} from "@/lib/db/rpc";
import type { Json } from "@/types/database.generated";

export type SettingActionResult = { ok: true } | { ok: false; message: string };

const saveSchema = z.object({
  key: z.string().trim().min(1, "Choose a setting to change."),
  value: z.json().nullable(),
});

function refreshSurfaces(): void {
  revalidatePath("/manage/settings");
  revalidatePath("/manage/suites");
  revalidatePath("/reception");
  revalidatePath("/reception/board");
  revalidatePath("/reception/bookings");
  revalidatePath("/reception/bookings/[id]", "page");
  revalidatePath("/book");
  revalidatePath("/contact");
  revalidatePath("/");
}

function toResult<T>(result: BookingMutation<T>): SettingActionResult {
  switch (result.outcome) {
    case "ok":
      refreshSurfaces();
      return { ok: true };
    case "refused":
      if (result.code === MANAGEMENT_UNKNOWN_SETTING) {
        return {
          ok: false,
          message:
            "That setting cannot be changed here.",
        };
      }
      if (result.code === MANAGEMENT_SETTING_TYPE_MISMATCH) {
        return { ok: false, message: result.message };
      }
      return { ok: false, message: result.message };
    case "no_suite":
      return { ok: false, message: "The setting was not changed." };
    case "failed":
      return { ok: false, message: result.message };
  }
}

export async function saveSetting(input: {
  key: string;
  value: unknown;
}): Promise<SettingActionResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  if (isRetiredSetting(parsed.data.key)) {
    return { ok: false, message: "This setting has been removed. Refresh the settings page." };
  }

  if (!isManagerSetting(parsed.data.key)) return { ok: false, message: "This option is not available in Settings." };

  let value: unknown = parsed.data.value;
  if (parsed.data.value !== null && isSettingKey(parsed.data.key)) {
    const shape = SETTINGS[parsed.data.key].schema.safeParse(parsed.data.value);

    if (!shape.success) {
      const detail = shape.error.issues
        .map((issue) =>
          issue.path.length > 0
            ? `${issue.path.join(" → ")}: ${issue.message}`
            : issue.message,
        )
        .join(". ");

      return {
        ok: false,
        message: `That value does not fit this setting. ${detail}.`,
      };
    }
    value = shape.data as Json;
  }

  await requireManagement();
  const supabase = await createClient();

  if (settingParent(parsed.data.key)) {
    const settings = await readSettingsSnapshot(supabase);
    if (!settings.ok) return { ok: false, message: "Settings could not be checked. Refresh and try again." };
    const disabledReason = settingDisabledReason(parsed.data.key, settings.snapshot);
    if (disabledReason) return { ok: false, message: disabledReason };
  }

  const result = await setSetting(supabase, {
    key: parsed.data.key,
    value: value as Json,
    reason: consoleEdit("Setting"),
  });

  return toResult(result);
}

export async function clearSetting(input: {
  key: string;
}): Promise<SettingActionResult> {
  return saveSetting({ key: input.key, value: null });
}

export async function saveOverstayCharges(input: { rateSource: string; amountAed: string }): Promise<SettingActionResult> {
  await requireManagement();
  const parsed = overstayFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  return toResult(await setOverstayCharges(await createClient(), {
    ...parsed.data, reason: consoleEdit("Overstay charges"),
  }));
}

export async function saveSettingsPanel(input: unknown): Promise<SettingActionResult> {
  await requireManagement();
  const parsed = validateSettingsPanel(input);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  try {
    const result = await setSettingsGroup(await createClient(), {
      changes: parsed.panel.keys.map((key) => ({ key, value: parsed.values[key], expected: parsed.expected[key] })),
      reason: consoleEdit(parsed.panel.title),
    });
    return toResult(result);
  } catch (cause) {
    console.error("[settings] grouped save failed:", cause);
    return { ok: false, message: "Your changes could not be saved. Keep this editor open and try again." };
  }
}
