/**
 * ADR-248 Phase 4e-5: the document the AI reads, from the open Builder. The catalog Builder
 * installs a host (`setAiReadHost`); the tool read model (`getAiToolReadModel`), the compiler
 * state (`readCompilerState`) and the panel's local suggestions read it instead of the old
 * canonical / element stores. Without a host they read the old stores.
 */
import type { ResolvedField } from "@composition/shared";
import type { Element } from "../../types/builder/unified.types";

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
  /** The open project (the compiler state identity). */
  projectId(): string;
}

let current: AiReadHost | null = null;

export function setAiReadHost(host: AiReadHost): () => void {
  current = host;
  return () => {
    if (current === host) current = null;
  };
}

export function getAiReadHost(): AiReadHost | null {
  return current;
}
