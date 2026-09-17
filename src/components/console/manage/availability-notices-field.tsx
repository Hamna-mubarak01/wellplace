"use client";

import { SETTING_TEXT_LIMITS } from "@/lib/config/setting-limits";

import { SettingsSection } from "@/components/console/manage/settings-section";
import { SETTINGS, type SettingKey } from "@/lib/config/registry";
import { SettingsPanelField } from "@/components/console/manage/settings-panel-field";
import { ConsoleSwitch } from "@/components/shared/console-switch";
import { InfoHint } from "@/components/shared/info-hint";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shared/select";
import { Input } from "@/components/ui/input";
import { SETTING_HELP } from "@/lib/config/setting-help";
import type { Json } from "@/types/database.generated";

export function AvailabilityNoticesField({ values, disabled, onChange }: {
  values: Record<string, Json>; disabled: boolean; onChange: (key: SettingKey, value: Json) => void;
}) {
  const value = (key: SettingKey) => values[key] ?? SETTINGS[key].defaultValue;
  const live = value("urgency.mode") === "live";
  const enabled = value("urgency.enabled") === true;
  const field = (key: SettingKey, inactive = false) => <SettingsPanelField key={key} settingKey={key} value={values[key] ?? null} disabled={disabled || inactive} onChange={(next) => onChange(key, next)} />;
  return <>
    <SettingsSection><div className="flex flex-col gap-2"><div className="flex items-center justify-between"><span className="text-console-body font-medium">Available times</span><InfoHint label="Notice display">Live notices use actual availability. A general message appears on available times without claiming that places are running out.</InfoHint></div><Select value={!enabled ? "off" : live ? "live" : "general"} disabled={disabled} onValueChange={(mode) => { onChange("urgency.enabled", mode !== "off"); if (mode !== "off") onChange("urgency.mode", mode); }}><SelectTrigger aria-label="Notice display" className="min-h-tap w-full"><SelectValue /></SelectTrigger><SelectContent className="settings-popup"><SelectItem className="min-h-tap" value="live">Live availability</SelectItem><SelectItem className="min-h-tap" value="general">General message</SelectItem><SelectItem className="min-h-tap" value="off">No message</SelectItem></SelectContent></Select></div></SettingsSection>
    {enabled && !live && <div className="rounded-(--radius-card) border border-border bg-surface-raised p-4">{field("urgency.text_general")}<p className="mt-3 text-micro text-text-secondary">Shown on available times. Use a welcome or booking instruction, rather than a claim about limited places.</p></div>}
    {([
      { title: "Few slots left", toggle: "urgency.few_enabled", text: "urgency.text_few", threshold: "urgency.threshold_few" },
      { title: "Last availability", toggle: "urgency.last_enabled", text: "urgency.text_last", threshold: "urgency.threshold_last" },
      { title: "Fully booked", toggle: "urgency.none_enabled", text: "urgency.text_none", threshold: null },
    ] as const).filter((notice) => !notice.threshold || (enabled && live)).map((notice) => <SettingsSection key={notice.toggle}>
      <div className="flex min-h-tap items-center justify-between gap-3"><div className="flex items-center gap-1"><label htmlFor={notice.toggle} className="text-console-body font-medium">{notice.title}</label><InfoHint label={notice.title}>{SETTING_HELP[notice.text]}</InfoHint></div><ConsoleSwitch id={notice.toggle} aria-label={`${notice.title} notice`} checked={value(notice.toggle) === true} disabled={disabled} onCheckedChange={(on) => onChange(notice.toggle, on)} /></div>
      {value(notice.toggle) === true && <div className="flex flex-col gap-3 border-t border-border pt-4"><Input maxLength={SETTING_TEXT_LIMITS[notice.text]} aria-label={`${notice.title} message`} value={String(value(notice.text))} disabled={disabled} onChange={(event) => onChange(notice.text, event.target.value)} />{notice.threshold && field(notice.threshold)}</div>}
    </SettingsSection>)}
  </>;
}
