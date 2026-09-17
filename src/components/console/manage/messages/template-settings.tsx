"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/shared/button";
import { ConsoleSwitch } from "@/components/shared/console-switch";
import { InfoHint } from "@/components/shared/info-hint";
import {
  InlineEditor,
  type VariableInserter,
} from "@/components/console/manage/messages/inline-editor";
import { VariablePicker } from "@/components/console/manage/messages/variable-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { describeTiming } from "@/components/console/manage/message-template-model";
import type { MessageTimeUnit } from "@/lib/config/message-templates";
import {
  MESSAGE_DOCUMENT_LIMITS,
  type SystemMessageSpec,
} from "@/lib/config/message-documents";
import type { LinkableNode } from "@/lib/domain/email/document";
import {
  parseTemplateTiming,
  timingDraft,
  type TimingDirection,
} from "@/lib/validation/message-template";
import { cn } from "@/lib/utils";

export type MessageChannel = "email" | "whatsapp";

export interface TemplateSettingsValue {
  readonly channel: MessageChannel;
  readonly isActive: boolean;
  readonly timingMinutes: number | null;
}

export interface TemplateSettingsProps {
  spec: SystemMessageSpec;
  name: string;
  onNameChange: (name: string) => void;
  branding: boolean;
  onBrandingChange: (branding: boolean) => void;
  subject: readonly LinkableNode[];
  preheader: readonly LinkableNode[];
  whatsapp?: readonly LinkableNode[];
  onWhatsappChange?: (nodes: readonly LinkableNode[]) => void;
  settings: TemplateSettingsValue;
  disabled?: boolean;
  onSubjectChange: (nodes: readonly LinkableNode[]) => void;
  onPreheaderChange: (nodes: readonly LinkableNode[]) => void;
  onSettingsChange: (settings: TemplateSettingsValue) => void;
  onValidityChange?: (valid: boolean) => void;
  className?: string;
}

const UNITS: readonly MessageTimeUnit[] = ["minutes", "hours", "days"];

