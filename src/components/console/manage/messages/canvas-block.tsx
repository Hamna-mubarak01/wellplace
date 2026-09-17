"use client";

import { useState, type ReactNode, type DragEvent } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  GripVerticalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

import { ConsoleIconAction } from "@/components/console/shared/console-icon-action";
import { DocumentProblems } from "@/components/console/manage/messages/document-problems";
import { InlineView } from "@/components/console/manage/messages/inline-view";
import { blockLabel } from "@/components/console/manage/messages/message-document-model";
import { BlockSettings } from "@/components/console/manage/messages/block-settings";
import { messageTextStyle } from "@/lib/messaging/text-appearance";
import { resolveMessageButtonAppearance } from "@/lib/validation/message-button";
import { sanitizeEmailHtml } from "@/lib/validation/email-html";
import {
  MESSAGE_EDITOR,
  type MessageVariable,
} from "@/lib/config/message-documents";
import {
  IMAGE_WIDTH,
  AUTHORED_BLOCK_KINDS,
  type AuthoredBlockKind,
} from "@/lib/domain/email/document";
import { Separator } from "@/components/ui/separator";
import type {
  AuthoredBlock,
  BlockAlign,
  DocumentProblem,
  TextSize,
} from "@/lib/domain/email/document";
import { cn } from "@/lib/utils";

export type DropEdge = "before" | "after";

export interface CanvasBlockProps {
  block: AuthoredBlock;
  position: number;
  total: number;
  labels: ReadonlyMap<string, string>;
  problems: readonly DocumentProblem[];
  selected: boolean;
  dragging: boolean;
  dropEdge: DropEdge | null;
  disabled?: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onStep: (offset: -1 | 1) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (edge: DropEdge) => void;
  onDrop: (kind?: AuthoredBlockKind) => void;
  variables: readonly MessageVariable[];
  onChange: (block: AuthoredBlock) => void;
  insertAfter: ReactNode;
}

const ALIGN_CLASS: Readonly<Record<BlockAlign, string>> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const SIZE_CLASS: Readonly<Record<TextSize, string>> = {
  small: "text-small",
  normal: "text-body",
  large: "text-lead",
};

