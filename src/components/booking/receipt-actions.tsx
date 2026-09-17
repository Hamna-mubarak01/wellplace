"use client";

import { useState } from "react";
import { DownloadIcon, Share2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/shared/button";
import { receiptDownloadPath } from "@/lib/config/receipt";

export function ReceiptActions({ token, reference }: { token: string; reference: string }) {
  const [sharing, setSharing] = useState(false);

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    const url = window.location.href.split("?")[0];
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: `WellPlace booking ${reference}`, text: `My WellPlace booking ${reference}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Receipt link copied", { description: "Paste it anywhere to share your booking." });
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) toast.error("The receipt link could not be shared. Please try again.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 print:hidden">
      <Button asChild className="h-control w-full">
        <a href={receiptDownloadPath(token)} download>
          <DownloadIcon aria-hidden="true" />
          Download PDF
        </a>
      </Button>
      <Button type="button" variant="outline" className="h-control w-full" disabled={sharing} onClick={() => void share()}>
        <Share2Icon aria-hidden="true" />
        Share booking
      </Button>
    </div>
  );
}
