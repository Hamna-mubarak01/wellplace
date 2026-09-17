"use client";

import { useRef } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/shared/button";

export function ConsoleSearchInput({ value, onChange, label, placeholder }: {
  value: string; onChange: (value: string) => void; label: string; placeholder: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return <div className="relative min-w-0 flex-1">
    <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" />
    <Input ref={input} enterKeyHint="search" autoComplete="off" aria-label={label} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} className="h-control bg-surface-raised pr-14 pl-10 text-base" />
    {value.length > 0 && <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center"><Button type="button" variant="ghost" size="icon" hoverEffect="simple" aria-label="Clear the search" className="console-input-clear" onClick={() => { onChange(""); input.current?.focus(); }}><XIcon aria-hidden="true" className="size-4" /></Button></div>}
  </div>;
}
