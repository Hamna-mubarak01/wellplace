"use client";

import { useState } from "react";
import {
  CheckIcon,
  CopyIcon,
  MailIcon,
  PhoneIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "@/lib/console/feedback";

import type { WaitlistLead } from "@/lib/db/queries/waitlist-leads";
import { dubaiStamp, leadOrigin } from "@/components/console/lead-format";
import { salutationLabel } from "@/components/console/leads-filters";
import { initialsFor } from "@/components/console/console-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface LeadDetailDialogProps {
  lead: WaitlistLead | null;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (lead: WaitlistLead) => void;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(`${label} could not be copied`, {
        description: "Your browser blocked clipboard access. Select it by hand.",
      });
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={copy}
      aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
      className="size-tap shrink-0"
    >
      {copied ? (
        <CheckIcon aria-hidden="true" className="text-success" />
      ) : (
        <CopyIcon aria-hidden="true" />
      )}
    </Button>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
  mono,
  suffix,
}: {
  icon: typeof MailIcon;
  label: string;
  value: string;
  href: string;
  mono?: boolean;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-(--radius-card) border border-border bg-surface-base px-3 py-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-wash text-brand">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-console-label tracking-label text-text-muted uppercase">
          {label}
        </span>
        <a
          href={href}
          className={cn(
            "truncate text-console-body text-text-primary underline-offset-2 hover:text-brand hover:underline",
            mono && "font-data",
          )}
        >
          {value}
          {suffix && <span className="ml-1.5 text-text-muted">{suffix}</span>}
        </a>
      </div>
      <div className="ml-auto">
        <CopyButton value={value} label={label} />
      </div>
    </div>
  );
}

function Fact({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-console-label tracking-label text-text-muted uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "min-w-0 truncate text-right text-console-body text-text-primary",
          mono && "font-data tabular-nums",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

const NONE = <span className="text-text-muted">—</span>;

export function LeadDetailDialog({
  lead,
  canManage,
  onOpenChange,
  onDelete,
}: LeadDetailDialogProps) {
  const joined = lead ? dubaiStamp(lead.createdAt) : null;
  const archived = lead?.archivedAt ? dubaiStamp(lead.archivedAt) : null;

  return (
    <Dialog open={Boolean(lead)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-dialog-max-h gap-0 overflow-x-hidden overflow-y-auto p-0 sm:max-h-none sm:max-w-xl sm:overflow-visible">
        {lead && joined && (
          <>
            <DialogHeader className="space-y-0 px-5 pt-5 pb-4 text-left sm:px-6 sm:pt-6">
              <div className="flex items-start gap-3.5">
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-wash font-data text-console-body font-medium text-brand"
                >
                  {initialsFor(`${lead.firstName} ${lead.lastName}`)}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <DialogTitle className="font-display text-console-title font-medium text-text-primary">
                      {lead.firstName} {lead.lastName}
                    </DialogTitle>
                    {archived ? (
                      <Badge className="bg-surface-active text-text-secondary">
                        Archived
                      </Badge>
                    ) : (
                      <Badge className="bg-success-wash text-success-ink">
                        On the list
                      </Badge>
                    )}
                  </div>
                  <DialogDescription className="text-console-body">
                    Joined {joined.date} at {joined.time}, Dubai time.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex flex-col gap-2 px-5 pb-4 sm:px-6">
              <ContactRow
                icon={MailIcon}
                label="Email"
                value={lead.email}
                href={`mailto:${lead.email}`}
              />
              <ContactRow
                icon={PhoneIcon}
                label="Mobile"
                value={lead.phoneE164}
                href={`tel:${lead.phoneE164}`}
                mono
                suffix={lead.phoneCountry}
              />
            </div>

            <Separator />

            <dl className="grid grid-cols-1 gap-x-10 px-5 py-2 sm:grid-cols-2 sm:px-6">
              <Fact label="Salutation">{salutationLabel(lead.salutation)}</Fact>
              <Fact label="Age" mono>
                {lead.ageYears ?? NONE}
              </Fact>
              <Fact label="Arrived via">
                {leadOrigin(lead.source, lead.utmCampaign)}
              </Fact>
              <Fact label="Campaign">{lead.utmCampaign ?? NONE}</Fact>
              <Fact label="Submissions" mono>
                {lead.signupCount}
              </Fact>
              <Fact label="Terms accepted" mono>
                {lead.termsAcceptanceVersion ? `v${lead.termsAcceptanceVersion}` : NONE}
              </Fact>
            </dl>

            {archived && (
              <p className="px-5 pb-4 text-fine text-text-muted sm:px-6">
                Archived {archived.date} at {archived.time}.
              </p>
            )}

            <DialogFooter className="m-0 gap-2 border-t border-border bg-surface-sunken px-5 py-4 sm:justify-between sm:px-6">
              {canManage ? (
                <Button
                  type="button"
                  variant="ghost"
                  tone="danger"
                  className="h-tap px-3"
                  onClick={() => onDelete(lead)}
                >
                  <Trash2Icon aria-hidden="true" />
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <DialogClose asChild>
                <Button type="button" className="h-tap px-5">
                  Close
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
