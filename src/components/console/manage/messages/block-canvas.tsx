"use client";

import type { EmailFooterDesign } from "@/lib/domain/email/footer";
import type { EmailHeaderDesign } from "@/lib/domain/email/header";
import { FooterCanvas } from "./footer-canvas";
import { HeaderPreview } from "./header-preview";
import type { ReactNode } from "react";
import { DEFAULT_FOOTER_DESIGN } from "@/lib/config/message-footer";
import { DEFAULT_HEADER_DESIGN } from "@/lib/config/message-header";

import { useMemo, useState } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/shared/button";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import {
  CanvasBlock,
  type DropEdge,
} from "@/components/console/manage/messages/canvas-block";
import { BlockPalette } from "@/components/console/manage/messages/block-palette";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  problemBlockId,
  variableLabels,
} from "@/components/console/manage/messages/message-document-model";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MESSAGE_EDITOR,
  type MessageVariable,
} from "@/lib/config/message-documents";
import {
  AUTHORED_BLOCK_KINDS,
  type AuthoredBlockKind,
} from "@/lib/domain/email/document";
import type {
  AuthoredBlock,
  DocumentProblem,
  LinkableNode,
} from "@/lib/domain/email/document";
import { cn } from "@/lib/utils";

export interface BlockCanvasProps {
  blocks: readonly AuthoredBlock[];
  subject: readonly LinkableNode[];
  preheader: readonly LinkableNode[];
  variables: readonly MessageVariable[];
  problems: readonly DocumentProblem[];
  selectedBlockId: string | null;
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
  onSelect: (blockId: string | null) => void;
  onDuplicate: (blockId: string) => void;
  onRemove: (blockId: string) => void;
  onMove: (blockId: string, target: number) => void;
  onAddFirst?: () => void;
  className?: string;
  branding?: boolean;
  headerDesign?: EmailHeaderDesign;
  onEditHeader?: () => void;
  footerLines?: readonly string[];
  footerDesign?: EmailFooterDesign;
  onEditFooter?: () => void;
  onCloseFooter?: () => void;
  footerEditing?: boolean;
  footerEditor?: ReactNode;
  onChange: (block: AuthoredBlock) => void;
  onAdd: (kind: AuthoredBlockKind, index: number) => void;
}

interface DragState {
  readonly id: string;
  readonly index: number;
  readonly edge: DropEdge;
}

