"use client";

import { useId, useState } from "react";
import { z } from "zod";
import { SETTING_TEXT_LIMITS, settingInputLimits, settingLimitHint } from "@/lib/config/setting-limits";
import { ChevronDownIcon, PlusIcon, XIcon } from "lucide-react";
import { SETTINGS, VISIT_LENGTH_LIMITS, visitLengthSchema, type SettingKey } from "@/lib/config/registry";
import { SETTINGS_NUMBER_CHOICES, settingsFieldLabel } from "@/lib/config/settings-panels";
import { SETTING_PRESETS, editableNumber, settingOptionLabel, settingUnit } from "@/lib/config/settings-presentation";
import { OVERSTAY_OPTIONS } from "@/lib/config/overstay";
import { ConsoleSwitch } from "@/components/shared/console-switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shared/select";
import { Button } from "@/components/shared/button";
import { InfoHint } from "@/components/shared/info-hint";
import { SETTING_HELP } from "@/lib/config/setting-help";
import {
  INVOICE_COPY,
  INVOICE_DEFAULT_PREFIX,
  INVOICE_SETTING_KEY,
  invoicePrefixHint,
  invoiceSettingInput,
  isInvoiceSettingKey,
} from "@/lib/config/invoice";
import { cn } from "@/lib/utils";
import { PhoneInput, emptyPhoneValue, toE164, type PhoneValue } from "@/components/shared/phone-input";
import { COUNTRIES } from "@/components/shared/countries";
import type { Json } from "@/types/database.generated";

function phoneValue(raw: string): PhoneValue {
  const country = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length).find((item) => raw.startsWith(item.dialCode));
  return country ? { countryIso2: country.iso2, dialCode: country.dialCode, nationalNumber: raw.slice(country.dialCode.length) } : emptyPhoneValue();
}

function ContactPhone({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: Json) => void }) {
  const id = useId();
  const [phone, setPhone] = useState(() => phoneValue(value));
  return <PhoneInput id={id} label="WhatsApp" value={phone} disabled={disabled} onChange={(next) => { setPhone(next); onChange(toE164(next) || null); }} />;
}

