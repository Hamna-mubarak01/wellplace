"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface RevealProps extends React.ComponentPropsWithoutRef<"div"> {
  delayStep?: number;
}

export function Reveal({ className, delayStep = 0, style, ...props }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-shown={shown ? "true" : undefined}
      style={{ transitionDelay: `${delayStep * 60}ms`, ...style }}
      className={cn(
        "translate-y-4 opacity-0 transition-[opacity,translate] duration-500 ease-out",
        "data-shown:translate-y-0 data-shown:opacity-100",
        "motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}
