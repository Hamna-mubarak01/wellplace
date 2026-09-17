"use client";

import Link from "next/link";
import { EyeIcon, PlugZapIcon } from "lucide-react";

import { Button } from "@/components/shared/button";
import { StatusChip } from "@/components/console/shared/status-chip";
import { MessageRowActions } from "@/components/console/manage/messages/message-row-actions";
import { MessageThumbnail } from "@/components/console/manage/messages/message-thumbnail";
import {
  MESSAGE_AUDIENCE_LABEL,
  MESSAGE_STATUS_LABEL,
  MESSAGE_STATUS_TONE,
  type MessageListItem,
} from "@/components/console/manage/messages/message-list-model";
import { MESSAGE_GROUP_LABEL } from "@/components/console/manage/messages/message-document-model";
import { Card, CardContent } from "@/components/ui/card";
import { formatDubaiDateTime } from "@/lib/domain/time";
import type { SystemMessageKey } from "@/lib/config/message-documents";
import { cn } from "@/lib/utils";

export interface MessageCardProps {
  item: MessageListItem;
  onPreview: (key: SystemMessageKey) => void;
  onReset?: (key: SystemMessageKey) => void;
  className?: string;
}

export function MessageCard({
  item,
  onPreview,
  onReset,
  className,
}: MessageCardProps) {
  return (
    <Card
      className={cn(
        "group/card gap-0 rounded-(--radius-card) border border-border bg-surface-raised py-0 shadow-none ring-0 transition-colors duration-150 hover:border-border-hover motion-reduce:transition-none",
        className,
      )}
    >
      <CardContent className="flex h-full min-w-0 flex-col gap-3 p-4">
        <MessageThumbnail />

        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="min-w-0 text-console-body font-medium text-pretty text-text-primary">
              <Link
                href={item.editHref}
                className="rounded-(--radius-inner) outline-none hover:text-brand focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                {item.label}
              </Link>
            </h2>
            <p className="min-w-0 line-clamp-2 text-console-body text-pretty text-text-secondary">
              {item.subject.trim().length > 0 ? item.subject : "No subject yet"}
            </p>
          </div>
          <MessageRowActions
            item={item}
            onPreview={onPreview}
            onReset={onReset}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone="neutral">
            {MESSAGE_GROUP_LABEL[item.group]}
          </StatusChip>
          <StatusChip tone={MESSAGE_STATUS_TONE[item.status]}>
            {MESSAGE_STATUS_LABEL[item.status]}
          </StatusChip>
          {!item.connected && (
            <StatusChip tone="info" Icon={PlugZapIcon}>
              Not sending yet
            </StatusChip>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-3 border-t border-border pt-3">
          <p className="text-micro text-text-muted">
            {item.updatedAt === null
              ? MESSAGE_AUDIENCE_LABEL[item.audience]
              : `Last updated ${formatDubaiDateTime(item.updatedAt)}`}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onPreview(item.key)}
            >
              <EyeIcon aria-hidden="true" className="size-4" />
              Preview
            </Button>
            <Button asChild>
              <Link href={item.editHref}>Edit</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
