"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/console/feedback";
import { XIcon } from "lucide-react";
import { saveSettingsPanel } from "@/app/(console)/manage/settings/actions";
import { settingsFieldMatches } from "@/lib/config/settings-search";
import { SETTINGS, type SettingKey } from "@/lib/config/registry";
import type { SettingsPanel } from "@/lib/config/settings-panels";
import { validateSettingsPanel } from "@/lib/validation/settings-panel";
import { settingParent } from "@/lib/config/setting-dependencies";
import { overstaySummary } from "@/lib/config/overstay";
import {
  INVOICE_SETTING_KEY,
  invoiceIssuerReadiness,
  invoiceNumberExample,
  invoiceReadinessMessage,
  invoiceSettingsProblem,
} from "@/lib/config/invoice";
import { todayInDubai } from "@/lib/domain/time";
import { SettingsSection } from "@/components/console/manage/settings-section";
import { SettingsPanelField } from "@/components/console/manage/settings-panel-field";
import { AvailabilityNoticesField } from "@/components/console/manage/availability-notices-field";
import { BookingSchedulesField } from "@/components/console/manage/booking-schedules-field";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ActionError } from "@/components/shared/action-error";
import { Button } from "@/components/shared/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { Json } from "@/types/database.generated";

function Details({ title, children, expanded = false }: { title: string; children: React.ReactNode; expanded?: boolean }) {
  return <Accordion type="single" collapsible defaultValue={expanded ? "details" : undefined} className="settings-section min-w-0 shrink-0 overflow-hidden rounded-(--radius-card) border border-border bg-surface-raised"><AccordionItem value="details" className="border-0"><AccordionTrigger className="min-h-tap items-center gap-3 px-4 py-4 text-console-body hover:no-underline sm:px-5">{title}</AccordionTrigger><AccordionContent className="h-auto! pb-0"><div className="flex min-w-0 flex-col gap-4 border-t border-border p-4 sm:p-5">{children}</div></AccordionContent></AccordionItem></Accordion>;
}

