"use client";

import { createContext, useContext, useState } from "react";
import { MinusIcon, PlusIcon } from "lucide-react";
import { RECEPTION_SPAN, changeTimelineSpan, timelineSpanLabel, visitSpanOptions, TIMELINE_SPAN_PRESETS, type TimelineSpan, type TimelineZoom } from "@/lib/config/reception-display";
import { Button } from "@/components/shared/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/shared/select";

const ZoomContext = createContext<{
  span: TimelineSpan; setSpan: (span: TimelineSpan) => void;
  openingMinutes: number | null; visitMinutes: readonly number[];
} | null>(null);

export function TimelineZoomProvider({ children, initialZoom = "fit", openingMinutes, durationsHours = [] }: {
  children: React.ReactNode; initialZoom?: TimelineZoom; openingMinutes: number | null;
  durationsHours?: readonly number[];
}) {
  const [selectedSpan, setSpan] = useState<TimelineSpan>(initialZoom === "fit" ? "opening" : RECEPTION_SPAN.closeMinutes);
  const span = selectedSpan === "opening" && !openingMinutes ? RECEPTION_SPAN.maximum : selectedSpan;
  return <ZoomContext.Provider value={{ span, setSpan, openingMinutes, visitMinutes: visitSpanOptions(durationsHours) }}>{children}</ZoomContext.Provider>;
}

export function useTimelineSpan(): TimelineSpan { return useContext(ZoomContext)?.span ?? "opening"; }

function optionLabel(minutes: number) {
  return minutes % 60 === 0 ? `${minutes / 60} ${minutes === 60 ? "hour" : "hours"}` : timelineSpanLabel(minutes);
}

export function TimelineZoomControls() {
  const context = useContext(ZoomContext);
  if (!context) return null;
  const { span, setSpan, openingMinutes, visitMinutes } = context;
  const minutes = span === "opening" ? openingMinutes ?? RECEPTION_SPAN.maximum : span;
  const selected = span === "opening" ? "Opening hours" : timelineSpanLabel(span);
  const known = span !== "opening" && (TIMELINE_SPAN_PRESETS.some((value) => value === span) || visitMinutes.includes(span));
  const custom = span !== "opening" && !known;
  return <div role="group" aria-label="Visible time span" className="reception-schedule-zoom flex min-w-0 items-center gap-2">
    <Button type="button" variant="outline" size="icon" hoverEffect="simple" aria-label="Show 1 minute less" disabled={minutes <= RECEPTION_SPAN.minimum} onClick={() => setSpan(changeTimelineSpan(minutes, "less"))}><MinusIcon aria-hidden="true" className="size-4" /></Button>
    <Select value={String(span)} onValueChange={(value) => setSpan(value === "opening" ? value : Number(value))}>
      <SelectTrigger aria-label="Visible time span" className="h-tap! w-40 bg-surface-raised"><SelectValue>{selected}</SelectValue></SelectTrigger>
      <SelectContent className="density-console reception-menu">
        <SelectItem value="opening" disabled={!openingMinutes}>Opening hours</SelectItem>
        {custom && <SelectItem value={String(span)}>{selected}</SelectItem>}
        <SelectGroup>
          <SelectLabel>Time span</SelectLabel>
          {TIMELINE_SPAN_PRESETS.map((value) => <SelectItem key={value} value={String(value)}>{optionLabel(value)}</SelectItem>)}
        </SelectGroup>
        {visitMinutes.length > 0 && <>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Visit durations</SelectLabel>
            {visitMinutes.map((value) => <SelectItem key={`visit-${value}`} value={String(value)}>{optionLabel(value)}</SelectItem>)}
          </SelectGroup>
        </>}
      </SelectContent>
    </Select>
    <Button type="button" variant="outline" size="icon" hoverEffect="simple" aria-label="Show 10 minutes more" disabled={minutes >= RECEPTION_SPAN.maximum} onClick={() => setSpan(changeTimelineSpan(minutes, "more"))}><PlusIcon aria-hidden="true" className="size-4" /></Button>
  </div>;
}
