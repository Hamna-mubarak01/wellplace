"use client";

import { DownloadIcon, PrinterIcon } from "lucide-react";

import { Button } from "@/components/shared/button";
import { toast } from "@/lib/console/feedback";

export interface BookingReceiptActionsProps {
  downloadHref: string;
}

export function BookingReceiptActions({ downloadHref }: BookingReceiptActionsProps) {
  const print = () => {
    try {
      window.print();
    } catch {
      toast.error("The receipt could not be sent to the printer", {
        description: "Use your browser's Print command, or download the receipt instead.",
      });
    }
  };

  return (
    <>
      <Button type="button" onClick={print}>
        <PrinterIcon aria-hidden="true" className="size-4" />
        Print receipt
      </Button>
      <Button asChild variant="outline">
        <a href={downloadHref} download>
          <DownloadIcon aria-hidden="true" className="size-4" />
          Download receipt
        </a>
      </Button>
    </>
  );
}
