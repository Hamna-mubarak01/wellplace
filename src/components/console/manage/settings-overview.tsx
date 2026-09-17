"use client";

import { useState } from "react";
import { CalendarClockIcon, ChevronRightIcon, FileTextIcon, HourglassIcon, MessageSquareIcon, PhoneIcon, ReceiptIcon, SearchXIcon, Settings2Icon, type LucideIcon } from "lucide-react";
import { clockLabel } from "@/lib/config/clock-picker";
import { INVOICE_COPY, describeMissingIssuerDetails, invoiceIssuerReadiness } from "@/lib/config/invoice";
import { settingsPanelMatches } from "@/lib/config/settings-search";
import { ConsoleSearchInput } from "@/components/shared/console-search-input";
import { SETTINGS, type SettingKey } from "@/lib/config/registry";
import { SETTINGS_PANELS, SETTINGS_PANEL_LINKS, type SettingsPanel } from "@/lib/config/settings-panels";
import { SettingsPanelEditor } from "@/components/console/manage/settings-panel-editor";
import { toWeeklyHoursDraft } from "@/components/console/manage/settings-model";
import { ConsoleEmpty } from "@/components/console/console-surface";
import { DetailSection } from "@/components/console/shared/detail-section";
import { Button } from "@/components/shared/button";
import type { Json } from "@/types/database.generated";

const ICONS: Readonly<Record<string, LucideIcon | undefined>> = { booking: CalendarClockIcon, overstay: HourglassIcon, pricing: ReceiptIcon, urgency: MessageSquareIcon, contact: PhoneIcon, invoices: FileTextIcon };

function invoiceSummary(stored: Record<string, Json>): string {
  const readiness = invoiceIssuerReadiness(stored);
  if (readiness.ready) return `${readiness.legalName} · TRN ${readiness.trn}`;
  if (readiness.missing.length === 0) return INVOICE_COPY.settings.prefixInvalid;
  return `Not set · add ${describeMissingIssuerDetails(readiness.missing)}`;
}

function summary(panel: SettingsPanel, stored: Record<string, Json>): string {
  const value = (key: SettingKey) => stored[key] ?? SETTINGS[key].defaultValue;
  switch (panel.id) {
    case "booking": {
      if (!value("hours.regular")) return "Add your usual opening hours";
      if (!SETTINGS["hours.regular"].schema.safeParse(value("hours.regular")).success) return "Saved hours need review";
      const days = Object.values(toWeeklyHoursDraft(value("hours.regular")));
      const same = days.every((day) => JSON.stringify(day) === JSON.stringify(days[0]));
      const first = days[0];
      const week = same ? first.length ? `Every day ${first.map((window) => `${clockLabel(window.opens)} – ${clockLabel(window.closes)}`).join(", ")}` : "Closed every day" : "Hours vary by day";
      const exceptions = SETTINGS["hours.exceptions"].schema.safeParse(value("hours.exceptions") ?? []);
      const closures = SETTINGS["hours.closures"].schema.safeParse(value("hours.closures") ?? []);
      const seasons = SETTINGS["hours.seasonal"].schema.safeParse(value("hours.seasonal") ?? { periods: [] });
      const count = (exceptions.success ? exceptions.data.length : 0) + (closures.success ? closures.data.length : 0) + (seasons.success ? seasons.data.periods.length : 0);
      return `${week}${count ? ` · ${count} special ${count === 1 ? "schedule" : "schedules"}` : ""}`;
    }
    case "overstay": return `${value("overrun.rate_source") === "fixed" ? value("overrun.fixed_fils_per_increment") === null ? "Choose a custom amount" : `AED ${Number(value("overrun.fixed_fils_per_increment")) / 100} per guest` : value("overrun.rate_source") === "offer_hourly" ? "Special offer rates" : "Regular rates"} · per started ${value("overrun.increment_minutes")} min`;
    case "pricing": return `${value("tax.vat_percent")}% VAT ${value("tax.inclusive") ? "included" : "added"} · ${value("fees.tabby.enabled") ? `Tabby fee ${value("fees.tabby.percent")}%` : "Tabby fee off"}`;
    case "urgency": return `${value("urgency.enabled") ? value("urgency.mode") === "general" ? "General message" : "Live availability notices" : "Available-time notices off"} · Fully booked label ${value("urgency.none_enabled") ? "on" : "off"}`;
    case "contact": return [value("contact.whatsapp_e164"), value("contact.email")].filter(Boolean).join(" · ") || "Add WhatsApp and email";
    case "invoices": return invoiceSummary(stored);
    default: return "";
  }
}

export function SettingsOverview({ stored, initialPanel }: { stored: Record<string, Json>; initialPanel?: string }) {
  const [search, setSearch] = useState("");
  const visible = SETTINGS_PANELS.filter((item) => settingsPanelMatches(item, search));
  const resolved = initialPanel ? SETTINGS_PANEL_LINKS[initialPanel] ?? initialPanel : undefined;
  const [editing, setEditing] = useState<string | null>(() => SETTINGS_PANELS.some((panel) => panel.id === resolved) ? resolved ?? null : null);
  const panel = SETTINGS_PANELS.find((item) => item.id === editing);
  return <>
    <div role="search" aria-label="Filter settings" className="flex min-w-0">
      <ConsoleSearchInput label="Search settings" placeholder="Search settings, hours, guests…" value={search} onChange={setSearch} />
    </div>
    {!visible.length && <div role="status"><ConsoleEmpty Icon={SearchXIcon} title="No settings found" description="Try hours, guests, payment or contact." /></div>}
    <div className="flex min-w-0 flex-col gap-6">
      {[...new Set(visible.map((item) => item.section))].map((section) => <DetailSection key={section} title={section} flush className="@container/settings-list">
        <ul className="divide-y divide-border border-t border-border">
          {visible.filter((item) => item.section === section).map((item) => {
            const Icon = ICONS[item.id] ?? Settings2Icon;
            return <li key={item.id}><Button type="button" variant="ghost" hoverEffect="simple" className="settings-row h-auto! min-h-20 w-full justify-start gap-4 rounded-none px-4 py-4! text-left whitespace-normal sm:px-5" onClick={() => setEditing(item.id)}>
              <span aria-hidden="true" className="settings-row-icon grid size-tap shrink-0 place-items-center rounded-(--radius-control) bg-brand-wash text-brand"><Icon className="size-5" /></span>
              <span className="grid min-w-0 flex-1 items-center gap-1 @2xl/settings-list:grid-cols-2 @2xl/settings-list:gap-6"><span className="text-console-body font-medium text-text-primary">{item.title}</span><span className="text-micro font-normal wrap-anywhere text-text-secondary">{summary(item, stored)}</span></span>
              <ChevronRightIcon aria-hidden="true" className="settings-row-chevron size-4 shrink-0 text-text-muted" />
            </Button></li>;
          })}
        </ul>
      </DetailSection>)}
    </div>
    {panel && <SettingsPanelEditor key={panel.id} panel={panel} stored={stored} search={search} onClose={() => setEditing(null)} />}
  </>;
}
