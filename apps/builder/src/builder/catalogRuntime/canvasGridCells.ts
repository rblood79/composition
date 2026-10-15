/**
 * The cells of a grid container as the Canvas overlay shows them (Figma, measured 2026-10-15):
 * every cell outlined while the grid is selected, hovered or dragged over, and the empty cell an
 * appended node goes to filled during a drag.
 *
 * Overlay geometry only — never a layout input (the engine places the items). Both axes size their
 * tracks the CSS way (common cases): px · % fixed, `fr` shares the free space, a content-sized track
 * (`auto` …) takes its largest item and — with no `fr` track — an equal share of the free space
 * (the default `normal` content alignment stretches auto tracks). Rows past the row template are
 * implicit `auto` rows. A column template we cannot count (`auto-fill` …) falls back to the
 * columns the items show.
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
 * The grid's cells, row-major. `items` are the drawn boxes of the flow children in document order
 * (an auto-placed grid without spans); `count` of them are placed. With `appendRow` (a drag) one
 * more implicit row follows when the grid is full — where an appended node goes.
 */
export function gridCells(input: {
  content: GridBox;
  columns: string | undefined;
  columnGap: number;
  rowGap: number;
  items: readonly GridBox[];
  count: number;
  fallbackHeight: number;
  /** The row template: its tracks are cells even without items. */
  rows?: string;
  /** One more row for an append (a drag) — off for showing the grid as it is (selection). */
  appendRow?: boolean;
}): GridBox[] {
  const { content, columnGap, rowGap, items } = input;
  const columnTokens = expandTracks(input.columns);
  let columns: { start: number; size: number }[];
  if (columnTokens?.length) {
    const cols = columnTokens.length;
    const widths = columnTokens.map((_, column) =>
      Math.max(
        0,
        ...items.filter((_, i) => i % cols === column).map((box) => box.width),
      ),
    );
    columns = sizeTracks(
      columnTokens.map((token) => trackKind(token, content.width)),
      widths,
      content.width,
      columnGap,
    ).map((track) => ({ start: content.x + track.start, size: track.size }));
  } else {
    // No template we can count: the columns the items show.
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
  const rowTokens = expandTracks(input.rows) ?? [];
  const rowCount = Math.max(Math.ceil(input.count / cols), rowTokens.length, 1);
  const heights = Array.from({ length: rowCount }, (_, row) =>
    Math.max(
      0,
      ...items.slice(row * cols, row * cols + cols).map((box) => box.height),
    ),
  );
  const rows = sizeTracks(
    Array.from({ length: rowCount }, (_, row) =>
      trackKind(rowTokens[row], content.height),
    ),
    heights,
    content.height,
    rowGap,
  ).map((track) => ({ start: content.y + track.start, size: track.size }));
  if (input.appendRow !== false && input.count >= rowCount * cols) {
    const last = rows[rows.length - 1]!;
    rows.push({
      start: last.start + last.size + rowGap,
      size: last.size || input.fallbackHeight,
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
