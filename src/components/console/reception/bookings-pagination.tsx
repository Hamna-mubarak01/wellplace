import { Fragment } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export interface BookingsPaginationProps {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}

export function BookingsPagination({
  page,
  pageCount,
  hrefFor,
}: BookingsPaginationProps) {
  if (pageCount <= 1) return null;

  const pages = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter((candidate) => candidate >= 1 && candidate <= pageCount).sort((a, b) => a - b);

  return (
    <Pagination>
      <PaginationContent className="flex-wrap gap-2">
        {page > 1 && (
          <PaginationItem>
            <PaginationPrevious href={hrefFor(page - 1)} />
          </PaginationItem>
        )}

        {pages.map((candidate, index) => (
          <Fragment key={candidate}>
          {index > 0 && candidate - pages[index - 1] > 1 && <PaginationItem><PaginationEllipsis /></PaginationItem>}
          <PaginationItem>
            <PaginationLink className="min-h-tap min-w-tap" href={hrefFor(candidate)} isActive={candidate === page}>
              {candidate}
            </PaginationLink>
          </PaginationItem>
          </Fragment>
        ))}

        {page < pageCount && (
          <PaginationItem>
            <PaginationNext href={hrefFor(page + 1)} />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}
