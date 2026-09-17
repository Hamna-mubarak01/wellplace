import type {
  AuthoredBlock,
  AuthoredDocument,
} from "@/lib/domain/email/document";
import type { TemplateSettingsValue } from "@/components/console/manage/messages/template-settings";
import { MESSAGE_EDITOR } from "@/lib/config/message-documents";

export interface TemplateDraft {
  readonly document: AuthoredDocument;
  readonly settings: TemplateSettingsValue;
}

export interface EditorHistory {
  readonly past: readonly TemplateDraft[];
  readonly present: TemplateDraft;
  readonly future: readonly TemplateDraft[];
  readonly group: string | null;
  readonly changedAt: number;
}

export type EditorHistoryAction =
  | { type: "change"; draft: TemplateDraft; group?: string; now: number }
  | { type: "undo" }
  | { type: "redo" };

export function startHistory(draft: TemplateDraft): EditorHistory {
  return { past: [], present: draft, future: [], group: null, changedAt: 0 };
}

// [OUR CHOICE] Group typing in one field; style and structural actions each undo separately.
export function blockTypingGroup(
  previous: AuthoredBlock | undefined,
  next: AuthoredBlock,
): string | undefined {
  if (!previous || previous.id !== next.id || previous.kind !== next.kind)
    return undefined;
  function changedTextPath(
    before: unknown,
    after: unknown,
    path: string,
  ): string | undefined {
    if (typeof before === "string" && typeof after === "string") return path;
    if (
      !before ||
      !after ||
      typeof before !== "object" ||
      typeof after !== "object"
    )
      return undefined;
    if (
      Array.isArray(before) &&
      Array.isArray(after) &&
      before.length !== after.length
    )
      return undefined;
    const left = before as Record<string, unknown>;
    const right = after as Record<string, unknown>;
    const changed = [
      ...new Set([...Object.keys(left), ...Object.keys(right)]),
    ].filter((key) => JSON.stringify(left[key]) !== JSON.stringify(right[key]));
    if (changed.length !== 1 || changed[0] === "appearance") return undefined;
    const key = changed[0];
    return changedTextPath(left[key], right[key], `${path}:${key}`);
  }
  return changedTextPath(previous, next, next.id);
}

export function editorHistory(
  state: EditorHistory,
  action: EditorHistoryAction,
): EditorHistory {
  if (action.type === "undo") {
    const previous = state.past.at(-1);
    return previous === undefined
      ? state
      : {
          past: state.past.slice(0, -1),
          present: previous,
          future: [state.present, ...state.future],
          group: null,
          changedAt: 0,
        };
  }
  if (action.type === "redo") {
    const next = state.future.at(0);
    return next === undefined
      ? state
      : {
          past: [...state.past, state.present].slice(
            -MESSAGE_EDITOR.historyDepth,
          ),
          present: next,
          future: state.future.slice(1),
          group: null,
          changedAt: 0,
        };
  }
  if (JSON.stringify(state.present) === JSON.stringify(action.draft))
    return state;
  const coalesce =
    action.group !== undefined &&
    action.group === state.group &&
    action.now - state.changedAt < MESSAGE_EDITOR.coalesceMs &&
    state.future.length === 0;
  return {
    past: coalesce
      ? state.past
      : [...state.past, state.present].slice(-MESSAGE_EDITOR.historyDepth),
    present: action.draft,
    future: [],
    group: action.group ?? null,
    changedAt: action.now,
  };
}
