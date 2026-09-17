import type { StatusChipTone } from "@/components/console/shared/status-chip";
import type {
  MessageAudience,
  MessageDocumentGroup,
  SystemMessageKey,
} from "@/lib/config/message-documents";

export type MessageStatus = "published" | "draft" | "not_written" | "built_in";

export interface MessageListItem {
  readonly key: SystemMessageKey;
  readonly label: string;
  readonly group: MessageDocumentGroup;
  readonly audience: MessageAudience;
  readonly connected: boolean;
  readonly subject: string;
  readonly status: MessageStatus;
  readonly updatedAt: string | null;
  readonly editHref: string;
}

export const MESSAGE_STATUS_LABEL: Readonly<Record<MessageStatus, string>> = {
  published: "Published",
  built_in: "Built-in",
  draft: "Draft",
  not_written: "Needs wording",
};

export const MESSAGE_STATUS_TONE: Readonly<
  Record<MessageStatus, StatusChipTone>
> = {
  published: "success",
  built_in: "neutral",
  draft: "warning",
  not_written: "neutral",
};

export const MESSAGE_AUDIENCE_LABEL: Readonly<Record<MessageAudience, string>> =
  {
    guest: "To the guest",
    staff: "To the team",
  };

export function countByStatus(
  items: readonly MessageListItem[],
  status: MessageStatus,
): number {
  return items.filter((item) => item.status === status).length;
}

export function countDisconnected(items: readonly MessageListItem[]): number {
  return items.filter((item) => !item.connected).length;
}

export function matchingMessages(
  items: readonly MessageListItem[],
  search: string,
  group: string | null,
  groupLabel: (group: MessageDocumentGroup) => string,
): readonly MessageListItem[] {
  const needle = search.trim().toLowerCase();

  return items.filter((item) => {
    if (group !== null && item.group !== group) return false;
    if (needle.length === 0) return true;

    return [item.label, item.subject, groupLabel(item.group)]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
}
