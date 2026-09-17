"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  EllipsisVerticalIcon,
  InboxIcon,
  SearchXIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { toast } from "@/lib/console/feedback";
import { runAction } from "@/lib/console/run-action";
import type { WaitlistLead } from "@/lib/db/queries/waitlist-leads";
import { eraseLead, eraseLeads } from "@/app/(console)/manage/waitlist/actions";
import { dubaiStamp, leadOrigin } from "@/components/console/lead-format";
import { LeadDeleteDialog } from "@/components/console/lead-delete-dialog";
import { LeadDetailDialog } from "@/components/console/lead-detail-dialog";
import { ConsolePagination } from "@/components/console/shared/console-pagination";
import { EmptyValue } from "@/components/console/shared/empty-value";
import { StatusChip } from "@/components/console/shared/status-chip";
import { Button } from "@/components/shared/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface LeadsTableProps {
  rows: WaitlistLead[];
  total: number;
  page: number;
  pageSize: number;
  canManage: boolean;
  filtered: boolean;
}

const HEAD = "h-11 px-4 text-console-label font-medium tracking-label text-text-muted uppercase";
const CELL = "px-4 py-3 text-text-primary";

const EMPTY_SELECTION: ReadonlySet<string> = new Set();

const PEOPLE = { one: "person", other: "people" } as const;

