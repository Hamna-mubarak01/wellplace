"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { format, isValid, parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, ListFilterIcon, XIcon } from "lucide-react";

import { FilterPeriod } from "@/components/console/shared/filter-period";
import type {
  FilterDateRangeConfig,
  FilterOption,
  FilterPatch,
  FilterPeriodConfig,
  FilterSearchConfig,
  FilterSelectConfig,
  FilterToggleConfig,
} from "@/components/console/shared/filter-types";
import { Button } from "@/components/shared/button";
import { ConsoleSearchInput } from "@/components/shared/console-search-input";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { CONSOLE_LIST } from "@/lib/config/console-list";
import { cn } from "@/lib/utils";

export interface FilterBarProps {
  label?: string;
  search?: FilterSearchConfig;
  selects?: readonly FilterSelectConfig[];
  dateRange?: FilterDateRangeConfig;
  period?: FilterPeriodConfig;
  quickFilter?: FilterToggleConfig;
  pageParam?: string;
  resultsLabel?: string;
  className?: string;
}

type FilterValues = Readonly<Record<string, string | null>>;

interface DatePresets {
  readonly param: string;
  readonly options: readonly FilterOption[];
  readonly defaultValue: string;
  readonly clears?: readonly string[];
}

type Field =
  | {
      readonly kind: "select";
      readonly key: string;
      readonly label: string;
      readonly param: string;
      readonly options: readonly FilterOption[];
      readonly allLabel: string;
      readonly clears?: readonly string[];
    }
  | {
      readonly kind: "period";
      readonly key: string;
      readonly label: string;
      readonly param: string;
      readonly options: readonly FilterOption[];
      readonly defaultValue: string;
      readonly clears?: readonly string[];
    }
  | {
      readonly kind: "date";
      readonly key: string;
      readonly label: string;
      readonly clears?: readonly string[];
      readonly presets?: DatePresets;
    };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toDate(value: string | null | undefined): Date | undefined {
  if (!value || !ISO_DATE.test(value)) return undefined;
  const date = parseISO(value);
  return isValid(date) ? date : undefined;
}

