import { TriangleAlertIcon } from "lucide-react";
import type { ReactNode, Ref } from "react";
import { readableActionMessage } from "@/lib/domain/action-errors";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export interface ActionErrorProps {
  message: string;
  title?: string;
  remedy?: string;
  children?: ReactNode;
  id?: string;
  ref?: Ref<HTMLDivElement>;
}

export function ActionError({
  message,
  title = "This action needs attention",
  remedy,
  children,
  id,
  ref,
}: ActionErrorProps) {
  return (
    <Alert id={id} ref={ref} tabIndex={-1} className="gap-y-2 rounded-(--radius-card) border border-solid border-danger-border bg-danger-wash p-4 text-danger-ink shadow-sm sm:p-5">
      <TriangleAlertIcon aria-hidden="true" className="size-5" />
      <AlertTitle className="text-console-body font-semibold">{title}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3 whitespace-pre-line text-console-body leading-relaxed text-pretty text-danger-ink">
        <span>{readableActionMessage(message)}</span>
        {remedy && <span className="font-medium">{remedy}</span>}
        {children}
      </AlertDescription>
    </Alert>
  );
}
