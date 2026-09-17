"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/console/feedback";

import {
  checkIn,
  confirmCleaning,
  recordArrival,
  type BookingActionResult,
} from "@/app/(console)/reception/actions";
import type { AlertKind } from "@/lib/domain/alerts";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { Button } from "@/components/shared/button";

const SWEEP_NOTE = "The alert closes on the next check.";

export interface AlertRemediationProps {
  kind: AlertKind;
  entityId: string;
}

export function AlertRemediation({ kind, entityId }: AlertRemediationProps) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = (perform: () => Promise<BookingActionResult>, success: string) =>
    start(async () => {
      let result: BookingActionResult;

      try {
        result = await perform();
      } catch (cause) {
        console.error("[console] alert remediation threw:", cause);
        result = { ok: false, message: NETWORK_MESSAGE };
      }

      if (result.ok) {
        toast.success(success, { description: SWEEP_NOTE });
        router.refresh();
        return;
      }

      toast.error("Nothing was changed", { description: result.message });
    });

  if (kind === "cleaning_unconfirmed") {
    return (
      <Button
        hoverEffect="sweep"
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        className="min-h-tap"
        onClick={() => run(() => confirmCleaning(entityId, ""), "Cleaning confirmed")}
      >
        Confirm clean
      </Button>
    );
  }

  if (kind === "arrival_overdue") {
    return (
      <Button
        hoverEffect="sweep"
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        className="min-h-tap"
        onClick={() => run(() => recordArrival(entityId, ""), "Arrival recorded")}
      >
        Record arrival
      </Button>
    );
  }

  if (kind === "checkin_overdue") {
    return (
      <Button
        hoverEffect="sweep"
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        className="min-h-tap"
        onClick={() => run(() => checkIn(entityId, ""), "Checked in")}
      >
        Check in
      </Button>
    );
  }

  return null;
}
