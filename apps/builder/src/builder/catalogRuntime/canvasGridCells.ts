/**
 * The cells of a grid container as the Canvas overlay shows them (Figma, measured 2026-10-15):
 * every cell outlined while the grid is selected, hovered or dragged over, and the empty cell an
 * appended node goes to filled during a drag.
 *
 * Overlay geometry only — never a layout input (the engine places the items). Both axes size their
 * tracks the CSS way (common cases): px · % fixed, `fr` shares the free space, a content-sized track
 * (`auto` …) takes its largest item and — with no `fr` track — an equal share of the free space
 * (the default `normal` content alignment stretches auto tracks). Rows past the row template are
 * implicit `auto` rows. Items sit where CSS places them: their authored lines (`gridPlacement`),
 * else auto-placed around those. A column template we cannot count (`auto-fill` …) falls back to
 * the columns and rows the items show.
 */
import { parseGridTemplate } from "../../../../../packages/shared/src/catalog/runtime/gridStyleAdapter";

export interface GridBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A CSS length as px (a number, or "12" · "12px"); anything else is undefined. */
export function lengthPx(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^-?\d+(\.\d+)?(px)?$/.test(value.trim()))
    return parseFloat(value);
  return undefined;
}

/** `repeat(n, a b)` expanded; auto-fill / auto-fit (count unknown here) → undefined. */
function expandTracks(template: string | undefined): string[] | undefined {
  const out: string[] = [];
  for (const token of parseGridTemplate(template)) {
    const repeat = /^repeat\(\s*([^,]+)\s*,\s*(.+)\)$/.exec(token);
    if (!repeat) {
      out.push(token);
      continue;
    }
    const count = Number(repeat[1]);
    if (!Number.isInteger(count) || count < 1) return undefined;
    const inner = parseGridTemplate(repeat[2]);
    for (let i = 0; i < count; i++) out.push(...inner);
  }
  return out;
}

interface TrackKind {
  fixed?: number;
  fr?: number;
}

/** A template token's sizing: px · % fixed, `fr` (also a `minmax(…, fr)` max), else content. */
function trackKind(token: string | undefined, length: number): TrackKind {
  if (!token) return {};
  const max = /^minmax\(\s*[^,]+,\s*(.+)\)$/.exec(token)?.[1]?.trim() ?? token;
  const px = lengthPx(max);
  if (px !== undefined) return { fixed: px };
  const percent = /^(\d+(\.\d+)?)%$/.exec(max);
  if (percent) return { fixed: (length * Number(percent[1])) / 100 };
  const flex = /^(\d+(\.\d+)?)fr$/.exec(max);
  if (flex) return { fr: Number(flex[1]) };
  return {};
}

/** Track sizes along `length`; `content` = the largest item per track (0 for none). */
function sizeTracks(
  kinds: readonly TrackKind[],
  content: readonly number[],
  length: number,
  gap: number,
): { start: number; size: number }[] {
  const sizes = kinds.map(
    (kind, index) => kind.fixed ?? (kind.fr ? 0 : (content[index] ?? 0)),
  );
  const used =
    sizes.reduce((sum, size) => sum + size, 0) +
    gap * Math.max(0, kinds.length - 1);
  const free = Math.max(0, length - used);
  const totalFr = kinds.reduce((sum, kind) => sum + (kind.fr ?? 0), 0);
  if (totalFr > 0)
    kinds.forEach((kind, index) => {
      if (kind.fr)
        sizes[index] = Math.max(
          content[index] ?? 0,
          (free * kind.fr) / totalFr,
        );
    });
  else {
    const auto = kinds.filter((kind) => kind.fixed === undefined).length;
    if (auto)
      kinds.forEach((kind, index) => {
        if (kind.fixed === undefined) sizes[index]! += free / auto;
      });
  }
  let cursor = 0;
  return sizes.map((size) => {
    const track = { start: cursor, size };
    cursor += size + gap;
    return track;
  });
}

/**
 * An item's authored grid lines (CSS `grid-column-start` · `-end` · `grid-row-start` · `-end`): a
 * 1-based start line, and a span (`span n` on the end line, or on the start line).
 */
export interface GridItemLines {
  column?: unknown;
  row?: unknown;
  columnEnd?: unknown;
  rowEnd?: unknown;
}

/** A positive line number as a 0-based track; `auto`, `span n`, negative or none → undefined. */
function lineTrack(value: unknown): number | undefined {
  const text = typeof value === "number" ? String(value) : value;
  if (typeof text !== "string" || !/^\d+$/.test(text.trim())) return undefined;
  const line = Number(text);
  return line >= 1 ? line - 1 : undefined;
}

/** `span n` → n; anything else → undefined. */
export function lineSpan(value: unknown): number | undefined {
  const match = typeof value === "string" ? /^span\s+(\d+)$/.exec(value.trim()) : null;
  const span = match ? Number(match[1]) : NaN;
  return span >= 1 ? span : undefined;
}

