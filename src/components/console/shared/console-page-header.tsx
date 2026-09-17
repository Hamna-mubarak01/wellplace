import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/shared/button";
import { cn } from "@/lib/utils";

export interface ConsolePageHeaderProps {
  title: string;
  titleAction?: ReactNode;
  backHref?: string;
  backLabel?: string;
  meta?: readonly ReactNode[];
  status?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

function isPresent(fact: ReactNode): boolean {
  return fact !== null && fact !== undefined && fact !== false && fact !== "";
}

export function ConsolePageHeader({
  title,
  titleAction,
  backHref,
  backLabel = "Back",
  meta,
  status,
  actions,
  className,
}: ConsolePageHeaderProps) {
  const facts = (meta ?? []).filter(isPresent);

  return (
    <header
      className={cn("console-page-header flex flex-wrap items-start justify-between gap-x-4 gap-y-3", className)}
    >
      <div className="flex min-w-0 items-start gap-2">
        {backHref && (
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href={backHref} aria-label={backLabel}>
              <ArrowLeftIcon aria-hidden="true" className="size-5" />
            </Link>
          </Button>
        )}

        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-h-tap min-w-0 items-center gap-1">
            <h1 className="min-w-0 text-console-title font-medium text-pretty break-words text-text-primary">
              {title}
            </h1>
            {titleAction}
          </div>

          {facts.length > 0 && (
            <div className="console-page-meta min-w-0 text-console-body text-text-secondary">
              <p className="console-page-meta-list flex min-w-0 flex-wrap items-center gap-y-1">
                {facts.map((fact, index) => (
                  <span key={index} className="inline-flex min-w-0 items-center">
                    <span aria-hidden="true" className="console-page-meta-dot text-text-muted">
                      ·
                    </span>
                    <span className="min-w-0 break-words">{fact}</span>
                  </span>
                ))}
              </p>
            </div>
          )}

          {status && <div className="mt-1 flex flex-wrap items-center gap-2">{status}</div>}
        </div>
      </div>

      {actions && (
        <div className="console-page-actions flex max-w-full min-w-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
