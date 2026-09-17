import {
  AlignLeftIcon,
  Columns3Icon,
  CodeIcon,
  FileIcon,
  FilmIcon,
  GalleryVerticalIcon,
  QuoteIcon,
  RectangleHorizontalIcon,
  HeadingIcon,
  ImageIcon,
  LinkIcon,
  MinusIcon,
  MoveVerticalIcon,
  Rows3Icon,
  SquareMousePointerIcon,
  StickyNoteIcon,
  TagIcon,
  TextQuoteIcon,
  type LucideIcon,
} from "lucide-react";

import {
  inlineToText,
  IMAGE_WIDTH,
  SPACER_HEIGHT,
  text,
  type AuthoredBlock,
  type AuthoredBlockKind,
  type AuthoredDocument,
  type DocumentProblem,
  type InlineNode,
  type LinkableNode,
} from "@/lib/domain/email/document";
import {
  MESSAGE_DOCUMENT_GROUPS,
  MESSAGE_DOCUMENT_LIMITS,
  type MessageDocumentGroup,
  type MessageVariable,
} from "@/lib/config/message-documents";

export type PaletteGroup = "content" | "layout";

export interface BlockMeta {
  readonly label: string;
  readonly group: PaletteGroup;
  readonly Icon: LucideIcon;
  readonly hint: string;
}

export const BLOCK_META: Readonly<Record<AuthoredBlockKind, BlockMeta>> = {
  band: {
    label: "Band",
    group: "layout",
    Icon: RectangleHorizontalIcon,
    hint: "Highlight a message on a tinted background.",
  },
  quote: {
    label: "Quote",
    group: "layout",
    Icon: QuoteIcon,
    hint: "A quotation or a short testimonial.",
  },
  columns: {
    label: "Columns",
    group: "layout",
    Icon: Columns3Icon,
    hint: "Two or three text columns that stack on a phone.",
  },
  hero: {
    label: "Hero",
    group: "layout",
    Icon: GalleryVerticalIcon,
    hint: "A wide image with an introduction below it.",
  },
  video: {
    label: "Video",
    group: "content",
    Icon: FilmIcon,
    hint: "A clickable thumbnail that opens your video.",
  },
  file: {
    label: "File",
    group: "content",
    Icon: FileIcon,
    hint: "A download link to a brochure or document.",
  },
  html: {
    label: "HTML",
    group: "content",
    Icon: CodeIcon,
    hint: "Custom email markup. Scripts and unsafe content are removed.",
  },
  text: {
    label: "Text",
    group: "content",
    Icon: AlignLeftIcon,
    hint: "A paragraph. Words, links and details that change per guest.",
  },
  heading: {
    label: "Heading",
    group: "content",
    Icon: HeadingIcon,
    hint: "The large line that opens the email.",
  },
  eyebrow: {
    label: "Small heading",
    group: "content",
    Icon: TagIcon,
    hint: "A short label above the heading, such as Booking confirmed.",
  },
  lead: {
    label: "Introduction",
    group: "content",
    Icon: TextQuoteIcon,
    hint: "The larger opening sentence under the heading.",
  },
  note: {
    label: "Note",
    group: "content",
    Icon: StickyNoteIcon,
    hint: "A quieter line for small print and reminders.",
  },
  button: {
    label: "Button",
    group: "content",
    Icon: SquareMousePointerIcon,
    hint: "One clear action, such as View your receipt.",
  },
  links: {
    label: "Links",
    group: "content",
    Icon: LinkIcon,
    hint: "A short list of links under one label.",
  },
  panel: {
    label: "Details panel",
    group: "layout",
    Icon: Rows3Icon,
    hint: "Label and value rows for booking details.",
  },
  divider: {
    label: "Divider",
    group: "layout",
    Icon: MinusIcon,
    hint: "A hairline between two parts of the email.",
  },
  spacer: {
    label: "Spacer",
    group: "layout",
    Icon: MoveVerticalIcon,
    hint: "Empty height between blocks.",
  },
  image: {
    label: "Image",
    group: "layout",
    Icon: ImageIcon,
    hint: "A picture hosted at an https address.",
  },
};

