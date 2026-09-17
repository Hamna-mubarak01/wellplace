import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, type LucideIcon } from "lucide-react";

import { ConsoleDataTableSkeleton } from "@/components/console/shared/console-data-table-skeleton";
import { ConsoleLinkedRow } from "@/components/console/shared/console-linked-row";
import {
  ConsolePagination,
  type ConsolePaginationNoun,
} from "@/components/console/shared/console-pagination";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type ConsoleColumnAlign = "start" | "center" | "end";

export type ConsoleSortDirection = "asc" | "desc";

export interface ConsoleColumn<Row> {
  readonly id: string;
  readonly header: string;
  readonly cell: (row: Row) => ReactNode;
  readonly align?: ConsoleColumnAlign;
  readonly sortKey?: string;
  readonly sortFirst?: ConsoleSortDirection;
  readonly wrap?: boolean;
  readonly className?: string;
}

export interface ConsoleTableSort {
  readonly key: string | null;
  readonly direction: ConsoleSortDirection;
  readonly hrefFor: (key: string, direction: ConsoleSortDirection) => string;
}

export interface ConsoleTablePagination {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly hrefFor: (page: number) => string;
  readonly noun?: ConsolePaginationNoun;
}

export interface ConsoleTableEmpty {
  readonly title: string;
  readonly description?: string;
  readonly Icon?: LucideIcon;
  readonly action?: ReactNode;
}

export interface ConsoleTableError {
  readonly title: string;
  readonly message: string;
  readonly remedy?: string;
}

export interface ConsoleDataTableProps<Row> {
  label: string;
  columns: readonly ConsoleColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  rowHref?: (row: Row) => string | null;
  rowLabel?: (row: Row) => string;
  actions?: (row: Row) => ReactNode;
  actionsHeader?: string;
  sort?: ConsoleTableSort;
  pagination?: ConsoleTablePagination;
  empty: ConsoleTableEmpty;
  error?: ConsoleTableError | null;
  loading?: boolean;
  loadingRows?: number;
  framed?: boolean;
  className?: string;
}

const ALIGN: Readonly<Record<ConsoleColumnAlign, string>> = {
  start: "text-left",
  center: "text-center",
  end: "text-right",
};

const ARIA_SORT: Readonly<Record<ConsoleSortDirection, "ascending" | "descending">> = {
  asc: "ascending",
  desc: "descending",
};

function headerCell<Row>(column: ConsoleColumn<Row>, sort: ConsoleTableSort | undefined): ReactNode {
  if (!column.sortKey || !sort) return column.header;

  const active = sort.key === column.sortKey;
  const next: ConsoleSortDirection = active
    ? sort.direction === "asc"
      ? "desc"
      : "asc"
    : (column.sortFirst ?? "asc");
  const Icon = !active ? ArrowUpDownIcon : sort.direction === "asc" ? ArrowUpIcon : ArrowDownIcon;

  return (
    <Link
      href={sort.hrefFor(column.sortKey, next)}
      scroll={false}
      className={cn(
        "inline-flex min-h-tap items-center gap-1 rounded-(--radius-inner) uppercase outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-focus-ring",
        active && "text-text-primary",
      )}
    >
      {column.header}
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="sr-only">{next === "asc" ? ", sort ascending" : ", sort descending"}</span>
    </Link>
  );
}

export function ConsoleDataTable<Row>({
  label,
  columns,
  rows,
  rowKey,
  rowHref,
  rowLabel,
  actions,
  actionsHeader = "Actions",
  sort,
  pagination,
  empty,
  error,
  loading = false,
  loadingRows,
  framed = true,
  className,
}: ConsoleDataTableProps<Row>) {
  if (error) {
    return <ConsoleReadError title={error.title} message={error.message} remedy={error.remedy} />;
  }

  if (loading) {
    return (
      <ConsoleDataTableSkeleton
        headers={columns.map((column) => column.header)}
        rows={loadingRows}
        actionsHeader={actions ? actionsHeader : undefined}
        framed={framed}
        className={className}
      />
    );
  }

  const EmptyIcon = empty.Icon;

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div
        className={cn(
          "min-w-0 overflow-hidden",
          framed && "rounded-(--radius-card) border border-border bg-surface-raised",
        )}
      >
        <Table className="text-console-table">
          <TableCaption className="sr-only">{label}</TableCaption>
          <TableHeader className="bg-surface-base">
            <TableRow className="border-border hover:bg-transparent">
              {columns.map((column) => {
                const active = sort !== undefined && column.sortKey !== undefined && sort.key === column.sortKey;
                return (
                  <TableHead
                    key={column.id}
                    scope="col"
                    aria-sort={active && sort ? ARIA_SORT[sort.direction] : undefined}
                    className={cn(
                      "h-11 px-4 text-console-label font-medium tracking-label text-text-muted uppercase",
                      ALIGN[column.align ?? "start"],
                      column.className,
                    )}
                  >
                    {headerCell(column, sort)}
                  </TableHead>
                );
              })}
              {actions && (
                <TableHead
                  scope="col"
                  className="h-11 px-4 text-right text-console-label font-medium tracking-label text-text-muted uppercase"
                >
                  {actionsHeader}
                </TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.length === 0 ? null : (
              rows.map((row) => {
                const key = rowKey(row);
                const href = rowHref?.(row) ?? null;
                const cells = columns.map((column, index) => {
                  const content = column.cell(row);
                  return (
                    <TableCell
                      key={column.id}
                      className={cn(
                        "px-4 py-3 text-text-primary",
                        ALIGN[column.align ?? "start"],
                        column.wrap && "whitespace-normal",
                        column.className,
                      )}
                    >
                      {index === 0 && href ? (
                        <Link
                          href={href}
                          aria-label={rowLabel?.(row)}
                          className="block rounded-(--radius-inner) font-medium text-text-primary outline-none hover:text-brand focus-visible:ring-2 focus-visible:ring-focus-ring"
                        >
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </TableCell>
                  );
                });
                const actionCell = actions ? (
                  <TableCell data-row-actions="" className="w-px px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">{actions(row)}</div>
                  </TableCell>
                ) : null;

                return href ? (
                  <ConsoleLinkedRow key={key} href={href} className="border-border">
                    {cells}
                    {actionCell}
                  </ConsoleLinkedRow>
                ) : (
                  <TableRow key={key} className="border-border hover:bg-transparent">
                    {cells}
                    {actionCell}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {rows.length === 0 && (
          <div role="status" className="px-4 py-10">
            <div className="mx-auto flex max-w-prose flex-col items-center gap-1 text-center">
              {EmptyIcon && <EmptyIcon aria-hidden="true" className="mb-1 size-5 shrink-0 text-text-muted" />}
              <p className="text-console-body font-medium text-text-primary">{empty.title}</p>
              {empty.description && (
                <p className="text-console-body text-pretty text-text-secondary">{empty.description}</p>
              )}
              {empty.action && <div className="mt-3">{empty.action}</div>}
            </div>
          </div>
        )}
      </div>

      {pagination && rows.length > 0 && (
        <ConsolePagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          hrefFor={pagination.hrefFor}
          noun={pagination.noun}
        />
      )}
    </div>
  );
}
