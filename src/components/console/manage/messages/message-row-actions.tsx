"use client";

import Link from "next/link";
import {
  EyeIcon,
  MoreVerticalIcon,
  PencilIcon,
  RotateCcwIcon,
} from "lucide-react";

import { Button } from "@/components/shared/button";
import type { MessageListItem } from "@/components/console/manage/messages/message-list-model";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SystemMessageKey } from "@/lib/config/message-documents";

export interface MessageRowActionsProps {
  item: MessageListItem;
  onPreview: (key: SystemMessageKey) => void;
  onReset?: (key: SystemMessageKey) => void;
}

export function MessageRowActions({
  item,
  onPreview,
  onReset,
}: MessageRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`More for ${item.label}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreVerticalIcon aria-hidden="true" className="size-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem asChild className="min-h-tap">
          <Link href={item.editHref}>
            <PencilIcon aria-hidden="true" className="size-4" />
            Edit wording
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="min-h-tap"
          onSelect={() => onPreview(item.key)}
        >
          <EyeIcon aria-hidden="true" className="size-4" />
          Preview
        </DropdownMenuItem>

        {onReset !== undefined &&
          (item.status === "published" || item.status === "draft") && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="min-h-tap"
                onSelect={() => onReset(item.key)}
              >
                <RotateCcwIcon aria-hidden="true" className="size-4" />
                Restore built-in wording
              </DropdownMenuItem>
            </>
          )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