export function SettingsPanelField({ settingKey: key, value, disabled = false, onChange }: {
  settingKey: SettingKey; value: Json; disabled?: boolean; onChange: (value: Json) => void;
}) {
  const id = useId();
  const [custom, setCustom] = useState(false);
  const [duration, setDuration] = useState("");
  const label = settingsFieldLabel(key);
  const effective = value ?? SETTINGS[key].defaultValue;
  const schema = SETTINGS[key].schema;
  const amount = key === "overrun.fixed_fils_per_increment";
  const numeric = typeof SETTINGS[key].defaultValue === "number" || amount;
  const displayed = typeof effective === "number" ? amount ? effective / 100 : editableNumber(key, effective) : effective;
  const choices = SETTING_PRESETS[key] ?? SETTINGS_NUMBER_CHOICES[key];
  const unit = settingUnit(key);
  const limits = settingInputLimits(key);
  const hint = settingLimitHint(key);
  const invalid = value !== null && !schema.safeParse(value).success;
  const [numberText, setNumberText] = useState(() => String(displayed ?? ""));

  if (key === "contact.whatsapp_e164") return <ContactPhone value={String(effective ?? "")} disabled={disabled} onChange={onChange} />;
  if (isInvoiceSettingKey(key)) {
    const trn = key === INVOICE_SETTING_KEY.trn;
    const prefix = key === INVOICE_SETTING_KEY.prefix;
    const invoiceHint = trn ? INVOICE_COPY.settings.trnHint : prefix ? invoicePrefixHint() : hint;
    const text = typeof value === "string" ? value : "";
    const describedBy = invoiceHint ? `${id}-limits` : undefined;
    const change = (raw: string) => onChange(invoiceSettingInput(key, raw));
    return <Field className="min-w-0">
      <div className="flex min-h-tap items-center gap-1"><FieldLabel htmlFor={id} className="min-w-0 leading-snug">{label}</FieldLabel><InfoHint label={label}>{SETTING_HELP[key]}</InfoHint></div>
      {key === INVOICE_SETTING_KEY.address
        ? <Textarea id={id} rows={3} maxLength={SETTING_TEXT_LIMITS[key]} aria-describedby={describedBy} value={text} disabled={disabled} onChange={(event) => change(event.target.value)} className="resize-none" />
        : <Input id={id} maxLength={trn ? undefined : SETTING_TEXT_LIMITS[key]} aria-describedby={describedBy} aria-invalid={invalid || undefined} inputMode={trn ? "numeric" : undefined} autoComplete="off" placeholder={prefix ? INVOICE_DEFAULT_PREFIX : undefined} value={text} disabled={disabled} onChange={(event) => change(event.target.value)} className={cn("h-tap", (trn || prefix) && "font-data")} />}
      {invoiceHint && <p id={`${id}-limits`} className="text-micro text-text-secondary">{invoiceHint}</p>}
    </Field>;
  }
  if (typeof effective === "boolean") return <div className="flex min-h-tap items-center justify-between gap-4">
    <div className="flex items-center gap-1"><label htmlFor={id} className="text-console-body font-medium">{label}</label><InfoHint label={label}>{SETTING_HELP[key]}</InfoHint></div>
    <ConsoleSwitch id={id} checked={effective} disabled={disabled} onCheckedChange={onChange} />
  </div>;
  if (key === "booking.durations_hours") {
    const selected = Array.isArray(effective) ? effective.filter((item): item is number => typeof item === "number") : [];
    const options = [...new Set(selected)].sort((a, b) => a - b);
    const validDuration = visitLengthSchema.safeParse(Number(duration)).success;
    return <Field><FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-2">{options.map((hours) => <div key={hours} className="flex max-w-full items-center rounded-(--radius-button) bg-surface-sunken pl-3">
        <span className="min-w-0 break-all text-fine">{hours} hours</span>
        <Button type="button" variant="ghost" tone="danger" size="icon" className="shrink-0" aria-label={`Remove ${hours} hours`} disabled={disabled || options.length === 1} onClick={() => onChange(selected.filter((item) => item !== hours))}><XIcon className="size-4" /></Button>
      </div>)}</div>
      {options.length === 1 && <p className="text-micro text-text-secondary">Keep at least one visit length. Add another before removing this one.</p>}
      <Button type="button" variant="ghost" size="sm" className="w-auto! self-start" disabled={disabled} aria-expanded={custom} aria-controls={`${id}-duration`} onClick={() => setCustom(!custom)}><PlusIcon className="size-4" />Add duration</Button>
      {custom && <div id={`${id}-duration`} className="space-y-2">
        <div className="flex items-center gap-2"><Input aria-label="Visit length in hours" aria-describedby={`${id}-duration-help`} aria-invalid={Boolean(duration) && !validDuration} type="number" min={VISIT_LENGTH_LIMITS.min} max={VISIT_LENGTH_LIMITS.max} step={1} inputMode="numeric" placeholder="Hours" value={duration} disabled={disabled} onChange={(event) => setDuration(event.target.value)} /><Button type="button" variant="outline" disabled={disabled || !validDuration || selected.includes(Number(duration))} onClick={() => { onChange([...selected, Number(duration)].sort((a, b) => a - b)); setDuration(""); setCustom(false); }}>Add</Button></div>
        <p id={`${id}-duration-help`} className="text-micro text-text-secondary">{selected.includes(Number(duration)) ? "This visit length is already added." : `Choose a whole number from ${VISIT_LENGTH_LIMITS.min} to ${VISIT_LENGTH_LIMITS.max} hours. Visits must fit within opening hours.`}</p>
      </div>}
    </Field>;
  }
  function updateNumber(raw: string) {
    setNumberText(raw);
    if (!raw.trim() || !/^\d*(?:\.\d*)?$/.test(raw)) { onChange(raw); return; }
    if ((amount || key === "pricing.rounding_fils") && !/^\d+(?:\.\d{1,2})?$/.test(raw)) { onChange(raw); return; }
    const number = Number(raw);
    onChange(key === "pricing.rounding_fils" || amount ? Math.round(number * 100) : number);
  }
  return <Field className="min-w-0">
    <div className="flex min-h-tap items-center gap-1"><FieldLabel htmlFor={id} className="min-w-0 leading-snug">{label}</FieldLabel><InfoHint label={label}>{SETTING_HELP[key]}</InfoHint></div>
    {schema instanceof z.ZodEnum ? <Select value={String(effective ?? "")} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger id={id} className="min-h-tap w-full"><SelectValue /></SelectTrigger>
      <SelectContent className="settings-popup max-h-64">{schema.options.map((option) => <SelectItem key={String(option)} value={String(option)} className="min-h-tap">{key === "overrun.rate_source" ? OVERSTAY_OPTIONS.find((entry) => entry.value === option)?.label : settingOptionLabel(String(option))}</SelectItem>)}</SelectContent>
    </Select> : numeric ? <>
      {choices && !custom ? <Select value={String(displayed ?? "")} disabled={disabled} onValueChange={(next) => next === "custom" ? setCustom(true) : updateNumber(next)}>
        <SelectTrigger id={id} className="min-h-tap w-full"><SelectValue placeholder="Choose" /></SelectTrigger>
        <SelectContent className="settings-popup max-h-64">{[...new Set([...choices, ...(typeof displayed === "number" ? [displayed] : [])])].sort((a, b) => a - b).map((choice) => <SelectItem key={choice} value={String(choice)} className="min-h-tap">{choice} {unit}</SelectItem>)}<SelectItem value="custom" className="min-h-tap">Custom value…</SelectItem></SelectContent>
      </Select> : <div className="flex items-center gap-2"><Input id={id} type="number" min={limits?.min} max={limits?.max} step={amount || key === "pricing.rounding_fils" ? "0.01" : key.endsWith("percent") ? "any" : 1} aria-invalid={invalid || undefined} aria-describedby={hint ? `${id}-limits` : undefined} inputMode={amount || key === "pricing.rounding_fils" || key.endsWith("percent") ? "decimal" : "numeric"} value={numberText} disabled={disabled} onChange={(event) => updateNumber(event.target.value)} className="h-tap min-w-0 font-data" />{unit && <span className="shrink-0 text-micro text-text-secondary">{unit}</span>}{choices && <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={`Choose ${label.toLowerCase()} from list`} onClick={() => setCustom(false)}><ChevronDownIcon className="size-4" /></Button>}</div>}
    </> : ((key.startsWith("pricing.offer_") && key !== "pricing.offer_label") || key === "contact.address") ? <Textarea id={id} maxLength={SETTING_TEXT_LIMITS[key]} aria-describedby={hint ? `${id}-limits` : undefined} value={String(effective ?? "")} rows={3} disabled={disabled} onChange={(event) => onChange(event.target.value)} /> : <Input id={id} maxLength={SETTING_TEXT_LIMITS[key]} aria-describedby={hint ? `${id}-limits` : undefined} type={key === "contact.email" ? "email" : "text"} value={String(effective ?? "")} disabled={disabled} onChange={(event) => onChange(key === "contact.email" ? event.target.value.trim() || null : key === "pricing.currency" ? event.target.value.toUpperCase() : event.target.value)} className="h-tap" />}
    {hint && <p id={`${id}-limits`} className="text-micro text-text-secondary">{hint}</p>}
  </Field>;
}
