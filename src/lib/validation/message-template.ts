import { z } from "zod";
import { BOOKING_TEMPLATE_KEYS } from "@/lib/domain/messaging";
import { MESSAGE_BODY_MAX, MESSAGE_SUBJECT_MAX, MESSAGE_TIMING_MAX, MESSAGE_TIME_UNITS, type MessageTimeUnit } from "@/lib/config/message-templates";

export const messageTemplateSchema = z.object({
  key: z.enum(BOOKING_TEMPLATE_KEYS),
  channel: z.enum(["email", "whatsapp"]),
  isActive: z.boolean(),
  subject: z.string().trim().max(MESSAGE_SUBJECT_MAX, "The subject is too long.").nullable(),
  body: z.string().trim().min(1, "Write the message before saving.").max(MESSAGE_BODY_MAX, "The message is too long."),
  timingMinutes: z.number().int().min(-MESSAGE_TIMING_MAX).max(MESSAGE_TIMING_MAX).nullable(),
}).superRefine((value, ctx) => {
  if (value.channel === "whatsapp" && value.subject) ctx.addIssue({ code: "custom", path: ["subject"], message: "WhatsApp messages do not use a subject line." });
});

export type TimingDirection = "at" | "before" | "after";
export function timingDraft(minutes: number | null): { direction: TimingDirection; amount: string; unit: MessageTimeUnit } {
  if (!minutes) return { direction: "at", amount: "", unit: "hours" };
  const absolute = Math.abs(minutes);
  const unit = absolute % MESSAGE_TIME_UNITS.days === 0 ? "days" : absolute % MESSAGE_TIME_UNITS.hours === 0 ? "hours" : "minutes";
  return { direction: minutes < 0 ? "before" : "after", amount: String(absolute / MESSAGE_TIME_UNITS[unit]), unit };
}

export function parseTemplateTiming(direction: TimingDirection, amount: string, unit: MessageTimeUnit): { ok: true; minutes: number | null } | { ok: false; message: string } {
  if (direction === "at") return { ok: true, minutes: null };
  const number = Number(amount.trim());
  if (!amount.trim() || !Number.isInteger(number) || number <= 0) return { ok: false, message: "Enter a whole number greater than zero." };
  const minutes = number * MESSAGE_TIME_UNITS[unit];
  if (minutes > MESSAGE_TIMING_MAX) return { ok: false, message: "Choose a time within one year of the event." };
  return { ok: true, minutes: direction === "before" ? -minutes : minutes };
}
