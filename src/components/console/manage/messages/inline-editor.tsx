"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";

import {
  InlineToolbar,
  type InlineMark,
  type InlineMarkState,
} from "@/components/console/manage/messages/inline-toolbar";
import { InlineLinkDialog } from "@/components/console/manage/messages/inline-link-dialog";
import {
  fragmentToLinkable,
  nodesToEditorHtml,
  parseEditorContent,
  variableChipHtml,
  type InlineParseOptions,
} from "@/components/console/manage/messages/inline-editor-html";
import {
  toLinkableNodes,
  variableLabels,
} from "@/components/console/manage/messages/message-document-model";
import type { MessageVariable } from "@/lib/config/message-documents";
import type { InlineNode, LinkableNode } from "@/lib/domain/email/document";
import { cn } from "@/lib/utils";

export type VariableInserter = (name: string) => void;

interface InlineEditorBase {
  ariaLabel: string;
  id?: string;
  labelledBy?: string;
  variables: readonly MessageVariable[];
  placeholder?: string;
  multiline?: boolean;
  allowMarks?: boolean;
  disabled?: boolean;
  toolbar?: boolean;
  onActivate?: (insert: VariableInserter) => void;
  className?: string;
}

export type InlineEditorProps =
  | (InlineEditorBase & {
      linkable: true;
      value: readonly LinkableNode[];
      onChange: (nodes: readonly LinkableNode[]) => void;
    })
  | (InlineEditorBase & {
      linkable?: false;
      value: readonly InlineNode[];
      onChange: (nodes: readonly InlineNode[]) => void;
    });

const NO_MARKS: InlineMarkState = {
  bold: false,
  italic: false,
  underline: false,
};

function variableElementAt(node: ChildNode | null): HTMLElement | null {
  if (node === null || !(node instanceof HTMLElement)) return null;
  return typeof node.dataset.variable === "string" ? node : null;
}

function chipBeforeCaret(range: Range): HTMLElement | null {
  if (!range.collapsed) return null;
  const container = range.startContainer;

  if (container.nodeType === Node.TEXT_NODE) {
    if (range.startOffset > 0) return null;
    return variableElementAt(container.previousSibling);
  }

  if (range.startOffset === 0) return null;
  return variableElementAt(container.childNodes[range.startOffset - 1] ?? null);
}

function chipAfterCaret(range: Range): HTMLElement | null {
  if (!range.collapsed) return null;
  const container = range.startContainer;

  if (container.nodeType === Node.TEXT_NODE) {
    if (range.startOffset < (container.textContent ?? "").length) return null;
    return variableElementAt(container.nextSibling);
  }

  return variableElementAt(container.childNodes[range.startOffset] ?? null);
}

function enclosingLink(
  node: Node | null,
  host: HTMLElement,
): HTMLElement | null {
  let current: Node | null = node;
  while (current !== null && current !== host) {
    if (
      current instanceof HTMLElement &&
      typeof current.dataset.link === "string"
    )
      return current;
    current = current.parentNode;
  }
  return null;
}

