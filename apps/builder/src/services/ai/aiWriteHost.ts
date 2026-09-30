/**
 * ADR-248 Phase 4e-5: the document the AI writes, in the open Builder. The catalog Builder installs
 * a host (`setAiWriteHost`); the element tools (create / update / delete / batch) write through it
 * instead of the old store actions — each write one history step, a batch one step. Results are
 * read back through the read host (`AiReadHost`), as the tools verify. Without a host the old
 * store actions apply.
 */
import type { FillItem } from "../../types/builder/fill.types";

export type AiWriteResult<T = object> =
  ({ ok: true } & T) | { ok: false; error: string };

export interface AiElementWrite {
  /** Semantic props (the element's Properties contract keys). */
  props?: Readonly<Record<string, unknown>>;
  /** CSS keys (the Styles panel's keys), at the open breakpoint. */
  styles?: Readonly<Record<string, unknown>>;
  fills?: readonly FillItem[];
}

export interface AiWriteHost {
  /** Add an element of a palette type under `parentId` (an element id), or where a new element goes. */
  create(
    input: AiElementWrite & { type: string; parentId: string | null },
  ): AiWriteResult<{ elementId: string; parentId: string | null }>;
  update(id: string, input: AiElementWrite): AiWriteResult;
  remove(id: string): AiWriteResult;
  /** Run several writes as one history step (`label`). */
  batch<T>(label: string, run: () => Promise<T>): Promise<T>;
}

let current: AiWriteHost | null = null;

export function setAiWriteHost(host: AiWriteHost): () => void {
  current = host;
  return () => {
    if (current === host) current = null;
  };
}

export function getAiWriteHost(): AiWriteHost | null {
  return current;
}
