"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface LegalTocItem {
  readonly slug: string;
  readonly title: string;
}

export interface LegalTocProps {
  items: readonly LegalTocItem[];
  className?: string;
}

const READING_LINE = 0.28;

export function LegalToc({ items, className }: LegalTocProps) {
  const [active, setActive] = useState<string>(items[0]?.slug ?? "");
  const listRef = useRef<HTMLUListElement>(null);
  const [indicator, setIndicator] = useState({ top: 0, height: 0, ready: false });

  const pick = useCallback(() => {
    const line = window.innerHeight * READING_LINE;

    const atBottom =
      window.innerHeight + window.scrollY >= document.body.scrollHeight - 2;
    if (atBottom) {
      const last = items.at(-1);
      if (last) setActive(last.slug);
      return;
    }

    let current = items[0]?.slug ?? "";
    for (const item of items) {
      const section = document.getElementById(item.slug);
      if (!section) continue;
      if (section.getBoundingClientRect().top <= line) current = item.slug;
    }
    setActive(current);
  }, [items]);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        pick();
      });
    };

    onScroll();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [pick]);

  useEffect(() => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-slug="${active}"]`);
    if (!list || !item) return;

    setIndicator({
      top: item.offsetTop,
      height: item.offsetHeight,
      ready: true,
    });
  }, [active, items]);

  return (
    <nav aria-label="On this page" className={cn("relative", className)}>
      <p className="mb-3 px-3 text-label font-medium tracking-label text-text-muted uppercase">
        On this page
      </p>
      <div className="relative">
                <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-px bg-border"
        />
        <span
          aria-hidden="true"
          className="absolute left-0 w-0.5 rounded-full bg-brand transition-[transform,height,opacity] duration-300 ease-out motion-reduce:transition-none"
          style={{
            transform: `translateY(${indicator.top}px)`,
            height: `${indicator.height}px`,
            opacity: indicator.ready ? 1 : 0,
          }}
        />
        <ul ref={listRef} className="flex flex-col">
          {items.map((item) => {
            const current = item.slug === active;
            return (
              <li key={item.slug} data-slug={item.slug}>
                <a
                  href={`#${item.slug}`}
                  aria-current={current ? "true" : undefined}
                  className={cn(
                    "block rounded-r-(--radius-control) py-2 pr-3 pl-3.5 text-small outline-none transition-colors duration-200",
                    "hover:bg-surface-hover hover:text-text-primary",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand",
                    current
                      ? "font-medium text-text-primary"
                      : "text-text-secondary",
                  )}
                >
                  {item.title}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
