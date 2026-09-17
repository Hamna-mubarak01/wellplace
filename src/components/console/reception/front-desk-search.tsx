"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConsoleSearchInput } from "@/components/shared/console-search-input";

export function FrontDeskSearch() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  return <form role="search" action="/reception/bookings" className="flex min-w-0 flex-1" onSubmit={(event) => {
    event.preventDefault();
    router.push(`/reception/bookings?${new URLSearchParams({ q: query.trim() })}`);
  }}>
    <input type="hidden" name="q" value={query} />
    <ConsoleSearchInput label="Find a booking" placeholder="Guest, phone or email" value={query} onChange={setQuery} />
  </form>;
}
