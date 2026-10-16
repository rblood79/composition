/**
 * A grid's column · row removal and the items in it (Figma grid — 2026-10-16 「다음 단계」): the
 * objects in a removed track move to the nearest cells and a span across it shrinks. A pinned item
 * past the removed tracks shifts back by their count; one whose every track went is unpinned on
 * that axis (the flow places it in a free cell of its row · column); an auto-placed item is left
 * to the flow.
 */
import {
  gridPlacement,
  lineSpan,
  lineTrack,
  type GridItemLines,
} from "./canvasGridCells";

/** A start line (1-based) or span to write: a number sets it, `null` clears it. */
export interface GridLinesEdit {
  start?: number | null;
  span?: number | null;
}

/**
 * One axis of an item's lines (`start` · `end` as authored — `"3"`, `"span 2"`) after removing the
 * 0-based `removed` tracks; undefined when nothing changes.
 */
export function gridLinesAfterTrackRemoval(
  lines: { start?: unknown; end?: unknown },
  removed: readonly number[],
): GridLinesEdit | undefined {
  const track = lineTrack(lines.start);
  if (track === undefined) return undefined;
  const span = lineSpan(lines.end) ?? 1;
  const before = removed.filter((index) => index < track).length;
  const inside = removed.filter(
    (index) => index >= track && index < track + span,
  ).length;
  const edit: GridLinesEdit = {};
  const hadSpan = lineSpan(lines.end) !== undefined;
  if (inside >= span) {
    edit.start = null;
    if (hadSpan) edit.span = null;
    return edit;
  }
  if (before) edit.start = track - before + 1;
  if (inside) edit.span = span - inside > 1 ? span - inside : null;
  return Object.keys(edit).length ? edit : undefined;
}

/**
 * The track order after moving `moving` (0-based) before the old track `before` (0 … count —
 * `count` = to the end), as `order[newIndex] = oldIndex` (Figma: dragging a track's grabber, a
 * selection of tracks keeps its own order).
 */
export function gridTrackOrderAfterMove(
  count: number,
  moving: readonly number[],
  before: number,
): number[] {
  const set = new Set(moving.filter((index) => index >= 0 && index < count));
  const rest = Array.from({ length: count }, (_, index) => index).filter(
    (index) => !set.has(index),
  );
  const at = rest.filter((index) => index < before).length;
  const moved = [...set].sort((a, b) => a - b);
  return [...rest.slice(0, at), ...moved, ...rest.slice(at)];
}

/**
 * One axis of an item's lines after reordering the tracks (`order[newIndex] = oldIndex`): a pinned
 * item goes with its start track (Figma — a track's objects move with it); its span stays.
 * Undefined when nothing changes (an auto-placed item is left to the flow).
 */
export function gridLinesAfterTrackMove(
  lines: { start?: unknown },
  order: readonly number[],
): GridLinesEdit | undefined {
  const track = lineTrack(lines.start);
  if (track === undefined) return undefined;
  const next = order.indexOf(track);
  return next < 0 || next === track ? undefined : { start: next + 1 };
}

/**
 * The items a track delete removes (Figma — deleting a column · row deletes what is in it): those
 * whose every track on a deleted axis is removed, placed as CSS places them (authored lines, else
 * auto-placed around those — `gridPlacement`). An item that also spans a kept track stays (its
 * span shrinks — {@link gridLinesAfterTrackRemoval}). `columnCount` is the old column count.
 */
export function gridItemsInRemovedTracks(
  lines: readonly (GridItemLines | undefined)[],
  columnCount: number,
  removed: { column?: readonly number[]; row?: readonly number[] },
): number[] {
  const { cells } = gridPlacement(lines, columnCount);
  const inside = (start: number, span: number, tracks?: readonly number[]) =>
    !!tracks?.length &&
    Array.from({ length: span }, (_, at) => start + at).every((track) =>
      tracks.includes(track),
    );
  return cells.flatMap((area, index) =>
    inside(area.column, area.columnSpan, removed.column) ||
    inside(area.row, area.rowSpan, removed.row)
      ? [index]
      : [],
  );
}
