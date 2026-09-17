import { z } from "zod";

import {
  MESSAGE_BUTTON_DEFAULTS,
  MESSAGE_BUTTON_LIMITS,
} from "@/lib/config/message-button";
import {
  BLOCK_ALIGNMENTS,
  type MessageButtonAppearance,
} from "@/lib/domain/email/document";

export const messageButtonColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);

export const messageButtonAppearanceSchema = z.object({
  followBrand: z.boolean(),
  width: z.enum(["auto", "full"]),
  align: z.enum(BLOCK_ALIGNMENTS),
  background: messageButtonColorSchema,
  textColor: messageButtonColorSchema,
  radius: z
    .number()
    .int()
    .min(MESSAGE_BUTTON_LIMITS.radius.min)
    .max(MESSAGE_BUTTON_LIMITS.radius.max),
  paddingX: z
    .number()
    .int()
    .min(MESSAGE_BUTTON_LIMITS.padding.min)
    .max(MESSAGE_BUTTON_LIMITS.padding.max),
  paddingY: z
    .number()
    .int()
    .min(MESSAGE_BUTTON_LIMITS.padding.min)
    .max(MESSAGE_BUTTON_LIMITS.padding.max),
});

export function resolveMessageButtonAppearance(
  raw: unknown,
): MessageButtonAppearance {
  const parsed = messageButtonAppearanceSchema.safeParse(raw);
  const value = parsed.success ? parsed.data : MESSAGE_BUTTON_DEFAULTS;
  return value.followBrand
    ? {
        ...value,
        background: MESSAGE_BUTTON_DEFAULTS.background,
        textColor: MESSAGE_BUTTON_DEFAULTS.textColor,
        radius: MESSAGE_BUTTON_DEFAULTS.radius,
      }
    : value;
}
