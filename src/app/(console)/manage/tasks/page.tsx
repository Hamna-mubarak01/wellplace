import type { Metadata } from "next";
import { AlarmClockIcon, CalendarCheckIcon, ListChecksIcon, NotebookPenIcon } from "lucide-react";

import { ConsolePage } from "@/components/console/console-page";
import { ManageTasksWorkspace } from "@/components/console/manage/tasks/manage-tasks-workspace";
import { StatCard } from "@/components/console/shared/stat-card";
import { StatGrid } from "@/components/console/shared/stat-grid";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import { requireManagement } from "@/lib/auth/session";
import { listShiftNotes, listTasks } from "@/lib/db/queries/operations";
import { listStaff } from "@/lib/db/queries/staff";
import { createClient } from "@/lib/db/server";
import { todayInDubai } from "@/lib/domain/time";

export const metadata: Metadata = {
  title: "Tasks",
  robots: { index: false, follow: false },
};

export default async function ManageTasksPage() {
  const session = await requireManagement();
  const supabase = await createClient();
  const [tasks, staff, notes] = await Promise.all([
    listTasks(supabase, { includeDone: true }),
    listStaff(supabase),
    listShiftNotes(supabase),
  ]);

  if (!staff.ok) {
    return (
      <ConsolePage title="Tasks">
        <ConsoleReadError title="Staff records could not be loaded" message={staff.message} />
      </ConsolePage>
    );
  }

  const today = todayInDubai();
  const assignable = staff.items
    .filter((member) => member.isActive)
    .map((member) => ({ id: member.id, fullName: member.fullName }));
  const open = tasks.ok ? tasks.tasks.filter((task) => task.status === "open" || task.status === "in_progress") : [];
  const overdue = open.filter((task) => task.dueOn !== null && task.dueOn < today);
  const dueToday = open.filter((task) => task.dueOn === today);
  const unassigned = open.filter((task) => task.assignedTo === null);
  const waitingNotes = notes.ok ? notes.notes.filter((note) => !note.handedOverAt).length : 0;

  return (
    <ConsolePage title="Tasks" className="min-w-0">
      {tasks.ok && (
        <StatGrid columns={4} label="Task summary">
          <StatCard label="Open tasks" value={open.length} sub={`${unassigned.length} unassigned`} Icon={ListChecksIcon} />
          <StatCard
            label="Overdue"
            value={overdue.length}
            sub="Past their due date"
            tone={overdue.length > 0 ? "danger" : "neutral"}
            Icon={AlarmClockIcon}
          />
          <StatCard
            label="Due today"
            value={dueToday.length}
            sub="Still to finish today"
            tone={dueToday.length > 0 ? "warning" : "neutral"}
            Icon={CalendarCheckIcon}
          />
          <StatCard label="Handover notes" value={waitingNotes} sub="Waiting for handover at Reception" Icon={NotebookPenIcon} />
        </StatGrid>
      )}
      <ManageTasksWorkspace
        tasks={tasks}
        notes={notes}
        staff={assignable}
        currentStaffId={session.userId}
        today={today}
      />
    </ConsolePage>
  );
}
