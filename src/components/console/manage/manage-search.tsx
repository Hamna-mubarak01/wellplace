"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderIcon, SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/components/shared/button";
import { Input } from "@/components/ui/input";

const SEARCH_DEBOUNCE_MS = 300;

export interface ManageSearchProps {
  basePath: string;
  search: string;
  placeholder: string;
  label: string;
}

export function ManageSearch({
  basePath,
  search,
  placeholder,
  label,
}: ManageSearchProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [term, setTerm] = useState(search);
  const requested = useRef(search);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (search !== requested.current) {
      requested.current = search;
      setTerm(search);
    }
  }, [search]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function commit(value: string) {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    const trimmed = value.trim();
    if (trimmed === requested.current) return;
    requested.current = trimmed;

    const query = new URLSearchParams(params.toString());
    if (trimmed.length === 0) query.delete("q");
    else query.set("q", trimmed);

    const next = query.toString();
    start(() => router.replace(next ? `${basePath}?${next}` : basePath));
  }

  return (
    <form
      role="search"
      className="relative min-w-0 rounded-(--radius-card) border border-border bg-surface-raised has-[input:focus-visible]:border-brand has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/40 sm:max-w-96"
      onSubmit={(event) => {
        event.preventDefault();
        commit(term);
      }}
    >
      <SearchIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
      />

      <Input
        name="q"
        type="search"
        value={term}
        onChange={(event) => {
          setTerm(event.target.value);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(
            () => commit(event.target.value),
            SEARCH_DEBOUNCE_MS,
          );
        }}
        placeholder={placeholder}
        aria-label={label}
        aria-busy={pending}
        className="h-tap w-full rounded-none border-0 bg-transparent pr-12 pl-9 text-console-body shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-console-body dark:bg-transparent [&::-webkit-search-cancel-button]:appearance-none"
      />

      <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center">
        {pending ? (
          <span
            role="status"
            aria-label="Searching"
            className="grid size-8 place-items-center"
          >
            <LoaderIcon
              aria-hidden="true"
              className="size-4 text-brand motion-safe:animate-spin"
            />
          </span>
        ) : (
          term.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Clear search"
              onClick={() => {
                setTerm("");
                commit("");
              }}
              className="size-8 rounded-(--radius-control)"
            >
              <XIcon aria-hidden="true" />
            </Button>
          )
        )}
      </div>
    </form>
  );
}
