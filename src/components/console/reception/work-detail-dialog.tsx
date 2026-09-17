"use client";

import { useEffect, useState } from "react";
import { Clock3Icon } from "lucide-react";
import { useWorkActions } from "@/components/console/reception/work-actions-context";
import type { TaskRow, ShiftNoteRow } from "@/lib/db/queries/operations";
import type { WorkActivity, WorkActivityResult } from "@/lib/db/queries/work-activity";
import { formatCalendarDayLong, formatDubaiDateTime } from "@/lib/domain/time";
import { TASK_PRIORITY_LABEL } from "@/lib/config/reception";
import { Button } from "@/components/shared/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/console/reception/reception-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskActions } from "@/components/console/reception/task-actions";
import { ShiftHandoverButton } from "@/components/console/reception/shift-handover-button";
import type { StaffOption } from "@/components/console/reception/staff-assign-menu";

export const TASK_STATUS_LABEL = { open: "To do", in_progress: "In progress", done: "Done", cancelled: "Cancelled" } as const;

function activityLabel(event: WorkActivity) {
  if (event.action === "create_task") return "Created the task";
  if (event.action === "add_shift_note") return "Wrote the note";
  if (event.action === "hand_over_shift") return "Marked the note as handed over";
  if (event.action === "assign_task") return event.assigneeName ? `Assigned to ${event.assigneeName}` : "Left the task unassigned";
  if (event.status === "done") return "Marked the task as done";
  if (event.status === "in_progress") return "Started the task";
  if (event.status === "cancelled") return "Cancelled the task";
  return "Marked the task as to do";
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-micro text-text-muted">{label}</dt><dd className="mt-1 whitespace-pre-wrap wrap-anywhere text-console-body text-text-primary">{children}</dd></div>;
}

export function WorkDetailDialog({ task, note, staff = [], onClose }: {
  task?: TaskRow; note?: ShiftNoteRow; staff?: readonly StaffOption[]; onClose: () => void;
}) {
  const { loadWorkActivity, canHandOver } = useWorkActions();
  const [resolvedHistory, setHistory] = useState<{ key: string; result: WorkActivityResult } | null>(null);
  const [pending, setPending] = useState(false);
  const [retry, setRetry] = useState(0);
  const id = task?.id ?? note?.id;
  const kind = task ? "task" : "note";
  const version = task ? `${task.status}-${task.assignedTo}` : note?.handedOverAt;
  const historyKey = `${id}|${kind}|${version}|${retry}`;
  const history = resolvedHistory?.key === historyKey ? resolvedHistory.result : null;
  useEffect(() => {
    if (!id) return;
    let active = true;
    loadWorkActivity(kind, id).then((result) => { if (active) setHistory({ key: historyKey, result }); }).catch(() => {
      if (active) setHistory({ key: historyKey, result: { ok: false, message: "The activity history could not be loaded. Check your connection and try again." } });
    });
    return () => { active = false; };
  }, [id, kind, historyKey, loadWorkActivity]);
  if (!task && !note) return null;
  return <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
    <DialogContent pending={pending} className="flex max-h-dialog-max-h min-h-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
      <DialogHeader className="shrink-0 border-b border-border p-5 pr-12 text-left">
        <DialogTitle className="wrap-anywhere">{task?.title ?? "Handover note"}</DialogTitle>
        <DialogDescription>{task ? TASK_STATUS_LABEL[task.status] : note?.handedOverAt ? "Handed over" : "Waiting for handover"} · All times are Dubai time.</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-5">
        {task ? <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Assigned to">{task.assignedToName ?? "Unassigned"}</Detail>
          <Detail label="Due date">{task.dueOn ? formatCalendarDayLong(task.dueOn) : "No due date"}</Detail>
          <Detail label="Priority">{TASK_PRIORITY_LABEL[task.priority]}</Detail>
          <Detail label="Created">{task.createdAt ? formatDubaiDateTime(task.createdAt) : "Not recorded"}</Detail>
          {task.completedAt && <><Detail label="Completed by">{task.completedByName ?? "Name not recorded"}</Detail><Detail label="Completed on">{formatDubaiDateTime(task.completedAt)}</Detail></>}
          <div className="sm:col-span-2"><Detail label="Task details">{task.note || "No extra details added."}</Detail></div>
        </dl> : note && <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Written by">{note.authorName ?? "Name not recorded"}</Detail>
          <Detail label="Written on">{formatDubaiDateTime(note.createdAt)}</Detail>
          <Detail label="Shift date">{formatCalendarDayLong(note.shiftOn)}</Detail>
          {note.handedOverAt && <Detail label="Handed over on">{formatDubaiDateTime(note.handedOverAt)}</Detail>}
          <div className="sm:col-span-2"><Detail label="Note">{note.body}</Detail></div>
        </dl>}
        <section className="border-t border-border pt-5" aria-label="Activity history">
          <h3 className="mb-4 flex items-center gap-2 text-console-body font-medium"><Clock3Icon aria-hidden="true" className="size-4" />Activity history</h3>
          {!history ? <div role="status" className="space-y-3"><span className="sr-only">Loading activity history</span><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : !history.ok ? <div role="alert"><p className="text-console-body text-text-secondary">{history.message}</p><Button hoverEffect="sweep" variant="outline" size="sm" className="mt-3" onClick={() => { setHistory(null); setRetry((n) => n + 1); }}>Try again</Button></div> : history.events.length === 0 ? <p className="text-console-body text-text-muted">No activity details were recorded for this item.</p> : <ol className="space-y-4 border-l border-border pl-4">
            {history.events.map((event) => <li key={event.id} className="min-w-0"><p className="text-console-body font-medium">{activityLabel(event)}</p><p className="mt-1 wrap-anywhere text-console-body text-text-secondary">{event.actorName ?? "Name not recorded"}</p><time dateTime={event.occurredAt} className="text-micro text-text-muted">{formatDubaiDateTime(event.occurredAt)}</time></li>)}
          </ol>}
        </section>
      </div>
      <DialogFooter className="mx-0 mb-0 flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-surface-raised p-4 sm:justify-between">
        <Button variant="outline" disabled={pending} onClick={onClose}>Close</Button>
        {task && <TaskActions onPendingChange={setPending} task={task} staff={staff} onDone={onClose} />}
        {note && !note.handedOverAt && canHandOver && <ShiftHandoverButton onPendingChange={setPending} noteId={note.id} authorName={note.authorName ?? "A colleague"} onDone={onClose} />}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
