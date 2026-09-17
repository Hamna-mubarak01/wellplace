"use client";

import { useRef, useState } from "react";
import { ChevronDownIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/shared/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  messageVariableGroup, messageVariableKeywords, type MessageVariable,
} from "@/lib/config/message-documents";

interface VariablePickerProps {
  variables: readonly MessageVariable[];
  onInsert: (name: string) => void;
  onOpen?: () => void;
  label?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export function VariablePicker({
  variables, onInsert, onOpen, label = "Variable", ariaLabel, disabled = false,
}: VariablePickerProps) {
  const [open, setOpen] = useState(false);
  const pendingInsert = useRef<string | null>(null);
  const groups = new Map<string, MessageVariable[]>();
  for (const entry of variables) {
    const group = messageVariableGroup(entry.name);
    groups.set(group, [...(groups.get(group) ?? []), entry]);
  }

  return (
    <Popover open={open} onOpenChange={(next) => {
      if (next) onOpen?.();
      setOpen(next);
    }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled || !variables.length} aria-label={ariaLabel}>
          <PlusIcon aria-hidden="true" className="size-3.5" />
          {label}
          <ChevronDownIcon aria-hidden="true" className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={8}
        className="w-(--measure-filter-popover) max-w-(--radix-popover-content-available-width) rounded-(--radius-card) border-border bg-surface-raised p-0"
        onCloseAutoFocus={(event) => {
          if (pendingInsert.current !== null) {
            event.preventDefault();
            const name = pendingInsert.current;
            pendingInsert.current = null;
            onInsert(name);
          }
        }}
      >
        <Command aria-label="Insert variable">
          <CommandInput aria-label="Search variables" placeholder="Search variables…" />
          <CommandList>
            <CommandEmpty>No matching variables for this email.</CommandEmpty>
            {Array.from(groups, ([group, entries]) => (
              <CommandGroup key={group} heading={group}>
                {entries.map((entry) => (
                  <CommandItem
                    key={entry.name}
                    value={entry.name}
                    keywords={[entry.label, ...messageVariableKeywords(entry.name)]}
                    className="min-h-tap cursor-pointer"
                    onSelect={() => {
                      pendingInsert.current = entry.name;
                      setOpen(false);
                    }}
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-medium">{entry.label}</span>
                      <span className="truncate text-micro text-text-secondary">Example: {entry.sample}</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
