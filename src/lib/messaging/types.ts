
export type MessageKind = "transactional" | "marketing";

export interface InlineEmailAttachment {
  filename: string;
  path: string;
  contentId: string;
}

export interface FileEmailAttachment {
  filename: string;
  content: string;
}

export type EmailAttachment = InlineEmailAttachment | FileEmailAttachment;

export interface EmailMessage {
  to: string | readonly string[];
  subject: string;
  text: string;
  html?: string;
  kind: MessageKind;
  reference?: string;
  from?: string;
  replyTo?: string;
  attachments?: readonly EmailAttachment[];
}

export type SendResult =
  | { ok: true; providerId: string }
  | { ok: false; reason: "not_configured" | "rejected" | "provider_error"; message: string };

export interface EmailAdapter {
  readonly name: string;
  send(message: EmailMessage): Promise<SendResult>;
}
