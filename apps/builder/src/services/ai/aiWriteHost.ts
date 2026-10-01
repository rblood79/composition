/**
 * ADR-248 Phase 4e-5: the document the AI writes, in the open Builder. The catalog Builder installs
 * a host (`setAiWriteHost`); the element tools (create / update / delete / batch) write through it
 * instead of the old store actions — each write one history step, a batch one step. Results are
 * read back through the read host (`AiReadHost`), as the tools verify. Without a host the tools
 * fail (4e-7; the old store host is `aiHosts.store.ts`, old-store tests only).
 */
import type { ToolTranslate } from "../../types/integrations/ai.types";
import type { InteractionAction } from "@composition/shared";
import type { FillItem } from "../../types/builder/fill.types";

export type AiWriteResult<T = object> =
  ({ ok: true } & T) | { ok: false; error: string };

/** A write's result, now or after a confirmation (the old store host asks before origin edits). */
type MaybeAsync<T> = T | Promise<T>;

export interface AiElementWrite {
  /** Semantic props (the element's Properties contract keys). */
  props?: Readonly<Record<string, unknown>>;
  /** CSS keys (the Styles panel's keys), at the open breakpoint. */
  styles?: Readonly<Record<string, unknown>>;
  fills?: readonly FillItem[];
  /**
   * The old canonical first-class fields (ADR-134): `clip` (a Frame's overflow), `placeholder` and
   * `slot` (the node's slot declaration — inside a component template), `reusable: true` (the node
   * becomes a component; an instance takes its place and is the element from then on).
   */
  canonical?: {
    clip?: boolean;
    placeholder?: boolean;
    slot?: false | readonly string[];
    reusable?: boolean;
  };
}

export interface AiWriteHost {
  /**
   * Add an element of a palette type under `parentId` (an element id), or where a new element goes.
   * `composite` = a component made with its children (the old store host's palette branch).
   * `t` = the language of the error text.
   */
  create(
    input: AiElementWrite & { type: string; parentId: string | null },
    t?: ToolTranslate,
  ): MaybeAsync<
    AiWriteResult<{
      elementId: string;
      parentId: string | null;
      composite?: { mode: string; childCount: number };
    }>
  >;
  /**
   * `elementId` = the element after the write (another one when it became a component);
   * `canonicalApplied` = whether the canonical fields applied (omitted = all of them).
   */
  update(
    id: string,
    input: AiElementWrite,
    t?: ToolTranslate,
  ): MaybeAsync<
    AiWriteResult<{ elementId: string; canonicalApplied?: boolean }>
  >;
  remove(id: string, t?: ToolTranslate): MaybeAsync<AiWriteResult>;
  /** Add an interaction rule on an element (the old rule action shape); one step. */
  addInteraction(
    elementId: string,
    trigger: string,
    action: InteractionAction,
  ): MaybeAsync<AiWriteResult<{ ruleId: string }>>;
  /** Run several writes as one history step (`label`). */
  batch<T>(label: string, run: () => Promise<T>): Promise<T>;
}

/** A write tool's error without a host (no Builder open). */
export const AI_WRITE_HOST_MISSING = "AI write host is not provided";

let current: AiWriteHost | null = null;

export function setAiWriteHost(host: AiWriteHost): () => void {
  current = host;
  return () => {
    if (current === host) current = null;
  };
}

/** Old-store tests only (`aiHosts.store.ts`, removed with the old store): the host without one installed. */
let testFallback: AiWriteHost | null = null;
export function setAiWriteHostTestFallback(host: AiWriteHost | null): void {
  testFallback = host;
}

export function getAiWriteHost(): AiWriteHost | null {
  return current ?? testFallback;
}
