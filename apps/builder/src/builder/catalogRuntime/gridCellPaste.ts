/**
 * Paste into a selected grid cell (Figma grid — 2026-10-16 사용자 「남은 차이 전부 맞춰」): with a cell of
 * the selected grid selected, a paste goes into the grid and its first copy is pinned to that cell
 * (one step). Other copies follow the grid's auto-placement.
 */
import {
  pasteNodes,
  setFields,
  type CatalogClipboard,
  type NewId,
} from "../../../../../packages/shared/src/catalog/commands";
import {
  stageOver,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import type {
  BreakpointName,
  CatalogReader,
  EditTarget,
} from "../../../../../packages/shared/src/catalog/document/types";
import { catalogInsertParent } from "./insertParent";

export function catalogGridCellPasteCommand(input: {
  graph: CatalogReader;
  /** The grid's edit target. */
  target: EditTarget;
  clipboard: CatalogClipboard;
  newId: NewId;
  breakpoint: BreakpointName;
  /** Track indices (0-based). */
  cell: { column: number; row: number };
}): CatalogCommand | undefined {
  const parent = catalogInsertParent(input.graph, input.target);
  if (!parent) return undefined;
  const paste = pasteNodes({
    clipboard: input.clipboard,
    parent,
    newId: input.newId,
  });
  return (reader) => {
    const stage = stageOver(reader);
    const plan = paste(stage);
    stage.apply(plan.ops);
    const first = plan.selectAfter?.[0];
    if (!first) return plan;
    const pin = setFields({
      targets: [{ kind: "node", id: first }],
      breakpoint: input.breakpoint,
      layout: {
        gridColumnStart: { kind: "set", value: String(input.cell.column + 1) },
        gridRowStart: { kind: "set", value: String(input.cell.row + 1) },
      },
    })(stage);
    return { ...plan, ops: [...plan.ops, ...pin.ops] };
  };
}
