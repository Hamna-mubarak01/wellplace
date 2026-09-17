"use client";

import { useEffect, useRef, useState } from "react";
import { BellIcon, CheckCheckIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/shared/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DESK_PANELS, markDeskPanelSeen, parseDeskSeen, unseenDeskItems, type DeskItems, type DeskPanel, type DeskSeen } from "@/lib/console/desk-notifications";

const LABELS: Record<DeskPanel, string> = { arrivals: "Arrivals", alerts: "Alerts", notes: "Notes", tasks: "Tasks" };

export interface DeskUpdatesProps {
  arrivals: React.ReactNode;
  alerts: React.ReactNode;
  notes: React.ReactNode;
  tasks: React.ReactNode;
  items: DeskItems;
  storageKey: string;
  counts?: Partial<Record<DeskPanel, number | null>>;
}

export function DeskUpdates({ arrivals, alerts, notes, tasks, items, storageKey, counts = {} }: DeskUpdatesProps) {
  const updatesRef = useRef<HTMLButtonElement>(null);
  const [panel, setPanel] = useState<DeskPanel>("arrivals");
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<DeskSeen>({});
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const ready = loadedKey === storageKey;
  const unread = Object.fromEntries(DESK_PANELS.map((key) => [key, ready ? unseenDeskItems(items[key], seen[key]) : 0])) as Record<DeskPanel, number>;
  const unreadCount = DESK_PANELS.reduce((total, key) => total + unread[key], 0);

  useEffect(() => {
    const restore = () => {
      try { setSeen(parseDeskSeen(localStorage.getItem(storageKey))); } catch { setSeen({}); }
      setLoadedKey(storageKey);
    };
    const timer = window.setTimeout(restore, 0);
    const onStorage = (event: StorageEvent) => { if (event.key === storageKey) restore(); };
    window.addEventListener("storage", onStorage);
    return () => { window.clearTimeout(timer); window.removeEventListener("storage", onStorage); };
  }, [storageKey]);

  const markRead = (key: DeskPanel) => {
    let current = ready ? seen : {};
    try { current = { ...current, ...parseDeskSeen(localStorage.getItem(storageKey)) }; } catch {}
    const next = markDeskPanelSeen(current, key, items[key]);
    setSeen(next);
    setLoadedKey(storageKey);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  };
  const showPanel = (key: DeskPanel) => { setPanel(key); markRead(key); setOpen(true); };

  useEffect(() => {
    const followHash = () => {
      const key = window.location.hash === "#attention" ? "alerts" : window.location.hash === "#arrivals" ? "arrivals" : window.location.hash === "#notes" ? "notes" : window.location.hash === "#tasks" ? "tasks" : null;
      if (key) { setPanel(key); setOpen(true); }
    };
    const timer = window.setTimeout(followHash, 0);
    window.addEventListener("hashchange", followHash);
    return () => { window.clearTimeout(timer); window.removeEventListener("hashchange", followHash); };
  }, []);

  const content = { arrivals, alerts, notes, tasks };
  return <>
      <Button hoverEffect="sweep" ref={updatesRef} aria-haspopup="dialog" variant={unreadCount > 0 ? "secondary" : "outline"} size="sm" onClick={() => showPanel(unread.alerts > 0 ? "alerts" : DESK_PANELS.find((key) => unread[key] > 0) ?? "arrivals")} aria-label={unreadCount ? `Updates: ${unreadCount} unread items` : "Updates"} aria-expanded={open}>
        <span className="relative"><BellIcon aria-hidden="true" className="size-4" />{unreadCount > 0 && <span data-unread-dot className="absolute -top-1 -right-1 size-2 rounded-full bg-danger ring-2 ring-surface-raised" />}</span>
        Updates<ChevronRightIcon aria-hidden="true" className="size-4" />
      </Button>
      <span role="status" className="sr-only">{unreadCount > 0 ? `${unreadCount} unread desk updates` : "No unread desk updates"}</span>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent data-desk-inbox onCloseAutoFocus={(event) => { event.preventDefault(); updatesRef.current?.focus(); }} className="w-full! gap-0 bg-surface-base sm:max-w-lg! [&>[data-slot=sheet-close]]:size-tap">
        <SheetHeader className="shrink-0 border-b border-border pr-14">
          <SheetTitle>Desk updates</SheetTitle>
          <SheetDescription>Today’s arrivals, open alerts, handover notes and your tasks.</SheetDescription>
        </SheetHeader>
        <Tabs value={panel} onValueChange={(value) => showPanel(value as DeskPanel)} className="min-h-0 flex-1 gap-0">
          <div className="shrink-0 border-b border-border bg-surface-raised p-3">
            <TabsList aria-label="Desk updates" className="grid h-auto! w-full grid-cols-4 bg-surface-sunken p-1">
              {DESK_PANELS.map((key) => <TabsTrigger key={key} value={key} className="h-auto! min-h-tap min-w-0 gap-1 px-1 py-2 text-micro whitespace-normal data-[state=active]:border-border-strong data-[state=active]:bg-surface-raised data-[state=active]:text-text-primary">
                {LABELS[key]}<span className="font-data">{counts[key] ?? items[key]?.length ?? "—"}</span>
                {unread[key] > 0 && <><span data-unread-dot aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-danger" /><span className="sr-only">{unread[key]} unread</span></>}
              </TabsTrigger>)}
            </TabsList>
            {unread[panel] > 0 && <Button hoverEffect="sweep" variant="ghost" size="sm" className="mt-2 w-full" onClick={() => markRead(panel)}><CheckCheckIcon aria-hidden="true" className="size-4" />Mark these updates as read</Button>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            {DESK_PANELS.map((key) => <TabsContent key={key} value={key} className="min-w-0">{content[key]}</TabsContent>)}
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  </>;
}