/** An item's cell area: its top-left track and how many tracks it spans each way. */
export interface GridArea {
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
}

/**
 * The area (0-based row and column, spans) of each item — CSS grid placement, row flow, sparse:
 * items with both start lines first, then those locked to a row, then the rest in order with the
 * auto-placement cursor (an item with a column only goes down that column from the cursor). A
 * span wider than the columns is clamped to them; a line past the columns makes implicit columns:
 * `columns` is the count with them.
 */
export function gridPlacement(
  lines: readonly (GridItemLines | undefined)[],
  columnCount: number,
): { cells: GridArea[]; columns: number } {
  let columns = Math.max(1, columnCount);
  const taken = new Set<string>();
  const cells: GridArea[] = [];
  const items = lines.map((item) => {
    const column = lineTrack(item?.column);
    const row = lineTrack(item?.row);
    return {
      row,
      column,
      rowSpan: lineSpan(item?.rowEnd) ?? lineSpan(item?.row) ?? 1,
      columnSpan: Math.min(
        lineSpan(item?.columnEnd) ?? lineSpan(item?.column) ?? 1,
        column === undefined ? columns : Infinity,
      ),
    };
  });
  const fits = (
    row: number,
    column: number,
    rowSpan: number,
    columnSpan: number,
  ) => {
    for (let r = row; r < row + rowSpan; r++)
      for (let c = column; c < column + columnSpan; c++)
        if (taken.has(`${r}:${c}`)) return false;
    return true;
  };
  const take = (index: number, area: GridArea) => {
    cells[index] = area;
    for (let r = area.row; r < area.row + area.rowSpan; r++)
      for (let c = area.column; c < area.column + area.columnSpan; c++)
        taken.add(`${r}:${c}`);
    columns = Math.max(columns, area.column + area.columnSpan);
  };
  items.forEach((item, index) => {
    if (item.row !== undefined && item.column !== undefined)
      take(index, { ...item, row: item.row, column: item.column });
  });
  items.forEach((item, index) => {
    if (item.row === undefined || item.column !== undefined) return;
    let at = 0;
    while (!fits(item.row, at, item.rowSpan, item.columnSpan)) at++;
    take(index, { ...item, row: item.row, column: at });
  });
  let cursorRow = 0;
  let cursorColumn = 0;
  items.forEach((item, index) => {
    if (item.row !== undefined) return;
    const { rowSpan, columnSpan } = item;
    if (item.column !== undefined) {
      if (item.column < cursorColumn) cursorRow++;
      while (!fits(cursorRow, item.column, rowSpan, columnSpan)) cursorRow++;
      take(index, { row: cursorRow, column: item.column, rowSpan, columnSpan });
      cursorColumn = item.column + columnSpan;
      return;
    }
    for (;;) {
      if (cursorColumn + columnSpan > columns) {
        cursorRow++;
        cursorColumn = 0;
      }
      if (fits(cursorRow, cursorColumn, rowSpan, columnSpan)) break;
      cursorColumn++;
    }
    take(index, { row: cursorRow, column: cursorColumn, rowSpan, columnSpan });
    cursorColumn += columnSpan;
  });
  return { cells, columns };
}

/** A grid as the overlay reads it: its cells (row-major) and which item takes each one. */
export interface GridLayout {
  cells: GridBox[];
  /** Columns per row of `cells`. */
  columns: number;
  /** Per cell: the index of the item in it (a spanning item is in each of its cells), else -1. */
  occupant: number[];
  /** Per item: its area. */
  areas: GridArea[];
  /** The tracks (sizes, and whether the template fixes them — px · % · `fr` — or content does). */
  tracks: GridTracks;
}

export interface GridTracks {
  columns: { size: number; definite: boolean }[];
  rows: { size: number; definite: boolean }[];
  columnGap: number;
  rowGap: number;
}

/**
 * How many tracks from `start` an item of `length` takes (Figma — a dropped or resized item takes
 * the cells its size covers; the cells keep their size): the fewest whose span reaches the length.
 * A content-sized start track grows with the item instead (one track). Past the last track the
 * last size repeats (implicit tracks).
 */
export function coveredSpan(
  tracks: readonly { size: number; definite: boolean }[],
  start: number,
  gap: number,
  length: number,
): number {
  const first = tracks[start] ?? tracks[tracks.length - 1];
  if (!first?.definite || first.size <= 0) return 1;
  let total = 0;
  for (let n = 1; n <= 64; n++) {
    const track = tracks[start + n - 1] ?? tracks[tracks.length - 1]!;
    total += track.size + (n > 1 ? gap : 0);
    if (total >= length - 0.5) return n;
  }
  return 64;
}

/**
 * The grid's cells, row-major. `items` are the drawn boxes of the flow children in document order;
 * `lines` their authored grid lines and spans (none: auto-placed, one cell). With
 * `appendRow` (a drag) one more implicit row follows when no cell is empty — where an appended node
 * goes.
 */
