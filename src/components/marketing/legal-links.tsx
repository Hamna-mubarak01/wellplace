"use client";

import Link from "next/link";

import { CookieSettingsDialog } from "@/components/marketing/cookie-settings";
import { Button } from "@/components/shared/button";
import { LEGAL_INDEX_HREF } from "@/lib/config/legal";
import { cn } from "@/lib/utils";

const LINK_CLASS =
  "cursor-pointer whitespace-nowrap text-left text-fine text-text-muted underline-offset-2 outline-none hover:text-text-primary hover:underline focus-visible:text-text-primary focus-visible:underline";

export interface LegalLinksProps {
  className?: string;
}

export function LegalLinks({ className }: LegalLinksProps) {
  return (
    <nav
      aria-label="Legal"
      className={cn("flex flex-wrap items-baseline gap-x-4 gap-y-1", className)}
    >
      <Link href={LEGAL_INDEX_HREF} className={LINK_CLASS}>
        Legal
      </Link>
      <CookieSettingsDialog
        trigger={
          <Button type="button" variant="link" className={LINK_CLASS}>
            Cookie Settings
          </Button>
        }
      />
    </nav>
  );
}
