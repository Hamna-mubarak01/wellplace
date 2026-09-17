import { z } from "zod";
import { BLOCK_ALIGNMENTS } from "@/lib/domain/email/document";
import { MESSAGE_TEXT_LIMITS } from "@/lib/config/message-text";
import { messageButtonColorSchema } from "@/lib/validation/message-button";

export const messageTextAppearanceSchema = z.object({
  font: z.enum(["body", "display", "mono"]),
  fontSize: z
    .number()
    .int()
    .min(MESSAGE_TEXT_LIMITS.fontSize.min)
    .max(MESSAGE_TEXT_LIMITS.fontSize.max),
  lineHeight: z
    .number()
    .int()
    .min(MESSAGE_TEXT_LIMITS.lineHeight.min)
    .max(MESSAGE_TEXT_LIMITS.lineHeight.max),
  color: messageButtonColorSchema,
  background: messageButtonColorSchema,
  align: z.enum(BLOCK_ALIGNMENTS),
});
