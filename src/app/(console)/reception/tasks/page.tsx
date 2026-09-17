import { ConsoleReadError } from "@/components/shared/console-read-error";
import type { Metadata } from "next";
import { requireReception } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { listShiftNotes, listTasks } from "@/lib/db/queries/operations";
import { listStaff } from "@/lib/db/queries/staff";
import { todayInDubai } from "@/lib/domain/time";
import { ConsolePage } from "@/components/console/console-page";
import { TasksWorkspace } from "@/components/console/reception/tasks-workspace";

export const metadata: Metadata = {
  title: "Tasks and handover",
  robots: { index: false, follow: false },
};

export default async function TasksPage() {
  const session = await requireReception();
  const supabase = await createClient();
  const [tasks, staff, notes] = await Promise.all([
    listTasks(supabase, { includeDone: true }),
    listStaff(supabase),
    listShiftNotes(supabase),
  ]);
  if (!staff.ok) return <ConsolePage title="Tasks and handover"><ConsoleReadError title="Staff records could not be loaded" message={staff.message} /></ConsolePage>;
  const assignable = staff.items.filter((member) => member.isActive)
    .map((member) => ({ id: member.id, fullName: member.fullName }));
  return <ConsolePage title="Tasks and handover" className="min-w-0">
    <TasksWorkspace tasks={tasks} notes={notes} staff={assignable} currentStaffId={session.userId} today={todayInDubai()} />
  </ConsolePage>;
}