function toIso(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function describeRange(from: Date, to: Date): string {
  if (toIso(from) === toIso(to)) return format(from, "d MMM yyyy");
  if (from.getFullYear() === to.getFullYear()) return `${format(from, "d MMM")} – ${format(to, "d MMM yyyy")}`;
  return `${format(from, "d MMM yyyy")} – ${format(to, "d MMM yyyy")}`;
}

function mergePatch(state: FilterValues, patch: FilterPatch): FilterValues {
  return { ...state, ...patch };
}

function withClears(patch: FilterPatch, clears: readonly string[] | undefined): FilterPatch {
  if (!clears || clears.length === 0) return patch;
  return { ...Object.fromEntries(clears.map((param) => [param, null])), ...patch };
}

export function FilterBar({
  label = "Filters",
  search,
  selects = [],
  dateRange,
  period,
  quickFilter,
  pageParam = "page",
  resultsLabel,
  className,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const serialized = params.toString();
  const navigation = useRef({ source: serialized, target: serialized });
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>();

  const searchParam = search?.param ?? "q";
  const searchMax = search?.maxLength ?? CONSOLE_LIST.searchMaxLength;
  const hasSearch = search !== undefined;
  const committedSearch = search?.value ?? "";
  const fromParam = dateRange?.fromParam ?? "from";
  const toParam = dateRange?.toParam ?? "to";
  const periodParam = period?.param ?? "period";
  const quickParam = quickFilter?.param ?? "via";

  const committed: Record<string, string | null> = {};
  for (const select of selects) committed[select.param] = select.value;
  if (dateRange) {
    committed[fromParam] = dateRange.from;
    committed[toParam] = dateRange.to;
  }
  if (period) committed[periodParam] = period.value === period.defaultValue ? null : period.value;
  if (quickFilter) committed[quickParam] = quickFilter.value === quickFilter.defaultValue ? null : quickFilter.value;
  const [shown, showPatch] = useOptimistic<FilterValues, FilterPatch>(committed, mergePatch);

  const [draft, setDraft] = useState({ source: committedSearch, value: committedSearch });
  if (draft.source !== committedSearch) {
    setDraft({
      source: committedSearch,
      value: draft.value.trim() === draft.source ? committedSearch : draft.value,
    });
  }
  const term = draft.value.trim();

  const apply = useCallback(
    (patch: FilterPatch) => {
      if (navigation.current.source !== serialized) {
        navigation.current = { source: serialized, target: serialized };
      }
      const next = new URLSearchParams(navigation.current.target);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      next.delete(pageParam);
      const query = next.toString();
      navigation.current.target = query;
      startTransition(() => {
        showPatch(patch);
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [serialized, pageParam, pathname, router, showPatch],
  );

  useEffect(() => {
    if (!hasSearch || term === committedSearch) return;
    const timer = window.setTimeout(
      () => apply({ [searchParam]: term === "" ? null : term }),
      CONSOLE_LIST.searchDelayMs,
    );
    return () => window.clearTimeout(timer);
  }, [hasSearch, term, committedSearch, searchParam, apply]);

  const datePresets: DatePresets | undefined =
    dateRange && period
      ? { param: periodParam, options: period.options, defaultValue: period.defaultValue, clears: period.clears }
      : undefined;

  const fields: Field[] = [
    ...(dateRange
      ? [{ kind: "date" as const, key: "date", label: dateRange.label, clears: dateRange.clears, presets: datePresets }]
      : []),
    ...selects.map((select) => ({
      kind: "select" as const,
      key: `select:${select.param}`,
      label: select.label,
      param: select.param,
      options: select.options,
      allLabel: select.allLabel ?? "All",
      clears: select.clears,
    })),
    ...(period && !dateRange
      ? [
          {
            kind: "period" as const,
            key: `period:${periodParam}`,
            label: period.label,
            param: periodParam,
            options: period.options,
            defaultValue: period.defaultValue,
            clears: period.clears,
          },
        ]
      : []),
  ];

  function valueLabel(field: Field): string | null {
    if (field.kind === "date") {
      const start = toDate(shown[fromParam]);
      const end = toDate(shown[toParam]) ?? start;
      if (start && end) return describeRange(start, end);
      const preset = field.presets ? (shown[field.presets.param] ?? null) : null;
      return preset === null ? null : (field.presets?.options.find((option) => option.value === preset)?.label ?? null);
    }
    const value = shown[field.param] ?? null;
    if (value === null) return null;
    return field.options.find((option) => option.value === value)?.label ?? null;
  }

  function removePatch(field: Field): FilterPatch {
    if (field.kind === "date") {
      return { [fromParam]: null, [toParam]: null, ...(field.presets ? { [field.presets.param]: null } : {}) };
    }
    return { [field.param]: null };
  }

  const chips = fields.flatMap((field) => {
    const value = valueLabel(field);
    return value === null ? [] : [{ field, value }];
  });
  const quickActive = quickFilter !== undefined && (shown[quickParam] ?? null) !== null;
  const anyActive = term !== "" || chips.length > 0 || quickActive;

  function clearAll() {
    const patch: Record<string, string | null> = {};
    if (hasSearch) patch[searchParam] = null;
    for (const field of fields) Object.assign(patch, removePatch(field));
    if (quickFilter) patch[quickParam] = null;
    setDraft({ source: committedSearch, value: "" });
    apply(patch);
  }

  function openChange(next: boolean) {
    setOpen(next);
    if (!next) setView(null);
  }

  function openField(field: Field) {
    if (field.kind === "date") {
      const start = toDate(shown[fromParam]);
      setDraftRange(start ? { from: start, to: toDate(shown[toParam]) ?? start } : undefined);
    }
    setView(field.key);
  }

  function choose(field: Field, value: string | null) {
    if (field.kind === "select") apply(withClears({ [field.param]: value }, field.clears));
    if (field.kind === "period") {
      apply(withClears({ [field.param]: value === field.defaultValue ? null : value }, field.clears));
    }
    openChange(false);
  }

  function choosePreset(presets: DatePresets, value: string) {
    apply(withClears({ [presets.param]: value === presets.defaultValue ? null : value }, presets.clears));
    openChange(false);
  }

  function applyRange(field: Field, range: DateRange | undefined) {
    if (!range?.from) return;
    apply(withClears({ [fromParam]: toIso(range.from), [toParam]: toIso(range.to ?? range.from) }, field.clears));
    openChange(false);
  }

  const active = fields.find((field) => field.key === view) ?? null;
  const activePresets = active?.kind === "date" ? active.presets : undefined;
  const datesChosen = toDate(shown[fromParam]) !== undefined;

  return (
    <div role="search" aria-label={label} aria-busy={pending} className={cn("@container min-w-0 space-y-3", className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {search && (
          <div className="flex min-w-0 flex-1 basis-full @lg:basis-72">
            <ConsoleSearchInput
              label={search.label}
              placeholder={search.placeholder}
              value={draft.value}
              onChange={(value) => setDraft({ source: committedSearch, value: value.slice(0, searchMax) })}
            />
          </div>
        )}

        {quickFilter && (
          <FilterPeriod
            label={quickFilter.label}
            labelHidden
            options={quickFilter.options}
            value={shown[quickParam] ?? quickFilter.defaultValue}
            onValueChange={(value) =>
              apply(withClears({ [quickParam]: value === quickFilter.defaultValue ? null : value }, quickFilter.clears))
            }
            className="basis-full @xs:basis-auto"
          />
        )}

        {fields.length > 0 && (
          <Popover open={open} onOpenChange={openChange}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                hoverEffect="sweep"
                aria-label={chips.length === 0 ? label : `${label}, ${chips.length} applied`}
                className="basis-full @xs:basis-auto"
              >
                <ListFilterIcon aria-hidden="true" className="size-4" />
                Filter
                {chips.length > 0 && (
                  <span className="rounded-full bg-brand-wash px-2 font-data text-micro tabular-nums text-text-primary">
                    {chips.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              collisionPadding={8}
              className={cn(
                "max-h-(--radix-popover-content-available-height) overflow-y-auto overscroll-contain rounded-(--radius-card) border-border bg-surface-raised p-0",
                active?.kind === "date" ? "w-auto max-w-(--radix-popover-content-available-width)" : "w-(--measure-filter-popover)",
              )}
            >
              {active === null && (
                <Command>
                  <CommandInput placeholder="Filter by…" />
                  <CommandList>
                    <CommandEmpty>No filter matches.</CommandEmpty>
                    <CommandGroup>
                      {fields.map((field) => {
                        const current = valueLabel(field);
                        return (
                          <CommandItem
                            key={field.key}
                            value={field.label}
                            onSelect={() => openField(field)}
                            className="min-h-tap gap-2"
                          >
                            <span className="min-w-0 flex-1 truncate">{field.label}</span>
                            {current && <span className="max-w-1/2 truncate text-text-muted">{current}</span>}
                            <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              )}

              {active !== null && (
                <div className="flex items-center gap-1 border-b border-border px-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Back to filters"
                    onClick={() => setView(null)}
                  >
                    <ChevronLeftIcon aria-hidden="true" />
                  </Button>
                  <span className="text-console-label tracking-label text-text-muted uppercase">{active.label}</span>
                </div>
              )}

              {active !== null && active.kind !== "date" && (
                <Command>
                  {active.options.length > CONSOLE_LIST.filterSearchThreshold && (
                    <CommandInput placeholder={`Search ${active.label.toLowerCase()}…`} />
                  )}
                  <CommandList>
                    <CommandEmpty>Nothing matches.</CommandEmpty>
                    <CommandGroup>
                      {active.kind === "select" && (
                        <CommandItem value={active.allLabel} onSelect={() => choose(active, null)} className="min-h-tap gap-2">
                          <span className="flex-1">{active.allLabel}</span>
                          {(shown[active.param] ?? null) === null && <CheckIcon aria-hidden="true" className="size-4 text-brand" />}
                        </CommandItem>
                      )}
                      {active.options.map((option) => {
                        const selected =
                          active.kind === "period"
                            ? (shown[active.param] ?? active.defaultValue) === option.value
                            : shown[active.param] === option.value;
                        return (
                          <CommandItem
                            key={option.value}
                            value={option.label}
                            onSelect={() => choose(active, option.value)}
                            className="min-h-tap gap-2"
                          >
                            <span className="flex-1">{option.label}</span>
                            {selected && <CheckIcon aria-hidden="true" className="size-4 text-brand" />}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              )}

              {active?.kind === "date" && (
                <div className="flex flex-col sm:flex-row">
                  {activePresets && (
                    <Command className="border-b border-border sm:w-40 sm:border-r sm:border-b-0">
                      <CommandList>
                        <CommandGroup>
                          {activePresets.options.map((option) => (
                            <CommandItem
                              key={option.value}
                              value={option.label}
                              onSelect={() => choosePreset(activePresets, option.value)}
                              className="min-h-tap gap-2"
                            >
                              <span className="flex-1">{option.label}</span>
                              {!datesChosen && (shown[activePresets.param] ?? activePresets.defaultValue) === option.value && (
                                <CheckIcon aria-hidden="true" className="size-4 text-brand" />
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  )}

                  <div className="p-2">
                    <Calendar
                      mode="range"
                      weekStartsOn={1}
                      defaultMonth={draftRange?.from}
                      selected={draftRange}
                      onSelect={setDraftRange}
                      className="[--cell-size:var(--spacing-tap)]"
                    />
                    <Separator />
                    <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-2">
                      <span className="text-console-body text-text-muted">
                        {draftRange?.from
                          ? describeRange(draftRange.from, draftRange.to ?? draftRange.from)
                          : "Pick a day or a range"}
                      </span>
                      <Button type="button" size="sm" disabled={!draftRange?.from} onClick={() => applyRange(active, draftRange)}>
                        Show dates
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>

      {anyActive && (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {chips.map(({ field, value }) => (
            <Button
              key={field.key}
              type="button"
              variant="outline"
              size="sm"
              hoverEffect="simple"
              aria-label={`Remove filter ${field.label}: ${value}`}
              onClick={() => apply(removePatch(field))}
            >
              <span className="text-text-muted">{field.label}</span>
              <span className="font-medium">{value}</span>
              <XIcon aria-hidden="true" className="size-3.5" />
            </Button>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
            Clear all
          </Button>
          {resultsLabel && (
            <span className="ms-auto font-data text-console-body tabular-nums text-text-muted">
              {pending ? "Updating…" : resultsLabel}
            </span>
          )}
        </div>
      )}

      <p role="status" className="sr-only">
        {pending ? "Updating results…" : (resultsLabel ?? "")}
      </p>
    </div>
  );
}
