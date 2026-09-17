import {
  escape,
  type InlineLink,
  type InlineNode,
  type InlineText,
  type InlineVariable,
  type LinkableNode,
} from "@/lib/domain/email/document";
import { MESSAGE_DOCUMENT_LIMITS } from "@/lib/config/message-documents";

import { toLinkableNodes } from "@/components/console/manage/messages/message-document-model";

export const VARIABLE_CHIP_CLASS =
  "mx-0.5 inline-flex max-w-full select-none items-center gap-1 rounded-full border border-brand bg-brand-wash py-0.5 pr-1 pl-2 align-baseline font-body text-micro leading-tight font-medium text-text-primary";

export const VARIABLE_CHIP_LABEL_CLASS = "truncate";

export const VARIABLE_CHIP_REMOVE_CLASS =
  "inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-secondary hover:bg-surface-active hover:text-text-primary";

export const LINK_SPAN_CLASS = "text-brand underline underline-offset-2";

const REMOVE_GLYPH =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="size-3" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>';

const BLOCK_TAGS: ReadonlySet<string> = new Set([
  "DIV",
  "P",
  "LI",
  "UL",
  "OL",
  "TR",
  "BLOCKQUOTE",
  "SECTION",
  "ARTICLE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
]);

export interface InlineParseOptions {
  readonly allowLinks: boolean;
  readonly allowMarks: boolean;
  readonly multiline: boolean;
}

interface Marks {
  readonly bold: boolean;
  readonly italic: boolean;
  readonly underline: boolean;
}

const NO_MARKS: Marks = { bold: false, italic: false, underline: false };

type Draft =
  | { kind: "text"; value: string; marks: Marks }
  | { kind: "variable"; name: string }
  | { kind: "link"; href: string; label: readonly LinkableNode[] };

export function variableChipHtml(name: string, label: string): string {
  const shown = escape(label.trim().length > 0 ? label : name);
  return (
    `<span data-variable="${escape(name)}" contenteditable="false" class="${VARIABLE_CHIP_CLASS}">` +
    `<span class="${VARIABLE_CHIP_LABEL_CLASS}">${shown}</span>` +
    `<span aria-hidden="true" data-variable-remove="" class="${VARIABLE_CHIP_REMOVE_CLASS}">${REMOVE_GLYPH}</span>` +
    "</span>"
  );
}

function textHtml(node: InlineText): string {
  let html = escape(node.text);
  if (node.bold) html = `<strong>${html}</strong>`;
  if (node.italic) html = `<em>${html}</em>`;
  if (node.underline) html = `<u>${html}</u>`;
  return html;
}

export function nodesToEditorHtml(
  nodes: readonly InlineNode[],
  labels: ReadonlyMap<string, string>,
): string {
  return nodes
    .map((node) => {
      if (node.kind === "text") return textHtml(node);
      if (node.kind === "variable") {
        return variableChipHtml(node.name, labels.get(node.name) ?? node.name);
      }
      const label = nodesToEditorHtml(node.label, labels);
      return `<span data-link="${escape(node.href)}" class="${LINK_SPAN_CLASS}">${label}</span>`;
    })
    .join("");
}

function isBold(element: HTMLElement): boolean {
  if (element.tagName === "B" || element.tagName === "STRONG") return true;
  const weight = element.style.fontWeight;
  if (weight === "bold" || weight === "bolder") return true;
  const numeric = Number(weight);
  return Number.isFinite(numeric) && numeric >= 600;
}

function isItalic(element: HTMLElement): boolean {
  return (
    element.tagName === "I" ||
    element.tagName === "EM" ||
    element.style.fontStyle === "italic"
  );
}

function isUnderline(element: HTMLElement): boolean {
  if (element.tagName === "U") return true;
  const decoration = `${element.style.textDecorationLine} ${element.style.textDecoration}`;
  return decoration.includes("underline");
}

function marksWithin(element: HTMLElement, inherited: Marks): Marks {
  return {
    bold: inherited.bold || isBold(element),
    italic: inherited.italic || isItalic(element),
    underline: inherited.underline || isUnderline(element),
  };
}

function sameMarks(left: Marks, right: Marks): boolean {
  return (
    left.bold === right.bold &&
    left.italic === right.italic &&
    left.underline === right.underline
  );
}