function body(
  block: AuthoredBlock,
  labels: ReadonlyMap<string, string>,
  selected: boolean,
) {
  switch (block.kind) {
    case "html":
      return (
        <div className="overflow-hidden">
          <iframe
            title="Custom HTML block"
            sandbox=""
            srcDoc={sanitizeEmailHtml(block.markup)}
            className="h-console-panel w-full border-0 bg-surface-raised"
            style={{ pointerEvents: "none" }}
          />
        </div>
      );
    case "columns":
      return (
        <div
          className={cn(
            "grid gap-4",
            block.columns.length === 3 ? "@sm:grid-cols-3" : "@sm:grid-cols-2",
          )}
        >
          {block.columns.map((content, index) => (
            <div key={index} className="min-w-0 text-body text-text-primary">
              <InlineView
                nodes={content}
                labels={labels}
                placeholder={`Column ${index + 1}`}
              />
            </div>
          ))}
        </div>
      );
    case "band":
      return (
        <div className="rounded-(--radius-control) bg-brand-wash p-5 text-body text-text-primary">
          <InlineView
            nodes={block.content}
            labels={labels}
            placeholder="Your highlighted message"
          />
        </div>
      );
    case "quote":
      return (
        <blockquote className="border-l-4 border-brand px-5 py-3 font-display text-lead italic text-text-primary">
          <InlineView
            nodes={block.content}
            labels={labels}
            placeholder="Add a quotation"
          />
        </blockquote>
      );
    case "hero":
      return (
        <div className="overflow-hidden rounded-(--radius-control) bg-surface-base">
          {body(
            {
              kind: "image",
              id: block.id,
              src: block.src,
              alt: block.alt,
              width: IMAGE_WIDTH.fallback,
            },
            labels,
            selected,
          )}
          <div className="p-5 text-lead">
            <InlineView
              nodes={block.content}
              labels={labels}
              placeholder="Introduce your message"
            />
          </div>
        </div>
      );
    case "video":
      return (
        <div className="space-y-3">
          {body(
            {
              kind: "image",
              id: block.id,
              src: block.src,
              alt: block.alt,
              width: IMAGE_WIDTH.fallback,
            },
            labels,
            selected,
          )}
          <p className="text-center text-body text-brand">
            ▶{" "}
            <InlineView
              nodes={block.label}
              labels={labels}
              placeholder="Watch video"
            />
          </p>
        </div>
      );
    case "file":
      return (
        <span className="text-body text-brand underline">
          <InlineView
            nodes={block.label}
            labels={labels}
            placeholder="Download file"
          />
        </span>
      );

    case "eyebrow":
      return (
        <p
          style={messageTextStyle(block.appearance)}
          className="text-label font-medium tracking-label text-brand uppercase"
        >
          <InlineView
            nodes={block.content}
            labels={labels}
            placeholder="Short label"
          />
        </p>
      );

    case "heading":
      return (
        <p
          style={messageTextStyle(block.appearance)}
          className="font-display text-h3 font-bold text-pretty text-text-primary"
        >
          <InlineView
            nodes={block.content}
            labels={labels}
            placeholder="Heading"
          />
        </p>
      );

    case "lead":
      return (
        <p
          style={messageTextStyle(block.appearance)}
          className="text-lead text-pretty text-text-secondary"
        >
          <InlineView
            nodes={block.content}
            labels={labels}
            placeholder="Opening sentence"
          />
        </p>
      );

    case "text":
      return (
        <p
          style={messageTextStyle(block.appearance)}
          className={cn(
            "text-pretty text-text-primary",
            ALIGN_CLASS[block.align],
            SIZE_CLASS[block.size],
          )}
        >
          <InlineView
            nodes={block.content}
            labels={labels}
            placeholder="Paragraph"
          />
        </p>
      );

    case "note":
      return (
        <p
          style={messageTextStyle(block.appearance)}
          className="text-small text-text-muted"
        >
          <InlineView
            nodes={block.content}
            labels={labels}
            placeholder="Small print"
          />
        </p>
      );

    case "panel":
      return (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-(--radius-control) border border-border bg-surface-base p-4 @sm:grid-cols-[auto_1fr]">
          {block.rows.map((row, index) => (
            <div key={index} className="contents">
              <dt className="text-small text-text-muted">
                <InlineView
                  nodes={row.label}
                  labels={labels}
                  placeholder="Label"
                />
              </dt>
              <dd className="text-small font-medium text-text-primary @sm:text-right">
                <InlineView
                  nodes={row.value}
                  labels={labels}
                  placeholder="Value"
                />
              </dd>
            </div>
          ))}
        </dl>
      );

    case "button": {
      const appearance = resolveMessageButtonAppearance(block.appearance);
      return (
        <div style={{ textAlign: appearance.align }}>
          <span
            className="inline-block max-w-full text-body font-semibold wrap-anywhere"
            style={{
              backgroundColor: appearance.background,
              color: appearance.textColor,
              borderRadius: appearance.radius,
              padding: `${appearance.paddingY}px ${appearance.paddingX}px`,
              width: appearance.width === "full" ? "100%" : undefined,
              textAlign: "center",
            }}
          >
            <InlineView
              nodes={block.label}
              labels={labels}
              placeholder="Button words"
            />
          </span>
        </div>
      );
    }

    case "links":
      return (
        <div className="flex flex-col gap-1">
          <p className="text-label font-medium tracking-label text-text-muted uppercase">
            <InlineView
              nodes={block.label}
              labels={labels}
              placeholder="Links"
            />
          </p>
          <ul className="flex flex-col gap-1">
            {block.items.map((item, index) => (
              <li
                key={index}
                className="text-small text-brand underline underline-offset-2"
              >
                <InlineView
                  nodes={item.label}
                  labels={labels}
                  placeholder="Link words"
                />
              </li>
            ))}
          </ul>
        </div>
      );

    case "divider":
      return <Separator className="bg-border" />;

    case "spacer":
      return (
        <div
          style={{ height: `${block.height}px` }}
          className={cn(
            "w-full rounded-(--radius-inner)",
            selected && "border border-dashed border-border-strong",
          )}
        />
      );

    case "image":
      return (
        <figure
          className="mx-auto flex w-full flex-col gap-2"
          style={{ maxWidth: block.width }}
        >
          <div className="relative aspect-video w-full overflow-hidden rounded-(--radius-control) border border-border bg-surface-base">
            {block.src.trim().length > 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={block.src}
                alt={block.alt}
                width={block.width}
                height={block.width}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="size-full object-cover"
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center px-4 text-center text-small text-text-muted">
                Add the picture&rsquo;s address
              </span>
            )}
          </div>
          {block.alt.trim().length > 0 && (
            <figcaption className="text-micro text-text-muted">
              {block.alt}
            </figcaption>
          )}
        </figure>
      );
  }
}

