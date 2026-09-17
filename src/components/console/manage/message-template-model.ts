import { MESSAGE_TEMPLATE_COPY, MESSAGE_TIME_UNITS } from "@/lib/config/message-templates";
import {
  BOOKING_TEMPLATE_KEYS,
  TEMPLATE_KIND,
  type BookingTemplateKey,
  type MessageKind,
} from "@/lib/domain/messaging";
import type { MessageChannel, MessageTemplateRow } from "@/lib/db/queries/operations";

export interface MessageTemplateView {
  readonly key: BookingTemplateKey;
  readonly label: string;
  readonly purpose: string;
  readonly help: string;
  readonly event: string;
  readonly group: "booking" | "payments" | "visit";
  readonly kind: MessageKind;
  readonly isWritten: boolean;
  readonly channel: MessageChannel | null;
  readonly isActive: boolean | null;
  readonly subject: string | null;
  readonly body: string;
  readonly timingMinutes: number | null;
}

export function buildMessageTemplateViews(
  rows: readonly MessageTemplateRow[],
): readonly MessageTemplateView[] {
  const byKey = new Map(rows.map((row) => [row.key, row]));

  return BOOKING_TEMPLATE_KEYS.map((key) => {
    const row = byKey.get(key);

    return {
      key,
      ...MESSAGE_TEMPLATE_COPY[key],
      kind: TEMPLATE_KIND[key],
      isWritten: row !== undefined && row.body.trim().length > 0,
      channel: row?.channel ?? null,
      isActive: row?.isActive ?? null,
      subject: row?.subject ?? null,
      body: row?.body ?? "",
      timingMinutes: row?.timingMinutes ?? null,
    };
  });
}

export function matchesTemplateSearch(
  view: MessageTemplateView,
  term: string,
): boolean {
  if (term.length === 0) return true;
  const needle = term.toLowerCase();
  return (
    view.key.toLowerCase().includes(needle) ||
    view.label.toLowerCase().includes(needle) ||
    [view.purpose, view.help, view.subject ?? "", view.body, view.channel ?? ""].some((text) => text.toLowerCase().includes(needle))
  );
}

export function describeTiming(minutes: number | null): string {
  if (minutes === null || minutes === 0) return "At the event";

  const absolute = Math.abs(minutes);
  const days = Math.floor(absolute / MESSAGE_TIME_UNITS.days);
  const hours = Math.floor((absolute % MESSAGE_TIME_UNITS.days) / MESSAGE_TIME_UNITS.hours);
  const rest = absolute % MESSAGE_TIME_UNITS.hours;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (rest > 0) parts.push(`${rest} ${rest === 1 ? "minute" : "minutes"}`);

  const span = parts.join(" ");
  return minutes < 0 ? `${span} before` : `${span} after`;
}
