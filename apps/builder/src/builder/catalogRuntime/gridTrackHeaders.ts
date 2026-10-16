/**
 * The track headers of a selected grid on the Canvas (Figma grid — 2026-10-16 사용자 「1,2,3 한번에
 * 진행」): a pill per column on the top edge and per row on the left edge, sized as the overlay
 * draws the tracks. A pill selects its track (⌘/Ctrl toggles, ⇧ extends), its label changes the
 * size (Fixed · Fill · Hug), the boundary between two pills resizes the one before it (it becomes
 * Fixed), dragging a pill moves the selected tracks, Delete removes them.
 *
 * Geometry and selection only — the edits go through the Styles host (`applyGridTracks` ·
 * `updateStyle`), the same commands as the Layout tab's 「열」 · 「행」 sections.
 */
import {
  gridTrackList,
  type GridTrack,
} from "../panels/styles/utils/gridTracks";
import type { CatalogGridTrackGeometry } from "./canvasGesture";

export type GridTrackAxis = "column" | "row";

export interface GridTrackHeader {
  index: number;
  /** Scene start and size along the axis. */
  start: number;
  size: number;
  track: GridTrack;
}

export interface GridTrackHeaders {
  columns: GridTrackHeader[];
  rows: GridTrackHeader[];
  columnGap: number;
  rowGap: number;
  frame: CatalogGridTrackGeometry["frame"];
  content: CatalogGridTrackGeometry["content"];
}

/**
 * The headers of the tracks a template lists (an implicit track, or a template the list cannot
 * show, has none — it is not editable as a track).
 */
export function gridTrackHeaders(
  layout: { gridTemplateColumns?: unknown; gridTemplateRows?: unknown },
  geometry: CatalogGridTrackGeometry,
): GridTrackHeaders {
  const axis = (
    template: unknown,
    tracks: CatalogGridTrackGeometry["columns"],
  ): GridTrackHeader[] => {
    const list =
      typeof template === "string" ? (gridTrackList(template) ?? []) : [];
    return list.slice(0, tracks.length).map((track, index) => ({
      index,
      start: tracks[index]!.start,
      size: tracks[index]!.size,
      track,
    }));
  };
  return {
    columns: axis(layout.gridTemplateColumns, geometry.columns),
    rows: axis(layout.gridTemplateRows, geometry.rows),
    columnGap: geometry.columnGap,
    rowGap: geometry.rowGap,
    frame: geometry.frame,
    content: geometry.content,
  };
}

/**
 * The selection after pressing track `index`: plain = that track (pressing the only selected one
 * keeps it), ⌘/Ctrl toggles it, ⇧ selects from the anchor to it.
 */
export function gridTrackSelection(
  selected: readonly number[],
  anchor: number | undefined,
  index: number,
  modifiers: { toggle?: boolean; range?: boolean },
): number[] {
  if (modifiers.range && anchor !== undefined) {
    const [from, to] = anchor < index ? [anchor, index] : [index, anchor];
    return Array.from({ length: to - from + 1 }, (_, at) => from + at);
  }
  if (modifiers.toggle)
    return selected.includes(index)
      ? selected.filter((at) => at !== index)
      : [...selected, index].sort((a, b) => a - b);
  return [index];
}

/**
 * Where a dragged track goes: before the track whose middle the scene position has not passed
 * (`headers.length` = after the last).
 */
export function gridTrackInsertion(
  headers: readonly GridTrackHeader[],
  position: number,
): number {
  const at = headers.findIndex(
    (header) => position < header.start + header.size / 2,
  );
  return at < 0 ? headers.length : at;
}

/** The scene position of the line before track `before` (a gap's middle; the ends at the edges). */
export function gridTrackLine(
  headers: readonly GridTrackHeader[],
  before: number,
  gap: number,
): number {
  if (!headers.length) return 0;
  if (before <= 0) return headers[0]!.start;
  const last = headers[Math.min(before, headers.length) - 1]!;
  return before >= headers.length
    ? last.start + last.size
    : last.start + last.size + gap / 2;
}

