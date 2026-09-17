"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { HOURS_EDITOR, type OpeningWindowValue } from "@/lib/config/opening-hours";
import { Button } from "@/components/shared/button";
import { ClockPicker } from "@/components/shared/clock-picker";

export const OpeningTime = ClockPicker;

export function OpeningWindowsField({ value, label, disabled, onChange }: {
  value: readonly OpeningWindowValue[]; label: string; disabled?: boolean;
  onChange: (value: OpeningWindowValue[]) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {value.length > 0 && <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 text-micro text-text-muted">
        <span>Opens</span><span>Closes</span><span className="w-tap" aria-hidden="true" />
      </div>}
      {value.map((window, index) => (
        <div key={index} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
          <OpeningTime label={`${label}, window ${index + 1}, opens`} value={window.opens} disabled={disabled}
            onChange={(opens) => onChange(value.map((entry, i) => i === index ? { ...entry, opens } : entry))} />
          <OpeningTime label={`${label}, window ${index + 1}, closes`} value={window.closes} disabled={disabled}
            onChange={(closes) => onChange(value.map((entry, i) => i === index ? { ...entry, closes } : entry))} />
          <Button type="button" variant="ghost" size="icon" disabled={disabled}
            aria-label={`Remove ${label} window ${index + 1}`} className="size-tap"
            onClick={() => onChange(value.filter((_, i) => i !== index))}>
            <XIcon aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" disabled={disabled} className="w-fit"
        onClick={() => onChange([...value, { ...HOURS_EDITOR.newWindow }])}>
        <PlusIcon aria-hidden="true" className="size-4" />Add another time range
      </Button>
    </div>
  );
}
