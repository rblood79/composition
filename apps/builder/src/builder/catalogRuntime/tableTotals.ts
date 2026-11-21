/**
 * ADR-315 Phase 5 증분 5c — a Table's 「Totals row」 switch (Design 패널 Property 탭 Behavior): on
 * fills the Table's footer (its 「Totals」 slot — RAC `TableFooter`) with one Row, a cell per column
 * reading that column's aggregate (Column 「Aggregate」 — over every row its state keeps); off
 * removes it. Whether it is on is whether the footer holds a row.
 */
import {
  setTableTotalsRow,
  tableFooterPosition,
} from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type {
  CatalogReader,
  NodeEntry,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import { catalogPaletteDefinitionId } from "./paletteInsert";

/** The Table's totals row is on: its footer holds a row. */
export function catalogTableTotalsOn(
  reader: CatalogReader,
  tableId: NodeId,
): boolean {
  const footer = tableFooterPosition(reader, tableId);
  if (!footer) return false;
  if (footer.kind === "node")
    return (reader.getEntry(footer.id) as NodeEntry | undefined)?.children
      .length
      ? true
      : false;
  if (footer.kind !== "descendant") return false;
  // (The 「Totals」 slot of the Table's template: filled with the instance's own row.)
  const table = reader.getEntry(footer.ownerId) as NodeEntry | undefined;
  const path = footer.address.templatePath.join("/");
  return !!table?.descendantOverrides.some(
    (override) =>
      override.kind === "fillSlot" &&
      override.address.templatePath.join("/") === path &&
      override.childIds.length > 0,
  );
}

/** The switch's command: on (a totals row) · off (none). */
export function catalogTableTotalsCommand(
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
  return setTableTotalsRow({
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
