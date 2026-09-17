"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCheckIcon } from "lucide-react";
import { toast } from "@/lib/console/feedback";
import { checkIn } from "@/app/(console)/reception/actions";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { cn } from "@/lib/utils";
import { Button } from "@/components/shared/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/console/reception/reception-dialog";

export function ArrivalCheckIn({ bookingId, guestName, suiteNumber, className }: { bookingId: string; guestName: string; suiteNumber: number; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return <Dialog open={open} onOpenChange={(next) => { if (!pending) { setOpen(next); setError(null); } }}>
    <DialogTrigger asChild><Button className={cn("mt-2 w-full", className)}><UserCheckIcon aria-hidden="true" className="size-4" />Check in</Button></DialogTrigger>
    <DialogContent pending={pending} className="sm:max-w-md">
      <DialogHeader><DialogTitle>Check in {guestName}?</DialogTitle><DialogDescription>Suite {suiteNumber} · Check-in time recorded now.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-console-body text-danger-ink">{error}</p>}
      <DialogFooter>
        <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>Not yet</Button>
        <Button disabled={pending} onClick={() => start(async () => {
          setError(null);
          try {
            const result = await checkIn(bookingId, "");
            if (!result.ok) { setError(result.message); return; }
            toast.success(`${guestName} checked in`);
            setOpen(false);
            router.refresh();
          } catch { setError(NETWORK_MESSAGE); }
        })}>{pending ? "Checking in…" : "Confirm check-in"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
