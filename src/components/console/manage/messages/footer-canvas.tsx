"use client";

import type { ReactNode } from "react";
import { CheckIcon, GlobeIcon, PencilIcon } from "lucide-react";
import { Button } from "@/components/shared/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { EmailFooterDesign } from "@/lib/domain/email/footer";
import { FooterPreview } from "./footer-preview";
import { cn } from "@/lib/utils";

export function FooterCanvas({ text, design, editing, disabled, onEdit, onClose, children }: {
  text: string;
  design: EmailFooterDesign;
  editing: boolean;
  disabled: boolean;
  onEdit: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return <section aria-label="Email footer block" data-footer-block className="p-4 sm:p-6">
    <Card className={cn("border border-border shadow-none", editing && "border-brand ring-2 ring-focus-ring")}>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Email footer</CardTitle>
          <Badge variant="secondary"><GlobeIcon aria-hidden="true" className="size-3" />Global options</Badge>
        </div>
        <Button variant={editing ? "outline" : "ghost"} size="sm" disabled={disabled}
          aria-expanded={editing} onClick={editing ? onClose : onEdit}>
          {editing ? <CheckIcon aria-hidden="true" className="size-4" /> : <PencilIcon aria-hidden="true" className="size-4" />}
          {editing ? "Done editing footer" : "Edit footer"}
        </Button>
      </CardHeader>
      <CardContent>
        {editing ? <div data-footer-editor>{children}</div> : <div
          className={cn(!disabled && "cursor-pointer")}
          onClickCapture={(event) => {
            event.preventDefault();
            if (!disabled) onEdit();
          }}
        ><FooterPreview text={text} design={design} /></div>}
      </CardContent>
    </Card>
  </section>;
}
