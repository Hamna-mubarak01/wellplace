"use client";

import { useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/shared/button";
import {
  BLOCK_META,
  PALETTE_GROUPS,
} from "@/components/console/manage/messages/message-document-model";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MESSAGE_DOCUMENT_LIMITS,
  MESSAGE_EDITOR,
} from "@/lib/config/message-documents";
import type { AuthoredBlockKind } from "@/lib/domain/email/document";
import { cn } from "@/lib/utils";

export interface BlockPaletteProps {
  blockCount: number;
  onAdd: (kind: AuthoredBlockKind) => void;
  disabled?: boolean;
  className?: string;
}

export function BlockPalette({
  blockCount,
  onAdd,
  disabled = false,
  className,
}: BlockPaletteProps) {
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();
  const groups = PALETTE_GROUPS.map((group) => ({
    ...group,
    kinds: group.kinds.filter((kind) =>
      `${BLOCK_META[kind].label} ${BLOCK_META[kind].hint}`
        .toLowerCase()
        .includes(needle),
    ),
  })).filter((group) => group.kinds.length > 0);
  const full = blockCount >= MESSAGE_DOCUMENT_LIMITS.blocksMax;

  return (
    <div className={cn("flex min-w-0 flex-col gap-4", className)}>
      <div className="relative">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
        />
        <Input
          aria-label="Search blocks"
          placeholder="Find a block…"
          value={search}
          className="min-h-tap pr-10 pl-9"
          onChange={(event) => setSearch(event.target.value)}
        />
        {search && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Clear block search"
            className="absolute top-1/2 right-1 -translate-y-1/2"
            onClick={() => setSearch("")}
          >
            <XIcon aria-hidden="true" className="size-4" />
          </Button>
        )}
      </div>
      {groups.length === 0 && (
        <p role="status" className="text-console-body text-text-muted">
          No blocks match “{search}”. Try text, image or columns.
        </p>
      )}
      {groups.map((group) => (
        <div key={group.group} className="flex min-w-0 flex-col gap-2">
          <p className="text-console-label font-medium tracking-label text-text-muted uppercase">
            {group.label}
          </p>

          <div className="grid grid-cols-2 gap-2">
            {group.kinds.map((kind) => {
              const meta = BLOCK_META[kind];
              return (
                <Tooltip key={kind}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="tile"
                      disabled={disabled || full}
                      onClick={() => onAdd(kind)}
                      draggable={!disabled && !full}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "copy";
                        event.dataTransfer.setData(
                          MESSAGE_EDITOR.dragMime,
                          kind,
                        );
                      }}
                      className="w-full justify-center gap-2"
                    >
                      <meta.Icon
                        aria-hidden="true"
                        className="size-4 shrink-0"
                      />
                      <span className="truncate">{meta.label}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{meta.hint}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      ))}

      <p className="text-center text-micro text-text-muted">
        Click to insert, or drag a block into the email.
      </p>
      {full && (
        <p className="text-console-body text-text-secondary">
          This email has reached {MESSAGE_DOCUMENT_LIMITS.blocksMax} blocks.
          Remove one before adding another.
        </p>
      )}
    </div>
  );
}
