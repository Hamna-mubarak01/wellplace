import type { EmailFooterDesign } from "./footer";
import type { EmailHeaderDesign } from "./header";
export type InlineText = {
  readonly kind: "text";
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly underline: boolean;
};

export type InlineVariable = {
  readonly kind: "variable";
  readonly name: string;
};

export type LinkableNode = InlineText | InlineVariable;

export type InlineLink = {
  readonly kind: "link";
  readonly href: string;
  readonly label: readonly LinkableNode[];
};

export type InlineNode = LinkableNode | InlineLink;

export type BlockAlign = "left" | "center" | "right";

export type TextSize = "small" | "normal" | "large";

export const BLOCK_ALIGNMENTS = ["left", "center", "right"] as const;

export const TEXT_SIZES = ["small", "normal", "large"] as const;

export interface PanelRow {
  readonly label: readonly LinkableNode[];
  readonly value: readonly LinkableNode[];
}

export interface LinkItem {
  readonly label: readonly LinkableNode[];
  readonly href: string;
}

export interface MessageTextAppearance {
  readonly font: "body" | "display" | "mono";
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly color: string;
  readonly background: string;
  readonly align: BlockAlign;
}

export interface MessageButtonAppearance {
  readonly followBrand: boolean;
  readonly width: "auto" | "full";
  readonly align: BlockAlign;
  readonly background: string;
  readonly textColor: string;
  readonly radius: number;
  readonly paddingX: number;
  readonly paddingY: number;
}

export type AuthoredBlock =
  | { readonly kind: "band"; readonly id: string; readonly content: readonly InlineNode[] }
  | { readonly kind: "quote"; readonly id: string; readonly content: readonly InlineNode[] }
  | { readonly kind: "columns"; readonly id: string; readonly columns: readonly (readonly InlineNode[])[] }
  | { readonly kind: "hero"; readonly id: string; readonly src: string; readonly alt: string; readonly content: readonly InlineNode[] }
  | { readonly kind: "video"; readonly id: string; readonly src: string; readonly alt: string; readonly href: string; readonly label: readonly LinkableNode[] }
  | { readonly kind: "file"; readonly id: string; readonly href: string; readonly label: readonly LinkableNode[] }
  | { readonly kind: "html"; readonly id: string; readonly markup: string }
  | { readonly kind: "eyebrow"; readonly appearance?: MessageTextAppearance; readonly id: string; readonly content: readonly LinkableNode[] }
  | { readonly kind: "heading"; readonly appearance?: MessageTextAppearance; readonly id: string; readonly content: readonly LinkableNode[] }
  | { readonly kind: "lead"; readonly appearance?: MessageTextAppearance; readonly id: string; readonly content: readonly InlineNode[] }
  | {
      readonly kind: "text";
      readonly appearance?: MessageTextAppearance;
      readonly id: string;
      readonly content: readonly InlineNode[];
      readonly align: BlockAlign;
      readonly size: TextSize;
    }
  | { readonly kind: "note"; readonly appearance?: MessageTextAppearance; readonly id: string; readonly content: readonly InlineNode[] }
  | { readonly kind: "panel"; readonly id: string; readonly rows: readonly PanelRow[] }
  | {
      readonly kind: "button";
      readonly appearance?: MessageButtonAppearance;
      readonly id: string;
      readonly label: readonly LinkableNode[];
      readonly href: string;
    }
  | {
      readonly kind: "links";
      readonly id: string;
      readonly label: readonly LinkableNode[];
      readonly items: readonly LinkItem[];
    }
  | { readonly kind: "divider"; readonly id: string }
  | { readonly kind: "spacer"; readonly id: string; readonly height: number }
  | {
      readonly kind: "image";
      readonly id: string;
      readonly src: string;
      readonly alt: string;
      readonly width: number;
    };

export type AuthoredBlockKind = AuthoredBlock["kind"];

export const AUTHORED_BLOCK_KINDS: readonly AuthoredBlockKind[] = [
  "band", "quote", "columns", "hero", "video", "file", "html",
  "eyebrow",
  "heading",
  "lead",
  "text",
  "note",
  "panel",
  "button",
  "links",
  "divider",
  "spacer",
  "image",
];

export interface AuthoredDocument {
  readonly headerDesign?: EmailHeaderDesign;
  readonly footerDesign?: EmailFooterDesign;
  readonly footer?: string;
  readonly name?: string;
  readonly branding?: boolean;
  readonly delivery?: { readonly channel: "email" | "whatsapp"; readonly isActive: boolean; readonly timingMinutes: number | null };
  readonly subject: readonly LinkableNode[];
  readonly preheader: readonly LinkableNode[];
  readonly whatsapp?: readonly LinkableNode[];
  readonly blocks: readonly AuthoredBlock[];
}

