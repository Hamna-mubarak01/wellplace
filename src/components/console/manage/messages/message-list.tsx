"use client";

import type { ReactNode } from "react";
import { MailIcon, PlugZapIcon } from "lucide-react";

import {
  ConsoleDataTable,
  type ConsoleColumn,
} from "@/components/console/shared/console-data-table";
import { MessageFilters } from "@/components/console/manage/messages/message-filters";
import { FilterBarSkeleton } from "@/components/console/shared/filter-bar-skeleton";
import { StatCard } from "@/components/console/shared/stat-card";
import { StatGrid } from "@/components/console/shared/stat-grid";
import { StatGridSkeleton } from "@/components/console/shared/stat-grid-skeleton";
import { StatusChip } from "@/components/console/shared/status-chip";
import { ConsoleReadError } from "@/components/shared/console-read-error";
import { MessageCard } from "@/components/console/manage/messages/message-card";
import { MessageRowActions } from "@/components/console/manage/messages/message-row-actions";
import {
  MESSAGE_STATUS_LABEL,
  MESSAGE_STATUS_TONE,
  countByStatus,
  countDisconnected,
  matchingMessages,
  type MessageListItem,
} from "@/components/console/manage/messages/message-list-model";
import { MESSAGE_GROUP_LABEL } from "@/components/console/manage/messages/message-document-model";
import {
  MessageViewToggle,
  type MessageListView,
} from "@/components/console/manage/messages/message-view-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { type SystemMessageKey } from "@/lib/config/message-documents";
import { formatDubaiDateTime } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

export interface MessageListProps {
  items: readonly MessageListItem[];
  search: string;
  group: string | null;
  view: MessageListView;
  actions?: ReactNode;
  loading?: boolean;
  error?: string | null;
  onViewChange: (view: MessageListView) => void;
  onPreview: (key: SystemMessageKey) => void;
  onReset?: (key: SystemMessageKey) => void;
  className?: string;
}

export function MessageList({
  items,
  search,
  group,
  view,
  actions,
  loading = false,
  error = null,
  onViewChange,
  onPreview,
  onReset,
  className,
}: MessageListProps) {
  const columns: readonly ConsoleColumn<MessageListItem>[] = [
    {
      id: "label",
      header: "Name",
      cell: (item) => item.label,
      className: "max-w-col-name",
    },
    {
      id: "subject",
      header: "Subject",
      wrap: true,
      cell: (item) => (
        <span className="text-text-secondary">
          {item.subject.trim().length > 0 ? item.subject : "No subject yet"}
        </span>
      ),
    },
    {
      id: "group",
      header: "Category",
      cell: (item) => (
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone="neutral">
            {MESSAGE_GROUP_LABEL[item.group]}
          </StatusChip>
          <StatusChip tone={MESSAGE_STATUS_TONE[item.status]}>
            {MESSAGE_STATUS_LABEL[item.status]}
          </StatusChip>
        </div>
      ),
    },
    {
      id: "updatedAt",
      header: "Last updated",
      cell: (item) => (
        <span className="text-text-secondary">
          {item.updatedAt === null
            ? "Never"
            : formatDubaiDateTime(item.updatedAt)}
        </span>
      ),
    },
  ];

  const filtering = search.trim().length > 0 || group !== null;

  const visible = matchingMessages(
    items,
    search,
    group,
    (entry) => MESSAGE_GROUP_LABEL[entry],
  );

  const empty = {
    title: filtering ? "No template matches this search" : "No templates yet",
    description: filtering
      ? "Try a different word, or clear the filters to see every template."
      : "Every WellPlace email will appear here once it is set up.",
    Icon: MailIcon,
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius-card) border border-border bg-surface-raised px-4 py-3">
        <p className="text-console-body text-text-secondary">
          Create and manage the messages your guests and team receive.
        </p>
        {actions}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {loading ? (
          <StatGridSkeleton cards={4} />
        ) : (
          <StatGrid columns={4} label="Message templates at a glance">
            <StatCard label="Templates" value={items.length} Icon={MailIcon} />
            <StatCard
              label="Ready to use"
              value={
                countByStatus(items, "published") +
                countByStatus(items, "built_in")
              }
              tone="success"
            />
            <StatCard
              label="Drafts"
              value={countByStatus(items, "draft")}
              tone="warning"
            />
            <StatCard
              label="Not sending yet"
              value={countDisconnected(items)}
              tone="info"
              Icon={PlugZapIcon}
              sub="Delivery is not connected yet"
            />
          </StatGrid>
        )}
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        {loading ? (
          <FilterBarSkeleton controls={1} />
        ) : (
          <MessageFilters
            search={search}
            group={group}
            resultsLabel={`${visible.length} of ${items.length} templates`}
            actions={
              <MessageViewToggle view={view} onViewChange={onViewChange} />
            }
          />
        )}

        {loading && (
          <MessageViewToggle view={view} onViewChange={onViewChange} />
        )}
      </div>

      {view === "list" ? (
        <ConsoleDataTable
          label="Message templates"
          columns={columns}
          rows={visible}
          rowKey={(item) => item.key}
          rowHref={(item) => item.editHref}
          rowLabel={(item) => `Edit ${item.label}`}
          actions={(item) => (
            <MessageRowActions
              item={item}
              onPreview={onPreview}
              onReset={onReset}
            />
          )}
          empty={empty}
          error={
            error === null
              ? null
              : { title: "Templates could not be loaded", message: error }
          }
          loading={loading}
        />
      ) : error !== null ? (
        <ConsoleReadError
          title="Templates could not be loaded"
          message={error}
        />
      ) : loading ? (
        <div
          aria-busy="true"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {[0, 1, 2, 3, 4, 5].map((position) => (
            <Skeleton
              key={position}
              className="h-console-panel w-full rounded-(--radius-card)"
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div
          role="status"
          className="flex flex-col items-center gap-2 rounded-(--radius-card) border border-border bg-surface-raised px-4 py-10 text-center"
        >
          <MailIcon aria-hidden="true" className="size-5 text-text-muted" />
          <p className="text-console-body font-medium text-text-primary">
            {empty.title}
          </p>
          <p className="max-w-measure text-console-body text-pretty text-text-secondary">
            {empty.description}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => (
            <li key={item.key} className="min-w-0">
              <MessageCard
                item={item}
                onPreview={onPreview}
                onReset={onReset}
                className="h-full"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
