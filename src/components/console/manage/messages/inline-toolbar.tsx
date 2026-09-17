"use client";

import {
  BoldIcon,
  ItalicIcon,
  Link2Icon,
  Link2OffIcon,
  UnderlineIcon,
} from "lucide-react";

import { Button } from "@/components/shared/button";

export type InlineMark = "bold" | "italic" | "underline";

export interface InlineMarkState {
  readonly bold: boolean;
  readonly italic: boolean;
  readonly underline: boolean;
}

export interface InlineToolbarProps {
  marks: InlineMarkState;
  allowLinks: boolean;
  insideLink: boolean;
  hasSelection: boolean;
  disabled?: boolean;
  onToggleMark: (mark: InlineMark) => void;
  onAddLink: () => void;
  onRemoveLink: () => void;
}

const MARK_BUTTONS: readonly {
  mark: InlineMark;
  label: string;
  Icon: typeof BoldIcon;
}[] = [
  { mark: "bold", label: "Bold", Icon: BoldIcon },
  { mark: "italic", label: "Italic", Icon: ItalicIcon },
  { mark: "underline", label: "Underline", Icon: UnderlineIcon },
];

export function InlineToolbar({
  marks,
  allowLinks,
  insideLink,
  hasSelection,
  disabled = false,
  onToggleMark,
  onAddLink,
  onRemoveLink,
}: InlineToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      onMouseDown={(event) => event.preventDefault()}
      className="flex flex-wrap items-center gap-1"
    >
      {MARK_BUTTONS.map(({ mark, label, Icon }) => (
        <Button
          key={mark}
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={marks[mark]}
          disabled={disabled}
          onClick={() => onToggleMark(mark)}
        >
          <Icon aria-hidden="true" className="size-4" />
        </Button>
      ))}

      {allowLinks && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Add a link"
            disabled={disabled || (!hasSelection && !insideLink)}
            onClick={onAddLink}
          >
            <Link2Icon aria-hidden="true" className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove the link"
            disabled={disabled || !insideLink}
            onClick={onRemoveLink}
          >
            <Link2OffIcon aria-hidden="true" className="size-4" />
          </Button>
        </>
      )}
    </div>
  );
}
