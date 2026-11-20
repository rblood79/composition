/**
 * ADR-315 Phase 4 증분 4d — a Table's 「Column visibility menu」 switch (breakdown §5.3 · §6 —
 * 「열 선택 메뉴」): on places a Menu (the palette's MenuTrigger origin) before the Table, connected
 * to it (`columnsOf`) — its first item repeats per data column, checked when shown, and its
 * selection is the Preview's Table state (`hiddenColumns` — the session takes it, no rule). Off
 * takes the menus connected to that Table away.
 */
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import { setFields } from "../../../../../packages/shared/src/catalog/commands/fields";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import { setColumnChooser } from "../../../../../packages/shared/src/catalog/commands/rowDisplay";
import {
  insertNodes,
  removeTargets,
} from "../../../../../packages/shared/src/catalog/commands/structure";
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type {
  LibraryDefinitionId,
  NodeEntry,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  childPositions,
  nodePosition,
} from "../../../../../packages/shared/src/catalog/resolution/positions";
import { catalogParentOfNode } from "./insertParent";
import {
  catalogCreationProps,
  catalogPaletteDefinitionId,
} from "./paletteInsert";
import { childIdsOf, sequence } from "./viewAuthoring";

/** The palette type a column chooser is (the MenuTrigger origin 「Menu」). */
const CHOOSER_TYPE = "Menu";

/** The column choosers connected to a Table (instances of the chooser origin with `columnsOf`). */
export function catalogTableColumnChoosers(
  graph: Pick<CatalogGraph, "library" | "instancesOf" | "getEntry">,
  tableId: NodeId,
): NodeId[] {
  let definitionId: string;
  try {
    definitionId = catalogPaletteDefinitionId(graph.library, CHOOSER_TYPE);
  } catch {
    return [];
  }
  return [...graph.instancesOf(definitionId)].filter((id) => {
    const entry = graph.getEntry(id);
    return entry?.kind === "node" && entry.columnsOf === tableId;
  }) as NodeId[];
}

/** The switch on: a chooser before the Table — its trigger named `label`, its Menu multi-select. */
export function catalogTableColumnChooserCommand(
  plan: { readonly tableId: NodeId; readonly label: string },
  newId: NewId,
): { command: CatalogCommand; created: { chooserId: NodeId } } {
  const chooserId = newId("node") as NodeId;
  const command = sequence("Add column chooser", [
    (stage) => {
      const parent = catalogParentOfNode(stage, plan.tableId);
      if (!parent) throw new Error(`NO_PARENT: ${plan.tableId}`);
      const definitionId = catalogPaletteDefinitionId(
        stage.library,
        CHOOSER_TYPE,
      ) as LibraryDefinitionId;
      const entry: NodeEntry = {
        kind: "node",
        id: chooserId,
        definitionId,
        children: [],
        props: {
          ...catalogCreationProps(stage, definitionId, CHOOSER_TYPE),
          selectionMode: { kind: "set", value: "multiple" },
        },
        visual: {},
        sizing: {},
        descendantOverrides: [],
      };
      return insertNodes({
        parent,
        index: childIdsOf(stage, parent).indexOf(plan.tableId),
        entries: [entry],
        rootIds: [chooserId],
        newId,
      });
    },
    () => setColumnChooser(chooserId, plan.tableId),
    // (Its trigger reads 「Columns」 — the origin's ActionButton position under the instance.)
    (stage) => {
      const trigger = childPositions(stage, nodePosition(stage, chooserId)).find(
        (child) => {
          try {
            return definitionTypeName(stage, child.definitionId) === "ActionButton";
          } catch {
            return false;
          }
        },
      );
      return trigger
        ? setFields({
            targets: [trigger.target],
            props: { label: { kind: "set", value: plan.label } },
          })
        : undefined;
    },
  ]);
  return { command, created: { chooserId } };
}

/** The switch off: the choosers connected to the Table go. */
export function catalogRemoveTableColumnChoosersCommand(
  graph: Pick<CatalogGraph, "library" | "instancesOf" | "getEntry">,
  tableId: NodeId,
): CatalogCommand | undefined {
  const choosers = catalogTableColumnChoosers(graph, tableId);
  return choosers.length
    ? removeTargets({
        targets: choosers.map((id) => ({ kind: "node" as const, id })),
      })
    : undefined;
}
