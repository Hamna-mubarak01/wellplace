"use client";

import { useId } from "react";
import Link from "next/link";
import { MailIcon } from "lucide-react";

import { Button } from "@/components/shared/button";
import { cn } from "@/lib/utils";

export interface HelpBlockProps {
  email: string | null;
  layout?: "stack" | "inline";
  className?: string;
}

const ACTION_CLASS =
  "h-tap justify-start gap-2 rounded-(--radius-control) px-4 text-small font-medium";

export function HelpBlock({
  email,
  layout = "stack",
  className,
}: HelpBlockProps) {

  const actionClass = cn(ACTION_CLASS, layout === "stack" && "w-full");
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={cn("min-w-0", className)}>
      <h2
        id={headingId}
        className="font-display text-small font-medium text-text-primary"
      >
        Need help?
      </h2>

      <div
        className={cn(
          "mt-3 flex gap-2",
          layout === "stack" ? "flex-col" : "flex-wrap",
        )}
      >
        {email ? (
          <Button asChild variant="default" className={actionClass}>
            <a href={`mailto:${email}`}>
              <MailIcon aria-hidden className="size-4 shrink-0" />
              Email us
            </a>
          </Button>
        ) : null}

        <Link href="/contact" className="inline-flex min-h-tap items-center text-small text-text-secondary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
          Other contact options
        </Link>

      </div>
    </section>
  );
}
