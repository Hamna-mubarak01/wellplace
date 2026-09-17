"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "@/lib/console/feedback";
import { SUITE_NOTE_MAX_LENGTH, SUITE_PRIORITY_MIN, SUITE_PRIORITY_MAX, SUITE_NAME_MAX_LENGTH, SUITE_NUMBER_MAX, SUITE_NUMBER_MIN } from "@/lib/config/suite-management";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { saveSuite } from "@/app/(console)/manage/suites/actions";
import { suiteConfigurationSchema } from "@/lib/validation/suite-management";
import type { ManagedSuite } from "@/lib/db/queries/suite-inventory";
import { ActionError } from "@/components/shared/action-error";
import { Button } from "@/components/shared/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { SuiteDialogContent } from "@/components/console/suite-dialog-content";
import { Input } from "@/components/ui/input";

export function SuiteDetailsDialog({ suite, suggestedNumber, onOpenChange }: {
  suite?: ManagedSuite; suggestedNumber: number; onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [suiteId] = useState(() => suite?.id ?? crypto.randomUUID());
  const [number, setNumber] = useState(String(suite?.suiteNumber ?? suggestedNumber));
  const [name, setName] = useState(suite?.displayName ?? "");
  const [priority, setPriority] = useState(String(suite?.priority ?? SUITE_PRIORITY_MIN));
  const [note, setNote] = useState(suite?.internalNote ?? "");
  const [error, setError] = useState<string>();
  const unchanged = suite && Number(number) === suite.suiteNumber && name.trim() === (suite.displayName ?? "") && Number(priority) === suite.priority && note.trim() === (suite.internalNote ?? "");

  function confirm() {
    const parsed = suiteConfigurationSchema.safeParse({ suiteId, suiteNumber: Number(number),
      displayName: name, create: !suite, priority: Number(priority), internalNote: note });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setError(undefined);
    start(async () => {
      try {
        const result = await saveSuite(parsed.data);
        if (!result.ok) { setError(result.message); return; }
        toast.success(suite ? "Suite updated" : "Suite added");
        onOpenChange(false);
        router.refresh();
      } catch { setError(NETWORK_MESSAGE); }
    });
  }

  return <Dialog open onOpenChange={(open) => { if (!pending) onOpenChange(open); }}>
    <SuiteDialogContent closeDisabled={pending}>
      <DialogHeader className="shrink-0 border-b border-border p-5 sm:p-6">
        <DialogTitle className="text-console-title">{suite ? `Edit suite ${suite.suiteNumber}` : "Add a suite"}</DialogTitle>
        <DialogDescription>{suite ? "Update the suite’s details." : "Enter the new suite’s details."}</DialogDescription>
      </DialogHeader>
      <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); confirm(); }}>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain p-5 sm:p-6">
          <div className="grid items-start gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="suite-number">Suite number</FieldLabel>
              <Input id="suite-number" type="number" inputMode="numeric" required min={SUITE_NUMBER_MIN} max={SUITE_NUMBER_MAX} step={1}
                value={number} disabled={pending} onChange={(e) => setNumber(e.target.value)} className="h-control font-data text-console-body" />
            </Field>
            <Field>
              <FieldLabel htmlFor="suite-name">Suite name <span className="font-normal text-text-muted">(optional)</span></FieldLabel>
              <Input id="suite-name" maxLength={SUITE_NAME_MAX_LENGTH} value={name} disabled={pending}
                onChange={(e) => setName(e.target.value)} placeholder={`Suite ${number || suggestedNumber}`} className="h-control text-console-body" />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="suite-priority">Booking priority</FieldLabel>
            <Input id="suite-priority" type="number" required min={SUITE_PRIORITY_MIN} max={SUITE_PRIORITY_MAX} step={1} value={priority} disabled={pending} onChange={(e) => setPriority(e.target.value)} className="h-control text-console-body" />
            <FieldDescription>Lower numbers are offered first when fixed-priority allocation is selected.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="suite-note">Internal note</FieldLabel>
            <Textarea id="suite-note" value={note} maxLength={SUITE_NOTE_MAX_LENGTH} disabled={pending} onChange={(e) => setNote(e.target.value)} rows={3} className="min-h-24 text-console-body" />
            <FieldDescription>Visible to staff only.</FieldDescription>
          </Field>
          {error && <ActionError message={error} />}
        </div>
        <DialogFooter className="mx-0 mb-0 shrink-0 border-t border-border bg-surface-raised p-4 sm:p-5">
          <Button type="button" variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" hoverEffect="sweep" disabled={pending || !!unchanged}>
            {!suite && <PlusIcon aria-hidden="true" className="size-4" />}{pending ? "Saving…" : suite ? "Save changes" : "Add suite"}
          </Button>
        </DialogFooter>
      </form>
    </SuiteDialogContent>
  </Dialog>;
}
