"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  PencilIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";

import {
  deleteManagedSuite,
  retireManagedSuite,
  returnManagedSuiteToService,
} from "@/app/(console)/manage/suites/actions";
import type { LiveState } from "@/app/(console)/manage/suites/suites-view";
import { ReasonConfirmDialog } from "@/components/console/manage/suites/reason-confirm-dialog";
import { SuiteDetailsDialog } from "@/components/console/manage/suites/suite-details-dialog";
import { useSuiteDrawer } from "@/components/console/manage/suites/suite-drawer";
import { ManageSuiteStatusDialog } from "@/components/console/manage/suites/suite-status-dialog";
import { Button } from "@/components/shared/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ManagedSuite } from "@/lib/db/queries/suite-inventory";
import { cn } from "@/lib/utils";

type OpenDialog = "status" | "edit" | "delete" | "retire" | "return" | null;

export interface SuiteActionsProps {
  suite: ManagedSuite;
  live: LiveState;
}

export function SuiteActions({ suite, live }: SuiteActionsProps) {
  const router = useRouter();
  const drawer = useSuiteDrawer();
  const [open, setOpen] = useState<OpenDialog>(null);
  const retired = live === "retired";
  const close = (next: boolean) => {
    if (!next) setOpen(null);
  };

  return (
    <>
      <div
        role="group"
        aria-label={`Suite ${suite.suiteNumber} actions`}
        className={cn("grid gap-2 @md:flex @md:flex-wrap", retired ? "grid-cols-1" : "grid-cols-2")}
      >
        {retired ? (
          <Button type="button" size="sm" hoverEffect="sweep" onClick={() => setOpen("return")}>
            <ArchiveRestoreIcon aria-hidden="true" className="size-4" />
            Return to service
          </Button>
        ) : (
          <Button type="button" size="sm" hoverEffect="sweep" onClick={() => setOpen("status")}>
            <ShieldCheckIcon aria-hidden="true" className="size-4" />
            Change status
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" hoverEffect="sweep" onClick={() => setOpen("edit")}>
          <PencilIcon aria-hidden="true" className="size-4" />
          Edit
        </Button>
        {!retired &&
          (suite.hasHistory ? (
            <Button type="button" variant="outline" size="sm" tone="danger" onClick={() => setOpen("retire")}>
              <ArchiveIcon aria-hidden="true" className="size-4" />
              Retire
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" tone="danger" onClick={() => setOpen("delete")}>
              <Trash2Icon aria-hidden="true" className="size-4" />
              Delete
            </Button>
          ))}
      </div>

      {open === "status" && (
        <ManageSuiteStatusDialog suite={suite} live={live} onOpenChange={close} />
      )}
      {open === "edit" && (
        <SuiteDetailsDialog suite={suite} suggestedNumber={suite.suiteNumber} onOpenChange={close} />
      )}
      <ReasonConfirmDialog
        open={open === "delete"}
        onOpenChange={close}
        title={`Delete suite ${suite.suiteNumber}?`}
        description="It has never been booked, so it is removed completely. This cannot be undone."
        reasonId={`delete-suite-reason-${suite.id}`}
        confirmLabel="Delete suite"
        pendingLabel="Deleting…"
        destructive
        successMessage={`Suite ${suite.suiteNumber} deleted`}
        onConfirm={(reason) => deleteManagedSuite({ suiteId: suite.id, reason })}
        onDone={drawer.closeSuite}
      />

      <ReasonConfirmDialog
        open={open === "retire"}
        onOpenChange={close}
        title={`Retire suite ${suite.suiteNumber}?`}
        description="It stops taking bookings and leaves Reception’s schedule. Its booking history is kept, and you can return it to service later."
        reasonId={`retire-suite-reason-${suite.id}`}
        confirmLabel="Retire suite"
        pendingLabel="Retiring…"
        cancelLabel={suite.upcomingBookings > 0 ? "Close" : "Cancel"}
        destructive
        blocker={
          suite.upcomingBookings > 0 ? (
            <Alert className="border-warning-border bg-warning-wash text-warning-ink">
              <AlertDescription className="text-console-body text-warning-ink">
                {suite.upcomingBookings === 1
                  ? "This suite has 1 current or upcoming booking."
                  : `This suite has ${suite.upcomingBookings} current or upcoming bookings.`}{" "}
                Move them to another suite or reschedule them, then retire it.
              </AlertDescription>
            </Alert>
          ) : undefined
        }
        successMessage={`Suite ${suite.suiteNumber} retired`}
        onConfirm={(reason) => retireManagedSuite({ suiteId: suite.id, reason })}
        onDone={() => router.refresh()}
      />

      <ReasonConfirmDialog
        open={open === "return"}
        onOpenChange={close}
        title={`Return suite ${suite.suiteNumber} to service?`}
        description="It becomes available and is offered for bookings again straight away. Any blocks still scheduled apply again."
        reasonId={`return-suite-reason-${suite.id}`}
        confirmLabel="Return to service"
        pendingLabel="Returning…"
        successMessage={`Suite ${suite.suiteNumber} is back in service`}
        onConfirm={(reason) => returnManagedSuiteToService({ suiteId: suite.id, reason })}
        onDone={() => router.refresh()}
      />
    </>
  );
}