export function LeadsTable({
  rows,
  total,
  page,
  pageSize,
  canManage,
  filtered,
}: LeadsTableProps) {
  const [pending, start] = useTransition();
  const [viewing, setViewing] = useState<WaitlistLead | null>(null);
  const [deleting, setDeleting] = useState<WaitlistLead[] | null>(null);
  const pathname = usePathname();
  const params = useSearchParams();

  const rowKey = rows.map((lead) => lead.id).join(",");
  const [selection, setSelection] = useState<{
    key: string;
    ids: ReadonlySet<string>;
  }>({ key: rowKey, ids: EMPTY_SELECTION });

  const selected = selection.key === rowKey ? selection.ids : EMPTY_SELECTION;

  const selectedLeads = useMemo(
    () => rows.filter((lead) => selected.has(lead.id)),
    [rows, selected],
  );

  const allSelected = rows.length > 0 && selectedLeads.length === rows.length;
  const someSelected = selectedLeads.length > 0 && !allSelected;

  function clearSelection() {
    setSelection({ key: rowKey, ids: EMPTY_SELECTION });
  }

  function toggleOne(id: string, next: boolean) {
    const draft = new Set(selected);
    if (next) draft.add(id);
    else draft.delete(id);
    setSelection({ key: rowKey, ids: draft });
  }

  function toggleAll(next: boolean) {
    setSelection({
      key: rowKey,
      ids: next ? new Set(rows.map((lead) => lead.id)) : EMPTY_SELECTION,
    });
  }

  function confirmBulkDelete(leads: WaitlistLead[]) {
    setDeleting(null);
    const ids = leads.map((lead) => lead.id);

    start(async () => {
      try {
        const result = await eraseLeads({
          entryIds: ids,
          reason: "Deleted from the console",
        });

        if (!result.ok) {
          toast.error(result.message);
          return;
        }

        clearSelection();

        if (result.failed > 0) {
          toast.warning(`Deleted ${result.deleted}`, {
            description: `${result.failed} could not be deleted. Refresh and try those again.`,
          });
          return;
        }

        toast.success(
          result.deleted === 1 ? "Deleted" : `Deleted ${result.deleted} people`,
        );
      } catch (cause) {
        console.error("[console] bulk delete threw:", cause);
        toast.error("We couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  function pageHref(target: number): string {
    const query = new URLSearchParams(params.toString());
    if (target > 1) query.set("page", String(target));
    else query.delete("page");
    const qs = query.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function confirmDelete(leads: WaitlistLead[]) {
    const [only] = leads;
    if (leads.length !== 1 || !only) {
      confirmBulkDelete(leads);
      return;
    }

    setDeleting(null);
    setViewing(null);
    start(async () => {
      const ok = await runAction(
        () => eraseLead({ entryId: only.id, reason: "Deleted from the console" }),
        "Deleted",
      );
      if (ok) clearSelection();
    });
  }

  const EmptyIcon = filtered ? SearchXIcon : InboxIcon;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {canManage && selectedLeads.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius-card) border border-brand bg-brand-wash px-4 py-3">
          <p
            aria-live="polite"
            className="text-console-body font-medium text-text-primary"
          >
            <span className="font-data tabular-nums">
              {selectedLeads.length}
            </span>{" "}
            selected
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              disabled={pending}
            >
              <XIcon aria-hidden="true" />
              Clear
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleting(selectedLeads)}
              disabled={pending}
            >
              <Trash2Icon aria-hidden="true" />
              Delete
            </Button>
          </div>
        </div>
      )}

      <div className="min-w-0 overflow-hidden rounded-(--radius-card) border border-border bg-surface-raised">
        <Table className="min-w-288 table-fixed text-console-table">
          <TableCaption className="sr-only">People on the waitlist</TableCaption>
          <colgroup>
            {canManage && <col className="w-14" />}
            <col />
            <col />
            <col className="w-44" />
            <col className="w-16" />
            <col className="w-32" />
            <col className="w-44" />
            <col className="w-36" />
            <col className="w-20" />
          </colgroup>
          <TableHeader className="bg-surface-base">
            <TableRow className="border-border hover:bg-transparent">
              {canManage && (
                <TableHead scope="col" className="h-11 w-px px-2">
                  <label data-tap-area="" className="grid size-tap cursor-pointer place-items-center">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={(next) => toggleAll(next === true)}
                      disabled={pending || rows.length === 0}
                      aria-label="Select everyone on this page"
                    />
                  </label>
                </TableHead>
              )}
              <TableHead scope="col" className={HEAD}>
                Name
              </TableHead>
              <TableHead scope="col" className={HEAD}>
                Email
              </TableHead>
              <TableHead scope="col" className={HEAD}>
                Mobile
              </TableHead>
              <TableHead scope="col" className={cn(HEAD, "text-right")}>
                Age
              </TableHead>
              <TableHead scope="col" className={HEAD}>
                Arrived via
              </TableHead>
              <TableHead scope="col" className={HEAD}>
                Joined
              </TableHead>
              <TableHead scope="col" className={HEAD}>
                Status
              </TableHead>
              <TableHead scope="col" className={cn(HEAD, "text-right")}>
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((lead) => {
              const joined = dubaiStamp(lead.createdAt);
              return (
                <TableRow
                  key={lead.id}
                  data-selected={selected.has(lead.id) || undefined}
                  onClick={() => setViewing(lead)}
                  className="cursor-pointer border-border hover:bg-surface-hover focus-within:bg-surface-hover data-selected:bg-surface-active"
                >
                  {canManage && (
                    <TableCell
                      className="w-px px-2 py-1"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <label data-tap-area="" className="grid size-tap cursor-pointer place-items-center">
                        <Checkbox
                          checked={selected.has(lead.id)}
                          onCheckedChange={(next) => toggleOne(lead.id, next === true)}
                          disabled={pending}
                          aria-label={`Select ${lead.firstName} ${lead.lastName}`}
                        />
                      </label>
                    </TableCell>
                  )}
                  <TableCell data-tap-area="" className={CELL}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="link"
                          onClick={(event) => {
                            event.stopPropagation();
                            setViewing(lead);
                          }}
                          className="w-full min-w-0 justify-start px-0 text-left font-medium"
                        >
                          <span className="truncate">{lead.firstName} {lead.lastName}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="break-all">{lead.firstName} {lead.lastName}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className={cn(CELL, "text-text-secondary")}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0} className="block truncate rounded-(--radius-inner) outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
                          {lead.email}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="break-all">{lead.email}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell
                    className={cn(CELL, "font-data tabular-nums text-text-secondary")}
                  >
                    {lead.phoneE164}
                  </TableCell>
                  <TableCell
                    className={cn(CELL, "text-right font-data tabular-nums text-text-secondary")}
                  >
                    {lead.ageYears ?? <EmptyValue label="Age not given" />}
                  </TableCell>
                  <TableCell
                    className={cn(CELL, "whitespace-normal break-words text-text-secondary")}
                  >
                    {leadOrigin(lead.source, lead.utmCampaign)}
                  </TableCell>
                  <TableCell className={CELL}>
                    <span className="block whitespace-nowrap">{joined.date}</span>
                    <span className="block font-data text-micro tabular-nums text-text-secondary">
                      {joined.time}
                    </span>
                  </TableCell>
                  <TableCell className={CELL}>
                    <div className="flex flex-col items-start gap-1">
                      <StatusChip tone={lead.archivedAt ? "neutral" : "success"}>{lead.archivedAt ? "Archived" : "Active"}</StatusChip>
                      {lead.signupCount > 1 && (
                        <StatusChip tone="neutral">
                          <span className="font-data tabular-nums">{lead.signupCount}</span>
                          submissions
                        </StatusChip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell
                    data-row-actions=""
                    className="w-px px-4 py-2 text-right"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={pending}
                              aria-label={`Actions for ${lead.firstName} ${lead.lastName}`}
                            >
                              <EllipsisVerticalIcon aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              variant="destructive"
                              className="min-h-tap whitespace-nowrap"
                              onSelect={(event) => {
                                event.preventDefault();
                                setDeleting([lead]);
                              }}
                            >
                              <Trash2Icon aria-hidden="true" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {rows.length === 0 && (
          <div role="status" className="px-4 py-10">
            <div className="mx-auto flex max-w-prose flex-col items-center gap-1 text-center">
              <EmptyIcon aria-hidden="true" className="mb-1 size-5 shrink-0 text-text-muted" />
              <p className="text-console-body font-medium text-text-primary">
                {filtered ? "No one matches this search" : "Nobody on the list yet"}
              </p>
              <p className="text-console-body text-pretty text-text-secondary">
                {filtered
                  ? "Try a shorter term, or clear the filters to see the whole list."
                  : "The moment someone joins from the waitlist page, they appear here and an email lands in your inbox."}
              </p>
              {filtered && (
                <div className="mt-3">
                  <Button asChild variant="outline">
                    <Link href={pathname}>Clear filters</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <ConsolePagination
          page={page}
          pageSize={pageSize}
          total={total}
          hrefFor={pageHref}
          noun={PEOPLE}
        />
      )}

      <LeadDetailDialog
        lead={viewing}
        canManage={canManage}
        onOpenChange={(open) => !open && setViewing(null)}
        onDelete={(lead) => {
          setViewing(null);
          setDeleting([lead]);
        }}
      />
      <LeadDeleteDialog
        leads={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
