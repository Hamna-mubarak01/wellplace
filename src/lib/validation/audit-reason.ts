import { z } from "zod";
import { REASON_MAX_LENGTH } from "@/lib/config/console-limits";

export const reasonSchema = z
  .string()
  .trim()
  .min(1, "Give a reason.")
  .max(REASON_MAX_LENGTH, `Keep the reason to ${REASON_MAX_LENGTH} characters or fewer.`);

export function consoleEdit(subject: string): string {
  return `${subject} edited from the console`;
}

export function consoleCreate(subject: string): string {
  return `${subject} created from the console`;
}

export function consoleDelete(subject: string): string {
  return `${subject} deleted from the console`;
}
