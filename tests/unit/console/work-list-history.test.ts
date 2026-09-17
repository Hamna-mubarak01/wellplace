import { describe, expect, it, vi } from "vitest";
import { listShiftNotes, listTasks } from "@/lib/db/queries/operations";
import { WORK_LIST_PAGE_SIZE } from "@/lib/config/work-items";
import type { WellPlaceClient } from "@/lib/db/types";

function clientFor(pages: { data: unknown[] | null; error: { message: string } | null }[]) {
  const range = vi.fn();
  for (const page of pages) range.mockResolvedValueOnce(page);
  const builder = { select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), range };
  return { client: { from: vi.fn().mockReturnValue(builder) } as unknown as WellPlaceClient, builder };
}

describe("work history listings", () => {
  it("keeps completed tasks beyond the first database page", async () => {
    const row = { task_id: "task", title: "Done task", status: "done", priority: "normal", completed_by_name: "Receiver", created_at: "2026-09-08T10:00:00Z" };
    const { client, builder } = clientFor([{ data: Array.from({ length: WORK_LIST_PAGE_SIZE }, (_, i) => ({ ...row, task_id: String(i) })), error: null }, { data: [{ ...row, task_id: "last" }], error: null }]);
    const result = await listTasks(client, { includeDone: true });
    expect(result.ok && result.tasks).toHaveLength(WORK_LIST_PAGE_SIZE + 1);
    expect(builder.in).not.toHaveBeenCalled();
    expect(result.ok && result.tasks.at(-1)?.completedByName).toBe("Receiver");
  });

  it("keeps older handed-over notes beyond the first database page", async () => {
    const row = { shift_note_id: "note", shift_on: "2026-09-08", body: "Read at handover", created_at: "2026-09-08T10:00:00Z", handed_over_at: "2026-09-08T11:00:00Z" };
    const { client } = clientFor([{ data: Array.from({ length: WORK_LIST_PAGE_SIZE }, () => row), error: null }, { data: [row], error: null }]);
    const result = await listShiftNotes(client);
    expect(result.ok && result.notes).toHaveLength(WORK_LIST_PAGE_SIZE + 1);
  });

  it("reports a later-page failure instead of presenting a partial task history", async () => {
    const { client } = clientFor([{ data: Array.from({ length: WORK_LIST_PAGE_SIZE }, () => ({ task_id: "task", title: "Task", priority: "normal", status: "done" })), error: null }, { data: null, error: { message: "Request failed" } }]);
    expect(await listTasks(client, { includeDone: true })).toEqual({ ok: false, message: "Request failed" });
  });
});
