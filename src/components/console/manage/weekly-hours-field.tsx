"use client";

import { useId, useRef } from "react";
import { CopyIcon, MoreHorizontalIcon, PlusIcon, XIcon } from "lucide-react";
import { HOURS_EDITOR, WEEKDAY_KEYS, WEEKDAY_LABEL } from "@/lib/config/opening-hours";
import type { WeeklyHoursDraft } from "@/components/console/manage/settings-model";
import { OpeningTime } from "@/components/console/manage/opening-windows-field";
import { ConsoleSwitch } from "@/components/shared/console-switch";
import { Button } from "@/components/shared/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export interface WeeklyHoursFieldProps {
  value: WeeklyHoursDraft;
  onChange: (next: WeeklyHoursDraft) => void;
  disabled?: boolean;
}

export function WeeklyHoursField({ value, disabled = false, onChange }: WeeklyHoursFieldProps) {
  const id = useId();
  const remembered = useRef<Partial<WeeklyHoursDraft>>({});
  const reserveRemove = WEEKDAY_KEYS.some((day) => value[day].length > 1);
  return <fieldset className="@container/schedule min-w-0 divide-y divide-border">
    <legend className="sr-only">Weekly opening hours</legend>
    {WEEKDAY_KEYS.map((day) => {
      const windows = value[day];
      const label = WEEKDAY_LABEL[day];
      return <div key={day} className="flex min-w-0 flex-wrap items-center gap-2 py-3 @md/schedule:flex-nowrap @md/schedule:gap-4">
        <div className="flex min-h-tap w-24 shrink-0 items-center justify-between gap-1 @md/schedule:self-start">
          <span className="text-micro font-medium" title={label}>{label.slice(0, 3)}</span>
          <ConsoleSwitch id={`${id}-${day}`} aria-label={`${label} open`} checked={windows.length > 0} disabled={disabled} onCheckedChange={(open) => {
            if (!open) remembered.current = { ...remembered.current, [day]: windows };
            onChange({ ...value, [day]: open ? remembered.current[day] ?? [{ ...HOURS_EDITOR.newWindow }] : [] });
          }} />
        </div>
        {!windows.length ? <span className="flex-1 text-micro text-text-muted">Closed</span> : <div className="order-3 flex min-w-0 basis-full flex-col gap-2 @md/schedule:order-none @md/schedule:basis-auto @md/schedule:flex-1">
          {windows.map((window, index) => <div key={index} className="flex min-w-0 items-center gap-1 sm:gap-2">
            <div className="min-w-0 flex-1"><OpeningTime value={window.opens} label={`${label}, window ${index + 1}, opens`} disabled={disabled} onChange={(opens) => onChange({ ...value, [day]: windows.map((entry, i) => i === index ? { ...entry, opens } : entry) })} /></div>
            <span aria-hidden="true" className="text-text-muted">–</span>
            <div className="min-w-0 flex-1"><OpeningTime value={window.closes} label={`${label}, window ${index + 1}, closes`} disabled={disabled} onChange={(closes) => onChange({ ...value, [day]: windows.map((entry, i) => i === index ? { ...entry, closes } : entry) })} /></div>
            {reserveRemove && <div className="w-tap shrink-0">{index > 0 && <Button type="button" variant="ghost" tone="danger" size="icon" disabled={disabled} aria-label={`Remove ${label} time range ${index + 1}`} onClick={() => onChange({ ...value, [day]: windows.filter((_, i) => i !== index) })}><XIcon aria-hidden="true" className="size-4" /></Button>}</div>}
          </div>)}
        </div>}
        <div className="ml-auto flex w-tap shrink-0 flex-col items-end gap-2 @md/schedule:ml-0 @md/schedule:self-start">
          <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" disabled={disabled || !windows.length} aria-label={`${label} options`}><MoreHorizontalIcon className="size-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="density-console settings-popup settings-schedule-menu w-64 max-w-(--radix-dropdown-menu-content-available-width) border border-border">
              <DropdownMenuItem onSelect={() => onChange({ ...value, [day]: [...windows, { ...HOURS_EDITOR.newWindow }] })}><PlusIcon aria-hidden="true" /><span>Add time range</span></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onChange(Object.fromEntries(WEEKDAY_KEYS.map((key) => [key, windows.map((entry) => ({ ...entry }))])) as unknown as WeeklyHoursDraft)}><CopyIcon aria-hidden="true" /><span>Open every day with these hours</span></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>;
    })}
  </fieldset>;
}