export function CanvasBlock({
  block,
  position,
  total,
  labels,
  problems,
  selected,
  dragging,
  dropEdge,
  disabled = false,
  onSelect,
  onDuplicate,
  onRemove,
  onStep,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  variables,
  onChange,
  insertAfter,
}: CanvasBlockProps) {
  const [armed, setArmed] = useState(false);
  const label = blockLabel(block);
  const name = `${label}, block ${position + 1} of ${total}`;

  function edgeFrom(event: DragEvent<HTMLLIElement>): DropEdge {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
  }

  return (
    <li
      data-selected={selected || undefined}
      data-block-id={block.id}
      draggable={armed && !disabled}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", block.id);
        onDragStart();
      }}
      onDragEnd={() => {
        setArmed(false);
        onDragEnd();
      }}
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDragOver(edgeFrom(event));
      }}
      onDrop={(event) => {
        event.preventDefault();
        const kind = event.dataTransfer.getData(
          MESSAGE_EDITOR.dragMime,
        ) as AuthoredBlockKind;
        if (!disabled)
          onDrop(AUTHORED_BLOCK_KINDS.includes(kind) ? kind : undefined);
      }}
      className={cn(
        "group/block relative border border-transparent px-4 py-4 motion-reduce:transition-none",
        !disabled && "cursor-pointer hover:border-border",
        selected && "border-brand",
        dragging && "opacity-60",
      )}
    >
      {dropEdge !== null && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-2 h-0.5 rounded-full bg-brand",
            dropEdge === "before" ? "-top-px" : "-bottom-px",
          )}
        />
      )}

      <div
        className={cn(
          "absolute -top-6 right-0 z-10 flex max-w-full items-center rounded-(--radius-control) border border-border bg-surface-raised opacity-0 shadow-(--shadow-sm) group-hover/block:opacity-100 group-focus-within/block:opacity-100",
          selected && "opacity-100",
        )}
      >
        <ConsoleIconAction
          label={`Reorder ${label} by dragging`}
          Icon={GripVerticalIcon}
          variant="ghost"
          disabled={disabled}
          onPointerDown={() => setArmed(true)}
          onPointerUp={() => setArmed(false)}
          className="cursor-grab"
        />
        <ConsoleIconAction
          label={`Move ${label} up`}
          Icon={ChevronUpIcon}
          variant="ghost"
          disabled={disabled || position === 0}
          onClick={(event) => {
            event.stopPropagation();
            onStep(-1);
          }}
        />
        <ConsoleIconAction
          label={`Move ${label} down`}
          Icon={ChevronDownIcon}
          variant="ghost"
          disabled={disabled || position === total - 1}
          onClick={(event) => {
            event.stopPropagation();
            onStep(1);
          }}
        />
        <ConsoleIconAction
          label={`Edit ${name}`}
          Icon={PencilIcon}
          variant="ghost"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
        />
        <ConsoleIconAction
          label={`Duplicate ${label}`}
          Icon={CopyIcon}
          variant="ghost"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onDuplicate();
          }}
        />
        <ConsoleIconAction
          label={`Delete ${label}`}
          Icon={Trash2Icon}
          variant="ghost"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        />
      </div>

      {selected ? (
        <div className="flex min-w-0 flex-col gap-5">
          <div
            className="rounded-(--radius-control) border border-border bg-surface-base p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <BlockSettings
              key={block.id}
              block={block}
              variables={variables}
              problems={[]}
              disabled={disabled}
              onChange={onChange}
              onRemove={onRemove}
            />
          </div>
          <div aria-label="Selected block preview">
            {body(block, labels, selected)}
          </div>
        </div>
      ) : (
        body(block, labels, selected)
      )}
      <div
        className={cn(
          "absolute inset-x-0 -bottom-6 z-10 flex justify-center opacity-0 group-hover/block:opacity-100 group-focus-within/block:opacity-100",
          selected && "opacity-100",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {insertAfter}
      </div>

      <DocumentProblems
        problems={problems}
        labelFor={() => label}
        variant="inline"
        className="mt-3"
      />
    </li>
  );
}
