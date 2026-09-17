"use client";

import { useState } from "react";
import { ClipboardListIcon, NotebookPenIcon, PlusIcon, SearchIcon } from "lucide-react";
import type { TaskListing, ShiftNoteListing } from "@/lib/db/queries/operations";
import type { StaffOption } from "@/components/console/reception/staff-assign-menu";
import { TaskList } from "@/components/console/reception/task-list";
import { ShiftNoteList } from "@/components/console/reception/shift-note-list";
import { ShiftNoteForm } from "@/components/console/reception/shift-note-form";
import { CreateTaskDialog } from "@/components/console/reception/create-task-dialog";
import { WorkDetailDialog } from "@/components/console/reception/work-detail-dialog";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import { Button } from "@/components/shared/button";
import { Input } from "@/components/console/reception/reception-input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shared/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/console/reception/reception-dialog";

export function TasksWorkspace({ tasks, notes, staff, currentStaffId, today, canWriteNotes = true }: {
  tasks: TaskListing; notes: ShiftNoteListing; staff: readonly StaffOption[]; currentStaffId: string; today: string; canWriteNotes?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [taskFilter, setTaskFilter] = useState("open");
  const [owner, setOwner] = useState("all");
  const [noteFilter, setNoteFilter] = useState("waiting");
  const [notePending, setNotePending] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [tab, setTab] = useState("tasks");
  const [selected, setSelected] = useState<{kind: "task" | "note"; id: string} | null>(null);
  const allTasks = tasks.ok ? tasks.tasks : [];
  const allNotes = notes.ok ? notes.notes : [];
  const term = query.trim().toLowerCase();
  const active = allTasks.filter((task) => task.status === "open" || task.status === "in_progress");
  const waiting = allNotes.filter((note) => !note.handedOverAt);
  const visibleTasks = allTasks.filter((task) => {
    const finished = task.status === "done" || task.status === "cancelled";
    return (taskFilter === "all" || (taskFilter === "open" && !finished) || (taskFilter === "done" && finished)) &&
      (owner === "all" || (owner === "mine" && task.assignedTo === currentStaffId) || (owner === "unassigned" && !task.assignedTo)) &&
      `${task.title} ${task.note ?? ""} ${task.assignedToName ?? ""} ${task.completedByName ?? ""}`.toLowerCase().includes(term);
  });
  const visibleNotes = allNotes.filter((note) => (noteFilter === "all" || (noteFilter === "waiting" && !note.handedOverAt) || (noteFilter === "done" && !!note.handedOverAt)) && `${note.body} ${note.authorName ?? ""}`.toLowerCase().includes(term));
  const selectedTask = selected?.kind === "task" ? allTasks.find((task) => task.id === selected.id) : undefined;
  const selectedNote = selected?.kind === "note" ? allNotes.find((note) => note.id === selected.id) : undefined;

  return <>
    <Tabs value={tab} onValueChange={setTab} className="min-w-0 gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList aria-label="Tasks and handover views" className="grid h-auto! w-full grid-cols-2 border border-border bg-surface-sunken p-1 sm:w-auto">
          <TabsTrigger value="tasks" className="h-auto min-h-tap gap-2 px-3 py-2 text-console-body whitespace-normal"><ClipboardListIcon aria-hidden="true" className="size-4" />Tasks {tasks.ok && <span className="text-micro">{active.length} open</span>}</TabsTrigger>
          <TabsTrigger value="notes" className="h-auto min-h-tap gap-2 px-3 py-2 text-console-body whitespace-normal"><NotebookPenIcon aria-hidden="true" className="size-4" />Handover {notes.ok && <span className="text-micro">{waiting.length} waiting</span>}</TabsTrigger>
        </TabsList>
        <div className="flex max-w-full flex-wrap gap-2">
          {tab === "tasks" && <CreateTaskDialog staff={staff} currentStaffId={currentStaffId} />}
          {tab === "notes" && canWriteNotes && <Dialog open={noteOpen} onOpenChange={(next) => { if (!notePending) setNoteOpen(next); }}>
            <DialogTrigger asChild><Button type="button" className="min-h-tap"><PlusIcon aria-hidden="true" className="size-4" />Leave a note</Button></DialogTrigger>
            <DialogContent pending={notePending} className="max-h-dialog-max-h overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>Leave a handover note</DialogTitle><DialogDescription>For the next shift.</DialogDescription></DialogHeader>
              <ShiftNoteForm onPendingChange={setNotePending} shiftOn={today} onSaved={() => setNoteOpen(false)} />
            </DialogContent>
          </Dialog>}
        </div>
      </div>
      <div className="relative min-w-0">
        <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" />
        <Input aria-label="Search tasks and notes" placeholder="Search tasks, notes or a staff name" value={query} onChange={(event) => setQuery(event.target.value)} className="h-tap bg-surface-raised pl-10 text-console-body" />
      </div>
      <TabsContent value="tasks" className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Filter label="Task status" value={taskFilter} onChange={setTaskFilter} options={[["open", "Open tasks"], ["done", "Completed & cancelled"], ["all", "All tasks"]]} />
          <Filter label="Assigned to" value={owner} onChange={setOwner} options={[["all", "Everyone"], ["mine", "Assigned to me"], ["unassigned", "Unassigned"]]} />
          {tasks.ok && <p role="status" className="text-micro text-text-muted">{visibleTasks.length} {visibleTasks.length === 1 ? "task" : "tasks"}</p>}
        </div>
        {tasks.ok ? <TaskList tasks={visibleTasks} staff={staff} actionable today={today} onSelect={(task) => setSelected({ kind: "task", id: task.id })} emptyMessage="No tasks match these filters. Choose All tasks to see completed work, or create a new task." /> : <ConsoleReadError title="Tasks could not be loaded" message={tasks.message} remedy="Reload the page to try again." />}
      </TabsContent>
      <TabsContent value="notes" className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Filter label="Handover status" value={noteFilter} onChange={setNoteFilter} options={[["waiting", "Waiting for handover"], ["done", "Handed over"], ["all", "All notes"]]} />
          {notes.ok && <p role="status" className="text-micro text-text-muted">{visibleNotes.length} {visibleNotes.length === 1 ? "note" : "notes"}</p>}
        </div>
        {notes.ok ? <ShiftNoteList notes={visibleNotes} onSelect={(note) => setSelected({ kind: "note", id: note.id })} /> : <ConsoleReadError title="Handover notes could not be loaded" message={notes.message} remedy="Reload the page to try again." />}
      </TabsContent>
    </Tabs>
    {(selectedTask || selectedNote) && <WorkDetailDialog key={selected!.id} task={selectedTask} note={selectedNote} staff={staff} onClose={() => setSelected(null)} />}
  </>;
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="h-tap! w-full bg-surface-raised sm:w-56"><SelectValue /></SelectTrigger><SelectContent>{options.map(([key, text]) => <SelectItem key={key} value={key} className="min-h-tap">{text}</SelectItem>)}</SelectContent></Select>;
}
