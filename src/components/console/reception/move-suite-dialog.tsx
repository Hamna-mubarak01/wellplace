"use client";

import { moveBooking } from "@/app/(console)/reception/actions";
import type {
  BoardEntry,
  BoardSuite,
  BoardWindow,
} from "@/components/console/reception/board-types";
import { BOARD_STATE_LABEL } from "@/components/console/reception/board-types";
import {
  entryDurationMs,
  gridStarts,
  type MoveProposal,
} from "@/components/console/reception/board-drag";
import {
  MoveBookingDialog,
  type MoveBookingDialogCopy,
} from "@/components/console/shared/booking/move-booking-dialog";

const RECEPTION_MOVE_COPY: Partial<MoveBookingDialogCopy> = {
  suiteReason: "Move reason",
  timeReason: "Rescheduling reason",
};

export interface MoveSuiteDialogProps {
  entry: BoardEntry;
  suites: readonly BoardSuite[];
  view: BoardWindow;
  bookableWindow?: BoardWindow | null;
  intervalMinutes: number;
  nowMs: number;
  initial: MoveProposal;
  onClose: () => void;
}

export function MoveSuiteDialog({
  entry,
  suites,
  view,
  bookableWindow = null,
  intervalMinutes,
  nowMs,
  initial,
  onClose,
}: MoveSuiteDialogProps) {
  return (
    <MoveBookingDialog
      bookingId={entry.bookingId}
      who={entry.guestName ?? BOARD_STATE_LABEL[entry.state]}
      suites={suites}
      current={{
        suiteId: entry.suiteId,
        startsAt: entry.experienceStart,
        endsAt: entry.experienceEnd,
      }}
      durationMs={entryDurationMs(entry)}
      initial={initial}
      startOptions={gridStarts(entry, bookableWindow ?? view, intervalMinutes, nowMs)}
      openingWindow={bookableWindow}
      copy={RECEPTION_MOVE_COPY}
      onSubmit={moveBooking}
      onClose={onClose}
    />
  );
}
