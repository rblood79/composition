/**
 * ADR-315 Phase 6 — a Table's visual merge (breakdown §5.5): a Column 「Merge same values」 runs its
 * rows' same values together in the order shown. A cell whose value is its row above's draws no
 * value and no line between them — one cell to the eye; the DOM keeps every row's Cell (RAC has no
 * `rowSpan`, and its text stays for a screen reader).
 *
 * The rows say it (`CatalogBoundRow.merge` — over every row shown, sorted · filtered · grouped,
 * before a window · a box height cuts them), the resolver carries it on each Row record
 * (`CATALOG_ROW_MERGE_UP_PROP` · `…DOWN…`) and the column projection on its Cells — by Column key,
 * so it follows a moved · pinned column.
 */
import type { CatalogBoundRow } from "../resolution/resolver";
import { catalogRowListMeta } from "./dataBinding";

/** A Row record's Column keys whose value its row above has (its cells there draw no value). */
export const CATALOG_ROW_MERGE_UP_PROP = "_mergeUp";
/** A Row record's Column keys whose value its row below has (no line under its cells there). */
export const CATALOG_ROW_MERGE_DOWN_PROP = "_mergeDown";
/**
 * A body Row of a Table with a merged Column: its line is drawn by its cells (each one's own
 * bottom line — `CATALOG_CELL_LINE_PROP`), not the row's (the Row rule's `cell-lines` block).
 */
export const CATALOG_ROW_CELL_LINES_PROP = "_cellLines";
/** Such a row's Cell: `bottom` draws the row's line under it, `none` runs into the row below. */
export const CATALOG_CELL_LINE_PROP = "_cellLine";
/** A Cell its row above runs into: its content is not drawn (the box and the DOM text stay). */
export const CATALOG_CELL_MERGED_PROP = "_cellMerged";
/**
 * ADR-315 Phase 6 — a body Cell of a Table its viewers select cell ranges in: its Column's key
 * (the DOM's `data-column-key` — a range is two (row key, Column key) points, breakdown §5.6).
 */
export const CATALOG_CELL_COLUMN_PROP = "_columnKey";
/**
 * ADR-317 Phase 4 — a Table 「Edit marks」's row edit status (`CatalogBoundRow.edit` — the
 * Preview session's edits not saved yet): `new` · `dirty` on its Row record (the DOM's
 * `data-edit-status`), its changed fields (Column keys) for the column projection to mark the
 * Cells (`CATALOG_CELL_EDITED_PROP` — `data-edited`). The first data Cell says the status
 * (`CATALOG_CELL_ROW_EDIT_PROP` — a text a screen reader reads, never only a color).
 */
export const CATALOG_ROW_EDIT_PROP = "_editStatus";
export const CATALOG_ROW_EDITED_FIELDS_PROP = "_editedFields";
export const CATALOG_CELL_EDITED_PROP = "_edited";
export const CATALOG_CELL_ROW_EDIT_PROP = "_rowEdit";
/**
 * ADR-324 — a 「모아서 저장」 row's save status words (the server's values · the fields' messages):
 * on the Row record and its first data Cell (said with the status).
 */
export const CATALOG_ROW_EDIT_NOTE_PROP = "_editNote";
export const CATALOG_CELL_ROW_EDIT_NOTE_PROP = "_rowEditNote";
/** ADR-324 — the statuses a row's edit mark says (`CatalogRowEditMark`). */
export const CATALOG_ROW_EDIT_STATUSES = [
  "new",
  "dirty",
  "conflict",
  "failed",
  "pending",
  "unlinked",
] as const;
export type CatalogRowEditStatusValue = (typeof CATALOG_ROW_EDIT_STATUSES)[number];
export const isCatalogRowEditStatus = (
  value: unknown,
): value is CatalogRowEditStatusValue =>
  (CATALOG_ROW_EDIT_STATUSES as readonly unknown[]).includes(value);

