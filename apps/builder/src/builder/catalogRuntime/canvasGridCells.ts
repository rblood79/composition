/**
 * The cells of a grid container as a Canvas drag shows them (Figma, measured 2026-10-15): every
 * cell outlined while dragging over the grid, and the empty cell an appended node goes to filled.
 *
 * Overlay geometry only — never a layout input (the engine places the items). Columns come from the
 * template (px · fr · % · `repeat(n, …)` · `minmax(…, fr)`); a content-sized one (`auto` …) takes
 * the drawn box of an item in it (else 1fr). Rows come from their items; a row without items
 * repeats the previous row's height.
 */
import { parseGridTemplate } from "../../../../../packages/shared/src/catalog/runtime/gridStyleAdapter";

export interface GridBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Track {
  start: number;
  size: number;
  /** Sized by the template (px · % · fr); false = content-sized (`auto` …) — an item tells it. */
  exact?: boolean;
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

/** Track sizes along `length` (gaps between): px fixed, % of the length, the rest by fr. */
function resolveTracks(
  tokens: readonly string[],
  length: number,
  gap: number,
): Track[] {
  const fixed: (number | undefined)[] = [];
  const fr: number[] = [];
  const exact: boolean[] = [];
  for (const token of tokens) {
    const max =
      /^minmax\(\s*[^,]+,\s*(.+)\)$/.exec(token)?.[1]?.trim() ?? token;
    const px = lengthPx(max);
    const percent = /^(\d+(\.\d+)?)%$/.exec(max);
    const flex = /^(\d+(\.\d+)?)fr$/.exec(max);
    exact.push(px !== undefined || !!percent || !!flex);
    if (px !== undefined) (fixed.push(px), fr.push(0));
    else if (percent)
      (fixed.push((length * Number(percent[1])) / 100), fr.push(0));
    else (fixed.push(undefined), fr.push(flex ? Number(flex[1]) : 1));
  }
  const used =
    fixed.reduce<number>((sum, size) => sum + (size ?? 0), 0) +
    gap * Math.max(0, tokens.length - 1);
  const totalFr = fr.reduce((sum, value) => sum + value, 0);
  const free = Math.max(0, length - used);
  let cursor = 0;
  return tokens.map((_, index) => {
    const size = fixed[index] ?? (totalFr ? (free * fr[index]!) / totalFr : 0);
    const track = { start: cursor, size, exact: exact[index] };
    cursor += size + gap;
    return track;
  });
}

/**
 * The grid's cells, row-major: enough rows for `count` placed items plus one more (where an
 * appended node goes). `items` are the drawn boxes of the flow children in document order (an
 * auto-placed grid without spans).
 */
export function gridCells(input: {
  content: GridBox;
  columns: string | undefined;
  columnGap: number;
  rowGap: number;
  items: readonly GridBox[];
  count: number;
  fallbackHeight: number;
}): GridBox[] {
  const { content, columnGap, rowGap, items } = input;
  const tokens = expandTracks(input.columns);
  let columns: Track[];
  if (tokens?.length) {
    columns = resolveTracks(tokens, content.width, columnGap).map((track) => ({
      start: content.x + track.start,
      size: track.size,
      exact: track.exact,
    }));
  } else {
    // No template we can read: the columns the items show.
    const xs = [...new Set(items.map((box) => Math.round(box.x)))].sort(
      (a, b) => a - b,
    );
    columns = xs.map((x) => {
      const box = items.find((item) => Math.round(item.x) === x)!;
      return { start: box.x, size: box.width };
    });
  }
  if (!columns.length) return [];
  const cols = columns.length;
  // A content-sized column holding an item: that item's box (the engine's track, under stretch).
  items.forEach((box, index) => {
    const column = columns[index % cols];
    if (column && !column.exact && index < cols) {
      column.start = box.x;
      column.size = box.width;
    }
  });
  const rowCount = Math.ceil((input.count + 1) / cols);
  const rows: Track[] = [];
  for (let row = 0; row < rowCount; row++) {
    const inRow = items.slice(row * cols, row * cols + cols);
    const previous = rows[row - 1];
    if (inRow.length) {
      const top = Math.min(...inRow.map((box) => box.y));
      const bottom = Math.max(...inRow.map((box) => box.y + box.height));
      rows.push({ start: top, size: bottom - top });
    } else
      rows.push({
        start: previous ? previous.start + previous.size + rowGap : content.y,
        size: previous?.size ?? input.fallbackHeight,
      });
  }
  return rows.flatMap((row) =>
    columns.map((column) => ({
      x: column.start,
      y: row.start,
      width: column.size,
      height: row.size,
    })),
  );
}
