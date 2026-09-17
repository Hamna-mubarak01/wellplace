import { MailIcon } from "lucide-react";

import { ConsoleDataTable, type ConsoleColumn } from "@/components/console/shared/console-data-table";
import { StatusChip, type StatusChipTone } from "@/components/console/shared/status-chip";
import type { MessageListing, MessageRow, MessageStatus } from "@/lib/db/queries/operations";
import { formatDubaiDateTime } from "@/lib/domain/time";

export interface BookingMessagesSectionProps {
  messages: MessageListing;
}

const STATUS_LABEL: Readonly<Record<MessageStatus, string>> = {
  queued: "Queued",
  sent: "Sent",
  failed: "Failed",
  cancelled: "Cancelled",
};

const STATUS_TONE: Readonly<Record<MessageStatus, StatusChipTone>> = {
  queued: "info",
  sent: "success",
  failed: "danger",
  cancelled: "neutral",
};

function messageName(templateKey: string): string {
  const words = templateKey.replaceAll("_", " ").trim();
  return words.length === 0 ? "Message" : `${words[0].toUpperCase()}${words.slice(1)}`;
}

function channelName(channel: string): string {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "email") return "Email";
  if (channel === "sms") return "SMS";
  return channel;
}

const COLUMNS: readonly ConsoleColumn<MessageRow>[] = [
  {
    id: "message",
    header: "Message",
    wrap: true,
    cell: (message) => (
      <>
        <span className="block">{messageName(message.templateKey)}</span>
        {message.error && <span className="block text-micro text-danger-ink">{message.error}</span>}
      </>
    ),
  },
  {
    id: "channel",
    header: "Channel",
    cell: (message) => channelName(message.channel),
  },
  {
    id: "to",
    header: "Sent to",
    wrap: true,
    cell: (message) => <span className="font-data text-micro break-all tabular-nums">{message.toAddress}</span>,
  },
  {
    id: "created",
    header: "Created",
    cell: (message) => <span className="whitespace-nowrap">{formatDubaiDateTime(message.createdAt)}</span>,
  },
  {
    id: "attempts",
    header: "Attempts",
    align: "end",
    cell: (message) => <span className="font-data tabular-nums">{message.attemptCount}</span>,
  },
  {
    id: "status",
    header: "Status",
    cell: (message) => <StatusChip tone={STATUS_TONE[message.status]}>{STATUS_LABEL[message.status]}</StatusChip>,
  },
];

export function BookingMessagesSection({ messages }: BookingMessagesSectionProps) {
  return (
    <ConsoleDataTable
      label="Messages for this booking"
      columns={COLUMNS}
      rows={messages.ok ? messages.messages : []}
      rowKey={(message) => message.id}
      error={
        messages.ok
          ? null
          : {
              title: "The message log could not be loaded",
              message: "The messages for this booking could not be listed. This says nothing about whether the guest was contacted.",
            }
      }
      empty={{
        title: "No messages yet",
        description: "Confirmations and reminders sent for this booking appear here.",
        Icon: MailIcon,
      }}
    />
  );
}
