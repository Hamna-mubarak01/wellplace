"use client";

import { createContext, use, useOptimistic, useRef, useTransition, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { XIcon } from "lucide-react";

import { suiteDrawerHref } from "@/app/(console)/manage/suites/suites-view";
import { SuiteDrawerSkeleton } from "@/components/console/manage/suites/suite-drawer-skeleton";
import { Button } from "@/components/shared/button";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";

export interface SuiteDrawerControls {
  readonly hrefFor: (suiteId: string) => string;
  readonly openSuite: (suiteId: string) => void;
  readonly closeSuite: () => void;
}

const SuiteDrawerContext = createContext<SuiteDrawerControls | null>(null);

export function useSuiteDrawer(): SuiteDrawerControls {
  const controls = use(SuiteDrawerContext);
  if (controls === null) throw new Error("useSuiteDrawer is only available inside SuiteDrawer.");
  return controls;
}

export interface SuiteDrawerProps {
  suiteId: string | null;
  panel: ReactNode;
  children: ReactNode;
}

function suiteLink(suiteId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-suite-link="${CSS.escape(suiteId)}"]`);
}

export function SuiteDrawer({ suiteId, panel, children }: SuiteDrawerProps) {
  const router = useRouter();
  const search = useSearchParams().toString();
  const [, startTransition] = useTransition();
  const [openId, setOpenId] = useOptimistic(suiteId);
  const returnTo = useRef<string | null>(suiteId);

  const controls: SuiteDrawerControls = {
    hrefFor: (id) => suiteDrawerHref(search, id),
    openSuite: (id) => {
      returnTo.current = id;
      startTransition(() => {
        setOpenId(id);
        router.replace(suiteDrawerHref(search, id), { scroll: false });
      });
    },
    closeSuite: () => {
      startTransition(() => {
        setOpenId(null);
        router.replace(suiteDrawerHref(search, null), { scroll: false });
      });
    },
  };

  const settled = openId === null || openId === suiteId;

  return (
    <SuiteDrawerContext value={controls}>
      {children}
      <Sheet
        open={openId !== null}
        onOpenChange={(open) => {
          if (!open) controls.closeSuite();
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            const target = returnTo.current === null ? null : suiteLink(returnTo.current);
            if (target === null) return;
            event.preventDefault();
            target.focus();
          }}
          className="density-console w-full! gap-0 bg-surface-raised p-0 text-text-primary sm:max-w-suite-drawer!"
        >
          <div className="absolute top-3 right-3 z-10">
            <SheetClose asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Close suite">
                <XIcon aria-hidden="true" className="size-4" />
              </Button>
            </SheetClose>
          </div>
          {settled && panel !== null ? panel : <SuiteDrawerSkeleton />}
        </SheetContent>
      </Sheet>
    </SuiteDrawerContext>
  );
}