export function gridLayout(input: {
  content: GridBox;
  columns: string | undefined;
  columnGap: number;
  rowGap: number;
  items: readonly GridBox[];
  lines?: readonly (GridItemLines | undefined)[];
  fallbackHeight: number;
  /** The row template: its tracks are cells even without items. */
  rows?: string;
  /** One more row for an append (a drag) — off for showing the grid as it is (selection). */
  appendRow?: boolean;
}): GridLayout {
  const { content, columnGap, rowGap, items } = input;
  const columnTokens = expandTracks(input.columns);
  let columns: { start: number; size: number }[];
  let placed: GridArea[];
  let columnDefinite: boolean[] = [];
  if (columnTokens?.length) {
    const placement = gridPlacement(
      items.map((_, index) => input.lines?.[index]),
      columnTokens.length,
    );
    placed = placement.cells;
    const tokens = Array.from(
      { length: placement.columns },
      (_, column) => columnTokens[column],
    );
    // A spanning item does not size a track (its tracks come from the others).
    const widths = tokens.map((_, column) =>
      Math.max(
        0,
        ...items
          .filter(
            (_, i) => placed[i]!.column === column && placed[i]!.columnSpan === 1,
          )
          .map((box) => box.width),
      ),
    );
    columnDefinite = tokens.map((token) => {
      const kind = trackKind(token, content.width);
      return kind.fixed !== undefined || kind.fr !== undefined;
    });
    columns = sizeTracks(
      tokens.map((token) => trackKind(token, content.width)),
      widths,
      content.width,
      columnGap,
    ).map((track) => ({ start: content.x + track.start, size: track.size }));
  } else {
    // No template we can count: the columns and rows the items show.
    const xs = [...new Set(items.map((box) => Math.round(box.x)))].sort(
      (a, b) => a - b,
    );
    const ys = [...new Set(items.map((box) => Math.round(box.y)))].sort(
      (a, b) => a - b,
    );
    columns = xs.map((x) => {
      const box = items.find((item) => Math.round(item.x) === x)!;
      return { start: box.x, size: box.width };
    });
    placed = items.map((box) => ({
      row: ys.indexOf(Math.round(box.y)),
      column: xs.indexOf(Math.round(box.x)),
      rowSpan: 1,
      columnSpan: 1,
    }));
  }
  if (!columns.length)
    return {
      cells: [],
      columns: 0,
      occupant: [],
      areas: [],
      tracks: { columns: [], rows: [], columnGap, rowGap },
    };
  const cols = columns.length;
  const rowTokens = expandTracks(input.rows) ?? [];
  const rowCount = Math.max(
    Math.max(0, ...placed.map((cell) => cell.row + cell.rowSpan)),
    rowTokens.length,
    1,
  );
  const heights = Array.from({ length: rowCount }, (_, row) =>
    Math.max(
      0,
      ...items
        .filter((_, i) => placed[i]!.row === row && placed[i]!.rowSpan === 1)
        .map((box) => box.height),
    ),
  );
  const rowKinds = Array.from({ length: rowCount }, (_, row) =>
    trackKind(rowTokens[row], content.height),
  );
  const rows = sizeTracks(
    rowKinds,
    heights,
    content.height,
    rowGap,
  ).map((track) => ({ start: content.y + track.start, size: track.size }));
  const occupant = new Array<number>(rowCount * cols).fill(-1);
  placed.forEach((area, index) => {
    for (let r = area.row; r < area.row + area.rowSpan; r++)
      for (let c = area.column; c < Math.min(cols, area.column + area.columnSpan); c++)
        occupant[r * cols + c] = index;
  });
  if (input.appendRow !== false && !occupant.includes(-1)) {
    const last = rows[rows.length - 1]!;
    rows.push({
      start: last.start + last.size + rowGap,
      size: last.size || input.fallbackHeight,
    });
    occupant.push(...new Array<number>(cols).fill(-1));
  }
  const cells = rows.flatMap((row) =>
    columns.map((column) => ({
      x: column.start,
      y: row.start,
      width: column.size,
      height: row.size,
    })),
  );
  const tracks: GridTracks = {
    columns: columns.map((column, index) => ({
      size: column.size,
      definite: columnDefinite[index] ?? false,
    })),
    rows: rows.map((row, index) => {
      const kind = rowKinds[index];
      return {
        size: row.size,
        definite: !!kind && (kind.fixed !== undefined || kind.fr !== undefined),
      };
    }),
    columnGap,
    rowGap,
  };
  return { cells, columns: cols, occupant, areas: placed, tracks };
}

/** {@link gridLayout}'s cells (auto-placed items unless `lines` says otherwise). */
export function gridCells(input: Parameters<typeof gridLayout>[0]): GridBox[] {
  return gridLayout(input).cells;
}
