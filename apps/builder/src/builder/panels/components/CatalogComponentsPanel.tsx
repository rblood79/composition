import { useCallback } from "react";
import {
  chartCreationNeedsFamily,
  completeChartCreationProps,
} from "@composition/rendering";
import { definitionTypeName } from "../../../../../../packages/shared/src/catalog/commands/context";
import {
  notifyChartFamilyLoadFailed,
  notifyInsertRelocated,
  notifyOperationRefused,
} from "../../catalogRuntime/operationNotice";
import { catalogPageContentTarget } from "../../catalogRuntime/pageSettings";
import { catalogPaletteInsertPlan } from "../../catalogRuntime/paletteInsert";
import {
  CatalogWorkspaceGate,
  useCatalogSession,
  useCatalogWorkspace,
} from "../../catalogRuntime/react";
import { useCatalogCommandRunner } from "../../catalogRuntime/commandRunner";
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
  const insert = useCallback(
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
      const plan = catalogPaletteInsertPlan(
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
      if (!plan.command) {
        notifyOperationRefused(plan.refusal);
        return;
      }
      if (!run(plan.command)) return;
      // Not where the user aimed (the selection): the old creation notice, with undo (one step).
      if (plan.relocated) {
        const { target } = plan.relocated;
        const node =
          target.kind === "node"
            ? workspace.runtime.graph.getEntry(target.id)
            : undefined;
        notifyInsertRelocated(
          plan.relocated.refusal,
          node?.kind === "node"
            ? definitionTypeName(workspace.runtime.graph, node.definitionId)
            : "",
          () => workspace.undo(),
        );
      }
    },
    [run, workspace],
  );
  // ADR-306 (R5) — a Chart of a family type waits for its family's sample rows before the insert
  //   command runs (the command stays synchronous; the selection at that moment is the target).
  const handleAddElement = useCallback(
    (
      type: string,
      parentId?: string,
      initialProps?: Record<string, unknown>,
    ) => {
      if (!chartCreationNeedsFamily(initialProps)) {
        insert(type, parentId, initialProps);
        return;
      }
      void completeChartCreationProps(initialProps!).then(
        (props) => insert(type, parentId, props),
        (error: unknown) => notifyChartFamilyLoadFailed(error),
      );
    },
    [insert],
  );
  return (
    <ComponentList
      handleAddElement={handleAddElement}
      selectedElementId={selected ?? null}
    />
  );
}
