import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface ConsoleDataTableSkeletonProps {
  headers: readonly string[];
  rows?: number;
  actionsHeader?: string;
  framed?: boolean;
  className?: string;
}

export function ConsoleDataTableSkeleton({
  headers,
  rows = 6,
  actionsHeader,
  framed = true,
  className,
}: ConsoleDataTableSkeletonProps) {
  const columns = actionsHeader ? [...headers, actionsHeader] : headers;

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "min-w-0 overflow-hidden",
        framed && "rounded-(--radius-card) border border-border bg-surface-raised",
        className,
      )}
    >
      <span className="sr-only">Loading</span>
      <Table className="text-console-table">
        <TableHeader className="bg-surface-base">
          <TableRow className="border-border hover:bg-transparent">
            {columns.map((header, index) => (
              <TableHead
                key={`${header}-${index}`}
                className={cn(
                  "h-11 px-4 text-console-label tracking-label text-text-muted uppercase",
                  actionsHeader && index === columns.length - 1 && "text-right",
                )}
              >
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: Math.max(1, rows) }, (_, row) => (
            <TableRow key={row} className="border-border hover:bg-transparent">
              {columns.map((header, index) => (
                <TableCell key={`${header}-${index}`} className="px-4 py-4">
                  {actionsHeader && index === columns.length - 1 ? (
                    <Skeleton className="ml-auto size-tap rounded-(--radius-button)" />
                  ) : (
                    <Skeleton className={cn("h-4", index === 0 ? "w-40 max-w-full" : "w-24 max-w-full")} />
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
