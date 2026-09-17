"use client";

import { useEffect, useRef, useState } from "react";

export function BookingGuestName({ name }: { name: string }) {
  const fullName = name.trim().replace(/\s+/g, " ");
  const [firstName, secondName] = fullName.split(" ");
  const shortName = secondName ? `${firstName} ${Array.from(secondName)[0]}…` : firstName;
  const container = useRef<HTMLSpanElement>(null);
  const full = useRef<HTMLSpanElement>(null);
  const short = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState<"full" | "short" | "first">("full");

  useEffect(() => {
    const element = container.current;
    const fullText = full.current;
    const shortText = short.current;
    if (!element || !fullText || !shortText) return;
    const observer = new ResizeObserver(() => {
      const width = element.getBoundingClientRect().width;
      setSize(fullText.getBoundingClientRect().width <= width ? "full" : shortText.getBoundingClientRect().width <= width ? "short" : "first");
    });
    observer.observe(element);
    observer.observe(fullText);
    observer.observe(shortText);
    return () => observer.disconnect();
  }, [fullName, shortName]);

  return <span ref={container} data-booking-name className="relative block min-w-0 truncate">
    <span data-name-visible>{size === "full" ? fullName : size === "short" ? shortName : firstName}</span>
    <span ref={full} aria-hidden="true" className="invisible pointer-events-none absolute top-0 left-0 w-max whitespace-nowrap">{fullName}</span>
    <span ref={short} aria-hidden="true" className="invisible pointer-events-none absolute top-0 left-0 w-max whitespace-nowrap">{shortName}</span>
  </span>;
}
