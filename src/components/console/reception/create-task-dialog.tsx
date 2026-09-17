"use client";

import { useReceptionValidation } from "@/components/console/reception/reception-validation";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/console/feedback";

import type { BookingActionResult } from "@/app/(console)/reception/actions";
import { useWorkActions } from "@/components/console/reception/work-actions-context";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL as PRIORITY_LABEL,
} from "@/lib/config/reception";
import { NETWORK_MESSAGE } from "@/lib/console/run-action";
import {
  TASK_NOTE_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
} from "@/lib/config/console-limits";
import type { Database } from "@/types/database.generated";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/console/reception/reception-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/console/reception/reception-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/select";
import { Textarea } from "@/components/console/reception/reception-input";
import {
  CharacterCounter,
  showsCharacterCounter,
} from "@/components/shared/character-counter";
import { HINT_CLASS } from "@/components/console/reception/walk-in-form";
import type { StaffOption } from "@/components/console/reception/staff-assign-menu";
import { HoursDateField } from "@/components/console/manage/hours-date-field";

type Priority = Database["public"]["Enums"]["task_priority"];

const NOBODY = "nobody" as const;

export interface CreateTaskDialogProps {
  staff: readonly StaffOption[];
  currentStaffId: string;
}

export function CreateTaskDialog({ staff, currentStaffId }: CreateTaskDialogProps) {
  const { createTask } = useWorkActions();
  const router = useRouter();
  const { reject } = useReceptionValidation();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [assignee, setAssignee] = useState<string>(currentStaffId);

  const submit = () => {
    if (pending) return;
    if (title.trim().length === 0) {
      reject("task-title", "Enter a task title.");
      return;
    }

    start(async () => {
      let result: BookingActionResult;

      try {
        result = await createTask({
          title,
          note,
          assignedTo: assignee === NOBODY ? null : assignee,
          dueOn: dueOn.length > 0 ? dueOn : null,
          priority,
        });
      } catch (cause) {
        console.error("[console] createTask threw:", cause);
        result = { ok: false, message: NETWORK_MESSAGE };
      }

      if (result.ok) {
        toast.success("Task created");
        setOpen(false);
        setTitle("");
        setNote("");
        setDueOn("");
        setPriority("normal");
        setAssignee(currentStaffId);

        router.refresh();
        return;
      }

      toast.error("The task was not created", { description: result.message });
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
      <DialogTrigger asChild>
        <Button type="button" className="min-h-tap">
          New task
        </Button>
      </DialogTrigger>

      <DialogContent pending={pending} className="flex max-h-dialog-max-h min-h-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border p-5 pr-12 text-left">
          <DialogTitle>Create a task</DialogTitle>
          <DialogDescription className="sr-only">Task details.</DialogDescription>
        </DialogHeader>



        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5">
        <Field>
          <FieldLabel htmlFor="task-title">What needs to be done?</FieldLabel>
          <Input
            id="task-title"
          required
            value={title}
            maxLength={TASK_TITLE_MAX_LENGTH}
            onChange={(event) => {
              setTitle(event.target.value.slice(0, TASK_TITLE_MAX_LENGTH));

            }}
            disabled={pending}
            aria-describedby={
              showsCharacterCounter(title, TASK_TITLE_MAX_LENGTH)
                ? "task-title-remaining"
                : "task-title-hint"
            }
            className="h-tap text-console-body"
          />
          <p id="task-title-hint" className={HINT_CLASS}>
            Up to {TASK_TITLE_MAX_LENGTH} characters.
          </p>
          <CharacterCounter
            id="task-title-remaining"
            value={title}
            maxLength={TASK_TITLE_MAX_LENGTH}
          />

        </Field>

        <Field>
          <FieldLabel htmlFor="task-note">Extra details (optional)</FieldLabel>
          <Textarea
            id="task-note"
            value={note}
            maxLength={TASK_NOTE_MAX_LENGTH}
            onChange={(event) =>
              setNote(event.target.value.slice(0, TASK_NOTE_MAX_LENGTH))
            }
            rows={3}
            disabled={pending}
            aria-describedby={
              showsCharacterCounter(note, TASK_NOTE_MAX_LENGTH)
                ? "task-note-remaining"
                : "task-note-hint"
            }
            className="text-console-body"
          />
          <p id="task-note-hint" className={HINT_CLASS}>
            Up to {TASK_NOTE_MAX_LENGTH} characters.
          </p>
          <CharacterCounter
            id="task-note-remaining"
            value={note}
            maxLength={TASK_NOTE_MAX_LENGTH}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><HoursDateField label="Due date (optional)" value={dueOn} onChange={setDueOn} disabled={pending} />
            {dueOn && <Button variant="ghost" size="sm" disabled={pending} onClick={() => setDueOn("")}>Remove date</Button>}
          </div>

          <Field>
            <FieldLabel htmlFor="task-priority">Priority</FieldLabel>
            <Select
              value={priority}
              onValueChange={(value) => setPriority(value as Priority)}
              disabled={pending}
            >
              <SelectTrigger id="task-priority" className="h-tap! w-full text-console-body">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_PRIORITIES.map((value) => (
                  <SelectItem key={value} value={value} className="min-h-tap">
                    {PRIORITY_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="task-assignee">Assigned to</FieldLabel>
          <Select
            value={assignee}
            onValueChange={setAssignee}
            disabled={pending}
          >
            <SelectTrigger id="task-assignee" className="h-tap! w-full text-console-body">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {staff.map((member) => (
                <SelectItem key={member.id} value={member.id} className="min-h-tap">
                  {member.id === currentStaffId ? "Me" : member.fullName}
                </SelectItem>
              ))}
              <SelectItem value={NOBODY} className="min-h-tap">Unassigned</SelectItem>
            </SelectContent>
          </Select>
          <p className={HINT_CLASS}>
            You can change the assignee later while the task is open.
          </p>
        </Field>
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 border-t border-border bg-surface-raised p-4">
          <Button
            hoverEffect="sweep"
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "Creating…" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