export const SPACER_HEIGHT = { min: 4, max: 96, step: 4, fallback: 24 } as const;

export const IMAGE_WIDTH = { min: 80, max: 520, fallback: 520 } as const;

export const VARIABLE_NAME = /^[a-z][a-z0-9_]{0,39}$/;

const VARIABLE_TOKEN = /^\{\{([a-z][a-z0-9_]{0,39})\}\}$/;

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

export function variableToken(name: string): string {
  return `{{${name}}}`;
}

export function variableInToken(token: string): string | null {
  return VARIABLE_TOKEN.exec(token.trim())?.[1] ?? null;
}

export type VariableValues = Readonly<Record<string, string>>;

function resolve(name: string, values: VariableValues): string {
  return Object.hasOwn(values, name) ? values[name] : variableToken(name);
}

function inlineToPlain(
  nodes: readonly InlineNode[],
  values: VariableValues,
  withAddresses: boolean,
): string {
  return nodes
    .map((node) => {
      if (node.kind === "text") return node.text;
      if (node.kind === "variable") return resolve(node.name, values);

      const label = inlineToPlain(node.label, values, withAddresses);
      if (!withAddresses) return label;

      const href = resolveHref(node.href, values);
      return !isSendableHref(href) || href === label ? label : `${label} (${href})`;
    })
    .join("");
}

export function inlineToText(
  nodes: readonly InlineNode[],
  values: VariableValues,
): string {
  return inlineToPlain(nodes, values, true);
}

function wrapMarks(node: InlineText, inner: string): string {
  let html = inner;
  if (node.bold) html = `<strong>${html}</strong>`;
  if (node.italic) html = `<em>${html}</em>`;
  if (node.underline) html = `<u>${html}</u>`;
  return html;
}

export function resolveHref(href: string, values: VariableValues): string {
  const name = variableInToken(href);
  return (name === null ? href : resolve(name, values)).trim();
}

const CSS_COLOUR = /^#[0-9a-f]{3,8}$/i;

function linkStyle(colour: string): string {
  const trimmed = colour.trim();
  const tint = CSS_COLOUR.test(trimmed) ? `color:${trimmed};` : "";
  return `${tint}text-decoration:underline;`;
}

export function inlineToHtml(
  nodes: readonly InlineNode[],
  values: VariableValues,
  linkColour: string,
): string {
  const style = linkStyle(linkColour);

  return nodes
    .map((node) => {
      if (node.kind === "text") {
        return wrapMarks(node, escape(node.text).replace(/\n/g, "<br />"));
      }
      if (node.kind === "variable") return escape(resolve(node.name, values));

      const label = inlineToHtml(node.label, values, linkColour);
      const href = resolveHref(node.href, values);
      if (!isSendableHref(href)) return label;

      return `<a href="${escape(href)}" style="${style}">${label}</a>`;
    })
    .join("");
}

export function isBlank(nodes: readonly InlineNode[]): boolean {
  return inlineToPlain(nodes, {}, false).trim().length === 0;
}

export function text(value: string): InlineText {
  return { kind: "text", text: value, bold: false, italic: false, underline: false };
}

export function strong(value: string): InlineText {
  return { kind: "text", text: value, bold: true, italic: false, underline: false };
}

export function variable(name: string): InlineVariable {
  return { kind: "variable", name };
}

export function link(href: string, label: readonly LinkableNode[]): InlineLink {
  return { kind: "link", href, label };
}

function nodesIn(block: AuthoredBlock): readonly InlineNode[] {
  switch (block.kind) {
    case "columns": return block.columns.flat();
    case "band":
    case "quote":
    case "hero": return block.content;
    case "file":
    case "video": return block.label;
    case "html": return [];

    case "eyebrow":
    case "heading":
    case "lead":
    case "text":
    case "note":
      return block.content;
    case "panel":
      return block.rows.flatMap((row) => [...row.label, ...row.value]);
    case "button":
      return block.label;
    case "links":
      return [...block.label, ...block.items.flatMap((item) => item.label)];
    case "divider":
    case "spacer":
    case "image":
      return [];
  }
}

