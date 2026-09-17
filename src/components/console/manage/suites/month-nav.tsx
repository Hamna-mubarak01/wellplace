import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, type LucideIcon } from "lucide-react";

import { Button } from "@/components/shared/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface MonthLink {
  readonly href: string;
  readonly label: string;
}

export interface MonthNavProps {
  label: string;
  previous: MonthLink;
  next: MonthLink;
}

function MonthStep({ link, Icon }: { link: MonthLink; Icon: LucideIcon }) {
  const label = `Show ${link.label}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant="ghost" size="icon" aria-label={label}>
          <Link href={link.href} replace scroll={false} prefetch={false}>
            <Icon aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function MonthNav({ label, previous, next }: MonthNavProps) {
  return (
    <div className="flex items-center gap-1">
      <MonthStep link={previous} Icon={ChevronLeftIcon} />
      <p aria-live="polite" className="min-w-36 text-center text-console-body font-medium text-text-primary">
        {label}
      </p>
      <MonthStep link={next} Icon={ChevronRightIcon} />
    </div>
  );
}
