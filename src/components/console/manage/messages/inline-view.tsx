import type { ReactNode } from "react";

import type { InlineNode, InlineText } from "@/lib/domain/email/document";
import {
  LINK_SPAN_CLASS,
  VARIABLE_CHIP_CLASS,
  VARIABLE_CHIP_LABEL_CLASS,
} from "@/components/console/manage/messages/inline-editor-html";
import { cn } from "@/lib/utils";

export interface InlineViewProps {
  nodes: readonly InlineNode[];
  labels: ReadonlyMap<string, string>;
  placeholder?: string;
  className?: string;
}

function marked(node: InlineText): ReactNode {
  let rendered: ReactNode = node.text;
  if (node.bold)
    rendered = <strong className="font-semibold">{rendered}</strong>;
  if (node.italic) rendered = <em>{rendered}</em>;
  if (node.underline) rendered = <u>{rendered}</u>;
  return rendered;
}

function render(
  nodes: readonly InlineNode[],
  labels: ReadonlyMap<string, string>,
): ReactNode[] {
  return nodes.map((node, index) => {
    if (node.kind === "text") return <span key={index}>{marked(node)}</span>;

    if (node.kind === "variable") {
      return (
        <span key={index} className={VARIABLE_CHIP_CLASS}>
          <span className={VARIABLE_CHIP_LABEL_CLASS}>
            {labels.get(node.name) ?? node.name}
          </span>
        </span>
      );
    }

    return (
      <span key={index} className={LINK_SPAN_CLASS}>
        {render(node.label, labels)}
      </span>
    );
  });
}

export function InlineView({
  nodes,
  labels,
  placeholder,
  className,
}: InlineViewProps) {
  const empty = nodes.length === 0;

  if (empty && placeholder !== undefined) {
    return (
      <span className={cn("text-text-muted", className)}>{placeholder}</span>
    );
  }

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {render(nodes, labels)}
    </span>
  );
}
