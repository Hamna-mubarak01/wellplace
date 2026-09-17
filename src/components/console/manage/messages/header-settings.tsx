"use client";

import { useId, useState } from "react";
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon, CopyCheckIcon } from "lucide-react";

import { Button } from "@/components/shared/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shared/select";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HeaderPreview } from "@/components/console/manage/messages/header-preview";
import { ImageUpload } from "@/components/console/manage/messages/image-upload";
import { MESSAGE_HEADER_LIMITS } from "@/lib/config/message-header";
import { HEADER_LOGOS, isHeaderImageUrl, type EmailHeaderDesign, type HeaderLogo } from "@/lib/domain/email/header";
import { messageHeaderDesignSchema } from "@/lib/validation/message-header";

const LOGO_LABEL: Readonly<Record<HeaderLogo, string>> = {
  wordmark: "WellPlace logo",
  custom: "Your own image",
  none: "No logo",
};

export interface HeaderSettingsProps {
  design: EmailHeaderDesign;
  visible: boolean;
  disabled: boolean;
  canApplyToAll: boolean;
  onDesignChange: (design: EmailHeaderDesign, typingGroup?: string) => void;
  onApplyToAll?: (design: EmailHeaderDesign) => Promise<boolean>;
}

export function HeaderSettings({ design, visible, disabled, canApplyToAll, onDesignChange, onApplyToAll }: HeaderSettingsProps) {
  const instance = useId();
  const fieldId = (name: string) => `${instance}-${name}`;
  const [confirming, setConfirming] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = messageHeaderDesignSchema.safeParse(design);
  const problem = parsed.success ? null : parsed.error.issues[0]?.message ?? "Check the header settings.";
  const locked = disabled || applying;

  async function apply() {
    if (!onApplyToAll || locked || !parsed.success || !canApplyToAll) return;
    setApplying(true);
    setError(null);
    try {
      if (await onApplyToAll(design)) setConfirming(false);
      else setError("The header was not applied. Please try again.");
    } catch {
      setError("The header could not be applied. Check your connection and try again.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="@container space-y-4">
      {!visible && (
        <p className="text-micro text-text-secondary">
          The header is hidden because Show header & footer is switched off.
        </p>
      )}

      <Field>
        <FieldLabel htmlFor={fieldId("header-logo")}>Logo</FieldLabel>
        <Select
          value={design.logo}
          disabled={locked}
          onValueChange={(logo: HeaderLogo) => onDesignChange({ ...design, logo })}
        >
          <SelectTrigger id={fieldId("header-logo")} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HEADER_LOGOS.map((logo) => (
              <SelectItem key={logo} value={logo}>
                {LOGO_LABEL[logo]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {design.logo === "custom" && (
        <>
          <ImageUpload disabled={locked} onUploaded={(logoSrc) => onDesignChange({ ...design, logoSrc })} />
          {!isHeaderImageUrl(design.logoSrc) && (
            <p className="text-micro text-text-secondary">Upload the image you want at the top of your emails.</p>
          )}
          <Field>
            <FieldLabel htmlFor={fieldId("header-alt")}>Logo description</FieldLabel>
            <Input
              id={fieldId("header-alt")}
              value={design.logoAlt}
              maxLength={MESSAGE_HEADER_LIMITS.altMax}
              disabled={locked}
              onChange={(event) => onDesignChange({ ...design, logoAlt: event.target.value }, "header-alt")}
            />
            <FieldDescription>Shown when an inbox blocks images, and read aloud by screen readers.</FieldDescription>
          </Field>
        </>
      )}

      {design.logo !== "none" && (
        <Field>
          <FieldLabel htmlFor={fieldId("header-width")}>Logo width in pixels</FieldLabel>
          <Input
            id={fieldId("header-width")}
            type="number"
            inputMode="numeric"
            min={MESSAGE_HEADER_LIMITS.logoWidthMin}
            max={MESSAGE_HEADER_LIMITS.logoWidthMax}
            step={1}
            value={Number.isFinite(design.logoWidth) ? design.logoWidth : ""}
            disabled={locked}
            onChange={(event) => onDesignChange({ ...design, logoWidth: event.target.valueAsNumber }, "header-width")}
          />
          <FieldDescription>
            Between {MESSAGE_HEADER_LIMITS.logoWidthMin} and {MESSAGE_HEADER_LIMITS.logoWidthMax} pixels.
          </FieldDescription>
        </Field>
      )}

      <Field>
        <FieldLabel htmlFor={fieldId("header-text")}>Header wording</FieldLabel>
        <Input
          id={fieldId("header-text")}
          value={design.text}
          maxLength={MESSAGE_HEADER_LIMITS.textMax}
          disabled={locked}
          onChange={(event) => onDesignChange({ ...design, text: event.target.value }, "header-text")}
        />
        <FieldDescription>Optional. A short line shown under the logo.</FieldDescription>
      </Field>

      <Field>
        <FieldLabel id={fieldId("header-align-label")}>Alignment</FieldLabel>
        <div role="group" aria-labelledby={fieldId("header-align-label")} className="flex gap-2">
          {([["left", AlignLeftIcon], ["center", AlignCenterIcon], ["right", AlignRightIcon]] as const).map(([align, Icon]) => (
            <Button
              key={align}
              variant={design.align === align ? "secondary" : "outline"}
              size="icon"
              aria-label={`Align header ${align}`}
              aria-pressed={design.align === align}
              disabled={locked}
              onClick={() => onDesignChange({ ...design, align })}
            >
              <Icon aria-hidden="true" className="size-4" />
            </Button>
          ))}
        </div>
      </Field>

      {problem && (
        <p role="alert" className="text-small text-danger-ink">
          {problem}
        </p>
      )}

      <div className="rounded-(--radius-control) border border-border bg-surface-raised p-3">
        <p className="mb-3 text-console-label font-medium text-text-muted">Header preview</p>
        <HeaderPreview design={design} />
      </div>

      {onApplyToAll && (
        <Button
          variant="outline"
          className="w-full"
          disabled={locked || !parsed.success || !canApplyToAll}
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
        >
          <CopyCheckIcon aria-hidden="true" className="size-4" />
          Apply this header to all emails
        </Button>
      )}

      <Dialog open={confirming} onOpenChange={(open) => { if (!applying) setConfirming(open); }}>
        <DialogContent showCloseButton={!applying}>
          <DialogHeader>
            <DialogTitle>Apply this header to all emails?</DialogTitle>
            <DialogDescription>
              This replaces the logo, wording and alignment of the header in every email template, including drafts
              and published versions. Future emails use it immediately. Hidden headers stay hidden. WhatsApp templates
              are excluded.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-(--radius-control) border border-border bg-surface-sunken p-4">
            <HeaderPreview design={design} />
          </div>
          {error && (
            <p role="alert" className="text-small text-danger-ink">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" hoverEffect="sweep" disabled={applying} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button disabled={locked || !parsed.success || !canApplyToAll} onClick={() => void apply()}>
              {applying ? "Applying…" : "Apply to all emails"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
