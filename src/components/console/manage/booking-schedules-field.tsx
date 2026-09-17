"use client";

import { useId, useState } from "react";
import { CalendarDaysIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { scheduleWeekDraft, schedulePeriodsDraft, scheduleDatesDraft, scheduleClosuresDraft } from "@/lib/config/schedule-editor";
import { EMPTY_WEEK, HOURS_EDITOR, seasonalHoursSchema, type WeeklyHours } from "@/lib/config/opening-hours";
import { unifiedScheduleRanges, replaceScheduleRange, type ScheduleRange } from "@/lib/config/schedule-ranges";
import type { SettingKey } from "@/lib/config/registry";
import { WeeklyHoursField } from "@/components/console/manage/weekly-hours-field";
import { HoursDateField } from "@/components/console/manage/hours-date-field";
import { Button } from "@/components/shared/button";
import { InfoHint } from "@/components/shared/info-hint";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ActionError } from "@/components/shared/action-error";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Json } from "@/types/database.generated";

function dateLabel(value: string): string {
  return value && isValid(parseISO(value)) ? format(parseISO(value), "d MMM yyyy") : "Choose dates";
}

export function BookingSchedulesField({ values, disabled, onChange, onDraftChange }: {
  values: Record<string, Json>; disabled: boolean; onChange: (key: SettingKey, value: Json) => void; onDraftChange: (pending: boolean) => void;
}) {
  const id = useId();
  const [active, setActive] = useState("regular");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<ScheduleRange>({ from: "", to: "", hours: structuredClone(EMPTY_WEEK) });
  const [error, setError] = useState<string>();
  const regular = scheduleWeekDraft.safeParse(values["hours.regular"] ?? EMPTY_WEEK);
  const seasons = schedulePeriodsDraft.safeParse(values["hours.seasonal"] ?? { periods: [] });
  const exceptions = scheduleDatesDraft.safeParse(values["hours.exceptions"] ?? []);
  const closures = scheduleClosuresDraft.safeParse(values["hours.closures"] ?? []);
  if (!regular.success || !seasons.success || !exceptions.success || !closures.success) return <ActionError message="Saved schedules need review before they can be edited." />;
  const week = regular.data;
  const periods = unifiedScheduleRanges(seasons.data, exceptions.data, closures.data);
  function commit(next: ScheduleRange[]) {
    onChange("hours.seasonal", { periods: next });
    onChange("hours.exceptions", []);
    onChange("hours.closures", []);
    setError(undefined);
  }
  function add() {
    const checked = seasonalHoursSchema.safeParse({ periods: [draft] });
    if (!checked.success) { setError(checked.error.issues[0].message); return; }
    const next = replaceScheduleRange(periods, draft);
    commit(next); setAdding(false); onDraftChange(false); setActive(`range-${next.findIndex((period) => period === draft)}`);
  }
  function row(id: string, title: string, detail: string, children: React.ReactNode, remove?: () => void) {
    return <AccordionItem key={id} value={id} className="settings-section min-w-0 shrink-0 overflow-hidden rounded-(--radius-card) border border-border bg-surface-raised">
      <AccordionTrigger disabled={disabled} className="min-h-tap w-full min-w-0 items-center gap-3 px-4 py-4 text-left hover:no-underline sm:px-5"><span className="flex min-w-0 items-center gap-3"><CalendarDaysIcon aria-hidden="true" className="size-5 shrink-0 text-brand" /><span className="min-w-0 break-words"><span className="block text-console-body font-medium">{title}</span><span className="mt-1 block text-micro font-normal text-text-secondary">{detail}</span></span></span></AccordionTrigger>
      <AccordionContent className="h-auto! pb-0"><div className="border-t border-border px-4 pb-2 pt-2 sm:px-5">{children}
        {remove && <div className="flex justify-end border-t border-border py-3"><Button type="button" variant="ghost" tone="danger" hoverEffect="simple" size="sm" aria-label={`Delete ${title}`} disabled={disabled} onClick={remove}><Trash2Icon aria-hidden="true" className="size-4" />Delete schedule</Button></div>}
      </div></AccordionContent>
    </AccordionItem>;
  }
  function dates(period: ScheduleRange, change: (next: ScheduleRange) => void) {
    return <div className="mb-4 grid gap-4 @sm/settings-body:grid-cols-2"><HoursDateField label="From" value={period.from} disabled={disabled} onChange={(from) => change({ ...period, from, to: period.to || from })} /><HoursDateField label="Through" value={period.to} disabled={disabled} onChange={(to) => change({ ...period, to })} /></div>;
  }
  function nameField(period: ScheduleRange, fieldId: string, change: (next: ScheduleRange) => void) {
    return <Field className="my-4"><FieldLabel htmlFor={fieldId}>Schedule name (optional)</FieldLabel><Input id={fieldId} value={period.name ?? ""} maxLength={HOURS_EDITOR.scheduleNameMaxLength} placeholder="For example, Summer hours" disabled={disabled} onChange={(event) => change({ ...period, name: event.target.value })} /></Field>;
  }
  const overlaps = periods.some((period) => draft.from && draft.to && period.from <= draft.to && period.to >= draft.from);
  return <div className="flex min-w-0 flex-col gap-4">
    <div className="flex items-center justify-between gap-2"><p className="text-micro text-text-secondary">Day off means closed. All times are Dubai time.</p><InfoHint label="Schedules">Date schedules replace the usual week for their dates. Use the same start and end for one day, or turn every day off to close a date range. Add another date schedule when different dates need different hours.</InfoHint></div>
    <Accordion type="single" collapsible value={active} onValueChange={setActive} className="flex flex-col gap-3">
      {row("regular", "Usual week", "Repeats outside your date schedules", <WeeklyHoursField value={week} disabled={disabled} onChange={(hours) => onChange("hours.regular", hours as unknown as Json)} />)}
      {periods.map((period, index) => row(`range-${index}`, period.name?.trim() || (period.from === period.to ? dateLabel(period.from) : `${dateLabel(period.from)} – ${dateLabel(period.to)}`), [period.name?.trim() ? (period.from === period.to ? dateLabel(period.from) : `${dateLabel(period.from)} – ${dateLabel(period.to)}`) : "", Object.values(period.hours).every((windows) => !windows.length) ? "Closed" : "Custom hours"].filter(Boolean).join(" · "), <>
        {nameField(period, `${id}-name-${index}`, (next) => commit(periods.map((entry, i) => i === index ? next : entry)))}
        {dates(period, (next) => commit(periods.map((entry, i) => i === index ? next : entry)))}
        <WeeklyHoursField value={period.hours} disabled={disabled} onChange={(hours) => commit(periods.map((entry, i) => i === index ? { ...entry, hours: hours as WeeklyHours } : entry))} />
      </>, () => { commit(periods.filter((_, i) => i !== index)); setActive("regular"); }))}
    </Accordion>
    {adding ? <div className="flex flex-col gap-3 rounded-(--radius-card) border border-brand bg-surface-raised p-4">
      <h3 className="text-console-body font-medium">Add schedule</h3>
      {nameField(draft, `${id}-new-name`, setDraft)}
      {dates(draft, setDraft)}
      <WeeklyHoursField value={draft.hours} disabled={disabled} onChange={(hours) => setDraft({ ...draft, hours: hours as WeeklyHours })} />
      {overlaps && <p className="text-micro text-warning">This replaces the existing hours within these dates. Dates outside this range keep their hours.</p>}
      {error && <ActionError message={error} />}
      <div className="flex flex-col-reverse gap-2 @sm/settings-body:flex-row @sm/settings-body:justify-end"><Button type="button" variant="ghost" disabled={disabled} onClick={() => { setAdding(false); onDraftChange(false); }}>Discard schedule</Button><Button type="button" disabled={disabled || !draft.from || !draft.to} onClick={add}>Add to schedules</Button></div>
    </div> : <Button type="button" variant="outline" hoverEffect="simple" className="w-full" disabled={disabled} onClick={() => { setDraft({ from: "", to: "", hours: structuredClone(week) }); setAdding(true); onDraftChange(true); setActive(""); setError(undefined); }}><PlusIcon aria-hidden="true" className="size-4" />Add schedule</Button>}
  </div>;
}