export function BlockCanvas({
  blocks,
  variables,
  problems,
  selectedBlockId,
  loading = false,
  error = null,
  disabled = false,
  onSelect,
  onDuplicate,
  onRemove,
  onMove,
  onAddFirst,
  className,
  branding = true,
  headerDesign = DEFAULT_HEADER_DESIGN,
  onEditHeader,
  footerLines = [],
  footerDesign,
  onEditFooter,
  onCloseFooter,
  footerEditing = false,
  footerEditor,
  onChange,
  onAdd,
}: BlockCanvasProps) {
  const [inserting, setInserting] = useState<number | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<DragState | null>(null);
  const labels = useMemo(() => variableLabels(variables), [variables]);

  const byBlock = useMemo(() => {
    const grouped = new Map<string, DocumentProblem[]>();
    for (const problem of problems) {
      const id = problemBlockId(problem);
      if (id === null) continue;
      const current = grouped.get(id) ?? [];
      current.push(problem);
      grouped.set(id, current);
    }
    return grouped;
  }, [problems]);

  if (error !== null) {
    return (
      <ConsoleReadError
        title="This email could not be loaded"
        message={error}
        remedy="Reload the page. If it keeps happening, the wording is still saved."
      />
    );
  }

  const sheet = cn(
    "message-email-sheet mx-auto flex w-full flex-col border border-border bg-surface-raised shadow-(--shadow-sm)",
  );

  if (loading) {
    return (
      <div className={cn("@container min-w-0", className)} aria-busy="true">
        <div className={sheet}>
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-7 w-4/5" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-11/12" />
          <Skeleton className="h-console-panel w-full" />
          <Skeleton className="h-tap w-40" />
        </div>
      </div>
    );
  }

  function drop(state: DragState) {
    setOver(null);
    setDragging(null);
    if (dragging === null || dragging === state.id) return;
    onMove(dragging, state.edge === "before" ? state.index : state.index + 1);
  }

  return (
    <div className={cn("@container min-w-0", className)}>
      <div className={sheet}>
        {branding && (
          <section aria-label="Email header" data-header-block className="flex flex-col gap-3 border-b border-border px-6 py-6">
            {onEditHeader && (
              <div className="flex justify-end">
                <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onEditHeader}>
                  <PencilIcon aria-hidden="true" className="size-4" />
                  Edit header
                </Button>
              </div>
            )}
            <HeaderPreview design={headerDesign} />
          </section>
        )}

        {blocks.length === 0 ? (
          <div
            role="status"
            className="flex flex-col items-center gap-3 px-4 py-12 text-center"
            onDragOver={(event) => {
              if (
                !disabled &&
                event.dataTransfer.types.includes(MESSAGE_EDITOR.dragMime)
              )
                event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              const kind = event.dataTransfer.getData(
                MESSAGE_EDITOR.dragMime,
              ) as AuthoredBlockKind;
              if (!disabled && AUTHORED_BLOCK_KINDS.includes(kind))
                onAdd(kind, 0);
            }}
          >
            <p className="text-console-body font-medium text-text-primary">
              This email has nothing in it yet
            </p>
            <p className="max-w-measure text-console-body text-pretty text-text-secondary">
              Add a heading, a paragraph and a button from the palette, and they
              appear here in the order guests read them.
            </p>
            {onAddFirst !== undefined && (
              <Button type="button" disabled={disabled} onClick={onAddFirst}>
                <PlusIcon aria-hidden="true" className="size-4" />
                Add a paragraph
              </Button>
            )}
          </div>
        ) : (
          <ol className="flex min-w-0 flex-col px-3 py-6 sm:px-5">
            {blocks.map((block, index) => (
              <CanvasBlock
                key={block.id}
                block={block}
                position={index}
                total={blocks.length}
                labels={labels}
                variables={variables}
                onChange={onChange}
                problems={byBlock.get(block.id) ?? []}
                selected={selectedBlockId === block.id}
                dragging={dragging === block.id}
                dropEdge={over?.id === block.id ? over.edge : null}
                disabled={disabled}
                onSelect={() => onSelect(block.id)}
                onDuplicate={() => onDuplicate(block.id)}
                onRemove={() => onRemove(block.id)}
                onStep={(offset) =>
                  onMove(block.id, offset === -1 ? index - 1 : index + 2)
                }
                onDragStart={() => setDragging(block.id)}
                onDragEnd={() => {
                  setDragging(null);
                  setOver(null);
                }}
                onDragOver={(edge) => setOver({ id: block.id, index, edge })}
                onDrop={(kind) => {
                  if (kind) {
                    setOver(null);
                    onAdd(kind, over?.edge === "before" ? index : index + 1);
                  } else
                    drop({ id: block.id, index, edge: over?.edge ?? "after" });
                }}
                insertAfter={
                  <Popover
                    open={inserting === index + 1}
                    onOpenChange={(open) =>
                      setInserting(open ? index + 1 : null)
                    }
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={disabled}
                        aria-label={`Add a block after block ${index + 1}`}
                      >
                        <PlusIcon aria-hidden="true" className="size-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="max-h-96 w-editor-rail overflow-y-auto bg-surface-raised p-4">
                      <BlockPalette
                        blockCount={blocks.length}
                        onAdd={(kind) => {
                          onAdd(kind, index + 1);
                          setInserting(null);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                }
              />
            ))}
          </ol>
        )}
        {(branding || footerEditing) && (
          <FooterCanvas text={footerLines.join("\n")} design={footerDesign ?? DEFAULT_FOOTER_DESIGN}
            editing={footerEditing} disabled={disabled} onEdit={() => onEditFooter?.()} onClose={() => onCloseFooter?.()}>
            {footerEditor}
          </FooterCanvas>
        )}
      </div>
    </div>
  );
}
