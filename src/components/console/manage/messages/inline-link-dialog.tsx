"use client";

import { useState } from "react";

import { Button } from "@/components/shared/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MESSAGE_DOCUMENT_LIMITS,
  type MessageVariable,
} from "@/lib/config/message-documents";
import { isUsableHref, variableToken } from "@/lib/domain/email/document";

export interface InlineLinkDialogProps {
  open: boolean;
  href: string;
  selectedText: string;
  variables: readonly MessageVariable[];
  onConfirm: (href: string) => void;
  onCancel: () => void;
}

const MANUAL = "manual";

function linkVariables(
  variables: readonly MessageVariable[],
): readonly MessageVariable[] {
  return variables.filter(
    (entry) =>
      entry.name.endsWith("_url") || entry.sample.startsWith("https://"),
  );
}

export function InlineLinkDialog({
  open,
  href,
  selectedText,
  variables,
  onConfirm,
  onCancel,
}: InlineLinkDialogProps) {
  const [draft, setDraft] = useState(href);
  const [source, setSource] = useState(MANUAL);
  const [touched, setTouched] = useState(false);

  const offered = linkVariables(variables);
  const value = source === MANUAL ? draft : variableToken(source);
  const usable = isUsableHref(value);

  function confirm() {
    setTouched(true);
    if (!usable) return;
    onConfirm(value.trim());
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="flex max-h-dialog-max-h min-h-0 flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b border-border p-5">
          <DialogTitle>Link this text</DialogTitle>
          <DialogDescription>
            {selectedText.trim().length > 0
              ? `“${selectedText.trim()}” becomes a link.`
              : "Choose where this link opens."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-5 p-5">
            {offered.length > 0 && (
              <Field>
                <FieldLabel htmlFor="inline-link-source">
                  Where it goes
                </FieldLabel>
                <Select
                  value={source}
                  onValueChange={(next) => {
                    setSource(next);
                    setTouched(false);
                  }}
                >
                  <SelectTrigger id="inline-link-source" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={MANUAL} className="min-h-tap">
                      A web address I type
                    </SelectItem>
                    {offered.map((entry) => (
                      <SelectItem
                        key={entry.name}
                        value={entry.name}
                        className="min-h-tap"
                      >
                        {entry.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  A guest detail fills in each guest&rsquo;s own address when
                  the email is sent.
                </FieldDescription>
              </Field>
            )}

            {source === MANUAL ? (
              <Field data-invalid={touched && !usable ? true : undefined}>
                <FieldLabel htmlFor="inline-link-href">Web address</FieldLabel>
                <Input
                  id="inline-link-href"
                  value={draft}
                  inputMode="url"
                  autoComplete="off"
                  maxLength={MESSAGE_DOCUMENT_LIMITS.hrefMax}
                  placeholder="https://wellplace.example/book"
                  onChange={(event) => setDraft(event.target.value)}
                />
                <FieldDescription>
                  Start with https:// for a web page, or mailto: for an email
                  address.
                </FieldDescription>
                {touched && !usable && (
                  <FieldError>
                    That address will not open. Use an https:// address or a
                    mailto: address.
                  </FieldError>
                )}
              </Field>
            ) : (
              <p className="text-console-body text-text-secondary">
                This link opens {variableToken(source)} — each guest gets their
                own address.
              </p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="mx-0 mb-0 grid shrink-0 grid-cols-2 gap-2 border-t border-border p-4 sm:flex">
          <Button
            type="button"
            variant="ghost"
            hoverEffect="sweep"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button type="button" onClick={confirm}>
            Add link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
