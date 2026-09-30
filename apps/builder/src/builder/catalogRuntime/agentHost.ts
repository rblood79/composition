import { COMMAND_META } from "../config/commandMeta";
import type { ShortcutId } from "../config/keyboardShortcuts";
import type { AgentCommandHost } from "../../services/agent/agentCommandHost";
import {
  planCatalogShortcut,
  type CatalogShortcutId,
} from "./shortcuts";
import type { CatalogWorkspace } from "./workspace";

/** The document / selection commands the catalog workspace runs (the keyboard's set). */
const CATALOG_COMMANDS: ReadonlySet<string> = new Set<CatalogShortcutId>([
  "undo",
  "redo",
  "copy",
  "cut",
  "paste",
  "duplicate",
  "delete",
  "deleteAlt",
  "group",
  "ungroup",
  "bringToFront",
  "bringForward",
  "sendBackward",
  "sendToBack",
  "arrowUp",
  "arrowDown",
  "arrowLeft",
  "arrowRight",
  "nextElement",
  "prevElement",
  "selectAll",
  "detachInstance",
]);

const EMPTY_REASON: Partial<Record<ShortcutId, string>> = {
  undo: "nothing-to-undo",
  redo: "nothing-to-redo",
};

/**
 * ADR-248 Phase 4e-5: agent commands over the open catalog workspace — a document / selection
 * command runs the plan the keyboard runs (`planCatalogShortcut`, refused = its precondition),
 * one this workspace does not run yet (align, distribute, component origin toggle, …) is refused
 * instead of reaching the old store, and view commands (zoom, panels) keep their adapters.
 */
export function createCatalogAgentCommandHost(
  workspace: CatalogWorkspace,
  onError: (error: unknown) => void = () => {},
): AgentCommandHost {
  return {
    plan(id) {
      if (CATALOG_COMMANDS.has(id)) {
        const plan = planCatalogShortcut(
          workspace,
          id as CatalogShortcutId,
          onError,
        );
        return plan
          ? { run: plan }
          : { reason: EMPTY_REASON[id] ?? "not-applicable" };
      }
      const { mutation } = COMMAND_META[id];
      return mutation === "document" || mutation === "selection"
        ? { reason: "not-supported" }
        : undefined;
    },
    historyIndex: () => workspace.runtime.historyDepth.undo,
  };
}
