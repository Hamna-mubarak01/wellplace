"use client";

import { useId } from "react";
import { RotateCcwIcon } from "lucide-react";
import { ConsoleIconAction } from "@/components/console/shared/console-icon-action";
import { AppearanceColor, AppearanceNumber } from "./appearance-fields";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/select";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  MESSAGE_TEXT_FONTS,
  MESSAGE_TEXT_LIMITS,
  messageTextDefaults,
  type StyledTextBlock,
} from "@/lib/config/message-text";
import {
  BLOCK_ALIGNMENTS,
  type MessageTextAppearance,
} from "@/lib/domain/email/document";

export function TextAppearanceSettings({
  block,
  disabled = false,
  onChange,
}: {
  block: StyledTextBlock;
  disabled?: boolean;
  onChange: (appearance: MessageTextAppearance | undefined) => void;
}) {
  const id = useId();
  const value = block.appearance ?? messageTextDefaults(block);
  const change = (patch: Partial<MessageTextAppearance>) =>
    onChange({ ...value, ...patch });
  return (
    <div className="flex min-w-0 flex-col gap-4 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-console-body font-medium">Typography</p>
        <ConsoleIconAction
          label="Reset text style"
          Icon={RotateCcwIcon}
          variant="ghost"
          disabled={disabled || !block.appearance}
          onClick={() => onChange(undefined)}
        />
      </div>
      <div className="grid min-w-0 gap-3 @sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${id}-font`}>Font</FieldLabel>
          <Select
            value={value.font}
            disabled={disabled}
            onValueChange={(font) =>
              change({ font: font as MessageTextAppearance["font"] })
            }
          >
            <SelectTrigger id={`${id}-font`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(MESSAGE_TEXT_FONTS).map(([key, font]) => (
                <SelectItem key={key} value={key} className="min-h-tap">
                  {font.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-align`}>Alignment</FieldLabel>
          <Select
            value={value.align}
            disabled={disabled}
            onValueChange={(align) =>
              change({ align: align as MessageTextAppearance["align"] })
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
        <AppearanceNumber
          label="Font size"
          value={value.fontSize}
          bounds={MESSAGE_TEXT_LIMITS.fontSize}
          disabled={disabled}
          onChange={(fontSize) =>
            change({
              fontSize,
              lineHeight: Math.max(fontSize, value.lineHeight),
            })
          }
        />
        <AppearanceNumber
          label="Line height"
          value={value.lineHeight}
          bounds={MESSAGE_TEXT_LIMITS.lineHeight}
          disabled={disabled}
          onChange={(lineHeight) => change({ lineHeight })}
        />
        <AppearanceColor
          label="Text colour"
          value={value.color}
          disabled={disabled}
          onChange={(color) => change({ color })}
        />
        <AppearanceColor
          label="Background colour"
          value={value.background}
          disabled={disabled}
          onChange={(background) => change({ background })}
        />
      </div>
    </div>
  );
}