function hrefsIn(block: AuthoredBlock): readonly string[] {
  const inline = nodesIn(block)
    .filter((node): node is InlineLink => node.kind === "link")
    .map((node) => node.href);

  if (block.kind === "button" || block.kind === "file") return [...inline, block.href];
  if (block.kind === "video") return [...inline, block.href, block.src];
  if (block.kind === "hero") return [...inline, block.src];
  if (block.kind === "links") return [...inline, ...block.items.map((item) => item.href)];
  if (block.kind === "image") return [...inline, block.src];
  return inline;
}

function variablesIn(nodes: readonly InlineNode[]): readonly string[] {
  return nodes.flatMap((node) => {
    if (node.kind === "variable") return [node.name];
    if (node.kind === "link") {
      const inHref = variableInToken(node.href);
      return [...(inHref === null ? [] : [inHref]), ...variablesIn(node.label)];
    }
    return [];
  });
}

export function documentVariables(document: AuthoredDocument): readonly string[] {
  const used = [
    ...variablesIn(document.subject),
    ...variablesIn(document.preheader),
    ...variablesIn(document.whatsapp ?? []),
    ...document.blocks.flatMap((block) => [
      ...variablesIn(nodesIn(block)),
      ...hrefsIn(block).flatMap((href) => {
        const name = variableInToken(href);
        return name === null ? [] : [name];
      }),
    ]),
  ];

  return [...new Set(used)].sort();
}

export type DocumentProblem =
  | { readonly kind: "subject_blank" }
  | { readonly kind: "no_blocks" }
  | { readonly kind: "renders_empty" }
  | { readonly kind: "block_blank"; readonly blockId: string; readonly block: AuthoredBlockKind }
  | { readonly kind: "unknown_variable"; readonly name: string }
  | { readonly kind: "bad_link"; readonly blockId: string; readonly href: string }
  | { readonly kind: "image_without_description"; readonly blockId: string };

const SAFE_SCHEME = /^(https:\/\/.+|mailto:.+)/i;

export function isSendableHref(href: string): boolean {
  return SAFE_SCHEME.test(href.trim());
}

export function isUsableHref(href: string): boolean {
  const trimmed = href.trim();
  if (trimmed.length === 0) return false;
  if (variableInToken(trimmed) !== null) return true;
  return isSendableHref(trimmed);
}

function blockIsBlank(block: AuthoredBlock): boolean {
  switch (block.kind) {
    case "columns": return block.columns.length === 0 || block.columns.some(isBlank);
    case "band":
    case "quote":
    case "hero": return isBlank(block.content);
    case "file":
    case "video": return isBlank(block.label);
    case "html": return block.markup.trim().length === 0;

    case "eyebrow":
    case "heading":
    case "lead":
    case "text":
    case "note":
      return isBlank(block.content);
    case "panel":
      return block.rows.every((row) => isBlank(row.value));
    case "button":
      return isBlank(block.label);
    case "links":
      return block.items.length === 0 || block.items.some((item) => isBlank(item.label));
    case "divider":
    case "spacer":
    case "image":
      return false;
  }
}

export function inspectDocument(
  document: AuthoredDocument,
  catalogue: readonly string[],
  sampleValues?: VariableValues,
): readonly DocumentProblem[] {
  const problems: DocumentProblem[] = [];

  if (isBlank(document.subject)) problems.push({ kind: "subject_blank" });
  if (document.blocks.length === 0) problems.push({ kind: "no_blocks" });

  for (const block of document.blocks) {
    if (blockIsBlank(block)) {
      problems.push({ kind: "block_blank", blockId: block.id, block: block.kind });
    }

    for (const href of hrefsIn(block)) {
      if (!isUsableHref(href)) problems.push({ kind: "bad_link", blockId: block.id, href });
    }

    if ((block.kind === "image" || block.kind === "hero" || block.kind === "video") && block.alt.trim().length === 0) {
      problems.push({ kind: "image_without_description", blockId: block.id });
    }
  }

  for (const name of documentVariables(document)) {
    if (!catalogue.includes(name)) problems.push({ kind: "unknown_variable", name });
  }

  if (sampleValues !== undefined && problems.length === 0 && document.blocks.length > 0) {
    const rendered = compileDocument(document, sampleValues, "").blocks;
    if (rendered.length === 0) problems.push({ kind: "renders_empty" });
  }

  return problems;
}

