"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BanIcon, ShieldCheckIcon } from "lucide-react";

import {
  searchCustomersToBlock,
  setCustomerBlocked,
  type BlockableCustomer,
  type CustomerBlockResult,
} from "@/app/(console)/manage/customers/actions";
import { ActionError } from "@/components/shared/action-error";
import { Button } from "@/components/shared/button";
import { ReasonField } from "@/components/shared/reason-field";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/lib/console/feedback";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import { CONSOLE_LIST } from "@/lib/config/console-list";

export interface CustomerBlockDialogProps {
  readonly customer?: { readonly id: string; readonly name: string };
  readonly blocked?: boolean;
}

const REASON_ID = "customer-block-reason";

export function CustomerBlockDialog({ customer, blocked = false }: CustomerBlockDialogProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<BlockableCustomer | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<readonly BlockableCustomer[]>([]);
  const [searching, setSearching] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);

  const target = customer ?? picked;
  const choosing = customer === undefined && picked === null;

  useEffect(() => {
    if (!open || !choosing) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const result = await searchCustomersToBlock({ search });
        if (cancelled) return;
        if (result.ok) {
          setResults(result.customers);
          setFailure(null);
        } else {
          setFailure(result.message);
        }
      } catch {
        if (!cancelled) setFailure(NETWORK_MESSAGE);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, CONSOLE_LIST.searchDelayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, choosing, search]);

  function changeOpen(next: boolean) {
    if (pending) return;
    if (next) {
      setPicked(null);
      setSearch("");
      setResults([]);
      setReason("");
      setReasonError(undefined);
      setFailure(null);
    }
    setOpen(next);
  }

  function submit() {
    if (pending || target === null) return;
    if (reason.trim() === "") {
      setReasonError("Give a reason.");
      return;
    }
    setReasonError(undefined);
    setFailure(null);

    start(async () => {
      let result: CustomerBlockResult;
      try {
        result = await setCustomerBlocked({ customerId: target.id, blocked: !blocked, reason });
      } catch (cause) {
        console.error("[manage] setCustomerBlocked could not be confirmed:", cause);
        result = { ok: false, message: NETWORK_MESSAGE };
      }
      if (!result.ok) {
        setFailure(result.message);
        return;
      }
      toast.success(blocked ? `${target.name} can book again` : `${target.name} is blocked from booking`);
      setOpen(false);
      router.refresh();
    });
  }

  const title = blocked ? `Unblock ${customer?.name ?? "customer"}` : customer ? `Block ${customer.name}` : "Block a customer";

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        {blocked ? (
          <Button type="button" variant="outline">
            <ShieldCheckIcon aria-hidden="true" className="size-4" />
            Unblock
          </Button>
        ) : (
          <Button type="button" variant={customer ? "outline" : "default"}>
            <BanIcon aria-hidden="true" className="size-4" />
            {customer ? "Block" : "Block a customer"}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        aria-busy={pending || undefined}
        showCloseButton={!pending}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        className="flex max-h-dialog-max-h min-w-0 flex-col gap-4 overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {blocked
              ? "They can book online and at Reception again."
              : "A blocked customer cannot book online or at Reception."}
          </DialogDescription>
        </DialogHeader>

        {choosing && (
          <Command shouldFilter={false} className="rounded-(--radius-card) border border-border">
            <CommandInput
              value={search}
              onValueChange={(value) => setSearch(value.slice(0, CONSOLE_LIST.searchMaxLength))}
              placeholder="Name, email, phone or customer number"
            />
            <CommandList>
              <CommandEmpty>{searching ? "Searching…" : "No customer found."}</CommandEmpty>
              <CommandGroup>
                {results.map((result) => (
                  <CommandItem
                    key={result.id}
                    value={result.id}
                    onSelect={() => setPicked(result)}
                    className="min-h-tap flex-col items-start gap-0.5"
                  >
                    <span className="font-medium text-text-primary">{result.name}</span>
                    <span className="font-data text-micro tabular-nums text-text-muted">
                      {result.email === "" ? result.reference : `${result.reference} · ${result.email}`}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}

        {customer === undefined && picked !== null && (
          <div className="flex min-w-0 items-center justify-between gap-3 rounded-(--radius-card) border border-border px-4 py-3">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-medium text-text-primary">{picked.name}</span>
              <span className="truncate font-data text-micro tabular-nums text-text-muted">{picked.reference}</span>
            </span>
            <Button type="button" variant="ghost" onClick={() => setPicked(null)} disabled={pending}>
              Change
            </Button>
          </div>
        )}

        {target !== null && (
          <ReasonField
            id={REASON_ID}
            value={reason}
            onChange={(next) => {
              setReason(next);
              if (reasonError && next.trim() !== "") setReasonError(undefined);
            }}
            error={reasonError}
            disabled={pending}
          />
        )}

        {failure !== null && <ActionError title="Nothing was changed" message={failure} />}

        <DialogFooter>
          <Button type="button" variant="ghost" hoverEffect="sweep" onClick={() => changeOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={blocked ? "default" : "destructive"}
            onClick={submit}
            disabled={pending || target === null}
          >
            {pending ? "Saving…" : blocked ? "Unblock" : "Block"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
