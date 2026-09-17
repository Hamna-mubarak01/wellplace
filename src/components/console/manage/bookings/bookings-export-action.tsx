import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/shared/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface BookingsExportActionProps {
  href: string;
  filtered: boolean;
}

export function BookingsExportAction({ href, filtered }: BookingsExportActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant="outline">
          <a href={href} download>
            <DownloadIcon aria-hidden="true" className="size-4" />
            Export
          </a>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{filtered ? "Download these bookings as CSV" : "Download all bookings as CSV"}</TooltipContent>
    </Tooltip>
  );
}
