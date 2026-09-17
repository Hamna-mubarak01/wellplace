import Link from "next/link";
import { Fragment } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/shared/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

export interface ConsolePaginationNoun {
  readonly one: string;
  readonly other: string;
}

export interface ConsolePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
  noun?: ConsolePaginationNoun;
  className?: string;
}

function pageWindow(page: number, pageCount: number): number[] {
  return [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter((candidate) => candidate >= 1 && candidate <= pageCount)
    .sort((a, b) => a - b);
}

export function ConsolePagination({
  page,
  pageSize,
  total,
  hrefFor,
  noun,
  className,
}: ConsolePaginationProps) {
  const size = Math.max(1, Math.floor(pageSize));
  const count = Math.max(0, Math.floor(total));
  const pageCount = Math.max(1, Math.ceil(count / size));
  const current = Math.min(Math.max(1, Math.floor(page)), pageCount);
  const first = count === 0 ? 0 : (current - 1) * size + 1;
  const last = Math.min(current * size, count);
  const word = noun ? (count === 1 ? noun.one : noun.other) : "";
  const totalLabel = `${count.toLocaleString("en-AE")}${word ? ` ${word}` : ""}`;
  const pages = pageWindow(current, pageCount);

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <p className="text-console-table text-text-secondary">
        {count === 0
          ? `No ${noun?.other ?? "results"}`
          : pageCount === 1
            ? totalLabel
            : `Showing ${first.toLocaleString("en-AE")}–${last.toLocaleString("en-AE")} of ${totalLabel}`}
      </p>

      {pageCount > 1 && (
        <Pagination aria-label="Pages" className="mx-0 w-auto justify-end">
          <PaginationContent className="flex-wrap gap-1">
            <PaginationItem>
              {current > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={hrefFor(current - 1)} rel="prev">
                    <ChevronLeftIcon aria-hidden="true" className="size-4" />
                    Previous
                  </Link>
                </Button>
              ) : (
                <Button type="button" variant="outline" size="sm" disabled>
                  <ChevronLeftIcon aria-hidden="true" className="size-4" />
                  Previous
                </Button>
              )}
            </PaginationItem>

            {pages.map((candidate, index) => (
              <Fragment key={candidate}>
                {index > 0 && candidate - pages[index - 1] > 1 && (
                  <PaginationItem>
                    <PaginationEllipsis className="size-tap" />
                  </PaginationItem>
                )}
                <PaginationItem>
                  <Button
                    asChild
                    variant={candidate === current ? "default" : "ghost"}
                    size="icon"
                    className="font-data tabular-nums"
                  >
                    <Link
                      href={hrefFor(candidate)}
                      aria-label={`Page ${candidate}`}
                      aria-current={candidate === current ? "page" : undefined}
                    >
                      {candidate}
                    </Link>
                  </Button>
                </PaginationItem>
              </Fragment>
            ))}

            <PaginationItem>
              {current < pageCount ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={hrefFor(current + 1)} rel="next">
                    Next
                    <ChevronRightIcon aria-hidden="true" className="size-4" />
                  </Link>
                </Button>
              ) : (
                <Button type="button" variant="outline" size="sm" disabled>
                  Next
                  <ChevronRightIcon aria-hidden="true" className="size-4" />
                </Button>
              )}
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
