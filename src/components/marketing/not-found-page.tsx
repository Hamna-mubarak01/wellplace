import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/shared/button";

export function NotFoundPage() {
  return (
    <main className="relative flex min-h-svh flex-1 flex-col overflow-hidden bg-surface-sunken">
      <Image
        src="/renderings/suite-view-4-1920.webp"
        alt=""
        aria-hidden="true"
        fill
        sizes="100vw"
        preload
        className="scale-105 object-cover"
      />

      <div
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(110% 95% at 50% 45%, rgb(var(--scrim-rgb)/0.46), rgb(var(--scrim-rgb)/0.74) 82%)," +
            "linear-gradient(180deg, rgb(var(--scrim-rgb)/0.1), rgb(var(--scrim-rgb)/0.25))",
        }}
        className="absolute inset-0"
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pt-16 pb-16 text-center sm:pb-20">
        <h1 className="text-body text-on-scrim-muted">
          Page was not found
        </h1>

        <div
          aria-hidden="true"
          className="relative mt-4 font-body text-numeral font-bold tracking-display text-on-scrim"
        >
          404
          <span className="pointer-events-none absolute top-1/2 left-1/2 h-px w-screen -translate-x-1/2 bg-surface-sunken/80" />
        </div>

        <Button asChild tone="scrim" className="mt-10">
          <Link href="/">Back to the homepage</Link>
        </Button>
      </div>
    </main>
  );
}
