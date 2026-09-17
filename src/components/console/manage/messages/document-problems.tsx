"use client";

import { CheckIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/shared/button";
import {
  describeProblem,
  problemBlockId,
} from "@/components/console/manage/messages/message-document-model";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { DocumentProblem } from "@/lib/domain/email/document";
import { cn } from "@/lib/utils";

export type DocumentProblemsVariant = "list" | "inline";

export interface DocumentProblemsProps {
  problems: readonly DocumentProblem[];
  labelFor: (blockId: string) => string;
  variant?: DocumentProblemsVariant;
  title?: string;
  emptyLabel?: string;
  onSelectBlock?: (blockId: string) => void;
  className?: string;
}

export function DocumentProblems({
  problems,
  labelFor,
  variant = "list",
  title = "Fix these before publishing",
  emptyLabel,
  onSelectBlock,
  className,
}: DocumentProblemsProps) {
  if (problems.length === 0) {
    if (emptyLabel === undefined) return null;
    return (
      <p
        className={cn(
          "flex items-center gap-2 text-console-body text-text-secondary",
          className,
        )}
      >
        <CheckIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-success"
        />
        {emptyLabel}
      </p>
    );
  }

  if (variant === "inline") {
    return (
      <ul
        className={cn(
          "flex min-w-0 flex-col gap-1 rounded-(--radius-control) border border-warning-border bg-warning-wash px-3 py-2",
          className,
        )}
      >
        {problems.map((problem, index) => (
          <li
            key={index}
            className="flex min-w-0 items-start gap-2 text-console-body text-pretty text-warning-ink"
          >
            <TriangleAlertIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <span className="min-w-0">
              {describeProblem(problem, labelFor)}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Alert
      className={cn(
        "gap-y-2 rounded-(--radius-card) border border-solid border-warning-border bg-warning-wash p-4 text-warning-ink",
        className,
      )}
    >
      <TriangleAlertIcon aria-hidden="true" className="size-5" />
      <AlertTitle className="text-console-body font-semibold">
        {title}
      </AlertTitle>
      <AlertDescription className="text-console-body text-warning-ink">
        <ul className="flex min-w-0 flex-col gap-2">
          {problems.map((problem, index) => {
            const blockId = problemBlockId(problem);
            const wording = describeProblem(problem, labelFor);

            return (
              <li key={index} className="min-w-0 text-pretty">
                {blockId !== null && onSelectBlock !== undefined ? (
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => onSelectBlock(blockId)}
                    className="text-left text-console-body whitespace-normal underline underline-offset-2"
                  >
                    {wording}
                  </Button>
                ) : (
                  wording
                )}
              </li>
            );
          })}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
