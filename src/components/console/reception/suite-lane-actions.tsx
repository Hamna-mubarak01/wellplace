"use client";

import { useState } from "react";
import { EllipsisVerticalIcon, Settings2Icon, CalendarDaysIcon, MoveIcon } from "lucide-react";
import { formatDubaiTime } from "@/lib/domain/time";
import type { BoardEntry, BoardSuite } from "./board-types";
import { BOARD_STATE_LABEL } from "./board-types";
import { isMovable } from "./board-drag";
import { SuiteStatusDialog } from "./suite-status-dialog";
import { Button } from "@/components/shared/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export interface SuiteLaneActionsProps {
  suite: BoardSuite; entries: readonly BoardEntry[]; onRequestMove?: (entry: BoardEntry) => void;
  onInspect?: (entry: BoardEntry) => void; readOnly?: boolean;
}

export function SuiteLaneActions({ suite, entries, onRequestMove, onInspect, readOnly = false }: SuiteLaneActionsProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  return <>
    <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label={`Suite ${suite.suiteNumber} actions`}><EllipsisVerticalIcon aria-hidden="true" className="size-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="density-console reception-menu w-72 max-w-(--radix-dropdown-menu-content-available-width)">
        <DropdownMenuLabel>Suite {suite.suiteNumber}</DropdownMenuLabel>
        {!readOnly && <DropdownMenuItem onSelect={() => setStatusOpen(true)}><Settings2Icon aria-hidden="true" />Change suite status</DropdownMenuItem>}
        {onInspect && <><DropdownMenuSeparator /><DropdownMenuLabel>Bookings and blocks</DropdownMenuLabel>
          {!entries.length && <DropdownMenuItem disabled>No entries on this date</DropdownMenuItem>}
          {entries.map((entry) => <DropdownMenuItem key={entry.id} onSelect={() => onInspect(entry)}><CalendarDaysIcon aria-hidden="true" /><span className="min-w-0"><span className="block truncate">{entry.guestName || entry.reason || BOARD_STATE_LABEL[entry.state]}</span><span className="block font-data text-micro text-text-muted">{formatDubaiTime(entry.experienceStart)}–{formatDubaiTime(entry.experienceEnd)}</span></span></DropdownMenuItem>)}
        </>}
        {!readOnly && onRequestMove && entries.some(isMovable) && <><DropdownMenuSeparator /><DropdownMenuLabel>Move booking</DropdownMenuLabel>{entries.filter(isMovable).map((entry) => <DropdownMenuItem key={entry.id} onSelect={() => onRequestMove(entry)}><MoveIcon aria-hidden="true" /><span className="truncate">{entry.guestName || "Booking"}</span></DropdownMenuItem>)}</>}
      </DropdownMenuContent>
    </DropdownMenu>
    {statusOpen && <SuiteStatusDialog suite={suite} open onOpenChange={setStatusOpen} />}
  </>;
}
