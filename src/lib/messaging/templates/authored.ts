import type { EmailFooterDesign } from "@/lib/domain/email/footer";
import type { EmailHeaderDesign } from "@/lib/domain/email/header";
import { messageEmailFrame } from "@/lib/config/message-email-frame";
import { emailConfig, formatSender } from "@/lib/config/email";
import {
  defaultDocument,
  messageSpec,
  type SystemMessageKey,
} from "@/lib/config/message-documents";
import {
  compileDocument,
  type AuthoredDocument,
  type VariableValues,
} from "@/lib/domain/email/document";
import { EMAIL_THEME } from "@/lib/messaging/email-theme";
import { renderEmail } from "@/lib/messaging/templates/layout";
import type { EmailMessage } from "@/lib/messaging/types";

export interface AuthoredRequest {
  readonly key: SystemMessageKey;
  readonly footer?: string | null;
  readonly footerDesign?: EmailFooterDesign | null;
  readonly headerDesign?: EmailHeaderDesign | null;
  readonly stored: AuthoredDocument | null;
  readonly values: VariableValues;
  readonly to?: string | readonly string[];
}

export function resolveDocument(
  key: SystemMessageKey,
  stored: AuthoredDocument | null,
): AuthoredDocument | null {
  if (stored !== null && stored.blocks.length > 0) return stored;
  return defaultDocument(key);
}

export function authoredEmail(request: AuthoredRequest): EmailMessage | null {
  const document = resolveDocument(request.key, request.stored);
  if (document === null) return null;

  const spec = messageSpec(request.key);
  const config = emailConfig();
  const compiled = compileDocument(document, request.values, EMAIL_THEME.brand);

  const { html, text, attachments } = renderEmail({
    subject: compiled.subject,
    preheader: compiled.preheader.trim() || undefined,
    ...messageEmailFrame(request.key, config, document.footer ?? request.footer, document.footerDesign ?? request.footerDesign, document.headerDesign ?? request.headerDesign),
    branding: document.branding,
    blocks: compiled.blocks,
  });

  const staff = spec.audience === "staff";
  const recipient = request.to ?? (staff ? config.operationsTo : request.values.email);
  if (recipient === undefined || recipient.length === 0) return null;

  return {
    to: recipient,
    from: staff
      ? formatSender(config.operationsFromName, config.operationsFrom)
      : formatSender(config.guestFromName, config.guestFrom),
    replyTo: staff ? config.operationsTo[0] : config.guestFrom,
    subject: compiled.subject,
    text,
    html,
    attachments,
    kind: spec.key === "review_request" ? "marketing" : "transactional",
  };
}