export const PALETTE_GROUPS: readonly {
  readonly group: PaletteGroup;
  readonly label: string;
  readonly kinds: readonly AuthoredBlockKind[];
}[] = [
  {
    group: "content",
    label: "Content",
    kinds: [
      "text",
      "image",
      "button",
      "divider",
      "spacer",
      "video",
      "html",
      "file",
      "heading",
      "lead",
      "eyebrow",
      "note",
      "links",
    ],
  },
  {
    group: "layout",
    label: "Layout",
    kinds: ["band", "hero", "panel", "quote", "columns"],
  },
];

export const EDITOR_HISTORY_DEPTH = 50;

export const MESSAGE_GROUP_LABEL: Readonly<
  Record<MessageDocumentGroup, string>
> = Object.fromEntries(
  MESSAGE_DOCUMENT_GROUPS.map((entry) => [entry.value, entry.label]),
) as Readonly<Record<MessageDocumentGroup, string>>;

export function newBlockId(kind: AuthoredBlockKind): string {
  const random =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${kind}-${random}`;
}

export function createBlock(kind: AuthoredBlockKind): AuthoredBlock {
  const id = newBlockId(kind);

  switch (kind) {
    case "band":
      return { kind, id, content: [text("")] };
    case "quote":
      return { kind, id, content: [text("")] };
    case "columns":
      return { kind, id, columns: [[text("")], [text("")]] };
    case "hero":
      return { kind, id, src: "", alt: "", content: [text("")] };
    case "video":
      return {
        kind,
        id,
        src: "",
        alt: "",
        href: "",
        label: [text("Watch video")],
      };
    case "file":
      return { kind, id, href: "", label: [text("Download file")] };
    case "html":
      return { kind, id, markup: "" };

    case "eyebrow":
      return { kind, id, content: [text("")] };
    case "heading":
      return { kind, id, content: [text("")] };
    case "lead":
      return { kind, id, content: [text("")] };
    case "text":
      return { kind, id, content: [text("")], align: "left", size: "normal" };
    case "note":
      return { kind, id, content: [text("")] };
    case "panel":
      return { kind, id, rows: [{ label: [text("")], value: [text("")] }] };
    case "button":
      return { kind, id, label: [text("")], href: "" };
    case "links":
      return {
        kind,
        id,
        label: [text("")],
        items: [{ label: [text("")], href: "" }],
      };
    case "divider":
      return { kind, id };
    case "spacer":
      return { kind, id, height: SPACER_HEIGHT.fallback };
    case "image":
      return { kind, id, src: "", alt: "", width: IMAGE_WIDTH.fallback };
  }
}

export function withBlocks(
  source: AuthoredDocument,
  blocks: readonly AuthoredBlock[],
): AuthoredDocument {
  return { ...source, blocks };
}

export function insertBlock(
  source: AuthoredDocument,
  block: AuthoredBlock,
  index: number,
): AuthoredDocument {
  if (source.blocks.length >= MESSAGE_DOCUMENT_LIMITS.blocksMax) return source;
  const blocks = [...source.blocks];
  blocks.splice(Math.max(0, Math.min(index, blocks.length)), 0, block);
  return withBlocks(source, blocks);
}

export function appendBlock(
  source: AuthoredDocument,
  block: AuthoredBlock,
): AuthoredDocument {
  if (source.blocks.length >= MESSAGE_DOCUMENT_LIMITS.blocksMax) return source;
  return withBlocks(source, [...source.blocks, block]);
}

export function replaceBlock(
  source: AuthoredDocument,
  block: AuthoredBlock,
): AuthoredDocument {
  return withBlocks(
    source,
    source.blocks.map((entry) => (entry.id === block.id ? block : entry)),
  );
}

export function removeBlock(
  source: AuthoredDocument,
  blockId: string,
): AuthoredDocument {
  return withBlocks(
    source,
    source.blocks.filter((entry) => entry.id !== blockId),
  );
}

export function duplicateBlock(
  source: AuthoredDocument,
  blockId: string,
): AuthoredDocument {
  const index = source.blocks.findIndex((entry) => entry.id === blockId);
  if (index === -1 || source.blocks.length >= MESSAGE_DOCUMENT_LIMITS.blocksMax)
    return source;

  const original = source.blocks[index];
  const copy = { ...original, id: newBlockId(original.kind) } as AuthoredBlock;
  const blocks = [...source.blocks];
  blocks.splice(index + 1, 0, copy);
  return withBlocks(source, blocks);
}

export function moveBlock(
  source: AuthoredDocument,
  blockId: string,
  target: number,
): AuthoredDocument {
  const from = source.blocks.findIndex((entry) => entry.id === blockId);
  if (from === -1) return source;

  const blocks = [...source.blocks];
  const [moved] = blocks.splice(from, 1);
  const to = Math.max(
    0,
    Math.min(blocks.length, target > from ? target - 1 : target),
  );
  blocks.splice(to, 0, moved);
  return withBlocks(source, blocks);
}

export function duplicatedBlockId(
  before: AuthoredDocument,
  after: AuthoredDocument,
): string | null {
  const known = new Set(before.blocks.map((entry) => entry.id));
  return after.blocks.find((entry) => !known.has(entry.id))?.id ?? null;
}

export function toLinkableNodes(
  nodes: readonly InlineNode[],
): readonly LinkableNode[] {
  return nodes.flatMap((node) =>
    node.kind === "link" ? [...node.label] : [node],
  );
}

export function variableLabels(
  variables: readonly MessageVariable[],
): ReadonlyMap<string, string> {
  return new Map(variables.map((entry) => [entry.name, entry.label]));
}

export function blockLabel(block: AuthoredBlock): string {
  return BLOCK_META[block.kind].label;
}

export function problemBlockId(problem: DocumentProblem): string | null {
  switch (problem.kind) {
    case "block_blank":
    case "bad_link":
    case "image_without_description":
      return problem.blockId;
    case "subject_blank":
    case "no_blocks":
    case "renders_empty":
    case "unknown_variable":
      return null;
  }
}

export function describeProblem(
  problem: DocumentProblem,
  labelFor: (blockId: string) => string,
): string {
  switch (problem.kind) {
    case "subject_blank":
      return "The subject line is empty. Write the line guests read in their inbox.";
    case "no_blocks":
      return "This email has nothing in it. Add a block from the palette.";
    case "renders_empty":
      return "Nothing in this email would reach the guest. Every block is empty or has an address that will not open.";
    case "block_blank":
      return `${labelFor(problem.blockId)} carries no words. Write its wording or remove the block.`;
    case "unknown_variable":
      return `“${problem.name}” is not one of this email's details. Remove it and pick one from Insert variable.`;
    case "bad_link":
      return `${labelFor(problem.blockId)} has an address that will not open. Use an https:// address, a mailto: address, or a variable.`;
    case "image_without_description":
      return "The picture has no description. Describe it for anyone whose email hides pictures.";
  }
}

export function blockSummary(block: AuthoredBlock): string {
  if ("content" in block) return inlineToText(block.content, {});
  if ("label" in block) return inlineToText(block.label, {});
  if (block.kind === "image") return block.alt || "No image description yet";
  if (block.kind === "columns")
    return block.columns.map((column) => inlineToText(column, {})).join(" · ");
  if (block.kind === "panel")
    return block.rows.map((row) => inlineToText(row.label, {})).join(" · ");
  if (block.kind === "spacer") return `${block.height}px space`;
  return BLOCK_META[block.kind].hint;
}
