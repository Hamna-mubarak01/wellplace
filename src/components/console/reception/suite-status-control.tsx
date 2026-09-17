"use client";

import { useState } from "react";
import { Settings2Icon } from "lucide-react";

import type { BoardSuite } from "@/components/console/reception/board-types";
import { SuiteStatusDialog } from "@/components/console/reception/suite-status-dialog";
import { Button } from "@/components/shared/button";

export interface SuiteStatusControlProps {
  suite: BoardSuite;
}

export function SuiteStatusControl({ suite }: SuiteStatusControlProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        hoverEffect="sweep"
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Set the status of suite ${suite.suiteNumber}`}
      >
        <Settings2Icon aria-hidden="true" className="size-4" />
        Status
      </Button>

      {open && <SuiteStatusDialog suite={suite} open onOpenChange={setOpen} />}
    </>
  );
}
