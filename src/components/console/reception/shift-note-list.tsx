"use client";

import { useState } from "react";
import { ChevronRightIcon, NotebookPenIcon } from "lucide-react";
import type { ShiftNoteRow } from "@/lib/db/queries/operations";
import { formatCalendarDayLong, formatDubaiDateTime } from "@/lib/domain/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/shared/button";
import { ShiftHandoverButton } from "@/components/console/reception/shift-handover-button";
import { ConsoleEmpty } from "@/components/console/console-surface";
import { WorkDetailDialog } from "@/components/console/reception/work-detail-dialog";
import { useWorkActions } from "@/components/console/reception/work-actions-context";

export function ShiftNoteList({ notes, onSelect }: { notes: readonly ShiftNoteRow[]; onSelect?: (note: ShiftNoteRow) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { canHandOver } = useWorkActions();
  const selected = notes.find((note) => note.id === selectedId);
  if (notes.length === 0) return <ConsoleEmpty Icon={NotebookPenIcon} title="No notes to show" description="Try another filter, or leave a note for the next shift." />;
  return <>
    <ul className="flex flex-col gap-3">
      {notes.map((note) => <li key={note.id} className="overflow-hidden rounded-(--radius-card) border border-border bg-surface-raised">
        <Button variant="ghost" className="h-auto! w-full items-start justify-between gap-3 rounded-none p-4 text-left whitespace-normal" aria-label={`Open handover note by ${note.authorName ?? "a colleague"}`} onClick={() => onSelect ? onSelect(note) : setSelectedId(note.id)}>
          <span className="min-w-0 flex-1">
            <span className="mb-3 flex flex-wrap items-center gap-2"><Badge variant="outline" className={note.handedOverAt ? "border-success-border bg-success-wash text-success-ink" : "border-warning-border bg-warning-wash text-warning-ink"}>{note.handedOverAt ? "Handed over" : "Waiting for handover"}</Badge><span className="text-micro font-normal text-text-muted">Shift: {formatCalendarDayLong(note.shiftOn)}</span></span>
            <span className="line-clamp-3 whitespace-pre-wrap wrap-anywhere text-console-body font-normal text-text-primary">{note.body}</span>
            <span className="mt-3 block text-micro font-normal text-text-muted">{note.authorName ?? "Name not recorded"} · {formatDubaiDateTime(note.createdAt)}</span>
          </span>
          <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 self-center text-text-muted" />
        </Button>
        {!note.handedOverAt && canHandOver && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3"><p className="text-micro text-text-muted">Confirm once this note has been passed on.</p><ShiftHandoverButton noteId={note.id} authorName={note.authorName ?? "A colleague"} /></div>}
      </li>)}
    </ul>
    {selected && !onSelect && <WorkDetailDialog key={selected.id} note={selected} onClose={() => setSelectedId(null)} />}
  </>;
}
