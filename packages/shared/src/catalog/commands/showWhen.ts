import type { CatalogShowWhen, NodeId } from "../document/types";
import { validateCatalogEntry } from "../document/validation";
import type { CatalogCommand } from "./compose";
import { CommandDraft } from "./context";
import { assertStateOwnersLinked } from "./structure";

/**
 * ADR-256 Decision 7 — set or clear a node's `showWhen` (the states in which it is there). The
 * condition's form is the document's (validated); a stored owner address must name an ancestor
 * that gives the key (`STATE_OWNER_UNLINKED` otherwise — breakdown §1-1).
 */
export const setShowWhen =
  (input: {
    id: NodeId;
    showWhen: CatalogShowWhen | null;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const { showWhen: _previous, ...node } = draft.node(input.id);
    const next = input.showWhen ? { ...node, showWhen: input.showWhen } : node;
    validateCatalogEntry(next);
    draft.write(next);
    assertStateOwnersLinked(draft, [input.id]);
    return { label: input.label ?? "Show when", ops: draft.ops() };
  };
