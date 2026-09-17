"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useSuiteDrawer } from "@/components/console/manage/suites/suite-drawer";

export interface SuiteCardLinkProps {
  suiteId: string;
  className?: string;
  children: ReactNode;
}

export function SuiteCardLink({ suiteId, className, children }: SuiteCardLinkProps) {
  const drawer = useSuiteDrawer();

  return (
    <Link
      href={drawer.hrefFor(suiteId)}
      replace
      scroll={false}
      prefetch={false}
      aria-haspopup="dialog"
      data-suite-link={suiteId}
      className={className}
      onNavigate={(event) => {
        event.preventDefault();
        drawer.openSuite(suiteId);
      }}
    >
      {children}
    </Link>
  );
}
