/**
 * Rows 「자동」 (Figma grid Rows Auto — 2026-10-16 사용자 결정 「Figma 에 맞춰」): a grid with no row
 * template has the rows its items take, and "any empty rows — rows without cell objects — are
 * removed". CSS keeps an empty row between pinned items (an implicit track), so every step that
 * touches such a grid's items (a drop, a delete, a move out) closes the empty rows in the same
 * step: the pinned items below one move up by the rows above them that went empty.
 *
 * Per breakpoint (desktop → tablet → mobile, each read through the cascade on the staged result):
 * a breakpoint whose effective layout is an Auto-row grid is compacted with writes at that
 * breakpoint.
 */
import {
  setFields,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands";
import { stageOver } from "../../../../../packages/shared/src/catalog/commands/compose";
import type {
  BreakpointName,
  CatalogReader,
  LayoutWrites,
  NodeEntry,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import { gridTrackList } from "../panels/styles/utils/gridTracks";
import { gridPlacement, lineTrack } from "./canvasGridCells";

const BREAKPOINTS: readonly BreakpointName[] = ["desktop", "tablet", "mobile"];

type LayoutKey = keyof LayoutWrites;

/** A layout field's value at a breakpoint (base, then tablet, then mobile over it). */
function layoutValue(
  node: NodeEntry,
  breakpoint: BreakpointName,
  key: LayoutKey,
): string | undefined {
  const read = (layout: LayoutWrites | undefined) => {
    const write = layout?.[key] as
      { kind?: string; value?: unknown } | undefined;
    if (!write) return undefined;
    return write.kind === "set" ? String(write.value ?? "") : "";
  };
  let value = read(node.layout);
  const layers =
    breakpoint === "mobile"
      ? (["tablet", "mobile"] as const)
      : breakpoint === "tablet"
        ? (["tablet"] as const)
        : [];
  for (const layer of layers) {
    const next = read(node.responsive?.[layer]?.layout);
    if (next !== undefined) value = next;
  }
  return value;
}

const isNode = (entry: unknown): entry is NodeEntry =>
  !!entry && (entry as { kind?: string }).kind === "node";

/** The empty-row compaction of one grid at one breakpoint (none when nothing moves). */
function compaction(
  reader: CatalogReader,
  grid: NodeEntry,
  breakpoint: BreakpointName,
): CatalogCommand | undefined {
  const display = layoutValue(grid, breakpoint, "display");
  if (display !== "grid" && display !== "inline-grid") return undefined;
  if (layoutValue(grid, breakpoint, "gridTemplateRows")?.trim())
    return undefined;
  const items = grid.children
    .map((id) => reader.getEntry(id))
    .filter(isNode)
    .filter(
      (node) =>
        node.enabled !== false &&
        // Out of flow at this breakpoint (ADR-275 — authored or rule-placed alike).
        layoutValue(node, breakpoint, "position") !== "absolute",
    );
  if (!items.length) return undefined;
  const columns =
    gridTrackList(layoutValue(grid, breakpoint, "gridTemplateColumns") ?? "")
      ?.length || 1;
  const lines = items.map((node) => ({
    column: layoutValue(node, breakpoint, "gridColumnStart"),
    row: layoutValue(node, breakpoint, "gridRowStart"),
    columnEnd: layoutValue(node, breakpoint, "gridColumnEnd"),
    rowEnd: layoutValue(node, breakpoint, "gridRowEnd"),
  }));
  const { cells } = gridPlacement(lines, columns);
  const last = Math.max(0, ...cells.map((cell) => cell.row + cell.rowSpan));
  const used = new Set<number>();
  for (const cell of cells)
    for (let row = cell.row; row < cell.row + cell.rowSpan; row++)
      used.add(row);
  const empty = Array.from({ length: last }, (_, row) => row).filter(
    (row) => !used.has(row),
  );
  if (!empty.length) return undefined;
  const targets = items.flatMap((node, index) => {
    const row = lineTrack(lines[index]!.row);
    if (row === undefined) return [];
    const up = empty.filter((gone) => gone < row).length;
    return up ? [{ id: node.id, row: row - up }] : [];
  });
  if (!targets.length) return undefined;
  return (stage) => ({
    label: "Close empty rows",
    ops: targets.flatMap(
      ({ id, row }) =>
        setFields({
          targets: [{ kind: "node", id: id as NodeId }],
          breakpoint,
          layout: { gridRowStart: { kind: "set", value: String(row + 1) } },
        })(stage).ops,
    ),
  });
}

/**
 * `command`, then the empty rows of the Auto-row grids it touched closed (one step). A grid is
 * touched when one of its children — or the grid itself — is written or removed.
 */
export function catalogGridAutoRows(command: CatalogCommand): CatalogCommand {
  return (reader) => {
    const plan = command(reader);
    if (!plan.ops.length) return plan;
    const touched = new Set<string>();
    for (const op of plan.ops) {
      const id = op.kind === "put" ? op.entry.id : op.id;
      if (op.kind === "put" && op.entry.kind !== "node") continue;
      touched.add(id);
      const owner = reader.ownerOf(id);
      if (owner) touched.add(owner);
    }
    const stage = stageOver(reader);
    stage.apply(plan.ops);
    for (const id of [...touched]) {
      const owner = stage.ownerOf(id);
      if (owner) touched.add(owner);
    }
    const ops = [...plan.ops];
    for (const id of touched) {
      for (const breakpoint of BREAKPOINTS) {
        const grid = stage.getEntry(id);
        if (!isNode(grid) || !grid.children.length) break;
        const close = compaction(stage, grid, breakpoint);
        if (!close) continue;
        const next = close(stage);
        stage.apply(next.ops);
        ops.push(...next.ops);
      }
    }
    return ops.length === plan.ops.length ? plan : { ...plan, ops };
  };
}