/** A cell value as merging compares it: exact (a grouping's equality), none for an empty one. */
const mergeValue = (value: unknown): string | undefined =>
  value === undefined || value === null || value === ""
    ? undefined
    : JSON.stringify(value);

/**
 * A data row — not a group's, a detail, a placeholder, a pinned one: it runs into its neighbours
 * (a merge) and takes its turn in the stripes (`tableStripes.ts`).
 */
export const catalogDataRow = (row: CatalogBoundRow): boolean =>
  !row.placeholder && !row.group && !row.detail && !row.pinned;

/** A row shown with rows under it (an open group · tree row · detail): it ends a run. */
export const catalogRowOpened = (row: CatalogBoundRow): boolean =>
  !!row.children?.some((child) => !child.placeholder);

const MERGED = new WeakMap<
  object,
  { readonly signature: string; readonly rows: readonly CatalogBoundRow[] }
>();

/**
 * `rows` with each row's merge (`CatalogBoundRow.merge`) for the Columns `keys` name: a row and the
 * sibling after it, both data rows and the first with no rows open under it, run together in a
 * Column where they hold the same value. The list's meta (counts · totals · sort · window) stays.
 */
export function catalogMergedRows(
  rows: readonly CatalogBoundRow[],
  keys: readonly string[],
): readonly CatalogBoundRow[] {
  if (!keys.length) return rows;
  const signature = JSON.stringify(keys);
  const held = MERGED.get(rows);
  if (held?.signature === signature) return held.rows;
  const visit = (list: readonly CatalogBoundRow[]): CatalogBoundRow[] => {
    const up = list.map((): string[] => []);
    const down = list.map((): string[] => []);
    for (let index = 1; index < list.length; index += 1) {
      const above = list[index - 1]!;
      const row = list[index]!;
      if (
        !catalogDataRow(above) ||
        !catalogDataRow(row) ||
        catalogRowOpened(above)
      )
        continue;
      for (const key of keys) {
        const value = mergeValue(above.values[key]);
        if (value !== undefined && value === mergeValue(row.values[key])) {
          up[index]!.push(key);
          down[index - 1]!.push(key);
        }
      }
    }
    return list.map((row, index) => {
      const children = row.children ? visit(row.children) : undefined;
      const merge =
        up[index]!.length || down[index]!.length
          ? {
              ...(up[index]!.length ? { up: up[index]! } : {}),
              ...(down[index]!.length ? { down: down[index]! } : {}),
            }
          : undefined;
      return merge || children
        ? {
            ...row,
            ...(children ? { children } : {}),
            ...(merge ? { merge } : {}),
          }
        : row;
    });
  };
  const out = Object.assign(visit(rows), catalogRowListMeta(rows));
  MERGED.set(rows, { signature, rows: out });
  return out;
}

/**
 * The rows a run draws, their merge cut at its ends (`segment` — a window, a box height or a page
 * of the rows): its first row shows its value and its last draws its line, whatever the rows
 * beyond (breakdown §5.5 — a virtual Table's window shows the value of a run it starts inside).
 * Pinned rows stand apart (no merge).
 */
export function catalogMergeEdges(
  segment: readonly CatalogBoundRow[],
): ReadonlyMap<number, CatalogBoundRow> | undefined {
  if (!segment.some((row) => row.merge)) return undefined;
  const places = segment
    .map((row, place) => (row.pinned ? -1 : place))
    .filter((place) => place >= 0);
  const first = places[0];
  const last = places.at(-1);
  const out = new Map<number, CatalogBoundRow>();
  const cut = (place: number | undefined, side: "up" | "down") => {
    if (place === undefined) return;
    const row = out.get(place) ?? segment[place]!;
    if (!row.merge?.[side]) return;
    const { [side]: _cut, ...rest } = row.merge;
    const { merge: _merge, ...base } = row;
    out.set(place, Object.keys(rest).length ? { ...base, merge: rest } : base);
  };
  cut(first, "up");
  cut(last, "down");
  return out;
}
