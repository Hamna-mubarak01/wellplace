"use client";
import { ActionError } from "@/components/shared/action-error";

import { useEffect, useState } from "react";
import { ChevronsUpDownIcon, UserPlusIcon } from "lucide-react";
import { searchBookingCustomers } from "@/app/(console)/reception/booking-options";
import { Button } from "@/components/shared/button";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BOOKING_LIST } from "@/lib/config/booking-list";
import type { ReceptionCustomer } from "@/lib/db/queries/reception-customers";

export function BookingCustomerPicker({ customer, onChange, disabled }: {
  customer: ReceptionCustomer | null;
  onChange: (customer: ReceptionCustomer | null) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [retry, setRetry] = useState(0);
  const [resolved, setResolved] = useState<{ key: string; customers: ReceptionCustomer[]; error: string | null } | null>(null);
  const key = `${search}|${retry}`;
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchBookingCustomers(search).then((result) => {
        if (!cancelled) setResolved({ key, customers: result.ok ? result.customers : [], error: result.ok ? null : result.message });
      }).catch(() => {
        if (!cancelled) setResolved({ key, customers: [], error: "Customers could not be loaded. Try again." });
      });
    }, BOOKING_LIST.searchDelayMs);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, search, key]);
  const settled = resolved?.key === key;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-console-body font-medium">Customer</p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button hoverEffect="simple" type="button" variant="outline" role="combobox" aria-expanded={open} aria-label="Choose customer" disabled={disabled} className="w-full justify-between">
            <span className="truncate">{customer ? `${customer.first_name} ${customer.last_name}` : "Create new or choose an existing customer"}</span>
            <ChevronsUpDownIcon aria-hidden="true" className="size-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search name, email or phone" value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandGroup>
                <CommandItem value="new" className="min-h-tap" onSelect={() => { onChange(null); setOpen(false); }}>
                  <UserPlusIcon aria-hidden="true" /> Create new customer
                </CommandItem>
              </CommandGroup>
              {!settled ? <p role="status" className="p-3 text-micro text-text-secondary">Loading customers…</p> : resolved?.error ? (
                <div className="p-3"><ActionError title="Customer search could not be loaded" message={resolved.error}><Button type="button" variant="outline" onClick={() => setRetry((value) => value + 1)}>Try again</Button></ActionError></div>
              ) : <CommandGroup heading={search ? "Matching customers" : "Recent customers"}>
                {resolved?.customers.map((item) => <CommandItem key={item.id} value={item.id} disabled={item.is_blocked} className="min-h-tap items-start py-3" onSelect={() => { onChange(item); setOpen(false); }}>
                  <span className="flex min-w-0 flex-col gap-1"><span>{item.first_name} {item.last_name}{item.is_blocked ? " · Blocked" : ""}</span><span className="break-all text-micro text-text-secondary">{item.email} · {item.phone_e164}</span></span>
                </CommandItem>)}
                {resolved?.customers.length === 0 && <p className="p-3 text-micro text-text-secondary">No customers found. Create a new customer above.</p>}
              </CommandGroup>}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-micro text-text-secondary">{customer ? "Saved customer details" : "New customer"}</p>
    </div>
  );
}