export type CompiledBlock =
  | { readonly kind: "layout"; readonly layout: "band" | "quote" | "columns" | "hero"; readonly columns: readonly { html: string; text: string }[]; readonly src?: string; readonly alt?: string }
  | { readonly kind: "video"; readonly src: string; readonly alt: string; readonly href: string; readonly label: string }
  | { readonly kind: "html"; readonly markup: string }

  | { readonly kind: "eyebrow" | "heading"; readonly text: string; readonly appearance?: MessageTextAppearance }
  | { readonly kind: "lead" | "note"; readonly html: string; readonly text: string; readonly appearance?: MessageTextAppearance }
  | {
      readonly kind: "rich";
      readonly appearance?: MessageTextAppearance;
      readonly html: string;
      readonly text: string;
      readonly align: BlockAlign;
      readonly size: TextSize;
    }
  | { readonly kind: "panel"; readonly rows: readonly { label: string; value: string }[] }
  | { readonly kind: "button"; readonly label: string; readonly href: string; readonly appearance?: MessageButtonAppearance }
  | {
      readonly kind: "links";
      readonly label: string;
      readonly items: readonly { label: string; href: string }[];
    }
  | { readonly kind: "divider" }
  | { readonly kind: "spacer"; readonly height: number }
  | { readonly kind: "image"; readonly src: string; readonly alt: string; readonly width: number };

export interface CompiledDocument {
  readonly subject: string;
  readonly preheader: string;
  readonly blocks: readonly CompiledBlock[];
}

function compileBlock(
  block: AuthoredBlock,
  values: VariableValues,
  linkColour: string,
): CompiledBlock | null {
  switch (block.kind) {
    case "band":
    case "quote":
    case "columns":
    case "hero": {
      const columns = (block.kind === "columns" ? block.columns : [block.content]).map((content) => ({ html: inlineToHtml(content, values, linkColour), text: inlineToText(content, values) }));
      return { kind: "layout", layout: block.kind, columns, ...(block.kind === "hero" ? { src: resolveHref(block.src, values), alt: block.alt } : {}) };
    }
    case "video": {
      const href = resolveHref(block.href, values);
      const src = resolveHref(block.src, values);
      return isSendableHref(href) && isSendableHref(src) ? { kind: "video", href, src, alt: block.alt, label: inlineToText(block.label, values) } : null;
    }
    case "html": return { kind: "html", markup: block.markup };
    case "file": {
      const href = resolveHref(block.href, values);
      return isSendableHref(href) ? { kind: "button", href, label: inlineToText(block.label, values) } : null;
    }

    case "eyebrow":
    case "heading":
      return { kind: block.kind, text: inlineToText(block.content, values), ...(block.appearance ? { appearance: block.appearance } : {}) };
    case "lead":
    case "note":
      return {
        kind: block.kind,
        ...(block.appearance ? { appearance: block.appearance } : {}),
        html: inlineToHtml(block.content, values, linkColour),
        text: inlineToText(block.content, values),
      };
    case "text":
      return {
        kind: "rich",
        ...(block.appearance ? { appearance: block.appearance } : {}),
        html: inlineToHtml(block.content, values, linkColour),
        text: inlineToText(block.content, values),
        align: block.align,
        size: block.size,
      };
    case "panel": {
      const rows = block.rows
        .map((row) => ({
          label: inlineToText(row.label, values),
          value: inlineToText(row.value, values),
        }))
        .filter((row) => row.value.trim().length > 0);
      return rows.length === 0 ? null : { kind: "panel", rows };
    }
    case "button": {
      const href = resolveHref(block.href, values);
      return isSendableHref(href)
        ? { kind: "button", label: inlineToText(block.label, values), href, ...(block.appearance ? { appearance: block.appearance } : {}) }
        : null;
    }
    case "links": {
      const items = block.items
        .map((item) => ({
          label: inlineToText(item.label, values),
          href: resolveHref(item.href, values),
        }))
        .filter((item) => isSendableHref(item.href));
      return items.length === 0
        ? null
        : { kind: "links", label: inlineToText(block.label, values), items };
    }
    case "divider":
      return { kind: "divider" };
    case "spacer":
      return { kind: "spacer", height: block.height };
    case "image": {
      const src = resolveHref(block.src, values);
      return isSendableHref(src)
        ? { kind: "image", src, alt: block.alt, width: block.width }
        : null;
    }
  }
}

export function compileDocument(
  document: AuthoredDocument,
  values: VariableValues,
  linkColour: string,
): CompiledDocument {
  return {
    subject: inlineToText(document.subject, values),
    preheader: inlineToText(document.preheader, values),
    blocks: document.blocks
      .map((block) => compileBlock(block, values, linkColour))
      .filter((block): block is CompiledBlock => block !== null),
  };
}
