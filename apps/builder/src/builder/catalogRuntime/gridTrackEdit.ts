/**
 * A grid's column · row removal and the items in it (Figma grid — 2026-10-16 「다음 단계」): the
 * objects in a removed track move to the nearest cells and a span across it shrinks. A pinned item
 * past the removed tracks shifts back by their count; one whose every track went is unpinned on
 * that axis (the flow places it in a free cell of its row · column); an auto-placed item is left
 * to the flow.
 */
import { lineSpan, lineTrack } from "./canvasGridCells";

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
