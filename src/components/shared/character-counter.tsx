"use client";

import { COUNTER_VISIBLE_AT_REMAINING } from "@/lib/config/console-limits";

export function showsCharacterCounter(value: string, maxLength: number): boolean {
  return maxLength - value.length <= COUNTER_VISIBLE_AT_REMAINING;
}

export interface CharacterCounterProps {
  id: string;
  value: string;
  maxLength: number;
}

export function CharacterCounter({ id, value, maxLength }: CharacterCounterProps) {
  const remaining = maxLength - value.length;

  if (!showsCharacterCounter(value, maxLength)) return null;

  return (
    <p id={id} role="status" className="text-micro tabular-nums text-text-muted">
      {remaining} {remaining === 1 ? "character" : "characters"} left
    </p>
  );
}
