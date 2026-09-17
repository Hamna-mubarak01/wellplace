"use client";

import { useId } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { EMPTY_WEEK, HOURS_EDITOR, type Closures, type OpeningExceptions, type SeasonalHours } from "@/lib/config/opening-hours";
import { HoursDateField } from "@/components/console/manage/hours-date-field";
import { OpeningWindowsField } from "@/components/console/manage/opening-windows-field";
import { WeeklyHoursField } from "@/components/console/manage/weekly-hours-field";
import { Button } from "@/components/shared/button";
import { ConsoleSwitch } from "@/components/shared/console-switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export type SpecialHoursDraft =
  | { kind: "seasonal-hours"; value: SeasonalHours }
  | { kind: "opening-exceptions"; value: OpeningExceptions }
  | { kind: "closures"; value: Closures };

export function SpecialHoursField({ draft, disabled, onChange }: {
  draft: SpecialHoursDraft; disabled: boolean; onChange: (next: SpecialHoursDraft) => void;
}) {
  const id = useId();
  const entries = draft.kind === "seasonal-hours" ? draft.value.periods : draft.value;
  const singular = draft.kind === "seasonal-hours" ? "temporary schedule" : draft.kind === "closures" ? "closure" : "one-day change";
  function remove(index: number) {
    if (draft.kind === "seasonal-hours") onChange({ ...draft, value: { periods: draft.value.periods.filter((_, i) => i !== index) } });
    else if (draft.kind === "closures") onChange({ ...draft, value: draft.value.filter((_, i) => i !== index) });
    else onChange({ ...draft, value: draft.value.filter((_, i) => i !== index) });
  }
  function dates(index: number, field: "from" | "to", value: string) {
    if (draft.kind === "seasonal-hours") onChange({ ...draft, value: { periods: draft.value.periods.map((entry, i) => i === index ? { ...entry, [field]: value } : entry) } });
    else if (draft.kind === "closures") onChange({ ...draft, value: draft.value.map((entry, i) => i === index ? { ...entry, [field]: value } : entry) });
  }
  function add() {
    if (draft.kind === "seasonal-hours") onChange({ ...draft, value: { periods: [...draft.value.periods, { from: "", to: "", hours: structuredClone(EMPTY_WEEK) }] } });
    else if (draft.kind === "closures") onChange({ ...draft, value: [...draft.value, { from: "", to: "" }] });
    else onChange({ ...draft, value: [...draft.value, { date: "", windows: [{ ...HOURS_EDITOR.newWindow }] }] });
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {entries.length === 0 && <p className="rounded-(--radius-control) border border-dashed border-border-strong p-5 text-console-body text-text-secondary">
        {draft.kind === "closures" ? "No closed dates added. Your opening hours apply." : draft.kind === "seasonal-hours" ? "No temporary hours added. Your usual week applies." : "No one-day changes added. Your weekly hours apply."}
      </p>}
      {entries.map((entry, index) => (
        <Card key={index} className="min-w-0 gap-3 bg-surface-raised py-4 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between gap-2 px-3 sm:px-4">
            <p className="text-console-body font-medium capitalize">{singular} {index + 1}</p>
            <Button type="button" variant="ghost" size="icon" disabled={disabled} className="size-tap"
              aria-label={`Remove ${singular} ${index + 1}`} onClick={() => remove(index)}>
              <XIcon aria-hidden="true" className="size-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex min-w-0 flex-col gap-4 px-3 sm:px-4">
            {"from" in entry && <>
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <HoursDateField label={`Start date, ${singular} ${index + 1}`} value={entry.from} disabled={disabled} onChange={(date) => dates(index, "from", date)} />
                <HoursDateField label={`End date, ${singular} ${index + 1}`} value={entry.to} disabled={disabled} onChange={(date) => dates(index, "to", date)} />
              </div>
              <p className="text-micro text-text-muted">Both dates are included. Choose the same date for a single day.</p>
            </>}
            {draft.kind === "seasonal-hours" && "hours" in entry && <WeeklyHoursField value={draft.value.periods[index].hours} disabled={disabled}
              onChange={(hours) => onChange({ ...draft, value: { periods: draft.value.periods.map((period, i) => i === index ? { ...period, hours: Object.fromEntries(Object.entries(hours).map(([day, windows]) => [day, [...windows]])) as typeof period.hours } : period) } })} />}
            {draft.kind === "opening-exceptions" && "date" in entry && <>
              <HoursDateField label={`Date, one-off date ${index + 1}`} value={entry.date} disabled={disabled}
                onChange={(date) => onChange({ ...draft, value: draft.value.map((other, i) => i === index ? { ...other, date } : other) })} />
              <div className="flex min-h-tap items-center justify-between gap-3">
                <span className="text-console-body">{entry.windows.length ? "Open on this date" : "Closed on this date"}</span>
                <ConsoleSwitch id={`${id}-${index}`} aria-label={`One-off date ${index + 1} open`} disabled={disabled} checked={entry.windows.length > 0}
                  onCheckedChange={(open) => onChange({ ...draft, value: draft.value.map((other, i) => i === index ? { ...other, windows: open ? [{ ...HOURS_EDITOR.newWindow }] : [] } : other) })} />
              </div>
              {entry.windows.length > 0 && <OpeningWindowsField label={`One-off date ${index + 1}`} value={entry.windows} disabled={disabled}
                onChange={(windows) => onChange({ ...draft, value: draft.value.map((other, i) => i === index ? { ...other, windows } : other) })} />}
            </>}
          </CardContent>
        </Card>
      ))}
      <Button type="button" variant="outline" disabled={disabled} className="w-fit" onClick={add}>
        <PlusIcon aria-hidden="true" className="size-4" />Add {singular === "one-day change" ? "a one-day change" : `a ${singular}`}
      </Button>
    </div>
  );
}
