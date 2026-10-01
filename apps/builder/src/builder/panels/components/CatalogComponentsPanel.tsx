import { useCallback } from "react";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogPageContentTarget } from "../../catalogRuntime/pageSettings";
import { catalogPaletteInsertCommand } from "../../catalogRuntime/paletteInsert";
import {
  CatalogWorkspaceGate,
  useCatalogSession,
  useCatalogWorkspace,
} from "../../catalogRuntime/react";
import { useToastStore } from "../../stores/toast";
import { useCatalogCommandRunner } from "../navigator/catalog/useCatalogCommandRunner";
import ComponentList from "./ComponentList";

/**
 * ADR-248 Phase 4e-4: the Components palette of the open catalog project — the same list; a
 * palette item is one insert command (into the selection, its nearest accepting ancestor, or the
 * open page's body) and the new node is selected.
 */
export function CatalogComponentsPanel() {
  return (
    <CatalogWorkspaceGate>
      <CatalogComponentsContent />
    </CatalogWorkspaceGate>
  );
}

function CatalogComponentsContent() {
  const workspace = useCatalogWorkspace();
  const run = useCatalogCommandRunner();
  const selected = useCatalogSession((state) => state.selection[0]?.identity);
  const handleAddElement = useCallback(
    (
      type: string,
      _parentId?: string,
      initialProps?: Record<string, unknown>,
    ) => {
      const { pageId, definitionView } = workspace.session.getSnapshot();
      // The definition edit view inserts into its template root (no selection), not the page.
      const page = workspace.runtime.graph.getEntry(
        definitionView ?? pageId ?? "",
      );
      const command = catalogPaletteInsertCommand(
        {
          graph: workspace.runtime.graph,
          records: workspace.root.domInputs,
          selection: () => workspace.session.getSnapshot().selection,
          itemOfRecord: (identity) => workspace.itemOfRecord(identity),
          pageContent: () =>
            page?.kind === "page"
              ? page.children[0]
                ? catalogPageContentTarget(
                    workspace.runtime.graph,
                    page.children[0],
                  )
                : undefined
              : page?.kind === "definition" && page.templateRootId
                ? { kind: "node", id: page.templateRootId }
                : undefined,
          newId: workspace.newId,
        },
        type,
        initialProps,
      );
      if (command) run(command);
      else
        useToastStore
          .getState()
          .showToast("error", `${type}: NESTING_NOT_ALLOWED`);
    },
    [run, workspace],
  );
  return (
    <ComponentList
      handleAddElement={handleAddElement}
      selectedElementId={selected ?? null}
    />
  );
}