export function SettingsPanelEditor({ panel, stored, search = "", onClose }: { panel: SettingsPanel; stored: Record<string, Json>; search?: string; onClose: () => void }) {
  const [expected] = useState(() => Object.fromEntries(panel.keys.map((key) => [key, stored[key] ?? null])));
  const [values, setValues] = useState<Record<string, Json>>(() => ({ ...expected }));
  const searchMatches = (keys: readonly SettingKey[]) => Boolean(search.trim()) && keys.some((key) => settingsFieldMatches(key, search));
  const rulesMatch = searchMatches(["booking.durations_hours", "booking.guests_min", "booking.guests_max", "booking.child_min_age", "booking.child_max_age", "booking.booker_min_age", "allocation.strategy"]);
  const [scheduleDraft, setScheduleDraft] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();
  const effective = (key: SettingKey) => values[key] ?? SETTINGS[key].defaultValue;
  const changed = JSON.stringify(values) !== JSON.stringify(expected);
  function update(key: SettingKey, value: Json) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (value === false) for (const child of panel.keys) if (settingParent(child) === key) next[child] = expected[child];
      return next;
    });
    setError(undefined);
  }
  function field(key: SettingKey) {
    const parent = settingParent(key);
    return <SettingsPanelField key={key} settingKey={key} value={values[key] ?? null} disabled={pending || Boolean(parent && effective(parent) === false)} onChange={(value) => update(key, value)} />;
  }
  function fields(keys: readonly SettingKey[]) { return keys.map(field); }
  function close() { if (!pending) onClose(); }
  function save() {
    if (scheduleDraft) { setError("Add or discard the new schedule before saving."); return; }
    const invoiceProblem = panel.id === "invoices" ? invoiceSettingsProblem(values) : null;
    if (invoiceProblem) { setError(invoiceProblem); return; }
    const input = { panel: panel.id, values, expected };
    const checked = validateSettingsPanel(input);
    if (!checked.ok) { setError(checked.message); return; }
    setError(undefined);
    start(async () => {
      try {
        const result = await saveSettingsPanel(input);
        if (!result.ok) { setError(result.message); router.refresh(); return; }
        toast.success(`${panel.title} saved`);
        onClose(); router.refresh();
      } catch { setError("Your changes could not be saved. Please try again; your entries are still here."); }
    });
  }
  return <Sheet open onOpenChange={(open) => !open && close()}><SheetContent showCloseButton={false} className="density-console settings-panel gap-0 bg-surface-raised text-text-primary  motion-reduce:animate-none motion-reduce:transition-none">
    <form noValidate className="flex min-h-0 min-w-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); save(); }}>
      <SheetHeader className="shrink-0 border-b border-border p-5 pr-16">
        <SheetTitle className="font-body text-console-title font-medium">{panel.title}</SheetTitle>
        <SheetDescription className="mt-1 text-micro text-text-secondary">{panel.help}</SheetDescription>
      </SheetHeader>
      <div className="absolute top-3 right-3"><Button type="button" variant="ghost" size="icon" aria-label="Close settings" disabled={pending} onClick={close}><XIcon className="size-4" /></Button></div>
      <div className="settings-panel-body @container/settings-body min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-surface-base p-4 sm:p-6">
        <fieldset disabled={pending} className="flex min-w-0 flex-col gap-4">
          <legend className="sr-only">{panel.title}</legend>
          {panel.id === "booking" && <Tabs defaultValue={rulesMatch ? "rules" : "schedule"} className="min-w-0 gap-4">
            <TabsList className="grid w-full grid-cols-2 bg-surface-sunken p-1 group-data-horizontal/tabs:h-auto"><TabsTrigger value="schedule" className="h-tap">Schedule</TabsTrigger><TabsTrigger value="rules" className="h-tap">Visit rules</TabsTrigger></TabsList>
            <TabsContent value="schedule" className="mt-0 flex flex-col gap-4">
              <BookingSchedulesField values={values} disabled={pending} onChange={update} onDraftChange={setScheduleDraft} />
              <Details expanded={searchMatches(["booking.start_interval_minutes", "cleaning.buffer_minutes", "hold.minutes", "booking.max_horizon_days", "reception.arrival_overdue_minutes"])} title="Booking and cleaning time"><div className="grid gap-4 @sm/settings-body:grid-cols-2">{fields(["booking.start_interval_minutes", "cleaning.buffer_minutes", "hold.minutes", "booking.max_horizon_days"])}</div>{field("reception.arrival_overdue_minutes")}</Details>
            </TabsContent>
            <TabsContent value="rules" className="mt-0 flex flex-col gap-4">
              <SettingsSection>{field("booking.durations_hours")}</SettingsSection>
              <SettingsSection title="Guests per visit"><div className="grid gap-4 @sm/settings-body:grid-cols-2">{fields(["booking.guests_min", "booking.guests_max"])}</div></SettingsSection>
              <Details expanded={searchMatches(["booking.child_min_age", "booking.child_max_age", "booking.booker_min_age"])} title="Guest ages"><div className="grid gap-4 @sm/settings-body:grid-cols-2">{fields(["booking.child_min_age", "booking.child_max_age"])}</div>{fields(["booking.booker_min_age"])}</Details>
              <Details expanded={searchMatches(["allocation.strategy"])} title="Suite assignment">{field("allocation.strategy")}</Details>
            </TabsContent>
          </Tabs>}
          {panel.id === "overstay" && <SettingsSection>
            {fields(["overrun.rate_source", "overrun.increment_minutes"])}
            {effective("overrun.rate_source") === "fixed" && field("overrun.fixed_fils_per_increment")}
            <p className="rounded-(--radius-control) bg-surface-sunken p-4 text-console-body text-text-secondary">{overstaySummary({ rateSource: effective("overrun.rate_source"), amountFils: effective("overrun.fixed_fils_per_increment") }, Number(effective("overrun.increment_minutes"))).replace(" / each started ", ", per started ")}</p>
          </SettingsSection>}
          {panel.id === "pricing" && <>
            <Button asChild variant="outline"><Link href="/manage/pricing">Manage hourly rates and add-ons</Link></Button>
            <SettingsSection>{field("fees.tabby.enabled")}
            {effective("fees.tabby.enabled") === true && <div className="grid gap-4 border-t border-border pt-4 @sm/settings-body:grid-cols-2">{fields(["fees.tabby.percent", "fees.tabby.label"])}</div>}</SettingsSection>
            <Details expanded={searchMatches(["tax.vat_percent", "tax.inclusive", "tax.label", "pricing.rounding_fils"])} title="Tax and price display">{fields(["tax.vat_percent", "tax.inclusive", "tax.label", "pricing.rounding_fils"])}</Details>
            <Details expanded={searchMatches(["pricing.offer_label"])} title="Offer wording">{fields(["pricing.offer_label"])}</Details>
          </>}
          {panel.id === "urgency" && <AvailabilityNoticesField values={values} disabled={pending} onChange={update} />}
          {panel.id === "contact" && <><SettingsSection>{field("contact.whatsapp_e164")}<p className="text-micro text-text-secondary">Opens a chat from the website button.</p></SettingsSection><SettingsSection>{field("contact.email")}</SettingsSection></>}
          {panel.id === "invoices" && <>
            <SettingsSection title="Issuer details">{fields([INVOICE_SETTING_KEY.legalName, INVOICE_SETTING_KEY.trn, INVOICE_SETTING_KEY.address])}</SettingsSection>
            <SettingsSection title="Invoice numbers">{field(INVOICE_SETTING_KEY.prefix)}<p className="text-micro text-text-secondary">{invoiceNumberExample(invoiceIssuerReadiness(values).prefix, todayInDubai().slice(0, 4))}</p></SettingsSection>
            <p role="status" className="rounded-(--radius-control) bg-surface-sunken p-4 text-console-body text-text-secondary">{invoiceReadinessMessage(invoiceIssuerReadiness(values))}</p>
          </>}
        </fieldset>
      </div>
      {error && <div className="shrink-0 border-t border-border bg-surface-raised px-5 py-3"><ActionError message={error} /></div>}
      <SheetFooter className="grid shrink-0 grid-cols-2 gap-3 border-t border-border bg-surface-raised p-4 sm:flex sm:flex-row sm:justify-end sm:p-5">
        <Button type="button" variant="outline" hoverEffect="sweep" disabled={pending} onClick={close}>Cancel</Button><Button type="submit" hoverEffect="sweep" disabled={pending || !changed || scheduleDraft}>{pending ? "Saving…" : "Save changes"}</Button>
      </SheetFooter>
    </form>
  </SheetContent></Sheet>;
}
