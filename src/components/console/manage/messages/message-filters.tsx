"use client";

import type { ReactNode } from "react";
import { ChevronDownIcon, ListFilterIcon, XIcon } from "lucide-react";
import { Button } from "@/components/shared/button";
import { ConsoleSearchInput } from "@/components/shared/console-search-input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CONSOLE_LIST } from "@/lib/config/console-list";
import { MESSAGE_DOCUMENT_GROUPS } from "@/lib/config/message-documents";

export function MessageFilters({
  search,
  group,
  resultsLabel,
  actions,
}: {
  search: string;
  group: string | null;
  resultsLabel: string;
  actions?: ReactNode;
}) {
  const category = MESSAGE_DOCUMENT_GROUPS.find(
    (entry) => entry.value === group,
  );
  function apply(patch: Record<string, string | null>) {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    url.searchParams.delete("page");
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }
  return (
    <div
      role="search"
      aria-label="Filters"
      className="@container min-w-0 flex-1"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 basis-full @lg:basis-72">
          <ConsoleSearchInput
            label="Search templates"
            placeholder="Search by name or subject"
            value={search}
            onChange={(value) =>
              apply({ q: value.slice(0, CONSOLE_LIST.searchMaxLength) })
            }
          />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                aria-label={
                  category ? `Filters, ${category.label} selected` : "Filters"
                }
              >
                <ListFilterIcon aria-hidden="true" className="size-4" />
                Filters{category ? " (1)" : ""}
                <ChevronDownIcon aria-hidden="true" className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              collisionPadding={8}
              className="w-(--measure-filter-popover) max-w-(--radix-dropdown-menu-content-available-width)"
            >
              <DropdownMenuLabel>Category</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={category?.value ?? "all"}
                onValueChange={(value) =>
                  apply({ group: value === "all" ? null : value })
                }
              >
                <DropdownMenuRadioItem value="all" className="min-h-tap">
                  All categories
                </DropdownMenuRadioItem>
                {MESSAGE_DOCUMENT_GROUPS.map((entry) => (
                  <DropdownMenuRadioItem
                    key={entry.value}
                    value={entry.value}
                    className="min-h-tap"
                  >
                    {entry.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="min-h-tap"
                disabled={!search && !group}
                onSelect={() => apply({ q: null, group: null })}
              >
                <XIcon aria-hidden="true" className="size-4" /> Clear filters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {actions}
        </div>
      </div>
      <p role="status" className="mt-2 text-micro text-text-muted">
        {resultsLabel}
        {category ? ` · ${category.label}` : ""}
      </p>
    </div>
  );
}