export function TemplateSettings({
  spec,
  name,
  onNameChange,
  branding,
  onBrandingChange,
  subject,
  preheader,
  whatsapp = [],
  onWhatsappChange,
  settings,
  disabled = false,
  onSubjectChange,
  onPreheaderChange,
  onSettingsChange,
  onValidityChange,
  className,
}: TemplateSettingsProps) {
  const whatsappInsert = useRef<VariableInserter | null>(null);
  const subjectInsert = useRef<VariableInserter | null>(null);
  const preheaderInsert = useRef<VariableInserter | null>(null);
  const [timing, setTiming] = useState({
    key: spec.key,
    committed: settings.timingMinutes,
    ...timingDraft(settings.timingMinutes),
  });

  if (timing.key !== spec.key || timing.committed !== settings.timingMinutes) {
    setTiming({
      key: spec.key,
      committed: settings.timingMinutes,
      ...timingDraft(settings.timingMinutes),
    });
  }

  const parsed = parseTemplateTiming(
    timing.direction,
    timing.amount,
    timing.unit,
  );

  useEffect(() => {
    onValidityChange?.(parsed.ok);
  }, [parsed.ok, onValidityChange]);

  function commitTiming(next: {
    direction: TimingDirection;
    amount: string;
    unit: MessageTimeUnit;
  }) {
    const result = parseTemplateTiming(next.direction, next.amount, next.unit);
    setTiming({
      key: spec.key,
      committed: result.ok ? result.minutes : settings.timingMinutes,
      ...next,
    });
    if (result.ok)
      onSettingsChange({ ...settings, timingMinutes: result.minutes });
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <Field>
        <FieldLabel htmlFor="template-name">Template name</FieldLabel>
        <Input
          id="template-name"
          value={name}
          maxLength={MESSAGE_DOCUMENT_LIMITS.templateNameMax}
          onChange={(event) => onNameChange(event.target.value)}
          disabled={disabled}
        />
      </Field>

      <Field>
        <div className="flex min-h-tap items-center justify-between gap-2">
          <FieldLabel id="template-subject-label">Subject line</FieldLabel>
          <VariablePicker
            variables={spec.variables}
            disabled={disabled}
            ariaLabel="Insert variable in subject line"
            onOpen={() => {
              if (!subjectInsert.current) document.getElementById("template-subject")?.focus();
            }}
            onInsert={(name) => subjectInsert.current?.(name)}
          />
        </div>
        <InlineEditor
          linkable
          id="template-subject"
          ariaLabel="Subject line"
          labelledBy="template-subject-label"
          value={subject}
          variables={spec.variables}
          allowMarks={false}
          disabled={disabled}
          placeholder="What the guest reads in their inbox"
          onActivate={(insert) => {
            subjectInsert.current = insert;
          }}
          onChange={onSubjectChange}
        />
      </Field>

      <Field>
        <div className="flex min-h-tap items-center justify-between gap-2">
          <FieldLabel id="template-preheader-label">Preview line</FieldLabel>
          <VariablePicker
            variables={spec.variables}
            disabled={disabled}
            ariaLabel="Insert variable in preview line"
            onOpen={() => {
              if (!preheaderInsert.current) document.getElementById("template-preheader")?.focus();
            }}
            onInsert={(name) => preheaderInsert.current?.(name)}
          />
        </div>
        <InlineEditor
          linkable
          id="template-preheader"
          ariaLabel="Preview line"
          labelledBy="template-preheader-label"
          value={preheader}
          variables={spec.variables}
          allowMarks={false}
          disabled={disabled}
          placeholder="The line inboxes show after the subject"
          onActivate={(insert) => {
            preheaderInsert.current = insert;
          }}
          onChange={onPreheaderChange}
        />
      </Field>

      {onWhatsappChange && <Field>
        <div className="flex min-h-tap items-center justify-between gap-2">
          <FieldLabel id="template-whatsapp-label">WhatsApp wording</FieldLabel>
          <VariablePicker variables={spec.variables} disabled={disabled}
            ariaLabel="Insert variable in WhatsApp wording"
            onOpen={() => { if (!whatsappInsert.current) document.getElementById("template-whatsapp")?.focus(); }}
            onInsert={(name) => whatsappInsert.current?.(name)} />
        </div>
        <InlineEditor linkable multiline id="template-whatsapp" ariaLabel="WhatsApp wording"
          labelledBy="template-whatsapp-label" value={whatsapp} variables={spec.variables}
          allowMarks={false} disabled={disabled} placeholder="Write the WhatsApp version of this message"
          onActivate={(insert) => { whatsappInsert.current = insert; }} onChange={onWhatsappChange} />
        <FieldDescription>Saved and published with this template. Automated WhatsApp delivery is not connected yet.</FieldDescription>
      </Field>}

      <Field orientation="horizontal" className="items-center">
        <ConsoleSwitch
          id="template-branding"
          checked={branding}
          onCheckedChange={onBrandingChange}
          disabled={disabled}
        />
        <div>
          <FieldLabel htmlFor="template-branding">
            Show header & footer
          </FieldLabel>
          <FieldDescription>
            WellPlace branding and your email footer.
          </FieldDescription>
        </div>
      </Field>
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            Delivery settings
            <ChevronDownIcon aria-hidden="true" className="size-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent
          forceMount
          className="space-y-4 pt-3 data-[state=closed]:hidden"
        >
          <Field>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor="template-channel">Send by</FieldLabel>
              <InfoHint label="Delivery method">
                One delivery method is saved at a time. WhatsApp delivery also
                needs an approved Business setup.
              </InfoHint>
            </div>
            <Select
              value={settings.channel}
              disabled={disabled}
              onValueChange={(value) =>
                onSettingsChange({
                  ...settings,
                  channel: value === "whatsapp" ? "whatsapp" : "email",
                })
              }
            >
              <SelectTrigger id="template-channel" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email" className="min-h-tap">
                  Email
                </SelectItem>
                <SelectItem value="whatsapp" disabled className="min-h-tap">
                  WhatsApp (not connected)
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field
            orientation="horizontal"
            className="items-center rounded-(--radius-control) border border-border bg-surface-base p-3"
          >
            <div className="min-w-0 flex-1">
              <FieldLabel htmlFor="template-active">
                {settings.isActive ? "Enabled" : "Paused"}
              </FieldLabel>
              <FieldDescription>
                {settings.isActive
                  ? spec.connected
                    ? "This message can be sent automatically."
                    : "Delivery is not connected yet."
                  : "The wording stays saved and nothing is sent."}
              </FieldDescription>
            </div>
            <ConsoleSwitch
              id="template-active"
              checked={settings.isActive}
              disabled={disabled}
              onCheckedChange={(isActive) =>
                onSettingsChange({ ...settings, isActive })
              }
            />
          </Field>

          <Field data-invalid={!parsed.ok || undefined}>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor="template-direction">
                When it is sent
              </FieldLabel>
              <InfoHint label="When it is sent">
                Choose At the moment for no delay, Before to prepare the guest,
                or After for a follow-up. The moment it counts from is named
                below.
              </InfoHint>
            </div>
            <p className="text-micro text-text-secondary">{spec.trigger}</p>
            <Select
              value={timing.direction}
              disabled={disabled}
              onValueChange={(value) =>
                commitTiming({ ...timing, direction: value as TimingDirection })
              }
            >
              <SelectTrigger id="template-direction" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="at" className="min-h-tap">
                  At the moment it happens
                </SelectItem>
                <SelectItem value="before" className="min-h-tap">
                  Before
                </SelectItem>
                <SelectItem value="after" className="min-h-tap">
                  After
                </SelectItem>
              </SelectContent>
            </Select>

            {timing.direction !== "at" && (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  aria-label="How long"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  disabled={disabled}
                  value={timing.amount}
                  placeholder="How long"
                  onChange={(event) =>
                    commitTiming({ ...timing, amount: event.target.value })
                  }
                />
                <Select
                  value={timing.unit}
                  disabled={disabled}
                  onValueChange={(value) =>
                    commitTiming({ ...timing, unit: value as MessageTimeUnit })
                  }
                >
                  <SelectTrigger
                    aria-label="Minutes, hours or days"
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit} className="min-h-tap">
                        {unit[0].toUpperCase() + unit.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {parsed.ok ? (
              <FieldDescription>
                {describeTiming(parsed.minutes)}
              </FieldDescription>
            ) : (
              <FieldError>{parsed.message}</FieldError>
            )}
          </Field>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