/** A dragged boundary: track `index` becomes Fixed at `px` (at least 1). */
export function gridTrackResizedTo(
  headers: readonly GridTrackHeader[],
  index: number,
  px: number,
): GridTrack[] {
  return headers.map((header) =>
    header.index === index
      ? { kind: "fixed", px: Math.max(1, Math.round(px)) }
      : header.track,
  );
}

type CellGeometry = Pick<
  CatalogGridTrackGeometry,
  "columns" | "rows" | "columnGap" | "rowGap" | "frame" | "occupied"
>;

/** The track along an axis at a scene position (a gap goes to the nearer side). */
function trackAt(
  tracks: CatalogGridTrackGeometry["columns"],
  gap: number,
  position: number,
): number | undefined {
  const at = tracks.findIndex(
    (track) =>
      position >= track.start - gap / 2 &&
      position < track.start + track.size + gap / 2,
  );
  return at < 0 ? undefined : at;
}

/**
 * The tracks whose headers show for a pointer (Figma — a header shows near the pointer only): the
 * column under it while it is over the grid or the header strip above, the row likewise with the
 * strip on the left. `reach` = how far out the strip goes (scene units).
 */
export function gridHoverTracks(
  geometry: CellGeometry,
  point: { x: number; y: number },
  reach: number,
): { column?: number; row?: number } {
  const { frame } = geometry;
  const right = frame.x + frame.width;
  const bottom = frame.y + frame.height;
  const column =
    point.y >= frame.y - reach && point.y <= bottom
      ? trackAt(geometry.columns, geometry.columnGap, point.x)
      : undefined;
  const row =
    point.x >= frame.x - reach && point.x <= right
      ? trackAt(geometry.rows, geometry.rowGap, point.y)
      : undefined;
  return {
    ...(column !== undefined ? { column } : {}),
    ...(row !== undefined ? { row } : {}),
  };
}

const cellBox = (geometry: CellGeometry, column: number, row: number) => {
  const c = geometry.columns[column]!;
  const r = geometry.rows[row]!;
  return { x: c.start, y: r.start, width: c.size, height: r.size };
};

const isOccupied = (geometry: CellGeometry, column: number, row: number) =>
  !!geometry.occupied[row * geometry.columns.length + column];

/** The empty cell under a scene point (none in a gap, an item's cell or outside). */
export function gridEmptyCellAt(
  geometry: CellGeometry,
  point: { x: number; y: number },
): { column: number; row: number } | undefined {
  const column = geometry.columns.findIndex(
    (track) => point.x >= track.start && point.x < track.start + track.size,
  );
  const row = geometry.rows.findIndex(
    (track) => point.y >= track.start && point.y < track.start + track.size,
  );
  if (column < 0 || row < 0 || isOccupied(geometry, column, row))
    return undefined;
  return { column, row };
}

/** A cell's scene box. */
export function gridCellBox(
  geometry: CellGeometry,
  column: number,
  row: number,
): { x: number; y: number; width: number; height: number } | undefined {
  return geometry.columns[column] && geometry.rows[row]
    ? cellBox(geometry, column, row)
    : undefined;
}

/**
 * The selected tracks' fill (Figma): every cell of them no item takes — an item's cell stays
 * clear.
 */
export function gridTrackFill(
  geometry: CellGeometry,
  axis: GridTrackAxis,
  indices: readonly number[],
): { x: number; y: number; width: number; height: number }[] {
  const across = axis === "column" ? geometry.rows : geometry.columns;
  return indices.flatMap((index) =>
    across.flatMap((_, other) => {
      const [column, row] = axis === "column" ? [index, other] : [other, index];
      if (!geometry.columns[column] || !geometry.rows[row]) return [];
      return isOccupied(geometry, column, row)
        ? []
        : [cellBox(geometry, column, row)];
    }),
  );
}
