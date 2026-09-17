"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { AlignLeftIcon, AlignCenterIcon, AlignRightIcon, ArrowUpIcon, ArrowDownIcon, CopyCheckIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/shared/button";
import { ConsoleSwitch } from "@/components/shared/console-switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/shared/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { MESSAGE_DOCUMENT_LIMITS } from "@/lib/config/message-documents";
import { FOOTER_PLATFORMS, MESSAGE_FOOTER_LIMITS, footerIconPath } from "@/lib/config/message-footer";
import { isFooterHref, type EmailFooterDesign, type EmailFooterLink } from "@/lib/domain/email/footer";
import { messageFooterDesignSchema } from "@/lib/validation/message-footer";
import { FooterPreview } from "./footer-preview";

export function FooterSettings({ value, design, visible, disabled, onChange, onDesignChange, onApplyToAll, canApplyToAll = true }: {
  canApplyToAll?: boolean;
  value: string;
  design: EmailFooterDesign;
  visible: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onDesignChange: (value: EmailFooterDesign, typingGroup?: string) => void;
  onApplyToAll?: (value: string, design: EmailFooterDesign) => Promise<boolean>;
}) {
  const instance = useId();
  const fieldId = (name: string) => `${instance}-${name}`;
  const [confirming, setConfirming] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooLong = value.length > MESSAGE_DOCUMENT_LIMITS.textMax;
  const valid = !tooLong && messageFooterDesignSchema.safeParse(design).success;
  const locked = disabled || applying;

  function updateLink(id: string, patch: Partial<EmailFooterLink>, typingGroup?: string) {
    onDesignChange({ ...design, links: design.links.map((link) => link.id === id ? { ...link, ...patch } : link) }, typingGroup);
  }

  function moveLink(index: number, offset: number) {
    const links = [...design.links];
    const [link] = links.splice(index, 1);
    links.splice(index + offset, 0, link);
    onDesignChange({ ...design, links });
  }

  async function apply() {
    if (!onApplyToAll || locked || !valid || !canApplyToAll) return;
    setApplying(true);
    setError(null);
    try {
      if (await onApplyToAll(value, design)) setConfirming(false);
      else setError("The footer was not applied. Please try again.");
    } catch {
      setError("The footer could not be applied. Check your connection and try again.");
    } finally {
      setApplying(false);
    }
  }

  return <div className="@container space-y-4">
    <Field>
      <FieldLabel htmlFor={fieldId("message-footer")}>Email footer</FieldLabel>
      <Textarea id={fieldId("message-footer")} value={value} rows={4} maxLength={MESSAGE_DOCUMENT_LIMITS.textMax} disabled={locked}
        aria-describedby={fieldId("message-footer-help")} aria-invalid={tooLong || undefined}
        onChange={(event) => onChange(event.target.value)} />
      <FieldDescription id={fieldId("message-footer-help")}>
        Add your sign-off, address or other footer text. Each line becomes a paragraph.
        {!visible && " The footer is hidden because Show header & footer is switched off."}
      </FieldDescription>
      {tooLong && <p role="alert" className="text-small text-danger-ink">Keep the footer within {MESSAGE_DOCUMENT_LIMITS.textMax} characters.</p>}
    </Field>
    <Field>
      <FieldLabel htmlFor={fieldId("footer-links-label")}>Links heading</FieldLabel>
      <Input id={fieldId("footer-links-label")} value={design.label} placeholder="Stay connected with WellPlace" maxLength={MESSAGE_FOOTER_LIMITS.labelMax} disabled={locked}
        onChange={(event) => onDesignChange({ ...design, label: event.target.value }, "footer-heading")} />
    </Field>
    <div className="flex items-center justify-between gap-3">
      <FieldLabel htmlFor={fieldId("footer-divider")}>Divider above the footer</FieldLabel>
      <ConsoleSwitch id={fieldId("footer-divider")} checked={design.divider} disabled={locked} onCheckedChange={(divider) => onDesignChange({ ...design, divider })} />
    </div>
    <Field>
      <FieldLabel htmlFor={fieldId("footer-icon-style")}>Icon style</FieldLabel>
      <Select value={design.iconStyle} disabled={locked} onValueChange={(iconStyle: EmailFooterDesign["iconStyle"]) => onDesignChange({ ...design, iconStyle })}>
        <SelectTrigger id={fieldId("footer-icon-style")} className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="brand">WellPlace colour</SelectItem><SelectItem value="coloured">Platform colours</SelectItem><SelectItem value="monochrome">Monochrome</SelectItem></SelectContent>
      </Select>
    </Field>
    <Field>
      <FieldLabel id={fieldId("footer-align-label")}>Alignment</FieldLabel>
      <div role="group" aria-labelledby={fieldId("footer-align-label")} className="flex gap-2">
        {([["left", AlignLeftIcon], ["center", AlignCenterIcon], ["right", AlignRightIcon]] as const).map(([align, Icon]) =>
          <Button key={align} variant={design.align === align ? "secondary" : "outline"} size="icon" aria-label={`Align footer ${align}`} aria-pressed={design.align === align} disabled={locked} onClick={() => onDesignChange({ ...design, align })}><Icon aria-hidden="true" className="size-4" /></Button>)}
      </div>
    </Field>
    <div className="space-y-3">
      <p className="text-console-body font-medium">Icons & links</p>
      <div className="grid gap-3 @2xl:grid-cols-2">
      {design.links.map((link, index) => {
        const platform = FOOTER_PLATFORMS.find((entry) => entry.value === link.icon)!;
        const invalidHref = (link.enabled || Boolean(link.href)) && !isFooterHref(link.href);
        return <Card key={link.id} className="gap-0 py-0"><CardContent className="space-y-3 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Image unoptimized src={footerIconPath(link.icon, design.iconStyle)} alt="" width={24} height={24} />
            <span className="min-w-0 flex-1 text-small font-medium">{platform.label}</span>
            <ConsoleSwitch id={fieldId(`footer-enabled-${link.id}`)} aria-label={`Show ${link.label || platform.label} in footer`} checked={link.enabled} disabled={locked} onCheckedChange={(enabled) => updateLink(link.id, { enabled })} />
          </div>
          <Field>
            <FieldLabel htmlFor={fieldId(`footer-label-${link.id}`)}>Label</FieldLabel>
            <Input id={fieldId(`footer-label-${link.id}`)} value={link.label} maxLength={MESSAGE_FOOTER_LIMITS.labelMax} disabled={locked} aria-invalid={!link.label.trim() || undefined} onChange={(event) => updateLink(link.id, { label: event.target.value }, `footer-label-${link.id}`)} />
          </Field>
          <Field>
            <FieldLabel htmlFor={fieldId(`footer-url-${link.id}`)}>Link</FieldLabel>
            <Input id={fieldId(`footer-url-${link.id}`)} type="text" inputMode="url" value={link.href} placeholder={platform.placeholder} maxLength={MESSAGE_FOOTER_LIMITS.hrefMax} disabled={locked}
              aria-invalid={invalidHref || undefined} aria-describedby={invalidHref ? fieldId(`footer-error-${link.id}`) : undefined} onChange={(event) => updateLink(link.id, { href: event.target.value.trim() }, `footer-url-${link.id}`)} />
            {invalidHref && <p id={fieldId(`footer-error-${link.id}`)} className="text-micro text-danger-ink">Use an https://, mailto: or tel: link, or switch an empty item off.</p>}
          </Field>
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" aria-label={`Move ${link.label} up`} disabled={locked || index === 0} onClick={() => moveLink(index, -1)}><ArrowUpIcon aria-hidden="true" className="size-4" /></Button>
            <Button variant="ghost" size="icon" aria-label={`Move ${link.label} down`} disabled={locked || index === design.links.length - 1} onClick={() => moveLink(index, 1)}><ArrowDownIcon aria-hidden="true" className="size-4" /></Button>
            <Button variant="ghost" tone="danger" size="icon" aria-label={`Remove ${link.label}`} disabled={locked} onClick={() => onDesignChange({ ...design, links: design.links.filter((item) => item.id !== link.id) })}><Trash2Icon aria-hidden="true" className="size-4" /></Button>
          </div>
        </CardContent></Card>;
      })}
      </div>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="w-full" disabled={locked || design.links.length >= MESSAGE_FOOTER_LIMITS.linksMax}><PlusIcon aria-hidden="true" className="size-4" />Add icon & link</Button></DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-80 w-(--measure-filter-popover) overflow-y-auto" align="start">
          {FOOTER_PLATFORMS.map((platform) => <DropdownMenuItem key={platform.value} className="min-h-tap gap-3" onSelect={() => onDesignChange({ ...design, links: [...design.links, { id: crypto.randomUUID(), icon: platform.value, label: platform.label, href: "", enabled: true }] })}>
            <Image unoptimized src={footerIconPath(platform.value, design.iconStyle)} alt="" width={24} height={24} />{platform.label}
          </DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <div className="rounded-(--radius-control) border border-border bg-surface-raised p-3">
      <p className="text-console-label font-medium text-text-muted">Footer preview</p>
      <FooterPreview text={value} design={design} />
    </div>
    {onApplyToAll && <Button variant="outline" className="w-full" disabled={locked || !valid || !canApplyToAll} onClick={() => { setError(null); setConfirming(true); }}>
      <CopyCheckIcon aria-hidden="true" className="size-4" />Apply this footer to all emails
    </Button>}
    <Dialog open={confirming} onOpenChange={(open) => { if (!applying) setConfirming(open); }}>
      <DialogContent showCloseButton={!applying}>
        <DialogHeader>
          <DialogTitle>Apply this footer to all emails?</DialogTitle>
          <DialogDescription>This replaces footer text, icons, links and layout in every email template, including drafts and published versions. Future emails use it immediately. Hidden footers stay hidden. WhatsApp templates are excluded.</DialogDescription>
        </DialogHeader>
        <div className="max-h-64 overflow-y-auto rounded-(--radius-control) border border-border bg-surface-sunken p-4"><FooterPreview text={value} design={design} /></div>
        {error && <p role="alert" className="text-small text-danger-ink">{error}</p>}
        <DialogFooter>
          <Button variant="ghost" hoverEffect="sweep" disabled={applying} onClick={() => setConfirming(false)}>Cancel</Button>
          <Button disabled={locked || !valid || !canApplyToAll} onClick={() => void apply()}>{applying ? "Applying…" : "Apply to all emails"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
