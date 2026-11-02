/**
 * ADR-299 Decision 4 · 5 — the open text editor's handle and its edit scope. The editor (a lazy
 * ProseMirror chunk, `textEditor/EditorField.tsx`) registers a handle while it is mounted; the
 * Design panel's Typography reads the selected range's marks and writes them through it (a PM
 * transaction → `previewRecord`, no document write — the commit stays one command). The session is
 * untouched (register · release only).
 *
 * The edit scope is the editor, the Typography section and the popovers they open (리뷰 h3): focus
 * or a press inside it keeps the edit open; one outside commits.
 */
import { useSyncExternalStore } from "react";
import type { TextRunMarkKey } from "../../../../../packages/shared/src/catalog/document/textRuns";

/** The scope marker (`data-text-edit-scope`) — the editor field carries it. */
export const TEXT_EDIT_SCOPE_ATTR = "data-text-edit-scope";
/** The Design panel's Typography section (`Section id="typography"` — its root's id attribute). */
const TYPOGRAPHY_SECTION = '[data-section-id="typography"]';

/**
 * Inside the edit scope: a marked element, or an overlay (a popover · listbox · dialog in the top
 * layer — the panel's color and preset popovers portal there; another surface's overlay could only
 * be opened by a press outside the scope first, which committed).
 */
export function isInTextEditScope(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(
    `[${TEXT_EDIT_SCOPE_ATTR}], ${TYPOGRAPHY_SECTION}, .react-aria-Popover, [data-react-aria-top-layer], [role="listbox"], [role="dialog"]`,
  );
}

export interface TextEditorHandle {
  /** The edited record. */
  readonly identity: string;
  /** Whether the text takes range marks (a bound or plain-only text does not). */
  readonly rich: boolean;
  /**
   * The selected range's marks: a value, `"mixed"` where the characters differ, absent where no
   * character has one (the node's value draws them).
   */
  marks(): Partial<Record<TextRunMarkKey, unknown>>;
  /** Sets (`undefined` clears) one mark over the selected range — widened over template tokens. */
  apply(key: TextRunMarkKey, value: unknown): void;
}

let current: TextEditorHandle | undefined;
let version = 0;
const listeners = new Set<() => void>();
const notify = () => {
  version++;
  for (const listener of [...listeners]) listener();
};

/** The editor registers on mount, releases (`undefined`) on unmount. */
export function setTextEditorHandle(
  handle: TextEditorHandle | undefined,
): void {
  if (current === handle) return;
  current = handle;
  notify();
}
/** The editor's selection or marks changed — readers re-read `marks()`. */
export function notifyTextEditorChange(): void {
  notify();
}
export function getTextEditorHandle(): TextEditorHandle | undefined {
  return current;
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The open editor's handle for `identity` (re-rendered on every selection · mark change). */
export function useTextEditorHandle(
  identity: string | null | undefined,
): TextEditorHandle | undefined {
  useSyncExternalStore(subscribe, () => version);
  return current && current.identity === identity && current.rich
    ? current
    : undefined;
}
