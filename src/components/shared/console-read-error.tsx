import type { ReactNode } from "react";
import { ActionError } from "@/components/shared/action-error";
import { readableActionMessage } from "@/lib/domain/action-errors";

const DEFAULT_REMEDY = "Reload the page.";

export interface ConsoleReadErrorProps {
  title: string;
  message: string;
  meaning?: string;
  unaffected?: string;
  remedy?: string;
  children?: ReactNode;
}

export function ConsoleReadError({
  title,
  message,
  meaning,
  unaffected,
  remedy = DEFAULT_REMEDY,
  children,
}: ConsoleReadErrorProps) {
  const sentences = [readableActionMessage(message, "The latest information could not be loaded. Check your connection and try again. If the problem continues, ask Management for help."), meaning, unaffected]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join(" ");

  return (
    <ActionError title={title} message={sentences} remedy={remedy}>
      {children}
    </ActionError>
  );
}
