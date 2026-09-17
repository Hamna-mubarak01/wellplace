"use client";

import { useState } from "react";

import type { BoardEntry } from "@/components/console/reception/board-types";
import { BOARD_STATE_LABEL } from "@/components/console/reception/board-types";
import { formatDubaiTime } from "@/lib/domain/time";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

export interface EntryHoverCardProps {
  entry: BoardEntry;
  bufferMinutes: number | null;
  suppressed?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function EntryHoverCard({
  entry,
  bufferMinutes,
  suppressed = false,
  footer,
  children,
}: EntryHoverCardProps) {
  const [open, setOpen] = useState(false);
  const experienceWindow = `${formatDubaiTime(entry.experienceStart)}–${formatDubaiTime(entry.experienceEnd)}`;


  return (
    <>
      <HoverCard
        open={suppressed ? false : open}
        onOpenChange={setOpen}
        openDelay={200}
      >
        <HoverCardTrigger asChild>{children}</HoverCardTrigger>
        <HoverCardContent className="w-72" side="top">
          <p className="text-console-body font-medium text-text-primary">
            {entry.guestName ?? BOARD_STATE_LABEL[entry.state]}
          </p>

          <dl className="mt-2 flex flex-col gap-1">
            <div className="flex justify-between gap-3">
              <dt className="text-micro text-text-muted">State</dt>
              <dd className="text-micro text-text-secondary">
                {BOARD_STATE_LABEL[entry.state]}
              </dd>
            </div>

            <div className="flex justify-between gap-3">
              <dt className="text-micro text-text-muted">Experience</dt>
              <dd className="font-data text-micro tabular-nums text-text-secondary">
                {experienceWindow}
              </dd>
            </div>

            <div className="flex justify-between gap-3">
              <dt className="text-micro text-text-muted">Suite free at</dt>
              <dd className="font-data text-micro tabular-nums text-text-secondary">
                {formatDubaiTime(entry.blockedEnd)}
                {bufferMinutes === null ? "" : ` · ${bufferMinutes} min buffer`}
              </dd>
            </div>

            {entry.holdExpiresAt && (
              <div className="flex justify-between gap-3">
                <dt className="text-micro text-text-muted">Hold expires</dt>
                <dd className="font-data text-micro tabular-nums text-warning-ink">
                  {formatDubaiTime(entry.holdExpiresAt)}
                </dd>
              </div>
            )}

            {entry.reason && (
              <div className="mt-1">
                <dt className="text-micro text-text-muted">Reason</dt>
                <dd className="mt-0.5 text-micro text-text-secondary">
                  {entry.reason}
                </dd>
              </div>
            )}
          </dl>

          {footer && <div className="mt-3 flex flex-wrap justify-end gap-2">{footer}</div>}
        </HoverCardContent>
      </HoverCard>

    </>
  );
}
