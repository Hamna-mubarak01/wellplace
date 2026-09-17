import { WORK_LIST_PAGE_SIZE } from "@/lib/config/work-items";
import type { WellPlaceClient } from "@/lib/db/types";
import type { Database } from "@/types/database.generated";

export type AlertKind = Database["public"]["Enums"]["alert_kind"];
export type AlertSeverity = Database["public"]["Enums"]["alert_severity"];
export type CleaningStatus = Database["public"]["Enums"]["cleaning_status"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type TaskPriority = Database["public"]["Enums"]["task_priority"];

export interface AlertRow {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  entity: string;
  entityId: string;
  openedAt: string;
  resolvedAt: string | null;
  detail: unknown;
  bookingId: string | null;
  bookingReference: string | null;
}

export type AlertListing =
  | { ok: true; alerts: AlertRow[] }
  | { ok: false; message: string };

export async function listOpenAlerts(
  client: WellPlaceClient,
): Promise<AlertListing> {
  const { data, error } = await client
    .from("open_alerts")
    .select(
      "alert_id, kind, severity, entity, entity_id, opened_at, detail, booking_id, booking_reference",
    )
    .order("opened_at", { ascending: false });

  if (error) {
    return { ok: false, message: error.message };
  }

  const rows: AlertRow[] = [];

  for (const row of data ?? []) {
    if (
      row.alert_id === null ||
      row.kind === null ||
      row.severity === null ||
      row.entity === null ||
      row.entity_id === null ||
      row.opened_at === null
    ) {
      continue;
    }

    rows.push({
      id: row.alert_id,
      kind: row.kind,
      severity: row.severity,
      entity: row.entity,
      entityId: row.entity_id,
      openedAt: row.opened_at,
      resolvedAt: null,
      detail: row.detail,
      bookingId: row.booking_id,
      bookingReference: row.booking_reference,
    });
  }

  return { ok: true, alerts: rows };
}

export interface CleaningRow {
  id: string;
  suiteId: string;
  suiteNumber: number | null;
  bookingId: string | null;
  status: CleaningStatus;
  dueFrom: string;
  startedAt: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  confirmedAt: string | null;
  note: string | null;
}

export type CleaningListing =
  | { ok: true; tasks: CleaningRow[] }
  | { ok: false; message: string };

export async function listCleaningTasks(
  client: WellPlaceClient,
  window: { from: string; to: string },
): Promise<CleaningListing> {
  const { data, error } = await client
    .from("cleaning_board")
    .select(
      "cleaning_task_id, suite_id, suite_number, booking_id, status, due_from, started_at, assigned_to, assigned_to_name, confirmed_at, note",
    )
    .gte("due_from", window.from)
    .lt("due_from", window.to)
    .order("due_from", { ascending: true });

  if (error) {
    return { ok: false, message: error.message };
  }

  const rows: CleaningRow[] = [];

  for (const row of data ?? []) {
    if (
      row.cleaning_task_id === null ||
      row.suite_id === null ||
      row.status === null ||
      row.due_from === null
    ) {
      continue;
    }

    rows.push({
      id: row.cleaning_task_id,
      suiteId: row.suite_id,
      suiteNumber: row.suite_number,
      bookingId: row.booking_id,
      status: row.status,
      dueFrom: row.due_from,
      startedAt: row.started_at,
      assignedTo: row.assigned_to,
      assignedToName: row.assigned_to_name,
      confirmedAt: row.confirmed_at,
      note: row.note,
    });
  }

  return { ok: true, tasks: rows };
}

export interface TaskRow {
  id: string;
  title: string;
  note: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  dueOn: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  completedAt: string | null;
  completedByName: string | null;
  createdAt: string | null;
}

export type TaskListing =
  | { ok: true; tasks: TaskRow[] }
  | { ok: false; message: string };

export async function listTasks(
  client: WellPlaceClient,
  options: { assignedTo?: string; includeDone?: boolean } = {},
): Promise<TaskListing> {
  let builder = client
    .from("staff_tasks")
    .select(
      "task_id, title, note, assigned_to, assigned_to_name, due_on, priority, status, completed_at, completed_by_name, created_at",
    )
    .order("due_on", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("task_id", { ascending: false });

  if (options.assignedTo) builder = builder.eq("assigned_to", options.assignedTo);
  if (!options.includeDone) builder = builder.in("status", ["open", "in_progress"]);

  const rows: TaskRow[] = [];
  for (let offset = 0; ; offset += WORK_LIST_PAGE_SIZE) {
  const { data, error } = await builder.range(offset, offset + WORK_LIST_PAGE_SIZE - 1);

  if (error) {
    return { ok: false, message: error.message };
  }

  for (const row of data ?? []) {
    if (
      row.task_id === null ||
      row.title === null ||
      row.priority === null ||
      row.status === null
    ) {
      continue;
    }

    rows.push({
      id: row.task_id,
      title: row.title,
      note: row.note,
      assignedTo: row.assigned_to,
      assignedToName: row.assigned_to_name,
      dueOn: row.due_on,
      priority: row.priority,
      status: row.status,
      completedAt: row.completed_at,
      completedByName: row.completed_by_name,
      createdAt: row.created_at,
    });
  }

    if ((data?.length ?? 0) < WORK_LIST_PAGE_SIZE) break;
  }

  return { ok: true, tasks: rows };
}

export interface ShiftNoteRow {
  id: string;
  authorId: string | null;
  authorName: string | null;
  shiftOn: string;
  body: string;
  handedOverAt: string | null;
  createdAt: string;
}

export type ShiftNoteListing =
  | { ok: true; notes: ShiftNoteRow[] }
  | { ok: false; message: string };

export async function listShiftNotes(
  client: WellPlaceClient,
  options: { limit?: number; pendingOnly?: boolean } = {},
): Promise<ShiftNoteListing> {
  const rows: ShiftNoteRow[] = [];
  for (let offset = 0; options.limit === undefined || offset < options.limit; offset += WORK_LIST_PAGE_SIZE) {
    const take = options.limit === undefined ? WORK_LIST_PAGE_SIZE : Math.min(WORK_LIST_PAGE_SIZE, options.limit - offset);
  let query = client
    .from("shift_handover")
    .select("shift_note_id, author_id, author_name, shift_on, body, handed_over_at, created_at")
    .order("shift_on", { ascending: false })
    .order("created_at", { ascending: false })
    .order("shift_note_id", { ascending: false })
    .range(offset, offset + take - 1);
  if (options.pendingOnly) query = query.is("handed_over_at", null);
  const { data, error } = await query;

  if (error) {
    return { ok: false, message: error.message };
  }

  for (const row of data ?? []) {
    if (
      row.shift_note_id === null ||
      row.shift_on === null ||
      row.body === null ||
      row.created_at === null
    ) {
      continue;
    }

    rows.push({
      id: row.shift_note_id,
      authorId: row.author_id,
      authorName: row.author_name,
      shiftOn: row.shift_on,
      body: row.body,
      handedOverAt: row.handed_over_at,
      createdAt: row.created_at,
    });
  }

    if ((data?.length ?? 0) < take) break;
  }

  return { ok: true, notes: rows };
}

export type MessageChannel = Database["public"]["Enums"]["message_channel"];
export type MessageStatus = Database["public"]["Enums"]["message_status"];

export interface MessageTemplateRow {
  key: string;
  channel: MessageChannel;
  isActive: boolean;
  isMarketing: boolean;
  subject: string | null;
  body: string;
  timingMinutes: number | null;
}

export type MessageTemplateListing =
  | { ok: true; templates: MessageTemplateRow[] }
  | { ok: false; message: string };

export async function listMessageTemplates(
  client: WellPlaceClient,
): Promise<MessageTemplateListing> {
  const { data, error } = await client
    .from("message_templates")
    .select("key, channel, is_active, is_marketing, subject, body, timing_minutes")
    .order("key", { ascending: true });

  if (error) {
    return { ok: false, message: error.message };
  }

  return {
    ok: true,
    templates: (data ?? []).map((row) => ({
      key: row.key,
      channel: row.channel,
      isActive: row.is_active,
      isMarketing: row.is_marketing,
      subject: row.subject,
      body: row.body ?? "",
      timingMinutes: row.timing_minutes,
    })),
  };
}

export interface MessageRow {
  id: string;
  templateKey: string;
  channel: MessageChannel;
  status: MessageStatus;
  toAddress: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  failedAt: string | null;
  sentAt: string | null;
  error: string | null;
  createdAt: string;
}

export type MessageListing =
  | { ok: true; messages: MessageRow[] }
  | { ok: false; message: string };

export async function listBookingMessages(
  client: WellPlaceClient,
  bookingId: string,
): Promise<MessageListing> {
  const { data, error } = await client
    .from("booking_messages")
    .select(
      "message_id, template_key, channel, status, to_address, attempt_count, last_attempt_at, failed_at, sent_at, error, created_at",
    )
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false, message: error.message };
  }

  const rows: MessageRow[] = [];

  for (const row of data ?? []) {
    if (
      row.message_id === null ||
      row.template_key === null ||
      row.channel === null ||
      row.status === null ||
      row.to_address === null ||
      row.created_at === null
    ) {
      continue;
    }

    rows.push({
      id: row.message_id,
      templateKey: row.template_key,
      channel: row.channel,
      status: row.status,
      toAddress: row.to_address,
      attemptCount: row.attempt_count ?? 0,
      lastAttemptAt: row.last_attempt_at,
      failedAt: row.failed_at,
      sentAt: row.sent_at,
      error: row.error,
      createdAt: row.created_at,
    });
  }

  return { ok: true, messages: rows };
}
