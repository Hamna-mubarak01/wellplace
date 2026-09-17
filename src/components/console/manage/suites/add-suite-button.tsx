"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";

import { SuiteDetailsDialog } from "@/components/console/manage/suites/suite-details-dialog";
import { Button } from "@/components/shared/button";

export interface AddSuiteButtonProps {
  suggestedNumber: number;
}

export function AddSuiteButton({ suggestedNumber }: AddSuiteButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden="true" className="size-4" />
        Add suite
      </Button>
      {open && <SuiteDetailsDialog suggestedNumber={suggestedNumber} onOpenChange={setOpen} />}
    </>
  );
}
