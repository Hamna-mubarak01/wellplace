"use client";

import { useRef, useState } from "react";

export interface ReorderHandlers {
  dragging: number | null;
  over: number | null;
  itemProps: (index: number) => {
    onDragOver: (event: React.DragEvent) => void;
    onDrop: (event: React.DragEvent) => void;
    onDragLeave: () => void;
    "data-dragging"?: true;
    "data-drop-target"?: true;
  };
  handleProps: (index: number, label: string) => {
    draggable: true;
    onDragStart: (event: React.DragEvent) => void;
    onDragEnd: () => void;
    onKeyDown: (event: React.KeyboardEvent) => void;
    role: "button";
    tabIndex: 0;
    "aria-label": string;
    className: string;
  };
}

export function useReorder<T>(
  items: readonly T[],
  onChange: (next: readonly T[]) => void,
): ReorderHandlers {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const source = useRef<number | null>(null);

  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= items.length) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    if (item !== undefined) next.splice(to, 0, item);
    onChange(next);
  }

  return {
    dragging,
    over,
    itemProps: (index) => ({
      onDragOver: (event) => {
        event.preventDefault();
        if (source.current !== null && source.current !== index) setOver(index);
      },
      onDragLeave: () => setOver((current) => (current === index ? null : current)),
      onDrop: (event) => {
        event.preventDefault();
        if (source.current !== null) move(source.current, index);
        source.current = null;
        setDragging(null);
        setOver(null);
      },
      ...(dragging === index ? ({ "data-dragging": true } as const) : {}),
      ...(over === index ? ({ "data-drop-target": true } as const) : {}),
    }),
    handleProps: (index, label) => ({
      draggable: true,
      onDragStart: (event) => {
        source.current = index;
        setDragging(index);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(index));
      },
      onDragEnd: () => {
        source.current = null;
        setDragging(null);
        setOver(null);
      },
      onKeyDown: (event) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          move(index, index - 1);
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          move(index, index + 1);
        }
      },
      role: "button",
      tabIndex: 0,
      "aria-label": `${label}. Drag to reorder, or use the arrow keys.`,
      className:
        "flex size-tap shrink-0 cursor-grab items-center justify-center rounded-(--radius-control) text-text-muted transition-colors hover:bg-surface-hover hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none active:cursor-grabbing",
    }),
  };
}
