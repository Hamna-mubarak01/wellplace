"use client";

import { toast as sonner, type ExternalToast } from "sonner";
import { actionErrorTitle, readableActionMessage } from "@/lib/domain/action-errors";

function showFailure(message: unknown, options?: ExternalToast): string | number {
  const description = typeof options?.description === "string" ? options.description : null;
  const text = readableActionMessage(description ?? (typeof message === "string" ? message : ""));
  const title = !text.includes("could not confirm whether") && description && typeof message === "string" && !/nothing|not saved|not changed/i.test(message)
    ? readableActionMessage(message)
    : actionErrorTitle(text);
  return sonner.error(title, {
    ...options,
    id: options?.id ?? `console-error:${text}`,
    description: text,
  });
}

export const toast = { ...sonner, error: showFailure };
