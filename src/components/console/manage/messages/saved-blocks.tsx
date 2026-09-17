"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { BookmarkPlusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/shared/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { authoredBlockSchema } from "@/lib/validation/message-document";
import { MESSAGE_EDITOR } from "@/lib/config/message-documents";
import {
  documentVariables,
  type AuthoredBlock,
} from "@/lib/domain/email/document";
import {
  blockLabel,
  newBlockId,
} from "@/components/console/manage/messages/message-document-model";

const schema = z
  .array(
    z.object({
      id: z.string(),
      name: z.string().max(MESSAGE_EDITOR.savedBlockNameMax),
      block: authoredBlockSchema,
    }),
  )
  .max(MESSAGE_EDITOR.savedBlocksMax);
const eventName = "wellplace-saved-blocks-changed";
function subscribe(update: () => void) {
  window.addEventListener("storage", update);
  window.addEventListener(eventName, update);
  return () => {
    window.removeEventListener("storage", update);
    window.removeEventListener(eventName, update);
  };
}
function snapshot() {
  try {
    return localStorage.getItem(MESSAGE_EDITOR.savedBlocksStorageKey) ?? "[]";
  } catch {
    return "[]";
  }
}

export function SavedBlocks({
  selected,
  variables,
  disabled,
  onInsert,
}: {
  selected: AuthoredBlock | null;
  variables: readonly string[];
  disabled: boolean;
  onInsert: (block: AuthoredBlock) => void;
}) {
  const stored = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const modules = useMemo(() => {
    try {
      const parsed = schema.safeParse(JSON.parse(stored));
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  }, [stored]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  function write(
    next: readonly { id: string; name: string; block: AuthoredBlock }[],
  ) {
    try {
      localStorage.setItem(
        MESSAGE_EDITOR.savedBlocksStorageKey,
        JSON.stringify(next),
      );
      window.dispatchEvent(new Event(eventName));
      setError(null);
    } catch {
      setError(
        "This browser could not save the block. Check that browser storage is available.",
      );
    }
  }
  return (
    <div className="space-y-3">
      <p className="text-micro text-text-muted">
        Reuse your favourite blocks. Saved in this browser.
      </p>
      {selected && (
        <Field>
          <FieldLabel htmlFor="saved-block-name">
            Save selected block
          </FieldLabel>
          <Input
            id="saved-block-name"
            placeholder={blockLabel(selected)}
            value={name}
            maxLength={MESSAGE_EDITOR.savedBlockNameMax}
            disabled={disabled}
            onChange={(event) => setName(event.target.value)}
          />
          <Button
            variant="outline"
            disabled={
              disabled || modules.length >= MESSAGE_EDITOR.savedBlocksMax
            }
            onClick={() => {
              write([
                ...modules,
                {
                  id: newBlockId(selected.kind),
                  name: name.trim() || blockLabel(selected),
                  block: selected,
                },
              ]);
              setName("");
            }}
          >
            <BookmarkPlusIcon aria-hidden="true" className="size-4" />
            Save block
          </Button>
        </Field>
      )}
      {modules.map((module) => {
        const block = module.block as AuthoredBlock;
        const compatible = documentVariables({
          subject: [],
          preheader: [],
          blocks: [block],
        }).every((name) => variables.includes(name));
        return (
          <div
            key={module.id}
            className="rounded-(--radius-control) border border-border p-2"
          >
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                className="min-w-0 flex-1 justify-start"
                disabled={disabled || !compatible}
                onClick={() =>
                  onInsert({ ...block, id: newBlockId(block.kind) })
                }
              >
                <PlusIcon aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">{module.name}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove saved ${module.name}`}
                disabled={disabled}
                onClick={() =>
                  write(modules.filter((entry) => entry.id !== module.id))
                }
              >
                <Trash2Icon aria-hidden="true" className="size-4" />
              </Button>
            </div>
            {!compatible && (
              <p className="px-2 text-micro text-text-muted">
                Uses details that are not available in this template.
              </p>
            )}
          </div>
        );
      })}
      {modules.length === 0 && (
        <p className="text-console-body text-text-secondary">
          Select a block in the email to save it here.
        </p>
      )}
      {error && (
        <p role="alert" className="text-console-body text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
