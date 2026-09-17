"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { resetMessageDocument } from "@/app/(console)/manage/messages/document-actions";
import { MessageList } from "@/components/console/manage/messages/message-list";
import type { MessageListItem } from "@/components/console/manage/messages/message-list-model";
import type { MessageListView } from "@/components/console/manage/messages/message-view-toggle";
import { PlusIcon, ArrowRightIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/shared/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  messageSpec,
  MESSAGE_DOCUMENT_GROUPS,
  type SystemMessageKey,
} from "@/lib/config/message-documents";

export interface MessagesWorkspaceProps {
  readonly items: readonly MessageListItem[];
  readonly error: string | null;
}

export function MessagesWorkspace({ items, error }: MessagesWorkspaceProps) {
  const router = useRouter();
  const params = useSearchParams();
  const search = params.get("q") ?? "";
  const group =
    MESSAGE_DOCUMENT_GROUPS.find((entry) => entry.value === params.get("group"))
      ?.value ?? null;
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<MessageListView>("list");
  const [resetting, setResetting] = useState<SystemMessageKey | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <MessageList
        actions={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon aria-hidden="true" className="size-4" />
            Create template
          </Button>
        }
        items={items}
        search={search}
        group={group}
        view={view}
        error={error}
        onViewChange={setView}
        onPreview={(key) => router.push(`/manage/messages/${key}?preview=1`)}
        onReset={(key) => setResetting(key)}
      />

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a message template</DialogTitle>
            <DialogDescription>
              Choose the message you want to write. Each template belongs to a
              WellPlace event.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            <div className="space-y-2 pr-3">
              {items
                .filter((item) => item.status === "not_written")
                .map((item) => (
                  <Button
                    key={item.key}
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => router.push(item.editHref)}
                  >
                    {item.label}
                    <ArrowRightIcon aria-hidden="true" className="size-4" />
                  </Button>
                ))}
              {items.every((item) => item.status !== "not_written") && (
                <p className="py-6 text-console-body text-text-secondary">
                  Every message already has a template. Open one from the list
                  to edit it.
                </p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={resetting !== null}
        onOpenChange={(open) => {
          if (!open) setResetting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Put back the built-in wording?</AlertDialogTitle>
            <AlertDialogDescription>
              {resetting === null
                ? null
                : `${messageSpec(resetting).label} goes back to the wording WellPlace ships with. Anything written here is discarded.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="ghost" hoverEffect="sweep" disabled={pending}>
                Keep my wording
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="default"
                disabled={pending}
                onClick={() => {
                  const key = resetting;
                  if (key === null) return;
                  startTransition(async () => {
                    const result = await resetMessageDocument({ key });
                    if (result.ok) {
                      toast.success(
                        result.message ?? "The built-in wording is back.",
                      );
                      setResetting(null);
                      router.refresh();
                      return;
                    }
                    toast.error(result.message);
                  });
                }}
              >
                {pending ? "Putting it back…" : "Put it back"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
