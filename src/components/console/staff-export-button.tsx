"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronDownIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  LoaderIcon,
} from "lucide-react";
import { toast } from "@/lib/console/feedback";

import { Button } from "@/components/shared/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EXPORT_CONTENT_TYPES,
  type ExportFormat,
} from "@/lib/console/export-format";
import { cn } from "@/lib/utils";

const EXPORT_PATH = "/api/console/staff/export";
const FORWARDED = ["q", "role", "access"] as const;

export interface StaffExportButtonProps {
  className?: string;
  total: number;
}

export function StaffExportButton({ className, total }: StaffExportButtonProps) {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);

  async function download(format: ExportFormat) {
    if (busy) return;
    setBusy(true);

    const query = new URLSearchParams();
    for (const key of FORWARDED) {
      const value = params.get(key);
      if (value) query.set(key, value);
    }
    query.set("format", format);

    try {
      const response = await fetch(`${EXPORT_PATH}?${query}`);
      const expectedType = EXPORT_CONTENT_TYPES[format].split(";")[0];
      const contentType = response.headers.get("content-type") ?? "";

      if (!response.ok || !contentType.startsWith(expectedType)) {
        toast.error("The export did not run", {
          description:
            response.status === 403
              ? "Exporting staff needs a Management account."
              : "Nothing was downloaded. Try again in a moment.",
        });
        return;
      }

      const blob = await response.blob();
      const name =
        /filename="([^"]+)"/.exec(
          response.headers.get("content-disposition") ?? "",
        )?.[1] ?? `wellplace-staff.${format}`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      requestAnimationFrame(() => URL.revokeObjectURL(url));

      toast.success("Staff exported", { description: name });
    } catch {
      toast.error("The export did not run", {
        description:
          "We couldn't reach the server. Check your connection and try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={busy || total === 0}
          aria-busy={busy || undefined}
          aria-label="Export staff"
          className={cn("shrink-0", className)}
        >
          {busy ? (
            <LoaderIcon aria-hidden="true" className="animate-spin" />
          ) : (
            <DownloadIcon aria-hidden="true" />
          )}
          <span className="hidden sm:inline">Export</span>
          <ChevronDownIcon aria-hidden="true" className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem
          className="min-h-tap gap-3 px-3 py-2"
          onSelect={() => void download("csv")}
        >
          <FileTextIcon aria-hidden="true" className="text-muted-foreground" />
          <span>CSV file</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="min-h-tap gap-3 px-3 py-2"
          onSelect={() => void download("xlsx")}
        >
          <FileSpreadsheetIcon aria-hidden="true" className="text-muted-foreground" />
          <span>Excel file (.xlsx)</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
