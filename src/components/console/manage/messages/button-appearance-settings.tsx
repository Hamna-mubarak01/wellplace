"use client";

import { useId } from "react";

import { AppearanceNumber, AppearanceColor } from "./appearance-fields";
import { ConsoleSwitch } from "@/components/shared/console-switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/select";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  MESSAGE_BUTTON_DEFAULTS,
  MESSAGE_BUTTON_LIMITS,
} from "@/lib/config/message-button";
import {
  BLOCK_ALIGNMENTS,
  type MessageButtonAppearance,
} from "@/lib/domain/email/document";
import { resolveMessageButtonAppearance } from "@/lib/validation/message-button";

export function ButtonAppearanceSettings({
  appearance,
  disabled = false,
  onChange,
}: {
  appearance?: MessageButtonAppearance;
  disabled?: boolean;
  onChange: (appearance: MessageButtonAppearance) => void;
}) {
  const id = useId();
  const draft = appearance ?? MESSAGE_BUTTON_DEFAULTS;
  const shown = resolveMessageButtonAppearance(draft);
  const change = (patch: Partial<MessageButtonAppearance>) =>
    onChange({ ...draft, ...patch });
  return (
    <div className="flex min-w-0 flex-col gap-4 border-t border-border pt-4">
      <div className="grid min-w-0 gap-3 @sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${id}-width`}>Width</FieldLabel>
          <Select
            value={draft.width}
            disabled={disabled}
            onValueChange={(width) =>
              change({ width: width as MessageButtonAppearance["width"] })
            }
          >
            <SelectTrigger id={`${id}-width`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto" className="min-h-tap">
                Auto (fit content)
              </SelectItem>
              <SelectItem value="full" className="min-h-tap">
                Full width
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-align`}>Alignment</FieldLabel>
          <Select
            value={draft.align}
            disabled={disabled}
            onValueChange={(align) =>
              change({ align: align as MessageButtonAppearance["align"] })
            }
          >
            <SelectTrigger id={`${id}-align`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BLOCK_ALIGNMENTS.map((align) => (
                <SelectItem key={align} value={align} className="min-h-tap">
                  {align === "center"
                    ? "Centred"
                    : align === "left"
                      ? "Left"
                      : "Right"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field>
        <div className="flex items-center justify-between gap-3">
          <FieldLabel htmlFor={`${id}-brand`}>
            Use shared button style
          </FieldLabel>
          <ConsoleSwitch
            id={`${id}-brand`}
            checked={draft.followBrand}
            disabled={disabled}
            onCheckedChange={(followBrand) => change({ followBrand })}
          />
        </div>
        <FieldDescription>
          Use WellPlace’s email colours and corners, or switch off to customise
          this button.
        </FieldDescription>
      </Field>
      <div className="grid min-w-0 gap-3 @sm:grid-cols-2">
        <AppearanceColor
          label="Background colour"
          value={shown.background}
          disabled={disabled || draft.followBrand}
          onChange={(background) => change({ background })}
        />
        <AppearanceColor
          label="Text colour"
          value={shown.textColor}
          disabled={disabled || draft.followBrand}
          onChange={(textColor) => change({ textColor })}
        />
      </div>
      <div className="grid min-w-0 gap-3 @sm:grid-cols-3">
        <AppearanceNumber
          label="Corner radius"
          value={shown.radius}
          bounds={MESSAGE_BUTTON_LIMITS.radius}
          disabled={disabled || draft.followBrand}
          onChange={(radius) => change({ radius })}
        />
        <AppearanceNumber
          label="Horizontal padding"
          value={draft.paddingX}
          bounds={MESSAGE_BUTTON_LIMITS.padding}
          disabled={disabled}
          onChange={(paddingX) => change({ paddingX })}
        />
        <AppearanceNumber
          label="Vertical padding"
          value={draft.paddingY}
          bounds={MESSAGE_BUTTON_LIMITS.padding}
          disabled={disabled}
          onChange={(paddingY) => change({ paddingY })}
        />
      </div>
    </div>
  );
}
