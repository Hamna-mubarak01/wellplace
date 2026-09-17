"use client";

import Image from "next/image";
import { footerIconPath } from "@/lib/config/message-footer";
import { isFooterHref, type EmailFooterDesign } from "@/lib/domain/email/footer";
import { cn } from "@/lib/utils";

export function FooterPreview({ text, design }: { text: string; design: EmailFooterDesign }) {
  const links = design.links.filter((link) => link.enabled && isFooterHref(link.href));
  return <div className={cn("w-full space-y-3 py-4 text-small text-text-secondary", design.divider && "border-t border-border",
    design.align === "left" ? "text-left" : design.align === "right" ? "text-right" : "text-center")}>
    {links.length > 0 && <>
      {design.label && <p className="break-words">{design.label}</p>}
      <div className={cn("flex flex-wrap gap-3", design.align === "left" ? "justify-start" : design.align === "right" ? "justify-end" : "justify-center")}>
        {links.map((link) => <a key={link.id} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label}
          className="inline-flex size-tap items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-focus-ring">
          <Image unoptimized src={footerIconPath(link.icon, design.iconStyle)} alt={link.label} width={32} height={32} />
        </a>)}
      </div>
    </>}
    {text.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => <p key={index} className="whitespace-pre-wrap break-words">{line}</p>)}
    {!text.trim() && !links.length && <p className="text-micro text-text-muted">Add footer text or enable a link to see it here.</p>}
  </div>;
}