export function InlineEditor(props: InlineEditorProps) {
  const {
    ariaLabel,
    id,
    labelledBy,
    variables,
    placeholder,
    multiline = false,
    allowMarks = true,
    disabled = false,
    toolbar = true,
    onActivate,
    className,
  } = props;

  const allowLinks = props.linkable !== true && allowMarks;
  const host = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [focused, setFocused] = useState(false);
  const [marks, setMarks] = useState<InlineMarkState>(NO_MARKS);
  const [insideLink, setInsideLink] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [linkDraft, setLinkDraft] = useState<{
    href: string;
    text: string;
  } | null>(null);

  const labels = useMemo(() => variableLabels(variables), [variables]);
  const value: readonly InlineNode[] = props.value;
  const html = useMemo(() => nodesToEditorHtml(value, labels), [value, labels]);
  const [initialHtml] = useState(html);
  const serialized = useRef(initialHtml);

  const options: InlineParseOptions = { allowLinks, allowMarks, multiline };

  useEffect(() => {
    const element = host.current;
    if (element === null || html === serialized.current) return;
    serialized.current = html;
    element.innerHTML = html;
  }, [html]);

  function emit() {
    const element = host.current;
    if (element === null) return;
    const parsed = parseEditorContent(element, options);
    serialized.current = nodesToEditorHtml(parsed, labels);
    if (props.linkable === true) props.onChange(toLinkableNodes(parsed));
    else props.onChange(parsed);
  }

  function activeRange(): Range | null {
    const element = host.current;
    const selection =
      element?.ownerDocument.defaultView?.getSelection() ?? null;
    if (element === null || selection === null || selection.rangeCount === 0)
      return null;
    const range = selection.getRangeAt(0);
    return element.contains(range.commonAncestorContainer) ? range : null;
  }

  function remember() {
    const range = activeRange();
    if (range !== null) savedRange.current = range.cloneRange();
  }

  function refreshState() {
    const element = host.current;
    const range = activeRange();
    if (element === null) return;

    setHasSelection(range !== null && !range.collapsed);
    setInsideLink(
      range === null
        ? false
        : enclosingLink(range.commonAncestorContainer, element) !== null,
    );

    if (!allowMarks) return;
    const owner = element.ownerDocument;
    setMarks({
      bold: owner.queryCommandState("bold"),
      italic: owner.queryCommandState("italic"),
      underline: owner.queryCommandState("underline"),
    });
  }

  useEffect(() => {
    if (!focused) return;
    const element = host.current;
    if (element === null) return;
    const owner = element.ownerDocument;
    const listener = () => {
      remember();
      refreshState();
    };
    owner.addEventListener("selectionchange", listener);
    return () => owner.removeEventListener("selectionchange", listener);
  });

  function placeCaretAfter(node: Node) {
    const element = host.current;
    if (element === null) return;
    const selection = element.ownerDocument.defaultView?.getSelection() ?? null;
    const range = element.ownerDocument.createRange();
    range.setStartAfter(node);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
    savedRange.current = range.cloneRange();
  }

  function workingRange(): Range | null {
    const element = host.current;
    if (element === null) return null;
    const live = activeRange();
    if (live !== null) return live;
    const stored = savedRange.current;
    if (stored !== null && element.contains(stored.commonAncestorContainer))
      return stored;
    const end = element.ownerDocument.createRange();
    end.selectNodeContents(element);
    end.collapse(false);
    return end;
  }

  function insertMarkup(range: Range, markup: string) {
    const element = host.current;
    if (element === null) return;
    const template = element.ownerDocument.createElement("template");
    template.innerHTML = markup;
    const node = template.content.firstChild;
    if (node === null) return;

    range.deleteContents();
    range.insertNode(node);
    placeCaretAfter(node);
    emit();
  }

  function insertHtml(markup: string) {
    const element = host.current;
    if (element === null || disabled) return;
    const range = workingRange()?.cloneRange();
    if (range === undefined) return;
    element.focus();
    insertMarkup(range, markup);
  }

  function insertVariable(name: string) {
    insertHtml(variableChipHtml(name, labels.get(name) ?? name));
  }

  function runCommand(command: string) {
    const element = host.current;
    if (element === null) return;
    element.focus();
    const owner = element.ownerDocument;
    owner.execCommand("styleWithCSS", false, "false");
    owner.execCommand(command);
    emit();
    refreshState();
  }

  function openLinkDialog() {
    const element = host.current;
    const range = activeRange() ?? savedRange.current;
    if (element === null || range === null) return;
    remember();
    const existing = enclosingLink(range.commonAncestorContainer, element);
    setLinkDraft({
      href: existing?.dataset.link ?? "",
      text: existing === null ? range.toString() : (existing.textContent ?? ""),
    });
  }

  function applyLink(href: string) {
    setLinkDraft(null);
    const element = host.current;
    if (element === null) return;
    element.focus();

    const range = savedRange.current;
    if (range === null || !element.contains(range.commonAncestorContainer))
      return;

    const existing = enclosingLink(range.commonAncestorContainer, element);
    if (existing !== null) {
      existing.dataset.link = href;
      emit();
      return;
    }

    if (range.collapsed) return;
    const label = fragmentToLinkable(range.extractContents(), element, options);
    if (label.length === 0) return;
    insertMarkup(
      range,
      nodesToEditorHtml([{ kind: "link", href, label }], labels),
    );
  }

  function removeLink() {
    const element = host.current;
    const range = activeRange() ?? savedRange.current;
    if (element === null || range === null) return;
    const existing = enclosingLink(range.commonAncestorContainer, element);
    if (existing === null) return;
    existing.replaceWith(...Array.from(existing.childNodes));
    emit();
    refreshState();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!multiline) return;
      const element = host.current;
      if (element === null) return;
      const range = workingRange();
      if (range === null) return;
      const line = element.ownerDocument.createTextNode("\n");
      range.deleteContents();
      range.insertNode(line);
      placeCaretAfter(line);
      emit();
      return;
    }

    if (event.key !== "Backspace" && event.key !== "Delete") return;
    const range = activeRange();
    if (range === null) return;
    const chip =
      event.key === "Backspace"
        ? chipBeforeCaret(range)
        : chipAfterCaret(range);
    if (chip === null) return;
    event.preventDefault();
    chip.remove();
    emit();
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text/plain");
    const cleaned = multiline ? pasted : pasted.replace(/\s+/g, " ");
    if (cleaned.length === 0) return;
    const element = host.current;
    if (element === null) return;
    element.ownerDocument.execCommand("insertText", false, cleaned);
    emit();
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest("[data-variable-remove]");
    if (control === null) return;
    event.preventDefault();
    control.closest("[data-variable]")?.remove();
    emit();
  }

  const showPlaceholder = html.length === 0 && placeholder !== undefined;
  const showToolbar = toolbar && allowMarks && !disabled;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      {showToolbar && (
        <InlineToolbar
          marks={marks}
          allowLinks={allowLinks}
          insideLink={insideLink}
          hasSelection={hasSelection}
          disabled={disabled}
          onToggleMark={(mark: InlineMark) => runCommand(mark)}
          onAddLink={openLinkDialog}
          onRemoveLink={removeLink}
        />
      )}

      <div className="relative min-w-0">
        {showPlaceholder && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-3 top-2 truncate text-console-body text-text-muted"
          >
            {placeholder}
          </span>
        )}

        <div
          ref={host}
          id={id}
          role="textbox"
          aria-label={labelledBy === undefined ? ariaLabel : undefined}
          aria-labelledby={labelledBy}
          aria-multiline={multiline}
          aria-disabled={disabled || undefined}
          tabIndex={disabled ? -1 : 0}
          contentEditable={!disabled}
          suppressContentEditableWarning
          spellCheck
          dangerouslySetInnerHTML={{ __html: initialHtml }}
          onInput={() => {
            emit();
            remember();
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onClick={handleClick}
          onFocus={() => {
            setFocused(true);
            onActivate?.(insertVariable);
            refreshState();
          }}
          onBlur={() => {
            remember();
            setFocused(false);
          }}
          className={cn(
            "min-h-tap w-full rounded-(--radius-control) border border-border-interactive bg-surface-raised px-3 py-2 text-console-body whitespace-pre-wrap text-text-primary outline-none",
            "focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-focus-ring",
            multiline && "min-h-console-panel",
            disabled && "cursor-not-allowed bg-surface-sunken text-text-muted",
          )}
        />
      </div>

      {linkDraft !== null && (
        <InlineLinkDialog
          open
          href={linkDraft.href}
          selectedText={linkDraft.text}
          variables={variables}
          onConfirm={applyLink}
          onCancel={() => setLinkDraft(null)}
        />
      )}
    </div>
  );
}
