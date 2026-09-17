"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/console/feedback";
import { saveCatalogue } from "@/app/(console)/manage/pricing/actions";
import { CATALOGUE, catalogueInputError, catalogueNumberLimits, addonEditorSchema, priceEditorSchema, type EditableAddon, type EditablePrice } from "@/lib/config/catalogue";
import { Button } from "@/components/shared/button";
import { ConsoleSwitch } from "@/components/shared/console-switch";
import { InfoHint } from "@/components/shared/info-hint";
import { ActionError } from "@/components/shared/action-error";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shared/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { HoursDateField } from "@/components/console/manage/hours-date-field";
import { ClockField } from "@/components/console/manage/clock-field";
import { CmsMediaPicker } from "@/components/console/cms/cms-media-picker";

export function CatalogueEditor({ kind, initial, onClose }: { kind: "price" | "addon"; initial: EditablePrice | EditableAddon; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, unknown>>({ ...initial });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const router = useRouter();
  const prefix = useId();
  const update = (key: string, value: unknown) => { setValues((v) => ({ ...v, [key]: value })); setError(undefined); };
  const number = (key: string, label: string, amount = false, optional = false) => <CatalogueNumberField key={key} id={`${prefix}-${key}`} label={label} limits={catalogueNumberLimits(key, amount)} initial={values[key]} amount={amount} optional={optional} onChange={(v) => update(key, v)} />;
  const text = (key: string, label: string, multiline = false) => <Field><FieldLabel htmlFor={`${prefix}-${key}`}>{label}</FieldLabel>{multiline ? <Textarea maxLength={CATALOGUE.maxText} id={`${prefix}-${key}`} value={String(values[key] ?? "")} onChange={(e) => update(key, e.target.value || null)} /> : <Input maxLength={key === "name" || key === "code" ? CATALOGUE.maxName : CATALOGUE.maxText} id={`${prefix}-${key}`} value={String(values[key] ?? "")} onChange={(e) => update(key, e.target.value || null)} />}</Field>;
  const toggle = (key: string, label: string, help?: string) => <div className="flex min-h-tap items-center justify-between gap-3"><div className="flex items-center gap-2"><label htmlFor={`${prefix}-${key}`}>{label}</label>{help && <InfoHint label={label}>{help}</InfoHint>}</div><ConsoleSwitch id={`${prefix}-${key}`} checked={values[key] === true} onCheckedChange={(v) => update(key, v)} /></div>;
  const choice = (key: string, label: string, options: readonly string[]) => <Field><FieldLabel htmlFor={`${prefix}-${key}`}>{label}</FieldLabel><Select value={String(values[key])} onValueChange={(v) => update(key, v)}><SelectTrigger id={`${prefix}-${key}`} className="min-h-tap w-full"><SelectValue /></SelectTrigger><SelectContent>{options.map((v) => <SelectItem key={v} value={v} className="min-h-tap">{v.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></Field>;
  function dates(from: string, to: string) {
    return <div className="grid gap-4 sm:grid-cols-2">{[from, to].map((key, index) => <div key={key} className="space-y-1"><HoursDateField label={index ? "Through (optional)" : "From (optional)"} value={String(values[key] ?? "")} onChange={(v) => update(key, v || null)} /><Button type="button" size="sm" variant="ghost" disabled={!values[key]} onClick={() => update(key, null)}>Clear date</Button></div>)}</div>;
  }
  const time = (key: string, label: string) => { const minutes = Number(values[key] ?? 0); return <ClockField label={label} value={`${String(Math.floor(minutes / 60) % 24).padStart(2,"0")}:${String(minutes % 60).padStart(2,"0")}`} onChange={(v) => { const [hour, minute] = v.split(":").map(Number); const next = hour * 60 + minute; update(key, key === "start_to_minutes" && next === 0 ? 1440 : next); }} />; };
  function save() {
    const parsed = (kind === "price" ? priceEditorSchema : addonEditorSchema).safeParse(values);
    if (!parsed.success) { setError(catalogueInputError(parsed.error.issues[0])); return; }
    start(async () => {
      try {
        const result = await saveCatalogue({ kind, values: parsed.data, expected: initial.id ? initial : null });
        if (!result.ok) { setError(result.message); return; }
        toast.success(kind === "price" ? "Rate saved" : "Add-on saved"); router.refresh(); onClose();
      } catch { setError("Your changes could not be saved. Try again."); }
    });
  }
  return <Sheet open onOpenChange={(open) => { if (!open && !pending) onClose(); }}><SheetContent className="density-console settings-panel gap-0 bg-surface-raised text-text-primary">
    <SheetHeader className="shrink-0 border-b border-border p-5 pr-16"><SheetTitle>{initial.id ? "Edit" : "Add"} {kind === "price" ? "rate" : "add-on"}</SheetTitle><SheetDescription>Save changes to update new bookings.</SheetDescription></SheetHeader>
    <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); save(); }}><fieldset disabled={pending} className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain bg-surface-base p-5">
      {toggle("is_active", "Available for new bookings", "Turn off to stop offering this item. Existing bookings keep their saved prices.")}
      {kind === "price" ? <>
        {choice("guest_kind", "Guest type", ["adult", "child"])}
        <div className="grid gap-4 sm:grid-cols-2">{number("from_hour", "From booked hour")}{number("to_hour", "Through booked hour", false, true)}</div>
        {number("regular_fils_per_hour", "Regular hourly price (AED)", true)}
        <Field><FieldLabel>Offer type</FieldLabel><Select value={values.offer_percent === null ? "amount" : "percent"} onValueChange={(v) => { update("offer_percent", v === "percent" ? 0 : null); update("offer_fils_per_hour", v === "amount" ? values.regular_fils_per_hour : null); }}><SelectTrigger aria-label="Offer type" className="min-h-tap w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="amount">Hourly amount</SelectItem><SelectItem value="percent">Percentage discount</SelectItem></SelectContent></Select></Field>
        {values.offer_percent === null ? number("offer_fils_per_hour", "Offer hourly price (AED)", true) : number("offer_percent", "Discount (%)")}
        <Accordion type="single" collapsible><AccordionItem value="conditions"><AccordionTrigger>Dates, days and priority</AccordionTrigger><AccordionContent className="space-y-4">
          {dates("season_from", "season_to")}
          <div className="flex flex-wrap gap-3">{CATALOGUE.weekdays.map((day, index) => { const selected = Array.isArray(values.weekdays) ? values.weekdays as number[] : CATALOGUE.weekdays.map((_, i) => i); return <label key={day} className="flex min-h-tap items-center gap-2"><Checkbox checked={selected.includes(index)} onCheckedChange={(on) => update("weekdays", on ? [...selected, index] : selected.filter((v) => v !== index))} />{day}</label>; })}</div>
          <Button type="button" variant="outline" onClick={() => { update("start_from_minutes", values.start_from_minutes === null ? 0 : null); update("start_to_minutes", values.start_from_minutes === null ? 1440 : null); }}>{values.start_from_minutes === null ? "Limit booking start times" : "Use all start times"}</Button>
          {values.start_from_minutes !== null && <div className="grid gap-4 sm:grid-cols-2">{time("start_from_minutes", "Starts from")}{time("start_to_minutes", "Starts before")}</div>}
          {values.start_to_minutes === 1440 && <p className="text-micro text-text-secondary">12:00 AM ends the day.</p>}
          {number("priority", "Priority")}<p className="text-micro text-text-secondary">Higher priority wins when rates overlap.</p>
        </AccordionContent></AccordionItem></Accordion>
      </> : <>
        {text("name", "Name")}{text("description", "Description", true)}
        <CmsMediaPicker slug="book" label="Image" url={String(values.image_path ?? "")} onUploaded={({ url }) => update("image_path", url)} onClear={() => update("image_path", null)} />
        {choice("kind", "Item type", CATALOGUE.kinds)}
        <div className="grid gap-4 sm:grid-cols-2">{number("regular_price_fils", "Regular price (AED)", true)}{number("offer_price_fils", "Offer price (AED)", true)}</div>
        {Number(values.offer_price_fils) === 0 && <p className="text-micro text-text-secondary">Included automatically at the default quantity when active.</p>}
        {text("saving_label", "Saving label (optional)")}
        <div className="grid gap-4 sm:grid-cols-3">{number("min_quantity", "Minimum quantity")}{number("default_quantity", "Default quantity")}{number("max_quantity", "Maximum quantity")}</div>
        {toggle("is_locked", "Keep included item in cart")}
        <div className="flex min-h-tap items-center justify-between gap-3"><label htmlFor={`${prefix}-sold-out`}>Sold out</label><ConsoleSwitch id={`${prefix}-sold-out`} checked={values.inventory === 0} onCheckedChange={(v) => update("inventory", v ? 0 : null)} /></div>
        <Accordion type="single" collapsible><AccordionItem value="details"><AccordionTrigger>Sales dates and Reception details</AccordionTrigger><AccordionContent className="space-y-4">{dates("available_from", "available_to")}{text("reception_note", "Preparation or return instructions", true)}{number("sort_order", "Display order")}{toggle("is_taxable", "VAT applies")}</AccordionContent></AccordionItem></Accordion>
      </>}
    </fieldset>{error && <div className="border-t border-border p-4"><ActionError message={error} /></div>}
    <SheetFooter className="grid shrink-0 grid-cols-2 gap-3 border-t border-border p-5"><Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button></SheetFooter></form>
  </SheetContent></Sheet>;
}

function CatalogueNumberField({ id, label, limits, initial, amount, optional, onChange }: { id: string; label: string; limits: ReturnType<typeof catalogueNumberLimits>; initial: unknown; amount: boolean; optional: boolean; onChange: (value: number | null) => void }) {
  const [value, setValue] = useState(initial == null ? "" : String(Number(initial) / (amount ? 100 : 1)));
  const bounded = limits.max * (amount ? 100 : 1) < CATALOGUE.maxInteger;
  return <Field><FieldLabel htmlFor={id}>{label}{optional && <span className="text-text-secondary"> (optional)</span>}</FieldLabel><Input id={id} type="number" {...limits} required={!optional} aria-describedby={bounded ? `${id}-range` : undefined} inputMode={amount ? "decimal" : "numeric"} value={value} onChange={(e) => {
    const next = e.target.value;
    if (!(amount ? /^\d*(?:\.\d{0,2})?$/ : limits.step === "any" ? /^\d*(?:\.\d*)?$/ : /^\d*$/).test(next)) return;
    setValue(next); onChange(next === "" || next === "." ? null : amount ? Math.round(Number(next) * 100) : Number(next));
  }} />{bounded && <p id={`${id}-range`} className="text-micro text-text-secondary">{limits.min.toLocaleString("en")} to {limits.max.toLocaleString("en", { maximumFractionDigits: 2 })}{amount ? " AED" : ""}.</p>}</Field>;
}
