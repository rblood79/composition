/**
 * ADR-248 Phase 4e-5: the document the AI reads, from the open Builder. The catalog Builder
 * installs a host (`setAiReadHost`); the tool read model (`getAiToolReadModel`), the compiler
 * state (`readCompilerState`) and the panel's local suggestions read it (4e-7: only it — without a
 * host they read an empty document; the old store host is `aiHosts.store.ts`, old-store tests only).
 */
import type { ResolvedField } from "@composition/shared";
import type { Element } from "../../types/builder/unified.types";
import type { VariableSummary } from "./tools/listVariables";

export interface AiReadHost {
  /** Changes whenever what the host reads changes (document, rows, breakpoint, selection). */
  version(): string;
  subscribe(listener: () => void): () => void;
  /** Every element of the project, parents before children (ids = drawn record identities). */
  elements(): readonly Element[];
  currentPageId(): string | null;
  /** The selected element ids (first = the primary selection). */
  selectedIds(): readonly string[];
  /** The Properties fields of an element (its edit contract with current values). */
  fields(id: string): readonly ResolvedField[];
  /** Where a new element goes now (the selection or its nearest container, else the page body). */
  creationParentId(): string | null;
  /** The project's pages (id · title). */
  pages(): readonly { id: string; title: string }[];
  /** Every interaction rule (owner = its element id). */
  interactionRules(): readonly {
    id: string;
    elementId: string;
    trigger: string;
    actionKind: string;
  }[];
  /**
   * Project variables (the data store's definitions, given) and the document's page / element
   * variables, with their use counts.
   */
  variables(
    projectDefs: readonly {
      id: string;
      name: string;
      type: string;
      defaultValue?: unknown;
    }[],
  ): readonly (VariableSummary & { defaultValue?: unknown })[];
  /** The open project (the compiler state identity). */
  projectId(): string;
  /**
   * The old canonical first-class fields of an element (`clip` · `placeholder` · `slot` ·
   * `reusable`, ADR-134) — only the old store host has them.
   */
  canonicalFields?(id: string): Readonly<Record<string, unknown>> | undefined;
}

let current: AiReadHost | null = null;

export function setAiReadHost(host: AiReadHost): () => void {
  current = host;
  return () => {
    if (current === host) current = null;
  };
}

/** Old-store tests only (`aiHosts.store.ts`, removed with the old store): the host without one installed. */
let testFallback: AiReadHost | null = null;
export function setAiReadHostTestFallback(host: AiReadHost | null): void {
  testFallback = host;
}

export function getAiReadHost(): AiReadHost | null {
  return current ?? testFallback;
}
