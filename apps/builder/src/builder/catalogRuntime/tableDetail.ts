/**
 * ADR-315 Phase 5 증분 5e — a bound Table's 「Detail row」 switch (Design 패널 Property 탭
 * Behavior): on puts a Row with one cell after the Row template's cells — each data row expands to
 * it, read with that row's values; off removes it. Whether it is on is whether the template holds
 * a Row.
 */
import {
  setTableDetailRow,
  tableBodyPosition,
} from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type {
  CatalogReader,
  NodeEntry,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import { catalogPaletteDefinitionId } from "./paletteInsert";

/** The Table's Row template (its body's repeating row) — a node — or undefined. */
function templateRowOf(
  reader: CatalogReader,
  tableId: NodeId,
): NodeEntry | undefined {
  const body = tableBodyPosition(reader, tableId);
  if (!body) return undefined;
  const table = reader.getEntry(tableId) as NodeEntry | undefined;
  const ids =
    body.kind === "node"
      ? ((reader.getEntry(body.id) as NodeEntry | undefined)?.children ?? [])
      : body.kind === "descendant"
        ? ((
            table?.descendantOverrides.find(
              (override) =>
                override.kind === "fillSlot" &&
                override.address.templatePath.join("/") ===
                  body.address.templatePath.join("/"),
            ) as { childIds?: readonly NodeId[] } | undefined
          )?.childIds ?? [])
        : [];
  return ids
    .map((id) => reader.getEntry(id) as NodeEntry | undefined)
    .find((row) => row?.kind === "node" && row.repeat === true);
}

/** The Table has a detail row: its Row template holds a Row; undefined = no Row template. */
export function catalogTableDetailOn(
  reader: CatalogReader,
  tableId: NodeId,
): boolean | undefined {
  const row = templateRowOf(reader, tableId);
  if (!row) return undefined;
  return row.children.some((id) => {
    const child = reader.getEntry(id) as NodeEntry | undefined;
    try {
      return (
        child?.kind === "node" &&
        definitionTypeName(reader, child.definitionId) === "Row"
      );
    } catch {
      return false;
    }
  });
}

/** The switch's command: on (a detail row) · off (none). */
export function catalogTableDetailCommand(
  reader: CatalogReader,
  tableId: NodeId,
  on: boolean,
  newId: NewId,
): CatalogCommand {
  const entry = (definitionId: string, children: NodeId[] = []): NodeEntry => ({
    kind: "node",
    id: newId("node") as NodeId,
    definitionId: definitionId as NodeEntry["definitionId"],
    children,
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  });
  return setTableDetailRow({
    tableId,
    on,
    buildCell: () => {
      const cell = entry(catalogPaletteDefinitionId(reader.library, "Cell"));
      return { entries: [cell], rootId: cell.id };
    },
    buildRow: (cellIds) =>
      entry(catalogPaletteDefinitionId(reader.library, "Row"), [...cellIds]),
    newId,
  });
}