function pushText(drafts: Draft[], value: string, marks: Marks): void {
  if (value.length === 0) return;
  const last = drafts.at(-1);
  if (
    last !== undefined &&
    last.kind === "text" &&
    sameMarks(last.marks, marks)
  ) {
    last.value += value;
    return;
  }
  drafts.push({ kind: "text", value, marks });
}

function linkHrefOf(element: HTMLElement): string | null {
  const data = element.dataset.link;
  if (typeof data === "string") return data;
  if (element.tagName === "A") return element.getAttribute("href") ?? "";
  return null;
}

function walk(
  node: Node,
  marks: Marks,
  drafts: Draft[],
  options: InlineParseOptions,
  insideLink: boolean,
): void {
  if (node.nodeType === Node.TEXT_NODE) {
    pushText(drafts, node.textContent ?? "", marks);
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const element = node as HTMLElement;

  const variableName = element.dataset.variable;
  if (typeof variableName === "string" && variableName.length > 0) {
    drafts.push({ kind: "variable", name: variableName });
    return;
  }

  if (element.tagName === "BR") {
    pushText(drafts, "\n", marks);
    return;
  }

  const href = linkHrefOf(element);
  if (href !== null && options.allowLinks && !insideLink) {
    const inner: Draft[] = [];
    for (const child of Array.from(element.childNodes)) {
      walk(child, marks, inner, options, true);
    }
    const label = toLinkableNodes(settle(inner));
    if (label.length > 0) drafts.push({ kind: "link", href, label });
    return;
  }

  if (BLOCK_TAGS.has(element.tagName) && drafts.length > 0) {
    pushText(drafts, "\n", marks);
  }

  const within = options.allowMarks ? marksWithin(element, marks) : marks;
  for (const child of Array.from(element.childNodes)) {
    walk(child, within, drafts, options, insideLink);
  }
}

function settle(drafts: readonly Draft[]): readonly InlineNode[] {
  const nodes: InlineNode[] = [];

  for (const draft of drafts) {
    if (draft.kind === "variable") {
      const variable: InlineVariable = { kind: "variable", name: draft.name };
      nodes.push(variable);
      continue;
    }

    if (draft.kind === "link") {
      const linked: InlineLink = {
        kind: "link",
        href: draft.href,
        label: draft.label,
      };
      nodes.push(linked);
      continue;
    }

    if (draft.value.length === 0) continue;
    const run: InlineText = {
      kind: "text",
      text: draft.value,
      bold: draft.marks.bold,
      italic: draft.marks.italic,
      underline: draft.marks.underline,
    };
    nodes.push(run);
  }

  return nodes;
}

function trimTrailingBreak(
  nodes: readonly InlineNode[],
): readonly InlineNode[] {
  const last = nodes.at(-1);
  if (last === undefined || last.kind !== "text" || !last.text.endsWith("\n"))
    return nodes;

  const trimmed = last.text.replace(/\n$/, "");
  const head = nodes.slice(0, -1);
  if (trimmed.length === 0) return head;
  return [...head, { ...last, text: trimmed }];
}

function clamp(nodes: readonly InlineNode[]): readonly InlineNode[] {
  const bounded = nodes.slice(0, MESSAGE_DOCUMENT_LIMITS.inlineNodesMax);
  let budget = MESSAGE_DOCUMENT_LIMITS.textMax;

  return bounded.map((node) => {
    if (node.kind !== "text") return node;
    const allowed = Math.max(0, budget);
    budget -= node.text.length;
    return node.text.length <= allowed
      ? node
      : { ...node, text: node.text.slice(0, allowed) };
  });
}

export function parseEditorContent(
  root: HTMLElement,
  options: InlineParseOptions,
): readonly InlineNode[] {
  const drafts: Draft[] = [];
  for (const child of Array.from(root.childNodes)) {
    walk(child, NO_MARKS, drafts, options, false);
  }

  const settled = settle(drafts);
  const flattened = options.multiline
    ? settled
    : settled.map((node) =>
        node.kind === "text"
          ? { ...node, text: node.text.replace(/\n/g, " ") }
          : node,
      );

  return clamp(trimTrailingBreak(flattened));
}

export function fragmentToLinkable(
  fragment: DocumentFragment,
  host: HTMLElement,
  options: InlineParseOptions,
): readonly LinkableNode[] {
  const carrier = host.ownerDocument.createElement("span");
  carrier.append(fragment);
  return toLinkableNodes(
    parseEditorContent(carrier, { ...options, allowLinks: false }),
  );
}
