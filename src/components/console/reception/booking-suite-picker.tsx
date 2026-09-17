"use client";

import { useEffect, useState } from "react";
import { bookingSuiteChoices } from "@/app/(console)/reception/booking-options";
import { Button } from "@/components/shared/button";
import { ActionError } from "@/components/shared/action-error";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shared/select";
import { Field, FieldLabel } from "@/components/ui/field";
import type { ReceptionSuiteChoice } from "@/lib/db/queries/reception-customers";

export function BookingSuitePicker({ startsAt, durationHours, value, onChange, disabled }: {
  startsAt: string | null; durationHours: number; value: string | null;
  onChange: (value: string | null) => void; disabled: boolean;
}) {
  const [retry, setRetry] = useState(0);
  const key = `${startsAt}|${durationHours}|${retry}`;
  const [resolved, setResolved] = useState<{ key: string; suites: ReceptionSuiteChoice[]; error: string | null } | null>(null);
  useEffect(() => {
    if (!startsAt) return;
    let cancelled = false;
    bookingSuiteChoices(startsAt, durationHours).then((result) => {
      if (!cancelled) setResolved({ key, suites: result.ok ? result.suites : [], error: result.ok ? null : result.message });
    }).catch(() => {
      if (!cancelled) setResolved({ key, suites: [], error: "Suite availability could not be loaded." });
    });
    return () => { cancelled = true; };
  }, [startsAt, durationHours, key]);
  const settled = resolved?.key === key;
  return <Field className="gap-2">
    {settled && resolved?.error && <ActionError title="Suite availability could not be loaded" message="We could not check which suites are free for this visit. Check your connection and try again before confirming the booking.">
      <Button type="button" variant="outline" onClick={() => setRetry((value) => value + 1)}>Retry suite availability</Button>
    </ActionError>}
    <FieldLabel htmlFor="booking-suite">Suite</FieldLabel>
    <Select value={value ?? "automatic"} onValueChange={(next) => onChange(next === "automatic" ? null : next)} disabled={disabled || !startsAt || !settled || Boolean(resolved?.error)}>
      <SelectTrigger id="booking-suite" className="h-tap! w-full"><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="automatic" className="min-h-tap">Automatically choose an available suite</SelectItem>
        {settled && resolved?.suites.map((suite) => <SelectItem key={suite.id} value={suite.id} disabled={!suite.available} className="min-h-tap">Suite {suite.suite_number}{suite.available ? "" : " · Unavailable"}</SelectItem>)}
      </SelectContent>
    </Select>
    {!resolved?.error && <p role="status" className="text-micro text-text-secondary">{!startsAt ? "Choose a start time." : !settled ? "Checking suites…" : "Cleaning time included."}</p>}
  </Field>;
}
