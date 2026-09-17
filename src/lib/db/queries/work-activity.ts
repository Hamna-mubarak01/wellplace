import type { WellPlaceClient } from "@/lib/db/types";

export interface WorkActivity {
  id: number;
  action: string;
  occurredAt: string;
  actorName: string | null;
  status: string | null;
  assigneeName: string | null;
}

export type WorkActivityResult =
  | { ok: true; events: WorkActivity[] }
  | { ok: false; message: string };

export async function readWorkActivity(
  client: WellPlaceClient,
  kind: "task" | "note",
  id: string,
): Promise<WorkActivityResult> {
  const { data, error } = await client.rpc("work_item_activity", { p_kind: kind, p_id: id });
  if (error) {
    console.error("[db] work activity could not be loaded:", error.message);
    return { ok: false, message: "The activity history could not be loaded. Try again. Your task or note is still saved." };
  }
  return { ok: true, events: data.map((event) => ({
    id: event.event_id, action: event.action, occurredAt: event.occurred_at,
    actorName: event.actor_name, status: event.status, assigneeName: event.assignee_name,
  })) };
}
